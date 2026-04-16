/**
 * Bulk user CSV import — shared parsing, validation, and Instant transaction steps.
 * Used only from Node API routes; imports @instantdb/admin.
 *
 * Department name matching: trim + toLocaleLowerCase("en") on CSV and DB names (never case-sensitive).
 */

import { id, tx } from "@instantdb/admin";
import Papa from "papaparse";
import { generateValidBarcode } from "@/utils/barcodeVerification";
import { USER_IMPORT_CSV_HEADERS } from "./user-import-csv-columns";

export { USER_IMPORT_CSV_HEADERS } from "./user-import-csv-columns";

const MAX_CSV_BYTES = 1_000_000;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Normalizer for department names (CSV + DB). */
export function normalizeDeptName(s: string): string {
  return s.trim().toLocaleLowerCase("en");
}

export function normalizeEmail(s: string): string {
  return s.trim().toLowerCase();
}

function rowGet(row: Record<string, unknown>, key: string): string {
  for (const [k, v] of Object.entries(row)) {
    if (k.trim().toLowerCase() === key.toLowerCase()) {
      if (v == null) return "";
      return String(v).trim();
    }
  }
  return "";
}

export function parseBoolCell(raw: string): boolean {
  const v = raw.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "y";
}

export function templateCsvContent(): string {
  const header = USER_IMPORT_CSV_HEADERS.join(",");
  const example =
    "Jane Doe,jane.doe@example.com,JD001,false,Engineering";
  return `${header}\n${example}\n`;
}

export type DepartmentRow = { id: string; name: string; departmentId: string };

export type ExistingUserRow = {
  id: string;
  email: string;
  createdAt?: number;
  barcode?: string | null;
};

export type RowError = { line: number; message: string };

export type UserImportBuildResult = {
  departmentCatalogError: string | null;
  rowErrors: RowError[];
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  /** Departments that would be / were created for missing `department_name` values. */
  departmentsCreatedCount: number;
  transactions: unknown[];
};

function buildDepartmentIdByNormalizedName(
  departments: DepartmentRow[]
): { map: Map<string, string>; error: string | null } {
  const map = new Map<string, string>();
  for (const d of departments) {
    const key = normalizeDeptName(d.name);
    if (!key) continue;
    if (map.has(key)) {
      return {
        map: new Map(),
        error:
          "Duplicate department names in the database after case-insensitive match. Rename departments so each normalized name is unique before importing.",
      };
    }
    map.set(key, d.id);
  }
  return { map, error: null };
}

function collectExistingDepartmentCodes(
  departments: DepartmentRow[]
): Set<string> {
  const s = new Set<string>();
  for (const d of departments) {
    const x = String(d.departmentId ?? "").trim();
    if (x) s.add(x);
  }
  return s;
}

/**
 * Unique `departments.departmentId` for auto-created rows (schema requires a string).
 * Prefix avoids colliding with human-entered codes.
 */
function allocateUniqueDepartmentCode(
  displayName: string,
  taken: Set<string>
): string {
  const slugPart =
    normalizeDeptName(displayName)
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 32) || "dept";

  let candidate = `IMP_${slugPart.toUpperCase()}`;
  if (!taken.has(candidate)) {
    taken.add(candidate);
    return candidate;
  }
  for (let n = 0; n < 50; n++) {
    const suffix = id().replace(/-/g, "").slice(0, 8).toUpperCase();
    candidate = `IMP_${slugPart.slice(0, 20).toUpperCase()}_${suffix}`;
    if (!taken.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
  }
  throw new Error("Could not allocate a unique department code.");
}

export function validateCsvSize(csvText: string): string | null {
  const bytes = new TextEncoder().encode(csvText).length;
  if (bytes > MAX_CSV_BYTES) {
    return `CSV exceeds maximum size (${MAX_CSV_BYTES} bytes).`;
  }
  return null;
}

/**
 * Parses CSV, applies last-row-wins per normalized email, validates rows,
 * and returns Instant admin `tx` steps (creates + updates). No network I/O.
 */
function nextUniqueGeneratedBarcode(used: Set<string>): string {
  for (let attempt = 0; attempt < 500; attempt++) {
    const candidate = generateValidBarcode();
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }
  throw new Error("Could not allocate a unique barcode after many attempts.");
}

/**
 * Resolves barcode for a row: uses CSV value when non-blank; otherwise empty string,
 * or a new kiosk-style 20-char barcode when `generateIfBlank` is true.
 */
function resolveImportBarcode(params: {
  rawFromCsv: string;
  generateIfBlank: boolean;
  used: Set<string>;
}): string {
  const trimmed = params.rawFromCsv.trim();
  if (trimmed) return trimmed;
  if (!params.generateIfBlank) return "";
  return nextUniqueGeneratedBarcode(params.used);
}

export function buildUserImportTransactions(params: {
  csvText: string;
  dryRun: boolean;
  overwrite: boolean;
  /** When true, blank barcode cells get a new unique 20-char barcode (see generateValidBarcode). */
  generateBarcodeIfBlank: boolean;
  /** When true, create a department row for each distinct missing `department_name` (case-insensitive). */
  createDepartmentIfMissing: boolean;
  departments: DepartmentRow[];
  existingUsers: ExistingUserRow[];
}): UserImportBuildResult {
  const {
    csvText,
    dryRun,
    overwrite,
    generateBarcodeIfBlank,
    createDepartmentIfMissing,
    departments,
    existingUsers,
  } = params;

  const { map: deptByNormName, error: deptCatalogError } =
    buildDepartmentIdByNormalizedName(departments);
  if (deptCatalogError) {
    return {
      departmentCatalogError: deptCatalogError,
      rowErrors: [],
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      departmentsCreatedCount: 0,
      transactions: [],
    };
  }

  const parsed = Papa.parse<Record<string, unknown>>(csvText, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });

  if (parsed.errors?.length) {
    const first = parsed.errors[0];
    return {
      departmentCatalogError: null,
      rowErrors: [
        {
          line: first.row != null ? first.row + 1 : 1,
          message: first.message || "CSV parse error",
        },
      ],
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      departmentsCreatedCount: 0,
      transactions: [],
    };
  }

  const rows = parsed.data ?? [];
  /** Last row wins: normalized email -> { line, row } */
  const byEmail = new Map<
    string,
    { line: number; row: Record<string, unknown> }
  >();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const line = i + 2; // 1-based; line 1 is header
    const emailRaw = rowGet(row, "email");
    const email = normalizeEmail(emailRaw);
    if (!email) {
      const name = rowGet(row, "name");
      const dept = rowGet(row, "department_name");
      const barcode = rowGet(row, "barcode");
      const admin = rowGet(row, "is_admin");
      if (!name && !dept && !barcode && !admin) continue;
      byEmail.set(`__invalid_${i}`, { line, row });
      continue;
    }
    byEmail.set(email, { line, row });
  }

  const existingByEmail = new Map<string, ExistingUserRow>();
  for (const u of existingUsers) {
    existingByEmail.set(normalizeEmail(u.email), u);
  }

  /** Barcodes already taken (DB + explicit values in this import after last-row dedupe). */
  const usedBarcodes = new Set<string>();
  for (const u of existingUsers) {
    const b = String(u.barcode ?? "").trim();
    if (b) usedBarcodes.add(b);
  }
  for (const [mapKey, { row }] of Array.from(byEmail.entries())) {
    if (mapKey.startsWith("__invalid_")) continue;
    const b = rowGet(row, "barcode").trim();
    if (b) usedBarcodes.add(b);
  }

  /** Mutable: DB match + auto-created departments for this import. */
  const deptIdByNormName = new Map<string, string>(deptByNormName);
  /** Last-seen trimmed CSV label per normalized department name. */
  const displayNameByNormKey = new Map<string, string>();
  for (const [mapKey, { row }] of Array.from(byEmail.entries())) {
    if (mapKey.startsWith("__invalid_")) continue;
    const dn = rowGet(row, "department_name").trim();
    if (!dn) continue;
    displayNameByNormKey.set(normalizeDeptName(dn), dn);
  }

  const deptCreateTxs: unknown[] = [];
  let departmentsCreatedCount = 0;
  const takenDeptCodes = collectExistingDepartmentCodes(departments);

  for (const [normKey, displayName] of Array.from(
    displayNameByNormKey.entries()
  )) {
    if (deptIdByNormName.has(normKey)) continue;
    if (!createDepartmentIfMissing) continue;

    const newDeptId = id();
    const departmentId = allocateUniqueDepartmentCode(
      displayName,
      takenDeptCodes
    );
    if (!dryRun) {
      deptCreateTxs.push(
        tx.departments[newDeptId].update({
          name: displayName,
          departmentId,
        })
      );
    }
    departmentsCreatedCount++;
    deptIdByNormName.set(normKey, newDeptId);
  }

  const rowErrors: RowError[] = [];
  const userTxs: unknown[] = [];
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const [mapKey, { line, row }] of Array.from(byEmail.entries())) {
    if (mapKey.startsWith("__invalid_")) {
      rowErrors.push({ line, message: "Missing or invalid email." });
      continue;
    }

    const name = rowGet(row, "name");
    const email = normalizeEmail(rowGet(row, "email"));
    const barcode = rowGet(row, "barcode");
    const isAdmin = parseBoolCell(rowGet(row, "is_admin"));
    const departmentName = rowGet(row, "department_name");

    if (!name) {
      rowErrors.push({ line, message: "Name is required." });
      continue;
    }
    if (!EMAIL_REGEX.test(email)) {
      rowErrors.push({ line, message: "Invalid email address." });
      continue;
    }
    if (!departmentName) {
      rowErrors.push({ line, message: "department_name is required." });
      continue;
    }

    const deptKey = normalizeDeptName(departmentName);
    const deptId = deptIdByNormName.get(deptKey);
    if (!deptId) {
      rowErrors.push({
        line,
        message: createDepartmentIfMissing
          ? `Department not found: "${departmentName}".`
          : `Department not found: "${departmentName}" (case-insensitive match). Add it in admin or enable "Create department if missing".`,
      });
      continue;
    }

    let resolvedBarcode: string;
    try {
      resolvedBarcode = resolveImportBarcode({
        rawFromCsv: barcode,
        generateIfBlank: generateBarcodeIfBlank,
        used: usedBarcodes,
      });
    } catch (e) {
      rowErrors.push({
        line,
        message:
          e instanceof Error ? e.message : "Failed to allocate a barcode.",
      });
      continue;
    }

    const existing = existingByEmail.get(email);
    const now = Date.now();

    if (existing) {
      if (!overwrite) {
        skippedCount++;
        continue;
      }
      if (!dryRun) {
        userTxs.push(
          tx.users[existing.id].update({
            name,
            email,
            barcode: resolvedBarcode,
            isAdmin,
            deptId,
            serverCreatedAt: now,
            laptopSerial: "",
            purpose: "",
          })
        );
      }
      updatedCount++;
    } else {
      const newId = id();
      if (!dryRun) {
        userTxs.push(
          tx.users[newId].update({
            name,
            email,
            barcode: resolvedBarcode,
            isAdmin,
            isAuth: false,
            lastLoginAt: now,
            createdAt: now,
            serverCreatedAt: now,
            deptId,
            laptopSerial: "",
            purpose: "",
          })
        );
      }
      createdCount++;
    }
  }

  const transactions: unknown[] = [...deptCreateTxs, ...userTxs];

  if (!dryRun && transactions.length > 0) {
    const auditId = id();
    transactions.push(
      tx.auditLogs[auditId].update({
        type: "user_bulk_import",
        message: `Bulk user import: created=${createdCount}, updated=${updatedCount}, skipped=${skippedCount}, deptsCreated=${departmentsCreatedCount}, rowErrors=${rowErrors.length}`,
        metadata: {
          dryRun: false,
          overwrite,
          generateBarcodeIfBlank,
          createDepartmentIfMissing,
          departmentsCreatedCount,
          createdCount,
          updatedCount,
          skippedCount,
          rowErrorCount: rowErrors.length,
        },
        createdAt: Date.now(),
      })
    );
  }

  return {
    departmentCatalogError: null,
    rowErrors,
    createdCount,
    updatedCount,
    skippedCount,
    departmentsCreatedCount,
    transactions,
  };
}
