/**
 * Migration: Create unified stage data + document tables
 * - stage_field_definitions: master list of data fields per service (with project card mapping)
 * - project_stage_field_values: per-project values for each field (with source tracking)
 * - project_stage_documents: per-project documents for each requirement
 */
import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const db = await createConnection(process.env.DATABASE_URL);

// ─── 1. stage_field_definitions ──────────────────────────────────────────────
await db.execute(`
  CREATE TABLE IF NOT EXISTS stage_field_definitions (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    serviceCode     VARCHAR(50) NOT NULL,
    fieldKey        VARCHAR(80) NOT NULL,          -- e.g. "projectName", "plotNumber"
    labelAr         VARCHAR(200) NOT NULL,          -- Arabic label shown in UI
    fieldType       ENUM('text','number','date','select') DEFAULT 'text',
    projectCardField VARCHAR(80),                   -- matching column in projects table (nullable if no mapping)
    isMandatory     TINYINT DEFAULT 1,
    sortOrder       INT DEFAULT 0,
    createdAt       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_svc_field (serviceCode, fieldKey),
    INDEX idx_sfd_svc (serviceCode)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`);
console.log("✅ stage_field_definitions created");

// ─── 2. project_stage_field_values ───────────────────────────────────────────
await db.execute(`
  CREATE TABLE IF NOT EXISTS project_stage_field_values (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    projectId       INT NOT NULL,
    serviceCode     VARCHAR(50) NOT NULL,
    fieldKey        VARCHAR(80) NOT NULL,
    value           TEXT,
    valueSource     ENUM('project_card','manual','imported') DEFAULT 'manual',
    -- 'project_card' = synced from fact sheet, 'manual' = user override, 'imported' = from external doc
    syncedAt        TIMESTAMP NULL,
    updatedByUserId INT,
    updatedAt       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_psfv (projectId, serviceCode, fieldKey),
    INDEX idx_psfv_project (projectId),
    INDEX idx_psfv_svc (serviceCode)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`);
console.log("✅ project_stage_field_values created");

// ─── 3. project_stage_documents ──────────────────────────────────────────────
await db.execute(`
  CREATE TABLE IF NOT EXISTS project_stage_documents (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    projectId       INT NOT NULL,
    serviceCode     VARCHAR(50) NOT NULL,
    requirementCode VARCHAR(60) NOT NULL,           -- links to lifecycle_requirements.requirementCode
    fileName        VARCHAR(300),
    fileUrl         TEXT,
    fileKey         TEXT,                            -- S3 key
    mimeType        VARCHAR(100),
    fileSizeBytes   INT,
    docStatus       ENUM('not_uploaded','uploaded_pending_review','approved','rejected') DEFAULT 'not_uploaded',
    rejectionReason TEXT,
    uploadedByUserId INT,
    reviewedByUserId INT,
    reviewedAt      TIMESTAMP NULL,
    uploadedAt      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_psd_project (projectId),
    INDEX idx_psd_svc_req (serviceCode, requirementCode)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`);
console.log("✅ project_stage_documents created");

// ─── 4. Seed stage_field_definitions for STG-02 services ─────────────────────
// SRV-RERA-PROJ-REG: تسجيل مشروع جديد لدى RERA
const reraFields = [
  { fieldKey: 'projectName',      labelAr: 'اسم المشروع',              projectCardField: 'name',               isMandatory: 1, sortOrder: 1 },
  { fieldKey: 'plotNumber',       labelAr: 'رقم القطعة',               projectCardField: 'plotNumber',          isMandatory: 1, sortOrder: 2 },
  { fieldKey: 'areaCode',         labelAr: 'كود المنطقة',              projectCardField: 'areaCode',            isMandatory: 1, sortOrder: 3 },
  { fieldKey: 'titleDeedNumber',  labelAr: 'رقم سند الملكية',          projectCardField: 'titleDeedNumber',     isMandatory: 1, sortOrder: 4 },
  { fieldKey: 'masterDevRef',     labelAr: 'مرجع المطور الرئيسي',      projectCardField: 'masterDevRef',        isMandatory: 0, sortOrder: 5 },
  { fieldKey: 'plotAreaSqft',     labelAr: 'مساحة القطعة (قدم²)',      projectCardField: 'plotAreaSqft',        isMandatory: 1, sortOrder: 6 },
  { fieldKey: 'gfaSqft',         labelAr: 'إجمالي مساحة البناء GFA (قدم²)', projectCardField: 'gfaSqft',      isMandatory: 1, sortOrder: 7 },
  { fieldKey: 'permittedUse',    labelAr: 'الاستخدام المسموح',         projectCardField: 'permittedUse',        isMandatory: 1, sortOrder: 8 },
  { fieldKey: 'ownershipType',   labelAr: 'نوع الملكية',               projectCardField: 'ownershipType',       isMandatory: 1, sortOrder: 9 },
  { fieldKey: 'masterDevName',   labelAr: 'اسم المطور الرئيسي',        projectCardField: 'masterDevName',       isMandatory: 0, sortOrder: 10 },
  { fieldKey: 'constructionStartDate', labelAr: 'تاريخ بدء البناء',   projectCardField: 'constructionStartDate', isMandatory: 1, sortOrder: 11 },
  { fieldKey: 'completionDate',  labelAr: 'تاريخ الانتهاء المتوقع',   projectCardField: 'completionDate',      isMandatory: 1, sortOrder: 12 },
  { fieldKey: 'reraProjectRegFee', labelAr: 'رسوم تسجيل المشروع لدى RERA', projectCardField: 'reraProjectRegFee', isMandatory: 1, sortOrder: 13 },
];

for (const f of reraFields) {
  await db.execute(`
    INSERT IGNORE INTO stage_field_definitions (serviceCode, fieldKey, labelAr, fieldType, projectCardField, isMandatory, sortOrder)
    VALUES (?, ?, ?, 'text', ?, ?, ?)
  `, ['SRV-RERA-PROJ-REG', f.fieldKey, f.labelAr, f.projectCardField || null, f.isMandatory, f.sortOrder]);
}
console.log("✅ Seeded SRV-RERA-PROJ-REG fields (13 fields)");

// SRV-RERA-ESCROW-OPEN: فتح حساب الضمان
const escrowFields = [
  { fieldKey: 'projectName',     labelAr: 'اسم المشروع',              projectCardField: 'name',               isMandatory: 1, sortOrder: 1 },
  { fieldKey: 'plotNumber',      labelAr: 'رقم القطعة',               projectCardField: 'plotNumber',          isMandatory: 1, sortOrder: 2 },
  { fieldKey: 'escrowAccountFee', labelAr: 'رسوم فتح حساب الضمان',   projectCardField: 'escrowAccountFee',    isMandatory: 1, sortOrder: 3 },
  { fieldKey: 'bankFees',        labelAr: 'رسوم البنك',               projectCardField: 'bankFees',            isMandatory: 0, sortOrder: 4 },
  { fieldKey: 'sellerName',      labelAr: 'اسم البائع/المطور',        projectCardField: 'sellerName',          isMandatory: 1, sortOrder: 5 },
  { fieldKey: 'sellerAddress',   labelAr: 'عنوان البائع',             projectCardField: 'sellerAddress',       isMandatory: 0, sortOrder: 6 },
];

for (const f of escrowFields) {
  await db.execute(`
    INSERT IGNORE INTO stage_field_definitions (serviceCode, fieldKey, labelAr, fieldType, projectCardField, isMandatory, sortOrder)
    VALUES (?, ?, ?, 'text', ?, ?, ?)
  `, ['SRV-RERA-ESCROW-OPEN', f.fieldKey, f.labelAr, f.projectCardField || null, f.isMandatory, f.sortOrder]);
}
console.log("✅ Seeded SRV-RERA-ESCROW-OPEN fields (6 fields)");

// SRV-DLD-PROJ-REG: تسجيل المشروع لدى DLD
const dldFields = [
  { fieldKey: 'projectName',     labelAr: 'اسم المشروع',              projectCardField: 'name',               isMandatory: 1, sortOrder: 1 },
  { fieldKey: 'plotNumber',      labelAr: 'رقم القطعة',               projectCardField: 'plotNumber',          isMandatory: 1, sortOrder: 2 },
  { fieldKey: 'titleDeedNumber', labelAr: 'رقم سند الملكية',          projectCardField: 'titleDeedNumber',     isMandatory: 1, sortOrder: 3 },
  { fieldKey: 'ddaNumber',       labelAr: 'رقم DDA',                  projectCardField: 'ddaNumber',           isMandatory: 0, sortOrder: 4 },
  { fieldKey: 'plotAreaSqft',    labelAr: 'مساحة القطعة (قدم²)',      projectCardField: 'plotAreaSqft',        isMandatory: 1, sortOrder: 5 },
  { fieldKey: 'gfaSqft',        labelAr: 'إجمالي مساحة البناء GFA',  projectCardField: 'gfaSqft',             isMandatory: 1, sortOrder: 6 },
  { fieldKey: 'permittedUse',   labelAr: 'الاستخدام المسموح',         projectCardField: 'permittedUse',        isMandatory: 1, sortOrder: 7 },
  { fieldKey: 'ownershipType',  labelAr: 'نوع الملكية',               projectCardField: 'ownershipType',       isMandatory: 1, sortOrder: 8 },
  { fieldKey: 'effectiveDate',  labelAr: 'تاريخ السريان',             projectCardField: 'effectiveDate',       isMandatory: 0, sortOrder: 9 },
];

for (const f of dldFields) {
  await db.execute(`
    INSERT IGNORE INTO stage_field_definitions (serviceCode, fieldKey, labelAr, fieldType, projectCardField, isMandatory, sortOrder)
    VALUES (?, ?, ?, 'text', ?, ?, ?)
  `, ['SRV-DLD-PROJ-REG', f.fieldKey, f.labelAr, f.projectCardField || null, f.isMandatory, f.sortOrder]);
}
console.log("✅ Seeded SRV-DLD-PROJ-REG fields (9 fields)");

// STG-01: تأسيس المطور - SRV-RERA-DEV-REG
const devRegFields = [
  { fieldKey: 'companyName',     labelAr: 'اسم الشركة',               projectCardField: null,                 isMandatory: 1, sortOrder: 1 },
  { fieldKey: 'licenseNumber',   labelAr: 'رقم الرخصة التجارية',      projectCardField: null,                 isMandatory: 1, sortOrder: 2 },
  { fieldKey: 'tradeRegNumber',  labelAr: 'رقم السجل التجاري',        projectCardField: null,                 isMandatory: 1, sortOrder: 3 },
  { fieldKey: 'registrationAuthority', labelAr: 'جهة التسجيل',       projectCardField: 'registrationAuthority', isMandatory: 1, sortOrder: 4 },
];

for (const f of devRegFields) {
  await db.execute(`
    INSERT IGNORE INTO stage_field_definitions (serviceCode, fieldKey, labelAr, fieldType, projectCardField, isMandatory, sortOrder)
    VALUES (?, ?, ?, 'text', ?, ?, ?)
  `, ['SRV-RERA-DEV-REG', f.fieldKey, f.labelAr, f.projectCardField || null, f.isMandatory, f.sortOrder]);
}
console.log("✅ Seeded SRV-RERA-DEV-REG fields (4 fields)");

await db.end();
console.log("\n🎉 All unified stage tables created and seeded successfully!");
