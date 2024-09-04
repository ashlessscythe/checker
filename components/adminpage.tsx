// components/AdminPage.tsx
"use client";
import { useState, useEffect } from "react";
import { tx } from "@instantdb/react";
import { db } from "../lib/instantdb";
import toast, { Toaster } from "react-hot-toast";
import { useAutoNavigate } from "../hooks/useAutoNavigate";
import { useAuth } from "../hooks/authContext";

export default function AdminPage() {
  const [userId, setUserId] = useState(null);
  const { data, isLoading, error } = db.useQuery({ users: {} });
  const [editingUser, setEditingUser] = useState(null);
  const [isClient, setIsClient] = useState(false);
  const { user, isAdmin } = useAuth();

  // console.log(`user: ${user}, isAdmin: ${isAdmin}`)
  if (!isAdmin) {
    return null;
  }

  useAutoNavigate("/", 300000); // Navigate to home after 5 minutes of inactivity

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

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

  return (
    <div className="container mx-auto p-6 bg-gray-100 min-h-screen">
      <Toaster position="top-right" />
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Admin Page</h1>
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Admin
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Auth
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.users.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingUser === user.id ? (
                    <input
                      className="border rounded px-2 py-1"
                      defaultValue={user.name}
                      onBlur={(e) => handleNameChange(user.id, e.target.value)}
                    />
                  ) : (
                    <span className="text-sm font-medium text-gray-900">
                      {user.name}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
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
                <td className="px-6 py-4 whitespace-nowrap">
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
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => setEditingUser(user.id)}
                    className="text-indigo-600 hover:text-indigo-900 mr-2"
                  >
                    Edit Name
                  </button>
                  <button
                    onClick={() => toggleAdminStatus(user.id, user.isAdmin)}
                    className="text-green-600 hover:text-green-900 mr-2"
                  >
                    {user.isAdmin ? "Remove Admin" : "Make Admin"}
                  </button>
                  <button
                    onClick={() => makeAuth(user.id, user.isAuth)}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    {user.isAuth ? "Revoke Auth" : "Grant Auth"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
