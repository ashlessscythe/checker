import { NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs";

const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail = process.env.RESEND_FROM_EMAIL;

export async function POST(req: Request) {
  if (!resendApiKey || !resendFromEmail) {
    return NextResponse.json({ ok: true });
  }

  try {
    const resend = new Resend(resendApiKey);
    const body = await req.json();

    const email = (body?.email as string | undefined)?.trim().toLowerCase();
    const rejectionMessage = (body?.rejectionMessage as string | undefined) ?? "";
    const details = (body?.details as string | undefined) ?? "";

    if (!email) {
      return NextResponse.json(
        { error: "Missing email for rejection email." },
        { status: 400 }
      );
    }

    const defaultLetter = `
      <p style="font-size: 14px; margin: 0 0 8px; color: #374151;">
        Your visitor pre-check request wasn&apos;t approved.
      </p>
      <p style="font-size: 14px; margin: 0 0 16px; color: #374151;">
        Please contact the company administrator for assistance.
      </p>
    `;

    const customLetter = rejectionMessage.trim()
      ? `<p style="font-size: 14px; margin: 0 0 16px; color: #374151;"><strong>Administrator message:</strong> ${rejectionMessage}</p>`
      : "";

    const html = `
      <html>
        <body style="font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif; background-color: #f3f4f6; padding: 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">
            <tr>
              <td style="background-color: #ffffff; border-radius: 8px; padding: 24px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);">
                <h1 style="font-size: 20px; margin: 0 0 12px; color: #111827;">
                  Visitor pre-check not approved
                </h1>
                ${defaultLetter}
                ${customLetter}
                ${
                  details?.trim()
                    ? `<p style="font-size: 12px; color: #6b7280; margin: 0;">Your submitted details: ${details}</p>`
                    : ""
                }
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    await resend.emails.send({
      from: resendFromEmail,
      to: email,
      subject: "Update: visitor pre-check not approved",
      html,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to send rejection email." },
      { status: 500 }
    );
  }
}

