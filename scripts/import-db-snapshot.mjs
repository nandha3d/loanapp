// Import an authenticated, encrypted snapshot into a new local database.
// Existing databases are never selected for import or dropped.
import { createReadStream, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { join, resolve } from 'node:path';
import { createGunzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import mysql from 'mysql2/promise';

const [artifactArg, privateKeyArg, mysqlClient = 'mysql'] = process.argv.slice(2);
if (!artifactArg || !privateKeyArg) {
  console.error('Usage: node scripts/import-db-snapshot.mjs <encrypted-artifact> <private-key> [mysql-client-path]');
  process.exit(2);
}

const artifact = resolve(artifactArg);
const privateKey = resolve(privateKeyArg);
if (!existsSync(artifact) || !existsSync(privateKey)) throw new Error('Snapshot or private key missing');

const envText = readFileSync('.env.local', 'utf8');
const envLine = envText.split(/\r?\n/).find((line) => /^\s*DATABASE_URL\s*=/.test(line));
if (!envLine) throw new Error('Local DATABASE_URL missing from .env.local');
let rawUrl = envLine.replace(/^\s*DATABASE_URL\s*=\s*/, '').trim();
if ((rawUrl.startsWith('"') && rawUrl.endsWith('"')) ||
    (rawUrl.startsWith("'") && rawUrl.endsWith("'"))) rawUrl = rawUrl.slice(1, -1);
const url = new URL(rawUrl);
if (url.protocol !== 'mysql:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
  throw new Error('Refusing to import into a non-local MySQL server');
}

const local = {
  host: url.hostname,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
};
const suffix = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
const database = `loantrack_prod_snapshot_${suffix}_${randomBytes(2).toString('hex')}`;
const privateDir = resolve('database');
mkdirSync(privateDir, { recursive: true });
const decrypted = join(privateDir, `.${database}.sql.gz`);

function run(command, args, options = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, { stdio: ['ignore', 'inherit', 'inherit'], ...options });
    child.once('error', rejectRun);
    child.once('close', (code) => code === 0 ? resolveRun() : rejectRun(new Error(`${command} exited ${code}`)));
  });
}

let connection;
try {
  // Authentication completes before any database is created or SQL is applied.
  await run(process.execPath, [
    resolve('scripts/snapshot-crypto.mjs'), 'decrypt', privateKey, artifact, decrypted,
  ]);

  connection = await mysql.createConnection(local);
  await connection.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4`);
  console.log(`Importing into new local database ${database}`);

  const child = spawn(mysqlClient, [
    `--host=${local.host}`,
    `--port=${local.port}`,
    `--user=${local.user}`,
    '--skip-ssl',
    '--default-character-set=utf8mb4',
    database,
  ], {
    env: { ...process.env, MYSQL_PWD: local.password },
    stdio: ['pipe', 'inherit', 'inherit'],
    windowsHide: true,
  });
  const exit = new Promise((resolveExit, rejectExit) => {
    child.once('error', rejectExit);
    child.once('close', (code) => code === 0 ? resolveExit() : rejectExit(new Error(`MySQL import exited ${code}`)));
  });
  try {
    await pipeline(createReadStream(decrypted), createGunzip(), child.stdin);
    await exit;
  } catch (error) {
    child.kill();
    await exit.catch(() => {});
    throw error;
  }

  const [tables] = await connection.query(
    'SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = ?', [database],
  );
  const [counts] = await connection.query(
    `SELECT
      (SELECT COUNT(*) FROM \`${database}\`.tenants) AS tenants,
      (SELECT COUNT(*) FROM \`${database}\`.customers) AS customers,
      (SELECT COUNT(*) FROM \`${database}\`.loans) AS loans`,
  );
  console.log(JSON.stringify({ database, tables: tables[0].total, ...counts[0] }));
} catch (error) {
  console.error(`Import failed. Any partially created local database is ${database}; existing databases remain untouched.`);
  throw error;
} finally {
  if (connection) await connection.end();
  rmSync(decrypted, { force: true });
}
