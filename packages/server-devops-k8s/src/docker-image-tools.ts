import { z } from "zod";
import { NextGenMcpServer } from "@mcp-nextgen/core";
import { safeExec } from "./exec-helper.js";

export function registerDockerImageSecurityTools(server: NextGenMcpServer) {
  server.server.tool(
    "docker_image_inspect_layers",
    "Inspects Docker image layer bloat, identifies unnecessary package managers/cache leftovers, and recommends multi-stage build optimizations",
    {
      image_name: z.string().describe("Target Docker image name (e.g. node:20, python:3.11-slim, or local tag)")
    },
    async ({ image_name }) => {
      try {
        const { stdout } = await safeExec("docker", ["history", "--no-trunc", "--format", "{{json .}}", image_name]);
        if (!stdout.trim()) {
          return server.safeResponse(`No history found for image "${image_name}".`);
        }

        const lines = stdout.trim().split("\n");
        const layers = lines.map(l => JSON.parse(l));

        const layerRisks: string[] = [];
        let totalSizeApprox = 0;

        for (const layer of layers) {
          const createdBy = layer.CreatedBy || "";
          const size = layer.Size || "0B";

          if (createdBy.includes("apt-get update") && !createdBy.includes("rm -rf /var/lib/apt/lists")) {
            layerRisks.push(`⚠️ Layer used \`apt-get update\` without cleaning \`/var/lib/apt/lists/*\` (adds 30-50MB wasted cache).`);
          }
          if (createdBy.includes("npm install") && !createdBy.includes("--production") && !createdBy.includes("npm cache clean")) {
            layerRisks.push(`⚠️ Layer used \`npm install\` without cleaning cache or devDependencies.`);
          }
          if (createdBy.includes("pip install") && !createdBy.includes("--no-cache-dir")) {
            layerRisks.push(`⚠️ Layer used \`pip install\` without \`--no-cache-dir\` (stores pip cache in layer).`);
          }
          if (createdBy.includes("ADD") && (createdBy.includes(".tar") || createdBy.includes(".zip"))) {
            layerRisks.push(`ℹ️ Considered using \`COPY\` instead of \`ADD\` unless tar auto-extraction is specifically required.`);
          }
        }

        let report = `### Docker Image Layer & Optimization Analysis: \`${image_name}\`\n\n`;
        report += `- **Total Layers Evaluated**: ${layers.length}\n`;
        report += `- **Potential Layer Inefficiencies**: ${layerRisks.length}\n\n`;

        if (layerRisks.length === 0) {
          report += `✅ **Optimized**: No classic package manager cache residue detected in image history.\n`;
        } else {
          report += `#### Detected Anti-patterns:\n`;
          for (const risk of layerRisks) {
            report += `- ${risk}\n`;
          }
          report += `\n#### Recommendations:\n`;
          report += `- Use multi-stage builds (\`FROM ... AS builder\`) to prevent compiler tools & devDependencies in final image.\n`;
          report += `- Chain update & clean in single RUN: \`apt-get update && apt-get install -y --no-install-recommends pkg && rm -rf /var/lib/apt/lists/*\`\n`;
        }

        return server.safeResponse(report);
      } catch (err) {
        return server.safeError(err);
      }
    }
  );
}
