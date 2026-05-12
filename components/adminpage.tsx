// components/AdminPage.tsx
"use client";

import { useMemo, useState } from "react";
import { tx } from "@instantdb/react";
import { db } from "../lib/instantdb";
import toast, { Toaster } from "react-hot-toast";
import { useAutoNavigate } from "../hooks/useAutoNavigate";
import { useAuth } from "../hooks/authContext";
import { useDebounce } from "../hooks/useDebounce";

type EditField = "name" | "email" | "barcode";

type TriState = "any" | "yes" | "no";
type SortKey = "email" | "name" | "barcode";

function matchesSearch(
  user: {
    name?: string;
    email?: string;
    barcode?: string;
  },
  q: string
) {
  if (!q.trim()) return true;
  const n = q.trim().toLowerCase();
  return [user.name, user.email, user.barcode].some(
    (v) => typeof v === "string" && v.toLowerCase().includes(n)
  );
}

function filterToggleClass(active: boolean) {
  return active
    ? "bg-blue-600 text-white dark:bg-blue-500"
    : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600";
}

function normalizeEmail(raw: string) {
  return raw.trim().toLowerCase();
}

function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export default function AdminPage() {
  const { data, isLoading, error } = db.useQuery({ users: {} });
  const { user: authUser } = useAuth();
  const [editField, setEditField] = useState<{
    userId: string;
    field: EditField;
  } | null>(null);
  const [draft, setDraft] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 280);
  const [adminFilter, setAdminFilter] = useState<TriState>("any");
  const [authFilter, setAuthFilter] = useState<TriState>("any");
  const [sortKey, setSortKey] = useState<SortKey>("email");

  useAutoNavigate("/", 300000);

  const allUsers = data?.users ?? [];

  const displayUsers = useMemo(() => {
    let list = [...allUsers];

    list = list.filter((u) => matchesSearch(u, debouncedSearch));

    if (adminFilter === "yes") list = list.filter((u) => Boolean(u.isAdmin));
    if (adminFilter === "no") list = list.filter((u) => !u.isAdmin);

    if (authFilter === "yes") list = list.filter((u) => Boolean(u.isAuth));
    if (authFilter === "no") list = list.filter((u) => !u.isAuth);

    const sortField = (u: (typeof list)[0]) => {
      if (sortKey === "email") return u.email ?? "";
      if (sortKey === "name") return u.name ?? "";
      return u.barcode ?? "";
    };
    list.sort((a, b) =>
      sortField(a).localeCompare(sortField(b), undefined, {
        sensitivity: "base",
      })
    );

    return list;
  }, [allUsers, debouncedSearch, adminFilter, authFilter, sortKey]);

  const currentAppUserId = authUser?.id ?? null;

  const beginEdit = (userId: string, field: EditField, current: string) => {
    setEditField({ userId, field });
    setDraft(current ?? "");
  };

  const cancelEdit = () => {
    setEditField(null);
    setDraft("");
  };

  const handleNameSave = async (userId: string) => {
    const name = draft.trim();
    if (!name) {
      toast.error("Name cannot be empty.");
      return;
    }
    try {
      await db.transact([tx.users[userId].update({ name })]);
      toast.success("Name updated.");
      cancelEdit();
    } catch (e) {
      console.error(e);
      toast.error("Failed to update name.");
    }
  };

  const handleEmailSave = async (userId: string) => {
    const normalized = normalizeEmail(draft);
    if (!isValidEmail(normalized)) {
      toast.error("Enter a valid email address.");
      return;
    }
    try {
      const { data: existing } = await db.queryOnce({
        users: {
          $: { where: { email: normalized } },
        },
      });
      if (existing?.users?.some((u) => u.id !== userId)) {
        toast.error("That email is already used by another user.");
        return;
      }
      await db.transact([tx.users[userId].update({ email: normalized })]);
      toast.success("Email updated.");
      cancelEdit();
    } catch (e) {
      console.error(e);
      toast.error("Failed to update email.");
    }
  };

  const handleBarcodeSave = async (userId: string) => {
    const barcode = draft.trim();
    try {
      const { data: existing } = await db.queryOnce({
        users: {
          $: { where: { barcode } },
        },
      });
      if (
        barcode &&
        existing?.users?.some((u) => u.id !== userId)
      ) {
        toast.error("That kiosk barcode is already assigned to another user.");
        return;
      }
      await db.transact([tx.users[userId].update({ barcode })]);
      toast.success("Kiosk barcode updated.");
      cancelEdit();
    } catch (e) {
      console.error(e);
      toast.error("Failed to update barcode.");
    }
  };

  const toggleAdminStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await db.transact([
        tx.users[userId].update({ isAdmin: !currentStatus }),
      ]);
      toast.success(
        currentStatus
          ? "Admin access removed."
          : "User is now an admin."
      );
    } catch (e) {
      console.error(e);
      toast.error("Failed to update admin status.");
    }
  };

  const makeAuth = async (userId: string, currentStatus: boolean) => {
    try {
      await db.transact([tx.users[userId].update({ isAuth: !currentStatus })]);
      toast.success(
        currentStatus ? "Authorization revoked." : "Authorization granted."
      );
    } catch (e) {
      console.error(e);
      toast.error("Failed to update authorization.");
    }
  };

  const deleteUser = async (userId: string, label: string) => {
    if (userId === currentAppUserId) {
      toast.error("You cannot delete your own account from here.");
      return;
    }
    const ok = window.confirm(
      `Delete user ${label}? This cannot be undone. Related punches may become orphaned.`
    );
    if (!ok) return;
    try {
      await db.transact([tx.users[userId].delete()]);
      toast.success("User deleted.");
      cancelEdit();
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete user.");
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 text-center text-gray-700 dark:text-gray-300">
        Loading users…
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-4 text-center text-red-600 dark:text-red-400">
        Error: {error.message}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl bg-gray-100 p-4 dark:bg-gray-900 sm:p-6">
      <Toaster position="top-right" />
      <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white sm:mb-6 sm:text-2xl">
        Users
      </h2>
      <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        Each person is a card so nothing is clipped on small screens.{" "}
        <strong>Kiosk barcode</strong> is what staff type or scan at check-in
        (sometimes called a badge ID or passcode).
      </p>

      <div className="mb-5 space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-5">
        <div>
          <label
            htmlFor="admin-users-search"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
          >
            Search
          </label>
          <input
            id="admin-users-search"
            type="search"
            autoComplete="off"
            placeholder="Name, email, or barcode…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500"
          />
          {searchInput !== debouncedSearch && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Typing…
            </p>
          )}
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="space-y-3">
            <div>
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Admin
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ["any", "All"],
                    ["yes", "Admins"],
                    ["no", "Not admin"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setAdminFilter(value)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${filterToggleClass(adminFilter === value)}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Kiosk authorized
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ["any", "All"],
                    ["yes", "Yes"],
                    ["no", "No"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setAuthFilter(value)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${filterToggleClass(authFilter === value)}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="sm:min-w-[12rem]">
            <label
              htmlFor="admin-users-sort"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
            >
              Sort A–Z
            </label>
            <select
              id="admin-users-sort"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            >
              <option value="email">Email</option>
              <option value="name">Name</option>
              <option value="barcode">Barcode</option>
            </select>
          </div>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-300">
          Showing{" "}
          <span className="font-semibold text-gray-900 dark:text-white">
            {displayUsers.length}
          </span>{" "}
          of {allUsers.length} user{allUsers.length === 1 ? "" : "s"}
        </p>
      </div>

      {displayUsers.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white/60 px-4 py-8 text-center text-sm text-gray-600 dark:border-gray-600 dark:bg-gray-800/60 dark:text-gray-400">
          No users match your search or filters.
        </p>
      ) : (
      <ul className="space-y-4">
        {displayUsers.map((user) => {
          const editing =
            editField?.userId === user.id ? editField.field : null;

          return (
            <li
              key={user.id}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-5"
            >
              <div className="flex flex-col gap-4">
                {/* Name */}
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Name
                  </div>
                  {editing === "name" ? (
                    <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        autoFocus
                      />
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                          onClick={() => handleNameSave(user.id)}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                          onClick={cancelEdit}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="text-base font-medium text-gray-900 dark:text-white">
                        {user.name || "—"}
                      </span>
                      <button
                        type="button"
                        className="rounded-md bg-indigo-50 px-2.5 py-1 text-sm font-medium text-indigo-800 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-200 dark:hover:bg-indigo-900/50"
                        onClick={() =>
                          beginEdit(user.id, "name", user.name ?? "")
                        }
                      >
                        Edit name
                      </button>
                    </div>
                  )}
                </div>

                {/* Email */}
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Email
                  </div>
                  {editing === "email" ? (
                    <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        type="email"
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        autoFocus
                      />
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                          onClick={() => handleEmailSave(user.id)}
                        >
                          Save email
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                          onClick={cancelEdit}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1 flex flex-wrap items-center gap-2 break-all">
                      <span className="text-sm text-gray-800 dark:text-gray-200">
                        {user.email}
                      </span>
                      <button
                        type="button"
                        className="rounded-md bg-violet-50 px-2.5 py-1 text-sm font-medium text-violet-900 hover:bg-violet-100 dark:bg-violet-950/40 dark:text-violet-200 dark:hover:bg-violet-900/40"
                        onClick={() =>
                          beginEdit(user.id, "email", user.email ?? "")
                        }
                      >
                        Change email
                      </button>
                    </div>
                  )}
                </div>

                {/* Kiosk barcode */}
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Kiosk barcode / badge ID
                  </div>
                  {editing === "barcode" ? (
                    <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        autoFocus
                        placeholder="Scanned or typed ID"
                      />
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                          onClick={() => handleBarcodeSave(user.id)}
                        >
                          Save barcode
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                          onClick={cancelEdit}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <code className="break-all rounded bg-gray-100 px-2 py-1 text-sm text-gray-900 dark:bg-gray-900 dark:text-gray-100">
                        {user.barcode || "—"}
                      </code>
                      <button
                        type="button"
                        className="rounded-md bg-amber-50 px-2.5 py-1 text-sm font-medium text-amber-900 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-900/40"
                        onClick={() =>
                          beginEdit(
                            user.id,
                            "barcode",
                            user.barcode ?? ""
                          )
                        }
                      >
                        Set barcode
                      </button>
                    </div>
                  )}
                </div>

                {/* Status */}
                <div className="flex flex-wrap gap-6">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Admin
                    </div>
                    <span
                      className={`mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        user.isAdmin
                          ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200"
                          : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
                      }`}
                    >
                      {user.isAdmin ? "Yes" : "No"}
                    </span>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Authorized
                    </div>
                    <span
                      className={`mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        user.isAuth
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200"
                          : "bg-gray-200 text-gray-800 dark:bg-gray-600/50 dark:text-gray-200"
                      }`}
                    >
                      {user.isAuth ? "Yes" : "No"}
                    </span>
                  </div>
                </div>

                {/* Actions — full-width grid, labels never truncated */}
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Quick actions
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-left text-sm font-medium text-gray-900 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-900/60 dark:text-white dark:hover:bg-gray-900"
                      onClick={() =>
                        toggleAdminStatus(user.id, Boolean(user.isAdmin))
                      }
                    >
                      {user.isAdmin ? "Remove admin role" : "Make admin"}
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-left text-sm font-medium text-gray-900 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-900/60 dark:text-white dark:hover:bg-gray-900"
                      onClick={() => makeAuth(user.id, Boolean(user.isAuth))}
                    >
                      {user.isAuth
                        ? "Revoke kiosk authorization"
                        : "Grant kiosk authorization"}
                    </button>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-3 dark:border-gray-700">
                  <button
                    type="button"
                    disabled={user.id === currentAppUserId}
                    className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm font-medium text-red-800 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200 dark:hover:bg-red-950/50"
                    onClick={() =>
                      deleteUser(
                        user.id,
                        user.name || user.email || user.id
                      )
                    }
                  >
                    {user.id === currentAppUserId
                      ? "Cannot delete your own account"
                      : "Delete user"}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      )}
    </div>
  );
}
