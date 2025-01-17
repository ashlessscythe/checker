import React, { useMemo, useState } from "react";
import { format } from "date-fns";
import { db, tx } from "@/lib/instantdb";
import { useAutoNavigate } from "@/hooks/useAutoNavigate";
import { Input } from "./ui/input";
import { Select } from "./ui/select";
import { Button } from "./ui/button";

export default function CheckInsTable() {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortField, setSortField] = useState("timestamp");
  const [sortOrder, setSortOrder] = useState("desc");
  const [filterName, setFilterName] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [cursors, setCursors] = useState([null]); // Array to store cursors for each page
  const [endCursor, setEndCursor] = useState(null);
  const [timeWindow, setTimeWindow] = useState(24); // hours to load

  useAutoNavigate("/", 5 * 60 * 1000);

  // Calculate timestamp for timeWindow hours ago
  const timeWindowAgo = useMemo(() => {
    return Date.now() - timeWindow * 60 * 60 * 1000;
  }, [timeWindow]);

  const { data, isLoading, error, pageInfo } = db.useQuery({
    punches: {
      $: {
        first: itemsPerPage,
        after: endCursor,
        order: {
          serverCreatedAt: "desc",
        },
      },
      users: {},
    },
  });

  if (error) {
    console.error("Query Error:", error); // Debugging line
  }

  console.log("Query Data:", data); // Debugging line

  const filteredPunches = useMemo(() => {
    if (!data || !data.punches) return [];

    return data.punches.filter((punch) => {
      // Time window filter
      const timeMatch = punch.timestamp >= timeWindowAgo;

      // Other filters
      const nameMatch = filterName
        ? punch.users[0]?.name
            ?.toLowerCase()
            .includes(filterName.toLowerCase()) ?? false
        : true;
      const typeMatch = filterType ? punch.type === filterType : true;
      const dateMatch =
        (filterDateFrom
          ? punch.timestamp >= new Date(filterDateFrom).getTime()
          : true) &&
        (filterDateTo
          ? punch.timestamp <= new Date(filterDateTo).getTime()
          : true);

      return timeMatch && nameMatch && typeMatch && dateMatch;
    });
  }, [data, filterName, filterType, filterDateFrom, filterDateTo, timeWindow]);

  if (isLoading) return <div>Loading...</div>;
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
    setCursors([null]);
    setEndCursor(null);
    setCurrentPage(1);
  };

  const handleFilter = () => {
    setCursors([null]);
    setEndCursor(null);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setFilterName("");
    setFilterType("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setCursors([null]);
    setEndCursor(null);
    setCurrentPage(1);
  };

  const loadMore = () => {
    if (pageInfo?.punches?.endCursor) {
      const newCursor = pageInfo.punches.endCursor;
      setCursors((prev) => [...prev, newCursor]); // Add new cursor to history
      setEndCursor(newCursor);
      setCurrentPage(currentPage + 1);
    } else {
      // If no more data in current time window, extend the window
      setTimeWindow((prev) => prev + 24);
      setEndCursor(null);
      setCursors([null]);
      setCurrentPage(1);
    }
  };

  const loadPrevious = () => {
    if (currentPage > 1) {
      const previousCursors = [...cursors];
      previousCursors.pop(); // Remove current cursor
      const previousCursor = previousCursors[previousCursors.length - 1]; // Get last cursor
      setCursors(previousCursors);
      setEndCursor(previousCursor);
      setCurrentPage(currentPage - 1);
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

      {filteredPunches.length === 0 ? (
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
              {filteredPunches.map((punch) => (
                <tr key={punch.id}>
                  <td className="border px-4 py-2">
                    {punch.users[0]?.name ?? "Unknown User"}
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
            <Button onClick={loadPrevious} disabled={currentPage === 1}>
              Previous
            </Button>
            <span>Page {currentPage}</span>
            <Button
              onClick={loadMore}
              disabled={!pageInfo?.punches?.hasNextPage}
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
                setCursors([null]);
                setEndCursor(null);
                setCurrentPage(1);
              }}
            >
              <option value={10}>10 per page</option>
              <option value={20}>20 per page</option>
            </Select>
          </div>
        </>
      )}
    </div>
  );
}
