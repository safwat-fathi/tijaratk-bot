<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## ⛔ CRITICAL SECURITY RULE: Environment Variables & Secrets

- **NEVER access, read, open, cat, grep, or inspect `.env` files** (such as `.env`, `.env.local`, `.env.production`, or any `.env*` file containing real values).
- **NEVER print, expose, or log real environment variable values or secrets** (e.g., API keys, auth tokens, secrets) in tool outputs, chat responses, or logs.
- **ALWAYS reference `.env.example` or schema definitions** when inspecting expected configuration keys and environment variable structures.

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

## ⚡ CRITICAL RULE: Server-Side Data Fetching & Page Architecture

- **Strict Server-Side Data Fetching**:
  - All data fetching MUST be performed on the server inside Server Component pages (`page.tsx`) or server actions/data fetchers.
  - Data must be passed down as props to Client Components only when client interactivity is required.
  - **NEVER** fetch initial or primary page data on the client side via `useEffect`, client fetch calls, or client hooks on page load.
- **SSR-Driven Listing, Filtering & Pagination**:
  - All listing, search, filtering, and pagination logic MUST be handled by Server Component pages using Next.js `searchParams`.
  - Pagination and filter controls must update the URL search parameters, allowing the server page to re-fetch and render the updated data.
- **Strict `"use client"` Restriction on Pages**:
  - Route pages (`page.tsx`) MUST NOT have `"use client"` unless the entire page inherently requires direct client-only APIs that cannot be SSR-rendered.
  - Keep `page.tsx` as a Server Component to fetch data, and isolate any interactive UI elements (such as modals, interactive buttons, or form controls) into dedicated client components marked with `"use client"`.

