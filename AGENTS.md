# AGENTS.md

Instructions and operational rules for AI agents working in this repository.

## ⛔ CRITICAL SECURITY RULE: Environment Variables & Secrets

- **NEVER access, read, open, cat, grep, or inspect `.env` files** (such as `.env`, `.env.local`, `.env.production`, or any `.env*` file containing real values).
- **NEVER print, expose, or log real environment variable values or secrets** (e.g., API keys, database passwords, auth tokens, secret keys) in tool outputs, terminal commands, chat responses, diffs, or artifacts.
- **ALWAYS reference `.env.example` or schema definitions** (e.g., `backend/src/config.ts`) when you need to understand expected configuration keys, types, defaults, or environment variable names.

## 🚨 CRITICAL RULE: Mandatory Frontend & Backend Lint Checks

- **NEVER perform or conclude any changes without running lint checks for BOTH Frontend (FE) and Backend (BE) to make sure ALL files have NO lint errors.**
- **Before completing any task, you MUST run:**
  1. **Frontend Lint**:
     ```bash
     pnpm -C frontend lint
     ```
  2. **Backend Lint**:
     ```bash
     pnpm -C backend lint
     ```
- **Zero Tolerance for Lint Errors**: All reported lint errors must be resolved before presenting changes or finishing execution.

## General Guidelines

- Refer to [CLAUDE.md](file:///Users/safwat/Coding/Projects/side-projects/tijaratk-bot/CLAUDE.md) for architectural overview, commands, and domain guidelines.
- Always preserve codebase integrity and follow existing coding standards.

## ✍️ Content & Blog Author Rule: TijaratkBot Team Only

- **All blog articles, guides, and comparison pieces must ALWAYS have the author set to 'TijaratkBot Team' (`فريق تِجارتك بوت`).**
- **NEVER set an individual person's name as the author for any article.**
- **Author `@type` in structured data (JSON-LD) must always be `Organization`.**
- **Author avatar must point to the official brand icon (`/icon1.png`) or branded team asset.**

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
