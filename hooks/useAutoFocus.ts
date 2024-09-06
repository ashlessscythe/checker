// hooks/useAutoFocus.ts
import { useEffect, useRef } from "react";

export function useAutoFocus(
  shouldFocus: boolean,
  delay: number = 5000
): React.RefObject<HTMLInputElement> {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (shouldFocus) {
      timeoutId = setTimeout(() => {
        ref.current?.focus();
      }, delay);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [shouldFocus, delay]);

  return ref;
}
