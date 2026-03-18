"use client";

import React, { Suspense, useEffect, useState } from "react";
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

interface VisitOption {
  id: string;
  category: string;
  label: string;
  isActive: boolean;
  sortOrder: number;
}

function VisitorPrecheckContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [inviteEmail, setInviteEmail] = useState<string | null>(null);
  const [alreadyUsed, setAlreadyUsed] = useState(false);

  const [whoOptions, setWhoOptions] = useState<VisitOption[]>([]);
  const [whyOptions, setWhyOptions] = useState<VisitOption[]>([]);

  const [who, setWho] = useState("");
  const [whoOther, setWhoOther] = useState("");
  const [why, setWhy] = useState("");
  const [whyOther, setWhyOther] = useState("");
  const [visitDate, setVisitDate] = useState("");
  const [visitTime, setVisitTime] = useState("");
  const [details, setDetails] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function validate() {
      if (!token) {
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
          setIsValid(false);
          setIsValidating(false);
          return;
        }

        const data = await res.json();
        setInviteEmail(data.email);
        setIsValid(true);

        // 2) Load visit options (non-critical). If this fails, we still let
        // visitors proceed using the "Other" options.
        try {
          const { data: optionsData } = await db.queryOnce({
            visitOptions: {
              $: {
                where: { isActive: true },
              },
            },
          });

          const options = (optionsData?.visitOptions || []) as VisitOption[];
          const who = options
            .filter((o) => o.category === "who")
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
          const why = options
            .filter((o) => o.category === "why")
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

          setWhoOptions(who);
          setWhyOptions(why);
        } catch (optErr) {
          console.error("Failed loading visitOptions; proceeding.", optErr);
          setWhoOptions([]);
          setWhyOptions([]);
        }

        // 3) Best-effort: if this email already has a visitor record, treat link as used
        try {
          if (data.email) {
            const { data: visitorData } = await db.queryOnce({
              visitors: {
                $: {
                  where: { email: data.email },
                },
              },
            });
            const visitors = visitorData?.visitors || [];
            if (visitors.length > 0) {
              setAlreadyUsed(true);
            }
          }
        } catch (err2) {
          console.error("Failed checking existing visitors; proceeding.", err2);
        }
      } catch (err) {
        console.error("Token validate failed", err);
        setIsValid(false);
      } finally {
        setIsValidating(false);
      }
    }

    validate();
  }, [token]);

  const [completedBarcode, setCompletedBarcode] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;

    if (!who || !why || !visitDate || !visitTime) {
      toast.error("Please complete all required fields.");
      return;
    }

    const when = new Date(`${visitDate}T${visitTime}`);
    if (isNaN(when.getTime()) || when.getTime() < Date.now()) {
      toast.error("Please choose a future visit time.");
      return;
    }

    setIsSubmitting(true);

    try {
      const finalWho = who === "Other" ? whoOther || "Other" : who;
      const finalWhy = why === "Other" ? whyOther || "Other" : why;
      const visitTimestamp = when.getTime();
      const createdAt = Date.now();

      // Ensure VISITOR department exists and create backing user+visitor
      const { data: deptData } = await db.queryOnce({
        departments: {
          $: {
            where: { departmentId: "VISITOR" },
          },
        },
      });

      let visitorDeptId = "";
      if (!deptData?.departments || deptData.departments.length === 0) {
        visitorDeptId = id();
        await db.transact([
          tx.departments[visitorDeptId].update({
            name: "Visitors",
            departmentId: "VISITOR",
          }),
        ]);
      } else {
        visitorDeptId = deptData.departments[0].id;
      }

      const barcodeChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      let barcode = "";
      for (let i = 0; i < 12; i++) {
        barcode += barcodeChars.charAt(
          Math.floor(Math.random() * barcodeChars.length)
        );
      }

      const visitorId = id();

      await db.transact([
        tx.users[visitorId].update({
          name: inviteEmail,
          email: inviteEmail,
          barcode,
          isAdmin: false,
          isAuth: false,
          deptId: visitorDeptId,
          createdAt,
          serverCreatedAt: createdAt,
          laptopSerial: undefined,
          purpose: finalWhy,
        }),
        tx.visitors[visitorId].update({
          name: inviteEmail,
          email: inviteEmail,
          barcode,
          visitDate: visitTimestamp,
          hostName: finalWho,
          reason: finalWhy,
          otherDetails: details || "",
          createdAt,
          precheckedAt: createdAt,
        }),
      ]);

      setCompletedBarcode(barcode);
      toast.success("Pre-check completed! Use your pass at the kiosk.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-200">Validating your link...</p>
      </div>
    );
  }

  if (!isValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800">
          <h1 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
            Invalid or expired link
          </h1>
          <p className="mb-2 text-sm text-gray-700 dark:text-gray-300">
            This visitor pre-check link is not valid. It may have expired (links are valid
            for 24 hours) or has already been used.
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Please contact your host or request a new invitation.
          </p>
        </div>
      </div>
    );
  }

  if (alreadyUsed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800">
          <h1 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
            Link already used
          </h1>
          <p className="mb-2 text-sm text-gray-700 dark:text-gray-300">
            This visitor pre-check link has already been used to submit details.
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Please contact your host if you need to update your information or request a new
            invitation.
          </p>
        </div>
      </div>
    );
  }

  if (completedBarcode) {
    return (
      <div className="min-h-screen bg-gray-100 px-4 py-8 dark:bg-gray-900">
        <Toaster position="top-right" />
        <div className="mx-auto max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800 text-center space-y-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            You&apos;re all set!
          </h1>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Show this code or QR at the kiosk to check in.
          </p>

          <div className="rounded-lg border border-dashed border-gray-400 bg-gray-50 px-4 py-4 dark:border-gray-600 dark:bg-gray-900">
            <p className="mb-2 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Visitor Code
            </p>
            <p className="mb-3 select-all text-lg font-mono font-semibold text-gray-900 dark:text-white">
              {completedBarcode}
            </p>
            <div className="mx-auto inline-block rounded-md bg-white p-3 dark:bg-gray-800">
              <QRCode
                value={completedBarcode}
                size={164}
                bgColor="transparent"
                fgColor="#111827"
              />
            </div>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            You can screenshot or print this page. The same code is stored in our system and will
            be recognized by the kiosk scanner.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-8 dark:bg-gray-900">
      <Toaster position="top-right" />
      <div className="mx-auto max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800">
        <h1 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">
          Visitor Pre-Check
        </h1>
        <p className="mb-6 text-sm text-gray-700 dark:text-gray-300">
          Complete this form before your visit. Your link is valid for 24 hours from when the
          email was sent. You&apos;ll receive a code you can use to check in at the kiosk.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Who / Whom */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Who are you visiting? <span className="text-red-500">*</span>
            </label>
            <Select value={who} onValueChange={setWho}>
              <SelectTrigger>
                <SelectValue placeholder="Select who you are visiting" />
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
                  Other
                </SelectItem>
              </SelectContent>
            </Select>
            {who === "Other" && (
              <Input
                className="mt-2"
                placeholder="Enter who you are visiting"
                value={whoOther}
                onChange={(e) => setWhoOther(e.target.value)}
              />
            )}
          </div>

          {/* Why */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Reason for visit <span className="text-red-500">*</span>
            </label>
            <Select value={why} onValueChange={setWhy}>
              <SelectTrigger>
                <SelectValue placeholder="Select reason for visit" />
              </SelectTrigger>
              <SelectContent className="border border-border shadow-md rounded-md text-foreground bg-background dark:bg-gray-800 dark:text-gray-100">
                {whyOptions.map((opt) => (
                  <SelectItem key={opt.id} value={opt.label} className="hover:bg-accent hover:text-accent-foreground dark:hover:bg-gray-700 dark:hover:text-white">
                    {opt.label}
                  </SelectItem>
                ))}
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
            {why === "Other" && (
              <Input
                className="mt-2"
                placeholder="Enter reason for visit"
                value={whyOther}
                onChange={(e) => setWhyOther(e.target.value)}
              />
            )}
          </div>

          {/* When */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Visit date <span className="text-red-500">*</span>
              </label>
              <Input
                type="date"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Visit time <span className="text-red-500">*</span>
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
              Additional details (optional)
            </label>
            <textarea
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 w-full"
          >
            {isSubmitting ? "Submitting..." : "Complete Pre-Check"}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function VisitorPrecheckPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
          <p className="text-gray-700 dark:text-gray-200">
            Loading visitor pre-check...
          </p>
        </div>
      }
    >
      <VisitorPrecheckContent />
    </Suspense>
  );
}

