const fs = require('fs');
const mysql = require('mysql2/promise');

async function importDb() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: 'admin',
    database: 'loantrack',
    multipleStatements: true,
  });

  const sql = fs.readFileSync('d:/PROJECTS/WEBSITES/Kandhu/app/database/loantrack-backup-2026-05-18-09-56-44.sql', 'utf8');
  
  console.log('Importing database...');
  await connection.query(sql);
  console.log('Database imported successfully.');
  await connection.end();
}

importDb().catch(console.error);
