import { verifyBarcode } from "@/utils/barcodeVerification";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeAdminEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidAdminEmail(s: string): boolean {
  return EMAIL_RE.test(s);
}

/** Sync field checks before async uniqueness / DB (admin "new user" form). */
export function validateAdminCreateUserFields(params: {
  nameTrimmed: string;
  emailNormalized: string;
  deptId: string;
}): string | null {
  if (!params.nameTrimmed) return "Name is required.";
  if (!isValidAdminEmail(params.emailNormalized)) return "Enter a valid email.";
  if (!params.deptId) return "Select a department for this user.";
  return null;
}

export function validateOptionalKioskBarcode(barcodeTrimmed: string): string | null {
  const t = barcodeTrimmed.trim();
  if (!t) return null;
  if (!verifyBarcode(t)) {
    return "Barcode must be a valid 20-character kiosk code, or leave blank to auto-generate.";
  }
  return null;
}

export function validateAdminNewDepartmentFields(params: {
  nameTrimmed: string;
  departmentIdTrimmed: string;
  existingDepartmentCodes: string[];
}): string | null {
  if (!params.nameTrimmed) return "Department display name is required.";
  if (!params.departmentIdTrimmed) {
    return "Department code is required (short id, e.g. ENG).";
  }
  const dup = params.existingDepartmentCodes.some(
    (c) => c === params.departmentIdTrimmed
  );
  if (dup) return "That department code is already in use.";
  return null;
}

export function validateAdminDepartmentUpdateFields(params: {
  nameTrimmed: string;
  departmentIdTrimmed: string;
  editingDeptId: string;
  otherDepartments: { id: string; departmentId?: string }[];
}): string | null {
  if (!params.nameTrimmed) return "Department name is required.";
  if (!params.departmentIdTrimmed) return "Department code is required.";
  const dup = params.otherDepartments.some(
    (d) =>
      d.id !== params.editingDeptId &&
      String(d.departmentId ?? "").trim() === params.departmentIdTrimmed
  );
  if (dup) return "Another department already uses that code.";
  return null;
}

export function departmentDeleteBlockedReason(
  assignedUserCount: number
): string | null {
  if (assignedUserCount > 0) {
    return `Cannot delete: ${assignedUserCount} user(s) are still assigned to this department. Reassign them first.`;
  }
  return null;
}

export function userDeleteBlockedReason(params: {
  userIdToDelete: string;
  currentAppUserId: string;
}): string | null {
  if (params.userIdToDelete === params.currentAppUserId) {
    return "You cannot delete your own account from here.";
  }
  return null;
}

export function validateUserDepartmentPick(deptIdDraft: string): string | null {
  if (!deptIdDraft) return "Select a department.";
  return null;
}
