import { NextResponse } from "next/server";
import { requireAdminAPI } from "@/lib/instantdb-admin";
import {
  buildUserImportTransactions,
  validateCsvSize,
} from "@/lib/csv-user-import";

export const runtime = "nodejs";

const TX_CHUNK_SIZE = 50;

export async function POST(req: Request) {
  try {
    const adminAPI = requireAdminAPI();
    const body = await req.json().catch(() => null);
    const csvText =
      typeof body?.csvText === "string" ? body.csvText : "";
    const dryRun = Boolean(body?.dryRun);
    const overwrite = Boolean(body?.overwrite);
    const generateBarcodeIfBlank = body?.generateBarcodeIfBlank !== false;
    const createDepartmentIfMissing =
      body?.createDepartmentIfMissing === true;

    const sizeErr = validateCsvSize(csvText);
    if (sizeErr) {
      return NextResponse.json({ error: sizeErr }, { status: 400 });
    }

    const [deptData, userData] = await Promise.all([
      adminAPI.query({
        departments: { $: {} },
      }),
      adminAPI.query({
        users: { $: {} },
      }),
    ]);

    const departments =
      (deptData as {
        departments?: Array<{
          id: string;
          name: string;
          departmentId: string;
        }>;
      })?.departments ?? [];
    const existingUsers =
      (userData as {
        users?: Array<{
          id: string;
          email: string;
          createdAt?: number;
          barcode?: string | null;
        }>;
      })?.users ?? [];

    const result = buildUserImportTransactions({
      csvText,
      dryRun,
      overwrite,
      generateBarcodeIfBlank,
      createDepartmentIfMissing,
      departments,
      existingUsers,
    });

    if (result.departmentCatalogError) {
      return NextResponse.json(
        { error: result.departmentCatalogError },
        { status: 400 }
      );
    }

    if (!dryRun && result.transactions.length > 0) {
      for (let i = 0; i < result.transactions.length; i += TX_CHUNK_SIZE) {
        const slice = result.transactions.slice(i, i + TX_CHUNK_SIZE);
        await adminAPI.transact(slice as never[]);
      }
    }

    return NextResponse.json({
      ok: true,
      dryRun,
      overwrite,
      generateBarcodeIfBlank,
      createDepartmentIfMissing,
      departmentsCreatedCount: result.departmentsCreatedCount,
      createdCount: result.createdCount,
      updatedCount: result.updatedCount,
      skippedCount: result.skippedCount,
      rowErrors: result.rowErrors,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "User import failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
