"use client";

import { useState } from "react";
import { format } from "date-fns";
import { db, tx } from "../lib/instantdb";
import { useAutoNavigate } from "../hooks/useAutoNavigate";

export default function CheckInsTable() {
  const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;

  useAutoNavigate('/', 20000) // 20 sec

  const { data, isLoading, error } = db.useQuery({
    punches: {
      $: {
        order: { serverCreatedAt: "desc" },
      },
      users: {},
    },
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!data || !data.punches) {
    return <div>No data available</div>;
  }
  const punches = data.punches

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Recent Swipes</h2>
      {punches.length === 0 ? (
        <p>No punches recorded.</p>
      ) : (
        <table className="min-w-full bg-white">
          <thead>
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Timestamp</th>
              <th className="px-4 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {punches.map((punch) => (
              <tr key={punch.id}>
                <td className="border px-4 py-2">{punch.users[0].name}</td>
                <td className="border px-4 py-2">{punch.type}</td>
                <td className="border px-4 py-2">
                  {format(new Date(punch.timestamp), "yyyy-MM-dd HH:mm:ss")}
                </td>
                <td className="border px-4 py-2"></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
