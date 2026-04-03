import { createConnection } from "mysql2/promise";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) { console.error("DATABASE_URL not found"); process.exit(1); }

const conn = await createConnection(dbUrl);

await conn.execute(`
  CREATE TABLE IF NOT EXISTS general_requests (
    id INT AUTO_INCREMENT NOT NULL,
    request_number VARCHAR(50) NOT NULL,
    request_type ENUM(
      'proposal_approval',
      'contract_approval',
      'meeting_request',
      'zoom_meeting',
      'inquiry',
      'decision_request',
      'other'
    ) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    project_name VARCHAR(255),
    related_party VARCHAR(255),
    attachment_url TEXT,
    attachment_name VARCHAR(255),
    proposed_date VARCHAR(100),
    status ENUM('new','pending_wael','pending_sheikh','approved','rejected','needs_revision') NOT NULL DEFAULT 'new',
    wael_reviewed_at TIMESTAMP NULL,
    wael_decision ENUM('approved','rejected','needs_revision') NULL,
    wael_notes TEXT,
    sheikh_reviewed_at TIMESTAMP NULL,
    sheikh_decision ENUM('approved','rejected','needs_revision') NULL,
    sheikh_notes TEXT,
    finance_email_sent_at TIMESTAMP NULL,
    submitted_by INT NULL,
    is_archived TINYINT NOT NULL DEFAULT 0,
    archived_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT general_requests_id PRIMARY KEY(id)
  )
`);

console.log("✅ general_requests table created successfully");

const [[{ count }]] = await conn.execute("SELECT COUNT(*) as count FROM general_requests");
console.log(`📊 Rows in general_requests: ${count}`);

await conn.end();
