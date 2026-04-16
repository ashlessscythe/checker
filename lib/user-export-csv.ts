/**
 * Client-side CSV export for admin users — same columns as bulk import.
 */

import { USER_IMPORT_CSV_HEADERS } from "./user-import-csv-columns";

export type ExportUserInput = {
  name?: string | null;
  email?: string | null;
  barcode?: string | null;
  isAdmin?: boolean | null;
  deptId?: string | null;
  department?: { name?: string | null } | null;
};

export type ExportDepartmentInput = {
  id: string;
  name?: string | null;
};

function escapeCsvCell(v: string): string {
  if (/[",\n\r]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

export function resolveDepartmentNameForExport(
  user: ExportUserInput,
  departments: ExportDepartmentInput[]
): string {
  const linked = user.department?.name?.trim();
  if (linked) return linked;
  const id = user.deptId;
  if (!id) return "";
  const found = departments.find((d) => d.id === id);
  return (found?.name ?? "").trim();
}

/** Same header row and column order as import (`USER_IMPORT_CSV_HEADERS`). */
export function buildUsersExportCsv(
  users: ExportUserInput[],
  departments: ExportDepartmentInput[]
): string {
  const sorted = [...users].sort((a, b) => {
    const e1 = (a.email ?? "").toLowerCase();
    const e2 = (b.email ?? "").toLowerCase();
    return e1.localeCompare(e2);
  });

  const header = USER_IMPORT_CSV_HEADERS.join(",");
  const lines = sorted.map((u) => {
    const name = u.name ?? "";
    const email = u.email ?? "";
    const barcode = u.barcode == null || u.barcode === "" ? "" : String(u.barcode);
    const isAdmin = Boolean(u.isAdmin);
    const department_name = resolveDepartmentNameForExport(u, departments);
    return [name, email, barcode, isAdmin ? "true" : "false", department_name]
      .map((c) => escapeCsvCell(String(c)))
      .join(",");
  });

  return `${header}\n${lines.join("\n")}\n`;
}
