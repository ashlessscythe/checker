import { NextResponse } from "next/server";
import { Resend } from "resend";
import { id, tx } from "@instantdb/admin";
import { requireAdminAPI } from "@/lib/instantdb-admin";

const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail = process.env.RESEND_FROM_EMAIL;
const resend = resendApiKey && resendFromEmail ? new Resend(resendApiKey) : null;

/**
 * IANA zone for fire-drill email / CSV timestamps.
 * Prefer explicit override, then the same display TZ as visitor UI (`NEXT_PUBLIC_VISITOR_DISPLAY_TIMEZONE`),
 * then host `TZ`, else UTC.
 */
function reportTimeZone(): string {
  return (
    process.env.FIRE_DRILL_REPORT_TIMEZONE ||
    process.env.NEXT_PUBLIC_VISITOR_DISPLAY_TIMEZONE ||
    process.env.TZ ||
    "UTC"
  );
}

function formatReportInstant(ms: number): string {
  const timeZone = reportTimeZone();
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZoneName: "short",
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toISOString();
  }
}

function escapeCsv(value: unknown): string {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildCsv(rows: Array<Record<string, unknown>>): string {
  const headers = [
    "name",
    "department",
    "email",
    "status",
    "accountedBy",
    "accountedAt",
  ] as const;

  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      headers.map((h) => escapeCsv(r[h])).join(",")
    ),
  ];
  return lines.join("\n");
}

function buildHtmlTable(rows: Array<Record<string, unknown>>): string {
  const cell = (v: unknown) =>
    String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const headerCellStyle =
    "padding:10px 12px;text-align:left;background:#0b1220;color:#ffffff;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;border-bottom:1px solid #1f2a44;";
  const bodyCellStyle =
    "padding:10px 12px;font-size:13px;color:#0f172a;border-bottom:1px solid #e5e7eb;vertical-align:top;";

  const th = (label: string) => `<th style="${headerCellStyle}">${cell(label)}</th>`;
  const td = (value: unknown) => `<td style="${bodyCellStyle}">${cell(value)}</td>`;

  const statusPill = (status: unknown) => {
    const s = String(status ?? "");
    const isAccounted = s.toLowerCase() === "accounted";
    const bg = isAccounted ? "#dcfce7" : "#fee2e2";
    const fg = isAccounted ? "#166534" : "#991b1b";
    return `<span style="display:inline-block;padding:3px 8px;border-radius:999px;background:${bg};color:${fg};font-weight:600;font-size:12px;">${cell(
      s
    )}</span>`;
  };

  const header = `<tr>${[
    th("Name"),
    th("Department"),
    th("Email"),
    th("Status"),
    th("Accounted by"),
    th("Accounted at"),
  ].join("")}</tr>`;

  const body = rows
    .map((r, idx) => {
      const rowBg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
      return `<tr style="background:${rowBg};">${[
        td(r.name),
        td(r.department),
        td(r.email),
        `<td style="${bodyCellStyle}">${statusPill(r.status)}</td>`,
        td(r.accountedBy),
        td(r.accountedAt),
      ].join("")}</tr>`;
    })
    .join("");

  return `<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin-top:14px;">${header}${body}</table>`;
}

export async function POST(req: Request) {
  if (!resend || !resendApiKey || !resendFromEmail) {
    return NextResponse.json(
      { error: "Resend is not configured on the server." },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const sessionId = body?.sessionId as string | undefined;
    const to = body?.to as string[] | undefined;
    const subjectOverride = body?.subject as string | undefined;

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'sessionId'." },
        { status: 400 }
      );
    }
    if (!Array.isArray(to) || to.length === 0 || to.some((e) => typeof e !== "string")) {
      return NextResponse.json(
        { error: "Missing or invalid 'to' recipients." },
        { status: 400 }
      );
    }

    const adminAPI = requireAdminAPI();
    const data = await adminAPI.query({
      fireDrillSessions: {
        $: { where: { id: sessionId } },
      },
      fireDrillSessionParticipants: {
        $: { where: { sessionId } },
      },
      fireDrillAccounts: {
        $: { where: { sessionId } },
      },
      users: {
        $: {},
      },
      departments: {
        $: {},
      },
    });

    const session = (data as any)?.fireDrillSessions?.[0];
    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    const participants: Array<any> =
      (data as any)?.fireDrillSessionParticipants ?? [];
    const accounts: Array<any> = (data as any)?.fireDrillAccounts ?? [];
    const users: Array<any> = (data as any)?.users ?? [];
    const departments: Array<any> = (data as any)?.departments ?? [];

    const userById = new Map(users.map((u) => [u.id, u]));
    const deptById = new Map(departments.map((d) => [d.id, d]));

    const presentIds = participants
      .filter((p) => p.isPresentAtStart)
      .map((p) => p.userId)
      .filter(Boolean);

    const accountedByUserId = new Map<string, any>();
    for (const a of accounts) {
      if (!a?.userId) continue;
      if (a.status !== "accounted") continue;
      accountedByUserId.set(a.userId, a);
    }

    const rows = presentIds
      .map((uid: string) => {
        const u = userById.get(uid);
        const a = accountedByUserId.get(uid);
        const dept = u?.deptId ? deptById.get(u.deptId) : null;
        return {
          name: u?.name ?? "Unknown",
          department: dept?.name ?? "",
          email: u?.email ?? "",
          status: a ? "Accounted" : "Unaccounted",
          accountedBy: a?.accountedByName ?? "",
          accountedAt: a?.timestamp ? formatReportInstant(a.timestamp) : "",
        };
      })
      .sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)));

    const presentCount = presentIds.length;
    const accountedCount = Array.from(accountedByUserId.keys()).filter((uid) =>
      presentIds.includes(uid)
    ).length;
    const unaccountedCount = Math.max(0, presentCount - accountedCount);

    const startedAt = session?.startedAt
      ? formatReportInstant(session.startedAt)
      : "";
    const completedAt =
      session?.completedAt && session.completedAt > 0
        ? formatReportInstant(session.completedAt)
        : "";

    const subject =
      (subjectOverride && subjectOverride.trim()) ||
      `Fire drill report${startedAt ? ` - ${startedAt}` : ""}`;

    const summaryHtml = `
<div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;line-height:1.4;background:#f3f4f6;padding:24px;">
  <div style="max-width:900px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
    <div style="padding:18px 20px;background:linear-gradient(135deg,#0b1220,#1f2a44);color:#ffffff;">
      <div style="font-size:16px;font-weight:700;">Fire Drill Report</div>
      <div style="opacity:0.9;margin-top:4px;font-size:12px;">Session <span style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;">${sessionId}</span></div>
    </div>
    <div style="padding:18px 20px;">
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:12px;">
        <div style="flex:1;min-width:220px;padding:12px 14px;border:1px solid #e5e7eb;border-radius:12px;background:#f8fafc;">
          <div style="font-size:12px;color:#64748b;">Started</div>
          <div style="font-size:13px;font-weight:600;color:#0f172a;">${startedAt || "Unknown"}</div>
        </div>
        <div style="flex:1;min-width:220px;padding:12px 14px;border:1px solid #e5e7eb;border-radius:12px;background:#f8fafc;">
          <div style="font-size:12px;color:#64748b;">Completed</div>
          <div style="font-size:13px;font-weight:600;color:#0f172a;">${completedAt || "—"}</div>
        </div>
      </div>

      <div style="display:flex;flex-wrap:wrap;gap:10px;margin:10px 0 6px;">
        <div style="flex:1;min-width:160px;padding:12px 14px;border:1px solid #e5e7eb;border-radius:12px;">
          <div style="font-size:12px;color:#64748b;">Present</div>
          <div style="font-size:18px;font-weight:800;color:#0f172a;">${presentCount}</div>
        </div>
        <div style="flex:1;min-width:160px;padding:12px 14px;border:1px solid #e5e7eb;border-radius:12px;">
          <div style="font-size:12px;color:#64748b;">Accounted</div>
          <div style="font-size:18px;font-weight:800;color:#166534;">${accountedCount}</div>
        </div>
        <div style="flex:1;min-width:160px;padding:12px 14px;border:1px solid #e5e7eb;border-radius:12px;">
          <div style="font-size:12px;color:#64748b;">Unaccounted</div>
          <div style="font-size:18px;font-weight:800;color:#991b1b;">${unaccountedCount}</div>
        </div>
      </div>

      <div style="margin-top:14px;font-size:12px;color:#64748b;">
        CSV attachment included. All times use the <span style="font-family:ui-monospace,monospace;">${reportTimeZone()}</span> time zone.
      </div>
      ${buildHtmlTable(rows)}
      <div style="margin-top:16px;font-size:12px;color:#94a3b8;">
        Generated by Check-In System.
      </div>
    </div>
  </div>
</div>`;

    const html = summaryHtml;
    const csv = buildCsv(rows);
    const csvFilename = `fire-drill-${sessionId}.csv`;

    const { error: sendError } = await resend.emails.send({
      from: resendFromEmail,
      to,
      subject,
      html,
      attachments: [
        {
          filename: csvFilename,
          content: Buffer.from(csv, "utf8"),
        } as any,
      ],
    });

    if (sendError) {
      return NextResponse.json(
        { error: sendError.message ?? "Failed to send report via Resend." },
        { status: 500 }
      );
    }

    const now = Date.now();
    await adminAPI.transact([
      tx.fireDrillReportSends[id()].update({
        sessionId,
        sentAt: now,
        sentByUserId: "",
        recipientEmails: to,
        subject,
        summary: {
          presentCount,
          accountedCount,
          unaccountedCount,
        },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Unexpected error while sending report." },
      { status: 500 }
    );
  }
}

