import { NextResponse } from "next/server";
import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail = process.env.RESEND_FROM_EMAIL;

const resend =
  resendApiKey && resendFromEmail ? new Resend(resendApiKey) : null;

export async function POST(req: Request) {
  if (!resend || !resendApiKey || !resendFromEmail) {
    return NextResponse.json(
      { error: "Resend is not configured on the server." },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const to = body?.to as string | undefined;
    const fromKey = body?.fromKey as string | undefined;

    if (!to || typeof to !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'to' email address." },
        { status: 400 }
      );
    }

    // For now we only support a single "default" sender
    if (fromKey && fromKey !== "default") {
      return NextResponse.json(
        { error: "Invalid sender selection." },
        { status: 400 }
      );
    }

    const { error } = await resend.emails.send({
      from: resendFromEmail,
      to,
      subject: "Check-In System Notification",
      html: `<p>Hello,</p>
<p>This is a generic notification email sent from the Check-In System admin panel.</p>
<p>If you received this in error, you can safely ignore it.</p>
<p>Thanks,<br/>Check-In System</p>`,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message ?? "Failed to send email via Resend." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Unexpected error while sending email." },
      { status: 500 }
    );
  }
}

