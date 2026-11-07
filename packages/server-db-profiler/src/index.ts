#!/usr/bin/env node
import { NextGenMcpServer, registerCoreResources, registerDatabasePrompts } from "@mcp-nextgen/core";
import { registerSqliteTools } from "./sqlite-tools.js";
import { registerPostgresTools } from "./postgres-tools.js";
import { registerDbMigrationValidator } from "./migration-validator.js";
import { registerRedisProfilerTools } from "./redis-profiler.js";
import { registerQueryCostEstimator } from "./cost-estimator.js";

async function main() {
  const server = new NextGenMcpServer({
    name: "mcp-server-db-profiler",
    version: "0.1.0",
    budgetOptions: {
      maxCharacters: 14000,
      maxLines: 200
    }
  });

  // Register database diagnostic tool suites
  registerSqliteTools(server);
  registerPostgresTools(server);
  registerDbMigrationValidator(server);
  registerRedisProfilerTools(server);
  registerQueryCostEstimator(server);

  // Register Prompts & Live Resources
  registerDatabasePrompts(server);
  registerCoreResources({
    server,
    getDbStats: async () => "DB Profiler active. Connected engines: SQLite, PostgreSQL adapter ready."
  });

  // Connect stdio or sse transport depending on CLI flag / env
  const port = process.env.MCP_PORT ? parseInt(process.env.MCP_PORT, 10) : process.argv.includes("--sse") ? 3000 : null;
  if (port) {
    const { startSseServer } = await import("@mcp-nextgen/core");
    await startSseServer(server, port);
  } else {
    await server.startStdio();
  }
}

main().catch((err) => {
  console.error("Fatal error starting DB Profiler MCP Server:", err);
  process.exit(1);
});
