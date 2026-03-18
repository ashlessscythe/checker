import { NextResponse } from "next/server";
import { Resend } from "resend";
import QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export const runtime = "nodejs";

const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail = process.env.RESEND_FROM_EMAIL;

function formatWhen(ts: number) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "";
  }
}

async function makeQrPngBuffer(value: string) {
  const dataUrl = await QRCode.toDataURL(value, { margin: 1, width: 256 });
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
  return Buffer.from(base64, "base64");
}

async function makePassPdf({
  barcode,
  who,
  reason,
  whenTs,
  details,
}: {
  barcode: string;
  who: string;
  reason: string;
  whenTs: number;
  details: string;
}) {
  const qrBuffer = await makeQrPngBuffer(barcode);

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 points
  const { width } = page.getSize();

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  let y = 800;
  page.drawText("Visitor Pre-Check Approved", {
    x: 60,
    y,
    size: 20,
    font: fontBold,
    color: rgb(0.07, 0.09, 0.14),
  });
  y -= 30;
  page.drawText(`Code: ${barcode}`, {
    x: 60,
    y,
    size: 12,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });

  y -= 22;
  page.drawText(`Who: ${who}`, { x: 60, y, size: 12, font });
  y -= 16;
  page.drawText(`Reason: ${reason}`, { x: 60, y, size: 12, font });
  y -= 16;
  page.drawText(`When: ${formatWhen(whenTs)}`, { x: 60, y, size: 12, font });

  if (details?.trim()) {
    y -= 22;
    page.drawText(`Details: ${details}`, { x: 60, y, size: 10, font });
  }

  y = 330;
  const qrImage = await pdfDoc.embedPng(new Uint8Array(qrBuffer));
  const qrSize = 220;
  page.drawImage(qrImage, {
    x: (width - qrSize) / 2,
    y,
    width: qrSize,
    height: qrSize,
  });

  page.drawText("Show this QR/code at the kiosk to check in.", {
    x: 60,
    y: 90,
    size: 10,
    font,
    color: rgb(0.35, 0.35, 0.35),
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

export async function POST(req: Request) {
  if (!resendApiKey || !resendFromEmail) {
    return NextResponse.json({ ok: true });
  }

  try {
    const resend = new Resend(resendApiKey);
    const body = await req.json();

    const email = (body?.email as string | undefined)?.trim().toLowerCase();
    const barcode = body?.barcode as string | undefined;
    const who = body?.who as string | undefined;
    const reason = body?.reason as string | undefined;
    const whenTs = body?.whenTs as number | undefined;
    const details = (body?.details as string | undefined) ?? "";
    const adminMessage = (body?.adminMessage as string | undefined) ?? "";

    if (!email || !barcode || !who || !reason || !whenTs) {
      return NextResponse.json(
        { error: "Missing required fields for approval email." },
        { status: 400 }
      );
    }

    const qrDataUrl = await QRCode.toDataURL(barcode, { margin: 1, width: 240 });

    const pdfBuffer = await makePassPdf({
      barcode,
      who,
      reason,
      whenTs,
      details,
    });

    const html = `
      <html>
        <body style="font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif; background-color: #f3f4f6; padding: 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">
            <tr>
              <td style="background-color: #ffffff; border-radius: 8px; padding: 24px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);">
                <h1 style="font-size: 20px; margin: 0 0 12px; color: #111827;">
                  Your visitor pre-check is approved
                </h1>
                <p style="font-size: 14px; margin: 0 0 12px; color: #374151;">
                  You&apos;re scheduled for your visit. Show the code below at the kiosk to check in.
                </p>

                <div style="border: 1px dashed #cbd5e1; border-radius: 8px; padding: 16px; text-align: center; margin: 16px 0;">
                  <div style="font-size: 12px; color: #6b7280; letter-spacing: .06em; text-transform: uppercase; margin-bottom: 6px;">
                    Visitor Code
                  </div>
                  <div style="font-size: 20px; font-weight: 700; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">
                    ${barcode}
                  </div>
                  <div style="margin-top: 12px;">
                    <img src="${qrDataUrl}" width="200" height="200" alt="QR code" style="display:block; margin:0 auto;"/>
                  </div>
                </div>

                <p style="font-size: 14px; margin: 0 0 8px; color: #374151;"><strong>Who:</strong> ${who}</p>
                <p style="font-size: 14px; margin: 0 0 8px; color: #374151;"><strong>Reason:</strong> ${reason}</p>
                <p style="font-size: 14px; margin: 0 0 16px; color: #374151;"><strong>When:</strong> ${formatWhen(
                  whenTs
                )}</p>

                ${
                  details?.trim()
                    ? `<p style="font-size: 14px; margin: 0 0 16px; color: #374151;"><strong>Details:</strong> ${details}</p>`
                    : ""
                }

                ${
                  adminMessage?.trim()
                    ? `<p style="font-size: 14px; margin: 0 0 16px; color: #374151;"><strong>Admin note:</strong> ${adminMessage}</p>`
                    : ""
                }

                <p style="font-size: 12px; color: #6b7280; margin-top: 16px;">
                  We&apos;ve attached a PDF pass for your records.
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
      subject: "Approved: your visitor pre-check",
      html,
      attachments: [
        {
          filename: "visitor-precheck-pass.pdf",
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to send approval email." },
      { status: 500 }
    );
  }
}

