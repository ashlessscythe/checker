// hooks/useAutoNavigate.ts
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function useAutoNavigate(path: string, delay: number = 5 * 60 * 1000, fullReload: boolean = false) {
  const router = useRouter();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      console.log(`AutoNavigate: Set to redirect to ${path} after ${delay}ms of inactivity. Full reload: ${fullReload}`);
      isFirstRender.current = false;
    }

    let timer: NodeJS.Timeout;
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        console.log(`AutoNavigate: Redirecting to ${path} due to inactivity`);
        if (fullReload) {
          window.location.href = path; // This will cause a full page reload`
        }
        router.push(path);
      }, delay);
    };

    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart"];
    events.forEach((event) => {
      document.addEventListener(event, resetTimer);
    });

    resetTimer();

    return () => {
      clearTimeout(timer);
      events.forEach((event) => {
        document.removeEventListener(event, resetTimer);
      });
    };
  }, [path, delay, router]);
}