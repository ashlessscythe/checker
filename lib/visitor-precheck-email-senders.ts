import { Resend } from "resend";
import QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatVisitorPrecheckWhen } from "@/lib/visitor-precheck-datetime";
import { visitorPrecheckDisplayName } from "@/lib/visitor-precheck-display";
import {
  visitorPrecheckApprovedByLabel,
  visitorPrecheckRequestSourceLabel,
} from "@/lib/visitor-precheck-notify-labels";

type AdminAPI = ReturnType<
  typeof import("@/lib/instantdb-admin").requireAdminAPI
>;

const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail = process.env.RESEND_FROM_EMAIL;

async function makeQrPngBuffer(value: string) {
  const dataUrl = await QRCode.toDataURL(value, { margin: 1, width: 256 });
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
  return Buffer.from(base64, "base64");
}

async function makePassPdf({
  barcode,
  visitorName,
  visitorCompany,
  who,
  reason,
  whenTs,
  details,
}: {
  barcode: string;
  visitorName: string;
  visitorCompany: string;
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
  page.drawText(`Visitor: ${visitorName}`, { x: 60, y, size: 12, font });
  y -= 16;
  page.drawText(`Company: ${visitorCompany?.trim() || "—"}`, {
    x: 60,
    y,
    size: 12,
    font,
  });
  y -= 16;
  page.drawText(`Visiting: ${who}`, { x: 60, y, size: 12, font });
  y -= 16;
  page.drawText(`Reason: ${reason}`, { x: 60, y, size: 12, font });
  y -= 16;
  page.drawText(`When: ${formatVisitorPrecheckWhen(whenTs)}`, {
    x: 60,
    y,
    size: 12,
    font,
  });

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

export async function sendVisitorPrecheckApprovalEmail(
  body: Record<string, unknown>
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!resendApiKey || !resendFromEmail) {
    return { ok: true };
  }

  const email = (body?.email as string | undefined)?.trim().toLowerCase();
  const barcode = body?.barcode as string | undefined;
  const who = body?.who as string | undefined;
  const reason = body?.reason as string | undefined;
  const whenTs = body?.whenTs as number | undefined;
  const details = (body?.details as string | undefined) ?? "";
  const adminMessage = (body?.adminMessage as string | undefined) ?? "";
  const visitorName = ((body?.visitorName as string | undefined) ?? "").trim() || email;
  const visitorCompany = (body?.visitorCompany as string | undefined)?.trim() ?? "";

  if (!email || !barcode || !who || !reason || !whenTs) {
    return { ok: false, error: "Missing required fields for approval email." };
  }

  try {
    const resend = new Resend(resendApiKey);
    const qrDataUrl = await QRCode.toDataURL(barcode, { margin: 1, width: 240 });

    const pdfBuffer = await makePassPdf({
      barcode,
      visitorName,
      visitorCompany,
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
                  Hi <strong>${visitorName}</strong>,<br/>
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

                <p style="font-size: 14px; margin: 0 0 8px; color: #374151;"><strong>Visitor:</strong> ${visitorName}</p>
                <p style="font-size: 14px; margin: 0 0 8px; color: #374151;"><strong>Company:</strong> ${visitorCompany || "—"}</p>
                <p style="font-size: 14px; margin: 0 0 8px; color: #374151;"><strong>Visiting:</strong> ${who}</p>
                <p style="font-size: 14px; margin: 0 0 8px; color: #374151;"><strong>Reason:</strong> ${reason}</p>
                <p style="font-size: 14px; margin: 0 0 16px; color: #374151;"><strong>When:</strong> ${formatVisitorPrecheckWhen(
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

    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to send approval email.";
    return { ok: false, error: message };
  }
}

export async function sendVisitorPrecheckRejectionEmail(
  body: Record<string, unknown>
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!resendApiKey || !resendFromEmail) {
    return { ok: true };
  }

  const email = (body?.email as string | undefined)?.trim().toLowerCase();
  const rejectionMessage = (body?.rejectionMessage as string | undefined) ?? "";
  const details = (body?.details as string | undefined) ?? "";
  const visitorFirstName = (body?.visitorFirstName as string | undefined)?.trim() ?? "";
  const visitorLastName = (body?.visitorLastName as string | undefined)?.trim() ?? "";
  const visitorCompanyName = (body?.visitorCompanyName as string | undefined)?.trim() ?? "";
  const invitedName = (body?.invitedName as string | undefined)?.trim();

  const visitorDisplayName = visitorPrecheckDisplayName({
    visitorFirstName,
    visitorLastName,
    invitedName: invitedName || undefined,
    email,
  });

  if (!email) {
    return { ok: false, error: "Missing email for rejection email." };
  }

  try {
    const resend = new Resend(resendApiKey);

    const defaultLetter = `
      <p style="font-size: 14px; margin: 0 0 8px; color: #374151;">
        Hi <strong>${visitorDisplayName}</strong>,
      </p>
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
                <p style="font-size: 12px; color: #6b7280; margin: 0 0 6px;"><strong>Company on file:</strong> ${visitorCompanyName || "—"}</p>
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

    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to send rejection email.";
    return { ok: false, error: message };
  }
}

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

export async function sendVisitorPrecheckApprovalInternalNotify(
  adminAPI: AdminAPI,
  body: Record<string, unknown>
): Promise<{ ok: true; sent: number } | { ok: false; error: string }> {
  if (!resendApiKey || !resendFromEmail) {
    return { ok: true, sent: 0 };
  }

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
    return { ok: false, error: "Missing required fields for internal approval notify." };
  }

  try {
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
      return { ok: true, sent: 0 };
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

    return { ok: true, sent: recipients.length };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to send internal notify.";
    return { ok: false, error: message };
  }
}
