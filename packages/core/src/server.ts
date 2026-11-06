import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { sanitizeSecrets } from "./sanitizer.js";
import { pruneContext, BudgetOptions } from "./pruner.js";

export interface CreateNextGenServerOptions {
  name: string;
  version: string;
  budgetOptions?: BudgetOptions;
}

export class NextGenMcpServer {
  public readonly server: McpServer;
  private readonly serverName: string;
  private budgetOptions?: BudgetOptions;

  constructor(options: CreateNextGenServerOptions) {
    this.serverName = options.name;
    this.server = new McpServer({
      name: options.name,
      version: options.version
    });
    this.budgetOptions = options.budgetOptions;
  }

  /**
   * Helper to format tool responses safely:
   * 1. Redacts secrets/passwords
   * 2. Enforces token budgets to avoid saturating context
   */
  public safeResponse(content: string, options?: BudgetOptions) {
    const clean = sanitizeSecrets(content);
    const { text, truncated } = pruneContext(clean, { ...this.budgetOptions, ...options });
    
    return {
      content: [
        {
          type: "text" as const,
          text: truncated ? `${text}\n\n*(Note: Output pruned to conserve model context budget)*` : text
        }
      ]
    };
  }

  public safeError(err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const cleanMessage = sanitizeSecrets(message);
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
