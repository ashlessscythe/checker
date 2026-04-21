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
const appBaseUrlRaw =
  process.env.NEXT_PUBLIC_APP_BASE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
const appBaseUrl = appBaseUrlRaw.replace(/\/+$/, "");

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
      subject = "Visitor pre-check — action needed";
      html = `
      <html>
        <body style="font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif; background-color: #f3f4f6; padding: 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">
            <tr>
              <td style="background-color: #ffffff; border-radius: 8px; padding: 24px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);">
                <h1 style="font-size: 18px; margin: 0 0 8px; color: #111827; line-height: 1.3;">
                  Visitor pre-check
                </h1>
                <p style="font-size: 14px; margin: 0 0 20px; color: #374151; line-height: 1.5;">
                  Hi <strong>${name}</strong> — before you arrive, complete a ~2 min form (your name, company, visit details) for faster lobby check-in. <strong>Link expires in 24 hours</strong> (ask your host for a new one if needed).
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 0 20px;">
                  <tr>
                    <td style="border-radius: 10px; background-color: #1d4ed8; box-shadow: 0 4px 14px rgba(29, 78, 216, 0.45);">
                      <a href="${precheckUrl}"
                         style="display: inline-block; padding: 16px 36px; font-size: 16px; font-weight: 700; letter-spacing: 0.02em; color: #ffffff; text-decoration: none; border-radius: 10px;">
                        Start pre-check
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="font-size: 13px; margin: 0 0 14px; color: #4b5563;">
                  Expires: <strong>${expires}</strong>
                </p>
                ${
                  protocolRequired
                    ? `<p style="font-size: 13px; margin: 0 0 16px; color: #4b5563; line-height: 1.45;">
                  Protocol attached — you&apos;ll confirm you&apos;ve read it on the form.
                </p>`
                    : ""
                }
                <p style="font-size: 12px; color: #6b7280; margin: 0;">
                  Button not working? Paste this URL into your browser:<br />
                  <span style="word-break: break-all;">${precheckUrl}</span>
                </p>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;
    } else {
      // Kiosk “get link by email” — same skim structure as admin; green accent
      subject = "Visitor check-in — action needed";
      html = `
      <html>
        <body style="font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif; background-color: #f0fdf4; padding: 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">
            <tr>
              <td style="background-color: #ffffff; border-radius: 8px; padding: 24px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); border-top: 4px solid #16a34a;">
                <h1 style="font-size: 18px; margin: 0 0 8px; color: #14532d; line-height: 1.3;">
                  Visitor check-in
                </h1>
                <p style="font-size: 14px; margin: 0 0 20px; color: #374151; line-height: 1.5;">
                  Hi <strong>${name}</strong> — you requested this from the <strong>lobby kiosk</strong>. ~2 min: your name, company, visit details. Staff approves your visit; you get your <strong>visitor code by email</strong>. <strong>Link expires in 24 hours</strong> — tap Visitor on the kiosk for a new link.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 0 20px;">
                  <tr>
                    <td style="border-radius: 10px; background-color: #15803d; box-shadow: 0 4px 14px rgba(21, 128, 61, 0.45);">
                      <a href="${precheckUrl}"
                         style="display: inline-block; padding: 16px 36px; font-size: 16px; font-weight: 700; letter-spacing: 0.02em; color: #ffffff; text-decoration: none; border-radius: 10px;">
                        Start pre-check
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="font-size: 13px; margin: 0 0 16px; color: #4b5563;">
                  Expires: <strong>${expires}</strong>
                </p>
                <p style="font-size: 12px; color: #6b7280; margin: 0;">
                  Button not working? Paste this URL into your browser:<br />
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
