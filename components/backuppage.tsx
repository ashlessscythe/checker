// components/backuppage.tsx
"use client";
import { useState } from "react";
import { tx, id } from "@instantdb/react";
import { db } from "@/lib/instantdb";
import toast, { Toaster } from "react-hot-toast";
import { useAuth } from "@/hooks/authContext";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

const TABLES = [
  { value: "users", label: "Users" },
  { value: "departments", label: "Departments" },
  { value: "punches", label: "Punches" },
  { value: "backups", label: "Backups" },
];

// Convert UTC timestamp to MST ISO8601
const convertToMST = (timestamp) => {
  const date = new Date(timestamp);
  return (
    date
      .toLocaleString("sv", { timeZone: "America/Denver" })
      .replace(" ", "T") + "-07:00"
  );
};

// Add local timestamps to an item and its nested punches
const addLocalTimestamps = (item) => {
  const processedItem = { ...item };

  // Handle top-level timestamps
  if (processedItem.timestamp) {
    processedItem.timestampLocal = convertToMST(processedItem.timestamp);
  }
  if (processedItem.lastLoginAt) {
    processedItem.lastLoginLocal = convertToMST(processedItem.lastLoginAt);
  }

  // Handle nested punches array if it exists
  if (Array.isArray(processedItem.punches)) {
    processedItem.punches = processedItem.punches.map((punch) => {
      const processedPunch = { ...punch };
      if (processedPunch.timestamp) {
        processedPunch.timestampLocal = convertToMST(processedPunch.timestamp);
      }
      return processedPunch;
    });
  }

  return processedItem;
};

// Sample data showing direct fields only
const SAMPLE_DATA = {
  users: {
    timestamp: Date.now(),
    timestampLocal: convertToMST(Date.now()),
    table: "users",
    note: "Basic user fields for restore",
    data: [
      {
        name: "John Doe",
        email: "john@example.com",
        barcode: "123456",
        isAdmin: false,
        isAuth: true,
        deptId: "dept1",
        lastLoginAt: Date.now(),
        lastLoginLocal: convertToMST(Date.now()),
        punches: [
          {
            type: "checkin",
            timestamp: Date.now(),
            timestampLocal: convertToMST(Date.now()),
          },
        ],
      },
    ],
  },
  departments: {
    timestamp: Date.now(),
    timestampLocal: convertToMST(Date.now()),
    table: "departments",
    note: "Department fields",
    data: [
      {
        name: "Engineering",
        departmentId: "dept1",
      },
    ],
  },
  punches: {
    timestamp: Date.now(),
    timestampLocal: convertToMST(Date.now()),
    table: "punches",
    note: "Punch fields with userId",
    data: [
      {
        type: "checkin",
        timestamp: Date.now(),
        timestampLocal: convertToMST(Date.now()),
        userId: "user123",
      },
    ],
  },
};

export default function BackupPage() {
  const { isAdmin } = useAuth();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedTable, setSelectedTable] = useState(TABLES[0].value);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [showTrimConfirm, setShowTrimConfirm] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isTrimming, setIsTrimming] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [daysToKeep, setDaysToKeep] = useState(7);

  // Query data - include punches for users in view only
  const { data, isLoading, error } = db.useQuery({
    users: {
      $: {},
      punches: {}, // Include punches for viewing/export only
    },
    departments: {
      $: {},
    },
    punches: {
      $: {},
    },
    backups: {
      $: {},
    },
  });

  if (!isAdmin) {
    return null;
  }

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  const handleTrimPunches = async () => {
    try {
      setIsTrimming(true);

      // Calculate cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      // Find punches older than cutoff date
      const punchesToDelete = data.punches
        .filter((punch) => new Date(punch.timestamp) < cutoffDate)
        .map((punch) => tx.punches[punch.id].delete());

      if (punchesToDelete.length === 0) {
        toast.success("No old punches found to delete");
        return;
      }

      // Execute deletion
      await db.transact(punchesToDelete);

      toast.success(`Deleted ${punchesToDelete.length} old punches`);
      setShowTrimConfirm(false);
    } catch (error) {
      console.error("Error trimming punches:", error);
      toast.error("Failed to trim punches");
    } finally {
      setIsTrimming(false);
    }
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      let exportData;

      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        // Filter data based on date range
        const filteredData = data[selectedTable].filter((item) => {
          const itemDate = new Date(item.timestamp);
          return itemDate >= start && itemDate <= end;
        });

        // Add local timestamps while preserving original timestamps
        const dataWithLocalTime = filteredData.map(addLocalTimestamps);

        exportData = {
          timestamp: Date.now(),
          timestampLocal: convertToMST(Date.now()),
          table: selectedTable,
          note:
            selectedTable === "users"
              ? "Includes punches for viewing only"
              : "Direct table fields",
          dateRange: {
            start: startDate,
            end: endDate,
            note: "Date range is inclusive",
          },
          data: dataWithLocalTime,
        };
      } else {
        // Add local timestamps while preserving original timestamps
        const dataWithLocalTime = data[selectedTable].map(addLocalTimestamps);

        exportData = {
          timestamp: Date.now(),
          timestampLocal: convertToMST(Date.now()),
          table: selectedTable,
          note:
            selectedTable === "users"
              ? "Includes punches for viewing only"
              : "Direct table fields",
          data: dataWithLocalTime,
        };
      }

      // Convert to JSON and create blob
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });

      // Create download link and trigger download
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const filename =
        startDate && endDate
          ? `${selectedTable}-${startDate}-to-${endDate}.json`
          : `${selectedTable}-${new Date().toISOString()}.json`;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`${selectedTable} data exported successfully`);
    } catch (error) {
      console.error("Error exporting data:", error);
      toast.error("Failed to export data");
    } finally {
      setIsExporting(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreFile) {
      toast.error("Please select a file to restore");
      return;
    }

    try {
      setIsRestoring(true);
      const fileContent = await restoreFile.text();
      const restoreData = JSON.parse(fileContent);

      if (!restoreData.table || !restoreData.data) {
        throw new Error("Invalid backup file format");
      }

      if (restoreData.table !== selectedTable) {
        throw new Error(
          `File contains ${restoreData.table} data but ${selectedTable} was selected`
        );
      }

      // Create transactions for each item
      const transactions = restoreData.data.map((item) => {
        const tx_id = item.id || id();
        // Only restore direct fields
        const itemData = { ...item };
        delete itemData.punches;
        delete itemData.department;
        delete itemData.users;
        delete itemData.user;
        // Remove local timestamp fields before restore
        delete itemData.timestampLocal;
        delete itemData.lastLoginLocal;
        return tx[selectedTable][tx_id].update(itemData);
      });

      // Execute all transactions
      await db.transact(transactions);

      toast.success(`${selectedTable} data restored successfully`);
      setShowRestoreConfirm(false);
      setRestoreFile(null);
    } catch (error) {
      console.error("Error restoring data:", error);
      toast.error(error.message || "Failed to restore data");
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDownloadSample = () => {
    const sample = SAMPLE_DATA[selectedTable];
    const jsonString = JSON.stringify(sample, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sample-${selectedTable}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Sample ${selectedTable} template downloaded`);
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 bg-gray-100 rounded-lg">
      <Toaster position="top-right" />
      <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 text-gray-800">
        Database Backup & Restore
      </h1>

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Select Table</h2>
          <div className="space-y-4 mb-4">
            <Select value={selectedTable} onValueChange={setSelectedTable}>
              <SelectTrigger className="text-foreground bg-white border border-border shadow-md rounded-sm">
                <SelectValue placeholder="Select table" />
              </SelectTrigger>
              <SelectContent className="text-foreground bg-white border border-border shadow-md rounded-sm">
                {TABLES.map((table) => (
                  <SelectItem
                    key={table.value}
                    value={table.value}
                    className="hover:bg-gray-100 cursor-pointer px-2 py-1 rounded-md"
                  >
                    {table.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-gray-600">
              Note: Downloads include linked data for viewing. Restore only
              handles direct table fields.
            </p>
          </div>
        </div>

        {selectedTable === "punches" && (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Trim Old Punches</h2>
            <p className="text-gray-600 mb-4">
              Delete punch records older than the specified number of days.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Days to Keep
                </label>
                <Input
                  type="number"
                  min="7"
                  value={daysToKeep}
                  onChange={(e) => setDaysToKeep(parseInt(e.target.value) || 7)}
                  className="w-full"
                />
              </div>

              {!showTrimConfirm ? (
                <Button
                  onClick={() => setShowTrimConfirm(true)}
                  className="w-full bg-orange-600 hover:bg-orange-700"
                >
                  Trim Old Punches
                </Button>
              ) : (
                <div className="space-y-2">
                  <p className="text-orange-600 font-medium">
                    Are you sure you want to delete all punch records older than{" "}
                    {daysToKeep} days? This action cannot be undone.
                  </p>
                  <div className="flex space-x-2">
                    <Button
                      onClick={handleTrimPunches}
                      disabled={isTrimming}
                      className="w-1/2 bg-orange-600 hover:bg-orange-700"
                    >
                      {isTrimming ? "Trimming..." : "Confirm Trim"}
                    </Button>
                    <Button
                      onClick={() => setShowTrimConfirm(false)}
                      disabled={isTrimming}
                      className="w-1/2"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Export Data</h2>
          <p className="text-gray-600 mb-4">
            Download data from the selected table. Optionally filter by date
            range.
          </p>
          <div className="space-y-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date (Optional)
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date (Optional)
              </label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full"
              />
            </div>
          </div>
          <div className="flex space-x-4">
            <Button
              onClick={handleExport}
              disabled={isExporting}
              className="flex-1"
            >
              {isExporting ? "Exporting..." : "Export Data"}
            </Button>
            <Button
              onClick={handleDownloadSample}
              variant="outline"
              className="flex-1"
            >
              Download Sample
            </Button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Restore Data</h2>
          <p className="text-gray-600 mb-4">
            Restore data from a backup file. Only direct table fields will be
            restored.
          </p>
          <div className="space-y-4">
            <Input
              type="file"
              accept=".json"
              onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
              className="w-full"
            />

            {!showRestoreConfirm ? (
              <Button
                onClick={() => setShowRestoreConfirm(true)}
                disabled={!restoreFile}
                className="w-full bg-yellow-600 hover:bg-yellow-700"
              >
                Restore Data
              </Button>
            ) : (
              <div className="space-y-2">
                <p className="text-yellow-600 font-medium">
                  Are you sure you want to restore data from {restoreFile?.name}
                  ? This may overwrite existing data.
                </p>
                <div className="flex space-x-2">
                  <Button
                    onClick={handleRestore}
                    disabled={isRestoring}
                    className="w-1/2 bg-yellow-600 hover:bg-yellow-700"
                  >
                    {isRestoring ? "Restoring..." : "Confirm Restore"}
                  </Button>
                  <Button
                    onClick={() => setShowRestoreConfirm(false)}
                    disabled={isRestoring}
                    className="w-1/2"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
