# Contributing to MCP NextGen Suite 🤝

First off, thank you for considering contributing to **MCP NextGen Suite**! We are building the next generation of high-performance, secure, and token-efficient Model Context Protocol servers.

---

## 🛠️ Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/francaroscillidev-gif/mcp-nextgen-suite.git
   cd mcp-nextgen-suite
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the packages:**
   ```bash
   npm run build
   ```

4. **Run integration tests:**
   ```bash
   npm test
   ```

---

## 📐 Architecture & Standards

- **Security First:** Never allow unchecked command injection or plain-text credentials. Use `sanitizeSecrets()` in `@mcp-nextgen/core` for all tool returns.
- **Token Economy:** Tools must never dump raw megabytes of output into the model context. Always enforce `pruneContext()` or semantic summarization.
- **TypeScript:** Strict type checking is enabled across all workspaces. No `any` without explicit justification.

---

## 📝 Commit Conventions

We follow Conventional Commits:

- `feat:` New MCP tool, engine support or core feature
- `fix:` Bug fix in execution plans or sanitization regex
- `perf:` Performance optimization or token reduction
- `docs:` Documentation improvements
- `test:` Unit or integration test additions

---

## 📬 Questions & Governance

For enterprise support or direct inquiries, contact **Franca Roscilli** at [francaroscillidev@gmail.com](mailto:francaroscillidev@gmail.com).
