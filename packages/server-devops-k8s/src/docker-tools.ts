import { z } from "zod";
import { NextGenMcpServer, clusterLogs, formatClusteredLogsAsMarkdown } from "@mcp-nextgen/core";
import { safeExec } from "./exec-helper.js";

export function registerDockerTools(server: NextGenMcpServer) {
  // Tool 1: List containers with health & resource stats
  server.server.tool(
    "docker_ps_health",
    "Lists local Docker containers with their exact status, healthcheck status, restart count, and ports without full verbose inspection",
    {
      all: z.boolean().default(true).describe("Show all containers (default true to include stopped/crashed containers)")
    },
    async ({ all }) => {
      try {
        const args = ["ps", "--format", "{{json .}}"];
        if (all) args.push("-a");

        const { stdout } = await safeExec("docker", args);
        if (!stdout.trim()) {
          return server.safeResponse("No Docker containers found running or stopped.");
        }

        const lines = stdout.trim().split("\n");
        const containers = lines.map(line => JSON.parse(line));

        let report = `### Docker Containers Status (${containers.length} containers)\n\n`;
        report += `| ID | Names | Image | Status | State | Ports |\n`;
        report += `|---|---|---|---|---|---|\n`;

        for (const c of containers) {
          const isError = c.State === "exited" || c.Status?.includes("unhealthy");
          const stateIcon = isError ? "🔴" : c.State === "running" ? "🟢" : "⚪";
          report += `| \`${c.ID.slice(0, 10)}\` | **${c.Names}** | \`${c.Image}\` | ${c.Status} | ${stateIcon} ${c.State} | ${c.Ports || '-'} |\n`;
        }

        return server.safeResponse(report);
      } catch (err) {
        return server.safeError(err);
      }
    }
  );

  // Tool 2: Diagnose Container Crash & Smart Logs
  server.server.tool(
    "docker_diagnose_container",
    "Inspects exit code, OOMKilled flag, last 40 log lines, and restart reasons of a specific container",
    {
      container_id_or_name: z.string().describe("Container name or ID to diagnose"),
      tail_logs: z.number().default(40).describe("Number of recent log lines to fetch")
    },
    async ({ container_id_or_name, tail_logs }) => {
      try {
        // 1. Inspect container metadata
        const { stdout: inspectRaw } = await safeExec("docker", ["inspect", container_id_or_name]);
        const data = JSON.parse(inspectRaw)[0];
        if (!data) {
          return server.safeError(`Container "${container_id_or_name}" not found.`);
        }

        const state = data.State || {};
        const config = data.Config || {};

        let diag = `### Diagnosis for Container: \`${container_id_or_name}\`\n\n`;
        diag += `- **Status**: ${state.Status} (Running: ${state.Running})\n`;
        diag += `- **Exit Code**: ${state.ExitCode}\n`;
        diag += `- **OOMKilled**: ${state.OOMKilled ? "🚨 YES (Process killed by kernel Out-Of-Memory)" : "No"}\n`;
        diag += `- **Error**: ${state.Error || "None"}\n`;
        diag += `- **Started At**: ${state.StartedAt}\n`;
        diag += `- **Finished At**: ${state.FinishedAt}\n`;
        diag += `- **Restart Count**: ${data.RestartCount ?? 0}\n`;

        // 2. Fetch logs safely
        let logsReport = "";
        try {
          const { stdout: logOut, stderr: logErr } = await safeExec("docker", ["logs", "--tail", String(tail_logs), container_id_or_name]);
          const rawLogs = (logOut + "\n" + logErr).trim().split("\n");
          if (rawLogs.length > 0 && rawLogs[0] !== "") {
            const clustered = clusterLogs(rawLogs);
            logsReport = formatClusteredLogsAsMarkdown(clustered);
          } else {
            logsReport = "No logs recorded.";
          }
        } catch (logEx: any) {
          logsReport = `Failed to fetch logs: ${logEx.message}`;
        }

        diag += `\n${logsReport}\n`;

        return server.safeResponse(diag);
      } catch (err) {
        return server.safeError(err);
      }
    }
  );
}
