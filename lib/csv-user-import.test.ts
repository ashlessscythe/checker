import { afterEach, describe, expect, it, vi } from "vitest";
import Papa from "papaparse";
import {
  buildUserImportTransactions,
  normalizeDeptName,
  normalizeEmail,
  parseBoolCell,
  templateCsvContent,
  validateCsvSize,
} from "./csv-user-import";
import { USER_IMPORT_CSV_HEADERS } from "./user-import-csv-columns";

describe("normalizeDeptName", () => {
  it("trims and lowercases with English locale rules", () => {
    expect(normalizeDeptName("  Engineering  ")).toBe("engineering");
    expect(normalizeDeptName("Straße")).toBe("straße");
  });

  it("treats nullish as empty", () => {
    expect(normalizeDeptName(null)).toBe("");
    expect(normalizeDeptName(undefined)).toBe("");
  });
});

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Jane@EXAMPLE.com ")).toBe("jane@example.com");
  });

  it("treats nullish as empty", () => {
    expect(normalizeEmail(null)).toBe("");
  });
});

describe("parseBoolCell", () => {
  it.each([
    ["true", true],
    ["TRUE", true],
    ["1", true],
    ["yes", true],
    ["Y", true],
    ["false", false],
    ["0", false],
    ["", false],
    ["maybe", false],
  ])("parseBoolCell(%j) -> %s", (raw, expected) => {
    expect(parseBoolCell(raw)).toBe(expected);
  });

  it("treats nullish as false", () => {
    expect(parseBoolCell(null)).toBe(false);
    expect(parseBoolCell(undefined)).toBe(false);
  });
});

describe("validateCsvSize", () => {
  const maxBytes = 1_000_000;

  it("returns null when under the limit", () => {
    expect(validateCsvSize("a".repeat(100))).toBe(null);
    expect(validateCsvSize("x".repeat(maxBytes))).toBe(null);
  });

  it("returns an error when over the limit", () => {
    const over = "€".repeat(maxBytes / 2 + 1);
    expect(validateCsvSize(over)).toMatch(/exceeds maximum size/);
  });
});

describe("templateCsvContent", () => {
  it("includes the canonical header row and a sample line", () => {
    const csv = templateCsvContent();
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe(USER_IMPORT_CSV_HEADERS.join(","));
    expect(lines[1]).toContain("jane.doe@example.com");
    expect(lines[1]).toContain("Engineering");
  });
});

describe("buildUserImportTransactions (user import CRUD)", () => {
  const dept = {
    id: "d-eng",
    name: "Engineering",
    departmentId: "ENG",
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("dry-run counts a new user without emitting transactions", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.42);
    const csv = `${USER_IMPORT_CSV_HEADERS.join(",")}
Jane Doe,jane.import@test.co,,false,Engineering`;
    const r = buildUserImportTransactions({
      csvText: csv,
      dryRun: true,
      overwrite: false,
      generateBarcodeIfBlank: true,
      createDepartmentIfMissing: false,
      departments: [dept],
      existingUsers: [],
    });
    expect(r.departmentCatalogError).toBe(null);
    expect(r.rowErrors).toHaveLength(0);
    expect(r.createdCount).toBe(1);
    expect(r.transactions).toHaveLength(0);
  });

  it("emits a user create transaction when not dry-run", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.42);
    const csv = `${USER_IMPORT_CSV_HEADERS.join(",")}
Bob,bob.import@test.co,,false,Engineering`;
    const r = buildUserImportTransactions({
      csvText: csv,
      dryRun: false,
      overwrite: false,
      generateBarcodeIfBlank: true,
      createDepartmentIfMissing: false,
      departments: [dept],
      existingUsers: [],
    });
    expect(r.createdCount).toBe(1);
    expect(r.transactions.length).toBeGreaterThanOrEqual(1);
  });

  it("does not throw when a department row has a null display name", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.42);
    const csv = `${USER_IMPORT_CSV_HEADERS.join(",")}
Jane,jane.nulldept@test.co,,false,Engineering`;
    const r = buildUserImportTransactions({
      csvText: csv,
      dryRun: true,
      overwrite: false,
      generateBarcodeIfBlank: true,
      createDepartmentIfMissing: false,
      departments: [
        dept,
        {
          id: "d-bad",
          name: null as unknown as string,
          departmentId: "BAD",
        },
      ],
      existingUsers: [],
    });
    expect(r.departmentCatalogError).toBe(null);
  });

  it("skips existing email when overwrite is false", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.42);
    const csv = `${USER_IMPORT_CSV_HEADERS.join(",")}
Jane,jane.skip@test.co,,false,Engineering`;
    const r = buildUserImportTransactions({
      csvText: csv,
      dryRun: true,
      overwrite: false,
      generateBarcodeIfBlank: true,
      createDepartmentIfMissing: false,
      departments: [dept],
      existingUsers: [
        { id: "existing-1", email: "jane.skip@test.co", barcode: "x" },
      ],
    });
    expect(r.skippedCount).toBe(1);
    expect(r.createdCount).toBe(0);
  });

  it("updates existing user when overwrite is true", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.42);
    const csv = `${USER_IMPORT_CSV_HEADERS.join(",")}
Jane Up,jane.update@test.co,,true,Engineering`;
    const r = buildUserImportTransactions({
      csvText: csv,
      dryRun: false,
      overwrite: true,
      generateBarcodeIfBlank: true,
      createDepartmentIfMissing: false,
      departments: [dept],
      existingUsers: [
        { id: "u-up", email: "jane.update@test.co", barcode: null },
      ],
    });
    expect(r.updatedCount).toBe(1);
    expect(r.transactions.length).toBeGreaterThanOrEqual(1);
  });
});

describe("Papa.parse transformHeader (prod Excel edge cases)", () => {
  it("coerces nullish header tokens without throwing", () => {
    const transformHeader = (h: unknown) => String(h ?? "").trim();
    expect(transformHeader(null)).toBe("");
    expect(transformHeader(undefined)).toBe("");
    const r = Papa.parse("a,b\nc,d", { header: true, transformHeader });
    expect(r.errors).toHaveLength(0);
    expect(r.data?.[0]).toEqual({ a: "c", b: "d" });
  });
});
