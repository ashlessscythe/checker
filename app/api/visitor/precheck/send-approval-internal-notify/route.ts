import { NextResponse } from "next/server";
import { Resend } from "resend";
import { requireAdminAPI } from "@/lib/instantdb-admin";
import { formatVisitorPrecheckWhen } from "@/lib/visitor-precheck-datetime";
import {
  visitorPrecheckApprovedByLabel,
  visitorPrecheckRequestSourceLabel,
} from "@/lib/visitor-precheck-notify-labels";

export const runtime = "nodejs";

const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail = process.env.RESEND_FROM_EMAIL;

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type NotifyRecipientRow = {
  id: string;
  email?: string;
  name?: string;
  sortOrder?: number;
};

export async function POST(req: Request) {
  if (!resendApiKey || !resendFromEmail) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  try {
    const body = await req.json();
    const visitorName = ((body?.visitorName as string | undefined) ?? "").trim();
    const visitorEmail = ((body?.visitorEmail as string | undefined) ?? "").trim().toLowerCase();
    const visitorCompany = ((body?.visitorCompany as string | undefined) ?? "").trim();
    const who = ((body?.who as string | undefined) ?? "").trim();
    const reason = ((body?.reason as string | undefined) ?? "").trim();
    const whenTs = body?.whenTs as number | undefined;
    const details = ((body?.details as string | undefined) ?? "").trim();
    const requestSource = String(body?.requestSource ?? "");
    const approvedBy = String(body?.approvedBy ?? "");

    if (!visitorName || !who || !reason || typeof whenTs !== "number") {
      return NextResponse.json(
        { error: "Missing required fields for internal approval notify." },
        { status: 400 }
      );
    }

    const adminAPI = requireAdminAPI();
    const data = await adminAPI.query({
      visitorApprovalNotifyRecipients: { $: {} },
    });
    const rows = (data as { visitorApprovalNotifyRecipients?: NotifyRecipientRow[] })
      ?.visitorApprovalNotifyRecipients;
    const recipients = (rows || [])
      .map((r) => ({
        id: r.id,
        email: (r.email || "").trim().toLowerCase(),
        name: (r.name || "").trim(),
        sortOrder: typeof r.sortOrder === "number" ? r.sortOrder : 0,
      }))
      .filter((r) => r.email.includes("@"));

    if (recipients.length === 0) {
      return NextResponse.json({ ok: true, sent: 0 });
    }

    recipients.sort((a, b) => a.sortOrder - b.sortOrder || a.email.localeCompare(b.email));

    const whenFormatted = formatVisitorPrecheckWhen(whenTs) || "—";
    const approvedByLabel = escapeHtml(visitorPrecheckApprovedByLabel(approvedBy));
    const inviteMethodLabel = escapeHtml(visitorPrecheckRequestSourceLabel(requestSource));

    const resend = new Resend(resendApiKey);

    for (const rec of recipients) {
      const greet = escapeHtml(rec.name || rec.email.split("@")[0] || "there");
      const vName = escapeHtml(visitorName);
      const vEmail = visitorEmail ? escapeHtml(visitorEmail) : "";
      const vCompany = visitorCompany ? escapeHtml(visitorCompany) : "";
      const vWho = escapeHtml(who);
      const vReason = escapeHtml(reason);
      const vWhen = escapeHtml(whenFormatted);
      const vDetails = details ? escapeHtml(details) : "";

      const html = `
      <html>
        <body style="font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif; background-color: #f3f4f6; padding: 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">
            <tr>
              <td style="background-color: #ffffff; border-radius: 8px; padding: 24px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);">
                <p style="font-size: 15px; margin: 0 0 8px; color: #374151;">
                  Hello <strong>${greet}</strong>,
                </p>
                <p style="font-size: 15px; margin: 0 0 20px; color: #374151; line-height: 1.5;">
                  A visitor pre-check has been <strong>approved</strong>. The visitor has received their check-in credentials for the kiosk.
                </p>
                <p style="font-size: 12px; margin: 0 0 10px; color: #6b7280; letter-spacing: 0.04em; text-transform: uppercase;">
                  Visit summary
                </p>
                <table style="width:100%; font-size: 14px; color: #374151; border-collapse: collapse;">
                  <tr><td style="padding: 4px 0; vertical-align: top; width: 140px;"><strong>Visitor</strong></td><td style="padding: 4px 0;">${vName}${vEmail ? ` (${vEmail})` : ""}${vCompany ? `<br/><span style="color:#6b7280;">${vCompany}</span>` : ""}</td></tr>
                  <tr><td style="padding: 4px 0; vertical-align: top;"><strong>Host</strong></td><td style="padding: 4px 0;">${vWho}</td></tr>
                  <tr><td style="padding: 4px 0; vertical-align: top;"><strong>Purpose</strong></td><td style="padding: 4px 0;">${vReason}</td></tr>
                  <tr><td style="padding: 4px 0; vertical-align: top;"><strong>Scheduled time</strong></td><td style="padding: 4px 0;">${vWhen}</td></tr>
                  <tr><td style="padding: 4px 0; vertical-align: top;"><strong>Approved by</strong></td><td style="padding: 4px 0;">${approvedByLabel}</td></tr>
                  <tr><td style="padding: 4px 0; vertical-align: top;"><strong>Request origin</strong></td><td style="padding: 4px 0;">${inviteMethodLabel}</td></tr>
                  ${
                    vDetails
                      ? `<tr><td style="padding: 4px 0; vertical-align: top;"><strong>Details</strong></td><td style="padding: 4px 0;">${vDetails}</td></tr>`
                      : ""
                  }
                </table>
                <p style="font-size: 13px; margin: 24px 0 0; color: #6b7280; line-height: 1.5;">
                  Questions? Reply to this message or contact the approving administrator.
                </p>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

      await resend.emails.send({
        from: resendFromEmail,
        to: rec.email,
        subject: `Visitor pre-check approved: ${visitorName}`,
        html,
      });
    }

    return NextResponse.json({ ok: true, sent: recipients.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to send internal notify.";
    console.error("send-approval-internal-notify", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
