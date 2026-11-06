import { z } from "zod";
import { NextGenMcpServer } from "./server.js";

/**
 * Registers standardized prompts to help AI agents perform guided database optimizations
 * and cluster crash forensics without trial-and-error.
 */
export function registerDatabasePrompts(server: NextGenMcpServer) {
  server.server.prompt(
    "diagnose-query-slowness",
    "Expert prompt to diagnose and optimize slow SQL queries with index suggestions",
    {
      query: z.string().describe("The SQL query that needs optimization"),
      db_type: z.string().optional().describe("Database engine (sqlite or postgres)")
    },
    ({ query, db_type }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please act as a Principal Database Performance Engineer. 
I have a slow SQL query running against ${db_type || "the database"}.

Target Query:
\`\`\`sql
${query}
\`\`\`

Steps to perform:
1. Inspect the execution plan using the appropriate MCP profiler tool.
2. Identify sequential scans, high-cost sorts, or missing compound indexes.
3. Suggest the optimal DDL index creation statement and explain the expected improvement.
4. If applicable, recommend query rewrites (e.g., CTEs, subquery restructuring).`
          }
        }
      ]
    })
  );
}

export function registerDevOpsPrompts(server: NextGenMcpServer) {
  server.server.prompt(
    "pod-crash-triage",
    "Triages failing Kubernetes pods, inspecting events, exit codes and clustered logs",
    {
      pod_name: z.string().describe("Name of the crashing or failing pod"),
      namespace: z.string().optional().describe("Kubernetes namespace (defaults to default)")
    },
    ({ pod_name, namespace }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Perform a root cause analysis (RCA) on the failing Kubernetes pod \`${pod_name}\` (namespace: \`${namespace || "default"}\`).

Investigation checklist:
1. Use \`k8s_diagnose_pod\` to inspect recent lifecycle events, termination exit codes, and OOM flags.
2. Review the clustered log patterns for errors, panics, or configuration misconfigurations.
3. Determine whether the failure is caused by:
   - Memory/CPU limits (OOMKilled)
   - Liveness/Readiness probe failure
   - Application crash / unhandled exception
   - Missing secrets or config maps
4. Provide a concrete remediation plan (e.g. manifest patch or code fix).`
          }
        }
      ]
    })
  );
}
