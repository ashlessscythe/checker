// components/checklist.tsx
"use client";

import React, { useMemo, useEffect, useState, useCallback, useRef } from "react";
import { id, tx } from "@instantdb/react";
import { db } from "@/lib/instantdb";
import { useAuth } from "@/hooks/authContext";
import toast from "react-hot-toast";
import {
  CheckActionType,
  checkInTypes,
  checkOutTypes,
} from "@/utils/checkInOut";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

const FIRE_DRILL_CONFIG_KEY = "singleton";

/** Relative time for "last drill" banner; null if older than 1 hour. */
function formatLastDrillRelative(completedAt: number, nowMs: number): string | null {
  if (!completedAt || completedAt <= 0) return null;
  const diffMs = nowMs - completedAt;
  if (diffMs < 0 || diffMs > 60 * 60 * 1000) return null;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  return `${mins} min ago`;
}

interface User {
  id: string;
  name: string;
  email: string;
  barcode: string;
  isAdmin: boolean;
  isAuth: boolean;
  lastLoginAt: number;
  createdAt: number;
  deptId: string;
  serverCreatedAt: number;
  laptopSerial: string;
  purpose: string;
}

interface Punch {
  id: string;
  type: string;
  timestamp: number;
  userId: string;
  serverCreatedAt: number;
  isAdminGenerated: boolean;
  isSystemGenerated: boolean;
}

interface UserWithStatus extends User {
  timeAgoString: string;
  hoursAgo: number;
  isOld?: boolean;
}

interface FireDrillBasicRowProps {
  user: UserWithStatus;
  isChecked: boolean;
  accountedBy: string | undefined;
  onCheck: (userId: string) => Promise<void>;
  isPending: boolean;
  thresholdHours: number;
}

/** Module scope: avoids remounting every row on parent re-render (keeps scroll position). */
const FireDrillBasicRow = React.memo(function FireDrillBasicRow({
  user,
  isChecked,
  accountedBy,
  onCheck,
  isPending,
  thresholdHours,
}: FireDrillBasicRowProps) {
  const isOld = user.hoursAgo >= thresholdHours;

  return (
    <tr
      className={`
      ${isChecked ? "bg-green-100 dark:bg-green-700" : ""}
      ${isOld ? "opacity-50" : ""}
      ${isPending ? "opacity-60 pointer-events-none" : ""}
    `}
    >
      <td className="min-w-0 px-2 py-3 align-top sm:px-6 sm:py-4">
        <div className="break-words text-sm font-medirm text-gray-900 dark:text-white">
          {user.name}
        </div>
      </td>
      <td className="min-w-0 px-2 py-3 align-top sm:px-6 sm:py-4">
        <button
          type="button"
          onClick={() => onCheck(user.id)}
          className={`max-w-full whitespace-normal rounded-full px-2 py-1 text-left text-xs font-semibold sm:px-3 sm:text-sm ${
            isChecked
              ? "bg-green-200 text-green-800 dark:bg-green-600 dark:text-green-100"
              : "bg-red-200 text-red-800 dark:bg-red-600 dark:text-red-100"
          }`}
          disabled={isPending}
        >
          {isPending
            ? "Syncing..."
            : isChecked
              ? `Accounted by ${accountedBy}`
              : "Unaccounted"}
        </button>
      </td>
      <td className="min-w-0 px-2 py-3 align-top sm:px-6 sm:py-4">
        <div className="break-words text-xs text-gray-500 dark:text-gray-300 sm:text-sm">
          {isOld ? `${user.timeAgoString} (old)` : user.timeAgoString}
        </div>
      </td>
    </tr>
  );
});

export default React.memo(function CheckList() {
  const [isClient, setIsClient] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [dateTime, setDateTime] = useState(new Date().toLocaleString());
  const [filters, setFilters] = useState({
    name: "",
    status: "all",
    deptId: "all",
  });
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);
  const IS_OLD_HOURS = parseInt(
    process.env.NEXT_PUBLIC_THRESHOLD_HOURS || "14",
    10
  );
  const { user } = useAuth();
  const authUser = user;
  const [pendingUserIds, setPendingUserIds] = useState<Set<string>>(new Set());
  const pendingUserIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  /** Stable query: avoids re-subscribing every render (new object refs can thrash Instant). */
  const coreQuery = useMemo(
    () => ({
      users: { $: {} },
      punches: { $: { order: { serverCreatedAt: "desc" as const } } },
      fireDrillConfig: {
        $: { where: { key: FIRE_DRILL_CONFIG_KEY } },
      },
      departments: { $: {} },
    }),
    []
  );

  const {
    data: coreData,
    isLoading: coreIsLoading,
    error: coreError,
  } = db.useQuery(coreQuery);

  const activeSessionId =
    coreData?.fireDrillConfig?.[0]?.activeSessionId ?? "";

  const drillQuery = useMemo(() => {
    const none = "__none__";
    const sid = activeSessionId;
    if (sid) {
      return {
        fireDrillSessions: { $: { where: { id: sid } } },
        fireDrillSessionParticipants: { $: { where: { sessionId: sid } } },
        fireDrillAccounts: { $: { where: { sessionId: sid } } },
      };
    }
    return {
      fireDrillSessions: {
        $: {
          where: { status: "completed" },
          order: { completedAt: "desc" as const },
          limit: 1,
        },
      },
      fireDrillSessionParticipants: { $: { where: { sessionId: none } } },
      fireDrillAccounts: { $: { where: { sessionId: none } } },
    };
  }, [activeSessionId]);

  const {
    data: drillData,
    isLoading: drillIsLoading,
    error: drillError,
  } = db.useQuery(drillQuery);

  const data = useMemo(() => {
    if (coreData == null && drillData == null) return undefined;
    return { ...(coreData || {}), ...(drillData || {}) } as typeof coreData &
      typeof drillData;
  }, [coreData, drillData]);

  const drillNeeded = Boolean(activeSessionId);
  const isLoading = coreIsLoading || (drillNeeded && drillIsLoading);
  const error = coreError || drillError;

  /** Shown on idle screen only if last completion was within the past hour (`dateTime` ticks every second). */
  const lastIdleDrillLine = useMemo(() => {
    if (activeSessionId) return null;
    const row = data?.fireDrillSessions?.[0] as
      | {
          status?: string;
          completedAt?: number;
          completedByUserId?: string;
        }
      | undefined;
    if (!row || row.status !== "completed") return null;
    const at = row.completedAt;
    if (typeof at !== "number" || at <= 0) return null;
    const rel = formatLastDrillRelative(at, Date.now());
    if (!rel) return null;
    const uid = row.completedByUserId?.trim();
    const users = data?.users ?? [];
    const u = uid ? users.find((x: User) => x.id === uid) : undefined;
    const by =
      (u?.name && String(u.name).trim()) ||
      u?.email ||
      uid ||
      "Unknown";
    return `Last drill was completed by ${by}, ${rel}.`;
  }, [activeSessionId, data?.fireDrillSessions, data?.users, dateTime]);

  const checkedUsers = useMemo(() => {
    const accounts = data?.fireDrillAccounts;
    if (!accounts?.length) {
      return new Map<string, { status: boolean; accountedBy: string }>();
    }
    return new Map(
      accounts
        .filter((a) => a.status === "accounted")
        .map((a) => [
          a.userId,
          { status: true, accountedBy: a.accountedByName || "Unknown User" },
        ])
    );
  }, [data?.fireDrillAccounts]);

  const handleCheckUser = useCallback(
    async (userId: string) => {
      if (!activeSessionId) return;
      // Use ref to track pending operations to avoid stale closures
      if (pendingUserIdsRef.current.has(userId)) return; // Prevent double click
      
      // Add to both ref and state
      pendingUserIdsRef.current.add(userId);
      setPendingUserIds(prev => new Set(prev).add(userId));
      
      const user = authUser;
      const accountedByName = user?.name || user?.email || "Unknown User";
      const accountedByUserId = user?.id || "";
      
      const existingAccount = data?.fireDrillAccounts?.find(
        (a) => a.sessionId === activeSessionId && a.userId === userId
      );
      const isCurrentlyChecked = existingAccount?.status === "accounted";

      try {
        if (isCurrentlyChecked && existingAccount) {
          const canUnaccount =
            user?.isAdmin || existingAccount.accountedByUserId === accountedByUserId;

          if (!canUnaccount) {
            toast.error("CANNOT UNACCOUNT OTHERS 🛑", {
              duration: 3000,
              style: {
                borderRadius: "10px",
                background: "#333",
                color: "#fff",
              },
            });
            return;
          }

          await db.transact([
            tx.fireDrillAccounts[existingAccount.id].update({
              status: "unaccounted",
              timestamp: Date.now(),
              accountedByName,
              accountedByUserId,
            }),
          ]);
        } else {
          const rowId = existingAccount?.id || id();
          await db.transact([
            tx.fireDrillAccounts[rowId].update({
              sessionId: activeSessionId,
              userId,
              status: "accounted",
              timestamp: Date.now(),
              accountedByName,
              accountedByUserId,
            }),
          ]);
        }
        
        // Don't manually update checkedUsers - let the database query update it
        // This prevents ghost toggles by ensuring consistency with the database
      } catch (error) {
        console.error("Error saving fire drill check:", error);
      } finally {
        // Remove from both ref and state
        pendingUserIdsRef.current.delete(userId);
        setPendingUserIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(userId);
          return newSet;
        });
      }
    },
    [authUser, activeSessionId, data] // Removed checkedUsers from dependencies
  );

  const ensureConfigRow = useCallback(async (): Promise<string> => {
    const existingId = data?.fireDrillConfig?.[0]?.id;
    if (existingId) return existingId;
    const newId = id();
    await db.transact([
      tx.fireDrillConfig[newId].update({
        key: FIRE_DRILL_CONFIG_KEY,
        activeSessionId: "",
        updatedAt: Date.now(),
      }),
    ]);
    return newId;
  }, [data?.fireDrillConfig]);

  const [showStartDrillConfirm, setShowStartDrillConfirm] = useState(false);

  const performStartDrill = useCallback(async () => {
    if (!authUser?.isAdmin && !authUser?.isAuth) return;
    if (!data?.users || !data?.punches) return;
    if (activeSessionId) return;

    // Snapshot: who is currently checked-in and not "old"
    const presentUsers = data.users
      .filter((u) => isUserCheckedIn(u))
      .filter((u) => {
        const lastPunch = data.punches.find((p) => p.userId === u.id);
        const checkInTime = lastPunch ? new Date(lastPunch.timestamp).getTime() : 0;
        const hoursAgo = (currentTime - checkInTime) / (1000 * 60 * 60);
        return hoursAgo < IS_OLD_HOURS;
      });

    const newSessionId = id();
    const configId = await ensureConfigRow();
    const mutations: any[] = [
      tx.fireDrillSessions[newSessionId].update({
        status: "active",
        startedAt: Date.now(),
        completedAt: 0,
        startedByUserId: authUser?.id || "",
        completedByUserId: "",
        notes: "",
        presentSnapshotAtStart: true,
      }),
      tx.fireDrillConfig[configId].update({
        activeSessionId: newSessionId,
        updatedAt: Date.now(),
      }),
    ];

    for (const u of presentUsers) {
      mutations.push(
        tx.fireDrillSessionParticipants[id()].update({
          sessionId: newSessionId,
          userId: u.id,
          isPresentAtStart: true,
          presentReason: "checked_in",
        })
      );
    }

    try {
      await db.transact(mutations);
      toast.success("Fire drill started.");
    } catch (error) {
      console.error("Error starting fire drill:", error);
      toast.error("Error starting fire drill. Please try again.");
    }
  }, [
    authUser,
    data,
    activeSessionId,
    currentTime,
    IS_OLD_HOURS,
    ensureConfigRow,
  ]);

  const handleCompleteDrill = useCallback(async () => {
    if (!authUser?.isAdmin) return;
    if (!activeSessionId) return;

    try {
      const configId = await ensureConfigRow();
      await db.transact([
        tx.fireDrillSessions[activeSessionId].update({
          status: "completed",
          completedAt: Date.now(),
          completedByUserId: authUser?.id || "",
        }),
        tx.fireDrillConfig[configId].update({
          activeSessionId: "",
          updatedAt: Date.now(),
        }),
      ]);
      toast.success("Fire drill completed.");
    } catch (error) {
      console.error("Error completing fire drill:", error);
      toast.error("Error completing fire drill. Please try again.");
    }
  }, [authUser, activeSessionId, ensureConfigRow]);

  function isUserCheckedIn(user: User): boolean {
    if (!data?.punches) return false;
    const lastPunch = data.punches.find(punch => punch.userId === user.id);
    return lastPunch ? checkInTypes.has(lastPunch.type as CheckActionType) : false;
  }

  const checkedInUsersWithHours = useMemo(() => {
    if (!data?.users || !data?.punches) return [];

    return data.users.filter(isUserCheckedIn).map((user) => {
      const lastPunch = data.punches.find(punch => punch.userId === user.id);
      const checkInTime = lastPunch ? new Date(lastPunch.timestamp).getTime() : 0;
      const diffInHours = (currentTime - checkInTime) / (1000 * 60 * 60);
      const name = user.name;

      let timeAgoString: string;
      if (diffInHours < 1 / 60) {
        timeAgoString = "Just now";
      } else if (diffInHours < 1) {
        const minutes = Math.floor(diffInHours * 60);
        timeAgoString = `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
      } else if (diffInHours < 24) {
        const hours = Math.floor(diffInHours);
        timeAgoString = `${hours} hour${hours !== 1 ? "s" : ""} ago`;
      } else {
        const days = Math.floor(diffInHours / 24);
        timeAgoString = `${days} day${days !== 1 ? "s" : ""} ago`;
      }

      return {
        ...user,
        timeAgoString,
        name,
        hoursAgo: diffInHours,
        deptId: user.deptId,
      };
    });
  }, [data?.users, data?.punches, currentTime]);

  const filteredAndSortedUsers = useMemo(() => {
    // First filter out old users
    let result = checkedInUsersWithHours.filter((user) => {
      return user.hoursAgo < IS_OLD_HOURS;
    });

    // Apply filters
    if (filters.name) {
      result = result.filter((user: UserWithStatus) =>
        user.name.toLowerCase().includes(filters.name.toLowerCase())
      );
    }
    if (filters.status !== "all") {
      result = result.filter(
        (user) =>
          (filters.status === "checked" && checkedUsers.has(user.id)) ||
          (filters.status === "unchecked" && !checkedUsers.has(user.id))
      );
    }
    if (filters.deptId !== "all") {
      result = result.filter((user) => user.deptId === filters.deptId);
    }

    // Apply sorting
    if (sortConfig !== null) {
      result.sort((a, b) => {
        if (sortConfig.key === "hoursAgo") {
          // Sort by hoursAgo (checked in time)
          return sortConfig.direction === "asc"
            ? a.hoursAgo - b.hoursAgo
            : b.hoursAgo - a.hoursAgo;
        } else {
          if (a[sortConfig.key] < b[sortConfig.key]) {
            return sortConfig.direction === "asc" ? -1 : 1;
          }
          if (a[sortConfig.key] > b[sortConfig.key]) {
            return sortConfig.direction === "asc" ? 1 : -1;
          }
          return 0;
        }
      });
    }

    return result;
  }, [checkedInUsersWithHours, filters, sortConfig, checkedUsers, IS_OLD_HOURS]);

  const requestSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === "asc"
    ) {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setDateTime(new Date().toLocaleString());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  if (isLoading) return <div className="text-gray-700 dark:text-gray-300">Loading...</div>;
  if (error) return <div className="text-red-600 dark:text-red-400">Error: {error.message}</div>;

  if (!activeSessionId) {
    return (
      <>
        {showStartDrillConfirm && authUser?.isAuth && !authUser?.isAdmin && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="start-drill-title"
            aria-describedby="start-drill-desc"
          >
            <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg dark:bg-gray-800 dark:ring-1 dark:ring-white/10">
              <h2
                id="start-drill-title"
                className="text-lg font-semibold text-gray-900 dark:text-white"
              >
                Start a fire drill?
              </h2>
              <p
                id="start-drill-desc"
                className="mt-3 text-sm text-gray-600 dark:text-gray-300"
              >
                Normally an <strong>administrator</strong> starts a fire drill.
                Starting one here creates an <strong>active drill session</strong>{" "}
                for this kiosk and any other devices connected to the system, until
                an admin completes it.
              </p>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                Only continue if you are supposed to run this drill right now.
              </p>
              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowStartDrillConfirm(false)}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setShowStartDrillConfirm(false);
                    await performStartDrill();
                  }}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Yes, start fire drill
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="w-full min-w-0 max-w-full space-y-4">
          <h1 className="text-xl sm:text-2xl font-bold mb-2 break-words text-gray-900 dark:text-white">
            Fire Drill
          </h1>
          <div className="rounded-lg bg-yellow-50 p-4 text-sm text-yellow-900 shadow-sm dark:bg-yellow-900/30 dark:text-yellow-100">
            <p className="font-medium">No active drill session.</p>
            {lastIdleDrillLine ? (
              <p className="mt-2 text-xs leading-relaxed opacity-90 dark:text-yellow-100">
                {lastIdleDrillLine}
              </p>
            ) : null}
            <p className="mt-2">Start a drill to begin accounting.</p>
          </div>
          {authUser?.isAdmin ? (
            <button
              type="button"
              onClick={() => void performStartDrill()}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full sm:w-auto"
            >
              Start Drill
            </button>
          ) : authUser?.isAuth ? (
            <button
              type="button"
              onClick={() => setShowStartDrillConfirm(true)}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full sm:w-auto"
            >
              Start Drill
            </button>
          ) : (
            <div className="text-sm text-gray-600 dark:text-gray-300">
              Ask an admin to start a drill.
            </div>
          )}
        </div>
      </>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-full">
      <h1 className="text-xl sm:text-2xl font-bold mb-4 break-words text-gray-900 dark:text-white">
        Fire Drill Checklist - {dateTime}
      </h1>
      <div className="mb-4 flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <input
          type="text"
          placeholder="Filter by name"
          value={filters.name}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, name: e.target.value }))
          }
          className="min-w-0 w-full px-2 py-1 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600 sm:max-w-xs"
        />
        <select
          value={filters.status}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, status: e.target.value }))
          }
          className="w-full px-2 py-1 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600 sm:w-auto sm:min-w-[8rem]"
        >
          <option value="all">All</option>
          <option value="checked">Checked</option>
          <option value="unchecked">Unchecked</option>
        </select>
        <Select
          value={filters.deptId}
          onValueChange={(value) =>
            setFilters((prev) => ({ ...prev, deptId: value }))
          }
        >
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filter by department" />
          </SelectTrigger>
          <SelectContent className="bg-white dark:bg-gray-800">
            <SelectItem value="all">All Departments</SelectItem>
            {data?.departments?.map((dept) => (
              <SelectItem key={dept.id} value={dept.id}>
                {dept.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="w-full min-w-0 overflow-hidden rounded-lg bg-white shadow-md dark:bg-gray-800">
        <div className="max-h-[600px] overflow-y-auto overflow-x-hidden rounded-b-lg bg-gray-50/80 shadow-[inset_0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_2px_rgba(0,0,0,0.06)] ring-1 ring-inset ring-black/5 dark:bg-gray-950/40 dark:shadow-[inset_0_2px_12px_rgba(0,0,0,0.45),inset_0_1px_3px_rgba(0,0,0,0.35)] dark:ring-white/10">
          <table className="w-full table-fixed divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
              <tr>
                <th
                  className="w-[34%] px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300 sm:w-[32%] sm:px-6 sm:py-3 cursor-pointer"
                  onClick={() => requestSort("name")}
                >
                  Name{" "}
                  {sortConfig?.key === "name" &&
                    (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
                <th className="w-[38%] px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300 sm:w-[36%] sm:px-6 sm:py-3">
                  Status
                </th>
                <th
                  className="w-[28%] px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300 sm:w-[32%] sm:px-6 sm:py-3 cursor-pointer"
                  onClick={() => requestSort("hoursAgo")} // Sorting by checked-in time
                >
                  Checked In{" "}
                  {sortConfig?.key === "hoursAgo" &&
                    (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredAndSortedUsers.map((user) => (
                <FireDrillBasicRow
                  key={user.id}
                  user={user}
                  isChecked={checkedUsers.has(user.id)}
                  accountedBy={checkedUsers.get(user.id)?.accountedBy}
                  onCheck={handleCheckUser}
                  isPending={pendingUserIds.has(user.id)}
                  thresholdHours={IS_OLD_HOURS}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="mt-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="min-w-0 break-words text-sm font-bold sm:mb-0 sm:text-base">
          Accounted: {checkedUsers.size} / {filteredAndSortedUsers.length}
          <span className="text-gray-500 dark:text-gray-400 ml-2">
            {" - "}
            {(() => {
              // First filter by age
              const nonOldUsers = checkedInUsersWithHours.filter(
                (user) => user.hoursAgo < IS_OLD_HOURS
              );

              // Then apply other filters to get count of hidden by filters
              let filteredUsers = nonOldUsers;
              if (filters.name) {
                filteredUsers = filteredUsers.filter((user: UserWithStatus) =>
                  user.name.toLowerCase().includes(filters.name.toLowerCase())
                );
              }
              if (filters.status !== "all") {
                filteredUsers = filteredUsers.filter(
                  (user) =>
                    (filters.status === "checked" &&
                      checkedUsers.has(user.id)) ||
                    (filters.status === "unchecked" &&
                      !checkedUsers.has(user.id))
                );
              }
              if (filters.deptId !== "all") {
                filteredUsers = filteredUsers.filter(
                  (user) => user.deptId === filters.deptId
                );
              }

              const hiddenByFilters = nonOldUsers.length - filteredUsers.length;
              const hiddenByAge =
                checkedInUsersWithHours.length - nonOldUsers.length;

              const filterText =
                hiddenByFilters > 0
                  ? `${hiddenByFilters} hidden by filters`
                  : "";
              const ageText =
                hiddenByAge > 0
                  ? `${hiddenByAge} older than ${IS_OLD_HOURS} hours`
                  : "";

              if (filterText && ageText) {
                return `(${filterText}, ${ageText})`;
              } else if (filterText) {
                return `(${filterText})`;
              } else if (ageText) {
                return `(${ageText})`;
              }
              return "";
            })()}
          </span>
        </span>
        {authUser?.isAdmin ? (
          <button
            onClick={handleCompleteDrill}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full sm:w-auto"
          >
            Complete Drill
          </button>
        ) : authUser?.isAuth ? (
          <button
            type="button"
            disabled
            className="cursor-not-allowed bg-gray-300 text-gray-700 font-bold py-2 px-4 rounded w-full sm:w-auto dark:bg-gray-700 dark:text-gray-200"
            title="Admin only"
          >
            Complete Drill (admin only)
          </button>
        ) : null}
      </div>
    </div>
  );
});
