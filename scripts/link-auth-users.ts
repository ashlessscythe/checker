/**
 * Backfill: link each app `users` row to its Instant `$users` auth record by email.
 * Usage: npm run link:auth-users [-- --dry-run]
 */
import { requireAdminAPI } from "../lib/instantdb-admin";
import { tx } from "@instantdb/admin";

async function main() {
  const dry = process.argv.includes("--dry-run");
  const db = requireAdminAPI();
  const data = (await db.query({ users: {}, $users: {} })) as {
    users: Array<{ id: string; email?: string }>;
    $users: Array<{ id: string; email?: string }>;
  };
  const byEmail = new Map(
    data.$users.map((u) => [String(u.email ?? "").toLowerCase(), u.id])
  );
  const ops: ReturnType<typeof tx.users[string]["link"]>[] = [];
  let missing = 0;
  for (const u of data.users) {
    const authId = byEmail.get(String(u.email ?? "").toLowerCase());
    if (!authId) {
      missing++;
      continue;
    }
    ops.push(tx.users[u.id].link({ $user: authId }));
  }
  console.log(
    `${ops.length} to link, ${missing} app users with no auth account yet (linked on first login).`
  );
  if (dry) return;
  for (let i = 0; i < ops.length; i += 100) {
    await db.transact(ops.slice(i, i + 100));
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
