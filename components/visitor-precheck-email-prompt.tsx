"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import toast from "react-hot-toast";

const MODAL_TIMEOUT_SECONDS = 30;

export default function VisitorPrecheckEmailPrompt() {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(MODAL_TIMEOUT_SECONDS);

  const emailInputRef = useRef<HTMLInputElement>(null);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setEmail("");
    setIsSubmitting(false);
    setTimeLeft(MODAL_TIMEOUT_SECONDS);
  }, []);

  // Auto-focus the email input and auto-dismiss the modal after a timeout.
  useEffect(() => {
    if (!isOpen) return;

    setTimeLeft(MODAL_TIMEOUT_SECONDS);

    const focusTimer = window.setTimeout(() => {
      emailInputRef.current?.focus();
    }, 100);

    const interval = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          closeModal();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      window.clearTimeout(focusTimer);
      window.clearInterval(interval);
    };
  }, [isOpen, closeModal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/visitor/precheck/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        toast.error(errorData?.error || "Failed to send invite email.");
        return;
      }

      toast.success("Invite email sent. Check your inbox.");
      closeModal();
    } catch (err: any) {
      toast.error(err?.message || "Failed to send invite email.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="w-full max-w-md bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
      >
        Visitor? Get Pre-Check Link by Email
      </Button>
    );
  }

  return (
    <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-md dark:bg-gray-800">
      <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
        Send Visitor Pre-Check Link
      </h2>
      <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
        Enter your email and we&apos;ll send you a link to complete visitor pre-check
        before you arrive.
      </p>

      <div className="mb-3 text-xs text-gray-500 dark:text-gray-400">
        Auto-closes in {Math.floor(timeLeft / 60)}:
        {String(timeLeft % 60).padStart(2, "0")}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          type="email"
          placeholder="you@example.com"
          value={email}
          ref={emailInputRef}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div className="flex gap-2">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="flex-1"
          >
            {isSubmitting ? "Sending..." : "Send Link"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => {
              closeModal();
            }}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

