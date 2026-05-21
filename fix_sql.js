const fs = require('fs');

let sql = fs.readFileSync('database/loantrack-backup-2026-05-21-12-47-54.sql', 'utf8');

// Skip all the header stuff up to the first DROP TABLE
let idx = sql.indexOf('DROP TABLE IF EXISTS');
if (idx !== -1) {
    sql = sql.substring(idx);
}

// Fix json array default (MariaDB to MySQL 8)
sql = sql.replace(/DEFAULT json_array\(\) CHECK \(json_valid\(`[^`]+`\)\)/g, 'DEFAULT (json_array())');
sql = sql.replace(/CHECK \(json_valid\(`[^`]+`\)\)/g, '');

// Prepend foreign key checks override
sql = 'SET FOREIGN_KEY_CHECKS=0;\n' + sql;

fs.writeFileSync('database/fixed.sql', sql);
