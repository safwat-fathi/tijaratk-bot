// NestJS port (server/) - NOT part of the production deploy yet; ecosystem.config.js is untouched on purpose.
// Use this during the strangler migration, after `cd server && cp .env.example .env && pnpm install && pnpm build`:
//   pm2 start ecosystem.nest.config.js --only tijaratk-bot-server        # API on :8001, beside FastAPI
//   (cutover step) pm2 stop tijaratk-bot-worker -> let the arq queue drain -> pm2 start ... --only tijaratk-bot-server-worker
//
// Worker overlap warning: BullMQ and arq each schedule the 03:00 auto-learning job and read the same
// `clustered_at IS NULL` rows before either commits, so running BOTH workers at 03:00 can insert duplicate
// LabeledExample rows. Run only one worker at a time (the drain-then-switch step above).
module.exports = {
  apps: [
    {
      name: 'tijaratk-bot-server',
      script: 'pnpm',
      args: 'start:prod',
      cwd: './server',
      interpreter: 'none',
      env: { NODE_ENV: 'production', PORT: 8001 },
    },
    {
      name: 'tijaratk-bot-server-worker',
      script: 'pnpm',
      args: 'start:worker',
      cwd: './server',
      interpreter: 'none',
      env: { NODE_ENV: 'production' },
    },
  ],
};
