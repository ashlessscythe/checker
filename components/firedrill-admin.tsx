"use client";

import React, { useMemo, useState } from "react";
import { db } from "@/lib/instantdb";
import { id, tx } from "@instantdb/react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const FIRE_DRILL_CONFIG_KEY = "singleton";

type RecipientRow = {
  id: string;
  email?: string;
  name?: string;
  isActive?: boolean;
  createdAt?: number;
};

type SessionRow = {
  id: string;
  status?: string;
  startedAt?: number;
  completedAt?: number;
  startedByUserId?: string;
  completedByUserId?: string;
  notes?: string;
  presentSnapshotAtStart?: boolean;
};

export default function FireDrillAdmin() {
  const [newRecipientEmail, setNewRecipientEmail] = useState("");
  const [newRecipientName, setNewRecipientName] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [selectedRecipientEmails, setSelectedRecipientEmails] = useState<
    Set<string>
  >(new Set());
  const [customSubject, setCustomSubject] = useState("");
  const [isSending, setIsSending] = useState(false);

  const { data, isLoading, error } = db.useQuery({
    fireDrillConfig: {
      $: { where: { key: FIRE_DRILL_CONFIG_KEY } },
    },
    fireDrillNotificationRecipients: {
      $: {},
    },
    fireDrillSessions: {
      $: {
        order: { startedAt: "desc" },
      },
    },
    fireDrillSessionParticipants: {
      $: selectedSessionId
        ? { where: { sessionId: selectedSessionId } }
        : { where: { sessionId: "__none__" } },
    },
    fireDrillAccounts: {
      $: selectedSessionId
        ? { where: { sessionId: selectedSessionId } }
        : { where: { sessionId: "__none__" } },
    },
    fireDrillReportSends: {
      $: selectedSessionId
        ? { where: { sessionId: selectedSessionId } }
        : { where: { sessionId: "__none__" } },
    },
    users: {
      $: {},
      department: {},
    },
    departments: { $: {} },
  });

  const configRow = data?.fireDrillConfig?.[0] as
    | { id: string; key?: string; activeSessionId?: string; updatedAt?: number }
    | undefined;

  const recipients = (data?.fireDrillNotificationRecipients ??
    []) as RecipientRow[];
  const sessions = (data?.fireDrillSessions ?? []) as SessionRow[];
  const participants = (data?.fireDrillSessionParticipants ??
    []) as Array<{
    id: string;
    sessionId?: string;
    userId?: string;
    isPresentAtStart?: boolean;
    presentReason?: string;
  }>;
  const accounts = (data?.fireDrillAccounts ?? []) as Array<{
    id: string;
    sessionId?: string;
    userId?: string;
    status?: string;
    timestamp?: number;
    accountedByName?: string;
    accountedByUserId?: string;
  }>;

  const reportSends = (data?.fireDrillReportSends ?? []) as Array<{
    id: string;
    sessionId?: string;
    sentAt?: number;
    sentByUserId?: string;
    recipientEmails?: string[];
    subject?: string;
  }>;

  const userById = useMemo(() => {
    const map = new Map<string, any>();
    for (const u of data?.users ?? []) map.set(u.id, u);
    return map;
  }, [data?.users]);

  const selectedSession = useMemo(() => {
    return sessions.find((s) => s.id === selectedSessionId);
  }, [sessions, selectedSessionId]);

  const activeRecipientEmails = useMemo(() => {
    return recipients
      .filter((r) => r.isActive && r.email)
      .map((r) => r.email as string)
      .sort((a, b) => a.localeCompare(b));
  }, [recipients]);

  const computed = useMemo(() => {
    const presentUserIds = new Set(
      participants.filter((p) => p.isPresentAtStart).map((p) => p.userId || "")
    );

    const accountedByUserId = new Map<string, typeof accounts[number]>();
    for (const a of accounts) {
      if (!a.userId) continue;
      if (a.status !== "accounted") continue;
      accountedByUserId.set(a.userId, a);
    }

    const present = Array.from(presentUserIds).filter(Boolean);
    const accounted = present.filter((uid) => accountedByUserId.has(uid));
    const unaccounted = present.filter((uid) => !accountedByUserId.has(uid));

    const roster = present
      .map((uid) => {
        const u = userById.get(uid);
        const a = accountedByUserId.get(uid);
        return {
          userId: uid,
          name: u?.name ?? "Unknown",
          email: u?.email ?? "",
          department: u?.department?.name ?? "",
          status: a ? "Accounted" : "Unaccounted",
          accountedBy: a?.accountedByName ?? "",
          accountedAt: a?.timestamp ? new Date(a.timestamp).toLocaleString() : "",
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      presentCount: present.length,
      accountedCount: accounted.length,
      unaccountedCount: unaccounted.length,
      roster,
    };
  }, [participants, accounts, userById]);

  const ensureDefaultRecipientsSelected = () => {
    if (selectedRecipientEmails.size > 0) return;
    setSelectedRecipientEmails(new Set(activeRecipientEmails));
  };

  const toggleRecipientSelection = (email: string) => {
    setSelectedRecipientEmails((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  const addRecipient = async () => {
    const email = newRecipientEmail.trim().toLowerCase();
    const name = newRecipientName.trim();
    if (!email) return;
    try {
      await db.transact([
        tx.fireDrillNotificationRecipients[id()].update({
          email,
          name: name || "",
          isActive: true,
          createdAt: Date.now(),
        }),
      ]);
      setNewRecipientEmail("");
      setNewRecipientName("");
      toast.success("Recipient added.");
    } catch (e: any) {
      toast.error(e?.message || "Failed to add recipient.");
    }
  };

  const sendReport = async () => {
    if (!selectedSessionId) {
      toast.error("Select a drill session first.");
      return;
    }
    const to = Array.from(selectedRecipientEmails).filter(Boolean);
    if (to.length === 0) {
      toast.error("Select at least one recipient.");
      return;
    }

    try {
      setIsSending(true);
      const res = await fetch("/api/admin/fire-drill/send-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: selectedSessionId,
          to,
          subject: customSubject || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || `Failed (status ${res.status})`);
      }
      toast.success("Report sent.");
    } catch (e: any) {
      toast.error(e?.message || "Failed to send report.");
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) return <div className="text-sm text-gray-600">Loading…</div>;
  if (error)
    return (
      <div className="text-sm text-red-600">Error: {error.message}</div>
    );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          FireDrill
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          Active session:{" "}
          <span className="font-mono">
            {configRow?.activeSessionId || "(none)"}
          </span>
        </p>
      </div>

      <section className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-800 sm:p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Notification emails
        </h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          Recipients used by “Send report”. Only active recipients are selected
          by default.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input
            type="email"
            placeholder="email@company.com"
            value={newRecipientEmail}
            onChange={(e) => setNewRecipientEmail(e.target.value)}
          />
          <Input
            type="text"
            placeholder="Name (optional)"
            value={newRecipientName}
            onChange={(e) => setNewRecipientName(e.target.value)}
          />
          <Button
            type="button"
            onClick={addRecipient}
            disabled={!newRecipientEmail.trim()}
          >
            Add recipient
          </Button>
        </div>

        <div className="mt-4 space-y-3 md:hidden">
          {recipients
            .slice()
            .sort((a, b) => (a.email || "").localeCompare(b.email || ""))
            .map((r) => (
              <div
                key={r.id}
                className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800/80"
              >
                <div className="flex items-start justify-between gap-2">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-800 dark:text-gray-100">
                    <input
                      type="checkbox"
                      checked={!!r.isActive}
                      onChange={async () => {
                        await db.transact([
                          tx.fireDrillNotificationRecipients[r.id].update({
                            isActive: !r.isActive,
                          }),
                        ]);
                      }}
                    />
                    <span>Active</span>
                  </label>
                  <button
                    type="button"
                    className="shrink-0 text-sm font-medium text-red-600 hover:text-red-700"
                    onClick={async () => {
                      await db.transact([
                        tx.fireDrillNotificationRecipients[r.id].delete(),
                      ]);
                    }}
                  >
                    Delete
                  </button>
                </div>
                <div className="mt-2 space-y-1.5">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Email
                    </div>
                    <div className="break-all text-sm text-gray-900 dark:text-gray-100">
                      {r.email}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Name
                    </div>
                    <div className="text-sm text-gray-700 dark:text-gray-200">
                      {r.name || "—"}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          {recipients.length === 0 && (
            <p className="rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
              No recipients configured.
            </p>
          )}
        </div>

        <div className="mt-4 hidden overflow-x-auto md:block">
          <table className="w-full min-w-[640px] divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/40">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                  Active
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                  Email
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                  Name
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              {recipients
                .slice()
                .sort((a, b) => (a.email || "").localeCompare(b.email || ""))
                .map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={!!r.isActive}
                        onChange={async () => {
                          await db.transact([
                            tx.fireDrillNotificationRecipients[r.id].update({
                              isActive: !r.isActive,
                            }),
                          ]);
                        }}
                      />
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-800 dark:text-gray-100">
                      {r.email}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300">
                      {r.name || ""}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="text-sm font-medium text-red-600 hover:text-red-700"
                        onClick={async () => {
                          await db.transact([
                            tx.fireDrillNotificationRecipients[r.id].delete(),
                          ]);
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              {recipients.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400"
                  >
                    No recipients configured.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-800 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Conducted drills
            </h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Select a session to view roster and send a report.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3 md:hidden">
          {sessions.map((s) => {
            const selected = selectedSessionId === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setSelectedSessionId(s.id);
                  ensureDefaultRecipientsSelected();
                }}
                className={`w-full rounded-lg border p-3 text-left shadow-sm transition-colors dark:border-gray-700 ${
                  selected
                    ? "border-blue-400 bg-blue-50 ring-1 ring-blue-200 dark:border-blue-500 dark:bg-blue-900/30 dark:ring-blue-800"
                    : "border-gray-200 bg-white dark:bg-gray-800/80"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Drill session
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      s.status === "active"
                        ? "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100"
                        : s.status === "completed"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200"
                          : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200"
                    }`}
                  >
                    {s.status || "—"}
                  </span>
                </div>
                <div className="mt-2 space-y-1.5 text-sm text-gray-800 dark:text-gray-100">
                  <div>
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Started{" "}
                    </span>
                    <span className="block sm:inline">
                      {s.startedAt
                        ? new Date(s.startedAt).toLocaleString()
                        : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Completed{" "}
                    </span>
                    <span className="block break-words sm:inline">
                      {s.completedAt
                        ? new Date(s.completedAt).toLocaleString()
                        : "—"}
                    </span>
                  </div>
                  <div className="pt-1">
                    <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Session ID
                    </div>
                    <div className="break-all font-mono text-xs text-gray-600 dark:text-gray-300">
                      {s.id}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
          {sessions.length === 0 && (
            <p className="rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
              No drill sessions yet.
            </p>
          )}
        </div>

        <div className="mt-4 hidden overflow-x-auto md:block">
          <table className="w-full min-w-[720px] divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/40">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                  Started
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                  Status
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                  Completed
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                  Session ID
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              {sessions.map((s) => (
                <tr
                  key={s.id}
                  className={`cursor-pointer ${
                    selectedSessionId === s.id
                      ? "bg-blue-50 dark:bg-blue-900/30"
                      : ""
                  }`}
                  onClick={() => {
                    setSelectedSessionId(s.id);
                    ensureDefaultRecipientsSelected();
                  }}
                >
                  <td className="px-3 py-2 text-sm text-gray-800 dark:text-gray-100">
                    {s.startedAt ? new Date(s.startedAt).toLocaleString() : ""}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300">
                    {s.status || ""}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300">
                    {s.completedAt
                      ? new Date(s.completedAt).toLocaleString()
                      : ""}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-gray-300">
                    {s.id}
                  </td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400"
                  >
                    No drill sessions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {selectedSession && (
          <div className="mt-6 space-y-6">
            <div className="rounded-md bg-gray-50 p-4 dark:bg-gray-900/40">
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Session summary
                  </h4>
                  <dl className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
                    <div className="rounded-lg border border-gray-200 bg-white px-3 py-3 text-center dark:border-gray-600 dark:bg-gray-800/90">
                      <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Present
                      </dt>
                      <dd className="mt-1 text-2xl font-bold tabular-nums text-gray-900 dark:text-white">
                        {computed.presentCount}
                      </dd>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-white px-3 py-3 text-center dark:border-gray-600 dark:bg-gray-800/90">
                      <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Accounted
                      </dt>
                      <dd className="mt-1 text-2xl font-bold tabular-nums text-green-700 dark:text-green-400">
                        {computed.accountedCount}
                      </dd>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-white px-3 py-3 text-center dark:border-gray-600 dark:bg-gray-800/90">
                      <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Unaccounted
                      </dt>
                      <dd className="mt-1 text-2xl font-bold tabular-nums text-red-700 dark:text-red-400">
                        {computed.unaccountedCount}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-600 dark:bg-gray-800/70">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Send report
                  </h4>
                  <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                    Uses the recipients you select in the next section.
                  </p>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <label
                        htmlFor="fire-drill-report-subject"
                        className="text-xs font-medium text-gray-600 dark:text-gray-300"
                      >
                        Email subject{" "}
                        <span className="font-normal text-gray-400 dark:text-gray-500">
                          (optional)
                        </span>
                      </label>
                      <Input
                        id="fire-drill-report-subject"
                        placeholder="e.g. Fire drill report — April 15"
                        value={customSubject}
                        onChange={(e) => setCustomSubject(e.target.value)}
                        className="w-full"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="default"
                      className="h-10 w-full shrink-0 sm:w-auto sm:min-w-[10.5rem]"
                      onClick={sendReport}
                      disabled={isSending}
                    >
                      {isSending ? "Sending…" : "Send report"}
                    </Button>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Recipients
                  </h4>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Checked addresses are included when you send.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 sm:gap-3">
                    {recipients
                      .filter((r) => r.email)
                      .sort((a, b) =>
                        (a.email || "").localeCompare(b.email || "")
                      )
                      .map((r) => {
                        const email = (r.email || "").toLowerCase();
                        const checked = selectedRecipientEmails.has(email);
                        return (
                          <label
                            key={r.id}
                            className="flex min-w-0 max-w-full cursor-pointer flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                          >
                            <input
                              type="checkbox"
                              className="shrink-0"
                              checked={checked}
                              onChange={() => toggleRecipientSelection(email)}
                            />
                            <span className="min-w-0 flex-1 break-all">
                              {email}
                            </span>
                            {r.isActive ? (
                              <span className="shrink-0 rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700 dark:bg-green-900/40 dark:text-green-200">
                                active
                              </span>
                            ) : (
                              <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-gray-900/40 dark:text-gray-300">
                                inactive
                              </span>
                            )}
                          </label>
                        );
                      })}
                    {recipients.length === 0 && (
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        Add recipients above.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="max-h-[min(70vh,32rem)] space-y-3 overflow-y-auto p-3 md:hidden">
                {computed.roster.map((r) => (
                  <div
                    key={r.userId}
                    className="rounded-lg border border-gray-100 bg-white p-3 shadow-sm dark:border-gray-600 dark:bg-gray-800/90"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {r.name}
                        </div>
                        {r.department ? (
                          <div className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">
                            {r.department}
                          </div>
                        ) : null}
                      </div>
                      <span
                        className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${
                          r.status === "Accounted"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200"
                            : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>
                    {r.email ? (
                      <div className="mt-2 break-all text-sm text-gray-600 dark:text-gray-300">
                        {r.email}
                      </div>
                    ) : null}
                    <div className="mt-3 grid gap-2 border-t border-gray-100 pt-3 text-sm dark:border-gray-600">
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          Accounted by
                        </div>
                        <div className="text-gray-800 dark:text-gray-100">
                          {r.accountedBy || "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          Accounted at
                        </div>
                        <div className="break-words text-gray-700 dark:text-gray-200">
                          {r.accountedAt || "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {computed.roster.length === 0 && (
                  <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    No participant snapshot for this session yet.
                  </p>
                )}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[880px] divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900/40">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                        Name
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                        Department
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                        Email
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                        Status
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                        Accounted by
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                        Accounted at
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                    {computed.roster.map((r) => (
                      <tr key={r.userId}>
                        <td className="px-3 py-2 text-sm text-gray-800 dark:text-gray-100">
                          {r.name}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300">
                          {r.department}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300">
                          {r.email}
                        </td>
                        <td className="px-3 py-2 text-sm">
                          <span
                            className={`rounded px-2 py-0.5 text-xs font-semibold ${
                              r.status === "Accounted"
                                ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200"
                                : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300">
                          {r.accountedBy}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300">
                          {r.accountedAt}
                        </td>
                      </tr>
                    ))}
                    {computed.roster.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400"
                        >
                          No participant snapshot for this session yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-800 sm:p-6">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Report sends (audit)
              </h4>
              <div className="mt-3 space-y-3 md:hidden">
                {reportSends
                  .slice()
                  .sort((a, b) => (b.sentAt || 0) - (a.sentAt || 0))
                  .map((s) => (
                    <div
                      key={s.id}
                      className="rounded-lg border border-gray-200 bg-white p-3 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-800/80"
                    >
                      <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Sent at
                      </div>
                      <div className="mt-0.5 text-gray-900 dark:text-gray-100">
                        {s.sentAt
                          ? new Date(s.sentAt).toLocaleString()
                          : "—"}
                      </div>
                      <div className="mt-3 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Subject
                      </div>
                      <div className="mt-0.5 break-words text-gray-700 dark:text-gray-200">
                        {s.subject || "—"}
                      </div>
                      <div className="mt-3 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Recipients
                      </div>
                      <div className="mt-0.5 break-words text-gray-600 dark:text-gray-300">
                        {(s.recipientEmails as string[] | undefined)?.join?.(
                          ", "
                        ) || "—"}
                      </div>
                    </div>
                  ))}
                {reportSends.length === 0 && (
                  <p className="rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
                    No sends recorded for this session.
                  </p>
                )}
              </div>

              <div className="mt-3 hidden overflow-x-auto md:block">
                <table className="w-full min-w-[640px] divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900/40">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                        Sent at
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                        Subject
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                        Recipients
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                    {reportSends
                      .slice()
                      .sort((a, b) => (b.sentAt || 0) - (a.sentAt || 0))
                      .map((s) => (
                        <tr key={s.id}>
                          <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-200">
                            {s.sentAt
                              ? new Date(s.sentAt).toLocaleString()
                              : ""}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300">
                            {s.subject || ""}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300">
                            {(s.recipientEmails as any)?.join?.(", ") || ""}
                          </td>
                        </tr>
                      ))}
                    {reportSends.length === 0 && (
                      <tr>
                        <td
                          colSpan={3}
                          className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400"
                        >
                          No sends recorded for this session.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

