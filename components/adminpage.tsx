// components/AdminPage.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import { tx } from "@instantdb/react";
import { db } from "@/lib/instantdb";
import toast, { Toaster } from "react-hot-toast";
import { useAutoNavigate } from "@/hooks/useAutoNavigate";
import { useAuth } from "@/hooks/authContext";
import { Eye, EyeOff } from "lucide-react";
import { CheckActionType, performCheckinOut } from "@/utils/checkInOut";

export default function AdminPage() {
  const [userId, setUserId] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [editingBarcode, setEditingBarcode] = useState(null);
  const [isClient, setIsClient] = useState(false);
  const { user, isAdmin } = useAuth();
  const [visibleBarcodes, setVisibleBarcodes] = useState({});

  // console.log(`user: ${user}, isAdmin: ${isAdmin}`)
  if (!isAdmin) {
    return null;
  }

  const { data, isLoading, error } = db.useQuery({
    users: {
      $: {},
      punches: {},
    },
  });

  const handleBarcodeChange = async (userId, newBarcode) => {
    try {
      await db.transact([tx.users[userId].update({ barcode: newBarcode })]);
      setEditingBarcode(null);
      toast.success("Barcode updated successfully");
    } catch (error) {
      console.error("Error updating barcode:", error);
      toast.error("Failed to update barcode");
    }
  };

  const handleNameChange = async (userId, newName) => {
    try {
      await db.transact([tx.users[userId].update({ name: newName })]);
      setEditingUser(null);
      toast.success("Name updated successfully");
    } catch (error) {
      console.error("Error updating name:", error);
      toast.error("Failed to update name");
    }
  };

  const toggleAdminStatus = async (userId, currentStatus) => {
    try {
      await db.transact([tx.users[userId].update({ isAdmin: !currentStatus })]);
      toast.success(
        `User ${currentStatus ? "removed from" : "made"} admin successfully`
      );
    } catch (error) {
      console.error("Error toggling admin status:", error);
      toast.error("Failed to update admin status");
    }
  };

  const makeAuth = async (userId, currentStatus) => {
    try {
      await db.transact([tx.users[userId].update({ isAuth: !currentStatus })]);
      toast.success(
        `User authorization ${
          currentStatus ? "revoked" : "granted"
        } successfully`
      );
    } catch (error) {
      console.error("Error updating auth status:", error);
      toast.error("Failed to update authorization status");
    }
  };

  const toggleBarcodeVisibility = (userId) => {
    setVisibleBarcodes((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  const forceCheckIn = useCallback(
    async (userId: string) => {
      if (isLoading || !data) return;
      const user = data.users.find((u) => u.id === userId);
      if (user) {
        await performCheckinOut(user, CheckActionType.AdminCheckIn);
      }
    },
    [data, isLoading]
  );

  const forceCheckOut = useCallback(
    async (userId: string) => {
      if (isLoading || !data) return;
      const user = data.users.find((u) => u.id === userId);
      if (user) {
        await performCheckinOut(user, CheckActionType.AdminCheckOut);
      }
    },
    [data, isLoading]
  );

  useAutoNavigate("/"); // Navigate to home after 5 minutes of inactivity

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="container mx-auto p-4 sm:p-6 bg-gray-100 min-h-screen">
      <Toaster position="top-right" />
      <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 text-gray-800">
        Admin Page
      </h1>
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <div className="max-h-[800px] overflow-y-auto">
            {" "}
            {/* Adjust max-height as needed */}
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Barcode
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Admin
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Auth
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        {editingBarcode === user.id ? (
                          <input
                            className="border rounded px-2 py-1 w-full mr-2"
                            defaultValue={user.barcode}
                            onBlur={(e) =>
                              handleBarcodeChange(user.id, e.target.value)
                            }
                          />
                        ) : (
                          <span
                            className={`mr-2 cursor-pointer ${
                              visibleBarcodes[user.id] ? "" : "filter blur-sm"
                            }`}
                            onClick={() => setEditingBarcode(user.id)}
                          >
                            {user.barcode}
                          </span>
                        )}
                        <button
                          onClick={() => toggleBarcodeVisibility(user.id)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          {visibleBarcodes[user.id] ? (
                            <EyeOff size={16} />
                          ) : (
                            <Eye size={16} />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.email}
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                      {editingUser === user.id ? (
                        <input
                          className="border rounded px-2 py-1 w-full"
                          defaultValue={user.name}
                          onBlur={(e) =>
                            handleNameChange(user.id, e.target.value)
                          }
                        />
                      ) : (
                        <span className="text-sm font-medium text-gray-900">
                          {user.name}
                        </span>
                      )}
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          user.isAdmin
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {user.isAdmin ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          user.isAuth
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {user.isAuth ? "Authorized" : "Unauthorized"}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                        <button
                          onClick={() => setEditingBarcode(user.id)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          Edit Barcode
                        </button>
                        <button
                          onClick={() => setEditingUser(user.id)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          Edit Name
                        </button>
                        <button
                          onClick={() =>
                            toggleAdminStatus(user.id, user.isAdmin)
                          }
                          className="text-green-600 hover:text-green-900"
                        >
                          {user.isAdmin ? "Remove Admin" : "Make Admin"}
                        </button>
                        <button
                          onClick={() => makeAuth(user.id, user.isAuth)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          {user.isAuth ? "Revoke Auth" : "Grant Auth"}
                        </button>
                        <button
                          onClick={() => forceCheckIn(user.id)}
                          className="text-yellow-600 hover:text-yellow-900 mr-2"
                        >
                          Force Check-In
                        </button>
                        <button
                          onClick={() => forceCheckOut(user.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Force Check-Out
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
