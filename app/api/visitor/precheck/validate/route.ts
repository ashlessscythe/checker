import { NextResponse } from "next/server";
import crypto from "crypto";

const precheckSecret = process.env.PRECHECK_TOKEN_SECRET || "dev-precheck-secret";

function verifyPrecheckToken(token: string) {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  const expectedSig = crypto
    .createHmac("sha256", precheckSecret)
    .update(payloadB64)
    .digest("base64url");

  // Simple string comparison is sufficient for this non-auth critical flow
  if (expectedSig !== sig) {
    return null;
  }

  const json = Buffer.from(payloadB64, "base64url").toString("utf8");
  return JSON.parse(json) as { email: string; iat: number };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const token = body?.token as string | undefined;

    if (!token) {
      return NextResponse.json({ error: "Missing token." }, { status: 400 });
    }

    const payload = verifyPrecheckToken(token);
    if (!payload?.email || !payload?.iat) {
      return NextResponse.json({ error: "Invalid token." }, { status: 400 });
    }

    const now = Date.now();
    // Support both ms and seconds for issued-at to be robust across deployments
    let issuedAt = payload.iat;
    if (issuedAt < 1e12) {
      // Looks like seconds, convert to ms
      issuedAt = issuedAt * 1000;
    }
    const expiresAt = issuedAt + 24 * 60 * 60 * 1000;
    if (now > expiresAt) {
      return NextResponse.json(
        { error: "Token expired or already used." },
        { status: 400 }
      );
    }

    return NextResponse.json({ email: payload.email });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Unexpected error validating token." },
      { status: 500 }
    );
  }
}

