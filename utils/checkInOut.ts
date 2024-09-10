import { tx, id } from "@instantdb/react";
import { db } from "../lib/instantdb";
import toast, { Toaster } from "react-hot-toast";

// from .env 14 by default
const RESET_HOURS = parseInt(process.env.NEXT_PUBLIC_RESET_HOURS || "14", 10);

// Define base toast style
const baseToastStyle = {
  style: {
    padding: "16px",
    borderRadius: "10px",
    fontSize: "20px",
    maxWidth: "500px",
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
  },
  duration: 3000,
};

// Define color schemes with better contrast
const checkInColors = {
  background: "#d1fae5", // Very light green background
  color: "#065f46", // Dark green text
  border: "2px solid #059669", // Medium green border
};

const checkOutColors = {
  background: "#fee2e2", // Very light red background
  color: "#991b1b", // Dark red text
  border: "2px solid #dc2626", // Medium red border
};

const errorColors = {
  background: "#fef2f2", // Very light red background
  color: "#7f1d1d", // Dark red text
  border: "2px solid #b91c1c", // Medium red border
};

export async function performCheckinOut(
  user: any,
  force?: "checkin" | "checkout"
) {
  if (!user) {
    toast.error("User not found");
    return;
  }

  // Get the last punch for this user
  const lastPunch = user.punches[0]; // The punches are already ordered by serverCreatedAt desc
  console.log(
    `performcheckinout: last punch for user ${user.name} is ${JSON.stringify(
      lastPunch
    )}`
  );
  let isCheckIn: boolean;

  if (force) {
    // If force is provided, use it regardless of lastPunch
    isCheckIn = force === "checkin";
  } else if (!lastPunch) {
    // If no lastPunch and no force, default to check-in
    isCheckIn = true;
  } else {
    // If lastPunch exists and no force, toggle based on last punch type
    isCheckIn = lastPunch.type === "checkout";
  }
  console.log(`Determined action: ${isCheckIn ? "checkin" : "checkout"}`);
  const colors = isCheckIn ? checkInColors : checkOutColors;

  if (lastPunch) {
    const lastPunchTime = new Date(lastPunch.timestamp).getTime();
    const currentTime = Date.now();
    const hoursSinceLastPunch =
      (currentTime - lastPunchTime) / (1000 * 60 * 60);
    console.log(
      `current time is ${currentTime} last punch: ${lastPunchTime} hoursSinceLastPunch: ${hoursSinceLastPunch}`
    );

    if (!force) {
      // ignore if force is provided
      if (hoursSinceLastPunch >= RESET_HOURS) {
        isCheckIn = true;
      }
    }
  }

  try {
    const newPunchId = id();
    await db.transact([
      tx.punches[newPunchId].update({
        type: isCheckIn ? "checkin" : "checkout",
        timestamp: Date.now(),
      }),
      tx.users[user.id].link({ punches: newPunchId }),
    ]);

    toast.success(`${user.name}: ${isCheckIn ? "checked in" : "checked out"}`, {
      ...baseToastStyle,
      icon: isCheckIn ? "✅" : "👋",
      style: {
        ...baseToastStyle.style,
        ...colors,
        animation: "pop-up 0.5s ease-out",
      },
    });
  } catch (error) {
    toast.error("An error occurred. Please try again.", {
      ...baseToastStyle,
      icon: "❌",
      style: {
        ...baseToastStyle.style,
        ...errorColors,
        animation: "shake 0.5s ease-in-out",
      },
    });
    console.error("Check-in/out error:", error);
  }
}
