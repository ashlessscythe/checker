import React, { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { db, tx } from "@/lib/instantdb";
import { Input } from "./ui/input";
import { Select } from "./ui/select";
import { Button } from "./ui/button";

import { AppSchema } from "@/instant.schema";

interface User {
  id: string;
  name: string;
}

interface Punch {
  id: string;
  userId: string;
  type: string;
  timestamp: number;
  serverCreatedAt: number;
}

export default function CheckInsTable() {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortField, setSortField] = useState("timestamp");
  const [sortOrder, setSortOrder] = useState("desc");
  const [filterName, setFilterName] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [endCursor, setEndCursor] = useState(null);
  const [timeWindow, setTimeWindow] = useState(24); // hours to load
  const [localPunches, setLocalPunches] = useState<Punch[]>([]);
  const [localCurrentPage, setLocalCurrentPage] = useState(1);
  const [hasMoreData, setHasMoreData] = useState(true);

  // Calculate timestamp for timeWindow hours ago
  const timeWindowAgo = useMemo(() => {
    return Date.now() - timeWindow * 60 * 60 * 1000;
  }, [timeWindow]);

  // Query to fetch users and punches from the last 24 hours
  const { data, isLoading, error, pageInfo } = db.useQuery({
    users: {
      $: {
        where: {},
      },
    },
    punches: {
      $: {
        where: {
          timestamp: { $gte: timeWindowAgo },
        },
        first: 100, // Fetch a larger batch initially
        after: endCursor,
        order: {
          serverCreatedAt: "desc",
        },
      },
    },
  });

  // Update localPunches when data changes
  useEffect(() => {
    if (data?.punches) {
      if (endCursor === null) {
        // Initial load or reset - replace all local punches
        setLocalPunches(data.punches as Punch[]);
      } else {
        // Append new punches to existing ones
        setLocalPunches((prev) => [...prev, ...(data.punches as Punch[])]);
      }

      // Update hasMoreData based on pageInfo
      setHasMoreData(pageInfo?.punches?.hasNextPage || false);
    }
  }, [data, pageInfo, endCursor]);

  if (error) {
    console.error("Query Error:", error);
  }

  // Filter punches based on user filters
  const filteredPunches = useMemo(() => {
    if (!localPunches.length || !data?.users) return [];

    const users = data.users as User[];

    return localPunches.filter((punch) => {
      // Name filter
      const userName = users.find((u) => u.id === punch.userId)?.name || "";
      const nameMatch = filterName
        ? userName.toLowerCase().includes(filterName.toLowerCase())
        : true;

      // Type filter
      const typeMatch = filterType ? punch.type === filterType : true;

      // Date range filter
      const dateMatch =
        (filterDateFrom
          ? punch.timestamp >= new Date(filterDateFrom).getTime()
          : true) &&
        (filterDateTo
          ? punch.timestamp <= new Date(filterDateTo).getTime() + 86399999 // Add 23:59:59 to include the entire day
          : true);

      return nameMatch && typeMatch && dateMatch;
    });
  }, [
    localPunches,
    data?.users,
    filterName,
    filterType,
    filterDateFrom,
    filterDateTo,
  ]);

  // Calculate paginated punches for current view
  const paginatedPunches = useMemo(() => {
    const startIndex = (localCurrentPage - 1) * itemsPerPage;
    return filteredPunches.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredPunches, localCurrentPage, itemsPerPage]);

  // Calculate total pages for local pagination
  const totalLocalPages = Math.ceil(filteredPunches.length / itemsPerPage);

  if (isLoading && !localPunches.length) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!data || !data.punches) {
    return <div>No data available</div>;
  }

  const handleSort = (field: string) => {
    if (field === sortField) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }

    // Reset pagination
    setLocalCurrentPage(1);

    // Sort local punches
    const sortedPunches = [...localPunches].sort((a, b) => {
      let aValue, bValue;

      if (field === "users.name" && data?.users) {
        const users = data.users as User[];
        aValue = users.find((u) => u.id === a.userId)?.name || "";
        bValue = users.find((u) => u.id === b.userId)?.name || "";
      } else {
        aValue = a[field as keyof Punch];
        bValue = b[field as keyof Punch];
      }

      if (sortOrder === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setLocalPunches(sortedPunches);
  };

  const handleFilter = () => {
    setLocalCurrentPage(1);
  };

  const handleClearFilters = () => {
    setFilterName("");
    setFilterType("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setLocalCurrentPage(1);
  };

  const handleNextPage = () => {
    if (localCurrentPage < totalLocalPages) {
      // If we have more local pages, just go to the next page
      setLocalCurrentPage(localCurrentPage + 1);
    } else if (hasMoreData) {
      // If we're at the last local page but there's more data in the database
      // Fetch more data by updating the cursor
      if (pageInfo?.punches?.endCursor) {
        setEndCursor(pageInfo.punches.endCursor);
      }
    } else if (timeWindow < 168) {
      // Limit to 7 days (168 hours) max
      // If no more data in current time window, extend the window
      setTimeWindow((prev) => prev + 24);
      setEndCursor(null);
      setLocalCurrentPage(1);
    }
  };

  const handlePreviousPage = () => {
    if (localCurrentPage > 1) {
      setLocalCurrentPage(localCurrentPage - 1);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Recent Swipes</h2>

      {/* Filters */}
      <div className="mb-4 flex space-x-2">
        <Input
          placeholder="Filter by name"
          value={filterName}
          onChange={(e) => setFilterName(e.target.value)}
        />
        <Select value={filterType} onValueChange={(e) => setFilterType(e)}>
          <option value="">All Types</option>
          <option value="in">In</option>
          <option value="out">Out</option>
        </Select>
        <Input
          type="date"
          value={filterDateFrom}
          onChange={(e) => setFilterDateFrom(e.target.value)}
        />
        <Input
          type="date"
          value={filterDateTo}
          onChange={(e) => setFilterDateTo(e.target.value)}
        />
        <Button onClick={handleFilter}>Apply Filters</Button>
        <Button onClick={handleClearFilters}>Clear Filters</Button>
      </div>

      {paginatedPunches.length === 0 ? (
        <p>No punches recorded.</p>
      ) : (
        <>
          <table className="min-w-full bg-white">
            <thead>
              <tr>
                <th
                  className="px-4 py-2 cursor-pointer"
                  onClick={() => handleSort("users.name")}
                >
                  Name{" "}
                  {sortField === "users.name" &&
                    (sortOrder === "asc" ? "▲" : "▼")}
                </th>
                <th
                  className="px-4 py-2 cursor-pointer"
                  onClick={() => handleSort("type")}
                >
                  Type{" "}
                  {sortField === "type" && (sortOrder === "asc" ? "▲" : "▼")}
                </th>
                <th
                  className="px-4 py-2 cursor-pointer"
                  onClick={() => handleSort("timestamp")}
                >
                  Timestamp{" "}
                  {sortField === "timestamp" &&
                    (sortOrder === "asc" ? "▲" : "▼")}
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedPunches.map((punch) => (
                <tr key={punch.id}>
                  <td className="border px-4 py-2">
                    {(data.users as User[]).find((u) => u.id === punch.userId)
                      ?.name || "Unknown User"}
                  </td>
                  <td className="border px-4 py-2">{punch.type}</td>
                  <td className="border px-4 py-2">
                    {format(new Date(punch.timestamp), "yyyy-MM-dd HH:mm:ss")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="mt-4 flex justify-between items-center">
            <Button
              onClick={handlePreviousPage}
              disabled={localCurrentPage === 1}
            >
              Previous
            </Button>
            <span>
              Page {localCurrentPage} of {totalLocalPages || 1}
              {isLoading && " (Loading more...)"}
            </span>
            <Button
              onClick={handleNextPage}
              disabled={
                localCurrentPage >= totalLocalPages &&
                !hasMoreData &&
                timeWindow >= 168
              }
            >
              Next
            </Button>
          </div>

          {/* Items per page selector and time window indicator */}
          <div className="mt-4 flex justify-between items-center">
            <div>Showing data from last {timeWindow} hours</div>
            <Select
              value={itemsPerPage.toString()}
              onValueChange={(e) => {
                setItemsPerPage(Number(e));
                setLocalCurrentPage(1);
              }}
            >
              <option value={10}>10 per page</option>
              <option value={20}>20 per page</option>
              <option value={50}>50 per page</option>
            </Select>
          </div>
        </>
      )}
    </div>
  );
}
