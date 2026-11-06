/**
 * In-memory TTL cache with LRU eviction and deterministic SHA256 key hashing.
 * Drastically cuts redundant DB queries / CLI executions and prevents token waste.
 */

import { createHash } from "node:crypto";

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class ResponseCache<T = unknown> {
  private cache = new Map<string, CacheEntry<T>>();
  private readonly defaultTtlMs: number;
  private readonly maxEntries: number;

  constructor(defaultTtlSeconds = 60, maxEntries = 100) {
    this.defaultTtlMs = defaultTtlSeconds * 1000;
    this.maxEntries = maxEntries;
  }

  public static hashKey(namespace: string, payload: unknown): string {
    const raw = `${namespace}:${JSON.stringify(payload)}`;
    return createHash("sha256").update(raw).digest("hex").slice(0, 16);
  }

  public get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    // Refresh position for LRU
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  public set(key: string, value: T, ttlMs?: number): void {
    if (this.cache.size >= this.maxEntries) {
      // Evict oldest entry
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs)
    });
  }

  public clear(): void {
    this.cache.clear();
  }

  public size(): number {
    return this.cache.size;
  }
}
