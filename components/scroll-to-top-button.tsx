"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  minPageViewportHeights?: number;
  showAfterViewportHeights?: number;
};

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

function getViewportHeight() {
  return Math.max(1, window.innerHeight || 0);
}

function getDocHeight() {
  const el = document.documentElement;
  return Math.max(
    el.scrollHeight,
    el.offsetHeight,
    el.clientHeight,
    document.body?.scrollHeight ?? 0,
    document.body?.offsetHeight ?? 0
  );
}

export default function ScrollToTopButton({
  className,
  minPageViewportHeights = 3,
  showAfterViewportHeights = 1,
}: Props) {
  const [isEligible, setIsEligible] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const thresholds = useMemo(() => {
    const minDoc = minPageViewportHeights;
    const showAfter = showAfterViewportHeights;
    return { minDoc, showAfter };
  }, [minPageViewportHeights, showAfterViewportHeights]);

  useEffect(() => {
    let raf = 0;

    const recompute = () => {
      const vh = getViewportHeight();
      const doc = getDocHeight();
      const scrolled = window.scrollY || window.pageYOffset || 0;

      const eligible = doc > thresholds.minDoc * vh;
      setIsEligible(eligible);
      setIsVisible(eligible && scrolled > thresholds.showAfter * vh);
    };

    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(recompute);
    };

    // Initial + after layout settles (tab content, fonts, etc.)
    schedule();
    const t = window.setTimeout(schedule, 50);

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });

    return () => {
      window.clearTimeout(t);
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule as any);
      window.removeEventListener("resize", schedule as any);
    };
  }, [thresholds.minDoc, thresholds.showAfter]);

  if (!isEligible) return null;

  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 z-50 transition-opacity",
        isVisible ? "opacity-100" : "pointer-events-none opacity-0",
        className
      )}
    >
      <Button
        type="button"
        size="icon"
        variant="secondary"
        title="Back to top"
        aria-label="Back to top"
        className={cn(
          "h-11 w-11 rounded-full shadow-lg ring-1 ring-black/5 hover:shadow-xl dark:ring-white/10"
        )}
        onClick={() => {
          const behavior = prefersReducedMotion() ? "auto" : "smooth";
          window.scrollTo({ top: 0, left: 0, behavior });
        }}
      >
        <ArrowUp className="h-5 w-5" />
      </Button>
    </div>
  );
}

