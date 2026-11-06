/**
 * Log clusterer and anomaly detector.
 * Aggregates repetitive log messages (e.g. repeated connection errors)
 * into counted summary groups to slash token usage by 80-90%.
 */

export interface ClusteredLog {
  pattern: string;
  count: number;
  sample: string;
  firstSeenIndex: number;
}

export function clusterLogs(logLines: string[]): {
  clusters: ClusteredLog[];
  totalLines: number;
  uniquePatterns: number;
} {
  const patternMap = new Map<string, { count: number; sample: string; firstIndex: number }>();

  // Regex to normalize variable values (timestamps, UUIDs, IPs, hex numbers)
  const normRegex = [
    // Timestamps ISO/Syslog
    { r: /\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?/g, s: '<TIMESTAMP>' },
    // IPv4
    { r: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?::\d+)?\b/g, s: '<IP>' },
    // UUIDs
    { r: /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g, s: '<UUID>' },
    // Hex hashes / IDs
    { r: /\b0x[0-9a-fA-F]+\b|\b[0-9a-fA-F]{12,64}\b/g, s: '<HASH>' },
    // Numbers
    { r: /\b\d+\b/g, s: '<NUM>' }
  ];

  logLines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let normalized = trimmed;
    for (const { r, s } of normRegex) {
      normalized = normalized.replace(r, s);
    }

    const existing = patternMap.get(normalized);
    if (existing) {
      existing.count++;
    } else {
      patternMap.set(normalized, {
        count: 1,
        sample: trimmed,
        firstIndex: index
      });
    }
  });

  const clusters: ClusteredLog[] = Array.from(patternMap.entries()).map(([pattern, data]) => ({
    pattern,
    count: data.count,
    sample: data.sample,
    firstSeenIndex: data.firstIndex
  }));

  // Sort by count descending so highest-frequency messages come first
  clusters.sort((a, b) => b.count - a.count);

  return {
    clusters,
    totalLines: logLines.length,
    uniquePatterns: clusters.length
  };
}

export function formatClusteredLogsAsMarkdown(clustered: ReturnType<typeof clusterLogs>): string {
  const { clusters, totalLines, uniquePatterns } = clustered;
  let md = `### Log Analysis Summary (${totalLines} lines reduced to ${uniquePatterns} unique patterns)\n\n`;
  md += `| Frequency | Pattern Sample |\n`;
  md += `|---|---|\n`;

  for (const c of clusters.slice(0, 30)) { // Top 30 patterns max
    const freqBadge = c.count > 10 ? `🔥 **${c.count}x**` : `${c.count}x`;
    const escaped = c.sample.replace(/\|/g, '\\|').slice(0, 120);
    md += `| ${freqBadge} | \`${escaped}${c.sample.length > 120 ? '...' : ''}\` |\n`;
  }

  return md;
}
