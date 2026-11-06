import pg from "pg";
import { z } from "zod";
import { NextGenMcpServer } from "@mcp-nextgen/core";

export function registerPostgresTools(server: NextGenMcpServer) {
  const poolCache = new Map<string, pg.Pool>();

  function getPool(connString: string): pg.Pool {
    let pool = poolCache.get(connString);
    if (!pool) {
      pool = new pg.Pool({
        connectionString: connString,
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
        // Enforce read-only transaction mode default when possible
      });
      poolCache.set(connString, pool);
    }
    return pool;
  }

  // Tool 1: Explain & Analyze with Automatic Transaction Rollback
  server.server.tool(
    "postgres_explain_analyze",
    "Safely profiles a PostgreSQL query using EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) inside a read-only rolled-back transaction to detect Seq Scans, disk spills, and high-cost operators",
    {
      connection_string: z.string().describe("PostgreSQL connection string (credentials will be automatically masked in outputs)"),
      query: z.string().describe("SQL query to analyze"),
      buffers: z.boolean().default(true).describe("Include buffer hit/miss statistics")
    },
    async ({ connection_string, query, buffers }) => {
      let client: pg.PoolClient | null = null;
      try {
        const pool = getPool(connection_string);
        client = await pool.connect();

        // Start read only transaction
        await client.query("BEGIN TRANSACTION READ ONLY;");

        const explainCmd = `EXPLAIN (ANALYZE, BUFFERS ${buffers ? 'TRUE' : 'FALSE'}, FORMAT JSON) ${query};`;
        const res = await client.query(explainCmd);

        // Always rollback
        await client.query("ROLLBACK;");

        const planJson = res.rows[0]?.["QUERY PLAN"]?.[0];
        if (!planJson) {
          return server.safeResponse("No plan returned.");
        }

        const rootPlan = planJson["Plan"];
        const executionTime = planJson["Execution Time"];
        const planningTime = planJson["Planning Time"];

        // Extract key indicators
        const findings: string[] = [];
        function walkPlan(node: any) {
          if (!node) return;
          if (node["Node Type"] === "Seq Scan") {
            findings.push(`⚠️ **Sequential Scan on \`${node["Relation Name"]}\`**: Filtered ${node["Rows Removed by Filter"] ?? 0} rows. (Cost: ${node["Total Cost"]})`);
          }
          if (node["Node Type"] === "Sort" && node["Sort Method"]?.includes("disk")) {
            findings.push(`🚨 **Sort Spilled to Disk**: Used ${node["Sort Method"]}. Consider increasing \`work_mem\`.`);
          }
          if (node["Plans"]) {
            for (const child of node["Plans"]) {
              walkPlan(child);
            }
          }
        }
        walkPlan(rootPlan);

        let report = `### PostgreSQL Query Execution Summary\n\n`;
        report += `- **Total Execution Time**: ${executionTime} ms\n`;
        report += `- **Planning Time**: ${planningTime} ms\n`;
        report += `- **Root Operator**: ${rootPlan["Node Type"]} (Cost: ${rootPlan["Startup Cost"]}..${rootPlan["Total Cost"]})\n\n`;

        report += `#### Bottlenecks & Critical Findings:\n`;
        if (findings.length === 0) {
          report += `*No major bottlenecks (like sequential scans or disk spills) found in this plan.*\n`;
        } else {
          report += findings.join("\n") + "\n";
        }

        report += `\n#### Raw Plan Structure:\n\`\`\`json\n${JSON.stringify(rootPlan, null, 2)}\n\`\`\``;

        return server.safeResponse(report);
      } catch (err) {
        if (client) {
          try { await client.query("ROLLBACK;"); } catch (_) {}
        }
        return server.safeError(err);
      } finally {
        if (client) {
          client.release();
        }
      }
    }
  );

  // Tool 2: Detect Slowest Queries from pg_stat_statements
  server.server.tool(
    "postgres_inspect_slow_queries",
    "Queries pg_stat_statements (if available) to retrieve the top queries consuming the most total or mean execution time",
    {
      connection_string: z.string().describe("PostgreSQL connection string"),
      limit: z.number().default(5).describe("Number of top queries to return")
    },
    async ({ connection_string, limit }) => {
      try {
        const pool = getPool(connection_string);
        const query = `
          SELECT 
            queryid,
            substring(query, 1, 150) as query_sample,
            calls,
            round(total_exec_time::numeric, 2) as total_time_ms,
            round(mean_exec_time::numeric, 2) as mean_time_ms,
            round((100 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0))::numeric, 1) as cache_hit_pct
          FROM pg_stat_statements
          ORDER BY total_exec_time DESC
          LIMIT $1;
        `;

        const res = await pool.query(query, [limit]);
        if (res.rows.length === 0) {
          return server.safeResponse("No records found in `pg_stat_statements`. Ensure the extension is enabled (`CREATE EXTENSION IF NOT EXISTS pg_stat_statements;`).");
        }

        let out = `### Top ${res.rows.length} Costliest Queries (from \`pg_stat_statements\`)\n\n`;
        out += `| Calls | Total (ms) | Mean (ms) | Cache Hit % | Query Preview |\n`;
        out += `|---|---|---|---|---|\n`;
        for (const row of res.rows) {
          out += `| ${row.calls} | ${row.total_time_ms} | ${row.mean_time_ms} | ${row.cache_hit_pct ?? 'N/A'}% | \`${row.query_sample.replace(/[\n\r]+/g, ' ')}...\` |\n`;
        }

        return server.safeResponse(out);
      } catch (err) {
        return server.safeError(err);
      }
    }
  );
}
