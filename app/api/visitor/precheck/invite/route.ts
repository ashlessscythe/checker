import { NextResponse } from "next/server";
import { Resend } from "resend";
import crypto from "crypto";

const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail = process.env.RESEND_FROM_EMAIL;
const precheckSecret = process.env.PRECHECK_TOKEN_SECRET || "dev-precheck-secret";

// Prefer explicit public base URL; fall back to Vercel URL; then localhost
const appBaseUrl =
  process.env.NEXT_PUBLIC_APP_BASE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

const resend =
  resendApiKey && resendFromEmail ? new Resend(resendApiKey) : null;

function signPrecheckToken(email: string, issuedAt: number) {
  const payload = JSON.stringify({ email, iat: issuedAt });
  const payloadB64 = Buffer.from(payload, "utf8").toString("base64url");
  const sig = crypto
    .createHmac("sha256", precheckSecret)
    .update(payloadB64)
    .digest("base64url");
  return `${payloadB64}.${sig}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = (body?.email as string | undefined)?.trim().toLowerCase();

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 }
      );
    }

    const now = Date.now();
    const expiresAt = now + 24 * 60 * 60 * 1000; // 24 hours
    const token = signPrecheckToken(email, now);

    const precheckUrl = `${appBaseUrl}/visitor/precheck?token=${encodeURIComponent(
      token
    )}`;

    const expires = new Date(expiresAt).toLocaleString('en-US', { timeZone: 'America/Denver' });

    const html = `
      <html>
        <body style="font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif; background-color: #f3f4f6; padding: 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">
            <tr>
              <td style="background-color: #ffffff; border-radius: 8px; padding: 24px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);">
                <h1 style="font-size: 20px; margin-bottom: 16px; color: #111827;">
                  Complete your visitor pre-check
                </h1>
                <p style="font-size: 14px; margin-bottom: 12px; color: #374151;">
                  Please take a moment to complete your visitor pre-check before you arrive. This will speed up your check-in at the kiosk.
                </p>
                <p style="font-size: 14px; margin-bottom: 12px; color: #374151;">
                  This link is valid for <strong>24 hours</strong> from when this email was sent. If it expires, you'll need to request a new invitation from your host.
                </p>
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

    if (resend && resendFromEmail) {
      const { error } = await resend.emails.send({
        from: resendFromEmail,
        to: email,
        subject: "Your visitor pre-check link",
        html,
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

