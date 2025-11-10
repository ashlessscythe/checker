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
  const [deletionProgress, setDeletionProgress] = useState<string>("");
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [daysToKeep, setDaysToKeep] = useState(7);

  // Function to manually refresh data
  const refreshData = () => {
    console.log("Manual data refresh requested");
    // Force a re-render by updating a state variable
    // This is a workaround since InstantDB doesn't have a direct refresh method
    window.location.reload();
  };

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
      $: {
        order: { serverCreatedAt: "desc" },
        // Remove limit to get all punches for deletion
      },
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

      console.log("Cutoff date:", cutoffDate);
      console.log("Total punches:", data.punches?.length || 0);

      // Find punches older than cutoff date
      const oldPunches =
        data.punches?.filter((punch) => {
          if (!punch.id) {
            console.warn("Punch missing id:", punch);
            return false;
          }

          // Use serverCreatedAt if available, fallback to timestamp
          const punchTime = punch.serverCreatedAt || punch.timestamp;
          if (!punchTime) {
            console.warn(
              "Punch missing both serverCreatedAt and timestamp:",
              punch
            );
            return false;
          }

          const punchDate = new Date(punchTime);
          const isOld = punchDate < cutoffDate;
          console.log(
            `Punch ${
              punch.id
            }: ${punchDate} < ${cutoffDate} = ${isOld} (using ${
              punch.serverCreatedAt ? "serverCreatedAt" : "timestamp"
            })`
          );
          return isOld;
        }) || [];

      console.log("Punches to delete:", oldPunches.length);

      if (oldPunches.length === 0) {
        toast.success("No old punches found to delete");
        return;
      }

      // Create delete operations
      const deleteOperations = oldPunches
        .map((punch) => {
          if (!punch.id) {
            console.error("Punch missing id:", punch);
            return null;
          }

          // Try different approaches for delete operations
          let deleteOp;
          try {
            deleteOp = tx.punches[punch.id].delete();
            console.log(
              `Created delete operation for punch ${punch.id}:`,
              deleteOp
            );
          } catch (error) {
            console.error(
              `Error creating delete operation for punch ${punch.id}:`,
              error
            );
            return null;
          }

          return deleteOp;
        })
        .filter(Boolean); // Remove any null operations

      console.log("Delete operations created:", deleteOperations.length);
      console.log("Sample delete operation:", deleteOperations[0]);

      // Alternative approach: try to create delete operations differently
      if (deleteOperations.length === 0) {
        console.log("Trying alternative delete operation creation...");
        const altDeleteOperations = oldPunches
          .map((punch) => {
            if (!punch.id) return null;
            try {
              // Try using a different approach
              const deleteOp = tx.punches[punch.id].delete();
              console.log(
                `Alternative delete operation for punch ${punch.id}:`,
                deleteOp
              );
              return deleteOp;
            } catch (error) {
              console.error(
                `Alternative approach failed for punch ${punch.id}:`,
                error
              );
              return null;
            }
          })
          .filter(Boolean);

        if (altDeleteOperations.length > 0) {
          console.log(
            "Alternative delete operations created:",
            altDeleteOperations.length
          );
          deleteOperations.push(...altDeleteOperations);
        }
      }

      if (deleteOperations.length === 0) {
        toast.error("No valid delete operations could be created");
        return;
      }

      // Execute deletion
      console.log(
        "About to execute transaction with operations:",
        deleteOperations
      );

      // Try batch deletion first
      try {
        setDeletionProgress("Attempting batch deletion...");
        const result = await db.transact(deleteOperations);
        console.log("Batch transaction result:", result);

        // Validate the transaction result
        if (result && typeof result === "object") {
          console.log("Transaction result keys:", Object.keys(result));
          console.log("Transaction result values:", Object.values(result));
        }

        setDeletionProgress("Batch deletion completed successfully");
      } catch (batchError) {
        console.warn(
          "Batch deletion failed, trying individual deletions:",
          batchError
        );
        setDeletionProgress("Batch failed, trying individual deletions...");

        // Fallback to individual deletions
        let successCount = 0;
        let failureCount = 0;
        for (let i = 0; i < oldPunches.length; i++) {
          const punch = oldPunches[i];
          try {
            if (punch.id) {
              setDeletionProgress(
                `Deleting punch ${i + 1}/${oldPunches.length}...`
              );
              console.log(
                `Attempting to delete punch ${punch.id} (${i + 1}/${
                  oldPunches.length
                })`
              );

              const individualResult = await db.transact([
                tx.punches[punch.id].delete(),
              ]);
              console.log(
                `Individual deletion result for ${punch.id}:`,
                individualResult
              );

              successCount++;
              console.log(`Successfully deleted punch ${punch.id}`);
            }
          } catch (individualError) {
            failureCount++;
            console.error(
              `Failed to delete punch ${punch.id}:`,
              individualError
            );
            console.error(`Punch data:`, punch);
          }
        }

        console.log(
          `Individual deletion completed: ${successCount}/${oldPunches.length} successful, ${failureCount} failed`
        );
        setDeletionProgress(
          `Individual deletion completed: ${successCount}/${oldPunches.length} successful, ${failureCount} failed`
        );

        if (successCount === 0) {
          throw new Error(
            `All deletion attempts failed. ${failureCount} failures.`
          );
        }
      }

      // Check if data actually changed
      console.log("Punches before deletion:", oldPunches.length);
      console.log(
        "Expected remaining punches:",
        (data.punches?.length || 0) - deleteOperations.length
      );

      // Wait a moment and check if the data actually updated
      setTimeout(() => {
        console.log(
          "Data after deletion (delayed check):",
          data.punches?.length
        );
        const deletedPunchesStillExist = oldPunches.filter((punch) =>
          data.punches?.find((p) => p.id === punch.id)
        );
        console.log(
          "Deleted punches that still exist:",
          deletedPunchesStillExist.length
        );

        // Additional data validation
        console.log("Sample of remaining punches:", data.punches?.slice(0, 5));
        console.log("Sample of deleted punches:", oldPunches.slice(0, 5));

        // If punches still exist, try to force a refresh
        if (deletedPunchesStillExist.length > 0) {
          console.log(
            "Some deleted punches still exist, suggesting data refresh needed"
          );
          toast(
            "Data refresh may be needed. Please refresh the page to see changes.",
            {
              icon: "ℹ️",
              duration: 5000,
            }
          );

          // Try to force a data refresh by triggering a re-render
          setDeletionProgress("Attempting to refresh data...");

          // Try multiple refresh approaches
          setTimeout(() => {
            console.log("Attempting first refresh approach...");
            // Try to force a re-render by updating state
            setDeletionProgress("First refresh attempt...");
          }, 1000);

          setTimeout(() => {
            console.log("Attempting second refresh approach...");
            setDeletionProgress("Second refresh attempt...");
            // This is a hack to force InstantDB to re-query
            window.location.reload();
          }, 3000);
        } else {
          console.log(
            "All deleted punches appear to have been removed from the data"
          );
          setDeletionProgress("Data appears to be updated successfully");
        }
      }, 5000); // Increased timeout to 5 seconds

      toast.success(
        `Deletion completed. ${oldPunches.length} old punches were processed. Check console for detailed results.`
      );
      setShowTrimConfirm(false);
      setDeletionProgress("");

      // Final summary
      console.log("=== DELETION SUMMARY ===");
      console.log(`Total punches processed: ${oldPunches.length}`);
      console.log(`Delete operations created: ${deleteOperations.length}`);
      console.log("Check the console above for detailed transaction results");
      console.log(
        "If punches still appear in the UI, a page refresh may be needed"
      );
      console.log("================================");

      // Additional debugging info
      console.log("Current data state:", {
        totalPunches: data.punches?.length || 0,
        samplePunches: data.punches?.slice(0, 3) || [],
        queryInfo: "Check if InstantDB query needs to be updated",
      });

      // Transaction debugging info
      console.log("Transaction debugging:", {
        deleteOperationsType: typeof deleteOperations,
        deleteOperationsLength: deleteOperations.length,
        deleteOperationsSample: deleteOperations[0],
        instantDBVersion: "Check package.json for @instantdb/react version",
      });

      // Data refresh debugging info
      console.log("Data refresh debugging:", {
        dataUpdateTimeout: "5 seconds",
        refreshAttempts: "Multiple approaches tried",
        fallbackRefresh: "Page reload after 3 seconds if needed",
        note: "InstantDB may need manual refresh to show changes",
      });
    } catch (error) {
      console.error("Error trimming punches:", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
      toast.error(`Failed to trim punches: ${error.message}`);
    } finally {
      setIsTrimming(false);
      setDeletionProgress("");
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

  const handleDownloadPunchReport = async () => {
    try {
      setIsExporting(true);

      // Process the data from our existing query
      const userMap = Object.fromEntries(data.users.map((u) => [u.id, u]));
      const grouped: Record<
        string,
        Array<{ type: string; timestampLocal: string }>
      > = {};

      // Get last 4 punches per user, newest to oldest
      for (const p of data.punches) {
        const userId = p.userId;
        if (!grouped[userId]) grouped[userId] = [];
        if (grouped[userId].length < 4) {
          grouped[userId].push({
            type: p.type,
            timestampLocal: convertToMST(p.timestamp),
          });
        }
      }

      // Convert to CSV format
      const headers = ["Name", "Email", "Punch Type", "Local Timestamp"];
      const csvRows = [headers];

      // Process each user
      for (const user of data.users) {
        const punches = grouped[user.id] || [];
        // If user has no punches, add a single row with unknown values
        if (punches.length === 0) {
          csvRows.push([
            user.name || "unknown",
            user.email || "unknown",
            "unknown",
            "unknown",
          ]);
        } else {
          // Add a row for each punch
          for (const punch of punches) {
            csvRows.push([
              user.name || "unknown",
              user.email || "unknown",
              punch.type,
              punch.timestampLocal,
            ]);
          }
        }
      }

      const csvContent = csvRows.map((row) => row.join(",")).join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `punch_report_${
        new Date().toISOString().split("T")[0]
      }.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Punch report downloaded successfully");
    } catch (error) {
      console.error("Error generating punch report:", error);
      toast.error("Failed to generate punch report");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 bg-gray-100 dark:bg-gray-900 rounded-lg">
      <Toaster position="top-right" />
      <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 text-gray-800 dark:text-white">
        Database Backup & Restore
      </h1>

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Select Table</h2>
          <div className="space-y-4 mb-4">
            <Select value={selectedTable} onValueChange={setSelectedTable}>
              <SelectTrigger className="text-foreground bg-white dark:bg-gray-800 border border-border dark:border-gray-700 shadow-md rounded-sm">
                <SelectValue placeholder="Select table" />
              </SelectTrigger>
              <SelectContent className="text-foreground bg-white dark:bg-gray-800 border border-border dark:border-gray-700 shadow-md rounded-sm">
                {TABLES.map((table) => (
                  <SelectItem
                    key={table.value}
                    value={table.value}
                    className="hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer px-2 py-1 rounded-md"
                  >
                    {table.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Note: Downloads include linked data for viewing. Restore only
              handles direct table fields.
            </p>
          </div>
        </div>

        {selectedTable === "punches" && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Trim Old Punches</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Delete punch records older than the specified number of days.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
              )}

              {/* Progress display */}
              {isTrimming && deletionProgress && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800 font-medium">Progress:</p>
                  <p className="text-sm text-blue-600">{deletionProgress}</p>
                </div>
              )}
            </div>

            {/* Debug section */}
            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <h3 className="text-lg font-medium mb-3">Debug Info</h3>
              <div className="text-sm space-y-2">
                <p>Total punches loaded: {data.punches?.length || 0}</p>
                <p>
                  Oldest punch:{" "}
                  {data.punches?.length > 0
                    ? new Date(
                        Math.min(
                          ...data.punches.map(
                            (p) => p.serverCreatedAt || p.timestamp
                          )
                        )
                      ).toLocaleString()
                    : "None"}
                </p>
                <p>
                  Newest punch:{" "}
                  {data.punches?.length > 0
                    ? new Date(
                        Math.max(
                          ...data.punches.map(
                            (p) => p.serverCreatedAt || p.timestamp
                          )
                        )
                      ).toLocaleString()
                    : "None"}
                </p>
                <p>
                  Cutoff date:{" "}
                  {new Date(
                    Date.now() - daysToKeep * 24 * 60 * 60 * 1000
                  ).toLocaleString()}
                </p>
              </div>

              {/* Manual refresh */}
              <div className="mt-4">
                <Button
                  onClick={refreshData}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white mb-2"
                >
                  Refresh Page
                </Button>
              </div>

              {/* Test delete single punch */}
              <div className="mt-4">
                <h4 className="text-md font-medium mb-2">
                  Test Delete Single Punch
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                  Select a punch to test deletion:
                </p>
                <select
                  className="w-full p-2 border rounded mb-2"
                  onChange={(e) => {
                    const punchId = e.target.value;
                    if (punchId) {
                      console.log("Selected punch for test delete:", punchId);
                    }
                  }}
                >
                  <option value="">Select a punch...</option>
                  {data.punches?.slice(0, 10).map((punch) => (
                    <option key={punch.id} value={punch.id}>
                      {punch.id} -{" "}
                      {new Date(
                        punch.serverCreatedAt || punch.timestamp
                      ).toLocaleString()}{" "}
                      - {punch.type}
                    </option>
                  ))}
                </select>
                <Button
                  onClick={async () => {
                    const select = document.querySelector("select");
                    const punchId = select?.value;
                    if (!punchId) {
                      toast.error("Please select a punch first");
                      return;
                    }

                    try {
                      console.log("Testing delete of punch:", punchId);
                      const result = await db.transact([
                        tx.punches[punchId].delete(),
                      ]);
                      console.log("Test delete result:", result);
                      toast.success("Test delete successful!");

                      // Wait a moment and check if data changed
                      setTimeout(() => {
                        console.log(
                          "Data after deletion:",
                          data.punches?.length
                        );
                        console.log(
                          "Punch still exists:",
                          data.punches?.find((p) => p.id === punchId)
                        );
                      }, 1000);
                    } catch (error) {
                      console.error("Test delete failed:", error);
                      toast.error(`Test delete failed: ${error.message}`);
                    }
                  }}
                  className="w-full bg-red-600 hover:bg-red-700 text-white"
                >
                  Test Delete Selected Punch
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
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

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
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

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Punch Report</h2>
          <p className="text-gray-600 mb-4">
            Download a report of the most recent punches for all users.
          </p>
          <Button
            onClick={handleDownloadPunchReport}
            disabled={isExporting}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            {isExporting ? "Generating Report..." : "Download Punch Report"}
          </Button>
        </div>
      </div>
    </div>
  );
}
