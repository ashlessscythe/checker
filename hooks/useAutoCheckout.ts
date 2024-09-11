// hooks/useAutoCheckout.ts
import { useState, useEffect } from "react";
import {
  checkInTypes,
  CheckActionType,
  performCheckinOut,
} from "../utils/checkInOut";

const CHECKOUT_INTERVAL =
  parseInt(process.env.NEXT_PUBLIC_CLEANUP_INTERVAL_MINUTES, 10) * 60 * 1000 ||
  10 * 60 * 1000; // 10 min in milliseconds
const MAX_CHECKIN_DURATION =
  parseInt(process.env.NEXT_PUBLIC_CLEANUP_HOURS, 10) * 60 * 60 * 1000 ||
  16 * 60 * 60 * 1000; // 16 hours in milliseconds

export function useAutoCheckout({ data }) {
  const [userData, setUserData] = useState(data);

  console.log(
    `checkout interval is ${CHECKOUT_INTERVAL} ms, max checkin duration is ${MAX_CHECKIN_DURATION} milliseconds`
  );

  useEffect(() => {
    setUserData(data);
  }, [data]);

  useEffect(() => {
    const checkAndForceCheckout = () => {
      const currentTime = Date.now();

      // Filter users first
      const usersToCheckout = userData.users.filter((user) => {
        const lastPunch = user.punches[0]; // Get the last punch

        if (!lastPunch) return false; // No punches, skip this user

        // Check if the last punch is a check-in (regular or admin)
        const isCheckedIn = checkInTypes.has(lastPunch.type);

        // Calculate time since last punch
        const timeSinceLastPunch =
          currentTime - new Date(lastPunch.timestamp).getTime();

        // Return true if user is checked in and has exceeded MAX_CHECKIN_DURATION
        return isCheckedIn && timeSinceLastPunch > MAX_CHECKIN_DURATION;
      });

      console.log(`Found ${usersToCheckout.length} users to auto-checkout`);

      // Process only the filtered users
      usersToCheckout.forEach((user) => {
        console.log(`Force checkout for user ${user.name}`);
        performCheckinOut(user, CheckActionType.SystemCheckOut);
      });
    };

    // Set up interval to run checkAndForceCheckout
    const intervalId = setInterval(checkAndForceCheckout, CHECKOUT_INTERVAL);

    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
  }, [userData, performCheckinOut]); // Add any other dependencies as needed
}
