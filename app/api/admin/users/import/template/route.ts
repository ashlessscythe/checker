import { NextResponse } from "next/server";
import { templateCsvContent } from "@/lib/csv-user-import";

export const runtime = "nodejs";

export async function GET() {
  const body = templateCsvContent();
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="users-import-template.csv"',
      "Cache-Control": "no-store",
    },
  });
}
