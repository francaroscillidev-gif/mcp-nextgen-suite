import { clusterLogs, formatClusteredLogsAsMarkdown } from "../packages/core/dist/index.js";

// Simulate 50 log lines with heavy repetition typical of a crashing app
const sampleLogs = [
  "2026-11-06T15:00:01Z [INFO] Server started on port 8080",
  "2026-11-06T15:00:02Z [ERROR] Failed to connect to db at 192.168.1.15:5432 - ConnectionRefused",
  "2026-11-06T15:00:03Z [ERROR] Failed to connect to db at 192.168.1.15:5432 - ConnectionRefused",
  "2026-11-06T15:00:04Z [ERROR] Failed to connect to db at 192.168.1.15:5432 - ConnectionRefused",
  "2026-11-06T15:00:05Z [ERROR] Failed to connect to db at 192.168.1.15:5432 - ConnectionRefused",
  "2026-11-06T15:00:06Z [ERROR] Failed to connect to db at 192.168.1.15:5432 - ConnectionRefused",
  "2026-11-06T15:00:07Z [WARN] Healthcheck timeout on endpoint /healthz for worker-01",
  "2026-11-06T15:00:08Z [WARN] Healthcheck timeout on endpoint /healthz for worker-02",
  "2026-11-06T15:00:09Z [FATAL] Process exited with exit code 1"
];

console.log("=== Original Logs (9 lines) ===");
const clustered = clusterLogs(sampleLogs);
console.log(formatClusteredLogsAsMarkdown(clustered));
