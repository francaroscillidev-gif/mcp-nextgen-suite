import { z } from "zod";
import { NextGenMcpServer, clusterLogs, formatClusteredLogsAsMarkdown } from "@mcp-nextgen/core";
import { safeExec } from "./exec-helper.js";

export function registerK8sTools(server: NextGenMcpServer) {
  // Tool 1: Cluster Health & Failing Pods
  server.server.tool(
    "k8s_cluster_health",
    "Quickly identifies failing pods across namespaces (CrashLoopBackOff, Error, OOMKilled, Pending, Evicted) without dumping thousands of healthy pods",
    {
      namespace: z.string().optional().describe("Namespace to filter by (or omit to check all namespaces)")
    },
    async ({ namespace }) => {
      try {
        const args = ["get", "pods", "-o", "json"];
        if (namespace) {
          args.push("-n", namespace);
        } else {
          args.push("-A");
        }

        const { stdout } = await safeExec("kubectl", args);
        const data = JSON.parse(stdout);
        const items = data.items || [];

        const failingPods: Array<{
          namespace: string;
          name: string;
          phase: string;
          restarts: number;
          reason?: string;
          containerName?: string;
        }> = [];

        let totalPods = items.length;
        let healthyCount = 0;

        for (const pod of items) {
          const ns = pod.metadata?.namespace || "default";
          const name = pod.metadata?.name || "unknown";
          const phase = pod.status?.phase || "Unknown";
          const containerStatuses = pod.status?.containerStatuses || [];

          let hasError = phase !== "Running" && phase !== "Succeeded";
          let totalRestarts = 0;
          let badReason: string | undefined;
          let badContainer: string | undefined;

          for (const cs of containerStatuses) {
            totalRestarts += cs.restartCount || 0;
            if (cs.state?.waiting) {
              hasError = true;
              badReason = cs.state.waiting.reason;
              badContainer = cs.name;
            } else if (cs.state?.terminated && cs.state.terminated.exitCode !== 0) {
              hasError = true;
              badReason = cs.state.terminated.reason || `ExitCode:${cs.state.terminated.exitCode}`;
              badContainer = cs.name;
            }
          }

          if (hasError || totalRestarts > 5) {
            failingPods.push({
              namespace: ns,
              name,
              phase,
              restarts: totalRestarts,
              reason: badReason,
              containerName: badContainer
            });
          } else {
            healthyCount++;
          }
        }

        let report = `### Kubernetes Cluster Health Overview\n\n`;
        report += `- **Total Pods Evaluated**: ${totalPods}\n`;
        report += `- **Healthy Pods**: 🟢 ${healthyCount}\n`;
        report += `- **Degraded/Failing Pods**: ${failingPods.length > 0 ? `🚨 ${failingPods.length}` : '0'}\n\n`;

        if (failingPods.length === 0) {
          report += `*All inspected pods are running normally without abnormal restarts.*\n`;
        } else {
          report += `| Namespace | Pod Name | Phase | Restarts | Issue |\n`;
          report += `|---|---|---|---|---|\n`;
          for (const fp of failingPods) {
            report += `| \`${fp.namespace}\` | **${fp.name}** | ${fp.phase} | ${fp.restarts} | ${fp.reason || 'Anomalous restarts'} |\n`;
          }
        }

        return server.safeResponse(report);
      } catch (err) {
        return server.safeError(err);
      }
    }
  );

  // Tool 2: Diagnose Specific Pod & Recent Events
  server.server.tool(
    "k8s_diagnose_pod",
    "Extracts pod status, container exit codes, recent Kubernetes events, and trailing logs for a target pod",
    {
      pod_name: z.string().describe("Target pod name"),
      namespace: z.string().default("default").describe("Kubernetes namespace"),
      container: z.string().optional().describe("Optional container name inside pod"),
      tail_logs: z.number().default(50).describe("Number of trailing log lines to retrieve")
    },
    async ({ pod_name, namespace, container, tail_logs }) => {
      try {
        // 1. Fetch Events
        let eventsSummary = "";
        try {
          const { stdout: evOut } = await safeExec("kubectl", [
            "get", "events", "-n", namespace,
            "--field-selector", `involvedObject.name=${pod_name}`,
            "--sort-by=.metadata.creationTimestamp"
          ]);
          eventsSummary = evOut.trim();
        } catch (_) {
          eventsSummary = "No events found or insufficient permissions to read events.";
        }

        // 2. Fetch trailing logs
        const logArgs = ["logs", "-n", namespace, pod_name, "--tail", String(tail_logs)];
        if (container) {
          logArgs.push("-c", container);
        }

        let logsReport = "";
        try {
          const { stdout, stderr } = await safeExec("kubectl", logArgs);
          const rawLines = (stdout + "\n" + stderr).trim().split("\n");
          if (rawLines.length > 0 && rawLines[0] !== "") {
            const clustered = clusterLogs(rawLines);
            logsReport = formatClusteredLogsAsMarkdown(clustered);
          } else {
            logsReport = "*No logs output recorded.*";
          }
        } catch (logErr: any) {
          logsReport = `Logs retrieval failed: ${logErr.message}`;
        }

        let output = `### Diagnosis for Pod \`${namespace}/${pod_name}\`\n\n`;
        output += `#### Associated Events:\n`;
        output += eventsSummary ? `\`\`\`\n${eventsSummary}\n\`\`\`\n` : `*No recent events recorded.*\n`;

        output += `\n${logsReport}\n`;

        return server.safeResponse(output);
      } catch (err) {
        return server.safeError(err);
      }
    }
  );
}
