import { describe, expect, it } from "vitest";
import {
  buildPunchInstantWhere,
  DEFAULT_LIST_LIMIT,
  equalsInsensitive,
  filterAndShapeUsers,
  matchingUserIds,
  MAX_LIST_LIMIT,
  parseListLimit,
  parsePunchQuery,
  parseUserQuery,
  shapePunches,
  shouldTouchLastUsed,
  userMatchesFilters,
} from "./public-api-query";

const users = [
  { id: "u1", name: "Jane Doe", email: "jane@example.com", deptId: "d1" },
  { id: "u2", name: "Bob Smith", email: "bob@example.com", deptId: "d2" },
];
const departments = [
  { id: "d1", name: "Engineering", departmentId: "ENG" },
  { id: "d2", name: "Facilities", departmentId: "FAC" },
];

describe("parseListLimit", () => {
  it("defaults to 100 and caps at 500", () => {
    expect(parseListLimit(null)).toEqual({ limit: DEFAULT_LIST_LIMIT });
    expect(parseListLimit("10")).toEqual({ limit: 10 });
    expect(parseListLimit("9999")).toEqual({ limit: MAX_LIST_LIMIT });
  });

  it("rejects non-positive values", () => {
    expect(parseListLimit("0")).toEqual({
      error: "limit must be a positive integer.",
    });
    expect(parseListLimit("1.5")).toEqual({
      error: "limit must be a positive integer.",
    });
  });
});

describe("parseUserQuery", () => {
  it("reads optional filters", () => {
    const q = parseUserQuery(
      new URLSearchParams("name=Jane%20Doe&email=jane@example.com&dept=ENG")
    );
    expect(q).toEqual({
      name: "Jane Doe",
      email: "jane@example.com",
      dept: "ENG",
      limit: 100,
    });
  });
});

describe("parsePunchQuery", () => {
  const from = "2026-08-01T00:00:00.000Z";
  const to = "2026-08-31T23:59:59.000Z";

  it("requires from and to as ISO dates", () => {
    expect(parsePunchQuery(new URLSearchParams())).toEqual({
      error: "from is required and must be an ISO-8601 date.",
    });
    expect(
      parsePunchQuery(new URLSearchParams(`from=not-a-date&to=${to}`))
    ).toEqual({ error: "from must be a valid ISO-8601 date." });
  });

  it("rejects inverted and oversized ranges", () => {
    expect(
      parsePunchQuery(new URLSearchParams(`from=${to}&to=${from}`))
    ).toEqual({ error: "from must be less than or equal to to." });
    expect(
      parsePunchQuery(
        new URLSearchParams(
          "from=2020-01-01T00:00:00.000Z&to=2022-01-02T00:00:00.000Z"
        )
      )
    ).toEqual({ error: "Time range cannot exceed 366 days." });
  });

  it("parses a valid punch query", () => {
    const q = parsePunchQuery(
      new URLSearchParams(
        `from=${from}&to=${to}&name=Jane%20Doe&type=checkin&limit=20`
      )
    );
    expect(q).toMatchObject({
      name: "Jane Doe",
      type: "checkin",
      limit: 20,
    });
    if ("error" in q) throw new Error(q.error);
    expect(q.fromMs).toBe(Date.parse(from));
    expect(q.toMs).toBe(Date.parse(to));
  });
});

describe("user filters", () => {
  it("matches name and email case-insensitively", () => {
    expect(equalsInsensitive("Jane Doe", "jane doe")).toBe(true);
    expect(
      userMatchesFilters(users[0], departments, { name: "JANE DOE" })
    ).toBe(true);
    expect(
      userMatchesFilters(users[0], departments, { email: "JANE@EXAMPLE.COM" })
    ).toBe(true);
    expect(
      userMatchesFilters(users[0], departments, { dept: "eng" })
    ).toBe(true);
    expect(
      userMatchesFilters(users[0], departments, { dept: "Engineering" })
    ).toBe(true);
    expect(userMatchesFilters(users[0], departments, { dept: "FAC" })).toBe(
      false
    );
  });

  it("shapes users without kiosk secrets", () => {
    const shaped = filterAndShapeUsers(users, departments, { limit: 10 });
    expect(shaped).toHaveLength(2);
    expect(shaped[0]).toEqual({
      id: "u2",
      name: "Bob Smith",
      email: "bob@example.com",
      department: {
        id: "d2",
        name: "Facilities",
        departmentId: "FAC",
      },
    });
    expect(shaped[0]).not.toHaveProperty("barcode");
    expect(shaped[0]).not.toHaveProperty("isAdmin");
  });

  it("returns matching user ids or null when unfiltered", () => {
    expect(matchingUserIds(users, departments, {})).toBe(null);
    expect(matchingUserIds(users, departments, { name: "Jane Doe" })).toEqual([
      "u1",
    ]);
    expect(matchingUserIds(users, departments, { name: "Nobody" })).toEqual([]);
  });
});

describe("punch where + shape", () => {
  const filters = {
    fromMs: 1000,
    toMs: 5000,
    limit: 10,
    type: "checkin",
  };

  it("builds Instant where with userId and timestamp range", () => {
    expect(buildPunchInstantWhere(filters, ["u1"])).toEqual({
      timestamp: { $gte: 1000, $lte: 5000 },
      userId: "u1",
      type: "checkin",
    });
    expect(buildPunchInstantWhere({ ...filters, type: undefined }, ["u1", "u2"])).toEqual({
      timestamp: { $gte: 1000, $lte: 5000 },
      userId: { $in: ["u1", "u2"] },
    });
  });

  it("shapes punches as ISO timestamps with nested users", () => {
    const shaped = shapePunches(
      [
        {
          id: "p1",
          type: "checkin",
          timestamp: Date.parse("2026-08-15T14:00:00.000Z"),
          userId: "u1",
        },
      ],
      users,
      departments,
      10
    );
    expect(shaped[0]).toEqual({
      id: "p1",
      type: "checkin",
      timestamp: "2026-08-15T14:00:00.000Z",
      user: {
        id: "u1",
        name: "Jane Doe",
        email: "jane@example.com",
        department: {
          id: "d1",
          name: "Engineering",
          departmentId: "ENG",
        },
      },
    });
  });
});

describe("shouldTouchLastUsed", () => {
  it("touches when missing or stale", () => {
    expect(shouldTouchLastUsed(undefined, 100_000)).toBe(true);
    expect(shouldTouchLastUsed(0, 100_000)).toBe(true);
    expect(shouldTouchLastUsed(50_000, 110_000)).toBe(true);
    expect(shouldTouchLastUsed(50_000, 50_000 + 59_000)).toBe(false);
  });
});
