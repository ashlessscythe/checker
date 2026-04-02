import { Resend } from "resend";
import { visitorPrecheckDisplayName } from "@/lib/visitor-precheck-display";
import { formatVisitorPrecheckWhen } from "@/lib/visitor-precheck-datetime";
import { signHostPrecheckReviewToken } from "@/lib/visitor-precheck-host-token";
import { waitForHostNotifyEmailRateLimit } from "@/lib/visitor-precheck-host-notify-rate-limit";

const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail = process.env.RESEND_FROM_EMAIL;

const appBaseUrl =
  process.env.NEXT_PUBLIC_APP_BASE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export type HostNotifyRequestPayload = {
  requestId: string;
  hostEmail: string;
  visitorRow: {
    email: string;
    visitorFirstName?: string;
    visitorLastName?: string;
    visitorCompanyName?: string;
    invitedName?: string;
    who: string;
    reason: string;
    otherDetails?: string;
    visitDate: number;
    requestSource?: string;
    submittedAt: number;
  };
};

export async function sendHostPrecheckNotificationEmail(
  payload: HostNotifyRequestPayload
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!resendApiKey || !resendFromEmail) {
    return { ok: true };
  }

  const {
    requestId,
    hostEmail,
    visitorRow: v,
  } = payload;

  const reviewToken = signHostPrecheckReviewToken(requestId);
  const reviewUrl = `${appBaseUrl.replace(/\/$/, "")}/visitor/host-review?t=${encodeURIComponent(reviewToken)}`;

  const visitorDisplayName = visitorPrecheckDisplayName({
    visitorFirstName: v.visitorFirstName,
    visitorLastName: v.visitorLastName,
    invitedName: v.invitedName,
    email: v.email,
  });

  const sourceLabel =
    v.requestSource === "kiosk_register"
      ? "Registered at the lobby check-in tablet"
      : v.requestSource === "admin"
        ? "Pre-check invitation (email link)"
        : "Lobby check-in screen (email link)";

  const whenFormatted = formatVisitorPrecheckWhen(v.visitDate);
  const whenDisplay =
    whenFormatted && whenFormatted.trim().length > 0 ? whenFormatted : "—";

  const submitted =
    typeof v.submittedAt === "number" && v.submittedAt > 0
      ? new Date(v.submittedAt).toLocaleString()
      : "—";

  const html = `
      <html>
        <body style="font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif; background-color: #f3f4f6; padding: 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">
            <tr>
              <td style="background-color: #ffffff; border-radius: 8px; padding: 24px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);">
                <h1 style="font-size: 20px; margin: 0 0 12px; color: #111827;">
                  Visitor pre-check needs your approval
                </h1>
                <p style="font-size: 14px; margin: 0 0 16px; color: #374151;">
                  Someone requested a visit listing you as the host. Please review the details and approve or decline.
                </p>

                <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">
                  <p style="font-size: 14px; margin: 0 0 6px; color: #374151;"><strong>Visitor:</strong> ${visitorDisplayName}</p>
                  <p style="font-size: 14px; margin: 0 0 6px; color: #374151;"><strong>Visitor email:</strong> ${v.email}</p>
                  <p style="font-size: 14px; margin: 0 0 6px; color: #374151;"><strong>Company:</strong> ${(v.visitorCompanyName || "").trim() || "—"}</p>
                  <p style="font-size: 14px; margin: 0 0 6px; color: #374151;"><strong>Visiting (host):</strong> ${v.who}</p>
                  <p style="font-size: 14px; margin: 0 0 6px; color: #374151;"><strong>Reason:</strong> ${v.reason}</p>
                  <p style="font-size: 14px; margin: 0 0 6px; color: #374151;"><strong>When:</strong> ${whenDisplay}</p>
                  <p style="font-size: 14px; margin: 0 0 6px; color: #374151;"><strong>Submitted:</strong> ${submitted}</p>
                  <p style="font-size: 14px; margin: 0 0 6px; color: #374151;"><strong>Request origin:</strong> ${sourceLabel}</p>
                  ${
                    v.otherDetails?.trim()
                      ? `<p style="font-size: 13px; margin: 10px 0 0; color: #6b7280;"><strong>Details:</strong> ${v.otherDetails}</p>`
                      : ""
                  }
                </div>

                <a href="${reviewUrl}"
                   style="display: inline-block; padding: 10px 20px; border-radius: 9999px; background-color: #059669; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; margin: 8px 0 16px;">
                  Review &amp; respond
                </a>

                <p style="font-size: 12px; color: #6b7280; margin: 0;">
                  If the button doesn&apos;t work, copy/paste this URL:<br/>
                  <span style="word-break: break-all;">${reviewUrl}</span>
                </p>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

  try {
    await waitForHostNotifyEmailRateLimit();
    const resend = new Resend(resendApiKey);
    await resend.emails.send({
      from: resendFromEmail,
      to: hostEmail,
      subject: `Visitor pre-check: ${visitorDisplayName} — action needed`,
      html,
    });
    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to send host email.";
    console.error("sendHostPrecheckNotificationEmail", err);
    return { ok: false, error: message };
  }
}
