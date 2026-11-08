// Production pm2 config. Build first:
//   (cd backend && pnpm install --frozen-lockfile && pnpm build) && (cd frontend && pnpm install --frozen-lockfile && pnpm build)
// Run exactly one worker: BullMQ schedules the 03:00 auto-learning job, so two workers would duplicate its rows.
module.exports = {
  apps: [
    {
      name: 'tijaratk-bot-frontend',
      script: 'pnpm',
      args: 'start',
      cwd: './frontend',
      env: {
        NODE_ENV: 'production',
        PORT: 3000 // You can change this port to whatever your Nginx proxy expects for the frontend
      }
    },
    {
      name: 'tijaratk-bot-backend',
      script: 'pnpm',
      args: 'start:prod',
      cwd: './backend',
      interpreter: 'none',
      env: {
        NODE_ENV: 'production',
        PORT: 8001 // Must match the port your Nginx proxy expects for the API
      }
    },
    {
      name: 'tijaratk-bot-backend-worker',
      script: 'pnpm',
      args: 'start:worker',
      cwd: './backend',
      interpreter: 'none',
      env: { NODE_ENV: 'production' }
    }
  ]
};
