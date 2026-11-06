import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { resolve } from "node:path";

async function run() {
  const serverPath = resolve("./packages/server-devops-k8s/dist/index.js");
  const transport = new StdioClientTransport({
    command: "node",
    args: [serverPath]
  });

  const client = new Client({
    name: "test-devops-client",
    version: "1.0.0"
  });

  await client.connect(transport);
  console.log("Connected to DevOps & K8s MCP Server successfully!");

  const tools = await client.listTools();
  console.log("Registered Tools:", tools.tools.map(t => t.name));

  // Test docker_ps_health
  console.log("\n--- Testing Tool: docker_ps_health ---");
  const psRes = await client.callTool({
    name: "docker_ps_health",
    arguments: { all: true }
  });
  console.log(psRes.content[0].text);

  await client.close();
  process.exit(0);
}

run().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
