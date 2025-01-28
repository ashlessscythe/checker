// hooks/useAutoFocus.ts
import { useEffect, useRef } from "react";

export function useAutoFocus(
  shouldFocus: boolean,
  delay: number = 3000
): React.RefObject<HTMLInputElement> {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (shouldFocus) {
      intervalId = setInterval(() => {
        const activeElement = document.activeElement;
        // Only force focus if no input/textarea is currently focused
        if (
          ref.current &&
          (!activeElement ||
            (activeElement.tagName !== "INPUT" &&
              activeElement.tagName !== "TEXTAREA") ||
            activeElement === document.body)
        ) {
          ref.current.focus();
        }
      }, delay);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [shouldFocus, delay]);

  return ref;
}
