// components/CheckInOutForm.tsx
"use client";

import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import { db } from "@/lib/instantdb";
import toast from "react-hot-toast";
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
  const [flashEffect, setFlashEffect] = useState<{ type: 'checkin' | 'checkout' | null; active: boolean }>({ type: null, active: false });
  const [successMessage, setSuccessMessage] = useState<{ type: 'checkin' | 'checkout' | null; user: string | null }>({ type: null, user: null });
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

  // Flash effect handler
  const triggerFlashEffect = useCallback((type: 'checkin' | 'checkout', userName: string) => {
    setFlashEffect({ type, active: true });
    setSuccessMessage({ type, user: userName });
    
    // Flash duration: 500ms
    setTimeout(() => {
      setFlashEffect({ type: null, active: false });
    }, 500);
    
    // Clear success message after 3 seconds
    setTimeout(() => {
      setSuccessMessage({ type: null, user: null });
    }, 3000);
  }, []);

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
      // Determine action type before performing the action
      const lastPunch = getMostReliablePunch(user.punches);
      let actionType: 'checkin' | 'checkout';
      
      if (!lastPunch) {
        actionType = 'checkin';
      } else {
        const lastPunchTime = new Date(lastPunch.timestamp).getTime();
        const currentTime = Date.now();
        const hoursSinceLastPunch = (currentTime - lastPunchTime) / (1000 * 60 * 60);
        const RESET_HOURS = parseInt(process.env.NEXT_PUBLIC_RESET_HOURS || "14", 10);
        
        if (hoursSinceLastPunch >= RESET_HOURS) {
          actionType = 'checkin';
        } else {
          // Check if last punch was a check-out type
          const checkOutTypes = new Set(['checkout', 'admin_checkout', 'sys_checkout']);
          actionType = checkOutTypes.has(lastPunch.type) ? 'checkin' : 'checkout';
        }
      }

      // Trigger flash effect based on action type
      triggerFlashEffect(actionType, user.name);
      
      await performCheckinOut(user);
      setBarcode("");
    } catch (error) {
      console.error("Error in handleCheckInOut:", error);
      if (error?.message?.includes("validation failed")) {
        window.location.reload();
      }
    }
  }, [isLoading, barcode, data, findUser, isDoubleScan, triggerFlashEffect]);

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
    <>
      {/* Full viewport flash effect */}
      {flashEffect.active && (
        <div
          className={`fixed inset-0 z-50 pointer-events-none ${
            flashEffect.type === 'checkin' 
              ? 'flash-checkin' 
              : 'flash-checkout'
          }`}
          aria-hidden="true"
          role="status"
          aria-live="polite"
        />
      )}
      
      {/* Success message overlay */}
      {successMessage.type && successMessage.user && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none">
          <div className={`px-8 py-6 rounded-2xl shadow-2xl border-4 ${
            successMessage.type === 'checkin'
              ? 'bg-green-500 border-green-600 text-white'
              : 'bg-red-500 border-red-600 text-white'
          }`}>
            <div className="text-center">
              <div className={`text-6xl mb-2 ${
                successMessage.type === 'checkin' ? 'text-green-100' : 'text-red-100'
              }`}>
                {successMessage.type === 'checkin' ? '✓' : '✗'}
              </div>
              <h2 className="text-2xl font-bold mb-1">
                {successMessage.type === 'checkin' ? 'CHECKED IN' : 'CHECKED OUT'}
              </h2>
              <p className="text-lg opacity-90">
                {successMessage.user}
              </p>
            </div>
          </div>
        </div>
      )}
      
      <div className="flex flex-col items-center">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md w-full max-w-md">
          <h1 className="text-2xl font-bold mb-6 text-center text-gray-800 dark:text-white">
            Check In / Check Out
          </h1>
          
          {/* Status indicator */}
          <div className="mb-4 p-3 rounded-lg bg-gray-100 dark:bg-gray-700 border-l-4 border-blue-500" role="status" aria-live="polite">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <span className="font-semibold">Status:</span> Ready to scan
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Place your badge near the scanner or type your ID
            </p>
          </div>
          
          {/* Action type indicator */}
          {barcode && findUser && (
            <div className="mb-4 p-3 rounded-lg border-2 border-dashed">
              {(() => {
                const lastPunch = getMostReliablePunch(findUser.punches);
                let actionType: 'checkin' | 'checkout';
                
                if (!lastPunch) {
                  actionType = 'checkin';
                } else {
                  const lastPunchTime = new Date(lastPunch.timestamp).getTime();
                  const currentTime = Date.now();
                  const hoursSinceLastPunch = (currentTime - lastPunchTime) / (1000 * 60 * 60);
                  const RESET_HOURS = parseInt(process.env.NEXT_PUBLIC_RESET_HOURS || "14", 10);
                  
                  if (hoursSinceLastPunch >= RESET_HOURS) {
                    actionType = 'checkin';
                  } else {
                    const checkOutTypes = new Set(['checkout', 'admin_checkout', 'sys_checkout']);
                    actionType = checkOutTypes.has(lastPunch.type) ? 'checkin' : 'checkout';
                  }
                }
                
                return (
                  <div className={`text-center p-2 rounded-lg ${
                    actionType === 'checkin' 
                      ? 'bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700' 
                      : 'bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700'
                  }`}>
                    <p className={`text-sm font-bold ${
                      actionType === 'checkin' 
                        ? 'text-green-800 dark:text-green-200' 
                        : 'text-red-800 dark:text-red-200'
                    }`}>
                      {actionType === 'checkin' ? '✓ CHECK IN' : '✗ CHECK OUT'}
                    </p>
                    <p className={`text-xs ${
                      actionType === 'checkin' 
                        ? 'text-green-600 dark:text-green-300' 
                        : 'text-red-600 dark:text-red-300'
                    }`}>
                      {actionType === 'checkin' 
                        ? 'User will be checked in' 
                        : 'User will be checked out'}
                    </p>
                  </div>
                );
              })()}
            </div>
          )}
          
          <div className="mb-4">
            <label htmlFor="barcode-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Badge/ID Scanner
            </label>
            <input
              ref={inputRef}
              type="password"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleCheckInOut()}
              onKeyDown={(e) => e.key === "Escape" && setBarcode("")}
              placeholder="Scan your badge or enter ID..."
              className="w-full p-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white dark:border-gray-600 dark:focus:border-blue-400 transition-colors"
            />
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={handleCheckInOut}
              className={`flex-1 p-3 rounded-lg font-medium transition-all duration-200 ${
                !barcode || isLoading
                  ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800'
              }`}
              disabled={!barcode || isLoading}
            >
              <span className="flex items-center justify-center gap-2">
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Process Badge
                  </>
                )}
              </span>
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex-1 bg-gray-600 text-white p-3 rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors font-medium"
            >
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                View History
              </span>
            </button>
          </div>
          

        </div>
        <SwipesModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      </div>
    </>
  );
}
