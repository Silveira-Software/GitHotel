// Rodar como user githotel-api:
//   sudo -u githotel-api -H bash -lc "cd ~/htdocs/api.githotel.site && pm2 start ecosystem.config.cjs"
module.exports = {
  apps: [
    {
      name: 'githotel-api',
      cwd: '/home/githotel-api/htdocs/api.githotel.site',
      script: 'src/server.js',
      env: { NODE_ENV: 'production' },
      instances: 1,
      autorestart: true,
      max_memory_restart: '300M',
    },
  ],
};
