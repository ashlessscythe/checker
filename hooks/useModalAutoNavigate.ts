// hooks/useModalAutoNavigate.ts
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function useModalAutoNavigate(
  isOpen: boolean,
  path: string = "/",
  delay: number = 15 * 1000
) {
  const router = useRouter();

  useEffect(() => {
    if (!isOpen) return;

    let timer: NodeJS.Timeout;
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        console.log(
          `ModalAutoNavigate: Redirecting to ${path} due to inactivity`
        );
        window.location.href = path; // Full page reload
      }, delay);
    };

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

    resetTimer();

    return () => {
      clearTimeout(timer);
      events.forEach((event) => {
        document.removeEventListener(event, resetTimer);
      });
    };
  }, [isOpen, path, delay, router]);
}
