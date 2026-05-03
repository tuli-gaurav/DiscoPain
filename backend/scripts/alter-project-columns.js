import { sequelize } from "../src/config/db.js";

async function run() {
  await sequelize.query("ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_cost_involved TINYINT(1) NOT NULL DEFAULT 0");
  await sequelize.query("ALTER TABLE projects ADD COLUMN IF NOT EXISTS cost_value DECIMAL(12,2) NULL");
  await sequelize.query("ALTER TABLE projects ADD COLUMN IF NOT EXISTS cost_approved TINYINT(1) NULL");
  await sequelize.query("ALTER TABLE projects ADD COLUMN IF NOT EXISTS cost_approval_document TEXT NULL");
  await sequelize.query("ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_type ENUM('Existing Client','New Client','POC') NOT NULL DEFAULT 'Existing Client'");
  await sequelize.query("ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_status ENUM('Yet to Start','In-Progress','On Hold','Cancelled') NOT NULL DEFAULT 'Yet to Start'");
  console.log("PROJECT_COLUMNS_OK");
}

run()
  .catch((err) => {
    console.error("PROJECT_COLUMNS_FAILED", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
