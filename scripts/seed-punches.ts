/**
 * Seed checkin/checkout punches for existing (and optional Faker) users.
 *
 * Usage:
 *   npm run seed:punches
 *   npm run seed:punches -- --date-start=2023-02-02
 *   npm run seed:punches -- --date-start=2023-02-02 --date-end=2023-02-28
 *   npm run seed:punches -- --faker-users=10
 */
import { parseArgs } from "node:util";
import { faker } from "@faker-js/faker";
import { id, tx } from "@instantdb/admin";
import { requireAdminAPI } from "../lib/instantdb-admin";

type AdminAPI = ReturnType<typeof requireAdminAPI>;

type UserRow = {
  id: string;
  name?: string;
  email?: string;
};

type DeptRow = {
  id: string;
  name?: string;
  departmentId?: string;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const BATCH_SIZE = 50;
const ATTENDANCE_RATE = 0.9;
const EXISTING_USER_SELECT_RATE = 0.5;

function printHelp() {
  console.log(`Seed checkin/checkout punches via Instant admin.

Options:
  --date-start=YYYY-MM-DD   Inclusive start (default: today - 7 days)
  --date-end=YYYY-MM-DD     Inclusive end (default: today)
  --faker-users=N           Create N Faker users and include them in the pool
  --help                    Show this help

Examples:
  npm run seed:punches
  npm run seed:punches -- --date-start=2023-02-02
  npm run seed:punches -- --faker-users=10
`);
}

function parseLocalDate(value: string, label: string): Date {
  if (!DATE_RE.test(value)) {
    throw new Error(`${label} must be YYYY-MM-DD, got: ${value}`);
  }
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    throw new Error(`${label} is not a valid calendar date: ${value}`);
  }
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function defaultStartDate(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - 7);
  return d;
}

function defaultEndDate(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Randomly keep ~50% of users (at least 1 if any exist). */
function selectRandomExistingUsers(users: UserRow[]): UserRow[] {
  if (users.length === 0) return [];
  if (users.length === 1) return users;

  const selected = users.filter(() => Math.random() < EXISTING_USER_SELECT_RATE);
  if (selected.length === 0) {
    return [users[Math.floor(Math.random() * users.length)]];
  }
  return selected;
}

function eachDayInclusive(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function isWeekday(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

function randomTimeOnDay(
  baseDate: Date,
  hourStart: number,
  hourEndExclusive: number
): number {
  const hour =
    hourStart + Math.floor(Math.random() * (hourEndExclusive - hourStart));
  const minute = Math.floor(Math.random() * 60);
  const second = Math.floor(Math.random() * 60);
  return new Date(baseDate).setHours(hour, minute, second, 0);
}

function punchOp(
  userId: string,
  type: "checkin" | "checkout",
  timestamp: number
) {
  const punchId = id();
  return tx.punches[punchId].update({
    type,
    timestamp,
    serverCreatedAt: timestamp,
    isAdminGenerated: false,
    isSystemGenerated: false,
    userId,
    device: "seed-script",
  });
}

async function transactInBatches(adminAPI: AdminAPI, ops: unknown[]) {
  for (let i = 0; i < ops.length; i += BATCH_SIZE) {
    const chunk = ops.slice(i, i + BATCH_SIZE);
    await adminAPI.transact(chunk as never[]);
  }
}

async function ensureSeedDepartmentId(
  adminAPI: AdminAPI,
  departments: DeptRow[]
): Promise<string> {
  if (departments.length > 0) {
    return departments[0].id;
  }

  const seedDeptId = id();
  await adminAPI.transact([
    tx.departments[seedDeptId].update({
      name: "Seed",
      departmentId: "SEED",
    }),
  ]);
  console.log("Created Seed department (no departments existed).");
  return seedDeptId;
}

async function createFakerUsers(
  adminAPI: AdminAPI,
  count: number,
  deptId: string
): Promise<UserRow[]> {
  const now = Date.now();
  const created: UserRow[] = [];
  const ops: unknown[] = [];

  for (let i = 0; i < count; i++) {
    const userId = id();
    const name = faker.person.fullName();
    const suffix = id().replace(/-/g, "").slice(0, 8).toLowerCase();
    const email = `${faker.internet
      .username()
      .toLowerCase()}.${suffix}@example.com`;
    const barcode = `SEED${suffix.toUpperCase()}`;

    ops.push(
      tx.users[userId].update({
        name,
        email,
        barcode,
        isAdmin: false,
        isAuth: false,
        lastLoginAt: now,
        createdAt: now,
        serverCreatedAt: now,
        deptId,
        laptopSerial: "",
        purpose: "",
      })
    );
    created.push({ id: userId, name, email });
  }

  await transactInBatches(adminAPI, ops);
  return created;
}

function buildPunchOps(users: UserRow[], start: Date, end: Date): unknown[] {
  const ops: unknown[] = [];

  for (const day of eachDayInclusive(start, end)) {
    if (!isWeekday(day)) continue;

    for (const user of users) {
      if (Math.random() >= ATTENDANCE_RATE) continue;

      const checkInAt = randomTimeOnDay(day, 7, 10);
      let checkOutAt = randomTimeOnDay(day, 15, 19);
      if (checkOutAt <= checkInAt) {
        checkOutAt = checkInAt + 8 * 60 * 60 * 1000;
      }

      ops.push(punchOp(user.id, "checkin", checkInAt));
      ops.push(punchOp(user.id, "checkout", checkOutAt));
    }
  }

  return ops;
}

async function main() {
  const { values } = parseArgs({
    options: {
      "date-start": { type: "string" },
      "date-end": { type: "string" },
      "faker-users": { type: "string" },
      help: { type: "boolean", default: false },
    },
    strict: true,
    allowPositionals: false,
  });

  if (values.help) {
    printHelp();
    return;
  }

  const start = values["date-start"]
    ? parseLocalDate(values["date-start"], "--date-start")
    : defaultStartDate();
  const end = values["date-end"]
    ? parseLocalDate(values["date-end"], "--date-end")
    : defaultEndDate();

  if (end < start) {
    throw new Error("--date-end must be on or after --date-start");
  }

  let fakerCount = 0;
  if (values["faker-users"] !== undefined) {
    fakerCount = Number.parseInt(values["faker-users"], 10);
    if (!Number.isInteger(fakerCount) || fakerCount < 1) {
      throw new Error("--faker-users must be a positive integer");
    }
  }

  const adminAPI = requireAdminAPI();

  const data = (await adminAPI.query({
    users: { $: {} },
    departments: { $: {} },
  })) as { users?: UserRow[]; departments?: DeptRow[] };

  const existingUsers = data.users ?? [];
  const departments = data.departments ?? [];

  const selectedExisting = selectRandomExistingUsers(existingUsers);
  let createdUsers: UserRow[] = [];

  if (fakerCount > 0) {
    const deptId = await ensureSeedDepartmentId(adminAPI, departments);
    createdUsers = await createFakerUsers(adminAPI, fakerCount, deptId);
  }

  const targets = shuffleInPlace([...selectedExisting, ...createdUsers]);

  if (targets.length === 0) {
    throw new Error(
      "No target users. Create users first, or pass --faker-users=N."
    );
  }

  const punchOps = buildPunchOps(targets, start, end);
  await transactInBatches(adminAPI, punchOps);

  console.log("Seed complete.");
  console.log(`  Date range:   ${formatLocalDate(start)} → ${formatLocalDate(end)}`);
  console.log(`  Existing DB:  ${existingUsers.length} users`);
  console.log(`  Selected:     ${selectedExisting.length} existing users`);
  console.log(`  Created:      ${createdUsers.length} faker users`);
  console.log(`  Targeted:     ${targets.length} users`);
  console.log(`  Punches:      ${punchOps.length} (${punchOps.length / 2} in/out pairs)`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
