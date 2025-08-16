# Repository Guidelines

## Project Structure & Module Organization
- `src/`: Cloudflare Worker MCP agent entry (`index.ts`) plus modular tool files (`*Tools.ts`), clients (`azure-*-client.ts`), utilities (`src/utils/*`), schemas, and types.
- `tail-worker/`: Tail consumer service for log streaming; entry at `tail-worker/src/index.ts` and its own `wrangler.jsonc`.
- `examples/`: Minimal client and usage examples.
- `docs/` and `mcp-documentation/`: Reference material and guides for MCP/Cloudflare.
- Root config: `wrangler.jsonc`, `tsconfig.json`, `.prettierrc`, and generated `worker-configuration.d.ts` (from Wrangler types).

## Build, Test, and Development Commands
- `npm run dev`: Start the primary Worker locally (defaults to `http://127.0.0.1:8788`).
- `npm run dev:both`: Run primary Worker and tail worker (tail on `8790`).
- `npm run deploy` / `npm run deploy:tail`: Deploy the primary/tail workers.
- `npm run type-check`: Strict TypeScript checks (no emit).
- `npm run cf-typegen`: Regenerate Cloudflare binding types (`worker-configuration.d.ts`).

## Coding Style & Naming Conventions
- TypeScript strict mode; target `es2021`, modules `es2022`, Workers `nodejs_compat` enabled.
- Prettier: 2‑space indent, double quotes, semicolons, `printWidth: 140`.
- Naming: files for tools use `PascalCase` + `Tools` (e.g., `IndexTools.ts`); utilities live under `src/utils/`. Functions/variables `camelCase`; types/interfaces `PascalCase`; constants in `src/constants.ts`.
- Prefer Zod schemas where applicable and keep types in `src/types.ts`.

## Testing Guidelines
- No unit test runner configured. Validate with `npm run type-check` and exercise tools via `npm run dev` (or `examples/elicitation-client.ts`).
- If adding tests, use Vitest or Jest, place under `tests/`, name files `*.test.ts`, and cover core tool modules and clients.

## Commit & Pull Request Guidelines
- Commits: Prefer Conventional Commits (`fix:`, `refactor:`, `feat:`). Use imperative, concise subjects; include scope when helpful.
- PRs: Provide a clear description, linked issues, and verification steps (commands/output). Keep diffs focused and update docs/examples when behavior changes. Ensure `npm run type-check` passes and `wrangler dev` starts cleanly.

## Security & Configuration Tips
- Do not commit secrets. For local dev use `.dev.vars`; for deploy use Wrangler secrets:
  - `npx wrangler secret put AZURE_SEARCH_ENDPOINT`
  - `npx wrangler secret put AZURE_SEARCH_API_KEY`
  - `npx wrangler secret put AZURE_OPENAI_ENDPOINT | AZURE_OPENAI_API_KEY | AZURE_OPENAI_DEPLOYMENT`
- Required bindings are reflected in `worker-configuration.d.ts` (e.g., `MCP_OBJECT` Durable Object).

