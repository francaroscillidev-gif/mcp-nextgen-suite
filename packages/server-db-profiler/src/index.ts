#!/usr/bin/env node
import { NextGenMcpServer, registerCoreResources, registerDatabasePrompts } from "@mcp-nextgen/core";
import { registerSqliteTools } from "./sqlite-tools.js";
import { registerPostgresTools } from "./postgres-tools.js";

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

  // Register Prompts & Live Resources
  registerDatabasePrompts(server);
  registerCoreResources({
    server,
    getDbStats: async () => "DB Profiler active. Connected engines: SQLite, PostgreSQL adapter ready."
  });

  // Connect stdio transport
  await server.startStdio();
}

main().catch((err) => {
  console.error("Fatal error starting DB Profiler MCP Server:", err);
  process.exit(1);
});
