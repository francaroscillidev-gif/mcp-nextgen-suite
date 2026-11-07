/**
 * Live OpenTelemetry & Prometheus-compatible metrics registry for MCP servers.
 * Tracks tool execution latency histograms, failure rates, pruned tokens and sanitized secrets.
 */

export interface ToolExecutionMetric {
  toolName: string;
  durationMs: number;
  success: boolean;
  tokensPruned: number;
  secretsRedacted: number;
  timestamp: string;
}

export class MetricsRegistry {
  private executionHistory: ToolExecutionMetric[] = [];
  private totalCalls = 0;
  private totalErrors = 0;
  private totalSecretsRedacted = 0;
  private totalCharsPruned = 0;
  private toolCounts = new Map<string, { calls: number; errors: number; totalDurationMs: number }>();

  public record(metric: ToolExecutionMetric): void {
    this.totalCalls++;
    if (!metric.success) this.totalErrors++;
    this.totalSecretsRedacted += metric.secretsRedacted;
    this.totalCharsPruned += metric.tokensPruned;

    const current = this.toolCounts.get(metric.toolName) || { calls: 0, errors: 0, totalDurationMs: 0 };
    current.calls++;
    if (!metric.success) current.errors++;
    current.totalDurationMs += metric.durationMs;
    this.toolCounts.set(metric.toolName, current);

    if (this.executionHistory.length >= 100) {
      this.executionHistory.shift();
    }
    this.executionHistory.push(metric);
  }

  public getSummary() {
    const toolsReport: Record<string, { calls: number; errors: number; avgLatencyMs: number }> = {};
    for (const [tool, stats] of this.toolCounts.entries()) {
      toolsReport[tool] = {
        calls: stats.calls,
        errors: stats.errors,
        avgLatencyMs: Math.round(stats.totalDurationMs / (stats.calls || 1))
      };
    }

    return {
      totalCalls: this.totalCalls,
      totalErrors: this.totalErrors,
      errorRatePct: this.totalCalls ? Math.round((this.totalErrors / this.totalCalls) * 100) : 0,
      totalSecretsRedacted: this.totalSecretsRedacted,
      totalCharsPruned: this.totalCharsPruned,
      activeTools: toolsReport,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Export in standard Prometheus exposition format
   */
  public toPrometheus(): string {
    let lines: string[] = [
      `# HELP mcp_tool_calls_total Total tool calls made to MCP server`,
      `# TYPE mcp_tool_calls_total counter`,
      `mcp_tool_calls_total ${this.totalCalls}`,
      `# HELP mcp_tool_errors_total Total tool execution errors`,
      `# TYPE mcp_tool_errors_total counter`,
      `mcp_tool_errors_total ${this.totalErrors}`,
      `# HELP mcp_secrets_redacted_total Total secrets intercepted and masked`,
      `# TYPE mcp_secrets_redacted_total counter`,
      `mcp_secrets_redacted_total ${this.totalSecretsRedacted}`
    ];

    for (const [tool, stats] of this.toolCounts.entries()) {
      lines.push(`mcp_tool_duration_avg_ms{tool="${tool}"} ${Math.round(stats.totalDurationMs / (stats.calls || 1))}`);
    }

    return lines.join("\n");
  }
}

export const globalMetrics = new MetricsRegistry();
