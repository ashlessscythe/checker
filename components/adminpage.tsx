// components/AdminPage.tsx
"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { tx } from "@instantdb/react";
import { db } from "@/lib/instantdb";
import { useCreateUser } from "@/hooks/useCreateUser";
import toast, { Toaster } from "react-hot-toast";
import { useAutoNavigate } from "@/hooks/useAutoNavigate";
import { useAuth } from "@/hooks/authContext";
import { Eye, EyeOff, Search } from "lucide-react";
import { CheckActionType, performCheckinOut } from "@/utils/checkInOut";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Select } from "./ui/select";

export default function AdminPage() {
  const [userId, setUserId] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [editingBarcode, setEditingBarcode] = useState(null);
  const [isClient, setIsClient] = useState(false);
  const { user, isAdmin } = useAuth();
  const [visibleBarcodes, setVisibleBarcodes] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    barcode: "",
    isAdmin: false,
  });

  const {
    createUser,
    isLoading: isCreating,
    error: createError,
  } = useCreateUser();

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

  const filteredUsers = useMemo(() => {
    if (!data?.users) return [];
    return data.users.filter(
      (user) =>
        user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.barcode?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [data?.users, searchTerm]);

  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredUsers.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredUsers, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);

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
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="relative w-1/3">
            <Input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border rounded-md"
            />
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={20}
            />
          </div>
          <span className="text-sm text-gray-600">
            Search by name, email, or barcode
          </span>
        </div>
        <Button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          {showCreateForm ? "Cancel" : "Create User"}
        </Button>
      </div>

      {showCreateForm && (
        <div className="mb-6 p-4 bg-white rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Create New User</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              placeholder="Name"
              value={newUser.name}
              onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
            />
            <Input
              placeholder="Email"
              type="email"
              value={newUser.email}
              onChange={(e) =>
                setNewUser({ ...newUser, email: e.target.value })
              }
            />
            <Input
              placeholder="Barcode"
              value={newUser.barcode}
              onChange={(e) =>
                setNewUser({ ...newUser, barcode: e.target.value })
              }
            />
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isAdmin"
                checked={newUser.isAdmin}
                onChange={(e) =>
                  setNewUser({ ...newUser, isAdmin: e.target.checked })
                }
                className="rounded border-gray-300"
              />
              <label htmlFor="isAdmin">Is Admin</label>
            </div>
          </div>
          <div className="mt-4 flex justify-end space-x-2">
            <Button
              onClick={async () => {
                try {
                  await createUser(newUser);
                  setNewUser({
                    name: "",
                    email: "",
                    barcode: "",
                    isAdmin: false,
                  });
                  setShowCreateForm(false);
                  toast.success("User created successfully");
                } catch (err) {
                  toast.error("Failed to create user");
                }
              }}
              disabled={
                isCreating ||
                !newUser.name ||
                !newUser.email ||
                !newUser.barcode
              }
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isCreating ? "Creating..." : "Create"}
            </Button>
          </div>
          {createError && (
            <p className="mt-2 text-sm text-red-600">{createError}</p>
          )}
        </div>
      )}
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <div className="max-h-[800px] overflow-y-auto">
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
                {paginatedUsers.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        {editingBarcode === user.id ? (
                          <input
                            className="border rounded px-2 py-1 w-full mr-2"
                            defaultValue={user.barcode ?? ""}
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
                            {user.barcode ?? "N/A"}
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
                      {user.email ?? "N/A"}
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                      {editingUser === user.id ? (
                        <input
                          className="border rounded px-2 py-1 w-full"
                          defaultValue={user.name ?? ""}
                          onBlur={(e) =>
                            handleNameChange(user.id, e.target.value)
                          }
                        />
                      ) : (
                        <span className="text-sm font-medium text-gray-900">
                          {user.name ?? "N/A"}
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
      <div className="mt-4 flex justify-between items-center">
        <div>
          <Button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <span className="mx-2">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            onClick={() =>
              setCurrentPage((prev) => Math.min(prev + 1, totalPages))
            }
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
          <option value="10">10 per page</option>
          <option value="20">20 per page</option>
          <option value="50">50 per page</option>
        </Select>
      </div>
    </div>
  );
}
