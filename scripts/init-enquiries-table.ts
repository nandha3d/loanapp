import prisma from '../lib/db';

async function check() {
  try {
    await prisma.$queryRawUnsafe(`
      CREATE TABLE IF NOT EXISTS enquiries (
        id VARCHAR(191) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        email VARCHAR(255) NULL,
        company VARCHAR(255) NULL,
        vertical VARCHAR(100) NULL DEFAULT 'microlending',
        loan_capacity VARCHAR(100) NULL,
        agent_count VARCHAR(100) NULL,
        city VARCHAR(100) NULL,
        source VARCHAR(50) NOT NULL DEFAULT 'chat_assistant',
        message TEXT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'new',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status_created (status, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("Table enquiries created / verified successfully!");
    
    const count: any = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as c FROM enquiries;`);
    console.log("Current enquiries count in DB:", count[0]?.c);
  } catch (err: any) {
    console.error("Error creating table:", err.message);
  } finally {
    process.exit(0);
  }
}

check();
