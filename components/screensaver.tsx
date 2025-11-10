"use client";
import React, { useState, useEffect, useRef } from "react";

// Type definition for Wake Lock API
interface WakeLockSentinel extends EventTarget {
  released: boolean;
  type: "screen";
  release(): Promise<void>;
}

interface Navigator {
  wakeLock?: {
    request(type: "screen"): Promise<WakeLockSentinel>;
  };
}

interface ScreensaverProps {
  inactivityTimeout?: number; // Time in milliseconds before screensaver activates
  isAuthenticated?: boolean; // Only show screensaver when not authenticated
}

export default function Screensaver({
  inactivityTimeout = 30000,
  isAuthenticated = false,
}: ScreensaverProps) {
  const [isActive, setIsActive] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const velocityRef = useRef({ x: 2, y: 2 });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Reset inactivity timer
  const resetTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    // Only set timer if user is not authenticated
    if (!isAuthenticated) {
      timeoutRef.current = setTimeout(() => {
        setIsActive(true);
      }, inactivityTimeout);
    }
  };

  // Handle user activity
  const handleActivity = () => {
    if (isActive) {
      setIsActive(false);
      releaseWakeLock();
    }
    // Only reset timer if user is not authenticated
    if (!isAuthenticated) {
      resetTimer();
    }
  };

  // Request wake lock to prevent screen from sleeping
  const requestWakeLock = async () => {
    try {
      if ("wakeLock" in navigator) {
        const wakeLock = await (navigator as any).wakeLock.request("screen");
        wakeLockRef.current = wakeLock;

        // Handle wake lock release (e.g., when user switches tabs)
        wakeLock.addEventListener("release", () => {
          wakeLockRef.current = null;
          // Re-request wake lock if screensaver is still active
          if (isActive && !isAuthenticated) {
            requestWakeLock();
          }
        });
      }
    } catch (err) {
      // Wake Lock API not supported or permission denied
      console.log("Wake Lock API not available:", err);
    }
  };

  // Release wake lock
  const releaseWakeLock = async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      } catch (err) {
        console.log("Error releasing wake lock:", err);
      }
    }
  };

  // Disable screensaver if user becomes authenticated
  useEffect(() => {
    if (isAuthenticated && isActive) {
      setIsActive(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      releaseWakeLock();
    }
  }, [isAuthenticated, isActive]);

  // Initialize position and request wake lock when screensaver becomes active
  useEffect(() => {
    if (isActive && containerRef.current && textRef.current) {
      const container = containerRef.current;
      const text = textRef.current;
      setPosition({
        x: (container.clientWidth - text.offsetWidth) / 2,
        y: (container.clientHeight - text.offsetHeight) / 2,
      });
      velocityRef.current = { x: 2, y: 2 };
      // Request wake lock to prevent screen from sleeping
      requestWakeLock();

      // Re-request wake lock when page becomes visible again
      const handleVisibilityChange = () => {
        if (
          document.visibilityState === "visible" &&
          isActive &&
          !isAuthenticated
        ) {
          requestWakeLock();
        }
      };

      document.addEventListener("visibilitychange", handleVisibilityChange);

      return () => {
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange
        );
        releaseWakeLock();
      };
    } else if (!isActive) {
      // Release wake lock when screensaver is deactivated
      releaseWakeLock();
    }

    return () => {
      // Clean up wake lock on unmount
      releaseWakeLock();
    };
  }, [isActive, isAuthenticated]);

  // Set up activity listeners
  useEffect(() => {
    const events = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
      "click",
    ];

    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Initialize timer
    resetTimer();

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isActive, isAuthenticated]);

  // Animation loop
  useEffect(() => {
    if (!isActive || !containerRef.current || !textRef.current) {
      return;
    }

    const animate = () => {
      if (!containerRef.current || !textRef.current) {
        return;
      }

      const container = containerRef.current;
      const text = textRef.current;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      const textWidth = text.offsetWidth;
      const textHeight = text.offsetHeight;

      setPosition((prevPos) => {
        let newX = prevPos.x + velocityRef.current.x;
        let newY = prevPos.y + velocityRef.current.y;

        // Bounce off horizontal walls
        if (newX <= 0 || newX + textWidth >= containerWidth) {
          velocityRef.current.x = -velocityRef.current.x;
          newX = Math.max(0, Math.min(newX, containerWidth - textWidth));
        }

        // Bounce off vertical walls
        if (newY <= 0 || newY + textHeight >= containerHeight) {
          velocityRef.current.y = -velocityRef.current.y;
          newY = Math.max(0, Math.min(newY, containerHeight - textHeight));
        }

        return { x: newX, y: newY };
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isActive]);

  // Don't show screensaver if user is authenticated
  if (isAuthenticated || !isActive) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] bg-gray-900 dark:bg-black"
      onClick={handleActivity}
      onMouseMove={handleActivity}
      style={{ cursor: "none" }}
    >
      <div
        ref={textRef}
        className="absolute select-none text-6xl md:text-8xl font-bold text-white dark:text-white"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          transform: "translate(0, 0)",
          transition: "none",
          textShadow: "0 0 20px rgba(255, 255, 255, 0.5)",
        }}
      >
        checkin
      </div>
    </div>
  );
}
