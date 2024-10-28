// components/backuppage.tsx
"use client";
import { useState } from "react";
import { tx } from "@instantdb/react";
import { db } from "@/lib/instantdb";
import toast, { Toaster } from "react-hot-toast";
import { useAuth } from "@/hooks/authContext";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export default function BackupPage() {
  const { isAdmin } = useAuth();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Use db.useQuery for reactive data fetching
  const { data, isLoading, error } = db.useQuery({
    users: {
      $: {},
      punches: {},
    },
  });

  if (!isAdmin) {
    return null;
  }

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  const handleExport = async () => {
    try {
      setIsExporting(true);

      // Create the backup object with metadata
      const backupData = {
        timestamp: new Date().toISOString(),
        data: data,
      };

      // Convert to JSON and create blob
      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });

      // Create download link and trigger download
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `backup-${new Date().toISOString()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Backup exported successfully");
    } catch (error) {
      console.error("Error exporting backup:", error);
      toast.error("Failed to export backup");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = async () => {
    if (!startDate || !endDate) {
      toast.error("Please select both start and end dates");
      return;
    }

    try {
      setIsDeleting(true);

      // Calculate date 7 days ago
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Filter punches within date range and older than 7 days
      const punchesToDelete = data.users.flatMap((user) =>
        user.punches
          .filter((punch) => {
            const punchDate = new Date(punch.timestamp);
            const start = new Date(startDate);
            const end = new Date(endDate);

            // Skip records from the last 7 days
            if (punchDate > sevenDaysAgo) {
              return false;
            }

            return punchDate >= start && punchDate <= end;
          })
          .map((punch) => tx.punches[punch.id].delete())
      );

      if (punchesToDelete.length === 0) {
        toast.success("No eligible records found in the selected date range");
        return;
      }

      // Execute deletion
      await db.transact(punchesToDelete);

      toast.success(`Deleted ${punchesToDelete.length} records successfully`);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error("Error deleting records:", error);
      toast.error("Failed to delete records");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 bg-gray-100 rounded-lg">
      <Toaster position="top-right" />
      <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 text-gray-800">
        Backup & Data Management
      </h1>

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Export Data</h2>
          <p className="text-gray-600 mb-4">
            Download a complete backup of all user data and check-in records as
            JSON.
          </p>
          <Button
            onClick={handleExport}
            disabled={isExporting}
            className="w-full"
          >
            {isExporting ? "Exporting..." : "Export as JSON"}
          </Button>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Delete Records</h2>
          <p className="text-gray-600 mb-4">
            Delete check-in records within a specific date range. Records from
            the last 7 days cannot be deleted.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
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
                End Date
              </label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full"
              />
            </div>

            {!showDeleteConfirm ? (
              <Button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={!startDate || !endDate}
                className="w-full bg-red-600 hover:bg-red-700"
              >
                Delete Records
              </Button>
            ) : (
              <div className="space-y-2">
                <p className="text-red-600 font-medium">
                  Are you sure you want to delete all records between{" "}
                  {startDate} and {endDate}? Records from the last 7 days will
                  be preserved. This action cannot be undone.
                </p>
                <div className="flex space-x-2">
                  <Button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="w-1/2 bg-red-600 hover:bg-red-700"
                  >
                    {isDeleting ? "Deleting..." : "Confirm Delete"}
                  </Button>
                  <Button
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isDeleting}
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
