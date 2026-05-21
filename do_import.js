const fs = require('fs');
const mysql = require('mysql2/promise');

async function main() {
  let conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: 'admin',
    multipleStatements: true
  });
  await conn.query('CREATE DATABASE IF NOT EXISTS loantrack;');
  await conn.end();

  conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: 'admin',
    database: 'loantrack',
    multipleStatements: true
  });
  let sql = fs.readFileSync('database/fixed.sql', 'utf8');
  console.log('Importing...');
  try {
    await conn.query(sql);
    console.log('Done!');
  } catch (e) {
    console.error("SQL Error:", e.message);
  }
  await conn.end();
  
  let env = fs.readFileSync('.env', 'utf8');
  env = env.replace(/mysql:\/\/.*?\/[a-zA-Z0-9_]+/, 'mysql://root:admin@localhost:3306/loantrack');
  fs.writeFileSync('.env', env);
}
main().catch(e => console.error(e.message));
