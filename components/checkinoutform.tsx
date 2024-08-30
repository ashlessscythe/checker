// components/CheckInOutForm.tsx
"use client";

import { useState, useRef } from "react";
import { tx, id } from "@instantdb/react";
import { db } from "../lib/instantdb";
import toast, { Toaster } from "react-hot-toast";

export default function CheckInOutForm() {
  const [barcode, setBarcode] = useState("");
  const formRef = useRef<HTMLDivElement>(null);
  const { isLoading, error, data } = db.useQuery({
    users: {},
    punches: { $: { order: { serverCreatedAt: "desc" }, limit: 1 } },
  });

  const handleCheckInOut = async () => {
    if (isLoading || !barcode) return;

    const user = data.users.find((u) => u.barcode === barcode);
    if (!user) {
      toast.error("User not found", {
        position: "top-center",
        style: {
          borderRadius: "10px",
          background: "#333",
          color: "#fff",
        },
      });
      setBarcode("");
      return;
    }

    const lastPunch = data.punches[0];
    const isCheckIn = !lastPunch || lastPunch.type === "checkout";

    try {
      await db.transact([
        tx.punches[id()].update({
          type: isCheckIn ? "checkin" : "checkout",
          timestamp: Date.now(),
          user: user.id,
        }),
      ]);

      toast.success(
        `${user.name}\n Successfully ${
          isCheckIn ? "checked in" : "checked out"
        }`,
        {
          position: "top-center",
          style: {
            borderRadius: "10px",
            background: "#333",
            color: "#fff",
          },
          icon: isCheckIn ? "✅" : "👋",
        }
      );
    } catch (error) {
      toast.error("An error occurred. Please try again.", {
        position: "top-center",
        style: {
          borderRadius: "10px",
          background: "#333",
          color: "#fff",
        },
      });
    }

    setBarcode("");
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="h-16">
        {}
        <Toaster
          containerStyle={{
            top: 0,
          }}
          toastOptions={{
            className: "relative top-16",
          }}
        />
      </div>
      <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center text-gray-800 dark:text-white">
          Check In / Check Out
        </h1>
        <input
          type="password"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && handleCheckInOut()}
          placeholder="Scan barcode..."
          className="w-full p-2 mb-4 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          autoFocus
        />
        <button
          onClick={handleCheckInOut}
          className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
        >
          Check In / Out
        </button>
      </div>
    </div>
  );
}
