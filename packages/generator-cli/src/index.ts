#!/usr/bin/env node
import { Command } from "commander";
import * as fs from "node:fs";
import * as path from "node:path";

const program = new Command();

program
  .name("create-mcp-server")
  .description("Next-Gen CLI generator to scaffold production-ready, secure MCP servers")
  .version("0.1.0")
  .argument("<name>", "Project name (e.g. my-awesome-mcp)")
  .option("-t, --type <type>", "Type of MCP server: standard, db, or devops", "standard")
  .action((name: string, options: { type: string }) => {
    const targetDir = path.resolve(process.cwd(), name);
    if (fs.existsSync(targetDir)) {
      console.error(`Error: Directory "${name}" already exists.`);
      process.exit(1);
    }

    console.log(`🚀 Creating Next-Gen MCP Server in: ${targetDir}`);
    fs.mkdirSync(path.join(targetDir, "src"), { recursive: true });

    // 1. package.json
    const packageJson = {
      name,
      version: "0.1.0",
      description: `Next-Gen MCP Server: ${name}`,
      main: "dist/index.js",
      type: "module",
      bin: {
        [name]: "./dist/index.js"
      },
      author: "Franca Roscilli <francaroscillidev@gmail.com> (https://github.com/francaroscillidev-gif)",
      license: "Apache-2.0",
      scripts: {
        build: "tsc && chmod +x dist/index.js",
        start: "node dist/index.js",
        dev: "tsc -w"
      },
      dependencies: {
        "@mcp-nextgen/core": "*",
        "@modelcontextprotocol/sdk": "^1.6.0",
        "zod": "^3.24.1"
      },
      devDependencies: {
        "typescript": "^5.7.3",
        "@types/node": "^22.10.7"
      }
    };

    fs.writeFileSync(
      path.join(targetDir, "package.json"),
      JSON.stringify(packageJson, null, 2)
    );

    // 2. tsconfig.json
    const tsConfig = {
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        declaration: true,
        outDir: "./dist",
        rootDir: "./src",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true
      },
      include: ["src/**/*"]
    };

    fs.writeFileSync(
      path.join(targetDir, "tsconfig.json"),
      JSON.stringify(tsConfig, null, 2)
    );

    // 3. src/index.ts
    const indexTs = `#!/usr/bin/env node
import { NextGenMcpServer } from "@mcp-nextgen/core";
import { z } from "zod";

async function main() {
  const server = new NextGenMcpServer({
    name: "${name}",
    version: "0.1.0",
    budgetOptions: {
      maxCharacters: 12000,
      maxLines: 200
    }
  });

  // Example Tool with Automatic Secret Redaction & Token Budgeting
  server.server.tool(
    "inspect_resource",
    "Inspects target resource with token-safe output and secret masking",
    {
      target_id: z.string().describe("ID of the target entity"),
      verbose: z.boolean().default(false).describe("Include extra diagnostics")
    },
    async ({ target_id, verbose }) => {
      try {
        const sampleData = {
          id: target_id,
          status: "healthy",
          timestamp: new Date().toISOString(),
          verbose
        };

        return server.safeResponse(
          \`### Resource \${target_id} Diagnostics\\n\\n\` +
          \`\`\`json\\n\${JSON.stringify(sampleData, null, 2)}\\n\`\`\`\`
        );
      } catch (err) {
        return server.safeError(err);
      }
    }
  );

  await server.startStdio();
}

main().catch((err) => {
  console.error("Fatal error starting ${name}:", err);
  process.exit(1);
});
`;

    fs.writeFileSync(path.join(targetDir, "src", "index.ts"), indexTs);

    // 4. README.md
    const readme = `# ${name}

Next-Generation Model Context Protocol (MCP) server generated with \`create-mcp-server\`.

## Features
- 🛡️ Built-in secrets sanitization via \`@mcp-nextgen/core\`
- 📉 Token budgeting & context pruner
- ⚡ Sub-millisecond latency on standard Stdio transport

## Getting Started
\`\`\`bash
npm install
npm run build
npm start
\`\`\`
`;
    fs.writeFileSync(path.join(targetDir, "README.md"), readme);

    console.log(`✅ Successfully scaffolded "${name}"!`);
    console.log(`\nNext steps:`);
    console.log(`  cd ${name}`);
    console.log(`  npm install`);
    console.log(`  npm run build`);
  });

program.parse(process.argv);
