import React, { useCallback, useEffect, useState, useMemo } from "react";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { db } from "@/lib/instantdb";
import { extractUserId } from "@/utils/checkInOut";

interface SwipesModalProps {
  isOpen: boolean;
  onClose: () => void;
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

  // Fetch users with their punches for barcode lookup
  const { data: userData, isLoading: isUserLoading } = db.useQuery({
    users: {
      punches: {
        $: {
          first: 10,
          order: {
            serverCreatedAt: "desc",
          },
        },
      },
    },
  });

  const findUser = useMemo(() => {
    if (!userData) return null;
    const extractedId = extractUserId(barcode);
    console.log("Looking for barcode:", extractedId);
    const user = userData.users.find((u) => u.barcode === extractedId);
    console.log("Found user:", user);
    return user;
  }, [userData, barcode]);

  const handleBarcodeSubmit = useCallback(async () => {
    if (isUserLoading || !barcode || !userData) return;

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

    console.log("Setting userId:", user.id, "with punches:", user.punches);
    setUserId(user.id);
    setBarcode("");
  }, [isUserLoading, barcode, userData, findUser]);

  if (!isOpen) return null;

  // Find the user with their punches in the userData
  const userWithPunches = userId
    ? userData?.users.find((u) => u.id === userId)
    : null;
  console.log("Current user with punches:", userWithPunches);

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
              onKeyPress={(e) => e.key === "Enter" && handleBarcodeSubmit()}
              placeholder="Swipe your badge..."
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
        ) : isUserLoading ? (
          <div>Loading...</div>
        ) : !userWithPunches?.punches?.length ? (
          <div>No recent swipes found</div>
        ) : (
          <div className="space-y-2">
            {userWithPunches.punches.map((punch) => (
              <div
                key={punch.id}
                className={`flex justify-between items-center p-2 rounded ${
                  punch.type === "checkin" ? "bg-green-50" : "bg-red-50"
                }`}
              >
                <span className="font-medium">
                  {punch.type === "checkin" ? "Check In" : "Check Out"}
                </span>
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
