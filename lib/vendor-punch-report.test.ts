import { describe, expect, it } from "vitest";
import {
  buildVendorPunchReportCsv,
  buildVendorPunchReportRows,
  escapeCsv,
  formatElapsed,
  findLatestPunchByTypes,
  groupPunchesByUserId,
  VENDOR_CHECK_IN_TYPES,
  VENDOR_CHECK_OUT_TYPES,
  vendorPunchReportCutoffMs,
} from "./vendor-punch-report";

describe("escapeCsv", () => {
  it("quotes fields with commas or newlines", () => {
    expect(escapeCsv("Acme, Inc")).toBe('"Acme, Inc"');
    expect(escapeCsv('Say "hi"')).toBe('"Say ""hi"""');
  });

  it("leaves simple values unquoted", () => {
    expect(escapeCsv("Acme")).toBe("Acme");
  });
});

describe("formatElapsed", () => {
  it("formats hours and minutes", () => {
    expect(formatElapsed(2 * 60 * 60 * 1000 + 15 * 60 * 1000)).toBe("2h 15m");
  });

  it("formats minutes only under one hour", () => {
    expect(formatElapsed(45 * 60 * 1000)).toBe("45m");
  });

  it("returns empty for invalid values", () => {
    expect(formatElapsed(0)).toBe("");
    expect(formatElapsed(-1)).toBe("");
  });
});

describe("findLatestPunchByTypes", () => {
  it("returns the latest matching punch by serverCreatedAt", () => {
    const punches = [
      { type: "checkin", timestamp: 100, serverCreatedAt: 10 },
      { type: "checkin", timestamp: 50, serverCreatedAt: 30 },
      { type: "checkout", timestamp: 200, serverCreatedAt: 40 },
    ];
    const latest = findLatestPunchByTypes(punches, VENDOR_CHECK_IN_TYPES);
    expect(latest?.serverCreatedAt).toBe(30);
  });
});

describe("groupPunchesByUserId", () => {
  it("groups punches by userId", () => {
    const grouped = groupPunchesByUserId([
      { userId: "u1", type: "checkin", timestamp: 1 },
      { userId: "u2", type: "checkin", timestamp: 2 },
      { userId: "u1", type: "checkout", timestamp: 3 },
    ]);
    expect(grouped.u1).toHaveLength(2);
    expect(grouped.u2).toHaveLength(1);
  });
});

describe("vendorPunchReportCutoffMs", () => {
  it("subtracts whole days from now", () => {
    const now = new Date("2026-06-01T12:00:00Z").getTime();
    const cutoff = vendorPunchReportCutoffMs(3, now);
    expect(cutoff).toBe(new Date("2026-05-29T12:00:00Z").getTime());
  });
});

describe("buildVendorPunchReportRows", () => {
  const formatTimestamp = (ms: number) => `T${ms}`;

  it("filters checkins before cutoff and sorts newest first", () => {
    const rows = buildVendorPunchReportRows({
      checkins: [
        {
          createdAt: 100,
          companyDisplayName: "Old Co",
          user: { id: "u-old" },
        },
        {
          createdAt: 500,
          companyDisplayName: "New Co",
          user: { id: "u-new" },
        },
      ],
      punchesByUserId: {},
      cutoffMs: 200,
      formatTimestamp,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].Company).toBe("New Co");
  });

  it("uses checkin createdAt and checkedOutAt with elapsed time", () => {
    const rows = buildVendorPunchReportRows({
      checkins: [
        {
          createdAt: 1000,
          checkedOutAt: 1000 + 90 * 60 * 1000,
          companyDisplayName: "Acme HVAC",
          reasonDisplay: "Maintenance",
          firstName: "Jane",
          lastName: "Doe",
          sixDigitCode: "123",
          user: { id: "u1" },
        },
      ],
      punchesByUserId: {
        u1: [
          { type: "checkin", timestamp: 999, serverCreatedAt: 999 },
          { type: "checkout", timestamp: 2000, serverCreatedAt: 2000 },
        ],
      },
      cutoffMs: 0,
      formatTimestamp,
    });
    expect(rows[0]).toMatchObject({
      Company: "Acme HVAC",
      Reason: "Maintenance",
      "First Name": "Jane",
      "Last Name": "Doe",
      "Check-in (MST)": "T1000",
      "Check-out (MST)": "T5401000",
      Elapsed: "1h 30m",
      "On Site": "No",
      "Checkout Code": "123",
    });
  });

  it("marks on-site visits and omits check-out and elapsed", () => {
    const rows = buildVendorPunchReportRows({
      checkins: [
        {
          createdAt: 5000,
          checkedOutAt: 0,
          companyDisplayName: "Beta",
          user: { id: "u2" },
        },
      ],
      punchesByUserId: {
        u2: [{ type: "checkin", timestamp: 5000, serverCreatedAt: 5000 }],
      },
      cutoffMs: 0,
      formatTimestamp,
    });
    expect(rows[0]["Check-out (MST)"]).toBe("");
    expect(rows[0].Elapsed).toBe("");
    expect(rows[0]["On Site"]).toBe("Yes");
  });

  it("falls back to punch times when checkin timestamps are missing", () => {
    const rows = buildVendorPunchReportRows({
      checkins: [
        {
          companyDisplayName: "Gamma",
          user: { id: "u3" },
        },
      ],
      punchesByUserId: {
        u3: [
          { type: "checkin", timestamp: 100, serverCreatedAt: 100 },
          {
            type: "checkout",
            timestamp: 100 + 100 * 60 * 1000,
            serverCreatedAt: 100 + 100 * 60 * 1000,
          },
        ],
      },
      cutoffMs: 0,
      formatTimestamp,
    });
    expect(rows[0]["Check-in (MST)"]).toBe("T100");
    expect(rows[0]["Check-out (MST)"]).toBe(`T${100 + 100 * 60 * 1000}`);
    expect(rows[0].Elapsed).toBe("1h 40m");
  });
});

describe("buildVendorPunchReportCsv", () => {
  it("includes UTF-8 BOM and header row", () => {
    const csv = buildVendorPunchReportCsv([
      {
        Company: "Acme",
        Reason: "Delivery",
        "First Name": "Sam",
        "Last Name": "Lee",
        "Check-in (MST)": "T1",
        "Check-out (MST)": "",
        Elapsed: "",
        "On Site": "Yes",
        "Checkout Code": "456",
      },
    ]);
    expect(csv.startsWith("\ufeff")).toBe(true);
    expect(csv).toContain("Company,Reason,First Name");
    expect(csv).toContain("Acme,Delivery,Sam,Lee");
  });
});
