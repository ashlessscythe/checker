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
        if (ref.current && document.activeElement !== ref.current) {
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
