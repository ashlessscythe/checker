// components/CheckInOutForm.tsx
"use client";

import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import { db } from "@/lib/instantdb";
import toast, { Toaster } from "react-hot-toast";
import { useAutoFocus } from "@/hooks/useAutoFocus";
import { useAutoNavigate } from "@/hooks/useAutoNavigate";
import {
  CheckActionType,
  performCheckinOut,
  extractUserId,
  getMostReliablePunch,
} from "@/utils/checkInOut";
import SwipesModal from "./swipes-modal";

const DEBOUNCE_TIMEOUT =
  Number(process.env.NEXT_PUBLIC_DEBOUNCE_TIMEOUT) || 5000; // Default to 5 seconds if not set

// Add email validation function
const isValidEmail = (email: string) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

interface CheckInOutFormProps {
  shouldFocus: boolean;
}

export default function CheckInOutForm({ shouldFocus }: CheckInOutFormProps) {
  const [barcode, setBarcode] = useState("");
  const [lastScanTime, setLastScanTime] = useState(0);
  const [lastScannedBarcode, setLastScannedBarcode] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const inputRef = useAutoFocus(shouldFocus && !isModalOpen);

  // Define types for our data
  interface Punch {
    id: string;
    type: string;
    timestamp: number;
    serverCreatedAt: number;
  }

  interface User {
    id: string;
    barcode: string;
    name: string;
    purpose?: string;
    punches: Punch[];
  }

  // Query for users and punches with improved ordering
  // Note: InstantDB might not support multiple order fields in some versions
  // So we'll use a single order field for reliability
  const { isLoading, error, data } = db.useQuery({
    users: {},
    punches: {
      $: {
        order: {
          // Use serverCreatedAt as the primary sort field
          serverCreatedAt: "desc",
        },
      },
    },
  });

  // Always call hooks, but control their effect based on shouldFocus
  useAutoNavigate("/");
  // useAutoCheckout({ data }); // Keeping auto-checkout disabled

  // Clear barcode input after timeout
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (barcode) {
      timer = setTimeout(() => {
        setBarcode("");
      }, 5000);
    }
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [barcode]);

  // Handle timeout errors with retry
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (
      error?.message?.includes("timed out") ||
      error?.message?.includes("validation failed")
    ) {
      timer = setTimeout(() => {
        window.location.reload();
      }, 2000);
    }
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [error]);

  const findUser = useMemo(() => {
    if (!data?.users?.length) return null;
    const extractedId = extractUserId(barcode);
    const user = data.users.find((u) => u.barcode === extractedId);
    if (!user) return null;

    // Get user's punches with improved reliability
    const userPunches =
      data.punches
        ?.filter((punch) => punch.userId === user.id)
        // We'll use the sorting from the query, which prioritizes serverCreatedAt
        ?.slice(0, 50) || []; // Increased from 10 to 50 to get more historical data

    console.log("User:", user);
    console.log("Found punches:", userPunches);
    console.log(`Found ${userPunches.length} punches for user ${user.name}`);

    return {
      ...user,
      punches: userPunches,
    } as User;
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

    // Check if input is an email address
    if (isValidEmail(barcode)) {
      toast.error("That looks like an email address. \n\nPlease use the 'Log In' button in the upper right corner", {
        duration: 5000,
        style: {
          borderRadius: "10px",
          background: "#333",
          color: "#fff",
        },
      });
      setBarcode("");
      return;
    }

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

    try {
      await performCheckinOut(user);
      setBarcode("");
    } catch (error) {
      console.error("Error in handleCheckInOut:", error);
      if (error?.message?.includes("validation failed")) {
        window.location.reload();
      }
    }
  }, [isLoading, barcode, data, findUser, isDoubleScan]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return (
      <div className="text-center p-4">
        <div className="text-red-500 mb-2">Error: {error.message}</div>
        <div className="text-sm text-gray-600">Retrying in 2 seconds...</div>
      </div>
    );
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
        <div className="flex gap-2">
          <button
            onClick={handleCheckInOut}
            className="flex-1 bg-blue-500 text-white p-2 rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
          >
            Check In / Out
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex-1 bg-blue-500 text-white p-2 rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
          >
            View My Punches
          </button>
        </div>
      </div>
      <SwipesModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
