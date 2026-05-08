# TRACE

Reasoning and Answer-path Comprehension Engine. Next.js interface that renders a knowledge-graph subgraph and highlights the path between a question and its predicted answer.

## Requirements

- Node.js 20+
- pnpm 9.12+
- PostgreSQL 14+ (local or hosted)
- Vercel AI Gateway API key (or substitute another AI SDK provider in `lib/ai`)

## Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Create `.env.local` in the repo root:

   ```bash
   POSTGRES_URL=postgres://user:password@localhost:5432/trace
   AI_GATEWAY_API_KEY=your_key_here
   ```

3. Apply database migrations:

   ```bash
   pnpm db:migrate
   ```

## Run

```bash
pnpm dev
```

App serves on [http://localhost:3000](http://localhost:3000).

## Other scripts

- `pnpm build` — production build (runs migrations first)
- `pnpm start` — serve the production build
- `pnpm lint` / `pnpm format` — Biome via Ultracite
- `pnpm db:studio` — Drizzle Studio
- `pnpm test` — Playwright suite

## License

See [LICENSE](LICENSE).
