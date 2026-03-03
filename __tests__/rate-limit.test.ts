import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, getRateLimitConfig } from "@/lib/rate-limit";

describe("Rate Limiter", () => {
  describe("checkRateLimit", () => {
    it("allows first request", () => {
      const result = checkRateLimit("test-key-1", { maxTokens: 5, refillRate: 5 / 60000, windowMs: 60000 });
      expect(result.allowed).toBe(true);
    });

    it("allows requests up to maxTokens", () => {
      const config = { maxTokens: 3, refillRate: 3 / 60000, windowMs: 60000 };
      const key = "test-key-2";
      expect(checkRateLimit(key, config).allowed).toBe(true);
      expect(checkRateLimit(key, config).allowed).toBe(true);
      expect(checkRateLimit(key, config).allowed).toBe(true);
    });

    it("blocks after maxTokens exceeded", () => {
      const config = { maxTokens: 2, refillRate: 2 / 60000, windowMs: 60000 };
      const key = "test-key-3";
      expect(checkRateLimit(key, config).allowed).toBe(true);
      expect(checkRateLimit(key, config).allowed).toBe(true);
      const result = checkRateLimit(key, config);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.retryAfter).toBeGreaterThan(0);
      }
    });

    it("uses independent buckets for different keys", () => {
      const config = { maxTokens: 1, refillRate: 1 / 60000, windowMs: 60000 };
      expect(checkRateLimit("key-a", config).allowed).toBe(true);
      expect(checkRateLimit("key-b", config).allowed).toBe(true);
      expect(checkRateLimit("key-a", config).allowed).toBe(false);
      expect(checkRateLimit("key-b", config).allowed).toBe(false);
    });
  });

  describe("getRateLimitConfig", () => {
    it("returns higher limit for authenticated", () => {
      const config = getRateLimitConfig(true);
      expect(config.maxTokens).toBe(100);
    });

    it("returns lower limit for unauthenticated", () => {
      const config = getRateLimitConfig(false);
      expect(config.maxTokens).toBe(20);
    });
  });
});
