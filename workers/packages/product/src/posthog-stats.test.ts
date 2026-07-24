import { describe, expect, it } from "vitest";
import { hogqlLiteral } from "@maildrill/observability";
import {
  mapHogQLActivityRows,
  mapHogQLChannelRows,
  zeroFillDailyActivity,
} from "./posthog-stats";

describe("hogqlLiteral", () => {
  it("accepts uuid-like and channel ids", () => {
    expect(hogqlLiteral("6f1b6a1e-0000-4000-8000-000000000001")).toBe(
      "'6f1b6a1e-0000-4000-8000-000000000001'",
    );
    expect(hogqlLiteral("sms")).toBe("'sms'");
  });

  it("rejects unsafe interpolations", () => {
    expect(hogqlLiteral("'; DROP")).toBeNull();
    expect(hogqlLiteral("a'b")).toBeNull();
    expect(hogqlLiteral("")).toBeNull();
  });
});

describe("mapHogQLActivityRows + zeroFill", () => {
  const columns = ["day", "sent", "delivered", "failed"];

  it("maps fixture HogQL rows", () => {
    const rows = mapHogQLActivityRows(columns, [
      ["2026-07-20", 3, 2, 1],
      ["2026-07-22", "5", "4", "0"],
    ]);
    expect(rows).toEqual([
      { day: "2026-07-20", sent: 3, delivered: 2, failed: 1 },
      { day: "2026-07-22", sent: 5, delivered: 4, failed: 0 },
    ]);
  });

  it("zero-fills quiet days to match chart contract", () => {
    const since = new Date("2026-07-20T00:00:00.000Z");
    const filled = zeroFillDailyActivity(
      [{ day: "2026-07-20", sent: 3, delivered: 2, failed: 1 }],
      since,
      3,
    );
    expect(filled).toEqual([
      { date: "2026-07-20", sent: 3, delivered: 2, failed: 1 },
      { date: "2026-07-21", sent: 0, delivered: 0, failed: 0 },
      { date: "2026-07-22", sent: 0, delivered: 0, failed: 0 },
    ]);
  });

  it("returns empty when columns are missing", () => {
    expect(mapHogQLActivityRows(["day", "sent"], [["2026-07-20", 1]])).toEqual([]);
  });
});

describe("mapHogQLChannelRows", () => {
  it("maps channel breakdown fixture rows", () => {
    const rows = mapHogQLChannelRows(["channel", "sent", "delivered", "failed"], [
      ["sms", 10, 8, 2],
      ["email", 0, 0, 0],
    ]);
    expect(rows).toEqual([
      { channel: "sms", sent: 10, delivered: 8, failed: 2 },
      { channel: "email", sent: 0, delivered: 0, failed: 0 },
    ]);
  });

  it("drops blank channels", () => {
    expect(
      mapHogQLChannelRows(["channel", "sent", "delivered", "failed"], [["", 1, 0, 0]]),
    ).toEqual([]);
  });
});
