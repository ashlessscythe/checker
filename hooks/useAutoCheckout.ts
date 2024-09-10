// hooks/useAutoCheckout.ts
import { useState, useEffect } from "react";
import { performCheckinOut } from "../utils/checkInOut";

const CHECKOUT_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds
const MAX_CHECKIN_DURATION = 20 * 60 * 60 * 1000; // 20 hours in milliseconds

export function useAutoCheckout({ data }) {
  const [userData, setUserData] = useState(data);

  useEffect(() => {
    setUserData(data);
  }, [data]);

  useEffect(() => {
    const checkAndForceCheckout = () => {
      const currentTime = Date.now();

      // Filter users first
      const usersToCheckout = userData.users.filter(
        (user) =>
          user.punches[0] &&
          user.punches[0].type === "checkin" &&
          currentTime - new Date(user.punches[0].timestamp).getTime() >
            MAX_CHECKIN_DURATION
      );

      console.log(`found ${usersToCheckout.length} users`);

      // Process only the filtered users
      usersToCheckout.forEach((user) => {
        console.log(`Force checkout for user ${user.name}`);
        performCheckinOut(user, "checkout");
      });
    };

    const intervalId = setInterval(checkAndForceCheckout, CHECKOUT_INTERVAL);

    return () => clearInterval(intervalId);
  }, [userData]);
}
