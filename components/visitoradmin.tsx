"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/instantdb";
import { tx, id } from "@instantdb/react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Switch } from "./ui/Switch";
import AdminCollapsible from "./admin-collapsible";
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
import VendorAdminSection from "@/components/vendor-admin-section";
import {
  KIOSK_LOBBY_SETTINGS_KEY,
  type KioskLobbySettingsRow,
} from "@/lib/kiosk-lobby-settings";

/** Pending rows older than this after submit are highlighted (admin has not acted). */
const STALE_PENDING_MS = 24 * 60 * 60 * 1000;

function isStalePendingSubmission(submittedAt: number) {
  return typeof submittedAt === "number" && submittedAt > 0
    ? Date.now() - submittedAt > STALE_PENDING_MS
    : false;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Relative phrase e.g. "approved 3 days ago" (24h-based day buckets). */
function formatApprovedDaysAgo(approvedAt: number) {
  if (typeof approvedAt !== "number" || approvedAt <= 0) return null;
  const diffDays = Math.floor((Date.now() - approvedAt) / MS_PER_DAY);
  if (diffDays <= 0) return "approved today";
  if (diffDays === 1) return "approved yesterday";
  return `approved ${diffDays} days ago`;
}

function WhoHostOptionRow({
  opt,
  onToggleActive,
}: {
  opt: {
    id: string;
    label: string;
    sortOrder: number;
    isActive: boolean;
    hostEmail?: string;
  };
  onToggleActive: (optionId: string, current: boolean) => void;
}) {
  const [emailDraft, setEmailDraft] = useState(opt.hostEmail ?? "");
  useEffect(() => {
    setEmailDraft(opt.hostEmail ?? "");
  }, [opt.id, opt.hostEmail]);
  const [savingEmail, setSavingEmail] = useState(false);

  const saveHostEmail = async () => {
    setSavingEmail(true);
    try {
      await db.transact([
        tx.visitOptions[opt.id].update({ hostEmail: emailDraft.trim() }),
      ]);
      toast.success("Host notify email saved.");
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Failed to save.";
      toast.error(message);
    } finally {
      setSavingEmail(false);
    }
  };

  return (
    <li
      className="rounded border border-gray-200 bg-white px-3 py-3 text-sm dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
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
          onClick={() => onToggleActive(opt.id, opt.isActive)}
        >
          {opt.isActive ? "Disable" : "Enable"}
        </Button>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label className="mb-0.5 block text-xs font-medium text-gray-600 dark:text-gray-400">
            Notify this host (email)
          </label>
          <Input
            type="email"
            value={emailDraft}
            onChange={(e) => setEmailDraft(e.target.value)}
            placeholder="name@company.com — pre-check review link"
            className="text-sm"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            When a visitor selects this host, they get an email to approve or decline on
            the web app.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={savingEmail}
          onClick={saveHostEmail}
        >
          {savingEmail ? "Saving…" : "Save email"}
        </Button>
      </div>
    </li>
  );
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
    visitorApprovalNotifyRecipients: {
      $: {},
    },
    kioskLobbySettings: {
      $: { where: { key: KIOSK_LOBBY_SETTINGS_KEY } },
    },
  });

  const {
    data: approvedPrecheckData,
    isLoading: approvedPrecheckLoading,
    error: approvedPrecheckError,
  } = db.useQuery({
    visitorPrecheckRequests: {
      $: {
        where: { status: "approved" },
      },
    },
  });

  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<"who" | "why" | "company">("who");
  const [newOptionHostEmail, setNewOptionHostEmail] = useState("");
  const [sortOrder, setSortOrder] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [sendVisitorProtocol, setSendVisitorProtocol] = useState(true);
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
  const [notifyName, setNotifyName] = useState("");
  const [notifyEmail, setNotifyEmail] = useState("");
  const [isSavingNotifyRecipient, setIsSavingNotifyRecipient] = useState(false);

  const [adminSec, setAdminSec] = useState({
    lobby: true,
    vendors: false,
    invite: false,
    options: false,
    notify: false,
    approvals: false,
    approved: false,
  });
  const [savingLobbyFlags, setSavingLobbyFlags] = useState(false);

  const kioskLobbyRow = (data?.kioskLobbySettings?.[0] ??
    undefined) as KioskLobbySettingsRow | undefined;
  const vendorLobbyEnabled = kioskLobbyRow?.vendorCheckInEnabled !== false;
  const guestLobbyEnabled = kioskLobbyRow?.visitorGuestCheckInEnabled !== false;

  const persistKioskLobby = async (patch: {
    vendorCheckInEnabled?: boolean;
    visitorGuestCheckInEnabled?: boolean;
  }) => {
    setSavingLobbyFlags(true);
    try {
      const now = Date.now();
      const nextVendor = patch.vendorCheckInEnabled ?? vendorLobbyEnabled;
      const nextGuest = patch.visitorGuestCheckInEnabled ?? guestLobbyEnabled;
      if (!kioskLobbyRow) {
        const newId = id();
        await db.transact([
          tx.kioskLobbySettings[newId].update({
            key: KIOSK_LOBBY_SETTINGS_KEY,
            vendorCheckInEnabled: nextVendor,
            visitorGuestCheckInEnabled: nextGuest,
            updatedAt: now,
          }),
        ]);
      } else {
        await db.transact([
          tx.kioskLobbySettings[kioskLobbyRow.id].update({
            vendorCheckInEnabled: nextVendor,
            visitorGuestCheckInEnabled: nextGuest,
            updatedAt: now,
          }),
        ]);
      }
      toast.success("Lobby settings saved.");
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to save settings.");
    } finally {
      setSavingLobbyFlags(false);
    }
  };

  const options = (data?.visitOptions || []) as Array<{
    id: string;
    label: string;
    category: string;
    sortOrder: number;
    isActive: boolean;
    hostEmail?: string;
  }>;

  const whoOptions = options
    .filter((o) => o.category === "who")
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const whyOptions = options
    .filter((o) => o.category === "why")
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const companyOptions = options
    .filter((o) => o.category === "company")
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

  const approvalNotifyRecipients = (data?.visitorApprovalNotifyRecipients ||
    []) as Array<{
    id: string;
    email: string;
    name: string;
    sortOrder: number;
    createdAt: number;
  }>;

  const sortedApprovalNotifyRecipients = useMemo(() => {
    return [...approvalNotifyRecipients].sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
    );
  }, [approvalNotifyRecipients]);

  const approvedPrecheckRequests = (
    approvedPrecheckData?.visitorPrecheckRequests || []
  ) as Array<{
    id: string;
    token: string;
    email: string;
    status: string;
    invitedName?: string;
    visitorFirstName?: string;
    visitorLastName?: string;
    visitorCompanyName?: string;
    who: string;
    reason: string;
    otherDetails: string;
    visitDate: number;
    submittedAt: number;
    approvedAt: number;
    approvedBy?: string;
    visitorBarcode: string;
    visitorUserId: string;
  }>;

  const sortedApprovedPrecheckRequests = useMemo(() => {
    return [...approvedPrecheckRequests].sort(
      (a, b) => (b.approvedAt ?? 0) - (a.approvedAt ?? 0)
    );
  }, [approvedPrecheckRequests]);

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
  const [removeApprovedModal, setRemoveApprovedModal] = useState<null | {
    requestId: string;
  }>(null);
  const [isRemovingApproved, setIsRemovingApproved] = useState(false);

  const staleDeleteRequest =
    staleDeleteModal &&
    pendingRequests.find((r) => r.id === staleDeleteModal.requestId);

  const removeApprovedRequest =
    removeApprovedModal &&
    approvedPrecheckRequests.find((r) => r.id === removeApprovedModal.requestId);

  const removeApprovedPrecheckVisitor = async (requestId: string) => {
    const req = approvedPrecheckRequests.find((r) => r.id === requestId);
    if (!req) {
      toast.error("Record not found.");
      return;
    }
    const uid = (req.visitorUserId || "").trim();
    const precheckToken = (req.token || "").trim();
    setIsRemovingApproved(true);
    try {
      const ops = [];
      if (precheckToken) {
        ops.push(
          tx.revokedPrecheckTokens[id()].update({
            token: precheckToken,
            revokedAt: Date.now(),
            reason: "approved_record_removed",
          })
        );
      }
      ops.push(tx.visitorPrecheckRequests[req.id].delete());
      if (uid) {
        ops.push(tx.visitors[uid].delete());
        ops.push(tx.users[uid].delete());
      }
      await db.transact(ops);
      toast.success(
        uid
          ? "Visitor removed from the database."
          : "Pre-check record removed (no linked kiosk user was stored)."
      );
      setRemoveApprovedModal(null);
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Something went wrong.";
      toast.error(message);
    } finally {
      setIsRemovingApproved(false);
    }
  };

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
            source:
              req.requestSource === "admin" ? "admin" : "kiosk_email",
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

      const precheckToken = (req.token || "").trim();
      const revokeOps = precheckToken
        ? [
            tx.revokedPrecheckTokens[id()].update({
              token: precheckToken,
              revokedAt: Date.now(),
              reason: "pending_request_removed",
            }),
          ]
        : [];
      await db.transact([
        ...revokeOps,
        tx.visitorPrecheckRequests[req.id].delete(),
      ]);
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

    const hostEmailTrimmed = newOptionHostEmail.trim();
    if (category === "who" && hostEmailTrimmed && !hostEmailTrimmed.includes("@")) {
      toast.error("Enter a valid host notify email or leave it blank.");
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
          hostEmail: category === "who" ? hostEmailTrimmed : "",
          sortOrder,
          isActive: true,
          createdAt: now,
        }),
      ]);
      toast.success("Visitor option added.");
      setLabel("");
      setNewOptionHostEmail("");
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
      setSendVisitorProtocol(true);
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

  const handleAddApprovalNotifyRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = notifyEmail.trim().toLowerCase();
    const name = notifyName.trim();
    if (!email || !email.includes("@")) {
      toast.error("Enter a valid email.");
      return;
    }
    setIsSavingNotifyRecipient(true);
    try {
      const maxOrder = approvalNotifyRecipients.reduce(
        (m, r) => Math.max(m, r.sortOrder ?? 0),
        0
      );
      const now = Date.now();
      await db.transact([
        tx.visitorApprovalNotifyRecipients[id()].update({
          email,
          name: name || email,
          sortOrder: maxOrder + 1,
          createdAt: now,
        }),
      ]);
      toast.success("Recipient added.");
      setNotifyEmail("");
      setNotifyName("");
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Failed to add recipient.";
      toast.error(message);
    } finally {
      setIsSavingNotifyRecipient(false);
    }
  };

  const removeApprovalNotifyRecipient = async (recipientId: string) => {
    try {
      await db.transact([tx.visitorApprovalNotifyRecipients[recipientId].delete()]);
      toast.success("Recipient removed.");
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Failed to remove.";
      toast.error(message);
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

  if (isLoading || approvedPrecheckLoading) {
    return <div>Loading visitor settings...</div>;
  }
  if (error || approvedPrecheckError) {
    return (
      <div>
        Error loading visitor settings:{" "}
        {(error || approvedPrecheckError)?.message}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AdminCollapsible
        title="Lobby kiosk (main page)"
        open={adminSec.lobby}
        onToggle={() => setAdminSec((s) => ({ ...s, lobby: !s.lobby }))}
      >
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
          Turn the lobby buttons on or off. When off, guests still see a short message
          instead of the form. Admin invite and approvals below are not affected.
        </p>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-200 bg-white px-3 py-3 dark:border-gray-600 dark:bg-gray-800">
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Visitor / guest self-registration
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Green &quot;Visitor? Register here&quot; on the main page
              </div>
            </div>
            <Switch
              isChecked={guestLobbyEnabled}
              onChange={() =>
                persistKioskLobby({
                  visitorGuestCheckInEnabled: !guestLobbyEnabled,
                })
              }
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-200 bg-white px-3 py-3 dark:border-gray-600 dark:bg-gray-800">
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Vendor check-in / checkout
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Blue vendor button on the main page
              </div>
            </div>
            <Switch
              isChecked={vendorLobbyEnabled}
              onChange={() =>
                persistKioskLobby({
                  vendorCheckInEnabled: !vendorLobbyEnabled,
                })
              }
            />
          </div>
        </div>
        {savingLobbyFlags ? (
          <p className="mt-2 text-xs text-gray-500">Saving…</p>
        ) : null}
      </AdminCollapsible>

      <AdminCollapsible
        title="Vendor companies and visit reasons"
        open={adminSec.vendors}
        onToggle={() => setAdminSec((s) => ({ ...s, vendors: !s.vendors }))}
      >
        <VendorAdminSection />
      </AdminCollapsible>

      <AdminCollapsible
        title="Send Visitor Pre-Check Invite"
        open={adminSec.invite}
        onToggle={() => setAdminSec((s) => ({ ...s, invite: !s.invite }))}
      >
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
      </AdminCollapsible>

      <AdminCollapsible
        title="Visitor options (Who / Why / Company)"
        open={adminSec.options}
        onToggle={() => setAdminSec((s) => ({ ...s, options: !s.options }))}
      >
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
          Manage the dropdown options for who visitors are seeing, why they&apos;re visiting,
          and which company they represent. These appear on the pre-check form.
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
              onValueChange={(v) => {
                setCategory(v as "who" | "why" | "company");
                if (v !== "who") setNewOptionHostEmail("");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="who">Who (host / whom)</SelectItem>
                <SelectItem value="why">Why (reason for visit)</SelectItem>
                <SelectItem value="company">Company</SelectItem>
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
          {category === "who" ? (
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Host notify email (optional)
              </label>
              <Input
                type="email"
                value={newOptionHostEmail}
                onChange={(e) => setNewOptionHostEmail(e.target.value)}
                placeholder="host@company.com"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                This person receives an email to approve or decline when a visitor picks
                them in pre-check.
              </p>
            </div>
          ) : null}
          <div className="sm:col-span-4">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Add Option"}
            </Button>
          </div>
        </form>

        <div className="grid gap-6 sm:grid-cols-3">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
              Who (Host / Whom)
            </h3>
            {whoOptions.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No options yet. Add some above.
              </p>
            )}
            <ul className="space-y-3">
              {whoOptions.map((opt) => (
                <WhoHostOptionRow
                  key={opt.id}
                  opt={opt}
                  onToggleActive={toggleActive}
                />
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
          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
              Company
            </h3>
            {companyOptions.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No options yet. Add some above.
              </p>
            )}
            <ul className="space-y-2">
              {companyOptions.map((opt) => (
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
      </AdminCollapsible>

      <AdminCollapsible
        title="Internal approval notifications"
        open={adminSec.notify}
        onToggle={() => setAdminSec((s) => ({ ...s, notify: !s.notify }))}
      >
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
          Recipients listed below receive a summary email when a visitor pre-check is{" "}
          <strong>approved</strong> (after the visitor receives kiosk check-in credentials).
          They are not notified of pending requests or rejections.
        </p>
        <form
          onSubmit={handleAddApprovalNotifyRecipient}
          className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
        >
          <div className="min-w-0 flex-1 sm:max-w-xs">
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              Name
            </label>
            <Input
              type="text"
              value={notifyName}
              onChange={(e) => setNotifyName(e.target.value)}
              placeholder="e.g. Security desk"
              className="text-sm"
            />
          </div>
          <div className="min-w-0 flex-1 sm:max-w-xs">
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              Email
            </label>
            <Input
              type="email"
              value={notifyEmail}
              onChange={(e) => setNotifyEmail(e.target.value)}
              placeholder="notify@company.com"
              className="text-sm"
            />
          </div>
          <Button type="submit" disabled={isSavingNotifyRecipient} size="sm">
            {isSavingNotifyRecipient ? "Adding…" : "Add recipient"}
          </Button>
        </form>
        {sortedApprovalNotifyRecipients.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No recipients configured. Add an email address to enable internal notifications
            when visits are approved.
          </p>
        ) : (
          <ul className="space-y-2">
            {sortedApprovalNotifyRecipients.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
              >
                <div>
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {r.name || r.email}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{r.email}</div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeApprovalNotifyRecipient(r.id)}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </AdminCollapsible>

      <AdminCollapsible
        title="Visitor pre-check approvals"
        open={adminSec.approvals}
        onToggle={() => setAdminSec((s) => ({ ...s, approvals: !s.approvals }))}
      >
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
                    {req.requestSource === "kiosk_register" ? (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        kiosk register (on device)
                      </div>
                    ) : req.requestSource === "kiosk_email" ||
                      req.requestSource === "kiosk" ? (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        kiosk link (email)
                      </div>
                    ) : req.requestSource === "admin" ? (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        admin invitation
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
              Note: you&apos;ll need to send this visitor another pre-check invite if
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

                      await fetch(
                        "/api/visitor/precheck/send-approval-internal-notify",
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            visitorName: approvedVisitorName,
                            visitorEmail: req.email,
                            visitorCompany: approvedCompany,
                            who: req.who,
                            reason: req.reason,
                            whenTs: req.visitDate,
                            details: req.otherDetails || "",
                            requestSource: req.requestSource || "admin",
                            approvedBy: "admin",
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
      </AdminCollapsible>

      <AdminCollapsible
        title="Pre-checked visitors (approved)"
        open={adminSec.approved}
        onToggle={() => setAdminSec((s) => ({ ...s, approved: !s.approved }))}
      >
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
          Visitors who were approved through pre-check have kiosk accounts and barcodes.
          Remove a row to delete their pre-check record and kiosk user so they can no
          longer check in with that pass.
        </p>

        {sortedApprovedPrecheckRequests.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No approved pre-check visitors right now.
          </p>
        ) : (
          <div className="space-y-3">
            {sortedApprovedPrecheckRequests.map((req) => {
              const approvedDaysAgo = formatApprovedDaysAgo(req.approvedAt);
              return (
              <div
                key={req.id}
                className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
              >
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
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Barcode: {req.visitorBarcode?.trim() || "—"}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Approved:{" "}
                      {req.approvedAt
                        ? new Date(req.approvedAt).toLocaleString()
                        : "—"}
                      {req.approvedBy === "host"
                        ? " (by host)"
                        : req.approvedBy === "admin"
                          ? " (by admin)"
                          : ""}
                    </div>
                    {approvedDaysAgo ? (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {approvedDaysAgo}
                      </div>
                    ) : null}
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
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={
                      isActionSending ||
                      isStaleDeleteWorking ||
                      isRemovingApproved
                    }
                    onClick={() => setRemoveApprovedModal({ requestId: req.id })}
                    className="border-red-500 text-red-600 hover:bg-red-50 dark:border-red-500 dark:text-red-300 sm:shrink-0"
                  >
                    Remove from database
                  </Button>
                </div>
              </div>
            );
            })}
          </div>
        )}

        {removeApprovedModal ? (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50/90 p-4 shadow-sm dark:border-red-900/60 dark:bg-red-950/35">
            <h3 className="mb-2 text-lg font-semibold text-red-950 dark:text-red-50">
              Remove this visitor?
            </h3>
            <p className="mb-3 text-sm leading-relaxed text-red-950/90 dark:text-red-100/90">
              This deletes the approved pre-check record and the kiosk user (and visitor
              profile) tied to it. Their barcode will stop working at the kiosk.
            </p>
            {removeApprovedRequest ? (
              <p className="mb-4 rounded-md border border-red-200/80 bg-white/70 px-3 py-2 text-sm font-medium text-red-950 dark:border-red-800/50 dark:bg-red-950/30 dark:text-red-50">
                {visitorPrecheckDisplayName({
                  visitorFirstName: removeApprovedRequest.visitorFirstName,
                  visitorLastName: removeApprovedRequest.visitorLastName,
                  invitedName: removeApprovedRequest.invitedName,
                  email: removeApprovedRequest.email,
                })}
                <span className="font-normal text-red-800/90 dark:text-red-200/90">
                  {" "}
                  · {removeApprovedRequest.email}
                </span>
              </p>
            ) : (
              <p className="mb-4 text-sm text-red-800 dark:text-red-200">
                This record is no longer in the list — close this dialog.
              </p>
            )}
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button
                type="button"
                className="bg-red-600 hover:bg-red-700"
                disabled={isRemovingApproved || !removeApprovedRequest}
                onClick={() =>
                  removeApprovedPrecheckVisitor(removeApprovedModal.requestId)
                }
              >
                {isRemovingApproved ? "Removing..." : "Yes, remove"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isRemovingApproved}
                onClick={() => setRemoveApprovedModal(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </AdminCollapsible>
    </div>
  );
}

