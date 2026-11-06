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
    name: "test-redis-client",
    version: "1.0.0"
  });

  await client.connect(transport);

  console.log("=== Testing Redis Slowlog & Memory Profiler ===");
  const sampleSlowlog = `
    1) (integer) 1
       (integer) 1730900000
       (integer) 152000
       1) "KEYS *"
    2) (integer) 2
       (integer) 1730900100
       (integer) 98000
       1) "HGETALL"
       2) "users:cache:all"
  `;

  const sampleInfoMemory = `
    # Memory
    used_memory_human:850.5M
    used_memory_rss_human:1.6G
    mem_fragmentation_ratio:1.88
    maxmemory_policy:noeviction
  `;

  const res = await client.callTool({
    name: "redis_analyze_slowlog_and_memory",
    arguments: {
      slowlog_output: sampleSlowlog,
      info_memory_output: sampleInfoMemory
    }
  });

  console.log(res.content[0].text);
  await client.close();
}

run().catch(console.error);
