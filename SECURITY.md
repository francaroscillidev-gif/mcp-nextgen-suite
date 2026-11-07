# Security Policy & Vulnerability Reporting 🛡️

At **MCP NextGen Suite**, security is our top priority. Our servers interact directly with database schemas, logs, containers, and AI agent execution contexts.

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability (such as a pattern bypass in `sanitizeSecrets`, unauthorized local privilege escalation, or shell injection hazard):

1. **Do NOT open a public GitHub issue.**
2. Send an email directly to the maintainer:
   - **Lead Developer**: Franca Roscilli
   - **Email**: [francaroscillidev@gmail.com](mailto:francaroscillidev@gmail.com)
3. Please include:
   - Detailed steps to reproduce
   - Affected package (`@mcp-nextgen/core`, `@mcp-nextgen/server-db-profiler`, etc.)
   - Expected vs actual impact

We will acknowledge your report within 48 hours and work on a prioritized remediation.
