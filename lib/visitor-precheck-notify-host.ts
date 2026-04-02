import { requireAdminAPI } from "@/lib/instantdb-admin";
import { lookupHostEmailForWhoLabel } from "@/lib/visitor-precheck-server-workflow";
import { sendHostPrecheckNotificationEmail } from "@/lib/visitor-precheck-send-host-email";

type PrecheckRow = {
  id: string;
  email: string;
  status: string;
  token?: string;
  requestSource?: string;
  invitedName?: string;
  visitorFirstName?: string;
  visitorLastName?: string;
  visitorCompanyName?: string;
  who: string;
  reason: string;
  otherDetails?: string;
  visitDate: number;
  submittedAt?: number;
};

/**
 * If the selected "who" maps to a visit option with hostEmail, email that host a review link.
 * Uses token-based lookup when `precheckToken` is set (validates id matches); otherwise loads by id.
 */
export async function notifyHostForPrecheckRequestIfConfigured(
  requestId: string,
  lookup: { precheckToken?: string } = {}
): Promise<void> {
  const adminAPI = requireAdminAPI();
  const whereClause = lookup.precheckToken
    ? { token: lookup.precheckToken }
    : { id: requestId };

  const rowData = await adminAPI.query({
    visitorPrecheckRequests: {
      $: {
        where: whereClause as { token: string } | { id: string },
      },
    },
  });

  const row = (rowData as { visitorPrecheckRequests?: PrecheckRow[] })
    ?.visitorPrecheckRequests?.[0];
  if (!row) return;
  if (lookup.precheckToken && row.id !== requestId) {
    console.warn("notifyHostForPrecheckRequestIfConfigured: request id does not match token");
    return;
  }
  if (row.status !== "pending") return;

  const hostEmail = await lookupHostEmailForWhoLabel(adminAPI, row.who);
  if (!hostEmail) return;

  await sendHostPrecheckNotificationEmail({
    requestId: row.id,
    hostEmail,
    visitorRow: {
      email: row.email,
      visitorFirstName: row.visitorFirstName,
      visitorLastName: row.visitorLastName,
      visitorCompanyName: row.visitorCompanyName,
      invitedName: row.invitedName,
      who: row.who,
      reason: row.reason,
      otherDetails: row.otherDetails,
      visitDate: row.visitDate,
      requestSource: row.requestSource,
      submittedAt: typeof row.submittedAt === "number" ? row.submittedAt : 0,
    },
  });
}
