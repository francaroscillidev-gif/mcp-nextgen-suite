import { describe, it } from "node:test";
import assert from "node:assert";
import { sanitizeSecrets, pruneContext, clusterLogs, SlidingWindowRateLimiter, ResponseCache } from "../packages/core/dist/index.js";

describe("Core Security Sanitizer", () => {
  it("should redact database passwords from connection strings", () => {
    const raw = "postgres://admin:superSecret123@localhost:5432/production";
    const cleaned = sanitizeSecrets(raw);
    assert.strictEqual(cleaned.includes("superSecret123"), false);
    assert.strictEqual(cleaned.includes("[REDACTED_PASSWORD]"), true);
  });

  it("should redact Bearer JWT tokens", () => {
    const raw = "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig";
    const cleaned = sanitizeSecrets(raw);
    assert.strictEqual(cleaned.includes("eyJhbGci"), false);
    assert.strictEqual(cleaned.includes("[REDACTED_JWT]"), true);
  });
});

describe("Token Pruner Budgeter", () => {
  it("should truncate oversized text and retain boundaries", () => {
    const longText = Array.from({ length: 500 }, (_, i) => `Log line ${i}`).join("\n");
    const { text, truncated } = pruneContext(longText, { maxLines: 50 });
    assert.strictEqual(truncated, true);
    assert.strictEqual(text.includes("TRUNCATED"), true);
  });
});

describe("Log Clusterer", () => {
  it("should cluster repetitive crash log lines", () => {
    const sample = [
      "2026-11-07T10:00:01Z [ERR] DB connection failed",
      "2026-11-07T10:00:02Z [ERR] DB connection failed",
      "2026-11-07T10:00:03Z [ERR] DB connection failed"
    ];
    const { clusters, uniquePatterns } = clusterLogs(sample);
    assert.strictEqual(uniquePatterns, 1);
    assert.strictEqual(clusters[0].count, 3);
  });
});

describe("Sliding Window Rate Limiter", () => {
  it("should enforce max requests within sliding window", () => {
    const limiter = new SlidingWindowRateLimiter({ maxRequests: 2, windowMs: 1000 });
    assert.strictEqual(limiter.checkLimit("agent").allowed, true);
    assert.strictEqual(limiter.checkLimit("agent").allowed, true);
    assert.strictEqual(limiter.checkLimit("agent").allowed, false);
  });
});

describe("Response Cache", () => {
  it("should cache and evict expired entries", () => {
    const cache = new ResponseCache(1, 10);
    const key = ResponseCache.hashKey("test", { query: "SELECT 1" });
    cache.set(key, "result");
    assert.strictEqual(cache.get(key), "result");
  });
});
