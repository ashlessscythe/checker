// components/CheckInOutForm.tsx
"use client";

import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import { tx, id } from "@instantdb/react";
import { db } from "../lib/instantdb";
import toast, { Toaster } from "react-hot-toast";
import { useAutoFocus } from "../hooks/useAutoFocus";
import { useAutoNavigate } from "../hooks/useAutoNavigate";

// Add the extractUserId function
function extractUserId(scannedId: string) {
  // Check if the scannedId contains any alphabetic characters
  if (/[a-zA-Z]/.test(scannedId)) {
    console.log(
      `Scanned ID contains alphabetic characters. Returning original: ${scannedId}`
    );
    return scannedId;
  }

  const patterns = [
    { prefix: "100", length: 9 },
    { prefix: "21", length: 8 },
    { prefix: "20", length: 8 },
    { prefix: "104", length: 9 },
    { prefix: "600", length: 9 },
  ];

  let bestMatch = { match: "", startIndex: Infinity, length: 0 };

  for (const pattern of patterns) {
    let startIndex = scannedId.indexOf(pattern.prefix);
    while (startIndex !== -1) {
      if (startIndex + pattern.length <= scannedId.length) {
        const possibleMatch = scannedId.substr(startIndex, pattern.length);

        if (
          startIndex < bestMatch.startIndex ||
          (startIndex === bestMatch.startIndex &&
            pattern.length > bestMatch.length)
        ) {
          bestMatch = {
            match: possibleMatch,
            startIndex: startIndex,
            length: pattern.length,
          };
        }
      }

      startIndex = scannedId.indexOf(pattern.prefix, startIndex + 1);
    }
  }

  if (bestMatch.match) {
    console.log(`Extracted ID: ${bestMatch.match}`);
    return bestMatch.match;
  } else {
    console.log(
      `Nothing was extracted from scannedId: ${scannedId}. Returning the original scannedId.`
    );
    return scannedId;
  }
}

interface CheckInOutFormProps {
  shouldFocus: boolean;
}

export default function CheckInOutForm({ shouldFocus }: CheckInOutFormProps) {
  const [barcode, setBarcode] = useState("");
  const inputRef = useAutoFocus(shouldFocus);

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

  // Always call hooks, but control their effect based on shouldFocus
  console.log(`checkinform, shouldfocus is ${shouldFocus}`);
  useAutoNavigate("/", 60000);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (barcode) {
        setBarcode("");
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [barcode]);

  const findUser = useMemo(() => {
    if (!data) return null;
    const extractedId = extractUserId(barcode);
    return data.users.find((u) => u.barcode === extractedId);
  }, [data, barcode]);

  const handleCheckInOut = useCallback(async () => {
    if (isLoading || !barcode || !data) return;

    const user = findUser;
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
  }, [isLoading, barcode, data, findUser]);

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
