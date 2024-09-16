import React, { useMemo, useState } from "react";
import { format } from "date-fns";
import { db, tx } from "../lib/instantdb";
import { useAutoNavigate } from "../hooks/useAutoNavigate";
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

  useAutoNavigate("/", 5 * 60 * 1000);

  const { data, isLoading, error } = db.useQuery({
    punches: {
      users: {},
    },
  });

 const filteredAndSortedPunches = useMemo(() => {
    if (!data || !data.punches) return [];

    return data.punches
      .filter((punch) => {
        const nameMatch = filterName
          ? punch.users[0].name.toLowerCase().includes(filterName.toLowerCase())
          : true;
        const typeMatch = filterType ? punch.type === filterType : true;
        const dateMatch =
          (filterDateFrom ? punch.timestamp >= new Date(filterDateFrom).getTime() : true) &&
          (filterDateTo ? punch.timestamp <= new Date(filterDateTo).getTime() : true);
        return nameMatch && typeMatch && dateMatch;
      })
      .sort((a, b) => {
        if (sortField === "users.name") {
          return sortOrder === "asc"
            ? a.users[0].name.localeCompare(b.users[0].name)
            : b.users[0].name.localeCompare(a.users[0].name);
        }
        if (sortField === "type") {
          return sortOrder === "asc"
            ? a.type.localeCompare(b.type)
            : b.type.localeCompare(a.type);
        }
        return sortOrder === "asc"
          ? a.timestamp - b.timestamp
          : b.timestamp - a.timestamp;
      });
  }, [data, filterName, filterType, filterDateFrom, filterDateTo, sortField, sortOrder]);

  const paginatedPunches = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedPunches.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedPunches, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredAndSortedPunches.length / itemsPerPage);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!data || !data.punches) {
    return <div>No data available</div>;
  }

  const handleSort = (field) => {
    if (field === sortField) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const handleFilter = () => {
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setFilterName("");
    setFilterType("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setCurrentPage(1);
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
        <Select
          value={filterType}
          onValueChange={(e) => setFilterType(e)}
        >
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
                <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort("users.name")}>
                  Name {sortField === "users.name" && (sortOrder === "asc" ? "▲" : "▼")}
                </th>
                <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort("type")}>
                  Type {sortField === "type" && (sortOrder === "asc" ? "▲" : "▼")}
                </th>
                <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort("timestamp")}>
                  Timestamp {sortField === "timestamp" && (sortOrder === "asc" ? "▲" : "▼")}
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedPunches.map((punch) => (
                <tr key={punch.id}>
                  <td className="border px-4 py-2">{punch.users[0].name}</td>
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
            <div>
              <Button
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="mx-2">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
            <Select
              value={itemsPerPage.toString()}
              onValueChange={(e) => {
                setItemsPerPage(Number(e));
                setCurrentPage(1);
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