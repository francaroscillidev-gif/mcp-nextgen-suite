import { z } from "zod";
import { NextGenMcpServer } from "@mcp-nextgen/core";

export function registerDbMigrationValidator(server: NextGenMcpServer) {
  server.server.tool(
    "sql_validate_migration_safety",
    "Analyzes DDL migration statements for production hazards (exclusive table locks, slow column additions, unsafe default values, and missing CONCURRENTLY)",
    {
      sql_ddl: z.string().describe("DDL SQL script or migration statements to inspect"),
      dialect: z.enum(["postgres", "sqlite", "mysql"]).default("postgres").describe("SQL dialect target")
    },
    async ({ sql_ddl, dialect }) => {
      try {
        const lines = sql_ddl.split("\n");
        const hazards: Array<{
          line: number;
          rule: string;
          severity: "HIGH" | "MEDIUM" | "INFO";
          recommendation: string;
        }> = [];

        lines.forEach((line, idx) => {
          const l = line.trim();
          if (!l || l.startsWith("--") || l.startsWith("/*")) return;

          // 1. Postgres: Non-concurrent index creation
          if (dialect === "postgres" && /CREATE\s+INDEX/i.test(l) && !/CONCURRENTLY/i.test(l)) {
            hazards.push({
              line: idx + 1,
              rule: "Non-concurrent Index Creation",
              severity: "HIGH",
              recommendation: "Use `CREATE INDEX CONCURRENTLY` to avoid acquiring an EXCLUSIVE write lock on the table."
            });
          }

          // 2. Adding NOT NULL column without DEFAULT
          if (/ALTER\s+TABLE\s+.*ADD\s+COLUMN\s+.*NOT\s+NULL/i.test(l) && !/DEFAULT/i.test(l)) {
            hazards.push({
              line: idx + 1,
              rule: "NOT NULL without default on existing table",
              severity: "HIGH",
              recommendation: "Adding NOT NULL without a default will fail if the table already contains rows. Add the column nullable first, backfill data, then set NOT NULL."
            });
          }

          // 3. Renaming columns/tables in live deployments
          if (/RENAME\s+(COLUMN|TABLE)/i.test(l)) {
            hazards.push({
              line: idx + 1,
              rule: "Live Rename Operation",
              severity: "HIGH",
              recommendation: "Renaming columns breaks running app instances. Use expand-contract pattern (add new column, sync data, deprecate old)."
            });
          }

          // 4. Drop table / drop column
          if (/DROP\s+(COLUMN|TABLE)/i.test(l)) {
            hazards.push({
              line: idx + 1,
              rule: "Destructive Drop Operation",
              severity: "HIGH",
              recommendation: "Ensure this column/table is completely decoupled from all microservices and backups are taken before dropping."
            });
          }

          // 5. Changing column types
          if (/ALTER\s+TABLE\s+.*ALTER\s+COLUMN\s+.*TYPE/i.test(l)) {
            hazards.push({
              line: idx + 1,
              rule: "Column Type Rewrite",
              severity: "MEDIUM",
              recommendation: "Changing column types often forces a full table rewrite and table lock. Test on staging with production-scale data."
            });
          }
        });

        let out = `### DDL Migration Safety Analysis (${dialect.toUpperCase()})\n\n`;
        out += `- **Statements Evaluated**: ${lines.length} lines\n`;
        out += `- **Identified Hazards**: ${hazards.length}\n\n`;

        if (hazards.length === 0) {
          out += `✅ **Clean Migration**: No common high-risk deployment locks or anti-patterns detected.\n`;
        } else {
          out += `| Line | Severity | Hazard | Recommended Practice |\n`;
          out += `|---|---|---|---|\n`;
          for (const h of hazards) {
            const badge = h.severity === "HIGH" ? "🚨 HIGH" : h.severity === "MEDIUM" ? "⚠️ MEDIUM" : "ℹ️ INFO";
            out += `| ${h.line} | ${badge} | **${h.rule}** | ${h.recommendation} |\n`;
          }
        }

        return server.safeResponse(out);
      } catch (err) {
        return server.safeError(err);
      }
    }
  );
}
