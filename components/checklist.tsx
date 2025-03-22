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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

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

export default React.memo(function CheckList() {
  const [checkedUsers, setCheckedUsers] = useState<
    Map<string, { status: boolean; accountedBy: string }>
  >(new Map());
  const [drillId, setDrillId] = useState<string>("");
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

  const generateNewDrillId = useCallback(() => {
    const today = new Date();
    const newDrillId =
      today.getFullYear().toString() +
      (today.getMonth() + 1).toString().padStart(2, "0") +
      today.getDate().toString().padStart(2, "0");
    setDrillId(newDrillId);
  }, []);

  useEffect(() => {
    setIsClient(true);
    generateNewDrillId();
  }, [generateNewDrillId]);

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const { data, isLoading, error } = db.useQuery({
    users: {
      $: {}
    },
    punches: {
      $: {
        order: { serverCreatedAt: "desc" }
      }
    },
    fireDrillChecks: {
      $: {
        where: { drillId }
      }
    },
    departments: {
      $: {}
    }
  });

  useEffect(() => {
    if (data && data.fireDrillChecks) {
      const checkedMap = new Map(
        data.fireDrillChecks
          .filter((check) => check.status === "checked")
          .map((check) => [
            check.userId,
            { status: true, accountedBy: check.accountedBy || "Unknown User" },
          ])
      );
      setCheckedUsers(checkedMap);
    }
  }, [data]);

  const handleCheckUser = useCallback(
    async (userId: string) => {
      const user = authUser;
      const accountedBy = user?.name || user?.email || "Unknown User";
      const isCurrentlyChecked =
        checkedUsers.has(userId) && checkedUsers.get(userId)!.status;
      const newStatus = isCurrentlyChecked ? "unchecked" : "checked";

      try {
        // Find existing check for this user in this drill
        const existingCheck = data.fireDrillChecks.find(
          (check) => check.userId === userId
        );

        await db.transact([
          existingCheck
            ? tx.fireDrillChecks[existingCheck.id].update({
                status: newStatus,
                timestamp: Date.now(),
                accountedBy: accountedBy,
              })
            : tx.fireDrillChecks[id()].update({
                drillId: drillId,
                userId: userId,
                timestamp: Date.now(),
                status: newStatus,
                accountedBy: accountedBy,
              }),
        ]);

        setCheckedUsers((prev) => {
          const newCheckedUsers = new Map(prev);
          if (isCurrentlyChecked) {
            newCheckedUsers.delete(userId);
          } else {
            newCheckedUsers.set(userId, { status: true, accountedBy });
          }
          return newCheckedUsers;
        });
      } catch (error) {
        console.error("Error saving fire drill check:", error);
      }
    },
    [authUser, checkedUsers, drillId, data]
  );

  const handleCompleteDrill = useCallback(async () => {
    if (!data || !data.users) return;

    const checkedInUsers = data.users.filter((user) => {
      const userPunch = data.punches?.find(punch => punch.userId === user.id);
      return userPunch?.type === "checkin";
    });

    try {
      const newDrillRecordId = id(); // Generate a new ID for the fire drill record
      await db.transact([
        tx.firedrills[newDrillRecordId].update({
          drillId: drillId,
          completedAt: Date.now(),
          totalChecked: checkedUsers.size,
          totalPresent: checkedInUsers.length,
        }),
      ]);
      alert("Fire drill completed and saved!");
      generateNewDrillId(); // Generate a new drill ID for the next drill
      setCheckedUsers(new Map()); // Reset checked users
    } catch (error) {
      console.error("Error completing fire drill:", error);
      alert("Error saving fire drill. Please try again.");
    }
  }, [data, drillId, checkedUsers, generateNewDrillId]);

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

  interface CheckListRowProps {
    user: UserWithStatus;
    isChecked: boolean;
    accountedBy: string | undefined;
    onCheck: (userId: string) => Promise<void>;
  }

  const CheckListRow: React.FC<CheckListRowProps> = React.memo(({ user, isChecked, accountedBy, onCheck }) => {
    const isOld = user.hoursAgo >= IS_OLD_HOURS;

    return (
      <tr
        className={`
      ${isChecked ? "bg-green-100 dark:bg-green-700" : ""}
      ${isOld ? "opacity-50" : ""}
    `}
      >
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="text-sm font-medirm text-gray-900 dark:text-white">
            {user.name}
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <button
            onClick={() => onCheck(user.id)}
            className={`px-3 py-1 rounded-full text-sm font-semibold ${
              isChecked
                ? "bg-green-200 text-green-800 dark:bg-green-600 dark:text-green-100"
                : "bg-red-200 text-red-800 dark:bg-red-600 dark:text-red-100"
            }`}
          >
            {isChecked ? `Accounted by ${accountedBy}` : "Unaccounted"}
          </button>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="text-sm text-gray-500 dark:text-gray-300">
            {isOld ? `${user.timeAgoString} (old)` : user.timeAgoString}
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

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">
        Fire Drill Checklist - {dateTime}
      </h1>
      <div className="mb-4 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
        <input
          type="text"
          placeholder="Filter by name"
          value={filters.name}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, name: e.target.value }))
          }
          className="px-2 py-1 border rounded"
        />
        <select
          value={filters.status}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, status: e.target.value }))
          }
          className="px-2 py-1 border rounded"
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
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by department" />
          </SelectTrigger>
          <SelectContent className="bg-white">
            <SelectItem value="all">All Departments</SelectItem>
            {data?.departments?.map((dept) => (
              <SelectItem key={dept.id} value={dept.id}>
                {dept.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
        <div className="max-h-[600px] overflow-y-auto">
          {" "}
          {/* Adjust max-height as needed */}
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
              <tr>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer"
                  onClick={() => requestSort("name")}
                >
                  Name{" "}
                  {sortConfig?.key === "name" &&
                    (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer"
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
      <div className="mt-4 flex flex-col sm:flex-row justify-between items-center">
        <span className="font-bold mb-2 sm:mb-0">
          Accounted: {checkedUsers.size} / {filteredAndSortedUsers.length}
          <span className="text-gray-500 ml-2">
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
        <button
          onClick={handleCompleteDrill}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full sm:w-auto"
        >
          Complete Drill
        </button>
      </div>
    </div>
  );
});
