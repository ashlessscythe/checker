"use client";

import { useState } from "react";
import { format } from "date-fns";
import { db, tx } from "../lib/instantdb";

interface Punch {
  id: string;
  timestamp: number;
  type: string;
  test?: number;
}

export default function CheckInsTable() {
  const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;

  const { data, isLoading, error } = db.useQuery({
    punches: {
      $: {
        order: { serverCreatedAt: "desc" },
      },
    },
  });

  console.log("Punches data:", data);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!data || !data.punches) return <div>No data available</div>;

  // const filteredPunches =
  //   data?.punches.filter(
  //     (punch) =>
  //       punch.user.name.toLowerCase().includes(filter.toLowerCase()) ||
  //       punch.user.barcode.includes(filter)
  //   ) || [];

  const punches: Punch[] = data.punches.map(
    (punch: any): Punch => ({
      id: punch.id,
      timestamp: punch.timestamp,
      type: punch.type,
      test: punch.test,
    })
  );

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Recent Swipes</h2>
      {punches.length === 0 ? (
        <p>No punches recorded.</p>
      ) : (
        <table className="min-w-full bg-white">
          <thead>
            <tr>
              <th className="px-4 py-2">ID</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Timestamp</th>
              <th className="px-4 py-2">Test</th>
              <th className="px-4 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {punches.map((punch) => (
              <tr key={punch.id}>
                <td className="border px-4 py-2">{punch.id.slice(0, 8)}...</td>
                <td className="border px-4 py-2">{punch.type}</td>
                <td className="border px-4 py-2">
                  {format(new Date(punch.timestamp), "yyyy-MM-dd HH:mm:ss")}
                </td>
                <td className="border px-4 py-2">{punch.test || "N/A"}</td>
                <td className="border px-4 py-2"></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
