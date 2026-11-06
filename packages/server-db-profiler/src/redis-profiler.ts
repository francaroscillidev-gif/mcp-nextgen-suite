import { z } from "zod";
import { NextGenMcpServer } from "@mcp-nextgen/core";

export function registerRedisProfilerTools(server: NextGenMcpServer) {
  server.server.tool(
    "redis_analyze_slowlog_and_memory",
    "Analyzes Redis slowlog entries, memory fragmentation ratios, eviction stats, and bigkey risks without blocking the single-threaded Redis event loop",
    {
      slowlog_output: z.string().optional().describe("Raw text output of 'SLOWLOG GET 20' or sample logs"),
      info_memory_output: z.string().optional().describe("Raw text output of 'INFO memory' or Redis telemetry snippet")
    },
    async ({ slowlog_output, info_memory_output }) => {
      try {
        const findings: Array<{ severity: "CRITICAL" | "HIGH" | "MEDIUM" | "INFO"; metric: string; analysis: string; fix: string }> = [];

        // 1. Memory Analysis
        if (info_memory_output) {
          const lines = info_memory_output.split("\n");
          const memData: Record<string, string> = {};
          for (const l of lines) {
            const parts = l.trim().split(":");
            if (parts.length === 2) {
              memData[parts[0]] = parts[1];
            }
          }

          const fragRatio = parseFloat(memData["mem_fragmentation_ratio"] || "1.0");
          const usedMemoryHuman = memData["used_memory_human"] || "unknown";
          const maxMemoryPolicy = memData["maxmemory_policy"] || "noeviction";

          if (fragRatio > 1.5) {
            findings.push({
              severity: "HIGH",
              metric: `Memory Fragmentation (${fragRatio})`,
              analysis: "Redis is consuming significantly more RSS memory from OS than actual data stored.",
              fix: "Enable active defragmentation (`CONFIG SET activedefrag yes`) or restart Redis replica."
            });
          }

          if (maxMemoryPolicy === "noeviction") {
            findings.push({
              severity: "MEDIUM",
              metric: `Maxmemory Policy: ${maxMemoryPolicy}`,
              analysis: "When memory hits limit, Redis will reject write operations (OOM error).",
              fix: "Consider `volatile-lru` or `allkeys-lru` if Redis is used as a cache."
            });
          }
        }

        // 2. Slowlog Analysis (blocking operations like KEYS *, HGETALL on huge maps, SMEMBERS)
        if (slowlog_output) {
          const dangerousOps = [
            { cmd: "KEYS *", risk: "O(N) full keyspace scan blocks Redis single thread for seconds", fix: "Use SCAN instead of KEYS *" },
            { cmd: "HGETALL", risk: "Unbounded hash retrieval blocks event loop if hash has thousands of fields", fix: "Use HSCAN or HMGET" },
            { cmd: "SMEMBERS", risk: "Unbounded set retrieval", fix: "Use SSCAN" },
            { cmd: "FLUSHALL", risk: "Synchronous memory wipe", fix: "Use FLUSHALL ASYNC" }
          ];

          for (const dop of dangerousOps) {
            if (slowlog_output.toUpperCase().includes(dop.cmd)) {
              findings.push({
                severity: "CRITICAL",
                metric: `Dangerous Command Detected: \`${dop.cmd}\``,
                analysis: dop.risk,
                fix: dop.fix
              });
            }
          }
        }

        let out = `### Redis Performance & Health Diagnosis\n\n`;
        if (findings.length === 0) {
          out += `✅ **No anomalies found**: Provided slowlog/memory telemetry does not show high fragmentation or dangerous O(N) blocking commands.\n`;
        } else {
          out += `| Severity | Metric / Command | Bottleneck Analysis | Optimization / Fix |\n`;
          out += `|---|---|---|---|\n`;
          for (const f of findings) {
            const badge = f.severity === "CRITICAL" ? "🛑 CRITICAL" : f.severity === "HIGH" ? "⚠️ HIGH" : "🟡 MEDIUM";
            out += `| ${badge} | **${f.metric}** | ${f.analysis} | ${f.fix} |\n`;
          }
        }

        return server.safeResponse(out);
      } catch (err) {
        return server.safeError(err);
      }
    }
  );
}
