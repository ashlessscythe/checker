"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/instantdb";
import { tx, id } from "@instantdb/react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import toast from "react-hot-toast";
import { visitorPrecheckDisplayName } from "@/lib/visitor-precheck-display";
import { formatVisitorPrecheckWhen } from "@/lib/visitor-precheck-datetime";

/** Pending rows older than this after submit are highlighted (admin has not acted). */
const STALE_PENDING_MS = 24 * 60 * 60 * 1000;

function isStalePendingSubmission(submittedAt: number) {
  return typeof submittedAt === "number" && submittedAt > 0
    ? Date.now() - submittedAt > STALE_PENDING_MS
    : false;
}

export default function VisitorAdmin() {
  const { data, isLoading, error } = db.useQuery({
    visitOptions: {
      $: {},
    },
    visitorPrecheckRequests: {
      $: {
        where: { status: "pending" },
      },
    },
  });

  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<"who" | "why">("who");
  const [sortOrder, setSortOrder] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [sendVisitorProtocol, setSendVisitorProtocol] = useState(false);
  const [protocolUpload, setProtocolUpload] = useState<{
    fileName: string;
    mimeType: string;
    contentBase64: string;
    byteSize: number;
  } | null>(null);
  const [savedProtocol, setSavedProtocol] = useState<{
    fileName: string;
    mimeType: string;
    byteSize: number;
    updatedAt: number;
  } | null>(null);
  const [isSavingProtocol, setIsSavingProtocol] = useState(false);

  const options = (data?.visitOptions || []) as Array<{
    id: string;
    label: string;
    category: string;
    sortOrder: number;
    isActive: boolean;
  }>;

  const whoOptions = options
    .filter((o) => o.category === "who")
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const whyOptions = options
    .filter((o) => o.category === "why")
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const pendingRequests = (data?.visitorPrecheckRequests || []) as Array<{
    id: string;
    token: string;
    email: string;
    status: string;
    requestSource?: string;
    protocolRequired?: boolean;
    invitedName?: string;
    visitorFirstName?: string;
    visitorLastName?: string;
    visitorCompanyName?: string;
    who: string;
    reason: string;
    otherDetails: string;
    visitDate: number;
    submittedAt: number;
  }>;

  const sortedPendingRequests = useMemo(() => {
    return [...pendingRequests].sort(
      (a, b) => (a.submittedAt ?? 0) - (b.submittedAt ?? 0)
    );
  }, [pendingRequests]);

  useEffect(() => {
    const loadProtocol = async () => {
      try {
        const res = await fetch("/api/admin/visitor-protocol");
        if (!res.ok) return;
        const payload = await res.json();
        setSavedProtocol(payload?.protocol || null);
      } catch (_err) {
        // Optional UI data; no toast needed.
      }
    };
    loadProtocol();
  }, []);

  const [actionModal, setActionModal] = useState<null | {
    requestId: string;
    type: "approve" | "reject";
  }>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [isActionSending, setIsActionSending] = useState(false);
  const [staleDeleteModal, setStaleDeleteModal] = useState<null | {
    requestId: string;
  }>(null);
  const [isStaleDeleteWorking, setIsStaleDeleteWorking] = useState(false);

  const staleDeleteRequest =
    staleDeleteModal &&
    pendingRequests.find((r) => r.id === staleDeleteModal.requestId);

  const completeStaleDeleteFlow = async (
    requestId: string,
    andResendInvite: boolean
  ) => {
    const req = pendingRequests.find((r) => r.id === requestId);
    if (!req) {
      toast.error("Request not found.");
      return;
    }
    setIsStaleDeleteWorking(true);
    try {
      if (andResendInvite) {
        const nameForInvite = visitorPrecheckDisplayName({
          visitorFirstName: req.visitorFirstName,
          visitorLastName: req.visitorLastName,
          invitedName: req.invitedName,
          email: req.email,
        });
        const res = await fetch("/api/visitor/precheck/invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: req.email,
            name: nameForInvite,
            source: req.requestSource === "kiosk" ? "kiosk" : "admin",
            sendVisitorProtocol:
              req.requestSource === "admin" ? Boolean(req.protocolRequired) : false,
          }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          toast.error(
            errData?.error ||
              "Could not send invite — the request was not removed. Try again."
          );
          return;
        }
      }

      await db.transact([tx.visitorPrecheckRequests[req.id].delete()]);
      toast.success(
        andResendInvite
          ? "New invite sent and overdue request removed."
          : "Overdue request removed. Send a new invite from the form above if needed."
      );
      setStaleDeleteModal(null);
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Something went wrong.";
      toast.error(message);
    } finally {
      setIsStaleDeleteWorking(false);
    }
  };

  const generateVisitorBarcode = () => {
    const barcodeChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let barcode = "";
    for (let i = 0; i < 12; i++) {
      barcode += barcodeChars.charAt(
        Math.floor(Math.random() * barcodeChars.length)
      );
    }
    return barcode;
  };

  const handleAddOption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      toast.error("Label is required.");
      return;
    }

    setIsSaving(true);
    try {
      const optionId = id();
      const now = Date.now();
      await db.transact([
        tx.visitOptions[optionId].update({
          label: label.trim(),
          category,
          sortOrder,
          isActive: true,
          createdAt: now,
        }),
      ]);
      toast.success("Visitor option added.");
      setLabel("");
      setSortOrder(0);
    } catch (err: any) {
      console.error("Failed to add visitOption", err);
      toast.error(err?.message || "Failed to add option.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (optionId: string, current: boolean) => {
    try {
      await db.transact([
        tx.visitOptions[optionId].update({ isActive: !current }),
      ]);
      toast.success("Updated option.");
    } catch (err: any) {
      console.error("Failed to update visitOption", err);
      toast.error(err?.message || "Failed to update option.");
    }
  };

  const handleSendInvite = async () => {
    if (!inviteEmail || !inviteEmail.includes("@")) {
      toast.error("Enter a valid email.");
      return;
    }
    setIsSendingInvite(true);
    try {
      const res = await fetch("/api/visitor/precheck/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: inviteEmail,
          name: inviteName,
          source: "admin",
          sendVisitorProtocol: sendVisitorProtocol || undefined,
        }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        toast.error(errorData?.error || "Failed to send invite.");
        return;
      }
      toast.success("Pre-check invite sent.");
      setInviteEmail("");
      setInviteName("");
      setSendVisitorProtocol(false);
    } catch (err: any) {
      console.error("Failed sending invite", err);
      toast.error(err?.message || "Failed to send invite.");
    } finally {
      setIsSendingInvite(false);
    }
  };

  const handleProtocolFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) {
      setProtocolUpload(null);
      return;
    }
    const allowedMimeTypes = new Set([
      "application/pdf",
      "image/png",
      "image/jpeg",
    ]);
    const maxSizeBytes = 5 * 1024 * 1024;
    if (!allowedMimeTypes.has(selectedFile.type)) {
      toast.error("Attachment must be PDF, PNG, or JPG.");
      e.target.value = "";
      return;
    }
    if (selectedFile.size > maxSizeBytes) {
      toast.error("Attachment must be 5MB or smaller.");
      e.target.value = "";
      return;
    }

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Failed to read attachment file."));
        reader.readAsDataURL(selectedFile);
      });
      const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : "";
      if (!base64) {
        throw new Error("Attachment encoding failed.");
      }
      setProtocolUpload({
        fileName: selectedFile.name,
        mimeType: selectedFile.type,
        contentBase64: base64,
        byteSize: selectedFile.size,
      });
    } catch (err: any) {
      console.error("Failed preparing attachment", err);
      toast.error(err?.message || "Failed to prepare attachment.");
      e.target.value = "";
      setProtocolUpload(null);
    }
  };

  const handleSaveProtocol = async () => {
    if (!protocolUpload) {
      toast.error("Choose a protocol file first.");
      return;
    }
    setIsSavingProtocol(true);
    try {
      const res = await fetch("/api/admin/visitor-protocol", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(protocolUpload),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        toast.error(errData?.error || "Failed to save visitor protocol.");
        return;
      }
      toast.success("Visitor protocol saved.");
      setSavedProtocol({
        fileName: protocolUpload.fileName,
        mimeType: protocolUpload.mimeType,
        byteSize: protocolUpload.byteSize,
        updatedAt: Date.now(),
      });
      setProtocolUpload(null);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to save visitor protocol.");
    } finally {
      setIsSavingProtocol(false);
    }
  };

  if (isLoading) {
    return <div>Loading visitor settings...</div>;
  }
  if (error) {
    return <div>Error loading visitor settings: {error.message}</div>;
  }

  return (
    <div className="space-y-8">
      <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900 sm:p-6">
        <h2 className="mb-3 text-xl font-semibold text-gray-900 dark:text-white">
          Send Visitor Pre-Check Invite
        </h2>
        <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
          Manually send a visitor pre-check email to any address. The visitor will
          complete their details and receive a code usable at the kiosk.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex-1 w-full flex flex-col">
            <Input
              type="text"
              placeholder="Name (optional)"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              className="w-full"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              if you leave this blank, we will use the email address.
            </p>
          </div>
          <Input
            type="email"
            placeholder="visitor@example.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="flex-1 w-full"
          />
          <Button
            type="button"
            onClick={handleSendInvite}
            disabled={isSendingInvite}
            className="w-full sm:w-auto"
          >
            {isSendingInvite ? "Sending..." : "Send Invite"}
          </Button>
        </div>
        <div className="mt-4 rounded-md border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Reusable visitor protocol attachment
          </label>
          <Input
            type="file"
            accept=".pdf,image/png,image/jpeg"
            onChange={handleProtocolFileChange}
          />
          {protocolUpload ? (
            <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
              Ready to save: {protocolUpload.fileName} (
              {Math.ceil(protocolUpload.byteSize / 1024)} KB)
            </p>
          ) : null}
          {savedProtocol ? (
            <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
              Current saved protocol: {savedProtocol.fileName} (
              {Math.ceil(savedProtocol.byteSize / 1024)} KB)
            </p>
          ) : (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
              No protocol uploaded yet.
            </p>
          )}
          <div className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveProtocol}
              disabled={!protocolUpload || isSavingProtocol}
            >
              {isSavingProtocol ? "Saving..." : "Save visitor protocol"}
            </Button>
          </div>
        </div>

        <label className="mt-3 inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={sendVisitorProtocol}
            onChange={(e) => setSendVisitorProtocol(e.target.checked)}
            disabled={!savedProtocol}
          />
          <span>Send visitor protocol</span>
        </label>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          When checked, the saved protocol is attached to invite/pending emails and the
          visitor must acknowledge read and receipt during pre-check.
        </p>
      </div>

      <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900 sm:p-6">
        <h2 className="mb-3 text-xl font-semibold text-gray-900 dark:text-white">
          Visitor Options (Who &amp; Why)
        </h2>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
          Manage the dropdown options for who visitors are seeing and why they&apos;re
          visiting. These appear on the pre-check form.
        </p>

        <form onSubmit={handleAddOption} className="mb-6 grid gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Label
            </label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Front Desk, HR, Interview"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Category
            </label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as "who" | "why")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="who">Who (host / whom)</SelectItem>
                <SelectItem value="why">Why (reason for visit)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Sort Order
            </label>
            <Input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(parseInt(e.target.value || "0", 10))}
            />
          </div>
          <div className="sm:col-span-4">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Add Option"}
            </Button>
          </div>
        </form>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
              Who (Host / Whom)
            </h3>
            {whoOptions.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No options yet. Add some above.
              </p>
            )}
            <ul className="space-y-2">
              {whoOptions.map((opt) => (
                <li
                  key={opt.id}
                  className="flex items-center justify-between rounded border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
                >
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {opt.label}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      sort: {opt.sortOrder ?? 0} • {opt.isActive ? "active" : "inactive"}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => toggleActive(opt.id, opt.isActive)}
                  >
                    {opt.isActive ? "Disable" : "Enable"}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
              Why (Reason)
            </h3>
            {whyOptions.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No options yet. Add some above.
              </p>
            )}
            <ul className="space-y-2">
              {whyOptions.map((opt) => (
                <li
                  key={opt.id}
                  className="flex items-center justify-between rounded border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
                >
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {opt.label}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      sort: {opt.sortOrder ?? 0} • {opt.isActive ? "active" : "inactive"}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => toggleActive(opt.id, opt.isActive)}
                  >
                    {opt.isActive ? "Disable" : "Enable"}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900 sm:p-6">
        <h2 className="mb-3 text-xl font-semibold text-gray-900 dark:text-white">
          Visitor Pre-Check Approvals
        </h2>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
          Approve or reject visitor requests. On approval, the visitor gets a QR + PDF by
          email and their badge will be recognized at the kiosk. Requests still pending more
          than 24 hours after submission are highlighted so you can prioritize them; the
          visitor&apos;s original link may have expired by then.
        </p>

        {pendingRequests.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No pending requests right now.
          </p>
        ) : (
          <div className="space-y-3">
            {sortedPendingRequests.map((req) => {
              const stale = isStalePendingSubmission(req.submittedAt);
              return (
              <div
                key={req.id}
                className={`rounded-lg border p-4 ${
                  stale
                    ? "border-amber-400 bg-amber-50/80 dark:border-amber-600 dark:bg-amber-950/25"
                    : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
                }`}
              >
                {stale ? (
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full border border-amber-500/60 bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-950 dark:border-amber-400/50 dark:bg-amber-900/40 dark:text-amber-100">
                      Overdue — no approval yet
                    </span>
                    <span className="text-xs text-amber-900/90 dark:text-amber-200/90">
                      Visitor may need a new invite — pre-check links expire 24 hours after
                      the original email was sent, not when you approve.
                    </span>
                  </div>
                ) : null}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {visitorPrecheckDisplayName({
                        visitorFirstName: req.visitorFirstName,
                        visitorLastName: req.visitorLastName,
                        invitedName: req.invitedName,
                        email: req.email,
                      })}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {req.email}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      Company: {req.visitorCompanyName?.trim() || "—"}
                    </div>
                    {req.requestSource === "kiosk" ? (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        kiosk-sent request
                      </div>
                    ) : null}
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Submitted: {new Date(req.submittedAt).toLocaleString()}
                    </div>
                    <div className="mt-2 text-sm text-gray-700 dark:text-gray-200">
                      <div>
                        <span className="font-semibold">Visiting:</span>{" "}
                        {req.who || "—"}
                      </div>
                      <div>
                        <span className="font-semibold">Reason:</span>{" "}
                        {req.reason || "—"}
                      </div>
                      <div>
                        <span className="font-semibold">When:</span>{" "}
                        {formatVisitorPrecheckWhen(req.visitDate)}
                      </div>
                      {req.otherDetails?.trim() ? (
                        <div className="mt-2">
                          <span className="font-semibold">Details:</span>{" "}
                          {req.otherDetails}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:items-end">
                    <Button
                      type="button"
                      className="bg-green-600 hover:bg-green-700"
                      disabled={isActionSending || isStaleDeleteWorking}
                      onClick={() => {
                        setStaleDeleteModal(null);
                        setMessageDraft("");
                        setActionModal({ requestId: req.id, type: "approve" });
                      }}
                    >
                      Approve
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isActionSending || isStaleDeleteWorking}
                      onClick={() => {
                        setStaleDeleteModal(null);
                        setMessageDraft("");
                        setActionModal({ requestId: req.id, type: "reject" });
                      }}
                      className="border-red-500 text-red-600 hover:bg-red-50 dark:border-red-500 dark:text-red-300"
                    >
                      Reject
                    </Button>
                    {stale ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isActionSending || isStaleDeleteWorking}
                        onClick={() => {
                          setActionModal(null);
                          setMessageDraft("");
                          setStaleDeleteModal({ requestId: req.id });
                        }}
                        className="border-amber-700/40 text-amber-950 hover:bg-amber-100/80 dark:border-amber-500/40 dark:text-amber-100 dark:hover:bg-amber-950/40"
                      >
                        Delete request
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
            })}
          </div>
        )}

        {staleDeleteModal ? (
          <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50/90 p-4 shadow-sm dark:border-amber-700 dark:bg-amber-950/35">
            <h3 className="mb-2 text-lg font-semibold text-amber-950 dark:text-amber-50">
              Remove this overdue request?
            </h3>
            <p className="mb-3 text-sm leading-relaxed text-amber-950/90 dark:text-amber-100/90">
              Hey — FYI you&apos;ll need to send this visitor another pre-check invite if
              they still need to check in; their old link may already be expired. Want to
              send a fresh invite email now?
            </p>
            {staleDeleteRequest ? (
              <p className="mb-4 rounded-md border border-amber-200/80 bg-white/70 px-3 py-2 text-sm font-medium text-amber-950 dark:border-amber-600/50 dark:bg-amber-950/30 dark:text-amber-50">
                {visitorPrecheckDisplayName({
                  visitorFirstName: staleDeleteRequest.visitorFirstName,
                  visitorLastName: staleDeleteRequest.visitorLastName,
                  invitedName: staleDeleteRequest.invitedName,
                  email: staleDeleteRequest.email,
                })}
                <span className="font-normal text-amber-800/90 dark:text-amber-200/90">
                  {" "}
                  · {staleDeleteRequest.email}
                </span>
              </p>
            ) : (
              <p className="mb-4 text-sm text-amber-800 dark:text-amber-200">
                This request is no longer in the list — close this dialog.
              </p>
            )}
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button
                type="button"
                className="order-1 bg-blue-600 px-5 hover:bg-blue-700 sm:order-1"
                disabled={
                  isStaleDeleteWorking || !staleDeleteRequest
                }
                onClick={() =>
                  completeStaleDeleteFlow(staleDeleteModal.requestId, true)
                }
              >
                {isStaleDeleteWorking
                  ? "Please wait..."
                  : "Yes — send a new invite"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="order-2 border-amber-900/25 bg-white px-5 dark:border-amber-500/30 dark:bg-amber-950/50"
                disabled={
                  isStaleDeleteWorking || !staleDeleteRequest
                }
                onClick={() =>
                  completeStaleDeleteFlow(staleDeleteModal.requestId, false)
                }
              >
                {isStaleDeleteWorking
                  ? "Please wait..."
                  : "No — just remove"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="order-3 text-amber-900/80 hover:bg-amber-100/80 dark:text-amber-200 dark:hover:bg-amber-900/40"
                disabled={isStaleDeleteWorking}
                onClick={() => setStaleDeleteModal(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        {actionModal ? (
          <div className="mt-5 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
              {actionModal.type === "approve" ? "Approve request" : "Reject request"}
            </h3>
            <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
              Message is optional. If you leave it blank, we&apos;ll send a default note.
            </p>
            <textarea
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              rows={4}
              placeholder={
                actionModal.type === "approve"
                  ? "Optional admin message to include in approval email..."
                  : "Optional admin rejection message (e.g. schedule another time, not employed here...)..."
              }
              value={messageDraft}
              onChange={(e) => setMessageDraft(e.target.value)}
              disabled={isActionSending || isStaleDeleteWorking}
            />
            <div className="mt-3 flex gap-2">
              <Button
                type="button"
                className={
                  actionModal.type === "approve"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                }
                disabled={isActionSending || isStaleDeleteWorking}
                onClick={async () => {
                  setIsActionSending(true);
                  try {
                    const req = pendingRequests.find(
                      (r) => r.id === actionModal.requestId
                    );
                    if (!req) {
                      toast.error("Request not found.");
                      return;
                    }

                    const now = Date.now();

                    if (actionModal.type === "approve") {
                      const barcode = generateVisitorBarcode();
                      const visitorId = id();
                      const approvedVisitorName = visitorPrecheckDisplayName({
                        visitorFirstName: req.visitorFirstName,
                        visitorLastName: req.visitorLastName,
                        invitedName: req.invitedName,
                        email: req.email,
                      });
                      const approvedCompany = (req.visitorCompanyName || "").trim();

                      // Ensure VISITOR department exists
                      const { data: deptData } = await db.queryOnce({
                        departments: {
                          $: {
                            where: { departmentId: "VISITOR" },
                          },
                        },
                      });

                      let visitorDeptId = "";
                      if (
                        !deptData?.departments ||
                        deptData.departments.length === 0
                      ) {
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

                      await db.transact([
                        tx.users[visitorId].update({
                          name: approvedVisitorName,
                          email: req.email,
                          barcode,
                          isAdmin: false,
                          isAuth: false,
                          deptId: visitorDeptId,
                          createdAt: now,
                          serverCreatedAt: now,
                          lastLoginAt: now,
                          laptopSerial: "",
                          purpose: req.reason,
                        }),
                        tx.visitors[visitorId].update({
                          name: approvedVisitorName,
                          email: req.email,
                          barcode,
                          visitDate: req.visitDate,
                          hostName: req.who,
                          reason: req.reason,
                          otherDetails: req.otherDetails || "",
                          createdAt: now,
                          precheckedAt: now,
                        }),
                        tx.visitorPrecheckRequests[req.id].update({
                          status: "approved",
                          approvedAt: now,
                          approvedBy: "admin",
                          adminMessage: messageDraft || "",

                          visitorBarcode: barcode,
                          visitorUserId: visitorId,
                          rejectedAt: 0,
                          rejectedBy: "",
                          rejectionMessage: "",
                          // Keep request metadata for templates/auditing (older records may miss these).
                          requestSource: req.requestSource || "admin",
                          invitedName: req.invitedName || req.email,
                          lastUpdatedAt: now,
                        }),
                      ]);

                      await fetch(
                        "/api/visitor/precheck/send-approval-email",
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            email: req.email,
                            barcode,
                            visitorName: approvedVisitorName,
                            visitorCompany: approvedCompany,
                            who: req.who,
                            reason: req.reason,
                            whenTs: req.visitDate,
                            details: req.otherDetails || "",
                            adminMessage: messageDraft || "",
                          }),
                        }
                      );

                      toast.success("Approved and email sent.");
                    } else {
                      await db.transact([
                        tx.visitorPrecheckRequests[req.id].update({
                          status: "rejected",
                          rejectedAt: now,
                          rejectedBy: "admin",
                          rejectionMessage: messageDraft || "",

                          approvedAt: 0,
                          approvedBy: "",
                          adminMessage: "",

                          visitorBarcode: "",
                          visitorUserId: "",
                          // Keep request metadata for templates/auditing (older records may miss these).
                          requestSource: req.requestSource || "admin",
                          invitedName: req.invitedName || req.email,
                          lastUpdatedAt: now,
                        }),
                      ]);

                      await fetch(
                        "/api/visitor/precheck/send-rejection-email",
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            email: req.email,
                            rejectionMessage: messageDraft || "",
                            details: req.otherDetails || "",
                            visitorFirstName: req.visitorFirstName || "",
                            visitorLastName: req.visitorLastName || "",
                            visitorCompanyName: req.visitorCompanyName || "",
                            invitedName: req.invitedName || "",
                          }),
                        }
                      );

                      toast.success("Rejected and email sent.");
                    }

                    setActionModal(null);
                    setMessageDraft("");
                  } catch (err: any) {
                    console.error(err);
                    toast.error(err?.message || "Failed to process request.");
                  } finally {
                    setIsActionSending(false);
                  }
                }}
              >
                {actionModal.type === "approve" ? "Approve & Email" : "Reject & Email"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isActionSending || isStaleDeleteWorking}
                onClick={() => {
                  setActionModal(null);
                  setMessageDraft("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

