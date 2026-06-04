import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { releasedVendorCheckoutCode } from "@/lib/vendor-checkout-code-release";

const { transactVendorCheckout } = vi.hoisted(() => ({
  transactVendorCheckout: vi.fn(),
}));

vi.mock("@/lib/vendor-kiosk-server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/vendor-kiosk-server")>();
  return {
    ...actual,
    transactVendorCheckout,
  };
});

import {
  clearStaleVendorCheckins,
  listReleasableVendorCheckoutCodes,
  listStaleOpenVendorCheckins,
  releaseVendorCheckoutCodes,
} from "./vendor-admin-maintenance";

type MockAdminAPI = {
  query: ReturnType<typeof vi.fn>;
  transact: ReturnType<typeof vi.fn>;
};

function mockAdminAPI(rows: {
  vendorCheckins?: unknown[];
}): MockAdminAPI {
  return {
    query: vi.fn().mockResolvedValue(rows),
    transact: vi.fn().mockResolvedValue(undefined),
  };
}

const MS_16H = 16 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

describe("listReleasableVendorCheckoutCodes", () => {
  it("includes only checked-out rows with active 3-digit codes", async () => {
    const adminAPI = mockAdminAPI({
      vendorCheckins: [
        { id: "open", sixDigitCode: "111", checkedOutAt: 0 },
        { id: "done", sixDigitCode: "222", checkedOutAt: NOW },
        {
          id: "released",
          sixDigitCode: releasedVendorCheckoutCode("released"),
          checkedOutAt: NOW,
        },
        { id: "open2", sixDigitCode: "333", checkedOutAt: 0 },
      ],
    });

    const rows = await listReleasableVendorCheckoutCodes(
      adminAPI as unknown as ReturnType<
        typeof import("@/lib/instantdb-admin").requireAdminAPI
      >
    );

    expect(rows.map((r) => r.id)).toEqual(["done"]);
  });
});

describe("releaseVendorCheckoutCodes", () => {
  beforeEach(() => {
    transactVendorCheckout.mockClear();
  });

  it("dryRun returns count without transacting", async () => {
    const adminAPI = mockAdminAPI({
      vendorCheckins: [
        { id: "a", sixDigitCode: "100", checkedOutAt: 1 },
        { id: "b", sixDigitCode: "101", checkedOutAt: 2 },
      ],
    });

    const result = await releaseVendorCheckoutCodes(
      adminAPI as unknown as ReturnType<
        typeof import("@/lib/instantdb-admin").requireAdminAPI
      >,
      true
    );

    expect(result).toEqual({ released: 2 });
    expect(adminAPI.transact).not.toHaveBeenCalled();
  });

  it("updates completed visits to released placeholders", async () => {
    const adminAPI = mockAdminAPI({
      vendorCheckins: [{ id: "done", sixDigitCode: "482", checkedOutAt: NOW }],
    });

    const result = await releaseVendorCheckoutCodes(
      adminAPI as unknown as ReturnType<
        typeof import("@/lib/instantdb-admin").requireAdminAPI
      >,
      false
    );

    expect(result).toEqual({ released: 1 });
    expect(adminAPI.transact).toHaveBeenCalledTimes(1);
    expect(adminAPI.transact.mock.calls[0][0]).toHaveLength(1);
    expect(releasedVendorCheckoutCode("done")).toBe("released:done");
  });
});

describe("listStaleOpenVendorCheckins", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns open visits checked in longer than stale threshold", async () => {
    vi.stubEnv("NEXT_PUBLIC_STALE_CHECKIN_CLEANUP_HOURS", "16");
    const adminAPI = mockAdminAPI({
      vendorCheckins: [
        {
          id: "stale",
          checkedOutAt: 0,
          user: {
            id: "user-stale",
            punches: [
              {
                type: "checkin",
                timestamp: NOW - MS_16H - 1,
                serverCreatedAt: 1,
              },
            ],
          },
        },
        {
          id: "fresh",
          checkedOutAt: 0,
          user: {
            id: "user-fresh",
            punches: [
              {
                type: "checkin",
                timestamp: NOW - MS_16H + 60_000,
                serverCreatedAt: 1,
              },
            ],
          },
        },
        {
          id: "already-out",
          checkedOutAt: 0,
          user: {
            id: "user-out",
            punches: [
              {
                type: "checkout",
                timestamp: NOW - MS_16H - 1,
                serverCreatedAt: 2,
              },
            ],
          },
        },
        { id: "no-user", checkedOutAt: 0 },
      ],
    });

    const stale = await listStaleOpenVendorCheckins(
      adminAPI as unknown as ReturnType<
        typeof import("@/lib/instantdb-admin").requireAdminAPI
      >,
      NOW
    );

    expect(stale).toEqual([
      { checkinRowId: "stale", userId: "user-stale" },
    ]);
    expect(adminAPI.query).toHaveBeenCalledWith({
      vendorCheckins: {
        $: { where: { checkedOutAt: 0 } },
        user: { punches: {} },
      },
    });
  });

  it("supports user as a one-element array", async () => {
    vi.stubEnv("NEXT_PUBLIC_STALE_CHECKIN_CLEANUP_HOURS", "16");
    const adminAPI = mockAdminAPI({
      vendorCheckins: [
        {
          id: "stale-arr",
          checkedOutAt: 0,
          user: [
            {
              id: "user-arr",
              punches: [
                {
                  type: "checkin",
                  timestamp: NOW - MS_16H - 1,
                  serverCreatedAt: 1,
                },
              ],
            },
          ],
        },
      ],
    });

    const stale = await listStaleOpenVendorCheckins(
      adminAPI as unknown as ReturnType<
        typeof import("@/lib/instantdb-admin").requireAdminAPI
      >,
      NOW
    );

    expect(stale).toEqual([
      { checkinRowId: "stale-arr", userId: "user-arr" },
    ]);
  });
});

describe("clearStaleVendorCheckins", () => {
  beforeEach(() => {
    transactVendorCheckout.mockClear();
    transactVendorCheckout.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("dryRun does not check out", async () => {
    vi.stubEnv("NEXT_PUBLIC_STALE_CHECKIN_CLEANUP_HOURS", "16");
    const adminAPI = mockAdminAPI({
      vendorCheckins: [
        {
          id: "stale",
          checkedOutAt: 0,
          user: {
            id: "u1",
            punches: [
              {
                type: "checkin",
                timestamp: NOW - MS_16H - 1,
                serverCreatedAt: 1,
              },
            ],
          },
        },
      ],
    });

    const result = await clearStaleVendorCheckins(
      adminAPI as unknown as ReturnType<
        typeof import("@/lib/instantdb-admin").requireAdminAPI
      >,
      true,
      NOW
    );

    expect(result).toEqual({ checkedOut: 1 });
    expect(transactVendorCheckout).not.toHaveBeenCalled();
  });

  it("checks out each stale visit", async () => {
    vi.stubEnv("NEXT_PUBLIC_STALE_CHECKIN_CLEANUP_HOURS", "16");
    const adminAPI = mockAdminAPI({
      vendorCheckins: [
        {
          id: "s1",
          checkedOutAt: 0,
          user: {
            id: "u1",
            punches: [
              {
                type: "checkin",
                timestamp: NOW - MS_16H - 1,
                serverCreatedAt: 1,
              },
            ],
          },
        },
        {
          id: "s2",
          checkedOutAt: 0,
          user: {
            id: "u2",
            punches: [
              {
                type: "checkin",
                timestamp: NOW - MS_16H - 1000,
                serverCreatedAt: 1,
              },
            ],
          },
        },
      ],
    });

    const result = await clearStaleVendorCheckins(
      adminAPI as unknown as ReturnType<
        typeof import("@/lib/instantdb-admin").requireAdminAPI
      >,
      false,
      NOW
    );

    expect(result).toEqual({ checkedOut: 2 });
    expect(transactVendorCheckout).toHaveBeenCalledTimes(2);
    expect(transactVendorCheckout).toHaveBeenNthCalledWith(1, {
      adminAPI,
      now: NOW,
      userId: "u1",
      checkinRowId: "s1",
    });
    expect(transactVendorCheckout).toHaveBeenNthCalledWith(2, {
      adminAPI,
      now: NOW,
      userId: "u2",
      checkinRowId: "s2",
    });
  });
});
