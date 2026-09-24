// Sent over SSH stdin. Streams a consistent SQL snapshot to stdout.
// This process never creates files or changes database rows on the VPS.
const fs = require('node:fs');
const { spawn } = require('node:child_process');

const envLine = fs.readFileSync('.env', 'utf8')
  .split(/\r?\n/)
  .find((line) => /^\s*DATABASE_URL\s*=/.test(line));
if (!envLine) throw new Error('DATABASE_URL missing from production .env');

let rawUrl = envLine.replace(/^\s*DATABASE_URL\s*=\s*/, '').trim();
if ((rawUrl.startsWith('"') && rawUrl.endsWith('"')) ||
    (rawUrl.startsWith("'") && rawUrl.endsWith("'"))) {
  rawUrl = rawUrl.slice(1, -1);
}
const url = new URL(rawUrl);
if (url.protocol !== 'mysql:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
  throw new Error('Refusing to dump a non-local MySQL database');
}
const database = decodeURIComponent(url.pathname.slice(1));
if (!/^[A-Za-z0-9_-]+$/.test(database)) throw new Error('Invalid database name');

const child = spawn('mysqldump', [
  `--host=${url.hostname}`,
  `--port=${url.port || '3306'}`,
  `--user=${decodeURIComponent(url.username)}`,
  '--single-transaction',
  '--quick',
  '--no-tablespaces',
  '--hex-blob',
  '--routines',
  '--triggers',
  '--events',
  '--default-character-set=utf8mb4',
  database,
], {
  env: { ...process.env, MYSQL_PWD: decodeURIComponent(url.password) },
  stdio: ['ignore', 'pipe', 'inherit'],
});
child.stdout.pipe(process.stdout);
child.on('error', (error) => {
  console.error(`mysqldump could not start: ${error.message}`);
  process.exitCode = 1;
});
child.on('close', (code) => {
  if (code !== 0) process.exitCode = code || 1;
});
