"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import toast, { Toaster } from "react-hot-toast";

type ReviewPayload =
  | { state: "approved"; message: string }
  | { state: "rejected"; message: string }
  | {
      state: "pending";
      token: string;
      visitorDisplayName: string;
      visitorEmail: string;
      visitorCompanyName: string;
      who: string;
      reason: string;
      otherDetails: string;
      whenFormatted: string;
      submittedFormatted: string;
      requestSourceLabel: string;
    };

type ReviewState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; data: ReviewPayload };

function HostReviewContent() {
  const searchParams = useSearchParams();
  const reviewToken = searchParams.get("t")?.trim() ?? "";

  const [review, setReview] = useState<ReviewState>({ phase: "loading" });
  const [messageDraft, setMessageDraft] = useState("");
  const [acting, setActing] = useState(false);
  const [doneOutcome, setDoneOutcome] = useState<null | "approved" | "rejected">(
    null
  );

  useEffect(() => {
    if (!reviewToken) {
      setReview({
        phase: "error",
        message:
          "This link is missing required information. Use the link from your email.",
      });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/visitor/precheck/host-review?t=${encodeURIComponent(reviewToken)}`
        );
        const json = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) {
          setReview({
            phase: "error",
            message: json?.error || "Could not load this visit request.",
          });
          return;
        }
        setReview({ phase: "ready", data: json as ReviewPayload });
      } catch {
        if (!cancelled) {
          setReview({
            phase: "error",
            message: "Network error. Try again in a moment.",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reviewToken]);

  const submitAction = async (action: "approve" | "reject") => {
    if (!reviewToken || review.phase !== "ready") return;
    if (review.data.state !== "pending") return;

    setActing(true);
    try {
      const res = await fetch("/api/visitor/precheck/host-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: review.data.token,
          action,
          message: messageDraft.trim(),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error || "Something went wrong.");
        return;
      }
      setDoneOutcome(action === "approve" ? "approved" : "rejected");
      toast.success(
        action === "approve"
          ? "Approved. The visitor will receive their check-in email."
          : "Declined. The visitor has been notified."
      );
    } catch {
      toast.error("Network error. Try again.");
    } finally {
      setActing(false);
    }
  };

  if (review.phase === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950">
        <p className="text-slate-700 dark:text-slate-200">Loading visit details…</p>
      </div>
    );
  }

  if (review.phase === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4 dark:bg-slate-950">
        <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
            Link not valid
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {review.message}
          </p>
        </div>
      </div>
    );
  }

  const data = review.data;

  if (data.state === "approved" || data.state === "rejected") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4 dark:bg-slate-950">
        <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
            {data.state === "approved" ? "Already approved" : "Already declined"}
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {data.message}
          </p>
        </div>
      </div>
    );
  }

  if (doneOutcome) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4 dark:bg-slate-950">
        <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
            {doneOutcome === "approved" ? "Thank you" : "Recorded"}
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {doneOutcome === "approved"
              ? "The visitor will receive an email with their kiosk QR code and pass."
              : "The visitor has been notified that this visit was not approved."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 py-10 px-4 dark:bg-slate-950">
      <div className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
          Visitor pre-check
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Review the request below. Approving or declining uses the same process as an
          administrator action: the visitor is emailed automatically.
        </p>

        <dl className="mt-6 space-y-3 rounded-lg border border-slate-100 bg-slate-50/80 p-4 text-sm dark:border-slate-700 dark:bg-slate-800/50">
          <div>
            <dt className="font-medium text-slate-500 dark:text-slate-400">Visitor</dt>
            <dd className="text-slate-900 dark:text-slate-100">
              {data.visitorDisplayName}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500 dark:text-slate-400">Email</dt>
            <dd className="break-all text-slate-900 dark:text-slate-100">
              {data.visitorEmail}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500 dark:text-slate-400">Company</dt>
            <dd className="text-slate-900 dark:text-slate-100">
              {data.visitorCompanyName || "—"}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500 dark:text-slate-400">
              Visiting (you / host)
            </dt>
            <dd className="text-slate-900 dark:text-slate-100">{data.who}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500 dark:text-slate-400">Reason</dt>
            <dd className="text-slate-900 dark:text-slate-100">{data.reason}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500 dark:text-slate-400">When</dt>
            <dd className="text-slate-900 dark:text-slate-100">{data.whenFormatted}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500 dark:text-slate-400">Submitted</dt>
            <dd className="text-slate-900 dark:text-slate-100">
              {data.submittedFormatted}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500 dark:text-slate-400">Origin</dt>
            <dd className="text-slate-900 dark:text-slate-100">
              {data.requestSourceLabel}
            </dd>
          </div>
          {data.otherDetails ? (
            <div>
              <dt className="font-medium text-slate-500 dark:text-slate-400">Details</dt>
              <dd className="text-slate-800 dark:text-slate-200">{data.otherDetails}</dd>
            </div>
          ) : null}
        </dl>

        <label className="mt-6 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Optional message to include in the visitor email
        </label>
        <Input
          className="mt-1"
          value={messageDraft}
          onChange={(e) => setMessageDraft(e.target.value)}
          placeholder="e.g. See you at reception at 2pm"
          disabled={acting}
        />

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
            disabled={acting}
            onClick={() => submitAction("reject")}
          >
            Decline visit
          </Button>
          <Button
            type="button"
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={acting}
            onClick={() => submitAction("approve")}
          >
            {acting ? "Working…" : "Approve visit"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function HostReviewPage() {
  return (
    <>
      <Toaster position="top-center" />
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950">
            <p className="text-slate-700 dark:text-slate-200">Loading…</p>
          </div>
        }
      >
        <HostReviewContent />
      </Suspense>
    </>
  );
}
