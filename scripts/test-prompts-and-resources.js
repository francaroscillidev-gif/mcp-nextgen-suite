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
    name: "test-features-client",
    version: "1.0.0"
  });

  await client.connect(transport);

  // 1. Check Prompts
  console.log("\n=== Checking MCP Prompts ===");
  const prompts = await client.listPrompts();
  console.log("Registered Prompts:", prompts.prompts.map(p => p.name));
  
  const promptGet = await client.getPrompt({
    name: "diagnose-query-slowness",
    arguments: {
      query: "SELECT * FROM orders WHERE total_amount > 100",
      db_type: "sqlite"
    }
  });
  console.log("Generated Prompt message count:", promptGet.messages.length);
  console.log("Prompt Preview:", promptGet.messages[0].content.text.slice(0, 150) + "...\n");

  // 2. Check Resources
  console.log("=== Checking MCP Resources ===");
  const resources = await client.listResources();
  console.log("Registered Resources:", resources.resources.map(r => r.uri));

  const resourceRead = await client.readResource({
    uri: "telemetry://system/live-metrics"
  });
  console.log("Resource Content Preview:\n", resourceRead.contents[0].text);

  await client.close();
  process.exit(0);
}

run().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
