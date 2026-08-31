"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { db } from "@/lib/instantdb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ApiKeyRow = {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: number;
  createdByEmail: string;
  lastUsedAt: number | null;
  revokedAt: number | null;
};

type QueryTarget = "users" | "punches";

async function adminAuthHeaders(): Promise<HeadersInit> {
  const user = await db.getAuth();
  if (!user?.refresh_token) {
    throw new Error("Not signed in.");
  }
  return { Authorization: `Bearer ${user.refresh_token}` };
}

function formatTs(ms: number | null): string {
  if (!ms) return "—";
  try {
    return format(new Date(ms), "yyyy-MM-dd HH:mm");
  } catch {
    return "—";
  }
}

export default function ApiAdmin() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [keysLoading, setKeysLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const [target, setTarget] = useState<QueryTarget>("punches");
  const [testKey, setTestKey] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [dept, setDept] = useState("");
  const [userId, setUserId] = useState("");
  const [punchType, setPunchType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [limit, setLimit] = useState("100");
  const [querying, setQuerying] = useState(false);
  const [queryStatus, setQueryStatus] = useState<string | null>(null);
  const [queryBody, setQueryBody] = useState("");

  const loadKeys = useCallback(async () => {
    setKeysLoading(true);
    try {
      const headers = await adminAuthHeaders();
      const res = await fetch("/api/admin/api-keys", { headers });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error || `Failed to load keys (${res.status})`);
        return;
      }
      setKeys(Array.isArray(json?.data) ? json.data : []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load keys.");
    } finally {
      setKeysLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  const handleCreate = async () => {
    const nameTrimmed = newName.trim();
    if (!nameTrimmed) {
      toast.error("Enter a label for this key.");
      return;
    }
    try {
      setCreating(true);
      const headers = await adminAuthHeaders();
      const res = await fetch("/api/admin/api-keys", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameTrimmed }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error || `Failed to create key (${res.status})`);
        return;
      }
      const secret = typeof json?.secret === "string" ? json.secret : "";
      setRevealedSecret(secret || null);
      if (secret) setTestKey(secret);
      setNewName("");
      toast.success("API key created. Copy it now — it will not be shown again.");
      await loadKeys();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to create key.");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (row: ApiKeyRow) => {
    if (row.revokedAt) return;
    if (!window.confirm(`Revoke key ${row.keyPrefix}… (${row.name})? This cannot be undone.`)) {
      return;
    }
    try {
      setRevokingId(row.id);
      const headers = await adminAuthHeaders();
      const res = await fetch(`/api/admin/api-keys/${row.id}`, {
        method: "DELETE",
        headers,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error || `Failed to revoke key (${res.status})`);
        return;
      }
      toast.success("API key revoked.");
      await loadKeys();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to revoke key.");
    } finally {
      setRevokingId(null);
    }
  };

  const copySecret = async () => {
    if (!revealedSecret) return;
    try {
      await navigator.clipboard.writeText(revealedSecret);
      toast.success("Copied to clipboard.");
    } catch {
      toast.error("Could not copy. Select the key and copy it manually.");
    }
  };

  const handleTestQuery = async () => {
    const key = testKey.trim();
    if (!key) {
      toast.error("Paste an API key to run a test query.");
      return;
    }
    const params = new URLSearchParams();
    if (name.trim()) params.set("name", name.trim());
    if (email.trim()) params.set("email", email.trim());
    if (limit.trim()) params.set("limit", limit.trim());
    if (target === "users") {
      if (dept.trim()) params.set("dept", dept.trim());
    } else {
      if (userId.trim()) params.set("userId", userId.trim());
      if (punchType.trim()) params.set("type", punchType.trim());
      if (from.trim()) params.set("from", from.trim());
      if (to.trim()) params.set("to", to.trim());
    }
    const path =
      target === "users" ? "/api/v1/users" : "/api/v1/punches";
    const url = `${path}?${params.toString()}`;
    try {
      setQuerying(true);
      setQueryStatus(null);
      setQueryBody("");
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${key}` },
      });
      const text = await res.text();
      let pretty = text;
      try {
        pretty = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        // keep raw
      }
      setQueryStatus(`${res.status} ${res.statusText}`);
      setQueryBody(pretty);
    } catch (e: unknown) {
      setQueryStatus("request failed");
      setQueryBody(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setQuerying(false);
    }
  };

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
          API keys
        </h2>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
          Keys authenticate GET requests to{" "}
          <code className="rounded bg-gray-200 px-1 dark:bg-gray-700">
            /api/v1/users
          </code>{" "}
          and{" "}
          <code className="rounded bg-gray-200 px-1 dark:bg-gray-700">
            /api/v1/punches
          </code>
          . Send{" "}
          <code className="rounded bg-gray-200 px-1 dark:bg-gray-700">
            Authorization: Bearer chk_…
          </code>
          . The full secret is shown only once.
        </p>

        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Label
            </label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Payroll export"
              maxLength={80}
            />
          </div>
          <Button
            type="button"
            onClick={() => void handleCreate()}
            disabled={creating || !newName.trim()}
          >
            {creating ? "Generating..." : "Generate key"}
          </Button>
        </div>

        {revealedSecret ? (
          <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/40">
            <p className="mb-2 text-sm font-medium text-amber-900 dark:text-amber-200">
              Copy this key now. It will not be shown again.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input readOnly value={revealedSecret} className="font-mono text-xs" />
              <Button type="button" variant="outline" onClick={() => void copySecret()}>
                Copy
              </Button>
            </div>
          </div>
        ) : null}

        {keysLoading ? (
          <p className="text-sm text-gray-600 dark:text-gray-300">Loading keys…</p>
        ) : keys.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-300">
            No API keys yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                <tr>
                  <th className="px-3 py-2 font-medium">Label</th>
                  <th className="px-3 py-2 font-medium">Prefix</th>
                  <th className="px-3 py-2 font-medium">Created</th>
                  <th className="px-3 py-2 font-medium">Last used</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {keys.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-gray-200 dark:border-gray-700"
                  >
                    <td className="px-3 py-2 text-gray-900 dark:text-gray-100">
                      {row.name}
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-700 dark:text-gray-300">
                      {row.keyPrefix}…
                    </td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                      {formatTs(row.createdAt)}
                    </td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                      {formatTs(row.lastUsedAt)}
                    </td>
                    <td className="px-3 py-2">
                      {row.revokedAt ? (
                        <span className="text-red-600 dark:text-red-400">Revoked</span>
                      ) : (
                        <span className="text-green-700 dark:text-green-400">Active</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {!row.revokedAt ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={revokingId === row.id}
                          onClick={() => void handleRevoke(row)}
                        >
                          {revokingId === row.id ? "Revoking..." : "Revoke"}
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
          Test query
        </h2>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
          Calls the public GET endpoints with your key. Punches require{" "}
          <code className="rounded bg-gray-200 px-1 dark:bg-gray-700">from</code>{" "}
          and{" "}
          <code className="rounded bg-gray-200 px-1 dark:bg-gray-700">to</code>{" "}
          as ISO-8601 (max 366 days). Name and email are case-insensitive exact
          matches.
        </p>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Endpoint
            </label>
            <select
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              value={target}
              onChange={(e) => setTarget(e.target.value as QueryTarget)}
            >
              <option value="punches">GET /api/v1/punches</option>
              <option value="users">GET /api/v1/users</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              API key
            </label>
            <Input
              value={testKey}
              onChange={(e) => setTestKey(e.target.value)}
              placeholder="chk_…"
              className="font-mono text-xs"
              autoComplete="off"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                email
              </label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@example.com"
              />
            </div>
            {target === "users" ? (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  dept
                </label>
                <Input
                  value={dept}
                  onChange={(e) => setDept(e.target.value)}
                  placeholder="Engineering or ENG"
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    userId
                  </label>
                  <Input
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    placeholder="Instant user id"
                    className="font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    type
                  </label>
                  <Input
                    value={punchType}
                    onChange={(e) => setPunchType(e.target.value)}
                    placeholder="checkin"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    from (ISO)
                  </label>
                  <Input
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    placeholder="2026-08-01T00:00:00Z"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    to (ISO)
                  </label>
                  <Input
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    placeholder="2026-08-31T23:59:59Z"
                  />
                </div>
              </>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                limit
              </label>
              <Input
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                placeholder="100"
              />
            </div>
          </div>

          <Button
            type="button"
            onClick={() => void handleTestQuery()}
            disabled={querying || !testKey.trim()}
          >
            {querying ? "Running..." : "Run query"}
          </Button>

          {queryStatus ? (
            <div>
              <p className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                {queryStatus}
              </p>
              <pre className="max-h-96 overflow-auto rounded-md border border-gray-200 bg-white p-3 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
                {queryBody}
              </pre>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
