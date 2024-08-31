// hooks/useAutoFocus.ts
import { useEffect, RefObject } from 'react';

export function useAutoFocus(ref: RefObject<HTMLElement>, delay: number = 5000) {
  useEffect(() => {
    const timer = setInterval(() => {
      if (ref.current && document.activeElement !== ref.current) {
        ref.current.focus();
      }
    }, delay);

    return () => clearInterval(timer);
  }, [ref, delay]);
}