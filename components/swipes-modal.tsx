import React, { useCallback, useEffect, useState, useMemo } from "react";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { db } from "@/lib/instantdb";
import { extractUserId, getMostReliablePunch } from "@/utils/checkInOut";

interface SwipesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface User {
  id: string;
  name: string;
  email: string;
  barcode: string;
  isAdmin: boolean;
  isAuth: boolean;
  lastLoginAt: number;
  createdAt: number;
  deptId: string;
  serverCreatedAt: number;
  laptopSerial: string;
  purpose: string;
}

interface Punch {
  id: string;
  type: string;
  timestamp: number;
  userId: string;
  serverCreatedAt: number;
  isAdminGenerated: boolean;
  isSystemGenerated: boolean;
}

export default function SwipesModal({ isOpen, onClose }: SwipesModalProps) {
  const [barcode, setBarcode] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [autoCloseTimer, setAutoCloseTimer] = useState<NodeJS.Timeout | null>(
    null
  );

  const resetModal = useCallback(() => {
    setBarcode("");
    setUserId(null);
    onClose();
  }, [onClose]);

  // Auto-close after 30 seconds
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(resetModal, 30000);
      setAutoCloseTimer(timer);
      return () => clearTimeout(timer);
    }
  }, [isOpen, resetModal]);

  // Fetch users first to isolate the issue
  const { data: userData, isLoading: isUserLoading, error } = db.useQuery({
    users: {},
    punches: {
      $: {
        order: {
          serverCreatedAt: "desc",
        },
      },
    },
  });

  // Debug: Log the data we're getting
  useEffect(() => {
    console.log("userData:", userData);
    console.log("isUserLoading:", isUserLoading);
    console.log("error:", error);
    if (error) {
      console.error("Database query error:", error);
    }
  }, [userData, isUserLoading, error]);

  const findUser = useMemo(() => {
    if (!userData) {
      console.log("No userData available");
      return null;
    }
    const extractedId = extractUserId(barcode);
    console.log("Looking for barcode:", extractedId, "Original barcode:", barcode);
    console.log("Available users:", userData.users);
    const user = userData.users.find((u) => u.barcode === extractedId);
    console.log("Found user:", user);
    return user;
  }, [userData, barcode]);

  const handleBarcodeSubmit = useCallback(async () => {
    console.log("handleBarcodeSubmit called with barcode:", barcode);
    if (isUserLoading || !barcode || !userData) {
      console.log("Early return - isUserLoading:", isUserLoading, "barcode:", barcode, "userData:", !!userData);
      return;
    }

    const user = findUser;
    if (!user) {
      console.log("User not found for barcode:", barcode);
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

    console.log("Setting userId:", user.id);
    setUserId(user.id);
    setBarcode("");
  }, [isUserLoading, barcode, userData, findUser]);

  // Get user's punches with improved reliability
  const userPunches = useMemo(() => {
    if (!userId || !userData?.punches) return [];

    // Filter punches for this user
    const filteredPunches = userData.punches.filter(
      (punch) => punch.userId === userId
    );

    // We'll use the sorting from the query, which prioritizes serverCreatedAt
    // but we'll also ensure we're getting the most recent 10 punches
    return filteredPunches.slice(0, 10);
  }, [userId, userData]);

  // Format the punch type for display
  const formatPunchType = (type: string) => {
    if (
      type.includes("checkin") ||
      type.includes("admin_checkin") ||
      type.includes("sys_checkin")
    ) {
      return "Check In";
    } else if (
      type.includes("checkout") ||
      type.includes("admin_checkout") ||
      type.includes("sys_checkout")
    ) {
      return "Check Out";
    }
    return type;
  };

  // Determine background color based on punch type
  const getPunchBackgroundColor = (type: string) => {
    if (
      type.includes("checkin") ||
      type.includes("admin_checkin") ||
      type.includes("sys_checkin")
    ) {
      return "bg-green-50";
    } else if (
      type.includes("checkout") ||
      type.includes("admin_checkout") ||
      type.includes("sys_checkout")
    ) {
      return "bg-red-50";
    }
    return "bg-gray-50";
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={resetModal}
    >
      <div
        className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">View My Swipes</h2>
          <button
            onClick={resetModal}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {!userId ? (
          <div className="space-y-4">
            <input
              type="password"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              onKeyDown={(e) => {
                console.log("Key pressed:", e.key);
                if (e.key === "Enter") {
                  console.log("Enter pressed, calling handleBarcodeSubmit");
                  handleBarcodeSubmit();
                }
              }}
              placeholder="Swipe your badge..."
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
        ) : isUserLoading ? (
          <div>Loading...</div>
        ) : !userPunches.length ? (
          <div>No recent swipes found</div>
        ) : (
          <div className="space-y-2">
            {userPunches.map((punch) => (
              <div
                key={punch.id}
                className={`flex justify-between items-center p-2 rounded ${getPunchBackgroundColor(
                  punch.type
                )}`}
              >
                <div className="flex flex-col">
                  <span className="font-medium">
                    {formatPunchType(punch.type)}
                  </span>
                  {(punch.isAdminGenerated || punch.isSystemGenerated) && (
                    <span className="text-xs text-gray-500">
                      {punch.isAdminGenerated
                        ? "Admin generated"
                        : "System generated"}
                    </span>
                  )}
                </div>
                <span className="text-gray-600">
                  {format(new Date(punch.timestamp), "MMM d, h:mm a")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
