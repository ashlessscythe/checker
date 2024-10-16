// components/CheckInOutForm.tsx
"use client";

import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import { db } from "@/lib/instantdb";
import toast, { Toaster } from "react-hot-toast";
import { useAutoFocus } from "@/hooks/useAutoFocus";
import { useAutoNavigate } from "@/hooks/useAutoNavigate";
import { CheckActionType, performCheckinOut } from "@/utils/checkInOut";
import { useAutoCheckout } from "@/hooks/useAutoCheckout";

const ENABLE_AUTO_CLEANUP =
  process.env.NEXT_PUBLIC_ENABLE_AUTO_CLEANUP === "true";

const DEBOUNCE_TIMEOUT =
  Number(process.env.NEXT_PUBLIC_DEBOUNCE_TIMEOUT) || 5000; // Default to 5 seconds if not set

// Add the extractUserId function
function extractUserId(scannedId: string) {
  // Check if the scannedId contains any alphabetic characters
  if (/[a-zA-Z]/.test(scannedId)) {
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
    return bestMatch.match;
  } else {
    return scannedId;
  }
}

interface CheckInOutFormProps {
  shouldFocus: boolean;
}

export default function CheckInOutForm({ shouldFocus }: CheckInOutFormProps) {
  const [barcode, setBarcode] = useState("");
  const [lastScanTime, setLastScanTime] = useState(0);
  const [lastScannedBarcode, setLastScannedBarcode] = useState("");
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
  useAutoNavigate("/", 2 * 60 * 1000);
  // useAutoCheckout({ data });

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

  const isDoubleScan = useCallback(
    (currentBarcode: string) => {
      const currentTime = Date.now();
      if (
        currentBarcode === lastScannedBarcode &&
        currentTime - lastScanTime < DEBOUNCE_TIMEOUT
      ) {
        return true;
      }
      setLastScanTime(currentTime);
      setLastScannedBarcode(currentBarcode);
      return false;
    },
    [lastScanTime, lastScannedBarcode]
  );

  const handleCheckInOut = useCallback(async () => {
    if (isLoading || !barcode || !data) return;

    const extractedId = extractUserId(barcode);
    if (isDoubleScan(extractedId)) {
      toast.error("DOUBLE SCAN, SLOW DOWN 🛑", {
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

    await performCheckinOut(user);
    setBarcode("");
  }, [isLoading, barcode, data, findUser, isDoubleScan]);

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
          placeholder="Use your badge..."
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
