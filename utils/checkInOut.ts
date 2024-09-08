import { tx, id } from "@instantdb/react";
import { db } from "../lib/instantdb";
import toast, { Toaster } from "react-hot-toast";

export async function performCheckinOut(
    user: any,
    force?: 'checkin' | 'checkout',
) {

    if (!user) {
        toast.error("User not found");
        return;
    }

    // Get the last punch for this user
    const lastPunch = user.punches[0]; // The punches are already ordered by serverCreatedAt desc
    const isCheckIn = force ? force === 'checkin' : (!lastPunch || lastPunch.type === "checkout");

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
}