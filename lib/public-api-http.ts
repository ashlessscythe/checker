import { NextResponse } from "next/server";

export function jsonError(
  error: string,
  status: number,
  extraHeaders?: HeadersInit
) {
  return NextResponse.json({ error }, { status, headers: extraHeaders });
}

export function methodNotAllowed(allow = "GET") {
  return jsonError("Method not allowed", 405, { Allow: allow });
}
