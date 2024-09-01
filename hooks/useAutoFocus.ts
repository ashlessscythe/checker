// hooks/useAutoFocus.ts
import { useEffect, useRef, RefObject } from 'react';

export function useAutoFocus(ref: RefObject<HTMLElement>, delay: number | null) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (delay === null) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const focusElement = () => {
      if (ref.current && document.activeElement !== ref.current) {
        ref.current.focus();
      }
    };

    timerRef.current = setInterval(focusElement, delay);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [ref, delay]);
}