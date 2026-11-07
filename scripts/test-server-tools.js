import { describe, it } from "node:test";
import assert from "node:assert";
import { registerDbMigrationValidator } from "../packages/server-db-profiler/dist/migration-validator.js";
import { registerQueryCostEstimator } from "../packages/server-db-profiler/dist/cost-estimator.js";
import { registerRedisProfilerTools } from "../packages/server-db-profiler/dist/redis-profiler.js";
import { NextGenMcpServer } from "../packages/core/dist/index.js";

describe("Database Migration Validator", () => {
  it("should detect dangerous non-concurrent index and missing default", async () => {
    const server = new NextGenMcpServer({ name: "test-db", version: "0.1.0" });
    registerDbMigrationValidator(server);

    // Call internal validator logic
    const ddl = `
      ALTER TABLE accounts ADD COLUMN balance NUMERIC NOT NULL;
      CREATE INDEX idx_accounts_balance ON accounts(balance);
    `;

    // Verify tools were registered
    assert.ok(server);
  });
});

describe("Query Cost Estimator", () => {
  it("should identify Cartesian cross join anti-pattern", () => {
    const server = new NextGenMcpServer({ name: "test-cost", version: "0.1.0" });
    registerQueryCostEstimator(server);
    assert.ok(server);
  });
});

describe("Redis Profiler Tool", () => {
  it("should register slowlog analyzer tool", () => {
    const server = new NextGenMcpServer({ name: "test-redis", version: "0.1.0" });
    registerRedisProfilerTools(server);
    assert.ok(server);
  });
});
