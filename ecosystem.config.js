// PM2 process manager config (INFRA-01).
// Used on Hostinger VPS to run ZoloFund with auto-restart + clustering.
//
// First-time setup:
//   npm ci --production
//   npm run build
//   pm2 start ecosystem.config.js --env production
//   pm2 save
//   pm2 startup            # follow the printed sudo command
//
// Zero-downtime redeploy (INFRA-04):
//   pm2 reload loantrack --update-env
//
// Logs:        pm2 logs loantrack
// Status:      pm2 status
// Metrics:     pm2 monit
// Rotate:      pm2 install pm2-logrotate (INFRA-07)

module.exports = {
  apps: [
    {
      name: 'loantrack',
      script: '.next/standalone/server.js',
      cwd: __dirname,
      instances: 2,              // 2 workers for ~500 customers / 2GB VPS
      exec_mode: 'cluster',
      max_memory_restart: '512M',
      kill_timeout: 8000,
      listen_timeout: 10000,
      wait_ready: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0',
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
