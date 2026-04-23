"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getPrecheckStrings } from "@/lib/visitor-precheck-i18n";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import toast from "react-hot-toast";
import { db } from "@/lib/instantdb";
import {
  KIOSK_LOBBY_SETTINGS_KEY,
  isVisitorGuestCheckInEnabled,
} from "@/lib/kiosk-lobby-settings";

const EMAIL_MODAL_TIMEOUT_SECONDS = 30;
const CHOOSE_MODAL_TIMEOUT_SECONDS = 60;

/** Radix Select highlights via data-[highlighted] (mouse + keyboard), not CSS :hover on the row alone */
const KIOSK_SELECT_ITEM =
  "cursor-pointer outline-none data-[highlighted]:bg-emerald-100 data-[highlighted]:text-emerald-950 dark:data-[highlighted]:bg-emerald-900/50 dark:data-[highlighted]:text-emerald-50";

type Phase = "closed" | "choose" | "email" | "register";

interface VisitOption {
  id: string;
  category: string;
  label: string;
  isActive: boolean;
  sortOrder: number;
  hostEmail?: string;
}

const kioskPrecheckStrings = getPrecheckStrings("en-US");

export default function VisitorPrecheckEmailPrompt() {
  const [phase, setPhase] = useState<Phase>("closed");
  const [email, setEmail] = useState("");
  const [isSubmittingEmail, setIsSubmittingEmail] = useState(false);
  const [emailTimeLeft, setEmailTimeLeft] = useState(
    EMAIL_MODAL_TIMEOUT_SECONDS
  );
  const [chooseTimeLeft, setChooseTimeLeft] = useState(
    CHOOSE_MODAL_TIMEOUT_SECONDS
  );

  const [regEmail, setRegEmail] = useState("");
  const [visitorFirstName, setVisitorFirstName] = useState("");
  const [visitorLastName, setVisitorLastName] = useState("");
  const [visitorCompanyName, setVisitorCompanyName] = useState("");
  const [company, setCompany] = useState("");
  const [companyOther, setCompanyOther] = useState("");
  const [who, setWho] = useState("");
  const [whoOther, setWhoOther] = useState("");
  const [why, setWhy] = useState("");
  const [whyOther, setWhyOther] = useState("");
  /** Free-text when admin has not configured "who" visit options */
  const [whoText, setWhoText] = useState("");
  /** Free-text when admin has not configured "why" visit options */
  const [whyText, setWhyText] = useState("");
  const [details, setDetails] = useState("");
  const [isSubmittingRegister, setIsSubmittingRegister] = useState(false);
  const [kioskProtocolRequired, setKioskProtocolRequired] = useState(false);
  const [protocolAcknowledged, setProtocolAcknowledged] = useState(false);
  const [protocolViewTicket, setProtocolViewTicket] = useState<string | null>(null);
  /** Kiosk protocol link: idle (no protocol), loading, ready (href), or error */
  const [protocolDocLinkState, setProtocolDocLinkState] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");

  const emailInputRef = useRef<HTMLInputElement>(null);

  // Match visitor admin query shape (`$: {}`); boolean `where` on useQuery can be unreliable.
  // Filter active options client-side (same result as pre-check page).
  const {
    data: optionsData,
    isLoading: optionsLoading,
    error: optionsError,
  } = db.useQuery({
    visitOptions: {
      $: {},
    },
  });

  const { data: lobbyData } = db.useQuery({
    kioskLobbySettings: {
      $: { where: { key: KIOSK_LOBBY_SETTINGS_KEY } },
    },
  });
  const guestLobbyEnabled = isVisitorGuestCheckInEnabled(
    lobbyData?.kioskLobbySettings
  );

  const { whoOptions, whyOptions, companyOptions } = useMemo(() => {
    const options = (optionsData?.visitOptions || []) as VisitOption[];
    const active = options.filter((o) => o.isActive !== false);
    const who = active
      .filter((o) => o.category === "who")
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const why = active
      .filter((o) => o.category === "why")
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const company = active
      .filter((o) => o.category === "company")
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    return { whoOptions: who, whyOptions: why, companyOptions: company };
  }, [optionsData?.visitOptions]);

  const whoSelectMode = !optionsLoading && whoOptions.length > 0;
  const whySelectMode = !optionsLoading && whyOptions.length > 0;
  const companySelectMode = !optionsLoading && companyOptions.length > 0;

  const resetAll = useCallback(() => {
    setPhase("closed");
    setEmail("");
    setIsSubmittingEmail(false);
    setEmailTimeLeft(EMAIL_MODAL_TIMEOUT_SECONDS);
    setChooseTimeLeft(CHOOSE_MODAL_TIMEOUT_SECONDS);
    setRegEmail("");
    setVisitorFirstName("");
    setVisitorLastName("");
    setVisitorCompanyName("");
    setCompany("");
    setCompanyOther("");
    setWho("");
    setWhoOther("");
    setWhy("");
    setWhyOther("");
    setWhoText("");
    setWhyText("");
    setDetails("");
    setIsSubmittingRegister(false);
    setKioskProtocolRequired(false);
    setProtocolAcknowledged(false);
    setProtocolViewTicket(null);
    setProtocolDocLinkState("idle");
  }, []);

  useEffect(() => {
    if (phase !== "register") return;
    if (company === "Other") {
      setVisitorCompanyName(companyOther);
    } else if (company) {
      setVisitorCompanyName(company);
    }
  }, [phase, company, companyOther]);

  useEffect(() => {
    if (phase !== "choose") return;

    setChooseTimeLeft(CHOOSE_MODAL_TIMEOUT_SECONDS);
    const interval = window.setInterval(() => {
      setChooseTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          resetAll();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [phase, resetAll]);

  useEffect(() => {
    if (phase !== "email") return;

    setEmailTimeLeft(EMAIL_MODAL_TIMEOUT_SECONDS);
    const focusTimer = window.setTimeout(() => {
      emailInputRef.current?.focus();
    }, 100);

    const interval = window.setInterval(() => {
      setEmailTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          resetAll();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      window.clearTimeout(focusTimer);
      window.clearInterval(interval);
    };
  }, [phase, resetAll]);

  useEffect(() => {
    if (phase !== "register") {
      setKioskProtocolRequired(false);
      setProtocolAcknowledged(false);
      setProtocolViewTicket(null);
      setProtocolDocLinkState("idle");
      return;
    }

    let cancelled = false;
    setProtocolAcknowledged(false);
    setProtocolViewTicket(null);
    setProtocolDocLinkState("loading");

    (async () => {
      let protocolWasRequired = false;
      try {
        const statusRes = await fetch("/api/visitor/precheck/protocol-status");
        const statusData = await statusRes.json().catch(() => ({}));
        if (cancelled) return;

        if (!statusRes.ok || statusData?.requiresVisitorProtocol !== true) {
          setKioskProtocolRequired(false);
          setProtocolDocLinkState("idle");
          return;
        }

        protocolWasRequired = true;
        setKioskProtocolRequired(true);

        const ticketRes = await fetch("/api/visitor/precheck/protocol-view-ticket", {
          method: "POST",
        });
        const ticketData = await ticketRes.json().catch(() => ({}));
        if (cancelled) return;

        if (ticketRes.ok && typeof ticketData?.ticket === "string") {
          setProtocolViewTicket(ticketData.ticket);
          setProtocolDocLinkState("ready");
        } else {
          setProtocolViewTicket(null);
          setProtocolDocLinkState("error");
        }
      } catch {
        if (!cancelled) {
          setProtocolViewTicket(null);
          if (protocolWasRequired) {
            setProtocolDocLinkState("error");
          } else {
            setKioskProtocolRequired(false);
            setProtocolDocLinkState("idle");
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [phase]);

  useEffect(() => {
    if (phase === "closed") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") resetAll();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, resetAll]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }

    setIsSubmittingEmail(true);
    try {
      const res = await fetch("/api/visitor/precheck/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, source: "kiosk_email" }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        toast.error(errorData?.error || "Failed to send invite email.");
        return;
      }

      toast.success("Link sent. Check your inbox.");
      resetAll();
    } catch (err: any) {
      toast.error(err?.message || "Failed to send invite email.");
    } finally {
      setIsSubmittingEmail(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fn = visitorFirstName.trim();
    const ln = visitorLastName.trim();
    const finalCompany = (company === "Other" ? companyOther : company).trim();
    const em = regEmail.trim().toLowerCase();

    if (!fn || !ln) {
      toast.error("Please enter your first and last name.");
      return;
    }
    if (!finalCompany) {
      toast.error("Please enter your company name.");
      return;
    }
    if (!em || !em.includes("@")) {
      toast.error("Please enter a valid email for updates.");
      return;
    }

    let finalWho: string;
    if (whoSelectMode) {
      if (!who) {
        toast.error("Please select who you are visiting.");
        return;
      }
      finalWho = who === "Other" ? whoOther.trim() || "Other" : who;
      if (who === "Other" && !whoOther.trim()) {
        toast.error("Please enter who you are visiting.");
        return;
      }
    } else {
      finalWho = whoText.trim();
      if (!finalWho) {
        toast.error("Please enter who you are visiting.");
        return;
      }
    }

    let finalWhy: string;
    if (whySelectMode) {
      if (!why) {
        toast.error("Please select the reason for your visit.");
        return;
      }
      finalWhy = why === "Other" ? whyOther.trim() || "Other" : why;
      if (why === "Other" && !whyOther.trim()) {
        toast.error("Please enter the reason for your visit.");
        return;
      }
    } else {
      finalWhy = whyText.trim();
      if (!finalWhy) {
        toast.error("Please enter the reason for your visit.");
        return;
      }
    }

    if (kioskProtocolRequired && !protocolAcknowledged) {
      toast.error("Please acknowledge the visitor protocol.");
      return;
    }

    setIsSubmittingRegister(true);
    try {
      const res = await fetch("/api/visitor/precheck/kiosk-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: em,
          visitorFirstName: fn,
          visitorLastName: ln,
          visitorCompanyName: finalCompany,
          who: finalWho,
          reason: finalWhy,
          otherDetails: details.trim(),
          protocolAcknowledged: kioskProtocolRequired
            ? protocolAcknowledged
            : false,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        toast.error(errorData?.error || "Registration failed.");
        return;
      }

      toast.success(
        "Request submitted. Check your email to confirm or edit details. Staff must approve before you can check in."
      );
      resetAll();
    } catch (err: any) {
      toast.error(err?.message || "Registration failed.");
    } finally {
      setIsSubmittingRegister(false);
    }
  };

  if (phase === "closed") {
    if (!guestLobbyEnabled) {
      return (
        <div className="w-full max-w-md rounded-lg border border-gray-200 bg-gray-100 px-4 py-3 text-center text-sm text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
          Visitor self-registration is turned off. Ask staff if you need help.
        </div>
      );
    }
    return (
      <Button
        onClick={() => setPhase("choose")}
        className="w-full max-w-md bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
      >
        Visitor? Register here
      </Button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="visitor-precheck-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) resetAll();
      }}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-4 shadow-xl dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="visitor-precheck-modal-title"
          className="mb-3 text-lg font-semibold text-gray-900 dark:text-white"
        >
          {phase === "choose" && "How would you like to pre-check?"}
          {phase === "email" && "Get a link by email"}
          {phase === "register" && "Register on this device"}
        </h2>

        {phase === "choose" && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Choose one: we can email you a link to open on your phone, or you
              can enter your visit details here on this screen. Both require
              staff approval before check-in.
            </p>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Auto-closes in {Math.floor(chooseTimeLeft / 60)}:
              {String(chooseTimeLeft % 60).padStart(2, "0")}
            </div>
            <Button
              type="button"
              className="w-full bg-green-600 hover:bg-green-700"
              onClick={() => setPhase("email")}
            >
              Get link by email
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full border-green-700 text-green-800 hover:bg-green-50 dark:border-green-600 dark:text-green-200 dark:hover:bg-green-950/40"
              onClick={() => setPhase("register")}
            >
              Register here (this device)
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={resetAll}
            >
              Cancel
            </Button>
          </div>
        )}

        {phase === "email" && (
          <>
            <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
              We&apos;ll send a link to complete visitor pre-check. The message
              is different from staff-sent invitations and is meant for the
              lobby kiosk flow.
            </p>
            <div className="mb-3 text-xs text-gray-500 dark:text-gray-400">
              Auto-closes in {Math.floor(emailTimeLeft / 60)}:
              {String(emailTimeLeft % 60).padStart(2, "0")}
            </div>
            <form onSubmit={handleEmailSubmit} className="space-y-3">
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
                  disabled={isSubmittingEmail}
                  className="flex-1"
                >
                  {isSubmittingEmail ? "Sending..." : "Send link"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setPhase("choose")}
                  disabled={isSubmittingEmail}
                >
                  Back
                </Button>
              </div>
            </form>
          </>
        )}

        {phase === "register" && (
          <form onSubmit={handleRegisterSubmit} className="space-y-3">
            {optionsError ? (
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Could not load visit options. Use the text fields below, or try
                again.
              </p>
            ) : null}
            {optionsLoading ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Loading visit options… You can fill your name and email while we
                load.
              </p>
            ) : null}
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Your visit time is recorded as <strong>right now</strong> (when
              you submit). Use the email field for approval updates and your
              edit link.
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Input
                placeholder="First name"
                value={visitorFirstName}
                onChange={(e) => setVisitorFirstName(e.target.value)}
                autoComplete="given-name"
              />
              <Input
                placeholder="Last name"
                value={visitorLastName}
                onChange={(e) => setVisitorLastName(e.target.value)}
                autoComplete="family-name"
              />
            </div>
            {companySelectMode ? (
              <div>
                <Select value={company} onValueChange={setCompany}>
                  <SelectTrigger>
                    <SelectValue placeholder="Company" />
                  </SelectTrigger>
                  <SelectContent
                    className="z-[200] border border-border bg-background text-foreground shadow-md dark:bg-gray-800 dark:text-gray-100"
                    position="popper"
                  >
                    {companyOptions.map((opt) => (
                      <SelectItem
                        key={opt.id}
                        value={opt.label}
                        className={KIOSK_SELECT_ITEM}
                      >
                        {opt.label}
                      </SelectItem>
                    ))}
                    <SelectItem value="Other" className={KIOSK_SELECT_ITEM}>
                      Other
                    </SelectItem>
                  </SelectContent>
                </Select>
                {company === "Other" ? (
                  <Input
                    className="mt-2"
                    placeholder="Company (if other)"
                    value={companyOther}
                    onChange={(e) => setCompanyOther(e.target.value)}
                    autoComplete="organization"
                  />
                ) : null}
              </div>
            ) : (
              <Input
                placeholder="Company"
                value={visitorCompanyName}
                onChange={(e) => setVisitorCompanyName(e.target.value)}
                autoComplete="organization"
              />
            )}
            <Input
              type="email"
              placeholder="Email (for notifications)"
              value={regEmail}
              onChange={(e) => setRegEmail(e.target.value)}
              autoComplete="email"
            />
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                Who are you visiting?
              </label>
              {whoSelectMode ? (
                <>
                  <Select value={who} onValueChange={setWho}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent
                      className="z-[200] border border-border bg-background text-foreground shadow-md dark:bg-gray-800 dark:text-gray-100"
                      position="popper"
                    >
                      {whoOptions.map((opt) => (
                        <SelectItem
                          key={opt.id}
                          value={opt.label}
                          className={KIOSK_SELECT_ITEM}
                        >
                          {opt.label}
                        </SelectItem>
                      ))}
                      <SelectItem value="Other" className={KIOSK_SELECT_ITEM}>
                        Other
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {who === "Other" && (
                    <Input
                      className="mt-2"
                      placeholder="Who (if other)"
                      value={whoOther}
                      onChange={(e) => setWhoOther(e.target.value)}
                    />
                  )}
                </>
              ) : (
                <Input
                  placeholder="Name or department you are visiting"
                  value={whoText}
                  onChange={(e) => setWhoText(e.target.value)}
                />
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                Reason for visit
              </label>
              {whySelectMode ? (
                <>
                  <Select value={why} onValueChange={setWhy}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent
                      className="z-[200] border border-border bg-background text-foreground shadow-md dark:bg-gray-800 dark:text-gray-100"
                      position="popper"
                    >
                      {whyOptions.map((opt) => (
                        <SelectItem
                          key={opt.id}
                          value={opt.label}
                          className={KIOSK_SELECT_ITEM}
                        >
                          {opt.label}
                        </SelectItem>
                      ))}
                      <SelectItem value="Other" className={KIOSK_SELECT_ITEM}>
                        Other
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {why === "Other" && (
                    <Input
                      className="mt-2"
                      placeholder="Reason (if other)"
                      value={whyOther}
                      onChange={(e) => setWhyOther(e.target.value)}
                    />
                  )}
                </>
              ) : (
                <Input
                  placeholder="Reason for your visit"
                  value={whyText}
                  onChange={(e) => setWhyText(e.target.value)}
                />
              )}
            </div>
            <textarea
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              rows={2}
              placeholder="Additional details (optional)"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
            {kioskProtocolRequired ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-900/20">
                <p className="mb-2 text-sm">
                  {protocolDocLinkState === "loading" ? (
                    <span className="text-gray-600 dark:text-gray-400">
                      Loading visitor protocol link…
                    </span>
                  ) : protocolDocLinkState === "error" || !protocolViewTicket ? (
                    <span className="text-red-700 dark:text-red-400">
                      Visitor protocol link unavailable. Close this window and try again.
                    </span>
                  ) : (
                    <a
                      href={`/api/visitor/precheck/protocol-document?ticket=${encodeURIComponent(protocolViewTicket)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-blue-700 underline decoration-blue-700/80 underline-offset-2 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      {kioskPrecheckStrings.protocolViewLink}
                    </a>
                  )}
                </p>
                <label className="flex items-start gap-2 text-sm text-gray-800 dark:text-gray-100">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={protocolAcknowledged}
                    onChange={(e) => setProtocolAcknowledged(e.target.checked)}
                  />
                  <span>
                    I acknowledge read and receipt of the visitor protocol. A
                    copy will be attached to your confirmation email.
                  </span>
                </label>
              </div>
            ) : null}
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={isSubmittingRegister}
                className="flex-1"
              >
                {isSubmittingRegister ? "Submitting..." : "Submit for approval"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setPhase("choose")}
                disabled={isSubmittingRegister}
              >
                Back
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
