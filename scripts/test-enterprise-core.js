import { SlidingWindowRateLimiter, MetricsRegistry } from "../packages/core/dist/index.js";

console.log("=== Testing Sliding Window Rate Limiter ===");
const limiter = new SlidingWindowRateLimiter({ maxRequests: 3, windowMs: 1000 });

console.log("Call 1:", limiter.checkLimit("agent-1")); // allowed: true, remaining: 2
console.log("Call 2:", limiter.checkLimit("agent-1")); // allowed: true, remaining: 1
console.log("Call 3:", limiter.checkLimit("agent-1")); // allowed: true, remaining: 0
const blocked = limiter.checkLimit("agent-1");
console.log("Call 4 (should block):", blocked); // allowed: false

console.log("\n=== Testing Metrics Registry & Prometheus ===");
const metrics = new MetricsRegistry();
metrics.record({
  toolName: "sqlite_profile_query",
  durationMs: 42,
  success: true,
  tokensPruned: 150,
  secretsRedacted: 1,
  timestamp: new Date().toISOString()
});

console.log("Metrics Summary:", metrics.getSummary());
console.log("\nPrometheus Format Output:\n" + metrics.toPrometheus());
