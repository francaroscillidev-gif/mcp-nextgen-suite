import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { resolve } from "node:path";
import * as fs from "node:fs";

async function run() {
  const serverPath = resolve("./packages/server-devops-k8s/dist/index.js");
  const transport = new StdioClientTransport({
    command: "node",
    args: [serverPath]
  });

  const client = new Client({
    name: "test-compose-client",
    version: "1.0.0"
  });

  await client.connect(transport);

  // Write temporary sample compose file
  const sampleComposePath = resolve("./sample-docker-compose.yml");
  fs.writeFileSync(sampleComposePath, `
version: '3.8'
services:
  database:
    image: postgres:15
    environment:
      POSTGRES_PASSWORD: mySuperSecretPassword123
    ports:
      - "5432:5432"
    restart: always

  api:
    image: my-app:latest
    privileged: true
    ports:
      - "8080:8080"
`);

  console.log("=== Testing Docker Compose Audit Tool ===");
  const res = await client.callTool({
    name: "docker_compose_audit",
    arguments: {
      file_path: sampleComposePath
    }
  });

  console.log(res.content[0].text);

  // Cleanup
  fs.unlinkSync(sampleComposePath);
  await client.close();
}

run().catch(console.error);
