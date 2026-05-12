import { describe, expect, it } from "vitest";
import {
  departmentDeleteBlockedReason,
  isValidAdminEmail,
  normalizeAdminEmail,
  userDeleteBlockedReason,
  validateAdminCreateUserFields,
  validateAdminDepartmentUpdateFields,
  validateAdminNewDepartmentFields,
  validateOptionalKioskBarcode,
  validateUserDepartmentPick,
} from "./admin-form-validation";

describe("normalizeAdminEmail / isValidAdminEmail", () => {
  it("normalizes and validates", () => {
    expect(normalizeAdminEmail("  A@B.CO ")).toBe("a@b.co");
    expect(isValidAdminEmail("a@b.co")).toBe(true);
    expect(isValidAdminEmail("not-an-email")).toBe(false);
  });
});

describe("validateAdminCreateUserFields", () => {
  it("returns errors for missing fields", () => {
    expect(
      validateAdminCreateUserFields({
        nameTrimmed: "",
        emailNormalized: "a@b.co",
        deptId: "d1",
      })
    ).toMatch(/Name/);
    expect(
      validateAdminCreateUserFields({
        nameTrimmed: "Bob",
        emailNormalized: "bad",
        deptId: "d1",
      })
    ).toMatch(/valid email/);
    expect(
      validateAdminCreateUserFields({
        nameTrimmed: "Bob",
        emailNormalized: "b@b.co",
        deptId: "",
      })
    ).toMatch(/department/);
  });

  it("returns null when valid", () => {
    expect(
      validateAdminCreateUserFields({
        nameTrimmed: "Bob",
        emailNormalized: "b@b.co",
        deptId: "d1",
      })
    ).toBe(null);
  });
});

describe("validateOptionalKioskBarcode", () => {
  it("allows blank", () => {
    expect(validateOptionalKioskBarcode("")).toBe(null);
    expect(validateOptionalKioskBarcode("   ")).toBe(null);
  });
});

describe("validateAdminNewDepartmentFields", () => {
  it("rejects duplicate codes", () => {
    expect(
      validateAdminNewDepartmentFields({
        nameTrimmed: "Eng",
        departmentIdTrimmed: "ENG",
        existingDepartmentCodes: ["ENG", "OPS"],
      })
    ).toMatch(/already in use/);
  });

  it("accepts new code", () => {
    expect(
      validateAdminNewDepartmentFields({
        nameTrimmed: "Eng",
        departmentIdTrimmed: "NEW",
        existingDepartmentCodes: ["ENG"],
      })
    ).toBe(null);
  });
});

describe("validateAdminDepartmentUpdateFields", () => {
  const depts = [
    { id: "a", departmentId: "A1" },
    { id: "b", departmentId: "B1" },
  ];

  it("blocks stealing another dept's code", () => {
    expect(
      validateAdminDepartmentUpdateFields({
        nameTrimmed: "Renamed",
        departmentIdTrimmed: "B1",
        editingDeptId: "a",
        otherDepartments: depts,
      })
    ).toMatch(/Another department/);
  });

  it("allows keeping own code", () => {
    expect(
      validateAdminDepartmentUpdateFields({
        nameTrimmed: "Renamed",
        departmentIdTrimmed: "A1",
        editingDeptId: "a",
        otherDepartments: depts,
      })
    ).toBe(null);
  });
});

describe("departmentDeleteBlockedReason", () => {
  it("blocks when users assigned", () => {
    expect(departmentDeleteBlockedReason(2)).toMatch(/2 user/);
  });

  it("allows when none", () => {
    expect(departmentDeleteBlockedReason(0)).toBe(null);
  });
});

describe("userDeleteBlockedReason", () => {
  it("blocks self-delete", () => {
    expect(
      userDeleteBlockedReason({
        userIdToDelete: "u1",
        currentAppUserId: "u1",
      })
    ).toMatch(/cannot delete your own/);
  });

  it("allows other users", () => {
    expect(
      userDeleteBlockedReason({
        userIdToDelete: "u2",
        currentAppUserId: "u1",
      })
    ).toBe(null);
  });
});

describe("validateUserDepartmentPick", () => {
  it("requires selection", () => {
    expect(validateUserDepartmentPick("")).toMatch(/Select/);
    expect(validateUserDepartmentPick("dept-1")).toBe(null);
  });
});
