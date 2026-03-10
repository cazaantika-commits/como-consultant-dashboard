/**
 * Compliance Report Route
 * GET /api/lifecycle/compliance-report?projectId=X
 * Returns an HTML page optimized for print/PDF with Arabic RTL support
 */
import { Router } from "express";
import { getDb } from "./db";
import {
  lifecycleStages,
  lifecycleServices,
  lifecycleRequirements,
  projectServiceInstances,
  projectRequirementStatus,
  projectStageStatus,
  projectStageDocuments,
  projectStageFieldValues,
  stageFieldDefinitions,
  projects,
} from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

const STATUS_AR: Record<string, string> = {
  not_started: "لم يبدأ",
  in_progress: "جاري",
  completed: "مكتمل",
  locked: "مقفل",
  submitted: "مقدّم",
  pending: "معلّق",
  approved: "معتمد",
  rejected: "مرفوض",
  uploaded_pending_review: "مرفوع - قيد المراجعة",
  not_uploaded: "غير مرفوع",
};

const STATUS_COLOR: Record<string, string> = {
  not_started: "#94a3b8",
  in_progress: "#3b82f6",
  completed: "#22c55e",
  locked: "#6366f1",
  submitted: "#f59e0b",
  pending: "#f59e0b",
  approved: "#22c55e",
  rejected: "#ef4444",
  uploaded_pending_review: "#3b82f6",
  not_uploaded: "#ef4444",
};

router.get("/compliance-report", async (req, res) => {
  try {
    const projectId = parseInt(req.query.projectId as string);
    if (!projectId || isNaN(projectId)) {
      res.status(400).send("Missing projectId");
      return;
    }

    const db = await getDb();
    if (!db) {
      res.status(500).send("DB unavailable");
      return;
    }

    // Fetch project info
    const projectRows = await db.select().from(projects).where(eq(projects.id, projectId));
    const project = projectRows[0];
    if (!project) {
      res.status(404).send("Project not found");
      return;
    }

    // Fetch all stages
    const stages = await db.select().from(lifecycleStages).orderBy(lifecycleStages.sortOrder);

    // Fetch stage statuses for this project
    const stageStatuses = await db
      .select()
      .from(projectStageStatus)
      .where(eq(projectStageStatus.projectId, projectId));

    // Fetch all services
    const allServices = await db.select().from(lifecycleServices).orderBy(lifecycleServices.sortOrder);

    // Fetch service instances for this project
    const serviceInstances = await db
      .select()
      .from(projectServiceInstances)
      .where(eq(projectServiceInstances.projectId, projectId));

    // Fetch all requirements
    const allRequirements = await db.select().from(lifecycleRequirements).orderBy(lifecycleRequirements.sortOrder);

    // Fetch requirement statuses for this project
    const reqStatuses = await db
      .select()
      .from(projectRequirementStatus)
      .where(eq(projectRequirementStatus.projectId, projectId));

    // Fetch uploaded documents
    const uploadedDocs = await db
      .select()
      .from(projectStageDocuments)
      .where(eq(projectStageDocuments.projectId, projectId));

    // Fetch field values
    const fieldValues = await db
      .select()
      .from(projectStageFieldValues)
      .where(eq(projectStageFieldValues.projectId, projectId));

    // Fetch field definitions
    const fieldDefs = await db.select().from(stageFieldDefinitions).orderBy(stageFieldDefinitions.sortOrder);

    // Build summary stats
    const totalServices = allServices.length;
    const completedServices = serviceInstances.filter((i) => i.operationalStatus === "completed").length;
    const totalRequirements = allRequirements.length;
    const completedRequirements = reqStatuses.filter((r) => r.status === "completed").length;
    const totalDocs = allRequirements.filter((r) => r.reqType === "document").length;
    const uploadedDocsCount = uploadedDocs.length;
    const totalFields = fieldDefs.length;
    const filledFields = fieldValues.filter((v) => v.value && v.value.trim() !== "").length;

    const reportDate = new Date().toLocaleDateString("ar-AE", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Build HTML
    let stagesHtml = "";
    for (const stage of stages) {
      const stageStatus = stageStatuses.find((s) => s.stageCode === stage.stageCode);
      const status = stageStatus?.status ?? stage.defaultStatus ?? "not_started";
      const statusColor = STATUS_COLOR[status] ?? "#94a3b8";
      const statusAr = STATUS_AR[status] ?? status;

      const stageServices = allServices.filter((s) => s.stageCode === stage.stageCode);
      let servicesHtml = "";

      for (const svc of stageServices) {
        const instance = serviceInstances.find((i) => i.serviceCode === svc.serviceCode);
        const svcStatus = instance?.operationalStatus ?? "not_started";
        const svcStatusColor = STATUS_COLOR[svcStatus] ?? "#94a3b8";
        const svcStatusAr = STATUS_AR[svcStatus] ?? svcStatus;

        const svcReqs = allRequirements.filter((r) => r.serviceCode === svc.serviceCode);
        const svcReqStatuses = reqStatuses.filter((r) => r.serviceCode === svc.serviceCode);
        const completedSvcReqs = svcReqStatuses.filter((r) => r.status === "completed").length;
        const mandatoryTotal = svcReqs.filter((r) => r.isMandatory === 1).length;
        const mandatoryDone = svcReqs
          .filter((r) => r.isMandatory === 1)
          .filter((r) => svcReqStatuses.find((s) => s.requirementCode === r.requirementCode && s.status === "completed"))
          .length;

        const docReqs = svcReqs.filter((r) => r.reqType === "document");
        const dataReqs = svcReqs.filter((r) => r.reqType === "data");
        const svcDocs = uploadedDocs.filter((d) => d.serviceCode === svc.serviceCode);
        const svcFields = fieldDefs.filter((f) => f.serviceCode === svc.serviceCode);
        const svcFieldValues = fieldValues.filter((v) => v.serviceCode === svc.serviceCode);
        const filledSvcFields = svcFieldValues.filter((v) => v.value && v.value.trim() !== "").length;

        // Requirements rows
        let reqRowsHtml = "";
        for (const req of svcReqs) {
          const reqStatus = svcReqStatuses.find((s) => s.requirementCode === req.requirementCode);
          const rStatus = reqStatus?.status ?? "not_started";
          const rColor = STATUS_COLOR[rStatus] ?? "#94a3b8";
          const rAr = STATUS_AR[rStatus] ?? rStatus;
          const isMandatory = req.isMandatory === 1;
          const doc = svcDocs.find((d) => d.requirementCode === req.requirementCode);

          reqRowsHtml += `
            <tr>
              <td style="padding:6px 8px; border-bottom:1px solid #f1f5f9; font-size:12px;">${req.nameAr ?? req.requirementCode}</td>
              <td style="padding:6px 8px; border-bottom:1px solid #f1f5f9; font-size:11px; color:#64748b;">${req.reqType === "document" ? "مستند" : req.reqType === "data" ? "بيانات" : req.reqType ?? "-"}</td>
              <td style="padding:6px 8px; border-bottom:1px solid #f1f5f9; font-size:11px;">${isMandatory ? '<span style="color:#ef4444;font-weight:600;">إلزامي</span>' : '<span style="color:#94a3b8;">اختياري</span>'}</td>
              <td style="padding:6px 8px; border-bottom:1px solid #f1f5f9; font-size:11px;">
                <span style="background:${rColor}20; color:${rColor}; padding:2px 8px; border-radius:12px; font-size:11px;">${rAr}</span>
              </td>
              <td style="padding:6px 8px; border-bottom:1px solid #f1f5f9; font-size:11px; color:#64748b;">${doc ? doc.fileName : "-"}</td>
            </tr>
          `;
        }

        // Data fields rows
        let fieldRowsHtml = "";
        for (const field of svcFields) {
          const fv = svcFieldValues.find((v) => v.fieldKey === field.fieldKey);
          const hasValue = fv?.value && fv.value.trim() !== "";
          fieldRowsHtml += `
            <tr>
              <td style="padding:6px 8px; border-bottom:1px solid #f1f5f9; font-size:12px;">${field.labelAr}</td>
              <td style="padding:6px 8px; border-bottom:1px solid #f1f5f9; font-size:11px; color:#64748b;">${field.labelEn ?? "-"}</td>
              <td style="padding:6px 8px; border-bottom:1px solid #f1f5f9; font-size:11px;">${field.isMandatory ? '<span style="color:#ef4444;">إلزامي</span>' : '<span style="color:#94a3b8;">اختياري</span>'}</td>
              <td style="padding:6px 8px; border-bottom:1px solid #f1f5f9; font-size:12px; ${hasValue ? "color:#1e293b;font-weight:500;" : "color:#ef4444;font-style:italic;"}">${fv?.value ?? "— فارغ —"}</td>
              <td style="padding:6px 8px; border-bottom:1px solid #f1f5f9; font-size:11px; color:#64748b;">${fv?.valueSource === "project_card" ? "بطاقة المشروع" : fv?.valueSource === "manual" ? "يدوي" : "-"}</td>
            </tr>
          `;
        }

        servicesHtml += `
          <div style="margin-bottom:16px; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; page-break-inside:avoid;">
            <div style="background:#f8fafc; padding:10px 16px; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <span style="font-size:13px; font-weight:600; color:#1e293b;">${svc.nameAr}</span>
                <span style="font-size:11px; color:#94a3b8; margin-right:8px;">${svc.serviceCode}</span>
              </div>
              <div style="display:flex; gap:8px; align-items:center;">
                <span style="background:${svcStatusColor}20; color:${svcStatusColor}; padding:3px 10px; border-radius:12px; font-size:11px; font-weight:600;">${svcStatusAr}</span>
                <span style="font-size:11px; color:#64748b;">${completedSvcReqs}/${svcReqs.length} متطلب مكتمل</span>
                ${mandatoryTotal > 0 ? `<span style="font-size:11px; color:${mandatoryDone === mandatoryTotal ? "#22c55e" : "#ef4444"};">${mandatoryDone}/${mandatoryTotal} إلزامي</span>` : ""}
              </div>
            </div>
            ${svcReqs.length > 0 ? `
              <div style="padding:12px 16px;">
                <p style="font-size:11px; font-weight:600; color:#64748b; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.5px;">المتطلبات (${docReqs.length} مستند، ${dataReqs.length} بيانات)</p>
                <table style="width:100%; border-collapse:collapse; font-family:inherit;">
                  <thead>
                    <tr style="background:#f1f5f9;">
                      <th style="padding:6px 8px; text-align:right; font-size:11px; color:#64748b; font-weight:600;">الاسم</th>
                      <th style="padding:6px 8px; text-align:right; font-size:11px; color:#64748b; font-weight:600;">النوع</th>
                      <th style="padding:6px 8px; text-align:right; font-size:11px; color:#64748b; font-weight:600;">الإلزامية</th>
                      <th style="padding:6px 8px; text-align:right; font-size:11px; color:#64748b; font-weight:600;">الحالة</th>
                      <th style="padding:6px 8px; text-align:right; font-size:11px; color:#64748b; font-weight:600;">الملف</th>
                    </tr>
                  </thead>
                  <tbody>${reqRowsHtml}</tbody>
                </table>
              </div>
            ` : ""}
            ${svcFields.length > 0 ? `
              <div style="padding:12px 16px; border-top:1px solid #f1f5f9;">
                <p style="font-size:11px; font-weight:600; color:#64748b; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.5px;">حقول البيانات (${filledSvcFields}/${svcFields.length} مكتمل)</p>
                <table style="width:100%; border-collapse:collapse; font-family:inherit;">
                  <thead>
                    <tr style="background:#f1f5f9;">
                      <th style="padding:6px 8px; text-align:right; font-size:11px; color:#64748b; font-weight:600;">الحقل (عربي)</th>
                      <th style="padding:6px 8px; text-align:right; font-size:11px; color:#64748b; font-weight:600;">الحقل (إنجليزي)</th>
                      <th style="padding:6px 8px; text-align:right; font-size:11px; color:#64748b; font-weight:600;">الإلزامية</th>
                      <th style="padding:6px 8px; text-align:right; font-size:11px; color:#64748b; font-weight:600;">القيمة</th>
                      <th style="padding:6px 8px; text-align:right; font-size:11px; color:#64748b; font-weight:600;">المصدر</th>
                    </tr>
                  </thead>
                  <tbody>${fieldRowsHtml}</tbody>
                </table>
              </div>
            ` : ""}
          </div>
        `;
      }

      stagesHtml += `
        <div style="margin-bottom:24px; page-break-inside:avoid;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; padding-bottom:8px; border-bottom:2px solid ${statusColor}40;">
            <div>
              <span style="font-size:16px; font-weight:700; color:#0f172a;">${stage.nameAr}</span>
              <span style="font-size:12px; color:#94a3b8; margin-right:8px;">${stage.stageCode}</span>
            </div>
            <span style="background:${statusColor}20; color:${statusColor}; padding:4px 14px; border-radius:16px; font-size:12px; font-weight:600;">${statusAr}</span>
          </div>
          ${servicesHtml}
        </div>
      `;
    }

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>تقرير الامتثال — ${project.name}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Cairo', 'Segoe UI', Arial, sans-serif;
      font-size: 13px;
      color: #1e293b;
      background: #ffffff;
      direction: rtl;
      padding: 24px;
    }
    @media print {
      body { padding: 12px; }
      .no-print { display: none !important; }
      @page { margin: 15mm; size: A4; }
    }
    .header { 
      display: flex; 
      justify-content: space-between; 
      align-items: flex-start;
      padding: 20px 24px; 
      background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%);
      color: white;
      border-radius: 12px;
      margin-bottom: 20px;
    }
    .header-logo { font-size: 20px; font-weight: 800; letter-spacing: -0.5px; }
    .header-subtitle { font-size: 12px; opacity: 0.7; margin-top: 4px; }
    .header-meta { text-align: left; font-size: 12px; opacity: 0.8; }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }
    .summary-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 16px;
      text-align: center;
    }
    .summary-card .value { font-size: 24px; font-weight: 800; color: #0f172a; }
    .summary-card .label { font-size: 11px; color: #64748b; margin-top: 4px; }
    .print-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #0f172a;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      font-family: inherit;
      font-size: 13px;
      cursor: pointer;
      margin-bottom: 20px;
    }
    .print-btn:hover { background: #1e293b; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="header-logo">كومو للتطوير العقاري</div>
      <div class="header-subtitle">تقرير الامتثال — مراحل DLD / RERA</div>
      <div style="margin-top:12px; font-size:18px; font-weight:700;">${project.name}</div>
      ${project.plotNumber ? `<div style="font-size:12px; opacity:0.7; margin-top:4px;">رقم القطعة: ${project.plotNumber}</div>` : ""}
    </div>
    <div class="header-meta">
      <div>تاريخ التقرير: ${reportDate}</div>
      <div style="margin-top:4px;">معرّف المشروع: #${project.id}</div>
    </div>
  </div>

  <button class="print-btn no-print" onclick="window.print()">
    🖨️ طباعة / حفظ PDF
  </button>

  <div class="summary-grid">
    <div class="summary-card">
      <div class="value" style="color:#3b82f6;">${completedServices}/${totalServices}</div>
      <div class="label">خدمة مكتملة</div>
    </div>
    <div class="summary-card">
      <div class="value" style="color:#22c55e;">${completedRequirements}/${totalRequirements}</div>
      <div class="label">متطلب مكتمل</div>
    </div>
    <div class="summary-card">
      <div class="value" style="color:#f59e0b;">${uploadedDocsCount}/${totalDocs}</div>
      <div class="label">مستند مرفوع</div>
    </div>
    <div class="summary-card">
      <div class="value" style="color:#8b5cf6;">${filledFields}/${totalFields}</div>
      <div class="label">حقل بيانات مكتمل</div>
    </div>
  </div>

  ${stagesHtml}

  <div style="margin-top:32px; padding-top:16px; border-top:1px solid #e2e8f0; text-align:center; font-size:11px; color:#94a3b8;">
    تم إنشاء هذا التقرير تلقائياً بواسطة منصة كومو للتطوير العقاري — ${reportDate}
  </div>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    console.error("[ComplianceReport] Error:", err);
    res.status(500).send("Internal server error");
  }
});

export default router;
