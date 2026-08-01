# LoanTrack — VPS Deployment

Files in this folder support Phase 1 infrastructure (INFRA-01, INFRA-02, INFRA-05).

## Production server

| | |
|---|---|
| Provider / location | Hostinger VPS — India, Mumbai 2 |
| Hostname | `srv1731573.hstgr.cloud` |
| IPv4 | `187.127.177.121` |
| OS | Ubuntu 24.04 (OpenLiteSpeed + Node.js image) |
| SSH user | `root` (key auth) |
| Backups | Hostinger snapshot, weekly — see `backup-db.sh` for the DB-level dump |

Both hosts are served by this one box; the app forks on the `Host` header — see
[../docs/multi-domain-architecture.md](../docs/multi-domain-architecture.md).

> Weekly snapshots mean up to 7 days of data loss on a restore. `backup-db.sh`
> (daily mysqldump) is the actual recovery path for the database — verify it is
> installed in cron before relying on the provider schedule.

## Files

| File | Purpose | Audit ref |
|------|---------|-----------|
| `../ecosystem.config.js` | PM2 cluster config | INFRA-01 |
| `nginx.conf`             | Nginx reverse proxy template | INFRA-02 |
| `backup-db.sh`           | Daily MySQL backup script | INFRA-05 |

## First-time VPS setup

```bash
# 1. Install Node 20 LTS + PM2
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs nginx mysql-server
sudo npm install -g pm2

# 2. Create app user + directories
sudo useradd -m -s /bin/bash loantrack
sudo mkdir -p /home/loantrack/app /var/backups/loantrack /etc/loantrack
sudo chown -R loantrack:loantrack /home/loantrack /var/backups/loantrack

# 3. Deploy code (rsync / git clone / unzip — your choice)
sudo -u loantrack rsync -av --delete ./ /home/loantrack/app/

# 4. Env file
sudo tee /home/loantrack/app/.env >/dev/null <<'EOF'
DATABASE_URL=mysql://loantrack:STRONG_PASS@localhost:3306/loantrack?connection_limit=20&pool_timeout=30
# Session secret — signs web, middleware, borrower, AND mobile tokens.
# AUTH_SECRET alone is sufficient for everything (mobile falls back to it).
AUTH_SECRET=<64-hex random>
# Optional: dedicated mobile API token secret (recommended, not required).
MOBILE_JWT_SECRET=<64-hex random>
PII_ENCRYPTION_KEY=<64-hex random>
CRON_SECRET=<32-hex random>
NEXT_PUBLIC_APP_URL=https://YOUR_DOMAIN
# Set this only when serving the app from a subpath, e.g. https://YOUR_DOMAIN/LoanTrack.
# Leave empty when serving from the domain root.
NEXT_PUBLIC_BASE_PATH=
NEXT_PUBLIC_ROOT_DOMAIN=YOUR_DOMAIN
TRUST_PROXY=true
EOF

# 5. Build + start
cd /home/loantrack/app
sudo -u loantrack npm ci --production=false
sudo -u loantrack npx prisma generate
sudo -u loantrack npx prisma migrate deploy
sudo -u loantrack npm run build
sudo -u loantrack pm2 start ecosystem.config.js --env production
sudo -u loantrack pm2 save
pm2 startup    # run the printed sudo command
```

## Nginx

```bash
# Copy proxy header includes
sudo tee /etc/nginx/loantrack-proxy.inc >/dev/null <<'EOF'
proxy_http_version 1.1;
proxy_set_header Upgrade           $http_upgrade;
proxy_set_header Connection        "upgrade";
proxy_set_header Host              $host;
proxy_set_header X-Real-IP         $remote_addr;
proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_read_timeout 60s;
proxy_connect_timeout 10s;
proxy_buffering on;
EOF

# Append rate-limit zone (once) to nginx.conf http { } block:
sudo sed -i '/http {/a \    limit_req_zone $binary_remote_addr zone=auth_zone:10m rate=10r/s;' /etc/nginx/nginx.conf

# Install site
sudo cp deploy/nginx.conf /etc/nginx/sites-available/loantrack.conf
sudo ln -sf /etc/nginx/sites-available/loantrack.conf /etc/nginx/sites-enabled/loantrack.conf
sudo nginx -t && sudo systemctl reload nginx

# SSL (replace YOUR_DOMAIN)
sudo certbot --nginx -d YOUR_DOMAIN -d '*.YOUR_DOMAIN'
```

## Backups

```bash
# Create restricted DB user (read-only)
mysql -u root -p <<'SQL'
CREATE USER 'loantrack_backup'@'localhost' IDENTIFIED BY 'STRONG_PASS_2';
GRANT SELECT, LOCK TABLES, SHOW VIEW, EVENT, TRIGGER ON loantrack.* TO 'loantrack_backup'@'localhost';
FLUSH PRIVILEGES;
SQL

# Backup config
sudo tee /etc/loantrack/backup.env >/dev/null <<'EOF'
DB_HOST=localhost
DB_USER=loantrack_backup
DB_PASS=STRONG_PASS_2
DB_NAME=loantrack
BACKUP_DIR=/var/backups/loantrack
RETENTION_DAYS=30
# RCLONE_REMOTE=b2:loantrack-backups   # uncomment for offsite
EOF
sudo chmod 600 /etc/loantrack/backup.env

# Install script
sudo cp deploy/backup-db.sh /usr/local/bin/loantrack-backup
sudo chmod +x /usr/local/bin/loantrack-backup

# Cron — 02:00 daily
echo '0 2 * * * /usr/local/bin/loantrack-backup >> /var/log/loantrack-backup.log 2>&1' \
  | sudo tee /etc/cron.d/loantrack-backup

# Test once now
sudo /usr/local/bin/loantrack-backup
```

## Firewall (INFRA-08)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp     # SSH (consider restricting to your IP)
sudo ufw allow 80/tcp     # HTTP (Let's Encrypt)
sudo ufw allow 443/tcp    # HTTPS
# 3306 stays closed — MySQL is localhost-only
sudo ufw enable
```

## Health check (INFRA-06)

Point UptimeRobot / Betterstack at `https://YOUR_DOMAIN/api/health` every 60s.
Alert channel: email + Telegram.

## Redeploy (zero-downtime, INFRA-04)

```bash
cd /home/loantrack/app
sudo -u loantrack git pull          # or rsync new build
sudo -u loantrack npm ci --production=false
sudo -u loantrack npx prisma migrate deploy
sudo -u loantrack npm run build
sudo -u loantrack pm2 reload loantrack --update-env
```
