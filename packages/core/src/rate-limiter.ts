/**
 * Token Leaky-Bucket Rate Limiter with Sliding Window.
 * Protects MCP servers from agent runaway loops, high-frequency polling,
 * and cost explosion.
 */

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export class SlidingWindowRateLimiter {
  private requests = new Map<string, number[]>();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(config: RateLimitConfig = { maxRequests: 60, windowMs: 60000 }) {
    this.maxRequests = config.maxRequests;
    this.windowMs = config.windowMs;
  }

  /**
   * Check if action is allowed for client/identifier.
   * If rate exceeded, returns remaining retryAfterMs; otherwise returns 0 (allowed).
   */
  public checkLimit(identifier: string = "default"): { allowed: boolean; remaining: number; retryAfterMs: number } {
    const now = Date.now();
    const timestamps = this.requests.get(identifier) || [];

    // Filter out timestamps outside current sliding window
    const windowStart = now - this.windowMs;
    const validTimestamps = timestamps.filter(ts => ts > windowStart);

    if (validTimestamps.length >= this.maxRequests) {
      const oldestValid = validTimestamps[0];
      const retryAfterMs = Math.max(0, (oldestValid + this.windowMs) - now);
      this.requests.set(identifier, validTimestamps);
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs
      };
    }

    validTimestamps.push(now);
    this.requests.set(identifier, validTimestamps);

    return {
      allowed: true,
      remaining: this.maxRequests - validTimestamps.length,
      retryAfterMs: 0
    };
  }

  public reset(identifier?: string): void {
    if (identifier) {
      this.requests.delete(identifier);
    } else {
      this.requests.clear();
    }
  }
}
