/**
 * Compliance Report Route
 * GET /api/lifecycle/compliance-report?projectId=X[&stageCode=STG-02]
 * Returns an HTML page optimized for print/PDF with Arabic RTL support
 * - If stageCode is provided, only that stage is included
 * - Otherwise all stages are included
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
    const filterStageCode = req.query.stageCode as string | undefined;

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

    // Fetch all stages (or filtered)
    let allStages = await db.select().from(lifecycleStages).orderBy(lifecycleStages.sortOrder);
    if (filterStageCode) {
      allStages = allStages.filter((s) => s.stageCode === filterStageCode);
    }

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

    // Build global summary stats (always from all services, not filtered)
    const totalServicesAll = allServices.length;
    const completedServicesAll = serviceInstances.filter((i) => i.operationalStatus === "completed").length;
    const totalReqsAll = allRequirements.length;
    const completedReqsAll = reqStatuses.filter((r) => r.status === "completed").length;
    const totalDocsAll = allRequirements.filter((r) => r.reqType === "document").length;
    const uploadedDocsCountAll = uploadedDocs.length;
    const totalFieldsAll = fieldDefs.length;
    const filledFieldsAll = fieldValues.filter((v) => v.value && v.value.trim() !== "").length;

    const overallProgress = totalServicesAll > 0
      ? Math.round((completedServicesAll / totalServicesAll) * 100)
      : 0;

    const reportDate = new Date().toLocaleDateString("ar-AE", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Build stages HTML
    let stagesHtml = "";
    for (const stage of allStages) {
      const stageStatus = stageStatuses.find((s) => s.stageCode === stage.stageCode);
      const status = stageStatus?.status ?? stage.defaultStatus ?? "not_started";
      const statusColor = STATUS_COLOR[status] ?? "#94a3b8";
      const statusAr = STATUS_AR[status] ?? status;

      const stageServices = allServices.filter((s) => s.stageCode === stage.stageCode);
      const stageCompletedSvcs = stageServices.filter((s) => {
        const inst = serviceInstances.find((i) => i.serviceCode === s.serviceCode);
        return inst?.operationalStatus === "completed";
      }).length;
      const stageProgress = stageServices.length > 0
        ? Math.round((stageCompletedSvcs / stageServices.length) * 100)
        : 0;

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
              <td style="padding:6px 8px; border-bottom:1px solid #f1f5f9; font-size:11px; color:#64748b;">${req.reqType === "document" ? "📄 مستند" : req.reqType === "data" ? "📊 بيانات" : req.reqType ?? "-"}</td>
              <td style="padding:6px 8px; border-bottom:1px solid #f1f5f9; font-size:11px;">${isMandatory ? '<span style="color:#ef4444;font-weight:600;">إلزامي</span>' : '<span style="color:#94a3b8;">اختياري</span>'}</td>
              <td style="padding:6px 8px; border-bottom:1px solid #f1f5f9; font-size:11px;">
                <span style="background:${rColor}20; color:${rColor}; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:500;">${rAr}</span>
              </td>
              <td style="padding:6px 8px; border-bottom:1px solid #f1f5f9; font-size:11px; color:#64748b;">${doc ? `<a href="${doc.fileUrl}" style="color:#3b82f6; text-decoration:none;">${doc.fileName}</a>` : "—"}</td>
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
          <div style="margin-bottom:14px; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; page-break-inside:avoid;">
            <div style="background:#f8fafc; padding:10px 16px; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <span style="font-size:13px; font-weight:600; color:#1e293b;">${svc.nameAr}</span>
                <span style="font-size:10px; color:#94a3b8; margin-right:8px; font-family:monospace;">${svc.serviceCode}</span>
              </div>
              <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                <span style="background:${svcStatusColor}20; color:${svcStatusColor}; padding:3px 10px; border-radius:12px; font-size:11px; font-weight:600;">${svcStatusAr}</span>
                <span style="font-size:11px; color:#64748b;">${completedSvcReqs}/${svcReqs.length} متطلب</span>
                ${mandatoryTotal > 0 ? `<span style="font-size:11px; color:${mandatoryDone === mandatoryTotal ? "#22c55e" : "#ef4444"}; font-weight:500;">${mandatoryDone}/${mandatoryTotal} إلزامي</span>` : ""}
                ${docReqs.length > 0 ? `<span style="font-size:10px; color:#64748b;">📄 ${svcDocs.length}/${docReqs.length}</span>` : ""}
                ${svcFields.length > 0 ? `<span style="font-size:10px; color:#64748b;">📊 ${filledSvcFields}/${svcFields.length}</span>` : ""}
              </div>
            </div>
            ${svcReqs.length > 0 ? `
              <div style="padding:10px 16px;">
                <table style="width:100%; border-collapse:collapse; font-family:inherit;">
                  <thead>
                    <tr style="background:#f1f5f9;">
                      <th style="padding:6px 8px; text-align:right; font-size:11px; color:#64748b; font-weight:600; width:35%;">الاسم</th>
                      <th style="padding:6px 8px; text-align:right; font-size:11px; color:#64748b; font-weight:600; width:12%;">النوع</th>
                      <th style="padding:6px 8px; text-align:right; font-size:11px; color:#64748b; font-weight:600; width:12%;">الإلزامية</th>
                      <th style="padding:6px 8px; text-align:right; font-size:11px; color:#64748b; font-weight:600; width:15%;">الحالة</th>
                      <th style="padding:6px 8px; text-align:right; font-size:11px; color:#64748b; font-weight:600; width:26%;">الملف / القيمة</th>
                    </tr>
                  </thead>
                  <tbody>${reqRowsHtml}</tbody>
                </table>
              </div>
            ` : ""}
            ${svcFields.length > 0 ? `
              <div style="padding:10px 16px; border-top:1px solid #f1f5f9;">
                <p style="font-size:10px; font-weight:600; color:#64748b; margin-bottom:6px;">📊 حقول البيانات (${filledSvcFields}/${svcFields.length} مكتمل)</p>
                <table style="width:100%; border-collapse:collapse; font-family:inherit;">
                  <thead>
                    <tr style="background:#f1f5f9;">
                      <th style="padding:6px 8px; text-align:right; font-size:11px; color:#64748b; font-weight:600; width:25%;">الحقل (عربي)</th>
                      <th style="padding:6px 8px; text-align:right; font-size:11px; color:#64748b; font-weight:600; width:20%;">الحقل (إنجليزي)</th>
                      <th style="padding:6px 8px; text-align:right; font-size:11px; color:#64748b; font-weight:600; width:12%;">الإلزامية</th>
                      <th style="padding:6px 8px; text-align:right; font-size:11px; color:#64748b; font-weight:600; width:30%;">القيمة</th>
                      <th style="padding:6px 8px; text-align:right; font-size:11px; color:#64748b; font-weight:600; width:13%;">المصدر</th>
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
        <div style="margin-bottom:28px; page-break-before:${allStages.indexOf(stage) > 0 ? "auto" : "auto"};">
          <!-- Stage header -->
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; padding:12px 16px; background:linear-gradient(135deg, #0f172a08, #0f172a04); border-radius:8px; border-right:4px solid ${statusColor};">
            <div>
              <div style="font-size:15px; font-weight:700; color:#0f172a;">${stage.nameAr}</div>
              <div style="font-size:11px; color:#94a3b8; margin-top:2px;">${stage.stageCode}${stage.descriptionAr ? " — " + stage.descriptionAr : ""}</div>
            </div>
            <div style="text-align:left; display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
              <span style="background:${statusColor}20; color:${statusColor}; padding:4px 14px; border-radius:16px; font-size:12px; font-weight:600;">${statusAr}</span>
              <div style="font-size:11px; color:#64748b;">${stageCompletedSvcs}/${stageServices.length} خدمة — ${stageProgress}%</div>
              <div style="width:100px; background:#e2e8f0; border-radius:4px; height:4px;">
                <div style="width:${stageProgress}%; background:${stageProgress === 100 ? "#22c55e" : statusColor}; height:4px; border-radius:4px;"></div>
              </div>
            </div>
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
  <title>تقرير الامتثال — ${project.name}${filterStageCode ? " — " + filterStageCode : ""}</title>
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
      max-width: 1100px;
      margin: 0 auto;
    }
    @media print {
      body { padding: 0; max-width: 100%; }
      .no-print { display: none !important; }
      @page { margin: 12mm 10mm; size: A4; }
      table { page-break-inside: avoid; }
      .service-card { page-break-inside: avoid; }
    }
    a { color: #3b82f6; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>

  <!-- ═══ COVER PAGE ═══ -->
  <div style="background:linear-gradient(135deg, #0f172a 0%, #1e3a5f 60%, #0ea5e9 100%); color:white; border-radius:16px; padding:40px 48px; margin-bottom:28px; position:relative; overflow:hidden;">
    <!-- Background pattern -->
    <div style="position:absolute; top:-40px; left:-40px; width:200px; height:200px; border-radius:50%; background:rgba(255,255,255,0.03);"></div>
    <div style="position:absolute; bottom:-60px; right:-60px; width:280px; height:280px; border-radius:50%; background:rgba(255,255,255,0.03);"></div>
    
    <div style="position:relative; z-index:1;">
      <!-- Company name -->
      <div style="font-size:13px; font-weight:600; letter-spacing:2px; text-transform:uppercase; opacity:0.6; margin-bottom:8px;">كومو للتطوير العقاري</div>
      
      <!-- Report title -->
      <div style="font-size:28px; font-weight:800; line-height:1.2; margin-bottom:4px;">تقرير الامتثال</div>
      <div style="font-size:16px; font-weight:500; opacity:0.8; margin-bottom:24px;">مراحل DLD / RERA${filterStageCode ? " — " + (allStages[0]?.nameAr ?? filterStageCode) : " — جميع المراحل"}</div>
      
      <!-- Project info -->
      <div style="background:rgba(255,255,255,0.1); border-radius:10px; padding:16px 20px; margin-bottom:24px; backdrop-filter:blur(10px);">
        <div style="font-size:20px; font-weight:700; margin-bottom:6px;">${project.name}</div>
        <div style="display:flex; gap:24px; flex-wrap:wrap; font-size:12px; opacity:0.8;">
          ${project.plotNumber ? `<span>📍 رقم القطعة: ${project.plotNumber}</span>` : ""}
          ${(project as any).location ? `<span>🏙️ الموقع: ${(project as any).location}</span>` : ""}
          <span>🆔 معرّف المشروع: #${project.id}</span>
          <span>📅 تاريخ التقرير: ${reportDate}</span>
        </div>
      </div>
      
      <!-- Overall progress -->
      <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:12px;">
        <div style="background:rgba(255,255,255,0.1); border-radius:10px; padding:14px; text-align:center;">
          <div style="font-size:26px; font-weight:800;">${overallProgress}%</div>
          <div style="font-size:11px; opacity:0.7; margin-top:2px;">التقدم الكلي</div>
        </div>
        <div style="background:rgba(255,255,255,0.1); border-radius:10px; padding:14px; text-align:center;">
          <div style="font-size:26px; font-weight:800;">${completedServicesAll}/${totalServicesAll}</div>
          <div style="font-size:11px; opacity:0.7; margin-top:2px;">خدمة مكتملة</div>
        </div>
        <div style="background:rgba(255,255,255,0.1); border-radius:10px; padding:14px; text-align:center;">
          <div style="font-size:26px; font-weight:800;">${uploadedDocsCountAll}/${totalDocsAll}</div>
          <div style="font-size:11px; opacity:0.7; margin-top:2px;">مستند مرفوع</div>
        </div>
        <div style="background:rgba(255,255,255,0.1); border-radius:10px; padding:14px; text-align:center;">
          <div style="font-size:26px; font-weight:800;">${filledFieldsAll}/${totalFieldsAll}</div>
          <div style="font-size:11px; opacity:0.7; margin-top:2px;">حقل بيانات مكتمل</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Print button -->
  <div class="no-print" style="margin-bottom:20px; display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
    <button onclick="window.print()" style="display:inline-flex; align-items:center; gap:8px; background:#0f172a; color:white; border:none; padding:10px 20px; border-radius:8px; font-family:inherit; font-size:13px; cursor:pointer; font-weight:600;">
      🖨️ طباعة / حفظ PDF
    </button>
    <span style="font-size:12px; color:#64748b;">لحفظ كـ PDF: اختر "حفظ كـ PDF" من خيارات الطابعة</span>
  </div>

  <!-- Stages -->
  ${stagesHtml}

  <!-- Footer -->
  <div style="margin-top:32px; padding-top:16px; border-top:2px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; font-size:11px; color:#94a3b8;">
    <span>كومو للتطوير العقاري — منصة إدارة المشاريع</span>
    <span>تم إنشاء هذا التقرير تلقائياً — ${reportDate}</span>
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
