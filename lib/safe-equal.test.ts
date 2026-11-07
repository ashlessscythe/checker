import { describe, expect, it } from "vitest";
import { safeEqual } from "./safe-equal";

describe("safeEqual", () => {
  it("matches equal strings only", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});
