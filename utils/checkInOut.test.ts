import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/instantdb", () => ({
  db: {
    transact: vi.fn(),
  },
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("react-hot-toast", () => ({
  default: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

vi.mock("./deviceId", () => ({
  getDeviceId: () => "TESTDEV",
}));

import { db } from "@/lib/instantdb";
import { performCheckinOut } from "./checkInOut";

describe("performCheckinOut", () => {
  const entity = { id: "u1", name: "Pat", punches: [] };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("retries db.transact on timed out then succeeds", async () => {
    const transact = vi.mocked(db.transact);
    let attempts = 0;
    type TransactResult = Awaited<ReturnType<typeof db.transact>>;
    transact.mockImplementation(async (): Promise<TransactResult> => {
      attempts++;
      if (attempts < 3) {
        throw new Error("timed out");
      }
      return {} as TransactResult;
    });

    vi.useFakeTimers();
    const done = performCheckinOut(entity);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    await done;
    vi.useRealTimers();

    expect(transact).toHaveBeenCalledTimes(3);
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("stops after max retries and rethrows", async () => {
    const transact = vi.mocked(db.transact);
    transact.mockRejectedValue(new Error("timed out"));

    vi.useFakeTimers();
    const done = performCheckinOut(entity);
    const rejection = expect(done).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(3000);
    await rejection;
    vi.useRealTimers();

    expect(transact).toHaveBeenCalledTimes(4);
    expect(toastError).toHaveBeenCalled();
  });
});
