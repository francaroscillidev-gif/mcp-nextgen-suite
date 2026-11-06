import { z } from "zod";
import { NextGenMcpServer } from "@mcp-nextgen/core";
import { safeExec } from "./exec-helper.js";

export function registerK8sSecurityAuditTools(server: NextGenMcpServer) {
  server.server.tool(
    "k8s_security_audit_manifest",
    "Security linting for Kubernetes YAML manifests or live workloads: detects root execution, missing CPU/RAM limits, privileged mode, and dangerous host mounts",
    {
      manifest_path: z.string().optional().describe("Local path to a YAML/JSON manifest file"),
      live_namespace: z.string().optional().describe("Or audit live pods in a specific Kubernetes namespace")
    },
    async ({ manifest_path, live_namespace }) => {
      try {
        let rawData = "";

        if (manifest_path) {
          const { stdout } = await safeExec("kubectl", ["apply", "--dry-run=client", "-f", manifest_path, "-o", "json"]);
          rawData = stdout;
        } else if (live_namespace) {
          const { stdout } = await safeExec("kubectl", ["get", "pods", "-n", live_namespace, "-o", "json"]);
          rawData = stdout;
        } else {
          return server.safeError("Provide either manifest_path or live_namespace to perform the security audit.");
        }

        const parsed = JSON.parse(rawData);
        const items = parsed.items ? parsed.items : [parsed];

        const warnings: Array<{ resource: string; severity: "CRITICAL" | "HIGH" | "MEDIUM"; issue: string; recommendation: string }> = [];

        for (const item of items) {
          const kind = item.kind || "Resource";
          const name = item.metadata?.name || "unnamed";
          const resLabel = `${kind}/${name}`;

          const podSpec = item.spec?.template?.spec || item.spec || {};
          const containers = podSpec.containers || [];

          // Host access checks
          if (podSpec.hostPID || podSpec.hostNetwork || podSpec.hostIPC) {
            warnings.push({
              resource: resLabel,
              severity: "CRITICAL",
              issue: "Shared host namespace enabled (hostPID, hostNetwork, or hostIPC)",
              recommendation: "Disable host namespaces unless strictly required for low-level node daemons."
            });
          }

          for (const c of containers) {
            const cName = c.name || "container";
            const sec = c.securityContext || {};

            // 1. Privileged mode
            if (sec.privileged) {
              warnings.push({
                resource: `${resLabel} (container: ${cName})`,
                severity: "CRITICAL",
                issue: "Container runs in privileged mode (breaks container isolation)",
                recommendation: "Set `securityContext.privileged: false` and grant only necessary granular Linux capabilities."
              });
            }

            // 2. Running as Root
            if (sec.runAsNonRoot !== true && sec.runAsUser === 0) {
              warnings.push({
                resource: `${resLabel} (container: ${cName})`,
                severity: "HIGH",
                issue: "Container explicitly runs as root (UID 0)",
                recommendation: "Enforce `runAsNonRoot: true` and specify a non-zero `runAsUser`."
              });
            }

            // 3. Writable root filesystem
            if (sec.readOnlyRootFilesystem !== true) {
              warnings.push({
                resource: `${resLabel} (container: ${cName})`,
                severity: "MEDIUM",
                issue: "Root filesystem is writable",
                recommendation: "Set `readOnlyRootFilesystem: true` and use emptyDir mounts for temp files."
              });
            }

            // 4. Missing Resource Limits
            const resources = c.resources || {};
            if (!resources.limits?.cpu || !resources.limits?.memory) {
              warnings.push({
                resource: `${resLabel} (container: ${cName})`,
                severity: "HIGH",
                issue: "Missing CPU or Memory resource limits",
                recommendation: "Define `resources.limits.cpu` and `resources.limits.memory` to prevent noisy neighbor / node OOM."
              });
            }
          }
        }

        let report = `### Kubernetes Workload Security Audit Report\n\n`;
        report += `- **Total Resources Inspected**: ${items.length}\n`;
        report += `- **Total Violations Detected**: ${warnings.length}\n\n`;

        if (warnings.length === 0) {
          report += `✅ **Passed**: No critical misconfigurations or security violations detected.\n`;
        } else {
          report += `| Severity | Resource | Issue | Recommended Fix |\n`;
          report += `|---|---|---|---|\n`;
          for (const w of warnings) {
            const icon = w.severity === "CRITICAL" ? "🛑 CRITICAL" : w.severity === "HIGH" ? "⚠️ HIGH" : "🟡 MEDIUM";
            report += `| ${icon} | \`${w.resource}\` | ${w.issue} | ${w.recommendation} |\n`;
          }
        }

        return server.safeResponse(report);
      } catch (err) {
        return server.safeError(err);
      }
    }
  );
}
