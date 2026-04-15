// components/checklist.tsx
"use client";

import React, { useMemo, useEffect, useState, useCallback } from "react";
import { id, tx } from "@instantdb/react";
import { db } from "@/lib/instantdb";
import { useAuth } from "@/hooks/authContext";
import {
  CheckActionType,
  checkInTypes,
  checkOutTypes,
} from "@/utils/checkInOut";

const FIRE_DRILL_CONFIG_KEY = "singleton";

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

interface UserWithStatus extends User {
  isCheckedIn: boolean;
  timeAgoString: string;
  hoursAgo: number;
  isOld: boolean;
}

export default React.memo(function AdvancedChecklist() {
  const [isClient, setIsClient] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [dateTime, setDateTime] = useState(new Date().toLocaleString());
  const [filters, setFilters] = useState({
    name: "",
    checkStatus: "all", // 'in', 'out', or 'all'
    accountedStatus: "all", // 'accounted', 'unaccounted', or 'all'
  });

  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const IS_OLD_HOURS = parseInt(
    process.env.NEXT_PUBLIC_THRESHOLD_HOURS || "14",
    10
  );
  const itemsPerPage = 20;

  const { user } = useAuth();
  const authUser = user;

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const coreQuery = useMemo(
    () => ({
      users: { $: { where: {} } },
      punches: {
        $: {
          where: {},
          order: { serverCreatedAt: "desc" as const },
        },
      },
      fireDrillConfig: {
        $: { where: { key: FIRE_DRILL_CONFIG_KEY } },
      },
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
    const sessionFilter = sid ? { where: { id: sid } } : { where: { id: none } };
    const scoped = { where: { sessionId: sid || none } };
    return {
      fireDrillSessions: { $: sessionFilter },
      fireDrillSessionParticipants: { $: scoped },
      fireDrillAccounts: { $: scoped },
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

  const handleCheckUser = useCallback(
    async (userId: string) => {
      if (!activeSessionId) return;
      const user = authUser;
      const accountedByName = user?.name || user?.email || "Unknown User";
      const accountedByUserId = user?.id || "";
      const existingAccount = data.fireDrillAccounts?.find(
        (a) => a.sessionId === activeSessionId && a.userId === userId
      );
      const isCurrentlyChecked = existingAccount?.status === "accounted";

      try {
        if (isCurrentlyChecked && existingAccount) {
          const canUnaccount =
            user?.isAdmin || existingAccount.accountedByUserId === accountedByUserId;
          if (!canUnaccount) return;
        }

        const rowId = existingAccount?.id || id();
        await db.transact([
          tx.fireDrillAccounts[rowId].update({
            sessionId: activeSessionId,
            userId,
            status: isCurrentlyChecked ? "unaccounted" : "accounted",
            timestamp: Date.now(),
            accountedByName,
            accountedByUserId,
          })
        ]);

      } catch (error) {
        console.error("Error saving fire drill check:", error);
      }
    },
    [authUser, activeSessionId, data]
  );

  const [showStartDrillConfirm, setShowStartDrillConfirm] = useState(false);

  const performStartDrill = useCallback(async () => {
    if (!authUser?.isAdmin && !authUser?.isAuth) return;
    if (!data?.users || !data?.punches) return;
    if (activeSessionId) return;

    const presentUsers = data.users
      .filter((u) => {
        const lastPunch = data.punches.find((p) => p.userId === u.id);
        return lastPunch && checkInTypes.has(lastPunch.type as CheckActionType);
      })
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
      alert("Fire drill started!");
    } catch (error) {
      console.error("Error starting fire drill:", error);
      alert("Error starting fire drill. Please try again.");
    }
  }, [authUser, data, activeSessionId, currentTime, IS_OLD_HOURS, ensureConfigRow]);

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
      alert("Fire drill completed!");
    } catch (error) {
      console.error("Error completing fire drill:", error);
      alert("Error completing fire drill. Please try again.");
    }
  }, [authUser, activeSessionId, ensureConfigRow]);

  function isUserCheckedIn(user: any): boolean {
    const lastPunch = user.punches[0];
    // Cast the string to CheckActionType enum
    return lastPunch && checkInTypes.has(lastPunch.type as CheckActionType);
  }

  const usersWithStatus = useMemo(() => {
    if (!data?.users || !data?.punches) return [];

    return data.users.map((user) => {
      const lastPunch = data.punches.find(punch => punch.userId === user.id);
      // Cast the string to CheckActionType enum
      const isCheckedIn =
        lastPunch && checkInTypes.has(lastPunch.type as CheckActionType);
      const timestamp = lastPunch ? new Date(lastPunch.timestamp).getTime() : 0;
      const diffInHours = (currentTime - timestamp) / (1000 * 60 * 60);
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
        isCheckedIn,
        timeAgoString,
        hoursAgo: diffInHours,
        isOld: diffInHours >= IS_OLD_HOURS,
        name,
      };
    });
  }, [data?.users, currentTime]);

  const filteredAndSortedUsers = useMemo(() => {
    let result = usersWithStatus as UserWithStatus[];

    // Apply filters
    if (filters.name) {
      result = result.filter((user) =>
        user.name.toLowerCase().includes(filters.name.toLowerCase())
      );
    }
    if (filters.checkStatus !== "all") {
      result = result.filter(
        (user) =>
          (filters.checkStatus === "in" && user.isCheckedIn) ||
          (filters.checkStatus === "out" && !user.isCheckedIn)
      );
    }
    if (filters.checkStatus === "in" && filters.accountedStatus !== "all") {
      result = result.filter(
        (user) =>
          (filters.accountedStatus === "accounted" &&
            checkedUsers.has(user.id)) ||
          (filters.accountedStatus === "unaccounted" &&
            !checkedUsers.has(user.id))
      );
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
  }, [usersWithStatus, filters, sortConfig, checkedUsers]);

  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedUsers.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedUsers, currentPage]);

  // Pagination controls
  const totalPages = Math.ceil(filteredAndSortedUsers.length / itemsPerPage);

  interface CheckListRowProps {
    user: {
      timeAgoString: string;
      name: string;
      id: string;
      isCheckedIn: boolean;
      isOld: boolean;
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
    };
    isChecked: boolean;
    accountedBy: string | undefined;
    onCheck: (userId: string) => Promise<void>;
  }

  const CheckListRow: React.FC<CheckListRowProps> = React.memo(({ user, isChecked, accountedBy, onCheck }) => {
    const statusClass = user.isCheckedIn
      ? isChecked
        ? "bg-green-100 dark:bg-green-700"
        : "bg-yellow-100 dark:bg-yellow-700"
      : "bg-gray-100 dark:bg-gray-600";

    const opacityClass = user.isOld ? "opacity-50" : "";

    return (
      <tr className={`${statusClass} ${opacityClass}`}>
        <td className="min-w-0 px-2 py-3 align-top sm:px-6 sm:py-4">
          <div className="break-words text-sm font-medium text-gray-900 dark:text-white">
            {user.name}
          </div>
        </td>
        <td className="min-w-0 px-2 py-3 align-top sm:px-6 sm:py-4">
          <button
            onClick={() => onCheck(user.id)}
            className={`max-w-full whitespace-normal rounded-full px-2 py-1 text-left text-xs font-semibold sm:px-3 sm:text-sm ${
              user.isCheckedIn
                ? isChecked
                  ? "bg-green-200 text-green-800 dark:bg-green-600 dark:text-green-100"
                  : "bg-red-200 text-red-800 dark:bg-red-600 dark:text-red-100"
                : "bg-gray-200 text-gray-800 dark:bg-gray-500 dark:text-gray-100"
            }`}
          >
            {user.isCheckedIn
              ? isChecked
                ? `Accounted by ${accountedBy}`
                : "Unaccounted"
              : "Checked Out"}
          </button>
        </td>
        <td className="min-w-0 px-2 py-3 align-top sm:px-6 sm:py-4">
          <div className="break-words text-xs text-gray-500 dark:text-gray-300 sm:text-sm">
            {user.isOld ? `${user.timeAgoString} (old)` : user.timeAgoString}
            {user.isCheckedIn ? " (In)" : " (Out)"}
          </div>
        </td>
      </tr>
    );
  });

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

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  if (!activeSessionId) {
    return (
      <>
        {showStartDrillConfirm && authUser?.isAuth && !authUser?.isAdmin && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="adv-start-drill-title"
            aria-describedby="adv-start-drill-desc"
          >
            <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg dark:bg-gray-800 dark:ring-1 dark:ring-white/10">
              <h2
                id="adv-start-drill-title"
                className="text-lg font-semibold text-gray-900 dark:text-white"
              >
                Start a fire drill?
              </h2>
              <p
                id="adv-start-drill-desc"
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
          <h1 className="mb-2 break-words text-xl font-bold sm:text-2xl">
            Fire Drill
          </h1>
          <div className="rounded-lg bg-yellow-50 p-4 text-sm text-yellow-900 shadow-sm dark:bg-yellow-900/30 dark:text-yellow-100">
            No active drill session.
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
      <h1 className="mb-4 break-words text-xl font-bold sm:text-2xl">
        Advanced Checklist - {dateTime}
      </h1>
      <div className="mb-4 flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:gap-x-4 sm:gap-y-2">
        <input
          type="text"
          placeholder="Filter by name"
          value={filters.name}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, name: e.target.value }))
          }
          className="min-w-0 w-full border px-2 py-1 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded sm:max-w-xs"
        />

        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          <span className="font-semibold mr-2">Check Status:</span>
          {[
            { label: "All", value: "all" },
            { label: "Checked In", value: "in" },
            { label: "Checked Out", value: "out" },
          ].map(({ label, value }) => (
            <label key={value} className="flex items-center">
              <input
                type="radio"
                value={value}
                checked={filters.checkStatus === value}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    checkStatus: e.target.value,
                  }))
                }
                className="form-radio h-4 w-4 text-blue-600"
              />
              <span className="ml-2 capitalize">{label}</span>
            </label>
          ))}
        </div>

        {filters.checkStatus === "in" && (
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
            <span className="font-semibold mr-2">Accounted Status:</span>
            {["all", "accounted", "unaccounted"].map((status) => (
              <label key={status} className="flex items-center">
                <input
                  type="radio"
                  value={status}
                  checked={filters.accountedStatus === status}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      accountedStatus: e.target.value,
                    }))
                  }
                  className="form-radio h-4 w-4 text-blue-600"
                />
                <span className="ml-2 capitalize">{status}</span>
              </label>
            ))}
          </div>
        )}
      </div>
      <div className="w-full min-w-0 overflow-hidden rounded-lg bg-white shadow-md dark:bg-gray-800">
        <div className="max-h-[600px] overflow-y-auto overflow-x-hidden rounded-b-lg bg-gray-50/80 shadow-[inset_0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_2px_rgba(0,0,0,0.06)] ring-1 ring-inset ring-black/5 dark:bg-gray-950/40 dark:shadow-[inset_0_2px_12px_rgba(0,0,0,0.45),inset_0_1px_3px_rgba(0,0,0,0.35)] dark:ring-white/10">
          <table className="w-full table-fixed divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
              <tr>
                <th
                  className="w-[34%] cursor-pointer px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300 sm:w-[32%] sm:px-6 sm:py-3"
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
                  className="w-[28%] cursor-pointer px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300 sm:w-[32%] sm:px-6 sm:py-3"
                  onClick={() => requestSort("hoursAgo")}
                >
                  Last Action{" "}
                  {sortConfig?.key === "hoursAgo" &&
                    (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredAndSortedUsers.map((user) => (
                <CheckListRow
                  key={user.id}
                  user={user}
                  isChecked={checkedUsers.has(user.id)}
                  accountedBy={checkedUsers.get(user.id)?.accountedBy}
                  onCheck={handleCheckUser}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="mt-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="min-w-0 break-words text-sm font-bold sm:mb-0 sm:text-base">
          Accounted: {checkedUsers.size} /{" "}
          {filteredAndSortedUsers.filter((u) => u.isCheckedIn).length} (In) |
          Total: {filteredAndSortedUsers.length}
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
