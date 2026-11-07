import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { sanitizeSecrets } from "./sanitizer.js";
import { pruneContext, BudgetOptions } from "./pruner.js";
import { SlidingWindowRateLimiter, RateLimitConfig } from "./rate-limiter.js";
import { globalMetrics } from "./metrics.js";

export interface CreateNextGenServerOptions {
  name: string;
  version: string;
  budgetOptions?: BudgetOptions;
  rateLimitConfig?: RateLimitConfig;
}

export class NextGenMcpServer {
  public readonly server: McpServer;
  private readonly serverName: string;
  private budgetOptions?: BudgetOptions;
  private rateLimiter: SlidingWindowRateLimiter;

  constructor(options: CreateNextGenServerOptions) {
    this.serverName = options.name;
    this.server = new McpServer({
      name: options.name,
      version: options.version
    });
    this.budgetOptions = options.budgetOptions;
    this.rateLimiter = new SlidingWindowRateLimiter(options.rateLimitConfig);
  }

  /**
   * Checks rate limiting for an incoming tool execution.
   */
  public checkRateLimit(clientId = "default"): { allowed: boolean; retryAfterMs: number } {
    const res = this.rateLimiter.checkLimit(clientId);
    return { allowed: res.allowed, retryAfterMs: res.retryAfterMs };
  }

  /**
   * Helper to format tool responses safely:
   * 1. Redacts secrets/passwords
   * 2. Enforces token budgets to avoid saturating context
   * 3. Records metrics
   */
  public safeResponse(content: string, options?: BudgetOptions & { toolName?: string; durationMs?: number }) {
    const startTime = Date.now();
    const clean = sanitizeSecrets(content);
    const { text, truncated, originalLength } = pruneContext(clean, { ...this.budgetOptions, ...options });
    
    // Count redacted patterns
    const secretsCount = (clean.match(/\[REDACTED_/g) || []).length;
    const charsPruned = truncated ? Math.max(0, originalLength - text.length) : 0;

    if (options?.toolName) {
      globalMetrics.record({
        toolName: options.toolName,
        durationMs: options.durationMs ?? (Date.now() - startTime),
        success: true,
        tokensPruned: charsPruned,
        secretsRedacted: secretsCount,
        timestamp: new Date().toISOString()
      });
    }

    return {
      content: [
        {
          type: "text" as const,
          text: truncated ? `${text}\n\n*(Note: Output pruned to conserve model context budget)*` : text
        }
      ]
    };
  }

  public safeError(err: unknown, toolName?: string) {
    const message = err instanceof Error ? err.message : String(err);
    const cleanMessage = sanitizeSecrets(message);

    if (toolName) {
      globalMetrics.record({
        toolName,
        durationMs: 0,
        success: false,
        tokensPruned: 0,
        secretsRedacted: 0,
        timestamp: new Date().toISOString()
      });
    }

    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text: `[Error]: ${cleanMessage}`
        }
      ]
    };
  }

  public async startStdio() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error(`[NextGen-MCP] ${this.serverName} running on stdio transport`);
  }
}
