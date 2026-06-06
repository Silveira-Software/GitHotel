// Rodar como user githotel-app:
//   sudo -u githotel-app -H bash -lc "cd ~/htdocs/app.githotel.site && pm2 start ecosystem.config.cjs"
module.exports = {
  apps: [
    {
      name: 'githotel-app',
      cwd: '/home/githotel-app/htdocs/app.githotel.site',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3007 -H 127.0.0.1',
      env: { NODE_ENV: 'production' },
      instances: 1,
      autorestart: true,
      max_memory_restart: '400M',
    },
  ],
};
