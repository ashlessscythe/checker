// components/CheckInOutForm.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { tx, id } from "@instantdb/react";
import { db } from "../lib/instantdb";
import toast, { Toaster } from "react-hot-toast";
import { useAutoFocus } from "../hooks/useAutoFocus";
import { useAutoNavigate } from "../hooks/useAutoNavigate";

interface CheckInOutFormProps {
  isAuthModalOpen: boolean;
  // isAuthorizedUser: boolean;
}

export default function CheckInOutForm({
  isAuthModalOpen,
}: // isAuthorizedUser,
CheckInOutFormProps) {
  const [barcode, setBarcode] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [shouldFocus, setShouldFocus] = useState(!isAuthModalOpen);

  // Fetch users with their punches
  const { isLoading, error, data } = db.useQuery({
    users: {
      punches: {
        $: {
          order: { serverCreatedAt: "desc" },
        },
      },
    },
  });

  useEffect(() => {
    setShouldFocus(!isAuthModalOpen);
  }, [isAuthModalOpen]);

  // Always call hooks, but control their effect based on isAuthModalOpen
  console.log(`checkinform, shouldfocus is ${shouldFocus}`);
  useAutoFocus(inputRef, 5000, shouldFocus);
  useAutoNavigate("/", 60000);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (barcode) {
        setBarcode("");
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [barcode]);

  const handleCheckInOut = async () => {
    if (isLoading || !barcode || !data) return;

    const user = data.users.find((u) => u.barcode === barcode);
    if (!user) {
      toast.error("User not found", {
        duration: 3000,
        style: {
          borderRadius: "10px",
          background: "#333",
          color: "#fff",
        },
      });
      setBarcode("");
      return;
    }

    // Get the last punch for this user
    const lastPunch = user.punches[0]; // The punches are already ordered by serverCreatedAt desc
    const isCheckIn = !lastPunch || lastPunch.type === "checkout";

    try {
      const newPunchId = id();
      await db.transact([
        tx.punches[newPunchId].update({
          type: isCheckIn ? "checkin" : "checkout",
          timestamp: Date.now(),
        }),
        tx.users[user.id].link({ punches: newPunchId }),
      ]);

      toast.success(
        `${user.name}: ${isCheckIn ? "checked in" : "checked out"}`,
        {
          duration: 3000,
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
        duration: 3000,
        style: {
          borderRadius: "10px",
          background: "#333",
          color: "#fff",
        },
      });
      console.error("Check-in/out error:", error);
    }

    setBarcode("");
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  return (
    <div className="flex flex-col items-center">
      <div className="h-16">
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
          ref={inputRef}
          type="password"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && handleCheckInOut()}
          placeholder="Scan barcode..."
          className="w-full p-2 mb-4 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
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
