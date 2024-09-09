import { tx, id } from "@instantdb/react";
import { db } from "../lib/instantdb";
import toast, { Toaster } from "react-hot-toast";

// from .env 14 by default
const RESET_HOURS = parseInt(process.env.NEXT_PUBLIC_RESET_HOURS || "14", 10);

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
  let isCheckIn = force
    ? force === "checkin"
    : !lastPunch || lastPunch.type === "checkout";

  if (lastPunch) {
    const lastPunchTime = new Date(lastPunch.timestamp).getTime();
    const currentTime = Date.now();
    const hoursSinceLastPunch =
      (currentTime - lastPunch.timestamp) / (1000 * 60 * 60);
    console.log(
      `current time is ${currentTime} last punch: ${lastPunch.timestamp} hoursSinceLastPunch: ${hoursSinceLastPunch}`
    );

    if (hoursSinceLastPunch >= RESET_HOURS) {
      isCheckIn = true;
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
      duration: 3000,
      style: {
        borderRadius: "10px",
        background: "#333",
        color: "#fff",
      },
      icon: isCheckIn ? "✅" : "👋",
    });
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
}
