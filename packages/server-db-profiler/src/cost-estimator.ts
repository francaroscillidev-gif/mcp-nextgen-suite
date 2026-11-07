import { z } from "zod";
import { NextGenMcpServer } from "@mcp-nextgen/core";

export function registerQueryCostEstimator(server: NextGenMcpServer) {
  server.server.tool(
    "sql_estimate_cost_impact",
    "Pre-execution static SQL impact analyzer: flags Cartesian Cross Joins, non-SARGable WHERE functions, unindexed LIKE wildcards (%term), and estimate computational blast radius before running in production",
    {
      query: z.string().describe("SQL query to pre-screen"),
      table_metadata: z.record(z.object({ estimated_rows: z.number().default(10000) })).optional().describe("Optional dictionary of table names and their approximate row counts")
    },
    async ({ query, table_metadata }) => {
      try {
        const issues: Array<{ risk: "HIGH" | "MEDIUM" | "LOW"; rule: string; explanation: string; remedy: string }> = [];

        const normalized = query.replace(/\s+/g, " ");

        // 1. Cartesian Product / Cross Join
        if (/,/i.test(normalized) && /FROM\s+[a-zA-Z0-9_]+\s*,\s*[a-zA-Z0-9_]+/i.test(normalized) && !/WHERE/i.test(normalized)) {
          issues.push({
            risk: "HIGH",
            rule: "Implicit Cross Join (Cartesian Product)",
            explanation: "Multiple tables selected in FROM clause without a join condition produces N x M rows.",
            remedy: "Use explicit `INNER JOIN ... ON ...` with indexing."
          });
        }

        // 2. Non-SARGable functions in WHERE clause
        const funcWhereRegex = /WHERE\s+.*?(DATE|YEAR|MONTH|UPPER|LOWER|SUBSTR|COALESCE)\s*\([a-zA-Z0-9_.]+\)/i;
        if (funcWhereRegex.test(normalized)) {
          issues.push({
            risk: "HIGH",
            rule: "Non-SARGable Function Call on Column",
            explanation: "Wrapping indexed columns in scalar functions (e.g. UPPER(name) = 'FOO') invalidates B-tree indexes, forcing sequential scan.",
            remedy: "Use functional indexes (e.g. `CREATE INDEX ON table(LOWER(col))`) or rewrite predicate."
          });
        }

        // 3. Leading Wildcard in LIKE
        if (/LIKE\s*['"]%[a-zA-Z0-9_]+/i.test(normalized)) {
          issues.push({
            risk: "MEDIUM",
            rule: "Leading Wildcard in LIKE Predicate (`%term`)",
            explanation: "Standard B-tree indexes cannot seek prefixes when the pattern begins with `%`, requiring a full index or table scan.",
            remedy: "Use Full-Text Search (tsvector/pg_trgm in PostgreSQL) or trailing wildcard only (`term%`)."
          });
        }

        // 4. SELECT * on wide tables
        if (/SELECT\s+\*\s+FROM/i.test(normalized)) {
          issues.push({
            risk: "LOW",
            rule: "Unconstrained Projection (`SELECT *`)",
            explanation: "Retrieves unnecessary LOB/TEXT columns, increases network payload, and defeats index-only cover scans.",
            remedy: "Specify explicit column list."
          });
        }

        let report = `### Pre-Execution SQL Static Impact Analysis\n\n`;
        report += `- **Query Evaluated**: \`${query.slice(0, 100)}${query.length > 100 ? '...' : ''}\`\n`;
        report += `- **Detected Performance Hazards**: ${issues.length}\n\n`;

        if (issues.length === 0) {
          report += `✅ **Pass**: No classic anti-patterns (Cartesian products, non-SARGable functions, or leading wildcards) detected.\n`;
        } else {
          report += `| Risk Level | Anti-Pattern | Operational Hazard | Mitigation |\n`;
          report += `|---|---|---|---|\n`;
          for (const item of issues) {
            const badge = item.risk === "HIGH" ? "🛑 HIGH" : item.risk === "MEDIUM" ? "⚠️ MEDIUM" : "ℹ️ LOW";
            report += `| ${badge} | **${item.rule}** | ${item.explanation} | ${item.remedy} |\n`;
          }
        }

        return server.safeResponse(report);
      } catch (err) {
        return server.safeError(err);
      }
    }
  );
}
