import { NextGenMcpServer } from "./server.js";
import { globalMetrics } from "./metrics.js";

export interface RegisterResourcesOptions {
  server: NextGenMcpServer;
  getDbStats: () => Promise<string>;
  getDevopsStatus?: () => Promise<string>;
}

/**
 * Register dynamic MCP resources with live telemetry and Prometheus metrics
 */
export function registerCoreResources(options: RegisterResourcesOptions) {
  const { server, getDbStats } = options;

  server.server.resource(
    "system-telemetry",
    "telemetry://system/live-metrics",
    async (uri) => {
      const stats = await getDbStats();
      const metricsSummary = globalMetrics.getSummary();

      const payload = {
        uri: uri.href,
        timestamp: new Date().toISOString(),
        system: {
          uptimeSeconds: Math.floor(process.uptime()),
          memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          nodeVersion: process.version
        },
        mcpMetrics: metricsSummary,
        diagnostics: stats
      };

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(payload, null, 2)
          }
        ]
      };
    }
  );

  // Prometheus exposition format resource
  server.server.resource(
    "prometheus-metrics",
    "metrics://prometheus",
    async (uri) => {
      const promText = globalMetrics.toPrometheus();
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/plain",
            text: promText
          }
        ]
      };
    }
  );
}
