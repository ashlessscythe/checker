import { NextResponse } from "next/server";
import { id, tx } from "@instantdb/admin";
import { requireAdminAPI } from "@/lib/instantdb-admin";

const PROTOCOL_KEY = "default";
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const allowedMimeTypes = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
]);

export async function GET() {
  try {
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
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load visitor protocol." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
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
        byteSize,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to save visitor protocol." },
      { status: 500 }
    );
  }
}
