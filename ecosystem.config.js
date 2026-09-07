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
      script: 'make',
      args: 'run',
      cwd: './backend',
      interpreter: 'none',
      env: {
        NODE_ENV: 'production',
        PORT: 8000 // You can change this port to whatever your Nginx proxy expects for the backend
      }
    },
    {
      name: 'tijaratk-bot-worker',
      script: 'uv',
      args: 'run arq app.worker.WorkerSettings',
      cwd: './backend',
      interpreter: 'none',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
