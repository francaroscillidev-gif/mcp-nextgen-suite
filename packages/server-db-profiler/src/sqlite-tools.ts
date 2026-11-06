import Database from "better-sqlite3";
import { z } from "zod";
import { NextGenMcpServer } from "@mcp-nextgen/core";

export function registerSqliteTools(server: NextGenMcpServer) {
  // Cache of open SQLite databases by path
  const dbCache = new Map<string, Database.Database>();

  function getDb(dbPath: string): Database.Database {
    let db = dbCache.get(dbPath);
    if (!db) {
      db = new Database(dbPath, { readonly: true, fileMustExist: true });
      dbCache.set(dbPath, db);
    }
    return db;
  }

  // Tool 1: Inspect Tables & Schema
  server.server.tool(
    "sqlite_inspect_schema",
    "Inspect tables, column definitions, data types, indexes and foreign keys in a SQLite database",
    {
      db_path: z.string().describe("Absolute or relative file path to the SQLite database"),
      table_name: z.string().optional().describe("Optional table name to inspect in detail. If omitted, lists all tables")
    },
    async ({ db_path, table_name }) => {
      try {
        const db = getDb(db_path);

        if (!table_name) {
          const tables = db.prepare("SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as Array<{ name: string; type: string }>;
          
          let report = `### SQLite Schema Overview (${tables.length} objects):\n\n`;
          for (const t of tables) {
            const countRow = db.prepare(`SELECT count(*) as count FROM "${t.name}"`).get() as { count: number };
            report += `- **${t.name}** (${t.type}) ~ ${countRow?.count ?? 0} rows\n`;
          }
          return server.safeResponse(report);
        }

        // Detailed Table Inspection
        const tableInfo = db.prepare(`PRAGMA table_info("${table_name}")`).all() as Array<{
          cid: number;
          name: string;
          type: string;
          notnull: number;
          dflt_value: any;
          pk: number;
        }>;

        if (!tableInfo || tableInfo.length === 0) {
          return server.safeError(`Table "${table_name}" not found in database.`);
        }

        const indexList = db.prepare(`PRAGMA index_list("${table_name}")`).all() as Array<{
          seq: number;
          name: string;
          unique: number;
          origin: string;
          partial: number;
        }>;

        const foreignKeys = db.prepare(`PRAGMA foreign_key_list("${table_name}")`).all() as Array<{
          id: number;
          table: string;
          from: string;
          to: string;
        }>;

        let markdown = `### Table: \`${table_name}\`\n\n`;
        markdown += `| Column | Type | Nullable | Primary Key | Default |\n`;
        markdown += `|---|---|---|---|---|\n`;
        for (const col of tableInfo) {
          markdown += `| \`${col.name}\` | ${col.type || 'TEXT'} | ${col.notnull ? 'NO' : 'YES'} | ${col.pk ? 'YES' : 'NO'} | ${col.dflt_value ?? '-'} |\n`;
        }

        markdown += `\n#### Indexes:\n`;
        if (indexList.length === 0) {
          markdown += `*No explicit secondary indexes found.*\n`;
        } else {
          for (const idx of indexList) {
            const indexInfo = db.prepare(`PRAGMA index_info("${idx.name}")`).all() as Array<{ name: string }>;
            const cols = indexInfo.map(i => `\`${i.name}\``).join(', ');
            markdown += `- **${idx.name}** (${idx.unique ? 'UNIQUE' : 'INDEX'}) on [${cols}]\n`;
          }
        }

        markdown += `\n#### Foreign Keys:\n`;
        if (foreignKeys.length === 0) {
          markdown += `*No foreign key constraints defined.*\n`;
        } else {
          for (const fk of foreignKeys) {
            markdown += `- \`${fk.from}\` -> \`${fk.table}\`(\`${fk.to}\`)\n`;
          }
        }

        return server.safeResponse(markdown);
      } catch (err) {
        return server.safeError(err);
      }
    }
  );

  // Tool 2: Explain Query Plan & Bottleneck Diagnosis
  server.server.tool(
    "sqlite_profile_query",
    "Profiles a SELECT query with EXPLAIN QUERY PLAN, identifies full table scans, temp B-trees, and suggests optimal index designs",
    {
      db_path: z.string().describe("File path to the SQLite database"),
      query: z.string().describe("SQL SELECT query to profile")
    },
    async ({ db_path, query }) => {
      try {
        const trimmed = query.trim();
        if (!/^SELECT|^WITH/i.test(trimmed)) {
          return server.safeError("Only read-only SELECT queries are allowed for profiling.");
        }

        const db = getDb(db_path);

        const plan = db.prepare(`EXPLAIN QUERY PLAN ${trimmed}`).all() as Array<{
          id: number;
          parent: number;
          notused: number;
          detail: string;
        }>;

        const bottlenecks: string[] = [];
        const indexSuggestions: string[] = [];

        for (const step of plan) {
          const detail = step.detail;
          if (detail.includes("SCAN TABLE") || detail.includes("SCAN")) {
            bottlenecks.push(`⚠️ **Full Table Scan**: \`${detail}\` (Missing index)`);
            const match = detail.match(/SCAN (?:TABLE )?([a-zA-Z0-9_]+)/i);
            if (match && match[1]) {
              indexSuggestions.push(`Consider indexing filter/join columns on table \`${match[1]}\``);
            }
          }
          if (detail.includes("USE TEMP B-TREE")) {
            bottlenecks.push(`⚠️ **Temporary B-Tree Overhead**: \`${detail}\` (Sorting/Grouping in temporary memory structure)`);
          }
          if (detail.includes("SEARCH")) {
            bottlenecks.push(`✅ **Index Search**: \`${detail}\``);
          }
        }

        let output = `### Query Execution Plan Analysis\n\n`;
        output += `\`\`\`sql\n${trimmed}\n\`\`\`\n\n`;
        output += `#### Steps Detected:\n`;
        for (const step of plan) {
          output += `- [Step ${step.id}] ${step.detail}\n`;
        }

        output += `\n#### Performance Diagnosis:\n`;
        if (bottlenecks.length === 0) {
          output += `*No performance hazards detected.*\n`;
        } else {
          output += bottlenecks.join('\n') + '\n';
        }

        if (indexSuggestions.length > 0) {
          output += `\n#### Recommended Optimizations:\n`;
          for (const sugg of indexSuggestions) {
            output += `- ${sugg}\n`;
          }
        }

        return server.safeResponse(output);
      } catch (err) {
        return server.safeError(err);
      }
    }
  );
}
