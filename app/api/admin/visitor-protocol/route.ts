import { NextResponse } from "next/server";
import { id, tx } from "@instantdb/admin";
import { formatAdminApiError } from "@/lib/admin-api-error";
import { requireAdminAPI } from "@/lib/instantdb-admin";
import { requireSignedInAdmin } from "@/lib/require-signed-in-admin";

const PROTOCOL_KEY = "default";
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const allowedMimeTypes = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
]);

function matchesMagicBytes(buf: Buffer, mimeType: string): boolean {
  if (mimeType === "application/pdf") return buf.subarray(0, 5).toString("latin1") === "%PDF-";
  if (mimeType === "image/png")
    return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => buf[i] === b);
  if (mimeType === "image/jpeg") return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  return false;
}

export async function GET(req: Request) {
  try {
    const admin = await requireSignedInAdmin(req);
    if (admin.ok === false) return admin.response;
    const adminAPI = requireAdminAPI();
    const data = await adminAPI.query({
      visitorProtocolDocuments: {
        $: {
          where: { key: PROTOCOL_KEY },
        },
      },
    });
    const protocol = (data as any)?.visitorProtocolDocuments?.[0];
    if (!protocol) {
      return NextResponse.json({ ok: true, protocol: null });
    }
    return NextResponse.json({
      ok: true,
      protocol: {
        fileName: protocol.fileName,
        mimeType: protocol.mimeType,
        byteSize: protocol.byteSize,
        updatedAt: protocol.updatedAt,
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: formatAdminApiError(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireSignedInAdmin(req);
    if (admin.ok === false) return admin.response;
    const adminAPI = requireAdminAPI();
    const body = await req.json();
    const fileName = (body?.fileName as string | undefined)?.trim();
    const mimeType = (body?.mimeType as string | undefined)?.trim();
    const contentBase64 = (body?.contentBase64 as string | undefined)?.trim();
    const byteSize = Number(body?.byteSize || 0);

    if (!fileName || !mimeType || !contentBase64 || !byteSize) {
      return NextResponse.json(
        { error: "Missing required protocol fields." },
        { status: 400 }
      );
    }
    if (!allowedMimeTypes.has(mimeType)) {
      return NextResponse.json(
        { error: "Protocol type must be PDF, PNG, or JPG." },
        { status: 400 }
      );
    }
    if (byteSize > MAX_ATTACHMENT_BYTES) {
      return NextResponse.json(
        { error: "Protocol must be 5MB or smaller." },
        { status: 400 }
      );
    }

    // Don't trust the client-declared mime type/size: check the real bytes.
    const bytes = Buffer.from(contentBase64, "base64");
    if (bytes.length === 0 || bytes.length > MAX_ATTACHMENT_BYTES) {
      return NextResponse.json(
        { error: "Protocol must be 5MB or smaller." },
        { status: 400 }
      );
    }
    if (!matchesMagicBytes(bytes, mimeType)) {
      return NextResponse.json(
        { error: "File content does not match the declared type." },
        { status: 400 }
      );
    }

    const now = Date.now();
    const data = await adminAPI.query({
      visitorProtocolDocuments: {
        $: {
          where: { key: PROTOCOL_KEY },
        },
      },
    });
    const existing = (data as any)?.visitorProtocolDocuments?.[0];
    const docId = existing?.id || id();

    await adminAPI.transact([
      tx.visitorProtocolDocuments[docId].update({
        key: PROTOCOL_KEY,
        fileName,
        mimeType,
        contentBase64,
        byteSize: bytes.length,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: formatAdminApiError(error) },
      { status: 500 }
    );
  }
}
