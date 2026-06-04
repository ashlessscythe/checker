import { describe, expect, it } from "vitest";
import { formatAdminApiError } from "./admin-api-error";

describe("formatAdminApiError", () => {
  it("expands missing admin token", () => {
    expect(
      formatAdminApiError(
        new Error("INSTANT_ADMIN_TOKEN is not set in environment variables")
      )
    ).toContain("INSTANT_ADMIN_TOKEN is missing");
  });

  it("expands Instant SDK fetch failed", () => {
    const err = new Error("fetch failed", {
      cause: { code: "ETIMEDOUT" },
    });
    expect(formatAdminApiError(err)).toContain("could not reach InstantDB");
    expect(formatAdminApiError(err)).toContain("ETIMEDOUT");
  });

  it("passes through other messages", () => {
    expect(formatAdminApiError(new Error("Something else"))).toBe(
      "Something else"
    );
  });
});
