import { NextResponse } from "next/server";
import { Resend } from "resend";
import { requireAdminAPI } from "@/lib/instantdb-admin";
import {
  signPrecheckToken,
  type PrecheckTokenSource,
} from "@/lib/visitor-precheck-token";

const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail = process.env.RESEND_FROM_EMAIL;

// Prefer explicit public base URL; fall back to Vercel URL; then localhost
const appBaseUrl =
  process.env.NEXT_PUBLIC_APP_BASE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

const resend =
  resendApiKey && resendFromEmail ? new Resend(resendApiKey) : null;

function parseInviteSource(raw: string | undefined): PrecheckTokenSource {
  if (raw === "admin") return "admin";
  if (raw === "kiosk_email" || raw === "kiosk") return "kiosk_email";
  return "kiosk_email";
}

export async function POST(req: Request) {
  try {
    const adminAPI = requireAdminAPI();
    const body = await req.json();
    const email = (body?.email as string | undefined)?.trim().toLowerCase();
    const nameRaw = (body?.name as string | undefined)?.trim();
    const name = nameRaw && nameRaw.length > 0 ? nameRaw : email;
    const source = parseInviteSource(body?.source as string | undefined);
    const sendVisitorProtocol = Boolean(body?.sendVisitorProtocol);

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 }
      );
    }

    const now = Date.now();
    const expiresAt = now + 24 * 60 * 60 * 1000; // 24 hours
    const protocolData = await adminAPI.query({
      visitorProtocolDocuments: {
        $: {
          where: { key: "default" },
        },
      },
    });
    const protocol = (protocolData as any)?.visitorProtocolDocuments?.[0];
    if (sendVisitorProtocol && !protocol) {
      return NextResponse.json(
        { error: "No visitor protocol is uploaded yet." },
        { status: 400 }
      );
    }
    const protocolRequired = source === "admin" && sendVisitorProtocol;
    const token = signPrecheckToken({
      email,
      name,
      source,
      protocolRequired,
      issuedAt: now,
    });

    const precheckUrl = `${appBaseUrl}/visitor/precheck?token=${encodeURIComponent(
      token
    )}`;

    const expires = new Date(expiresAt).toLocaleString("en-US", {
      timeZone: "America/Denver",
    });

    let html: string;
    let subject: string;

    if (source === "admin") {
      subject = "Your visitor pre-check link";
      html = `
      <html>
        <body style="font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif; background-color: #f3f4f6; padding: 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">
            <tr>
              <td style="background-color: #ffffff; border-radius: 8px; padding: 24px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);">
                <h1 style="font-size: 20px; margin-bottom: 12px; color: #111827;">
                  Complete your visitor pre-check
                </h1>
                <p style="font-size: 14px; margin: 0 0 16px; color: #374151;">
                  Hi <strong>${name}</strong>,<br/>
                  An administrator sent you a <strong>visitor pre-check link</strong> for our check-in system.
                </p>
                <p style="font-size: 14px; margin-bottom: 12px; color: #374151;">
                  Please take a moment to complete your visitor pre-check before you arrive. This will speed up your check-in at the kiosk.
                  You&apos;ll be asked your name, your company, and a few visit details.
                </p>
                <p style="font-size: 14px; margin-bottom: 12px; color: #374151;">
                  This link is valid for <strong>24 hours</strong> from when this email was sent. If it expires, ask your host to send a new invitation.
                </p>
                ${
                  protocolRequired
                    ? `<p style="font-size: 14px; margin-bottom: 12px; color: #374151;">
                  A visitor protocol is attached. You&apos;ll be required to acknowledge read and receipt on the pre-check form.
                </p>`
                    : ""
                }
                <p style="font-size: 14px; margin-bottom: 20px; color: #374151;">
                  Link expires at: <strong>${expires}</strong>
                </p>
                <a href="${precheckUrl}"
                   style="display: inline-block; padding: 10px 20px; border-radius: 9999px; background-color: #2563eb; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; margin-bottom: 16px;">
                  Start Pre-Check
                </a>
                <p style="font-size: 12px; color: #6b7280; margin-top: 16px;">
                  If the button above doesn't work, copy and paste this URL into your browser:<br />
                  <span style="word-break: break-all;">${precheckUrl}</span>
                </p>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;
    } else {
      // Kiosk “get link by email” — distinct from the admin invitation template
      subject = "Open this link to finish your visitor check-in";
      html = `
      <html>
        <body style="font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif; background-color: #f0fdf4; padding: 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">
            <tr>
              <td style="background-color: #ffffff; border-radius: 8px; padding: 24px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); border-top: 4px solid #16a34a;">
                <h1 style="font-size: 20px; margin-bottom: 12px; color: #14532d;">
                  Finish check-in from your phone or laptop
                </h1>
                <p style="font-size: 14px; margin: 0 0 16px; color: #374151;">
                  Hi <strong>${name}</strong>,<br/>
                  You requested a link from our <strong>lobby check-in screen</strong>. Use the button below on a device where you can complete a short form.
                </p>
                <p style="font-size: 14px; margin-bottom: 12px; color: #374151;">
                  After you submit, a staff member still needs to approve your visit. You&apos;ll get your visitor code by email once approved.
                </p>
                <p style="font-size: 14px; margin-bottom: 12px; color: #374151;">
                  This link works for <strong>24 hours</strong>. If it expires, tap &quot;Visitor&quot; again on the kiosk to get a new link.
                </p>
                <p style="font-size: 14px; margin-bottom: 20px; color: #374151;">
                  Expires: <strong>${expires}</strong>
                </p>
                <a href="${precheckUrl}"
                   style="display: inline-block; padding: 10px 20px; border-radius: 9999px; background-color: #16a34a; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; margin-bottom: 16px;">
                  Continue visitor check-in
                </a>
                <p style="font-size: 12px; color: #6b7280; margin-top: 16px;">
                  If the button doesn&apos;t work, copy this URL:<br />
                  <span style="word-break: break-all;">${precheckUrl}</span>
                </p>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;
    }

    if (resend && resendFromEmail) {
      const { error } = await resend.emails.send({
        from: resendFromEmail,
        to: email,
        subject,
        html,
        attachments:
          protocolRequired && protocol
            ? [
                {
                  filename: protocol.fileName,
                  content: protocol.contentBase64,
                  contentType: protocol.mimeType,
                },
              ]
            : undefined,
      });

      if (error) {
        return NextResponse.json(
          { error: error.message ?? "Failed to send pre-check email." },
          { status: 500 }
        );
      }
    } else {
      console.warn(
        "Resend is not configured; skipping actual email send but returning success."
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Unexpected error while sending pre-check." },
      { status: 500 }
    );
  }
}
