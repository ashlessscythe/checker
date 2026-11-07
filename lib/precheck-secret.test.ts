import { afterEach, describe, expect, it, vi } from "vitest";
import { escapeHtml } from "./escape-html";
import { getPrecheckSecret } from "./precheck-secret";

describe("getPrecheckSecret", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("throws in production when unset", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PRECHECK_TOKEN_SECRET", "");
    expect(() => getPrecheckSecret()).toThrow(/PRECHECK_TOKEN_SECRET/);
  });

  it("uses the configured secret, preferring an explicit one", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PRECHECK_TOKEN_SECRET", "base");
    expect(getPrecheckSecret()).toBe("base");
    expect(getPrecheckSecret({ preferred: "host" })).toBe("host");
  });

  it("falls back outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("PRECHECK_TOKEN_SECRET", "");
    expect(getPrecheckSecret()).toBeTruthy();
  });
});

describe("escapeHtml", () => {
  it("escapes markup and quotes", () => {
    expect(escapeHtml(`<a href="x">'&`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&#39;&amp;"
    );
    expect(escapeHtml(undefined)).toBe("");
  });
});
