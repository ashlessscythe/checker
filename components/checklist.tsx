// components/checklist.tsx
"use client";

import React, { useEffect, useState, useCallback } from "react";
import { id, tx } from '@instantdb/react';
import { db } from "../lib/instantdb";
import { useAutoNavigate } from "../hooks/useAutoNavigate";

export default function CheckList() {
  const [checkedUsers, setCheckedUsers] = useState<Set<string>>(new Set());
  const [drillId, setDrillId] = useState<string>('');

  const generateNewDrillId = useCallback(() => {
    const today = new Date();
    const newDrillId = today.getFullYear().toString() +
      (today.getMonth() + 1).toString().padStart(2, '0') +
      today.getDate().toString().padStart(2, '0');
    setDrillId(newDrillId);
  }, []);

  useEffect(() => {
    generateNewDrillId();
  }, [generateNewDrillId]);

  const { data, isLoading, error } = db.useQuery({
    users: {
      $: {},
      punches: {
        $: {
          order: { serverCreatedAt: 'desc' }
        }
      },
    },
    fireDrillChecks: {
      $: {
        where: { drillId: drillId },
      }
    }
  });

  useAutoNavigate("/", 300000); // Navigate to home after 5 minutes of inactivity

  useEffect(() => {
    if (data && data.fireDrillChecks) {
      const checkedSet = new Set(
        data.fireDrillChecks
          .filter(check => check.status === "checked")
          .map(check => check.userId)
      );
      setCheckedUsers(checkedSet);
    }
  }, [data]);

  const handleCheckUser = useCallback(async (userId: string) => {
    const isCurrentlyChecked = checkedUsers.has(userId);
    const newStatus = isCurrentlyChecked ? "unchecked" : "checked";
  
    try {
      // Find existing check for this user in this drill
      const existingCheck = data.fireDrillChecks.find(check => check.userId === userId);
    
      if (existingCheck) {
        // Update existing check
        await db.transact([
          tx.fireDrillChecks[existingCheck.id].update({
            status: newStatus,
            timestamp: Date.now(),
          }),
        ]);
      } else {
        // Create new check
        await db.transact([
          tx.fireDrillChecks[id()].update({
            drillId: drillId,
            userId: userId,
            timestamp: Date.now(),
            status: newStatus,
          }),
        ]);
      }

      // Update local state
      setCheckedUsers(prev => {
        const newSet = new Set(prev);
        if (isCurrentlyChecked) {
          newSet.delete(userId);
        } else {
          newSet.add(userId);
        }
        return newSet;
      });
    } catch (error) {
      console.error("Error saving fire drill check:", error);
    }
  }, [checkedUsers, drillId, data]);

  const handleCompleteDrill = useCallback(async () => {
    if (!data || !data.users) return;

    const checkedInUsers = data.users.filter(user => 
      user.punches[0]?.type === "checkin"
    );

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
      setCheckedUsers(new Set()); // Reset checked users
    } catch (error) {
      console.error("Error completing fire drill:", error);
      alert("Error saving fire drill. Please try again.");
    }
  }, [data, drillId, checkedUsers, generateNewDrillId]);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  const checkedInUsers = data.users.filter(user => 
    user.punches[0]?.type === "checkin"
  );

  return (
     <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Fire Drill Checklist</h1>
      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {checkedInUsers.map((user) => (
              <tr key={user.id} className={checkedUsers.has(user.id) ? "bg-green-100 dark:bg-green-700" : ""}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => handleCheckUser(user.id)}
                    className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      checkedUsers.has(user.id)
                        ? "bg-green-200 text-green-800 dark:bg-green-600 dark:text-green-100"
                        : "bg-red-200 text-red-800 dark:bg-red-600 dark:text-red-100"
                    }`}
                  >
                    {checkedUsers.has(user.id) ? "Accounted" : "Missing"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex justify-between items-center">
        <span className="font-bold">
          Accounted: {checkedUsers.size} / {checkedInUsers.length}
        </span>
        <button
          onClick={handleCompleteDrill}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Complete Drill
        </button>
      </div>
    </div>
  );
}