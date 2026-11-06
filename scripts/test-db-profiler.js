import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { resolve } from "node:path";

async function run() {
  const serverPath = resolve("./packages/server-db-profiler/dist/index.js");
  const transport = new StdioClientTransport({
    command: "node",
    args: [serverPath]
  });

  const client = new Client({
    name: "test-client",
    version: "1.0.0"
  });

  await client.connect(transport);
  console.log("Connected to DB Profiler MCP Server successfully!");

  // List tools
  const tools = await client.listTools();
  console.log("Registered Tools:", tools.tools.map(t => t.name));

  const dbPath = resolve("./test-demo.db");

  // Call schema inspection
  console.log("\n--- Testing Tool: sqlite_inspect_schema (users) ---");
  const schemaRes = await client.callTool({
    name: "sqlite_inspect_schema",
    arguments: {
      db_path: dbPath,
      table_name: "users"
    }
  });
  console.log(schemaRes.content[0].text);

  // Call query profiler
  console.log("\n--- Testing Tool: sqlite_profile_query (Unindexed filter) ---");
  const profileRes = await client.callTool({
    name: "sqlite_profile_query",
    arguments: {
      db_path: dbPath,
      query: "SELECT u.username, o.total_amount FROM orders o JOIN users u ON o.user_id = u.id WHERE u.email = 'user_5@example.com' ORDER BY o.total_amount DESC;"
    }
  });
  console.log(profileRes.content[0].text);

  await client.close();
  process.exit(0);
}

run().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
