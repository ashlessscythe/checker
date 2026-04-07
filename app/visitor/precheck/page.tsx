"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { db } from "@/lib/instantdb";
import { tx, id } from "@instantdb/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
// @ts-ignore - react-qr-code types are declared manually
import QRCode from "react-qr-code";
import toast, { Toaster } from "react-hot-toast";
import { formatVisitorPrecheckWhen } from "@/lib/visitor-precheck-datetime";
import {
  getPrecheckStrings,
  isPrecheckLocale,
  PRECHECK_LOCALE_OPTIONS,
  PRECHECK_LOCALE_STORAGE_KEY,
  type PrecheckLocale,
} from "@/lib/visitor-precheck-i18n";

interface VisitOption {
  id: string;
  category: string;
  label: string;
  isActive: boolean;
  sortOrder: number;
  hostEmail?: string;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toDateInputValue(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toTimeInputValue(ts: number) {
  const d = new Date(ts);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Pre-fill visit fields from token `iat`; if `requireFuture`, ensure result passes future-time validation. */
function visitTimestampFromTokenIat(iat: unknown, requireFuture: boolean): number {
  let iatMs =
    typeof iat === "number" && Number.isFinite(iat) && iat > 0 ? iat : NaN;
  if (Number.isFinite(iatMs) && iatMs < 1e12) {
    iatMs *= 1000;
  }
  const now = Date.now();
  let ts = Number.isFinite(iatMs) && iatMs > 0 ? iatMs : now;
  if (requireFuture && ts <= now) {
    ts = now + 60_000;
  }
  return ts;
}

function usePrecheckLocale(): readonly [PrecheckLocale, (l: PrecheckLocale) => void] {
  const [locale, setLocaleState] = useState<PrecheckLocale>("en-US");
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PRECHECK_LOCALE_STORAGE_KEY);
      if (raw && isPrecheckLocale(raw)) setLocaleState(raw);
    } catch {
      /* ignore */
    }
  }, []);
  const setLocale = useCallback((l: PrecheckLocale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(PRECHECK_LOCALE_STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);
  return [locale, setLocale] as const;
}

function PrecheckLanguageBar({
  locale,
  setLocale,
}: {
  locale: PrecheckLocale;
  setLocale: (l: PrecheckLocale) => void;
}) {
  return (
    <div className="pointer-events-auto fixed top-4 right-4 z-[100] max-w-[min(11rem,calc(100vw-2rem))]">
      <Select
        value={locale}
        onValueChange={(v) => {
          if (isPrecheckLocale(v)) setLocale(v);
        }}
      >
        <SelectTrigger
          className="h-9 w-full border-input bg-background text-xs shadow-md dark:bg-gray-900 md:hover:bg-accent md:hover:text-accent-foreground"
          aria-label="Language"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-md border border-border bg-background text-foreground shadow-lg dark:bg-gray-900 dark:text-gray-100">
          {PRECHECK_LOCALE_OPTIONS.map((o) => (
            <SelectItem
              key={o.value}
              value={o.value}
              className="md:hover:bg-accent md:hover:text-accent-foreground"
            >
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function VisitorPrecheckContent({ locale }: { locale: PrecheckLocale }) {
  const s = getPrecheckStrings(locale);
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [inviteEmail, setInviteEmail] = useState<string | null>(null);
  const [inviteName, setInviteName] = useState<string | null>(null);
  const [inviteSource, setInviteSource] = useState<
    "admin" | "kiosk_email" | "kiosk_register"
  >("kiosk_email");
  const [protocolRequired, setProtocolRequired] = useState(false);
  const [protocolAcknowledged, setProtocolAcknowledged] = useState(false);
  const [requestStatus, setRequestStatus] = useState<
    "pending" | "approved" | "rejected" | null
  >(null);
  // If token maps to an existing pending request, we hide the form after submit
  // and require "Edit again" to modify fields.
  const [showEditForm, setShowEditForm] = useState(true);
  const [requestBarcode, setRequestBarcode] = useState<string | null>(null);
  const [requestRejectionMessage, setRequestRejectionMessage] = useState<
    string | null
  >(null);
  const [requestAdminMessage, setRequestAdminMessage] = useState<string | null>(
    null
  );
  const [emailRateLimited, setEmailRateLimited] = useState(false);

  const [whoOptions, setWhoOptions] = useState<VisitOption[]>([]);
  const [whyOptions, setWhyOptions] = useState<VisitOption[]>([]);
  const [companyOptions, setCompanyOptions] = useState<VisitOption[]>([]);

  const [visitorFirstName, setVisitorFirstName] = useState("");
  const [visitorLastName, setVisitorLastName] = useState("");
  const [visitorCompanyName, setVisitorCompanyName] = useState("");
  const [company, setCompany] = useState("");
  const [companyOther, setCompanyOther] = useState("");

  const [who, setWho] = useState("");
  const [whoOther, setWhoOther] = useState("");
  const [why, setWhy] = useState("");
  const [whyOther, setWhyOther] = useState("");
  const [visitDate, setVisitDate] = useState("");
  const [visitTime, setVisitTime] = useState("");
  const [details, setDetails] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validateUserMessage, setValidateUserMessage] = useState<string | null>(null);

  useEffect(() => {
    async function validate() {
      if (!token) {
        setValidateUserMessage(null);
        setIsValid(false);
        setIsValidating(false);
        return;
      }

      try {
        // 1) Validate token first. If this succeeds, keep isValid=true
        // even if option loading fails for some reason.
        const res = await fetch("/api/visitor/precheck/validate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token }),
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => null);
          setValidateUserMessage(
            typeof errBody?.error === "string" ? errBody.error : null
          );
          setIsValid(false);
          setIsValidating(false);
          return;
        }

        setValidateUserMessage(null);
        const data = await res.json();
        setInviteEmail(data.email);
        setInviteName(data.name ?? data.email);
        setInviteSource(
          data.source === "admin"
            ? "admin"
            : data.source === "kiosk_register"
              ? "kiosk_register"
              : "kiosk_email"
        );
        setProtocolRequired(Boolean(data.protocolRequired));

        // Load any existing request for this token
        let req: any | null = null;
        try {
          const { data: reqData } = await db.queryOnce({
            visitorPrecheckRequests: {
              $: {
                where: { token },
              },
            },
          });
          req = reqData?.visitorPrecheckRequests?.[0] ?? null;
        } catch (reqErr) {
          console.error("Failed checking precheck request; proceeding.", reqErr);
        }

        // Always load visit options (needed to pre-select who/why labels)
        let who: VisitOption[] = [];
        let why: VisitOption[] = [];
        let companyOpts: VisitOption[] = [];
        try {
          const { data: optionsData } = await db.queryOnce({
            visitOptions: {
              $: {
                where: { isActive: true },
              },
            },
          });

          const options = (optionsData?.visitOptions || []) as VisitOption[];
          who = options
            .filter((o) => o.category === "who")
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
          why = options
            .filter((o) => o.category === "why")
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
          companyOpts = options
            .filter((o) => o.category === "company")
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        } catch (optErr) {
          console.error("Failed loading visitOptions; proceeding.", optErr);
        }

        setWhoOptions(who);
        setWhyOptions(why);
        setCompanyOptions(companyOpts);

        if (req) {
          setRequestStatus(req.status as any);
          setRequestBarcode(req.visitorBarcode || null);
          setRequestRejectionMessage(req.rejectionMessage || null);
          setRequestAdminMessage(req.adminMessage || null);

          // If pending, pre-fill form so visitor can edit.
          if (req.status === "pending") {
            const matchedWho = who.find((o) => o.label === req.who)?.label;
            if (matchedWho) {
              setWho(matchedWho);
              setWhoOther("");
            } else {
              setWho("Other");
              setWhoOther(req.who || "");
            }

            const matchedWhy = why.find((o) => o.label === req.reason)?.label;
            if (matchedWhy) {
              setWhy(matchedWhy);
              setWhyOther("");
            } else {
              setWhy("Other");
              setWhyOther(req.reason || "");
            }

            if (typeof req.visitDate === "number" && req.visitDate > 0) {
              setVisitDate(toDateInputValue(req.visitDate));
              setVisitTime(toTimeInputValue(req.visitDate));
            }
            setDetails(req.otherDetails || "");
            setVisitorFirstName(
              typeof req.visitorFirstName === "string" ? req.visitorFirstName : ""
            );
            setVisitorLastName(
              typeof req.visitorLastName === "string" ? req.visitorLastName : ""
            );
            const existingCompany =
              typeof req.visitorCompanyName === "string" ? req.visitorCompanyName : "";
            const matchedCompany = companyOpts.find(
              (o) => o.label === existingCompany
            )?.label;
            if (matchedCompany) {
              setCompany(matchedCompany);
              setCompanyOther("");
              setVisitorCompanyName(matchedCompany);
            } else {
              setCompany("Other");
              setCompanyOther(existingCompany || "");
              setVisitorCompanyName(existingCompany || "");
            }
            const reqProtocolRequired =
              typeof req.protocolRequired === "boolean"
                ? req.protocolRequired
                : Boolean(data.protocolRequired);
            setProtocolRequired(reqProtocolRequired);
            setProtocolAcknowledged(
              reqProtocolRequired
                ? typeof req.protocolAcknowledgedAt === "number" &&
                    req.protocolAcknowledgedAt > 0
                : false
            );

            // Hide form by default when request already exists pending.
            setShowEditForm(false);
            setEmailRateLimited(false);
          }
        }

        // Kiosk register: pre-fill visit from server (validate API uses admin read — reliable
        // even when the visitor client cannot read visitorPrecheckRequests). Fall back to now.
        if (data.source === "kiosk_register") {
          const pendingOrNoReq = !req || req.status === "pending";
          if (pendingOrNoReq) {
            const fromApi =
              typeof data.visitRecordAt === "number" && data.visitRecordAt > 0
                ? data.visitRecordAt
                : null;
            const fromReq =
              req &&
              typeof req.visitDate === "number" &&
              req.visitDate > 0
                ? req.visitDate
                : null;
            const n = fromApi ?? fromReq ?? Date.now();
            setVisitDate(toDateInputValue(n));
            setVisitTime(toTimeInputValue(n));
          }
        }

        // Admin / kiosk email: first visit (no saved row, or pending without visitDate) — pre-fill
        // date/time from token `iat` so fields aren't blank. Nudge to ~1 min ahead if `iat` is past
        // so "future visit" validation still passes.
        const needsVisitDefaultFromToken =
          data.source !== "kiosk_register" &&
          (!req ||
            req.status !== "pending" ||
            !(typeof req.visitDate === "number" && req.visitDate > 0));
        if (needsVisitDefaultFromToken) {
          const ts = visitTimestampFromTokenIat(data.iat, true);
          setVisitDate(toDateInputValue(ts));
          setVisitTime(toTimeInputValue(ts));
        }

        setIsValid(true);
      } catch (err) {
        console.error("Token validate failed", err);
        setValidateUserMessage(null);
        setIsValid(false);
      } finally {
        setIsValidating(false);
      }
    }

    validate();
  }, [token]);

  useEffect(() => {
    if (company === "Other") {
      setVisitorCompanyName(companyOther);
    } else if (company) {
      setVisitorCompanyName(company);
    }
  }, [company, companyOther]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    if (requestStatus === "approved" || requestStatus === "rejected") return;

    const fn = visitorFirstName.trim();
    const ln = visitorLastName.trim();
    const finalCompany = company === "Other" ? companyOther : company;
    const companyTrimmed = (finalCompany || "").trim();
    if (!fn || !ln) {
      toast.error(s.toastNameRequired);
      return;
    }
    if (!companyTrimmed) {
      toast.error(s.toastCompanyRequired);
      return;
    }

    if (!who || !why || !visitDate || !visitTime) {
      toast.error(s.toastCompleteRequired);
      return;
    }
    if (protocolRequired && !protocolAcknowledged) {
      toast.error(s.toastProtocol);
      return;
    }

    const when = new Date(`${visitDate}T${visitTime}`);
    const visitMs = when.getTime();
    if (isNaN(visitMs)) {
      toast.error(s.toastInvalidWhen);
      return;
    }
    if (inviteSource !== "kiosk_register" && visitMs < Date.now()) {
      toast.error(s.toastFutureWhen);
      return;
    }

    setIsSubmitting(true);

    try {
      const finalWho = who === "Other" ? whoOther || "Other" : who;
      const finalWhy = why === "Other" ? whyOther || "Other" : why;
      const visitTimestamp = visitMs;
      const now = Date.now();

      const reqId = id();

      // Upsert the request for this token (pending requests can be edited)
      const { data: existingReqData } = await db.queryOnce({
        visitorPrecheckRequests: {
          $: {
            where: { token },
          },
        },
      });
      const existing = existingReqData?.visitorPrecheckRequests?.[0];

      // Rate limit pending emails to 1 per minute per request token.
      const RATE_LIMIT_MS = 60 * 1000;
      const lastEmailCandidateAt =
        (existing?.lastUpdatedAt as number | undefined) ??
        (existing?.submittedAt as number | undefined) ??
        0;
      const shouldSendPendingEmail = !existing || now - lastEmailCandidateAt >= RATE_LIMIT_MS;

      if (existing) {
        if (existing.status !== "pending") {
          setRequestStatus(existing.status as any);
          toast.error(s.toastAlreadyProcessed);
          return;
        }

        await db.transact([
          tx.visitorPrecheckRequests[existing.id].update({
            visitorFirstName: fn,
            visitorLastName: ln,
            visitorCompanyName: companyTrimmed,
            who: finalWho,
            reason: finalWhy,
            otherDetails: details || "",
            visitDate: visitTimestamp,
            submittedAt: existing.submittedAt || now,
            lastUpdatedAt: now,
            // keep admin decision fields untouched for pending
            // keep request source/name untouched unless missing (older records)
            requestSource: existing.requestSource || inviteSource,
            invitedName: existing.invitedName || inviteName || inviteEmail,
            protocolRequired:
              typeof existing.protocolRequired === "boolean"
                ? existing.protocolRequired
                : protocolRequired,
            protocolAcknowledgedAt: protocolRequired ? now : 0,
          }),
        ]);
      } else {
        await db.transact([
          tx.visitorPrecheckRequests[reqId].update({
            token,
            email: inviteEmail,
            status: "pending",

            visitorFirstName: fn,
            visitorLastName: ln,
            visitorCompanyName: companyTrimmed,
            who: finalWho,
            reason: finalWhy,
            otherDetails: details || "",
            visitDate: visitTimestamp,

            submittedAt: now,
            approvedAt: 0,
            rejectedAt: 0,
            approvedBy: "",
            rejectedBy: "",
            adminMessage: "",
            rejectionMessage: "",

            visitorBarcode: "",
            visitorUserId: "",

            requestSource: inviteSource,
            invitedName: inviteName || inviteEmail,
            protocolRequired,
            protocolAcknowledgedAt: protocolRequired ? now : 0,

            createdAt: now,
            lastUpdatedAt: now,
          }),
        ]);
      }

      setEmailRateLimited(!shouldSendPendingEmail);
      setVisitorCompanyName(companyTrimmed);

      // Send/update email with the latest details while waiting for approval
      if (shouldSendPendingEmail) {
        await fetch("/api/visitor/precheck/send-pending-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: inviteEmail,
            token,
            visitorFirstName: fn,
            visitorLastName: ln,
            visitorCompanyName: companyTrimmed,
            who: finalWho,
            reason: finalWhy,
            whenTs: visitTimestamp,
            details: details || "",
            requestSource: inviteSource,
            invitedName: inviteName || inviteEmail,
            protocolRequired,
          }),
        }).catch(() => null);
      }

      const effectiveRequestId = existing?.id ?? reqId;
      await fetch("/api/visitor/precheck/notify-host", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: effectiveRequestId,
          precheckToken: token,
        }),
      }).catch(() => null);

      setRequestStatus("pending");
      setShowEditForm(false);
      toast.success(
        shouldSendPendingEmail ? s.toastSavedEmail : s.toastSavedRateLimit
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-200">{s.validating}</p>
      </div>
    );
  }

  if (!isValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800">
          <h1 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
            {s.invalidTitle}
          </h1>
          <p className="mb-2 text-sm text-gray-700 dark:text-gray-300">
            {validateUserMessage || s.invalidDefaultMessage}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {s.invalidContact}
          </p>
        </div>
      </div>
    );
  }

  // pending/initial states fall through to the editable form below

  if (requestStatus === "rejected") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800">
          <h1 className="mb-2 text-xl font-semibold text-red-600 dark:text-red-400">
            {s.rejectedTitle}
          </h1>
          <p className="mb-2 text-sm text-gray-700 dark:text-gray-300">
            {s.rejectedBody}
          </p>
          {requestRejectionMessage ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {s.rejectedNotePrefix} {requestRejectionMessage}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  if (requestStatus === "approved") {
    return (
      <div className="min-h-screen bg-gray-100 px-4 py-8 dark:bg-gray-900">
        <Toaster position="top-left" />
        <div className="mx-auto max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800 text-center space-y-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {s.approvedTitle}
          </h1>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {s.approvedSubtitle}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {s.approvedDone}
          </p>

          <div className="rounded-lg border border-dashed border-gray-400 bg-gray-50 px-4 py-4 dark:border-gray-600 dark:bg-gray-900">
            <p className="mb-2 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {s.visitorCode}
            </p>
            <p className="mb-3 select-all text-lg font-mono font-semibold text-gray-900 dark:text-white">
              {requestBarcode}
            </p>
            <div className="mx-auto inline-block rounded-md bg-white p-3 dark:bg-gray-800">
              <QRCode value={requestBarcode || ""} size={164} bgColor="transparent" fgColor="#111827" />
            </div>
          </div>

          {requestAdminMessage ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {s.adminNote} {requestAdminMessage}
            </p>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {s.approvedFooterScreenshot}
            </p>
          )}
        </div>
      </div>
    );
  }

  // When pending and showEditForm is false, hide the form and show a success message.
  if (requestStatus === "pending" && !showEditForm) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
        <div className="max-w-md w-full rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800 space-y-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {s.pendingSavedTitle}
          </h1>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {s.pendingSavedBody}
          </p>
          {emailRateLimited ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {s.pendingSavedRateLimit}
            </p>
          ) : null}
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {s.pendingSavedDone}
          </p>
          <div className="rounded border border-dashed border-gray-300 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200">
            <div>
              <span className="font-semibold">{s.labelVisitor}</span>{" "}
              {visitorFirstName.trim()} {visitorLastName.trim()}
            </div>
            <div>
              <span className="font-semibold">{s.labelCompany}</span>{" "}
              {visitorCompanyName.trim()}
            </div>
            <div>
              <span className="font-semibold">{s.labelVisiting}</span> {who}
            </div>
            <div>
              <span className="font-semibold">{s.labelReason}</span> {why}
            </div>
            {visitDate && visitTime ? (
              <div>
                <span className="font-semibold">{s.labelWhen}</span>{" "}
                {formatVisitorPrecheckWhen(
                  new Date(`${visitDate}T${visitTime}`).getTime(),
                  locale
                )}
              </div>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => {
                setShowEditForm(true);
                if (inviteSource === "kiosk_register") {
                  const n = Date.now();
                  setVisitDate(toDateInputValue(n));
                  setVisitTime(toTimeInputValue(n));
                }
              }}
            >
              {s.editAgain}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-8 dark:bg-gray-900">
      <Toaster position="top-left" />
      <div className="mx-auto max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800">
        <h1 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">
          {s.pageTitle}
        </h1>
        {requestStatus === "pending" ? (
          <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-100">
            {s.pendingBanner}
          </div>
        ) : null}
        <p className="mb-6 text-sm text-gray-700 dark:text-gray-300">
          {inviteSource === "kiosk_register"
            ? s.introKioskRegister
            : inviteSource === "kiosk_email"
              ? s.introKioskEmail
              : s.introAdmin}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg border border-blue-100 bg-blue-50/80 p-4 dark:border-blue-900/40 dark:bg-blue-950/30">
            <p className="mb-3 text-sm font-medium text-gray-900 dark:text-gray-100">
              {s.meetingHeader}{" "}
              <span className="text-red-500">{s.requiredStar}</span>
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                  {s.firstName}
                </label>
                <Input
                  autoComplete="given-name"
                  placeholder={s.firstName}
                  value={visitorFirstName}
                  onChange={(e) => setVisitorFirstName(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                  {s.lastName}
                </label>
                <Input
                  autoComplete="family-name"
                  placeholder={s.lastName}
                  value={visitorLastName}
                  onChange={(e) => setVisitorLastName(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                {s.companyLabel} <span className="text-red-500">{s.requiredStar}</span>
              </label>
              <Select value={company} onValueChange={setCompany}>
                <SelectTrigger>
                  <SelectValue placeholder={s.companyPlaceholder} />
                </SelectTrigger>
                <SelectContent className="border border-border shadow-md rounded-md text-foreground bg-background dark:bg-gray-800 dark:text-gray-100">
                  {companyOptions.map((opt) => (
                    <SelectItem
                      key={opt.id}
                      value={opt.label}
                      className="hover:bg-accent hover:text-accent-foreground dark:hover:bg-gray-700 dark:hover:text-white"
                    >
                      {opt.label}
                    </SelectItem>
                  ))}
                  <SelectItem
                    value="Other"
                    className="hover:bg-accent hover:text-accent-foreground dark:hover:bg-gray-700 dark:hover:text-white"
                  >
                    {s.otherOption}
                  </SelectItem>
                </SelectContent>
              </Select>
              {company === "Other" ? (
                <Input
                  className="mt-2"
                  autoComplete="organization"
                  placeholder={s.companyPlaceholder}
                  value={companyOther}
                  onChange={(e) => setCompanyOther(e.target.value)}
                />
              ) : null}
            </div>
          </div>

          {/* Who / Whom */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {s.whoVisiting} <span className="text-red-500">{s.requiredStar}</span>
            </label>
            <Select value={who} onValueChange={setWho}>
              <SelectTrigger>
                <SelectValue placeholder={s.whoPlaceholder} />
              </SelectTrigger>
              <SelectContent className="border border-border shadow-md rounded-md text-foreground bg-background dark:bg-gray-800 dark:text-gray-100">
                {whoOptions.map((opt) => (
                  <SelectItem
                    key={opt.id}
                    value={opt.label}
                    className="hover:bg-accent hover:text-accent-foreground dark:hover:bg-gray-700 dark:hover:text-white"
                  >
                    {opt.label}
                  </SelectItem>
                ))}
                <SelectItem
                  value="Other"
                  className="hover:bg-accent hover:text-accent-foreground dark:hover:bg-gray-700 dark:hover:text-white"
                >
                  {s.otherOption}
                </SelectItem>
              </SelectContent>
            </Select>
            {who === "Other" && (
              <Input
                className="mt-2"
                placeholder={s.whoOtherPlaceholder}
                value={whoOther}
                onChange={(e) => setWhoOther(e.target.value)}
              />
            )}
          </div>

          {/* Why */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {s.reasonVisit} <span className="text-red-500">{s.requiredStar}</span>
            </label>
            <Select value={why} onValueChange={setWhy}>
              <SelectTrigger>
                <SelectValue placeholder={s.reasonPlaceholder} />
              </SelectTrigger>
              <SelectContent className="border border-border shadow-md rounded-md text-foreground bg-background dark:bg-gray-800 dark:text-gray-100">
                {whyOptions.map((opt) => (
                  <SelectItem key={opt.id} value={opt.label} className="hover:bg-accent hover:text-accent-foreground dark:hover:bg-gray-700 dark:hover:text-white">
                    {opt.label}
                  </SelectItem>
                ))}
                <SelectItem value="Other">{s.otherOption}</SelectItem>
              </SelectContent>
            </Select>
            {why === "Other" && (
              <Input
                className="mt-2"
                placeholder={s.reasonOtherPlaceholder}
                value={whyOther}
                onChange={(e) => setWhyOther(e.target.value)}
              />
            )}
          </div>

          {/* When */}
          {inviteSource === "kiosk_register" ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {s.kioskRegisterDateHint}
            </p>
          ) : null}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {s.visitDate} <span className="text-red-500">{s.requiredStar}</span>
              </label>
              <Input
                type="date"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {s.visitTime} <span className="text-red-500">{s.requiredStar}</span>
              </label>
              <Input
                type="time"
                value={visitTime}
                onChange={(e) => setVisitTime(e.target.value)}
              />
            </div>
          </div>

          {/* Details */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {s.additionalDetails}
            </label>
            <textarea
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
          </div>

          {protocolRequired ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-900/20">
              <label className="flex items-start gap-2 text-sm text-gray-800 dark:text-gray-100">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={protocolAcknowledged}
                  onChange={(e) => setProtocolAcknowledged(e.target.checked)}
                />
                <span>{s.protocolCheckbox}</span>
              </label>
            </div>
          ) : null}

          <Button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 w-full"
          >
            {isSubmitting
              ? s.submitting
              : requestStatus === "pending"
              ? s.updatePrecheck
              : s.completePrecheck}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function VisitorPrecheckPage() {
  const [locale, setLocale] = usePrecheckLocale();
  const loadingStrings = getPrecheckStrings(locale);
  return (
    <div className="relative min-h-screen">
      <PrecheckLanguageBar locale={locale} setLocale={setLocale} />
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
            <p className="text-gray-700 dark:text-gray-200">
              {loadingStrings.loadingFallback}
            </p>
          </div>
        }
      >
        <VisitorPrecheckContent locale={locale} />
      </Suspense>
    </div>
  );
}

