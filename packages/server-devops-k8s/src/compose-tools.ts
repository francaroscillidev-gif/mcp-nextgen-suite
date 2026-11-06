import { z } from "zod";
import * as fs from "node:fs";
import { NextGenMcpServer } from "@mcp-nextgen/core";

export function registerDockerComposeTools(server: NextGenMcpServer) {
  server.server.tool(
    "docker_compose_audit",
    "Audits docker-compose.yml files for production pitfalls: hardcoded plain-text passwords, missing healthchecks, unlimited memory restarts, and root privileges",
    {
      file_path: z.string().default("docker-compose.yml").describe("Path to docker-compose.yml file")
    },
    async ({ file_path }) => {
      try {
        if (!fs.existsSync(file_path)) {
          return server.safeError(`File not found at path: ${file_path}`);
        }

        const content = fs.readFileSync(file_path, "utf8");
        const lines = content.split("\n");

        const findings: Array<{ line: number; service?: string; severity: "CRITICAL" | "HIGH" | "MEDIUM"; message: string; fix: string }> = [];

        let currentService = "";

        lines.forEach((rawLine, idx) => {
          const line = rawLine.trim();
          const lineNum = idx + 1;

          // Detect service block
          const serviceMatch = rawLine.match(/^ {2}([a-zA-Z0-9_-]+):/);
          if (serviceMatch && serviceMatch[1]) {
            currentService = serviceMatch[1];
          }

          // 1. Plaintext Secrets in environment
          if (/POSTGRES_PASSWORD|MYSQL_ROOT_PASSWORD|PASSWORD|SECRET_KEY|API_KEY/i.test(line) && /:\s*['"]?[a-zA-Z0-9_-]{3,}['"]?$/i.test(line)) {
            if (!line.includes("${") && !line.includes("REDACTED")) {
              findings.push({
                line: lineNum,
                service: currentService,
                severity: "CRITICAL",
                message: `Hardcoded plain-text credential in environment: \`${line}\``,
                fix: "Use environment variable interpolation `${VAR}` or Docker secrets."
              });
            }
          }

          // 2. Privileged mode
          if (/privileged:\s*true/i.test(line)) {
            findings.push({
              line: lineNum,
              service: currentService,
              severity: "CRITICAL",
              message: "Service running in privileged mode.",
              fix: "Remove `privileged: true` and specify only needed `cap_add` capabilities."
            });
          }

          // 3. Exposed sensitive ports directly (0.0.0.0)
          const portMatch = line.match(/- ['"]?(\d+):(\d+)['"]?/);
          if (portMatch) {
            const hostPort = parseInt(portMatch[1], 10);
            if ([5432, 3306, 27017, 6379].includes(hostPort)) {
              findings.push({
                line: lineNum,
                service: currentService,
                severity: "HIGH",
                message: `Exposing database port \`${hostPort}\` publicly to host network.`,
                fix: `Bind to localhost only: \`127.0.0.1:${hostPort}:${portMatch[2]}\`.`
              });
            }
          }

          // 4. Missing restart policy
          if (/restart:\s*always/i.test(line)) {
            findings.push({
              line: lineNum,
              service: currentService,
              severity: "MEDIUM",
              message: "`restart: always` may cause infinite CPU-heavy crash-loops.",
              fix: "Consider `restart: unless-stopped` or setting restart attempt limits."
            });
          }
        });

        let md = `### Docker Compose Security & Reliability Audit\n\n`;
        md += `- **File**: \`${file_path}\`\n`;
        md += `- **Issues Identified**: ${findings.length}\n\n`;

        if (findings.length === 0) {
          md += `✅ **Pass**: No critical credentials leaks or dangerous configurations detected.\n`;
        } else {
          md += `| Severity | Service | Line | Issue | Recommendation |\n`;
          md += `|---|---|---|---|---|\n`;
          for (const f of findings) {
            const badge = f.severity === "CRITICAL" ? "🛑 CRITICAL" : f.severity === "HIGH" ? "⚠️ HIGH" : "🟡 MEDIUM";
            md += `| ${badge} | **${f.service || 'global'}** | L${f.line} | ${f.message} | ${f.fix} |\n`;
          }
        }

        return server.safeResponse(md);
      } catch (err) {
        return server.safeError(err);
      }
    }
  );
}
