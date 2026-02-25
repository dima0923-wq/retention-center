import { describe, it, expect, beforeEach, vi } from "vitest";
import { acquireLock, releaseLock, getLockInfo } from "@/lib/cron-lock";

describe("cron-lock", () => {
  beforeEach(() => {
    releaseLock("test");
    releaseLock("cron-main");
  });

  it("should acquire and release a lock", () => {
    expect(acquireLock("test")).toBe(true);
    expect(getLockInfo("test").held).toBe(true);
    releaseLock("test");
    expect(getLockInfo("test").held).toBe(false);
  });

  it("should reject double-acquire", () => {
    expect(acquireLock("test")).toBe(true);
    expect(acquireLock("test")).toBe(false);
  });

  it("should allow re-acquire after release", () => {
    expect(acquireLock("test")).toBe(true);
    releaseLock("test");
    expect(acquireLock("test")).toBe(true);
  });

  it("should auto-expire lock after maxHoldMs", () => {
    vi.useFakeTimers();
    try {
      expect(acquireLock("test", 1000)).toBe(true);
      // Still locked at 999ms
      vi.advanceTimersByTime(999);
      expect(acquireLock("test", 1000)).toBe(false);
      // Expired at 1000ms
      vi.advanceTimersByTime(1);
      expect(acquireLock("test", 1000)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("should track lock info with acquiredAt", () => {
    vi.useFakeTimers({ now: 1000000 });
    try {
      acquireLock("test");
      const info = getLockInfo("test");
      expect(info.held).toBe(true);
      expect(info.acquiredAt).toBe(1000000);
    } finally {
      vi.useRealTimers();
    }
  });

  it("getLockInfo returns held=false for expired lock", () => {
    vi.useFakeTimers();
    try {
      acquireLock("test", 500);
      vi.advanceTimersByTime(500);
      expect(getLockInfo("test").held).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("should handle independent locks separately", () => {
    expect(acquireLock("a")).toBe(true);
    expect(acquireLock("b")).toBe(true);
    expect(acquireLock("a")).toBe(false);
    expect(acquireLock("b")).toBe(false);
    releaseLock("a");
    expect(acquireLock("a")).toBe(true);
    expect(acquireLock("b")).toBe(false);
    releaseLock("a");
    releaseLock("b");
  });
});
