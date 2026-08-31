export const DEFAULT_LIST_LIMIT = 100;
export const MAX_LIST_LIMIT = 500;
export const MAX_PUNCH_RANGE_MS = 366 * 24 * 60 * 60 * 1000;
export const LAST_USED_TOUCH_INTERVAL_MS = 60_000;

export type QueryParseError = { error: string };

export type ParsedListLimit = { limit: number };

export type ParsedUserFilters = {
  name?: string;
  email?: string;
  dept?: string;
  limit: number;
};

export type ParsedPunchFilters = {
  fromMs: number;
  toMs: number;
  userId?: string;
  name?: string;
  email?: string;
  type?: string;
  limit: number;
};

export type PublicDepartment = {
  id: string;
  name: string;
  departmentId: string;
};

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  department: PublicDepartment | null;
};

export type PublicPunch = {
  id: string;
  type: string;
  timestamp: string;
  user: PublicUser | null;
};

type UserRow = {
  id: string;
  name?: string;
  email?: string;
  deptId?: string;
};

type DeptRow = {
  id: string;
  name?: string;
  departmentId?: string;
};

type PunchRow = {
  id: string;
  type?: string;
  timestamp?: number;
  serverCreatedAt?: number;
  userId?: string;
};

function trimOrUndef(value: string | null | undefined): string | undefined {
  if (value == null) return undefined;
  const t = value.trim();
  return t ? t : undefined;
}

export function parseListLimit(
  raw: string | null | undefined
): ParsedListLimit | QueryParseError {
  if (raw == null || raw.trim() === "") {
    return { limit: DEFAULT_LIST_LIMIT };
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    return { error: "limit must be a positive integer." };
  }
  return { limit: Math.min(n, MAX_LIST_LIMIT) };
}

export function parseIsoMs(
  raw: string | null | undefined,
  field: string
): { ms: number } | QueryParseError {
  const value = trimOrUndef(raw);
  if (!value) {
    return { error: `${field} is required and must be an ISO-8601 date.` };
  }
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) {
    return { error: `${field} must be a valid ISO-8601 date.` };
  }
  return { ms };
}

export function parseUserQuery(
  params: URLSearchParams
): ParsedUserFilters | QueryParseError {
  const limitResult = parseListLimit(params.get("limit"));
  if ("error" in limitResult) return limitResult;
  return {
    name: trimOrUndef(params.get("name")),
    email: trimOrUndef(params.get("email")),
    dept: trimOrUndef(params.get("dept")),
    limit: limitResult.limit,
  };
}

export function parsePunchQuery(
  params: URLSearchParams
): ParsedPunchFilters | QueryParseError {
  const limitResult = parseListLimit(params.get("limit"));
  if ("error" in limitResult) return limitResult;

  const fromResult = parseIsoMs(params.get("from"), "from");
  if ("error" in fromResult) return fromResult;
  const toResult = parseIsoMs(params.get("to"), "to");
  if ("error" in toResult) return toResult;

  if (fromResult.ms > toResult.ms) {
    return { error: "from must be less than or equal to to." };
  }
  if (toResult.ms - fromResult.ms > MAX_PUNCH_RANGE_MS) {
    return { error: "Time range cannot exceed 366 days." };
  }

  return {
    fromMs: fromResult.ms,
    toMs: toResult.ms,
    userId: trimOrUndef(params.get("userId")),
    name: trimOrUndef(params.get("name")),
    email: trimOrUndef(params.get("email")),
    type: trimOrUndef(params.get("type")),
    limit: limitResult.limit,
  };
}

export function equalsInsensitive(actual: string | undefined, filter: string): boolean {
  return String(actual ?? "").trim().toLowerCase() === filter.trim().toLowerCase();
}

export function resolveDepartment(
  user: UserRow,
  departments: DeptRow[]
): PublicDepartment | null {
  const dept = user.deptId
    ? departments.find((d) => d.id === user.deptId)
    : undefined;
  if (!dept) return null;
  return {
    id: dept.id,
    name: String(dept.name ?? "").trim(),
    departmentId: String(dept.departmentId ?? "").trim(),
  };
}

export function userMatchesFilters(
  user: UserRow,
  departments: DeptRow[],
  filters: {
    userId?: string;
    name?: string;
    email?: string;
    dept?: string;
  }
): boolean {
  if (filters.userId && user.id !== filters.userId) return false;
  if (filters.name && !equalsInsensitive(user.name, filters.name)) return false;
  if (filters.email && !equalsInsensitive(user.email, filters.email)) return false;
  if (filters.dept) {
    const dept = resolveDepartment(user, departments);
    const hit =
      (dept && equalsInsensitive(dept.name, filters.dept)) ||
      (dept && equalsInsensitive(dept.departmentId, filters.dept));
    if (!hit) return false;
  }
  return true;
}

export function toPublicUser(user: UserRow, departments: DeptRow[]): PublicUser {
  return {
    id: user.id,
    name: String(user.name ?? "").trim(),
    email: String(user.email ?? "").trim(),
    department: resolveDepartment(user, departments),
  };
}

export function filterAndShapeUsers(
  users: UserRow[],
  departments: DeptRow[],
  filters: ParsedUserFilters
): PublicUser[] {
  const matched = users.filter((u) => userMatchesFilters(u, departments, filters));
  matched.sort((a, b) =>
    String(a.name ?? "").localeCompare(String(b.name ?? ""), undefined, {
      sensitivity: "base",
    })
  );
  return matched.slice(0, filters.limit).map((u) => toPublicUser(u, departments));
}

export function matchingUserIds(
  users: UserRow[],
  departments: DeptRow[],
  filters: { userId?: string; name?: string; email?: string }
): string[] | null {
  const hasUserFilter = Boolean(filters.userId || filters.name || filters.email);
  if (!hasUserFilter) return null;
  return users
    .filter((u) => userMatchesFilters(u, departments, filters))
    .map((u) => u.id);
}

export type PunchInstantWhere = {
  timestamp: { $gte: number; $lte: number };
  userId?: string | { $in: string[] };
  type?: string;
};

export function buildPunchInstantWhere(
  filters: ParsedPunchFilters,
  userIds: string[] | null
): PunchInstantWhere {
  const where: PunchInstantWhere = {
    timestamp: { $gte: filters.fromMs, $lte: filters.toMs },
  };
  if (userIds && userIds.length === 1) {
    where.userId = userIds[0];
  } else if (userIds && userIds.length > 1) {
    where.userId = { $in: userIds };
  }
  if (filters.type) {
    where.type = filters.type;
  }
  return where;
}

export function punchTimestampMs(punch: PunchRow): number | null {
  const ms = punch.timestamp || punch.serverCreatedAt;
  return typeof ms === "number" && Number.isFinite(ms) && ms > 0 ? ms : null;
}

export function shapePunches(
  punches: PunchRow[],
  users: UserRow[],
  departments: DeptRow[],
  limit: number
): PublicPunch[] {
  const userById = new Map(users.map((u) => [u.id, u]));
  const sorted = [...punches].sort((a, b) => {
    const ta = punchTimestampMs(a) ?? 0;
    const tb = punchTimestampMs(b) ?? 0;
    return tb - ta;
  });
  return sorted.slice(0, limit).map((p) => {
    const ms = punchTimestampMs(p) ?? 0;
    const user = p.userId ? userById.get(p.userId) : undefined;
    return {
      id: p.id,
      type: String(p.type ?? ""),
      timestamp: new Date(ms).toISOString(),
      user: user ? toPublicUser(user, departments) : null,
    };
  });
}

export function shouldTouchLastUsed(
  lastUsedAt: number | undefined,
  now: number
): boolean {
  if (!lastUsedAt || lastUsedAt <= 0) return true;
  return now - lastUsedAt >= LAST_USED_TOUCH_INTERVAL_MS;
}
