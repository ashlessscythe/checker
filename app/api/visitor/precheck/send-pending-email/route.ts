import { NextResponse } from "next/server";
import { Resend } from "resend";
import { visitorPrecheckDisplayName } from "@/lib/visitor-precheck-display";
import { formatVisitorPrecheckWhen } from "@/lib/visitor-precheck-datetime";

export const runtime = "nodejs";

const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail = process.env.RESEND_FROM_EMAIL;

const appBaseUrl =
  process.env.NEXT_PUBLIC_APP_BASE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export async function POST(req: Request) {
  if (!resendApiKey || !resendFromEmail) {
    return NextResponse.json({ ok: true });
  }

  try {
    const resend = new Resend(resendApiKey);
    const body = await req.json();

    const email = (body?.email as string | undefined)?.trim().toLowerCase();
    const token = body?.token as string | undefined;
    const who = body?.who as string | undefined;
    const reason = body?.reason as string | undefined;
    const whenTs = body?.whenTs as number | undefined;
    const details = (body?.details as string | undefined) ?? "";
    const visitorFirstName =
      (body?.visitorFirstName as string | undefined)?.trim() ?? "";
    const visitorLastName =
      (body?.visitorLastName as string | undefined)?.trim() ?? "";
    const visitorCompanyName =
      (body?.visitorCompanyName as string | undefined)?.trim() ?? "";
    const invitedName = (body?.invitedName as string | undefined)?.trim();

    const visitorDisplayName = visitorPrecheckDisplayName({
      visitorFirstName,
      visitorLastName,
      invitedName: invitedName || undefined,
      email,
    });

    if (!email || !token || !who || !reason || !whenTs) {
      return NextResponse.json(
        { error: "Missing required fields for pending email." },
        { status: 400 }
      );
    }

    const editUrl = `${appBaseUrl}/visitor/precheck?token=${encodeURIComponent(
      token
    )}`;

    const html = `
      <html>
        <body style="font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif; background-color: #f3f4f6; padding: 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">
            <tr>
              <td style="background-color: #ffffff; border-radius: 8px; padding: 24px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);">
                <h1 style="font-size: 20px; margin: 0 0 12px; color: #111827;">
                  We received your visitor pre-check request
                </h1>
                <p style="font-size: 14px; margin: 0 0 16px; color: #374151;">
                  Hi <strong>${visitorDisplayName}</strong>,<br/>
                  Admin approval is required before your kiosk check-in can be completed.
                </p>

                <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">
                  <p style="font-size: 14px; margin: 0 0 6px; color: #374151;"><strong>Visitor:</strong> ${visitorDisplayName}</p>
                  <p style="font-size: 14px; margin: 0 0 6px; color: #374151;"><strong>Company:</strong> ${visitorCompanyName || "—"}</p>
                  <p style="font-size: 14px; margin: 0 0 6px; color: #374151;"><strong>Visiting:</strong> ${who}</p>
                  <p style="font-size: 14px; margin: 0 0 6px; color: #374151;"><strong>Reason:</strong> ${reason}</p>
                  <p style="font-size: 14px; margin: 0 0 6px; color: #374151;"><strong>When:</strong> ${formatVisitorPrecheckWhen(
                    whenTs
                  )}</p>
                  ${
                    details?.trim()
                      ? `<p style="font-size: 13px; margin: 10px 0 0; color: #6b7280;"><strong>Details:</strong> ${details}</p>`
                      : ""
                  }
                </div>

                <a href="${editUrl}"
                   style="display: inline-block; padding: 10px 20px; border-radius: 9999px; background-color: #2563eb; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; margin: 8px 0 16px;">
                  Edit my pre-check
                </a>

                <p style="font-size: 12px; color: #6b7280; margin: 0;">
                  If the button doesn&apos;t work, copy/paste this URL:<br/>
                  <span style="word-break: break-all;">${editUrl}</span>
                </p>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    await resend.emails.send({
      from: resendFromEmail,
      to: email,
      subject: "Pre-check received (edit details if needed)",
      html,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to send pending email." },
      { status: 500 }
    );
  }
}

