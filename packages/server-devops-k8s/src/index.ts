#!/usr/bin/env node
import { NextGenMcpServer, registerCoreResources, registerDevOpsPrompts } from "@mcp-nextgen/core";
import { registerDockerTools } from "./docker-tools.js";
import { registerK8sTools } from "./k8s-tools.js";

async function main() {
  const server = new NextGenMcpServer({
    name: "mcp-server-devops-k8s",
    version: "0.1.0",
    budgetOptions: {
      maxCharacters: 16000,
      maxLines: 250
    }
  });

  registerDockerTools(server);
  registerK8sTools(server);

  registerDevOpsPrompts(server);
  registerCoreResources({
    server,
    getDbStats: async () => "DevOps Copilot active. Engine status: Docker CLI / Kubectl adapter connected."
  });

  await server.startStdio();
}

main().catch((err) => {
  console.error("Fatal error starting DevOps & K8s MCP Server:", err);
  process.exit(1);
});
