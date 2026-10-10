import { Settings } from "luxon";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope } from "vue";
import { useToday } from "@/composables/useToday";

describe("useToday", () => {
  beforeEach(() => {
    Settings.defaultZone = "America/Los_Angeles";
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("turns at local midnight, not UTC midnight", () => {
    // 11:59 PM on Sep 22 in Los Angeles.
    vi.setSystemTime(new Date("2026-09-23T06:59:00Z"));
    const scope = effectScope();
    const today = scope.run(() => useToday())!;
    expect(today.value).toBe(Date.parse("2026-09-22T07:00:00Z"));

    vi.advanceTimersByTime(62_000);
    expect(today.value).toBe(Date.parse("2026-09-23T07:00:00Z"));

    // The next day turns over too.
    vi.advanceTimersByTime(24 * 3_600_000);
    expect(today.value).toBe(Date.parse("2026-09-24T07:00:00Z"));
    scope.stop();
  });

  it("stops its timer when the card goes away", () => {
    vi.setSystemTime(new Date("2026-09-23T06:59:00Z"));
    const scope = effectScope();
    const today = scope.run(() => useToday())!;
    scope.stop();

    vi.advanceTimersByTime(62_000);
    expect(today.value).toBe(Date.parse("2026-09-22T07:00:00Z"));
    expect(vi.getTimerCount()).toBe(0);
  });
});
