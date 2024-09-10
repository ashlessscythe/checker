// hooks/useAutoNavigate.ts
import { useEffect } from "react";
import { useRouter } from "next/navigation"; // Updated import for App Router

export function useAutoNavigate(path: string, delay: number = 60000) {
  const router = useRouter();

  useEffect(() => {
    let timer: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        router.push(path);
      }, delay);
    };

    // Set up event listeners
    const events = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
    ];
    events.forEach((event) => {
      document.addEventListener(event, resetTimer);
    });

    // Initial timer setup
    resetTimer();

    // Clean up
    return () => {
      clearTimeout(timer);
      events.forEach((event) => {
        document.removeEventListener(event, resetTimer);
      });
    };
  }, [path, delay, router]);
}
