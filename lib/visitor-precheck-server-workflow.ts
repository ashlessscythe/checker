import { id, tx } from "@instantdb/admin";
import { visitorPrecheckDisplayName } from "@/lib/visitor-precheck-display";

function generateVisitorBarcode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

type AdminAPI = ReturnType<
  typeof import("@/lib/instantdb-admin").requireAdminAPI
>;

export type PrecheckRequestRow = {
  id: string;
  email: string;
  status: string;
  requestSource?: string;
  invitedName?: string;
  visitorFirstName?: string;
  visitorLastName?: string;
  visitorCompanyName?: string;
  who: string;
  reason: string;
  otherDetails?: string;
  visitDate: number;
  token?: string;
};

const appBaseUrl =
  process.env.NEXT_PUBLIC_APP_BASE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

async function ensureVisitorDepartmentId(adminAPI: AdminAPI): Promise<string> {
  const deptData = await adminAPI.query({
    departments: {
      $: {
        where: { departmentId: "VISITOR" },
      },
    },
  });
  const list = (deptData as { departments?: Array<{ id: string }> })?.departments;
  if (!list || list.length === 0) {
    const visitorDeptId = id();
    await adminAPI.transact([
      tx.departments[visitorDeptId].update({
        name: "Visitors",
        departmentId: "VISITOR",
      }),
    ]);
    return visitorDeptId;
  }
  return list[0].id;
}

export async function approveVisitorPrecheckRequestServer(
  adminAPI: AdminAPI,
  requestRow: PrecheckRequestRow,
  opts: { actor: "admin" | "host"; message?: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (requestRow.status !== "pending") {
    return { ok: false, error: "This request is no longer pending." };
  }

  const now = Date.now();
  const barcode = generateVisitorBarcode();
  const visitorUserId = id();
  const approvedVisitorName = visitorPrecheckDisplayName({
    visitorFirstName: requestRow.visitorFirstName,
    visitorLastName: requestRow.visitorLastName,
    invitedName: requestRow.invitedName,
    email: requestRow.email,
  });
  const approvedCompany = (requestRow.visitorCompanyName || "").trim();
  const visitorDeptId = await ensureVisitorDepartmentId(adminAPI);
  const message = (opts.message ?? "").trim();

  await adminAPI.transact([
    tx.users[visitorUserId].update({
      name: approvedVisitorName,
      email: requestRow.email,
      barcode,
      isAdmin: false,
      isAuth: false,
      deptId: visitorDeptId,
      createdAt: now,
      serverCreatedAt: now,
      lastLoginAt: now,
      laptopSerial: "",
      purpose: requestRow.reason,
    }),
    tx.visitors[visitorUserId].update({
      name: approvedVisitorName,
      email: requestRow.email,
      barcode,
      visitDate: requestRow.visitDate,
      hostName: requestRow.who,
      reason: requestRow.reason,
      otherDetails: requestRow.otherDetails || "",
      createdAt: now,
      precheckedAt: now,
    }),
    tx.visitorPrecheckRequests[requestRow.id].update({
      status: "approved",
      approvedAt: now,
      approvedBy: opts.actor,
      adminMessage: message,

      visitorBarcode: barcode,
      visitorUserId,
      rejectedAt: 0,
      rejectedBy: "",
      rejectionMessage: "",
      requestSource: requestRow.requestSource || "admin",
      invitedName: requestRow.invitedName || requestRow.email,
      lastUpdatedAt: now,
    }),
  ]);

  try {
    await fetch(`${appBaseUrl}/api/visitor/precheck/send-approval-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: requestRow.email,
        barcode,
        visitorName: approvedVisitorName,
        visitorCompany: approvedCompany,
        who: requestRow.who,
        reason: requestRow.reason,
        whenTs: requestRow.visitDate,
        details: requestRow.otherDetails || "",
        adminMessage: message,
      }),
    });
  } catch (e) {
    console.error("approveVisitorPrecheckRequestServer: approval email fetch failed", e);
  }

  try {
    await fetch(`${appBaseUrl}/api/visitor/precheck/send-approval-internal-notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visitorName: approvedVisitorName,
        visitorEmail: requestRow.email,
        visitorCompany: approvedCompany,
        who: requestRow.who,
        reason: requestRow.reason,
        whenTs: requestRow.visitDate,
        details: requestRow.otherDetails || "",
        requestSource: requestRow.requestSource || "admin",
        approvedBy: opts.actor,
      }),
    });
  } catch (e) {
    console.error(
      "approveVisitorPrecheckRequestServer: internal approval notify fetch failed",
      e
    );
  }

  return { ok: true };
}

export async function rejectVisitorPrecheckRequestServer(
  adminAPI: AdminAPI,
  requestRow: PrecheckRequestRow,
  opts: { actor: "admin" | "host"; message?: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (requestRow.status !== "pending") {
    return { ok: false, error: "This request is no longer pending." };
  }

  const now = Date.now();
  const message = (opts.message ?? "").trim();

  await adminAPI.transact([
    tx.visitorPrecheckRequests[requestRow.id].update({
      status: "rejected",
      rejectedAt: now,
      rejectedBy: opts.actor,
      rejectionMessage: message,

      approvedAt: 0,
      approvedBy: "",
      adminMessage: "",

      visitorBarcode: "",
      visitorUserId: "",
      requestSource: requestRow.requestSource || "admin",
      invitedName: requestRow.invitedName || requestRow.email,
      lastUpdatedAt: now,
    }),
  ]);

  try {
    await fetch(`${appBaseUrl}/api/visitor/precheck/send-rejection-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: requestRow.email,
        rejectionMessage: message,
        details: requestRow.otherDetails || "",
        visitorFirstName: requestRow.visitorFirstName || "",
        visitorLastName: requestRow.visitorLastName || "",
        visitorCompanyName: requestRow.visitorCompanyName || "",
        invitedName: requestRow.invitedName || "",
      }),
    });
  } catch (e) {
    console.error("rejectVisitorPrecheckRequestServer: rejection email fetch failed", e);
  }

  return { ok: true };
}

export async function lookupHostEmailForWhoLabel(
  adminAPI: AdminAPI,
  whoLabel: string
): Promise<string | null> {
  const trimmed = whoLabel.trim();
  if (!trimmed) return null;

  const data = await adminAPI.query({
    visitOptions: {
      $: {
        where: { category: "who" },
      },
    },
  });
  const options = (data as unknown as {
    visitOptions?: Array<{ label?: string; hostEmail?: string }>;
  })?.visitOptions;
  if (!options?.length) return null;

  const match = options.find((o) => (o.label || "").trim() === trimmed);
  const email = (match?.hostEmail || "").trim().toLowerCase();
  if (!email || !email.includes("@")) return null;
  return email;
}
