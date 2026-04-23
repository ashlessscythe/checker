"use client";

import React, { useMemo, useState, useCallback, useEffect } from "react";
import { db } from "@/lib/instantdb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

const OTHER = "__other__";

/** Same as visitor kiosk `CHOOSE_MODAL_TIMEOUT_SECONDS` in `visitor-precheck-email-prompt.tsx`. */
const VENDOR_MODAL_TIMEOUT_SECONDS = 60;

/** Radix portals Select to `body`; shared `SelectContent` uses `z-50`, below this overlay (`z-[100]`). */
const VENDOR_SELECT_CONTENT_CLASS =
  "z-[200] max-h-[min(24rem,calc(90vh-8rem))] bg-white dark:bg-gray-800";

type VendorRow = {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  reasons?: Array<{
    id: string;
    label: string;
    sortOrder: number;
    isActive: boolean;
  }>;
};

type Step =
  | "closed"
  | "menu"
  | "checkin"
  | "checkoutChoice"
  | "checkoutCode"
  | "checkoutForgot"
  | "showCode";

export default function VendorKioskModal() {
  const [step, setStep] = useState<Step>("closed");
  const [showCode, setShowCode] = useState("");
  const [timeLeft, setTimeLeft] = useState(VENDOR_MODAL_TIMEOUT_SECONDS);

  const { data, error, isLoading } = db.useQuery({
    vendors: {
      $: { where: { isActive: true } },
      reasons: {},
    },
  });

  const vendors = useMemo(() => {
    const list = (data?.vendors || []) as VendorRow[];
    return [...list].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [data?.vendors]);

  const reset = useCallback(() => {
    setStep("closed");
    setShowCode("");
    setTimeLeft(VENDOR_MODAL_TIMEOUT_SECONDS);
    setFirstName("");
    setLastName("");
    setCompanySel("");
    setCompanyOther("");
    setReasonSel("");
    setReasonOther("");
    setCheckoutCompanySel("");
    setCheckoutCompanyOther("");
    setCheckoutCode("");
    setCoFirst("");
    setCoLast("");
  }, []);

  useEffect(() => {
    if (step === "closed") return;

    setTimeLeft(VENDOR_MODAL_TIMEOUT_SECONDS);
    const interval = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          reset();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [step, reset]);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companySel, setCompanySel] = useState("");
  const [companyOther, setCompanyOther] = useState("");
  const [reasonSel, setReasonSel] = useState("");
  const [reasonOther, setReasonOther] = useState("");

  const [checkoutCompanySel, setCheckoutCompanySel] = useState("");
  const [checkoutCompanyOther, setCheckoutCompanyOther] = useState("");
  const [checkoutCode, setCheckoutCode] = useState("");
  const [coFirst, setCoFirst] = useState("");
  const [coLast, setCoLast] = useState("");

  const [busy, setBusy] = useState(false);

  const selectedVendor = useMemo(
    () => vendors.find((v) => v.id === companySel),
    [vendors, companySel]
  );

  const reasonOptions = useMemo(() => {
    if (!selectedVendor?.reasons?.length) return [];
    return [...selectedVendor.reasons]
      .filter((r) => r.isActive)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [selectedVendor]);

  const handleCheckinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    const fn = firstName.trim();
    const ln = lastName.trim();
    if (!fn || !ln) {
      toast.error("Please enter your first and last name.");
      return;
    }

    if (!companySel) {
      toast.error("Please choose your company.");
      return;
    }

    const companyMode = companySel === OTHER ? "other" : "vendor";
    if (companyMode === "other" && !companyOther.trim()) {
      toast.error("Please type the company name.");
      return;
    }

    let reasonMode: "reason" | "other" = "other";
    let vendorReasonId = "";
    let ro = reasonOther.trim();

    if (companyMode === "vendor") {
      if (!reasonSel) {
        toast.error("Please choose a reason for your visit.");
        return;
      }
      if (reasonSel === OTHER) {
        reasonMode = "other";
        if (!ro) {
          toast.error("Please describe your reason for visiting.");
          return;
        }
      } else {
        reasonMode = "reason";
        vendorReasonId = reasonSel;
      }
    } else {
      if (!ro) {
        toast.error("Please describe your reason for visiting.");
        return;
      }
    }

    setBusy(true);
    try {
      const res = await fetch("/api/vendor/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: fn,
          lastName: ln,
          companyMode,
          vendorId: companyMode === "vendor" ? companySel : undefined,
          companyOther: companyMode === "other" ? companyOther.trim() : undefined,
          reasonMode,
          vendorReasonId: vendorReasonId || undefined,
          reasonOther: ro || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json?.error || "Check-in failed.");
        return;
      }
      setShowCode(String(json.sixDigitCode ?? ""));
      setStep("showCode");
      toast.success("You are checked in.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Check-in failed.");
    } finally {
      setBusy(false);
    }
  };

  const submitCheckoutCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const digits = checkoutCode.replace(/\D/g, "");
    if (digits.length !== 6) {
      toast.error("Enter your 6-digit number (six digits).");
      return;
    }
    const companyMode = checkoutCompanySel === OTHER ? "other" : "vendor";
    if (companyMode === "vendor" && !checkoutCompanySel) {
      toast.error("Please choose your company.");
      return;
    }
    if (companyMode === "other" && !checkoutCompanyOther.trim()) {
      toast.error("Please type the company name.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/vendor/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "code",
          sixDigitCode: digits,
          companyMode,
          vendorId:
            companyMode === "vendor" ? checkoutCompanySel : undefined,
          companyOther:
            companyMode === "other" ? checkoutCompanyOther.trim() : undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json?.error || "Checkout failed.");
        return;
      }
      toast.success("You are checked out. Thank you.");
      reset();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Checkout failed.");
    } finally {
      setBusy(false);
    }
  };

  const submitCheckoutForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const fn = coFirst.trim();
    const ln = coLast.trim();
    if (!fn || !ln) {
      toast.error("Please enter your first and last name.");
      return;
    }
    if (!checkoutCompanySel) {
      toast.error("Please choose your company.");
      return;
    }
    const companyMode = checkoutCompanySel === OTHER ? "other" : "vendor";
    if (companyMode === "other" && !checkoutCompanyOther.trim()) {
      toast.error("Please type the company name.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/vendor/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "forgot",
          firstName: fn,
          lastName: ln,
          companyMode,
          vendorId:
            companyMode === "vendor" ? checkoutCompanySel : undefined,
          companyOther:
            companyMode === "other" ? checkoutCompanyOther.trim() : undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json?.error || "Checkout failed.");
        return;
      }
      toast.success("You are checked out. Thank you.");
      reset();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Checkout failed.");
    } finally {
      setBusy(false);
    }
  };

  if (step === "closed") {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={() => setStep("menu")}
        className="w-full max-w-md border-blue-600 py-3 text-base font-medium text-blue-800 hover:bg-blue-50 dark:border-blue-500 dark:text-blue-200 dark:hover:bg-blue-950/40"
      >
        Vendor check-in / checkout
      </Button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vendor-kiosk-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && step !== "showCode") reset();
      }}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-4 shadow-xl dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="vendor-kiosk-title"
          className="mb-3 text-lg font-semibold text-gray-900 dark:text-white"
        >
          {step === "menu" && "Vendor visit"}
          {step === "checkin" && "Vendor check-in"}
          {step === "checkoutChoice" && "Vendor checkout"}
          {step === "checkoutCode" && "Vendor checkout — with number"}
          {step === "checkoutForgot" && "Vendor checkout — no number"}
          {step === "showCode" && "Save your checkout number"}
        </h2>

        <div className="mb-3 text-xs text-gray-500 dark:text-gray-400">
          Auto-closes in {Math.floor(timeLeft / 60)}:
          {String(timeLeft % 60).padStart(2, "0")}
        </div>

        {error ? (
          <p className="text-sm text-red-600">Could not load companies.</p>
        ) : null}

        {step === "menu" && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              If you are a vendor or contractor visiting this site, use the
              buttons below. You do not need an email or badge scan.
            </p>
            <Button
              type="button"
              className="w-full bg-blue-600 hover:bg-blue-700"
              onClick={() => setStep("checkin")}
            >
              Check in
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setStep("checkoutChoice")}
            >
              Check out
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={reset}>
              Cancel
            </Button>
          </div>
        )}

        {step === "checkin" && (
          <form onSubmit={handleCheckinSubmit} className="space-y-3">
            {isLoading ? (
              <p className="text-sm text-gray-500">Loading…</p>
            ) : vendors.length === 0 ? (
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Vendor companies are not set up yet. Please ask staff for help.
              </p>
            ) : (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                    First name
                  </label>
                  <Input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    autoComplete="given-name"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Last name
                  </label>
                  <Input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    autoComplete="family-name"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Company
                  </label>
                  <Select
                    value={companySel || undefined}
                    onValueChange={(v) => {
                      setCompanySel(v);
                      setReasonSel("");
                      setReasonOther("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose company" />
                    </SelectTrigger>
                    <SelectContent className={cn(VENDOR_SELECT_CONTENT_CLASS)}>
                      {vendors.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name}
                        </SelectItem>
                      ))}
                      <SelectItem value={OTHER}>Other (type name)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {companySel === OTHER ? (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                      Company name
                    </label>
                    <Input
                      value={companyOther}
                      onChange={(e) => setCompanyOther(e.target.value)}
                      placeholder="Type the company name"
                    />
                  </div>
                ) : null}

                {companySel && companySel !== OTHER ? (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                      Reason for visit
                    </label>
                    <Select
                      value={reasonSel || undefined}
                      onValueChange={setReasonSel}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a reason" />
                      </SelectTrigger>
                      <SelectContent className={cn(VENDOR_SELECT_CONTENT_CLASS)}>
                        {reasonOptions.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.label}
                          </SelectItem>
                        ))}
                        <SelectItem value={OTHER}>Other (describe)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                {companySel === OTHER ? (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                      Reason for visit
                    </label>
                    <Input
                      value={reasonOther}
                      onChange={(e) => setReasonOther(e.target.value)}
                      placeholder="Briefly describe why you are here"
                    />
                  </div>
                ) : null}

                {companySel && companySel !== OTHER && reasonSel === OTHER ? (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                      Describe your reason
                    </label>
                    <Input
                      value={reasonOther}
                      onChange={(e) => setReasonOther(e.target.value)}
                      placeholder="Type your reason"
                    />
                  </div>
                ) : null}

                <div className="flex gap-2 pt-1">
                  <Button type="submit" className="flex-1" disabled={busy}>
                    {busy ? "Working…" : "Check in"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setStep("menu")}
                    disabled={busy}
                  >
                    Back
                  </Button>
                </div>
              </>
            )}
          </form>
        )}

        {step === "checkoutChoice" && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              If you have the 6-digit number you received at check-in, use the
              first option. If you do not have it, use the second option.
            </p>
            <Button
              type="button"
              className="w-full"
              onClick={() => setStep("checkoutCode")}
            >
              I have my 6-digit number
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setStep("checkoutForgot")}
            >
              I don&apos;t have my number
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setStep("menu")}
            >
              Back
            </Button>
          </div>
        )}

        {step === "checkoutCode" && (
          <form onSubmit={submitCheckoutCode} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                Company
              </label>
              <Select
                value={checkoutCompanySel || undefined}
                onValueChange={setCheckoutCompanySel}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose company" />
                </SelectTrigger>
                <SelectContent className={cn(VENDOR_SELECT_CONTENT_CLASS)}>
                  {vendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={OTHER}>Other (type name)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {checkoutCompanySel === OTHER ? (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Company name
                </label>
                <Input
                  value={checkoutCompanyOther}
                  onChange={(e) => setCheckoutCompanyOther(e.target.value)}
                />
              </div>
            ) : null}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                6-digit number
              </label>
              <Input
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                value={checkoutCode}
                onChange={(e) => setCheckoutCode(e.target.value)}
                placeholder="Six digits"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={busy}>
                {busy ? "Working…" : "Check out"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setStep("checkoutChoice")}
                disabled={busy}
              >
                Back
              </Button>
            </div>
          </form>
        )}

        {step === "checkoutForgot" && (
          <form onSubmit={submitCheckoutForgot} className="space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Enter the same company and name you used at check-in. Names are
              matched without worrying about capital letters.
            </p>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                Company
              </label>
              <Select
                value={checkoutCompanySel || undefined}
                onValueChange={setCheckoutCompanySel}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose company" />
                </SelectTrigger>
                <SelectContent className={cn(VENDOR_SELECT_CONTENT_CLASS)}>
                  {vendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={OTHER}>Other (type name)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {checkoutCompanySel === OTHER ? (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Company name
                </label>
                <Input
                  value={checkoutCompanyOther}
                  onChange={(e) => setCheckoutCompanyOther(e.target.value)}
                />
              </div>
            ) : null}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                First name
              </label>
              <Input value={coFirst} onChange={(e) => setCoFirst(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                Last name
              </label>
              <Input value={coLast} onChange={(e) => setCoLast(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={busy}>
                {busy ? "Working…" : "Check out"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setStep("checkoutChoice")}
                disabled={busy}
              >
                Back
              </Button>
            </div>
          </form>
        )}

        {step === "showCode" && (
          <div className="space-y-4">
            <p className="text-base font-medium text-gray-900 dark:text-white">
              You are checked in. Please remember this number. You will need it
              when you leave.
            </p>
            <div
              className="rounded-lg border-2 border-blue-600 bg-blue-50 py-6 text-center text-4xl font-bold tracking-widest text-blue-900 dark:border-blue-400 dark:bg-blue-950/50 dark:text-blue-100"
              aria-live="polite"
            >
              {showCode}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              This is not a badge scan code. When you are ready to leave, open
              Vendor check-in / checkout, choose <strong>Check out</strong>, then
              enter this number.
            </p>
            <Button type="button" className="w-full" onClick={reset}>
              Done
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
