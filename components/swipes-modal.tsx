import React, { useCallback, useEffect, useState, useMemo, useRef } from "react";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { db } from "@/lib/instantdb";
import { extractUserId, getMostReliablePunch } from "@/utils/checkInOut";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { X, CreditCard, Clock, CheckCircle, XCircle, User } from "lucide-react";

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
  const modalRef = useRef<HTMLDivElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

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

  // Handle click outside to close modal
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('[role="listbox"]')) return;

      if (modalRef.current && !modalRef.current.contains(target)) {
        resetModal();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, resetModal]);

  // Focus barcode input when modal opens
  useEffect(() => {
    if (isOpen && barcodeInputRef.current && !userId) {
      setTimeout(() => barcodeInputRef.current?.focus(), 100);
    }
  }, [isOpen, userId]);

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


  if (!isOpen) return null;

  // Determine background color based on punch type
  const getPunchBackgroundColor = (type: string) => {
    if (
      type.includes("checkin") ||
      type.includes("admin_checkin") ||
      type.includes("sys_checkin")
    ) {
      return "bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800";
    } else if (
      type.includes("checkout") ||
      type.includes("admin_checkout") ||
      type.includes("sys_checkout")
    ) {
      return "bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800";
    }
    return "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700";
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div
        ref={modalRef}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b dark:border-gray-700">
          <div className="flex items-center gap-3">
            <CreditCard className="text-blue-600 dark:text-blue-400" size={24} />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">View My Swipes</h2>
          </div>
          <button
            onClick={resetModal}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {!userId ? (
            <div className="space-y-6">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <CreditCard size={16} />
                  Badge Scanner
                </label>
                <Input
                  ref={barcodeInputRef}
                  type="password"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleBarcodeSubmit();
                    }
                  }}
                  placeholder="Swipe your badge or enter barcode..."
                  className="text-center"
                />
              </div>
              
              <div className="text-center">
                <Button
                  onClick={handleBarcodeSubmit}
                  disabled={!barcode.trim() || isUserLoading}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isUserLoading ? "Loading..." : "View Swipes"}
                </Button>
              </div>
            </div>
          ) : isUserLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <Clock size={20} className="animate-spin" />
                <span>Loading your swipes...</span>
              </div>
            </div>
          ) : !userPunches.length ? (
            <div className="text-center py-8">
              <div className="flex flex-col items-center gap-3">
                <User className="text-gray-400 dark:text-gray-500" size={48} />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">No Recent Swipes</h3>
                <p className="text-gray-600 dark:text-gray-400">No swipe history found for this user.</p>
                <Button
                  onClick={() => {
                    setUserId(null);
                    setBarcode("");
                  }}
                  variant="outline"
                >
                  Try Another Badge
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Recent Swipes</h3>
                <Button
                  onClick={() => {
                    setUserId(null);
                    setBarcode("");
                  }}
                  variant="outline"
                  size="sm"
                >
                  New Search
                </Button>
              </div>
              
              <div className="space-y-3">
                {userPunches.map((punch) => (
                  <div
                    key={punch.id}
                    className={`flex items-center justify-between p-4 rounded-lg border ${getPunchBackgroundColor(
                      punch.type
                    )}`}
                  >
                    <div className="flex items-center gap-3">
                      {punch.type.includes("checkin") ? (
                        <CheckCircle className="text-green-600 dark:text-green-400" size={20} />
                      ) : (
                        <XCircle className="text-red-600 dark:text-red-400" size={20} />
                      )}
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {formatPunchType(punch.type)}
                        </div>
                        {(punch.isAdminGenerated || punch.isSystemGenerated) && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {punch.isAdminGenerated
                              ? "Admin generated"
                              : "System generated"}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {format(new Date(punch.timestamp), "MMM d")}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {format(new Date(punch.timestamp), "h:mm a")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
