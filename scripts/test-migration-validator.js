import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { resolve } from "node:path";

async function run() {
  const serverPath = resolve("./packages/server-db-profiler/dist/index.js");
  const transport = new StdioClientTransport({
    command: "node",
    args: [serverPath]
  });

  const client = new Client({
    name: "test-migration-validator",
    version: "1.0.0"
  });

  await client.connect(transport);

  console.log("=== Testing Migration Safety Validator ===");
  const unsafeDdl = `
    -- Dangerous migration
    ALTER TABLE users ADD COLUMN phone_number VARCHAR(20) NOT NULL;
    CREATE INDEX idx_users_phone ON users(phone_number);
    ALTER TABLE orders RENAME COLUMN total_amount TO grand_total;
    DROP TABLE legacy_audit_logs;
  `;

  const res = await client.callTool({
    name: "sql_validate_migration_safety",
    arguments: {
      sql_ddl: unsafeDdl,
      dialect: "postgres"
    }
  });

  console.log(res.content[0].text);

  await client.close();
}

run().catch(console.error);
