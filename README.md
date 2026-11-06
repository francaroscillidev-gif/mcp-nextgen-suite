# MCP NextGen Suite 🚀

> **Suite open-source di Server e Strumenti per Model Context Protocol (MCP)** ad altissime prestazioni, focalizzati su **budgeting intelligente dei token**, **mascheramento proattivo dei secret** e **diagnostica in tempo reale** per Agenti AI.

---

## 💡 Perché questa Suite?

La maggior parte dei server MCP odierni ha tre problemi critici:
1. **Saturazione del contesto (Token Exhaustion):** Inondano il prompt con migliaia di righe di log o dump grezzi di tabelle.
2. **Fuga di credenziali e PII:** Restituiscono password, stringhe di connessione e token JWT non censurati.
3. **Mancanza di insight azionabili:** Spesso delegano all'LLM l'onere di comprendere comandi a basso livello anziché fornire tool orientati alla diagnostica.

**MCP NextGen Suite** introduce:
- **`@mcp-nextgen/core`**: Runtime MCP con sanitizer automatico di secret, pruner adattivo per preservare la context window e **Log Clustering algoritmico** (riduce l'80-90% del rumore di log ripetitivi nei crash).
- **`@mcp-nextgen/cli` (`create-mcp-server`)**: CLI di scaffolding per generare in pochi secondi nuovi server MCP completi di guardrail di sicurezza e token budget.
- **`@mcp-nextgen/server-db-profiler`**: Profilazione in tempo reale di query lente, piani di esecuzione (EXPLAIN) e suggerimento mirato di indici su SQLite e PostgreSQL.
- **`@mcp-nextgen/server-devops-k8s`**: Diagnostica zero-root, smart triage di pod in `CrashLoopBackOff`/`OOMKilled` e tailing compatto dei log per Docker e Kubernetes.

---

## 📦 Struttura del Monorepo

```text
tool mpc/
├── packages/
│   ├── core/                   # SDK con Sanitizer regex, Token Pruner e Log Clusterer
│   ├── generator-cli/          # CLI scaffolder ("create-mcp-server")
│   ├── server-db-profiler/     # Server MCP per SQLite & PostgreSQL
│   └── server-devops-k8s/      # Server MCP per Docker & Kubernetes
├── scripts/                    # Test di integrazione e demo
└── package.json
```

---

## 🚀 Generare un Nuovo Server MCP con la CLI

Puoi creare un nuovo server MCP istantaneamente con:

```bash
npx @mcp-nextgen/cli my-custom-server
# oppure direttamente da locale:
node packages/generator-cli/dist/index.js my-custom-server
```

---

## 🛠️ Come Eseguire e Integrare i Server

### 1. Build del Progetto
```bash
npm install
npm run build
```

### 2. Configurazione nei Client MCP (Claude Desktop, Cursor, Antigravity)

Aggiungi i server al tuo `mcpServers` nel file di configurazione del tuo client:

```json
{
  "mcpServers": {
    "db-profiler": {
      "command": "node",
      "args": ["/path/to/tool mpc/packages/server-db-profiler/dist/index.js"]
    },
    "devops-k8s": {
      "command": "node",
      "args": ["/path/to/tool mpc/packages/server-devops-k8s/dist/index.js"]
    }
  }
}
```

---

## 🔍 Tool Disponibili

### DB Profiler (`@mcp-nextgen/server-db-profiler`)
- `sqlite_inspect_schema`: Schema rapido, conteggio righe, indici e vincoli FK.
- `sqlite_profile_query`: Esegue `EXPLAIN QUERY PLAN`, individua `SCAN TABLE` / `TEMP B-TREE` e raccomanda indici specifici.
- `postgres_explain_analyze`: Esegue in transazione protetta a sola lettura con `ROLLBACK` forzato `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`.
- `postgres_inspect_slow_queries`: Analizza `pg_stat_statements` per isolare le query a maggior consumo di tempo.

### DevOps & K8s Copilot (`@mcp-nextgen/server-devops-k8s`)
- `docker_ps_health`: Elenco sintetico dello stato di salute e porte dei container.
- `docker_diagnose_container`: Analisi dello stato, exit code, flag `OOMKilled` e ultimi log con deduplicazione algoritmica.
- `k8s_cluster_health`: Triage cluster: filtra e mostra solo i pod in stato anomalo/degradato.
- `k8s_diagnose_pod`: Recupero mirato di eventi recenti e log clusterizzati del pod.

---

## 📑 Prompts e Resources Native MCP

I server implementano le specifiche complete MCP oltre ai soli Tool:
- **MCP Prompts:**
  - `diagnose-query-slowness`: Prompt ingegnerizzato per guidare gli LLM come esperti DBA con checklist di tuning.
  - `pod-crash-triage`: Prompt strutturato per RCA (Root Cause Analysis) di incidenti Kubernetes.
- **MCP Dynamic Resources:**
  - `telemetry://system/live-metrics`: Risorsa dinamica con memoria, uptime e telemetria dei backend in tempo reale.

---

## 👩‍💻 Author & Credits

- **Author**: Franca Roscilli
- **Email**: [francaroscillidev@gmail.com](mailto:francaroscillidev@gmail.com)
- **GitHub**: [@francaroscillidev-gif](https://github.com/francaroscillidev-gif)
- **License**: Apache 2.0 (vedi [LICENSE](LICENSE))

