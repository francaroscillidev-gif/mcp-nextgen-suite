import http from "node:http";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { NextGenMcpServer } from "./server.js";

/**
 * Starts an HTTP server exposing the MCP server via Server-Sent Events (SSE).
 * Enables remote cloud and Kubernetes agent orchestration.
 */
export async function startSseServer(nextGenServer: NextGenMcpServer, port = 3000): Promise<http.Server> {
  let transport: SSEServerTransport | null = null;

  const server = http.createServer(async (req, res) => {
    // CORS headers for web/agent gateways
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Healthcheck endpoint for Kubernetes probes
    if (req.url === "/healthz" || req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "healthy", timestamp: new Date().toISOString() }));
      return;
    }

    // SSE connection endpoint
    if (req.url === "/sse" && req.method === "GET") {
      transport = new SSEServerTransport("/messages", res);
      await nextGenServer.server.connect(transport);
      console.error(`[NextGen-MCP] Client connected via SSE transport on /sse`);
      return;
    }

    // Message receiver endpoint
    if (req.url?.startsWith("/messages") && req.method === "POST") {
      if (transport) {
        await transport.handlePostMessage(req, res);
      } else {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("SSE connection not established yet.");
      }
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found. Use /sse to initiate connection or /healthz for healthcheck.");
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      console.error(`[NextGen-MCP] SSE Remote Transport listening on http://0.0.0.0:${port}/sse`);
      console.error(`[NextGen-MCP] Health endpoint: http://0.0.0.0:${port}/healthz`);
      resolve(server);
    });
  });
}
