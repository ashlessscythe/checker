import { tx } from "@instantdb/admin";
import { requireAdminAPI } from "@/lib/instantdb-admin";
import { authenticatePresentedKey, type StoredApiKey } from "@/lib/public-api-auth";
import { apiKeyRateLimiter } from "@/lib/public-api-rate-limit";
import {
  buildPunchInstantWhere,
  filterAndShapeUsers,
  matchingUserIds,
  shapePunches,
  type ParsedPunchFilters,
  type ParsedUserFilters,
  type PublicPunch,
  type PublicUser,
} from "@/lib/public-api-query";

type AdminAPI = ReturnType<typeof requireAdminAPI>;

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

export async function lookupApiKeyByHash(
  adminAPI: AdminAPI,
  keyHash: string
): Promise<StoredApiKey | null> {
  const data = (await adminAPI.query({
    apiKeys: {
      $: { where: { keyHash }, limit: 1 },
    },
  })) as { apiKeys?: StoredApiKey[] };
  return data.apiKeys?.[0] ?? null;
}

export async function authenticatePublicApiRequest(
  req: Request,
  adminAPI: AdminAPI
) {
  return authenticatePresentedKey({
    authorizationHeader: req.headers.get("authorization"),
    lookupByHash: (hash) => lookupApiKeyByHash(adminAPI, hash),
    tryConsumeRateLimit: (keyId, now) =>
      apiKeyRateLimiter.tryConsume(keyId, now),
  });
}

export async function touchApiKeyLastUsed(
  adminAPI: AdminAPI,
  keyId: string
): Promise<void> {
  try {
    await adminAPI.transact([
      tx.apiKeys[keyId].update({ lastUsedAt: Date.now() }),
    ]);
  } catch {
    // Listing must still succeed if the timestamp write fails.
  }
}

async function loadUsersAndDepartments(adminAPI: AdminAPI): Promise<{
  users: UserRow[];
  departments: DeptRow[];
}> {
  const data = (await adminAPI.query({
    users: { $: {} },
    departments: { $: {} },
  })) as { users?: UserRow[]; departments?: DeptRow[] };
  return {
    users: data.users ?? [],
    departments: data.departments ?? [],
  };
}

export async function listPublicUsers(
  adminAPI: AdminAPI,
  filters: ParsedUserFilters
): Promise<{ data: PublicUser[]; meta: { count: number; limit: number } }> {
  const { users, departments } = await loadUsersAndDepartments(adminAPI);
  const data = filterAndShapeUsers(users, departments, filters);
  return { data, meta: { count: data.length, limit: filters.limit } };
}

export async function listPublicPunches(
  adminAPI: AdminAPI,
  filters: ParsedPunchFilters
): Promise<{ data: PublicPunch[]; meta: { count: number; limit: number } }> {
  const { users, departments } = await loadUsersAndDepartments(adminAPI);
  const userIds = matchingUserIds(users, departments, filters);
  if (userIds && userIds.length === 0) {
    return { data: [], meta: { count: 0, limit: filters.limit } };
  }

  const punchQuery = {
    punches: {
      $: {
        where: buildPunchInstantWhere(filters, userIds),
        order: { timestamp: "desc" as const },
        limit: filters.limit,
      },
    },
  };
  const punchData = (await adminAPI.query(punchQuery as never)) as {
    punches?: PunchRow[];
  };

  const data = shapePunches(
    punchData.punches ?? [],
    users,
    departments,
    filters.limit
  );
  return { data, meta: { count: data.length, limit: filters.limit } };
}
