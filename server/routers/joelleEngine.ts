import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  joelleAnalysisStages,
  joelleReports,
  projects,
  feasibilityStudies,
  marketOverview,
  competitionPricing,
  costsCashFlow,
} from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { makeRequest, type PlacesSearchResult, type GeocodingResult } from "../_core/map";

// ═══════════════════════════════════════════════════════════════════
// JOELLE MARKET INTELLIGENCE ENGINE
// 12 Engines, 7 Reports, Self-Learning System
// ═══════════════════════════════════════════════════════════════════

// Retry helper for LLM calls (handles transient 500 errors)
async function invokeLLMWithRetry(params: Parameters<typeof invokeLLM>[0], maxRetries = 3): Promise<ReturnType<typeof invokeLLM>> {
  let lastError: any;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await invokeLLM(params);
      return result;
    } catch (error: any) {
      lastError = error;
      const isRetryable = error.message?.includes('500') || error.message?.includes('502') || error.message?.includes('503') || error.message?.includes('timeout') || error.message?.includes('ECONNRESET');
      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }
      // Wait before retry: 2s, 4s, 8s
      await new Promise(resolve => setTimeout(resolve, 2000 * Math.pow(2, attempt - 1)));
    }
  }
  throw lastError;
}

// Source weighting systemm
const SOURCE_WEIGHTS = {
  dxb_interact: 0.30,
  property_monitor: 0.20,
  data_finder: 0.20,
  property_finder: 0.10,
  bayut: 0.10,
  market_reports: 0.10,
};

// Risk categories
const RISK_CATEGORIES = [
  'supply_pipeline',
  'pricing_sensitivity',
  'demand_volatility',
  'competitive_saturation',
  'developer_positioning',
] as const;

// Report types - 7 reports
const REPORT_TYPES = [
  'market_intelligence',
  'competitive_analysis',
  'product_strategy',
  'pricing_strategy',
  'demand_forecast',
  'risk_analysis',
  'executive_summary',
] as const;

// Stage definitions
const STAGES = [
  { number: 1, name: 'Data Acquisition', nameAr: 'جمع البيانات' },
  { number: 2, name: 'Area Context Analysis', nameAr: 'تحليل سياق المنطقة' },
  { number: 3, name: 'Market Structure Analysis', nameAr: 'تحليل هيكل السوق' },
  { number: 4, name: 'Competitive Landscape', nameAr: 'خريطة المنافسين' },
  { number: 5, name: 'Demand Forecast', nameAr: 'توقعات الطلب' },
  { number: 6, name: 'Product Strategy', nameAr: 'استراتيجية المنتج' },
  { number: 7, name: 'Pricing Intelligence', nameAr: 'ذكاء التسعير' },
  { number: 8, name: 'Absorption Engine', nameAr: 'محرك الامتصاص' },
  { number: 9, name: 'Risk Intelligence', nameAr: 'ذكاء المخاطر' },
  { number: 10, name: 'Data Reconciliation', nameAr: 'مصالحة البيانات' },
  { number: 11, name: 'Output Generation', nameAr: 'توليد المخرجات' },
  { number: 12, name: 'Report Generation', nameAr: 'توليد التقارير' },
];

// Helper: get project fact sheet
async function getProjectFactSheet(db: any, projectId: number, userId: number) {
  const projectResults = await db.select().from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
  if (!projectResults[0]) throw new Error("Project not found");
  const project = projectResults[0];

  const feasResults = await db.select().from(feasibilityStudies)
    .where(and(eq(feasibilityStudies.projectId, projectId), eq(feasibilityStudies.userId, userId)));
  const feasStudy = feasResults[0] || null;

  const moResults = await db.select().from(marketOverview)
    .where(and(eq(marketOverview.projectId, projectId), eq(marketOverview.userId, userId)));
  const mo = moResults[0] || null;

  const cpResults = await db.select().from(competitionPricing)
    .where(and(eq(competitionPricing.projectId, projectId), eq(competitionPricing.userId, userId)));
  const cp = cpResults[0] || null;

  // Get cost & cashflow data
  const ccfResults = await db.select().from(costsCashFlow)
    .where(and(eq(costsCashFlow.projectId, projectId), eq(costsCashFlow.userId, userId)));
  const ccf = ccfResults[0] || null;

  // Merge data
  const plotArea = feasStudy?.plotArea || parseFloat(String(project.plotAreaSqft || '0')) || 0;
  const gfaRes = feasStudy?.gfaResidential || parseFloat(String(project.gfaResidentialSqft || '0')) || 0;
  const gfaRet = feasStudy?.gfaRetail || parseFloat(String(project.gfaRetailSqft || '0')) || 0;
  const gfaOff = feasStudy?.gfaOffices || parseFloat(String(project.gfaOfficesSqft || '0')) || 0;
  const totalGFA = feasStudy
    ? (gfaRes + gfaRet + gfaOff)
    : parseFloat(String(project.gfaSqft || '0')) || 0;
  const bua = project.bua || feasStudy?.estimatedBua || 0;
  const permittedUse = project.permittedUse || feasStudy?.landUse || 'غير محدد';
  const community = feasStudy?.community || project.areaCode || 'غير محدد';
  const plotNumber = feasStudy?.plotNumber || project.plotNumber || 'غير محدد';

  const projectType: string[] = [];
  if (gfaRes > 0) projectType.push('سكني');
  if (gfaRet > 0) projectType.push('تجاري');
  if (gfaOff > 0) projectType.push('مكاتب');
  if (projectType.length === 0 && permittedUse !== 'غير محدد') {
    if (permittedUse.includes('سكني') || permittedUse.toLowerCase().includes('residential')) projectType.push('سكني');
    if (permittedUse.includes('تجاري') || permittedUse.toLowerCase().includes('commercial') || permittedUse.toLowerCase().includes('retail')) projectType.push('تجاري');
    if (permittedUse.includes('مكاتب') || permittedUse.toLowerCase().includes('office')) projectType.push('مكاتب');
  }

  // Unit types from market overview
  const unitTypes: string[] = [];
  if (mo) {
    if (Number(mo.residentialStudioPct) > 0) unitTypes.push(`استديو (${mo.residentialStudioPct}% - ${mo.residentialStudioAvgArea} قدم²)`);
    if (Number(mo.residential1brPct) > 0) unitTypes.push(`غرفة وصالة (${mo.residential1brPct}% - ${mo.residential1brAvgArea} قدم²)`);
    if (Number(mo.residential2brPct) > 0) unitTypes.push(`غرفتان وصالة (${mo.residential2brPct}% - ${mo.residential2brAvgArea} قدم²)`);
    if (Number(mo.residential3brPct) > 0) unitTypes.push(`ثلاث غرف وصالة (${mo.residential3brPct}% - ${mo.residential3brAvgArea} قدم²)`);
  }

  // Existing pricing data
  const existingPricing = cp ? {
    baseStudio: cp.baseStudioPrice || 0,
    base1br: cp.base1brPrice || 0,
    base2br: cp.base2brPrice || 0,
    base3br: cp.base3brPrice || 0,
    optStudio: cp.optStudioPrice || 0,
    opt1br: cp.opt1brPrice || 0,
    opt2br: cp.opt2brPrice || 0,
    opt3br: cp.opt3brPrice || 0,
    consStudio: cp.consStudioPrice || 0,
    cons1br: cp.cons1brPrice || 0,
    cons2br: cp.cons2brPrice || 0,
    cons3br: cp.cons3brPrice || 0,
  } : null;

  // Cost data summary
  const costData = ccf ? {
    landPrice: ccf.landPrice || 0,
    constructionCostPerSqft: ccf.constructionCostPerSqft || 0,
    developerFeePct: parseFloat(String(ccf.developerFeePct || '5')),
    marketingPct: parseFloat(String(ccf.marketingPct || '2')),
    agentCommissionSalePct: parseFloat(String(ccf.agentCommissionSalePct || '5')),
    contingenciesPct: parseFloat(String(ccf.contingenciesPct || '2')),
    projectDurationMonths: ccf.projectDurationMonths || 36,
    constructionStartMonth: ccf.constructionStartMonth || 6,
    constructionDurationMonths: ccf.constructionDurationMonths || 24,
    comoProfitSharePct: parseFloat(String(ccf.comoProfitSharePct || '15')),
  } : null;

  return {
    project,
    feasStudy,
    mo,
    cp,
    ccf,
    plotArea,
    totalGFA,
    gfaRes,
    gfaRet,
    gfaOff,
    bua,
    permittedUse,
    community,
    plotNumber,
    projectType: projectType.length > 0 ? projectType.join(' + ') : 'غير محدد',
    unitTypes,
    existingPricing,
    costData,
  };
}

// Helper: get nearby places from Google Maps
async function getNearbyPlaces(community: string, projectName: string) {
  try {
    // First geocode the community to get coordinates
    const geocodeResult = await makeRequest<GeocodingResult>(
      '/maps/api/geocode/json',
      { address: `${community}, Dubai, UAE` }
    );

    if (!geocodeResult.results?.[0]) {
      return { lat: 0, lng: 0, places: {} };
    }

    const location = geocodeResult.results[0].geometry.location;
    const locationStr = `${location.lat},${location.lng}`;

    // Search for nearby amenities in parallel
    const [schools, hospitals, malls, metro, parks, mosques] = await Promise.all([
      makeRequest<PlacesSearchResult>('/maps/api/place/nearbysearch/json', {
        location: locationStr, radius: 3000, type: 'school', keyword: 'school'
      }).catch(() => ({ results: [], status: 'ERROR' })),
      makeRequest<PlacesSearchResult>('/maps/api/place/nearbysearch/json', {
        location: locationStr, radius: 3000, type: 'hospital', keyword: 'hospital clinic'
      }).catch(() => ({ results: [], status: 'ERROR' })),
      makeRequest<PlacesSearchResult>('/maps/api/place/nearbysearch/json', {
        location: locationStr, radius: 3000, type: 'shopping_mall', keyword: 'mall'
      }).catch(() => ({ results: [], status: 'ERROR' })),
      makeRequest<PlacesSearchResult>('/maps/api/place/nearbysearch/json', {
        location: locationStr, radius: 3000, type: 'subway_station', keyword: 'metro station'
      }).catch(() => ({ results: [], status: 'ERROR' })),
      makeRequest<PlacesSearchResult>('/maps/api/place/nearbysearch/json', {
        location: locationStr, radius: 3000, type: 'park'
      }).catch(() => ({ results: [], status: 'ERROR' })),
      makeRequest<PlacesSearchResult>('/maps/api/place/nearbysearch/json', {
        location: locationStr, radius: 3000, type: 'mosque'
      }).catch(() => ({ results: [], status: 'ERROR' })),
    ]);

    return {
      lat: location.lat,
      lng: location.lng,
      places: {
        schools: schools.results?.slice(0, 5).map(p => p.name) || [],
        hospitals: hospitals.results?.slice(0, 5).map(p => p.name) || [],
        malls: malls.results?.slice(0, 5).map(p => p.name) || [],
        metro: metro.results?.slice(0, 5).map(p => p.name) || [],
        parks: parks.results?.slice(0, 5).map(p => p.name) || [],
        mosques: mosques.results?.slice(0, 3).map(p => p.name) || [],
      },
    };
  } catch (error) {
    console.error('Error fetching nearby places:', error);
    return { lat: 0, lng: 0, places: {} };
  }
}

// Helper: save stage result
async function saveStageResult(
  db: any,
  userId: number,
  projectId: number,
  stageNumber: number,
  stageName: string,
  status: 'pending' | 'running' | 'completed' | 'error',
  output: string,
  dataJson: string | null = null,
  errorMessage: string | null = null,
) {
  const existing = await db.select().from(joelleAnalysisStages)
    .where(and(
      eq(joelleAnalysisStages.userId, userId),
      eq(joelleAnalysisStages.projectId, projectId),
      eq(joelleAnalysisStages.stageNumber, stageNumber),
    ));

  if (existing[0]) {
    await db.update(joelleAnalysisStages)
      .set({
        stageStatus: status,
        stageOutput: output,
        stageDataJson: dataJson,
        errorMessage,
        completedAt: status === 'completed' ? new Date() : null,
      })
      .where(eq(joelleAnalysisStages.id, existing[0].id));
    return existing[0].id;
  } else {
    const result = await db.insert(joelleAnalysisStages).values({
      userId,
      projectId,
      stageNumber,
      stageName,
      stageStatus: status,
      stageOutput: output,
      stageDataJson: dataJson,
      errorMessage,
      startedAt: new Date(),
      completedAt: status === 'completed' ? new Date() : null,
    });
    return Number(result[0].insertId);
  }
}

// Helper: save report
async function saveReport(
  db: any,
  userId: number,
  projectId: number,
  reportType: string,
  title: string,
  content: string,
  dataJson: string | null = null,
) {
  const existing = await db.select().from(joelleReports)
    .where(and(
      eq(joelleReports.userId, userId),
      eq(joelleReports.projectId, projectId),
      eq(joelleReports.reportType, reportType as any),
    ));

  if (existing[0]) {
    await db.update(joelleReports)
      .set({
        reportTitle: title,
        reportContent: content,
        reportDataJson: dataJson,
        generatedAt: new Date(),
      })
      .where(eq(joelleReports.id, existing[0].id));
    return existing[0].id;
  } else {
    const result = await db.insert(joelleReports).values({
      userId,
      projectId,
      reportType: reportType as any,
      reportTitle: title,
      reportContent: content,
      reportDataJson: dataJson,
      generatedAt: new Date(),
    });
    return Number(result[0].insertId);
  }
}

const currentDate = new Date();
const reportDate = `${currentDate.getDate()}/${currentDate.getMonth() + 1}/${currentDate.getFullYear()}`;
const currentYear = currentDate.getFullYear();

// ═══════════════════════════════════════════════════════════════════
// ROUTER
// ═══════════════════════════════════════════════════════════════════

export const joelleEngineRouter = router({

  // Get all stages for a project
  getStages: publicProcedure
    .input(z.number()) // projectId
    .query(async ({ ctx, input: projectId }) => {
      if (!ctx.user) return [];
      const db = await getDb();
      if (!db) return [];
      const results = await db.select().from(joelleAnalysisStages)
        .where(and(
          eq(joelleAnalysisStages.userId, ctx.user.id),
          eq(joelleAnalysisStages.projectId, projectId),
        ))
        .orderBy(joelleAnalysisStages.stageNumber);
      return results;
    }),

  // Get all reports for a project
  getReports: publicProcedure
    .input(z.number()) // projectId
    .query(async ({ ctx, input: projectId }) => {
      if (!ctx.user) return [];
      const db = await getDb();
      if (!db) return [];
      const results = await db.select().from(joelleReports)
        .where(and(
          eq(joelleReports.userId, ctx.user.id),
          eq(joelleReports.projectId, projectId),
        ));
      return results;
    }),

  // Get a single stage
  getStage: publicProcedure
    .input(z.object({ projectId: z.number(), stageNumber: z.number() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user) return null;
      const db = await getDb();
      if (!db) return null;
      const results = await db.select().from(joelleAnalysisStages)
        .where(and(
          eq(joelleAnalysisStages.userId, ctx.user.id),
          eq(joelleAnalysisStages.projectId, input.projectId),
          eq(joelleAnalysisStages.stageNumber, input.stageNumber),
        ));
      return results[0] || null;
    }),

  // Get a single report
  getReport: publicProcedure
    .input(z.object({ projectId: z.number(), reportType: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user) return null;
      const db = await getDb();
      if (!db) return null;
      const results = await db.select().from(joelleReports)
        .where(and(
          eq(joelleReports.userId, ctx.user.id),
          eq(joelleReports.projectId, input.projectId),
          eq(joelleReports.reportType, input.reportType as any),
        ));
      return results[0] || null;
    }),

  // ═══════════════════════════════════════════════════════════════
  // ENGINE 1: DATA ACQUISITION
  // Read project fact sheet + gather available data
  // ═══════════════════════════════════════════════════════════════
  runEngine1: publicProcedure
    .input(z.number()) // projectId
    .mutation(async ({ ctx, input: projectId }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await saveStageResult(db, ctx.user.id, projectId, 1, STAGES[0].nameAr, 'running', '', null);

      try {
        const factSheet = await getProjectFactSheet(db, projectId, ctx.user.id);

        const output = `# محرك 1: جمع البيانات — بطاقة المشروع

## بيانات المشروع الأساسية
| الحقل | القيمة |
|-------|--------|
| اسم المشروع | ${factSheet.project.name} |
| المنطقة | ${factSheet.community} |
| رقم القطعة | ${factSheet.plotNumber} |
| نوع المشروع | ${factSheet.projectType} |
| الاستعمال المسموح | ${factSheet.permittedUse} |

## المساحات
| الحقل | القيمة (قدم²) |
|-------|--------------|
| مساحة الأرض | ${factSheet.plotArea > 0 ? factSheet.plotArea.toLocaleString() : 'غير محدد'} |
| المساحة الإجمالية GFA | ${factSheet.totalGFA > 0 ? factSheet.totalGFA.toLocaleString() : 'غير محدد'} |
| BUA | ${factSheet.bua > 0 ? factSheet.bua.toLocaleString() : 'غير محدد'} |
| GFA السكني | ${factSheet.gfaRes > 0 ? factSheet.gfaRes.toLocaleString() : 'غير محدد'} |
| GFA التجاري | ${factSheet.gfaRet > 0 ? factSheet.gfaRet.toLocaleString() : 'غير محدد'} |
| GFA المكاتب | ${factSheet.gfaOff > 0 ? factSheet.gfaOff.toLocaleString() : 'غير محدد'} |

## توزيع الوحدات (من النظرة العامة)
${factSheet.unitTypes.length > 0 ? factSheet.unitTypes.map(u => `- ${u}`).join('\n') : 'لم يتم تحديد توزيع الوحدات بعد'}

## بيانات التسعير الحالية
${factSheet.existingPricing ? `
| النوع | متحفظ | أساسي | متفائل |
|-------|-------|-------|--------|
| استديو | ${factSheet.existingPricing.consStudio} | ${factSheet.existingPricing.baseStudio} | ${factSheet.existingPricing.optStudio} |
| غرفة وصالة | ${factSheet.existingPricing.cons1br} | ${factSheet.existingPricing.base1br} | ${factSheet.existingPricing.opt1br} |
| غرفتان وصالة | ${factSheet.existingPricing.cons2br} | ${factSheet.existingPricing.base2br} | ${factSheet.existingPricing.opt2br} |
| ثلاث غرف | ${factSheet.existingPricing.cons3br} | ${factSheet.existingPricing.base3br} | ${factSheet.existingPricing.opt3br} |
` : 'لم يتم تحديد أسعار بعد'}

## حالة مصادر البيانات
| المصدر | الوزن | الحالة | ملاحظات |
|--------|-------|--------|---------|
| DXB Interact | 30% | ⏳ يحتاج ربط API | بيانات المعاملات الرسمية |
| Property Monitor | 20% | ⏳ يحتاج اشتراك | اتجاهات الأسعار والعرض |
| DataFinder | 20% | ⏳ يحتاج اشتراك | بيانات المبيعات والإيجارات |
| Property Finder | 10% | ⏳ يحتاج ربط | أسعار الطلب والقوائم |
| Bayut | 10% | ⏳ يحتاج ربط | أسعار القوائم |
| تقارير السوق (CBRE/JLL) | 10% | ⏳ يحتاج رفع يدوي | اتجاهات كلية |
| Google Maps/Places | متغير | ✅ متصل | بيانات جغرافية |

> **ملاحظة:** حالياً جويل تعتمد على Google Maps/Places API (متصل) ومعرفة الـ LLM العامة. لتحسين دقة التحليل، يُنصح بربط مصادر البيانات الأخرى.`;

        const dataJson = JSON.stringify({
          factSheet: {
            name: factSheet.project.name,
            community: factSheet.community,
            plotNumber: factSheet.plotNumber,
            projectType: factSheet.projectType,
            permittedUse: factSheet.permittedUse,
            plotArea: factSheet.plotArea,
            totalGFA: factSheet.totalGFA,
            gfaRes: factSheet.gfaRes,
            gfaRet: factSheet.gfaRet,
            gfaOff: factSheet.gfaOff,
            bua: factSheet.bua,
            unitTypes: factSheet.unitTypes,
            existingPricing: factSheet.existingPricing,
          },
          dataSources: {
            google_maps: 'connected',
            dxb_interact: 'not_connected',
            property_monitor: 'not_connected',
            data_finder: 'not_connected',
            property_finder: 'not_connected',
            bayut: 'not_connected',
            market_reports: 'not_connected',
          },
        });

        await saveStageResult(db, ctx.user.id, projectId, 1, STAGES[0].nameAr, 'completed', output, dataJson);
        return { success: true, output, dataJson };
      } catch (error: any) {
        await saveStageResult(db, ctx.user.id, projectId, 1, STAGES[0].nameAr, 'error', '', null, error.message);
        throw new Error(`فشل في محرك جمع البيانات: ${error.message}`);
      }
    }),

  // ═══════════════════════════════════════════════════════════════
  // ENGINE 2: AREA CONTEXT ANALYSIS
  // Demographics + Geographic Intelligence via Google Places
  // ═══════════════════════════════════════════════════════════════
  runEngine2: publicProcedure
    .input(z.number())
    .mutation(async ({ ctx, input: projectId }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await saveStageResult(db, ctx.user.id, projectId, 2, STAGES[1].nameAr, 'running', '', null);

      try {
        const factSheet = await getProjectFactSheet(db, projectId, ctx.user.id);
        
        // Get nearby places from Google Maps
        const geoData = await getNearbyPlaces(factSheet.community, factSheet.project.name);

        const placesContext = geoData.places && Object.keys(geoData.places).length > 0
          ? `
## بيانات حقيقية من Google Maps (نطاق 3 كم)
${(geoData.places as any).schools?.length > 0 ? `### المدارس\n${(geoData.places as any).schools.map((s: string) => `- ${s}`).join('\n')}` : ''}
${(geoData.places as any).hospitals?.length > 0 ? `### المستشفيات والعيادات\n${(geoData.places as any).hospitals.map((s: string) => `- ${s}`).join('\n')}` : ''}
${(geoData.places as any).malls?.length > 0 ? `### المراكز التجارية\n${(geoData.places as any).malls.map((s: string) => `- ${s}`).join('\n')}` : ''}
${(geoData.places as any).metro?.length > 0 ? `### محطات المترو\n${(geoData.places as any).metro.map((s: string) => `- ${s}`).join('\n')}` : ''}
${(geoData.places as any).parks?.length > 0 ? `### الحدائق والمتنزهات\n${(geoData.places as any).parks.map((s: string) => `- ${s}`).join('\n')}` : ''}
${(geoData.places as any).mosques?.length > 0 ? `### المساجد\n${(geoData.places as any).mosques.map((s: string) => `- ${s}`).join('\n')}` : ''}
`
          : 'لم يتم العثور على بيانات جغرافية';

        const prompt = `أنتِ جويل، محللة السوق العقاري في Como Developments. التاريخ: ${reportDate} (عام ${currentYear}).

أنتِ الآن في المحرك الثاني: تحليل سياق المنطقة.

بيانات المشروع:
- الاسم: ${factSheet.project.name}
- المنطقة: ${factSheet.community}
- نوع المشروع: ${factSheet.projectType}
- الإحداثيات: ${geoData.lat}, ${geoData.lng}

${placesContext}

اكتبي تحليلاً شاملاً لسياق المنطقة يتضمن:

## 1. الملف الديموغرافي
- التركيبة السكانية المتوقعة (جنسيات، فئات عمرية، مستوى دخل)
- حجم الأسر المتوقع
- نمط الحياة السائد

## 2. البنية التحتية والخدمات
- تقييم البنية التحتية المحيطة بناءً على بيانات Google Maps أعلاه
- جودة الوصول (طرق رئيسية، مترو، مواصلات عامة)
- المرافق التعليمية والصحية والترفيهية

## 3. تقييم جاذبية الموقع
- نقاط القوة الجغرافية
- نقاط الضعف الجغرافية
- المسافة من المعالم الرئيسية (مطار دبي، وسط المدينة، الشاطئ، برج خليفة)
- تقييم إجمالي من 10

## 4. الفرص والتهديدات الجغرافية
- مشاريع بنية تحتية قادمة في المنطقة
- تطورات عمرانية متوقعة

قواعد:
- التقرير باللغة العربية
- كل معلومة من Google Maps تُعلّم بـ (المصدر: Google Maps)
- التقديرات تُعلّم بـ "تقدير مهني"
- الأسلوب مهني كتقارير JLL`;

        const response = await invokeLLMWithRetry({
          messages: [
            { role: "system", content: `أنتِ جويل، محللة السوق العقاري. التاريخ: ${reportDate}. تحللين سياق المنطقة باستخدام بيانات حقيقية من Google Maps.` },
            { role: "user", content: prompt },
          ],
        });

        const output = response.choices[0]?.message?.content || "لم يتم إنشاء التحليل";

        const dataJson = JSON.stringify({
          coordinates: { lat: geoData.lat, lng: geoData.lng },
          nearbyPlaces: geoData.places,
          community: factSheet.community,
        });

        await saveStageResult(db, ctx.user.id, projectId, 2, STAGES[1].nameAr, 'completed', output, dataJson);
        return { success: true, output, dataJson };
      } catch (error: any) {
        await saveStageResult(db, ctx.user.id, projectId, 2, STAGES[1].nameAr, 'error', '', null, error.message);
        throw new Error(`فشل في محرك تحليل المنطقة: ${error.message}`);
      }
    }),

  // ═══════════════════════════════════════════════════════════════
  // ENGINE 3: MARKET STRUCTURE ANALYSIS
  // Transaction volume, price distribution, unit demand
  // ═══════════════════════════════════════════════════════════════
  runEngine3: publicProcedure
    .input(z.number())
    .mutation(async ({ ctx, input: projectId }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await saveStageResult(db, ctx.user.id, projectId, 3, STAGES[2].nameAr, 'running', '', null);

      try {
        const factSheet = await getProjectFactSheet(db, projectId, ctx.user.id);

        // Get previous stage data
        const stage1 = await db.select().from(joelleAnalysisStages)
          .where(and(
            eq(joelleAnalysisStages.userId, ctx.user.id),
            eq(joelleAnalysisStages.projectId, projectId),
            eq(joelleAnalysisStages.stageNumber, 1),
          ));
        const stage2 = await db.select().from(joelleAnalysisStages)
          .where(and(
            eq(joelleAnalysisStages.userId, ctx.user.id),
            eq(joelleAnalysisStages.projectId, projectId),
            eq(joelleAnalysisStages.stageNumber, 2),
          ));

        const prompt = `أنتِ جويل، محللة السوق العقاري في Como Developments. التاريخ: ${reportDate} (عام ${currentYear}).

أنتِ الآن في المحرك الثالث: تحليل هيكل السوق.

بيانات المشروع:
- الاسم: ${factSheet.project.name}
- المنطقة: ${factSheet.community}
- نوع المشروع: ${factSheet.projectType}

${stage2?.[0]?.stageOutput ? `\nتحليل المنطقة السابق:\n${stage2[0].stageOutput.substring(0, 2000)}` : ''}

اكتبي تحليلاً شاملاً لهيكل السوق يتضمن:

## 1. حجم المعاملات (Transaction Volume)
- إجمالي المعاملات السنوية في المنطقة (${currentYear - 1} و ${currentYear})
- توزيع المعاملات حسب نوع العقار (سكني/تجاري/مكاتب)
- معدل النمو السنوي في المعاملات
- مقارنة مع المناطق المجاورة

## 2. توزيع الأسعار (Price Distribution)
- نطاق سعر القدم المربع في المنطقة:
  | النوع | أدنى سعر | متوسط | أعلى سعر |
  |-------|---------|--------|---------|
  | استديو | | | |
  | غرفة وصالة | | | |
  | غرفتان وصالة | | | |
  | ثلاث غرف | | | |
  | تجاري | | | |
- نسبة التغير السنوية والربعية
- الاتجاه العام (صاعد/مستقر/هابط)

## 3. توزيع الطلب حسب نوع الوحدة (Unit Demand Distribution)
- نسبة الطلب لكل نوع وحدة:
  | النوع | نسبة الطلب | اتجاه الطلب |
  |-------|-----------|------------|
  | استديو | % | |
  | غرفة وصالة | % | |
  | غرفتان وصالة | % | |
  | ثلاث غرف | % | |
- أكثر أنواع الوحدات طلباً في المنطقة
- الفجوة بين العرض والطلب

## 4. معدلات الامتصاص (Absorption Rates)
- معدل الامتصاص الحالي في المنطقة
- متوسط فترة البيع للمشاريع المماثلة
- سرعة البيع الشهرية

## 5. ملخص هيكل السوق
- تقييم صحة السوق (1-10)
- التوصية الأولية

بالإضافة لذلك، أعطيني بيانات JSON منظمة في نهاية التقرير بالشكل:
\`\`\`json
{
  "transactionVolume": { "annual": number, "growthRate": number },
  "priceRange": {
    "studio": { "min": number, "avg": number, "max": number },
    "oneBr": { "min": number, "avg": number, "max": number },
    "twoBr": { "min": number, "avg": number, "max": number },
    "threeBr": { "min": number, "avg": number, "max": number },
    "retail": { "min": number, "avg": number, "max": number }
  },
  "demandDistribution": {
    "studio": number, "oneBr": number, "twoBr": number, "threeBr": number
  },
  "absorptionRate": number,
  "avgSellOutMonths": number,
  "marketHealthScore": number
}
\`\`\`

قواعد:
- التقرير باللغة العربية
- كل رقم يُرفق بمصدره
- التقديرات تُعلّم بوضوح
- الأسعار بالدرهم/قدم مربع`;

        const response = await invokeLLMWithRetry({
          messages: [
            { role: "system", content: `أنتِ جويل، محللة السوق العقاري. التاريخ: ${reportDate}. تحللين هيكل السوق العقاري في دبي.` },
            { role: "user", content: prompt },
          ],
        });

        const output = response.choices[0]?.message?.content || "لم يتم إنشاء التحليل";

        // Extract JSON from response
        let dataJson: string | null = null;
        const jsonMatch = output.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          dataJson = jsonMatch[1].trim();
        }

        await saveStageResult(db, ctx.user.id, projectId, 3, STAGES[2].nameAr, 'completed', output, dataJson);
        return { success: true, output, dataJson };
      } catch (error: any) {
        await saveStageResult(db, ctx.user.id, projectId, 3, STAGES[2].nameAr, 'error', '', null, error.message);
        throw new Error(`فشل في محرك تحليل السوق: ${error.message}`);
      }
    }),

  // ═══════════════════════════════════════════════════════════════
  // ENGINE 4: COMPETITIVE LANDSCAPE ENGINE
  // Projects within 1/2/3km, unit mix, prices, payment plans
  // ═══════════════════════════════════════════════════════════════
  runEngine4: publicProcedure
    .input(z.number())
    .mutation(async ({ ctx, input: projectId }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await saveStageResult(db, ctx.user.id, projectId, 4, STAGES[3].nameAr, 'running', '', null);

      try {
        const factSheet = await getProjectFactSheet(db, projectId, ctx.user.id);

        // Get coordinates for the community
        let geoData = { lat: 0, lng: 0 };
        try {
          const geocodeResult = await makeRequest<GeocodingResult>(
            '/maps/api/geocode/json',
            { address: `${factSheet.community}, Dubai, UAE` }
          );
          if (geocodeResult.results?.[0]) {
            geoData = geocodeResult.results[0].geometry.location;
          }
        } catch (e) {}

        // Search for real estate projects nearby - focus on residential apartments in same area
        let nearbyProjects: string[] = [];
        if (geoData.lat !== 0) {
          try {
            // Search 1: Residential apartment towers in same community
            const searchResult1 = await makeRequest<PlacesSearchResult>(
              '/maps/api/place/textsearch/json',
              {
                query: `residential apartment tower building ${factSheet.community} Dubai`,
                location: `${geoData.lat},${geoData.lng}`,
                radius: 2000,
                type: 'establishment',
              }
            );
            const results1 = searchResult1.results?.slice(0, 10).map(p => 
              `${p.name} (${p.formatted_address}${p.rating ? `, تقييم: ${p.rating}` : ''}) [نفس المنطقة]`
            ) || [];
            
            // Search 2: New real estate projects in same area
            const searchResult2 = await makeRequest<PlacesSearchResult>(
              '/maps/api/place/textsearch/json',
              {
                query: `new residential project off-plan apartments ${factSheet.community} Dubai`,
                location: `${geoData.lat},${geoData.lng}`,
                radius: 3000,
                type: 'establishment',
              }
            );
            const results2 = searchResult2.results?.slice(0, 10).map(p => 
              `${p.name} (${p.formatted_address}${p.rating ? `, تقييم: ${p.rating}` : ''})`
            ) || [];
            
            // Combine and deduplicate
            const seen = new Set<string>();
            nearbyProjects = [...results1, ...results2].filter(p => {
              const name = p.split('(')[0].trim();
              if (seen.has(name)) return false;
              seen.add(name);
              return true;
            }).slice(0, 20);
          } catch (e) {}
        }

        const prompt = `أنتِ جويل، محللة السوق العقاري في Como Developments. التاريخ: ${reportDate} (عام ${currentYear}).

أنتِ الآن في المحرك الرابع: خريطة المنافسين.

🚨 **تعليمات حاسمة - الأولوية القصوى:**
- ركّزي حصرياً على **مباني الشقق السكنية** (Residential Apartment Buildings/Towers) في **نفس المنطقة** (${factSheet.community})
- لا تذكري فلل أو تاون هاوس أو مشاريع تجارية بحتة إلا إذا كانت مشاريع متعددة الاستخدام تحتوي شقق
- الأولوية للمشاريع **الجديدة والقيد الإنشاء (Off-Plan)** في نفس المنطقة
- ثم المشاريع **المكتملة حديثاً** (آخر 3 سنوات) في نفس المنطقة
- المشاريع خارج المنطقة تُذكر فقط كمرجع ثانوي

بيانات المشروع:
- الاسم: ${factSheet.project.name}
- المنطقة: ${factSheet.community}
- نوع المشروع: ${factSheet.projectType}
- الإحداثيات: ${geoData.lat}, ${geoData.lng}

${nearbyProjects.length > 0 ? `## مباني ومشاريع سكنية حقيقية من Google Maps في ${factSheet.community}:\n${nearbyProjects.map((p, i) => `${i + 1}. ${p}`).join('\n')}` : ''}

اكتبي تحليلاً شاملاً للمنافسين يتضمن:

## 1. خريطة المنافسين (Competitor Map) — شقق سكنية في ${factSheet.community}
حددي المشاريع المنافسة (شقق سكنية فقط) ضمن 3 نطاقات:

### نطاق 1 كم (منافسون مباشرون)
### نطاق 2 كم (منافسون قريبون)
### نطاق 3 كم (منافسون في المنطقة)

لكل مشروع اذكري:
| اسم المشروع | المطور | المسافة | عدد الوحدات | أنواع الوحدات | سعر/قدم² | خطة السداد | حالة المبيعات | سرعة البيع | المصدر |

🚨 **قواعد إلزامية:**
- يجب ذكر 10-15 مشروع شقق سكنية حقيقي على الأقل **في نفس المنطقة (${factSheet.community})**
- الأولوية المطلقة: مشاريع الشقق السكنية (أبراج/مباني) في ${factSheet.community}
- استخدمي أسماء المباني من Google Maps أعلاه كنقطة بداية
- أضيفي مشاريع شقق سكنية أخرى معروفة في ${factSheet.community}
- لا تخلطي بين أسعار الفلل وأسعار الشقق — نحن نبني مبنى شقق سكنية
- لكل مشروع: اسم حقيقي + مطور حقيقي + أسعار واقعية للشقق
- التقديرات تُعلّم بـ "تقدير مهني"

## 2. تحليل المنتج المنافس
- توزيع أنواع الوحدات عند المنافسين
- متوسط المساحات لكل نوع
- مستوى التشطيب السائد

## 3. تحليل التسعير المنافس
- نطاق الأسعار لكل نوع وحدة
- متوسط السعر المرجح
- الاتجاه السعري

## 4. تحليل خطط السداد
- أكثر خطط السداد شيوعاً
- أفضل خطة سداد تنافسية

## 5. تحليل سرعة البيع
- متوسط سرعة البيع الشهرية
- المشاريع الأسرع مبيعاً ولماذا

## 6. نقاط القوة والضعف التنافسية
- ما يميز مشروعنا
- ما يميز المنافسين
- الفجوات في السوق

بالإضافة لذلك، أعطيني JSON منظم:
\`\`\`json
{
  "competitors": [
    {
      "name": "string",
      "developer": "string",
      "distance_km": number,
      "total_units": number,
      "unit_types": ["studio", "1br", "2br", "3br"],
      "price_per_sqft": number,
      "payment_plan": "string",
      "sales_status": "string",
      "source": "string"
    }
  ],
  "avgPricePerSqft": {
    "studio": number, "oneBr": number, "twoBr": number, "threeBr": number, "retail": number
  },
  "dominantPaymentPlan": "string",
  "avgSalesVelocity": number
}
\`\`\`

قواعد:
- التقرير باللغة العربية
- كل سعر مع مصدره
- 10-15 منافس على الأقل`;

        const response = await invokeLLMWithRetry({
          messages: [
            { role: "system", content: `أنتِ جويل، محللة السوق العقاري. التاريخ: ${reportDate}. تحللين المنافسين في سوق دبي العقاري. استخدمي أسماء مشاريع ومباني حقيقية.` },
            { role: "user", content: prompt },
          ],
        });

        const output = response.choices[0]?.message?.content || "لم يتم إنشاء التحليل";

        let dataJson: string | null = null;
        const jsonMatch = output.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          dataJson = jsonMatch[1].trim();
        }

        await saveStageResult(db, ctx.user.id, projectId, 4, STAGES[3].nameAr, 'completed', output, dataJson);
        return { success: true, output, dataJson };
      } catch (error: any) {
        await saveStageResult(db, ctx.user.id, projectId, 4, STAGES[3].nameAr, 'error', '', null, error.message);
        throw new Error(`فشل في محرك المنافسين: ${error.message}`);
      }
    }),

  // ═══════════════════════════════════════════════════════════════
  // ENGINE 5: DEMAND FORECAST ENGINE
  // Annual demand, unit distribution, market share, sales velocity
  // ═══════════════════════════════════════════════════════════════
  runEngine5: publicProcedure
    .input(z.number())
    .mutation(async ({ ctx, input: projectId }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await saveStageResult(db, ctx.user.id, projectId, 5, STAGES[4].nameAr, 'running', '', null);

      try {
        const factSheet = await getProjectFactSheet(db, projectId, ctx.user.id);

        // Get previous stages data
        const prevStages = await db.select().from(joelleAnalysisStages)
          .where(and(
            eq(joelleAnalysisStages.userId, ctx.user.id),
            eq(joelleAnalysisStages.projectId, projectId),
          ))
          .orderBy(joelleAnalysisStages.stageNumber);

        const stage3Data = prevStages.find(s => s.stageNumber === 3)?.stageDataJson;
        const stage4Data = prevStages.find(s => s.stageNumber === 4)?.stageDataJson;

        const prompt = `أنتِ جويل، محللة السوق العقاري في Como Developments. التاريخ: ${reportDate} (عام ${currentYear}).

أنتِ الآن في المحرك الخامس: توقعات الطلب.

بيانات المشروع:
- الاسم: ${factSheet.project.name}
- المنطقة: ${factSheet.community}
- نوع المشروع: ${factSheet.projectType}
- عدد الوحدات المتوقع: ${factSheet.feasStudy?.numberOfUnits || 'غير محدد'}
- GFA السكني: ${factSheet.gfaRes > 0 ? factSheet.gfaRes.toLocaleString() : 'غير محدد'} قدم²

${stage3Data ? `بيانات هيكل السوق (المحرك 3): ${stage3Data.substring(0, 1500)}` : ''}
${stage4Data ? `بيانات المنافسين (المحرك 4): ${stage4Data.substring(0, 1500)}` : ''}

اكتبي تحليل توقعات الطلب:

## 1. حجم الطلب السنوي (Annual Market Demand)
- إجمالي الطلب السنوي في المنطقة (وحدات/سنة)
- الطلب حسب نوع الوحدة
- معدل نمو الطلب

## 2. توزيع الطلب حسب نوع الوحدة
| النوع | نسبة الطلب | الطلب السنوي (وحدات) |
|-------|-----------|---------------------|
| استديو | % | |
| غرفة وصالة | % | |
| غرفتان وصالة | % | |
| ثلاث غرف | % | |

## 3. سيناريوهات الحصة السوقية
| السيناريو | الحصة | الوحدات/سنة | التبرير |
|-----------|-------|------------|---------|
| متحفظ | 5% | | |
| أساسي | 8% | | |
| متفائل | 12% | | |

## 4. سرعة المبيعات (Sales Velocity)
- سرعة البيع الشهرية المتوقعة (وحدات/شهر)
- مدة البيع الكاملة (أشهر)
| السيناريو | وحدات/شهر | مدة البيع (أشهر) |
|-----------|----------|-----------------|
| متحفظ | | |
| أساسي | | |
| متفائل | | |

## 5. عوامل الطلب الرئيسية
- محركات الطلب الإيجابية
- مخاطر الطلب

أعطيني JSON:
\`\`\`json
{
  "annualDemand": number,
  "demandByType": { "studio": number, "oneBr": number, "twoBr": number, "threeBr": number },
  "marketShare": { "conservative": 0.05, "base": 0.08, "optimistic": 0.12 },
  "salesVelocity": {
    "conservative": { "unitsPerMonth": number, "sellOutMonths": number },
    "base": { "unitsPerMonth": number, "sellOutMonths": number },
    "optimistic": { "unitsPerMonth": number, "sellOutMonths": number }
  },
  "demandGrowthRate": number
}
\`\`\``;

        const response = await invokeLLMWithRetry({
          messages: [
            { role: "system", content: `أنتِ جويل، محللة السوق العقاري. التاريخ: ${reportDate}. تتوقعين الطلب في سوق دبي العقاري.` },
            { role: "user", content: prompt },
          ],
        });

        const output = response.choices[0]?.message?.content || "لم يتم إنشاء التحليل";
        let dataJson: string | null = null;
        const jsonMatch = output.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) dataJson = jsonMatch[1].trim();

        await saveStageResult(db, ctx.user.id, projectId, 5, STAGES[4].nameAr, 'completed', output, dataJson);
        return { success: true, output, dataJson };
      } catch (error: any) {
        await saveStageResult(db, ctx.user.id, projectId, 5, STAGES[4].nameAr, 'error', '', null, error.message);
        throw new Error(`فشل في محرك توقعات الطلب: ${error.message}`);
      }
    }),

  // ═══════════════════════════════════════════════════════════════
  // ENGINE 6: PRODUCT STRATEGY ENGINE
  // Unit mix, sizes, retail mix, positioning
  // ═══════════════════════════════════════════════════════════════
  runEngine6: publicProcedure
    .input(z.number())
    .mutation(async ({ ctx, input: projectId }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await saveStageResult(db, ctx.user.id, projectId, 6, STAGES[5].nameAr, 'running', '', null);

      try {
        const factSheet = await getProjectFactSheet(db, projectId, ctx.user.id);

        const prevStages = await db.select().from(joelleAnalysisStages)
          .where(and(
            eq(joelleAnalysisStages.userId, ctx.user.id),
            eq(joelleAnalysisStages.projectId, projectId),
          ))
          .orderBy(joelleAnalysisStages.stageNumber);

        const stage3Data = prevStages.find(s => s.stageNumber === 3)?.stageDataJson;
        const stage4Data = prevStages.find(s => s.stageNumber === 4)?.stageDataJson;
        const stage5Data = prevStages.find(s => s.stageNumber === 5)?.stageDataJson;

        const prompt = `أنتِ جويل، محللة السوق العقاري في Como Developments. التاريخ: ${reportDate} (عام ${currentYear}).

المحرك السادس: استراتيجية المنتج.

🚨 **تعليمات حاسمة:**
- جميع المقارنات والتوصيات يجب أن تكون مبنية على **مباني الشقق السكنية في نفس المنطقة (${factSheet.community})**
- لا تقارني مع فلل أو تاون هاوس — نحن نبني مبنى شقق سكنية
- الأسعار والمساحات يجب أن تعكس واقع سوق الشقق في ${factSheet.community} تحديداً
- لا تستخدمي أرقام عامة لدبي — استخدمي أرقام المنطقة فقط

بيانات المشروع::
- الاسم: ${factSheet.project.name}
- المنطقة: ${factSheet.community}
- نوع المشروع: ${factSheet.projectType}
- GFA السكني: ${factSheet.gfaRes > 0 ? factSheet.gfaRes.toLocaleString() : 'غير محدد'} قدم²
- GFA التجاري: ${factSheet.gfaRet > 0 ? factSheet.gfaRet.toLocaleString() : 'غير محدد'} قدم²
- GFA المكاتب: ${factSheet.gfaOff > 0 ? factSheet.gfaOff.toLocaleString() : 'غير محدد'} قدم²

${stage3Data ? `بيانات السوق: ${stage3Data.substring(0, 1000)}` : ''}
${stage4Data ? `بيانات المنافسين: ${stage4Data.substring(0, 1000)}` : ''}
${stage5Data ? `بيانات الطلب: ${stage5Data.substring(0, 1000)}` : ''}

اكتبي استراتيجية المنتج:

## 1. توزيع الوحدات الموصى (Unit Mix)
| النوع | النسبة | عدد الوحدات | متوسط المساحة (قدم²) | التبرير |
|-------|--------|------------|---------------------|---------|

## 2. المزيج التجاري (Retail Mix) — إذا كان هناك GFA تجاري
| النوع | النسبة | المساحة | التبرير |
|-------|--------|---------|---------|

## 3. تحديد الموقع (Positioning)
- الفئة: (Affordable / Mid-market / Upper-mid / Luxury)
- جودة التشطيب الموصى بها
- المرافق والخدمات المقترحة
- نقاط البيع الفريدة (USPs)

## 4. المقارنة مع المنافسين (Developer Benchmarking)
مقارنة مع مشاريع الشقق السكنية الفعلية في ${factSheet.community} (من بيانات المحرك 4 أعلاه).
🚨 استخدمي فقط المشاريع الموجودة فعلاً في نفس المنطقة:
| المطور | المشروع | Unit Mix | المساحات | التشطيب | التسعير |

## 5. التوصيات النهائية للمنتج

JSON:
\`\`\`json
{
  "unitMix": {
    "studio": { "pct": number, "avgSize": number, "count": number },
    "oneBr": { "pct": number, "avgSize": number, "count": number },
    "twoBr": { "pct": number, "avgSize": number, "count": number },
    "threeBr": { "pct": number, "avgSize": number, "count": number }
  },
  "retailMix": {
    "small": { "pct": number, "avgSize": number },
    "medium": { "pct": number, "avgSize": number },
    "large": { "pct": number, "avgSize": number }
  },
  "positioning": "affordable|mid_market|upper_mid|luxury",
  "finishingQuality": "ممتاز|جيد|عادي",
  "totalUnits": number,
  "usps": ["string"]
}
\`\`\``;

        const response = await invokeLLMWithRetry({
          messages: [
            { role: "system", content: `أنتِ جويل، محللة السوق العقاري. التاريخ: ${reportDate}. تصممين استراتيجية المنتج.` },
            { role: "user", content: prompt },
          ],
        });

        const output = response.choices[0]?.message?.content || "لم يتم إنشاء التحليل";
        let dataJson: string | null = null;
        const jsonMatch = output.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) dataJson = jsonMatch[1].trim();

        await saveStageResult(db, ctx.user.id, projectId, 6, STAGES[5].nameAr, 'completed', output, dataJson);
        return { success: true, output, dataJson };
      } catch (error: any) {
        await saveStageResult(db, ctx.user.id, projectId, 6, STAGES[5].nameAr, 'error', '', null, error.message);
        throw new Error(`فشل في محرك استراتيجية المنتج: ${error.message}`);
      }
    }),

  // ═══════════════════════════════════════════════════════════════
  // ENGINE 7: PRICING INTELLIGENCE ENGINE
  // 3 scenarios with weighted average from multiple sources
  // ═══════════════════════════════════════════════════════════════
  runEngine7: publicProcedure
    .input(z.number())
    .mutation(async ({ ctx, input: projectId }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await saveStageResult(db, ctx.user.id, projectId, 7, STAGES[6].nameAr, 'running', '', null);

      try {
        const factSheet = await getProjectFactSheet(db, projectId, ctx.user.id);

        const prevStages = await db.select().from(joelleAnalysisStages)
          .where(and(
            eq(joelleAnalysisStages.userId, ctx.user.id),
            eq(joelleAnalysisStages.projectId, projectId),
          ))
          .orderBy(joelleAnalysisStages.stageNumber);

        const stage3Data = prevStages.find(s => s.stageNumber === 3)?.stageDataJson;
        const stage4Data = prevStages.find(s => s.stageNumber === 4)?.stageDataJson;
        const stage6Data = prevStages.find(s => s.stageNumber === 6)?.stageDataJson;

        const prompt = `أنتِ جويل، محللة السوق العقاري في Como Developments. التاريخ: ${reportDate} (عام ${currentYear}).

المحرك السابع: ذكاء التسعير.

🚨 **تعليمات حاسمة للتسعير:**
- جميع الأسعار يجب أن تعكس واقع **سوق الشقق السكنية في ${factSheet.community} تحديداً**
- لا تستخدمي متوسطات دبي العامة — استخدمي أسعار المنطقة فقط
- المقارنة يجب أن تكون مع **مشاريع الشقق السكنية في نفس المنطقة** (من بيانات المحرك 4)
- لا تخلطي أسعار الفلل مع أسعار الشقق
- يجب أن تكون الأرقام متسقة مع بيانات المنافسين في المحرك 4 واستراتيجية المنتج في المحرك 6

بيانات المشروع::
- الاسم: ${factSheet.project.name}
- المنطقة: ${factSheet.community}
- نوع المشروع: ${factSheet.projectType}
- جودة التشطيب: ${factSheet.mo?.finishingQuality || 'ممتاز'}

${stage3Data ? `بيانات السوق: ${stage3Data.substring(0, 1000)}` : ''}
${stage4Data ? `بيانات المنافسين: ${stage4Data.substring(0, 1000)}` : ''}
${stage6Data ? `استراتيجية المنتج: ${stage6Data.substring(0, 1000)}` : ''}

اكتبي تحليل التسعير الذكي:

## 1. منهجية التسعير
- شرح نظام الأوزان المستخدم
- المصادر المتاحة وأوزانها

## 2. تحليل أسعار المصادر
| المصدر | الوزن | سعر الاستديو | سعر 1BR | سعر 2BR | سعر 3BR | تجاري |
|--------|-------|-------------|---------|---------|---------|-------|
| DXB Interact | 30% | | | | | |
| Property Monitor | 20% | | | | | |
| DataFinder | 20% | | | | | |
| Property Finder | 10% | | | | | |
| Bayut | 10% | | | | | |
| تقارير السوق | 10% | | | | | |
| **المتوسط المرجح** | **100%** | | | | | |

## 3. ثلاث سيناريوهات التسعير
| النوع | متحفظ (-7%) | أساسي | متفائل (+7%) |
|-------|------------|-------|-------------|
| استديو | | | |
| غرفة وصالة | | | |
| غرفتان وصالة | | | |
| ثلاث غرف | | | |
| تجاري صغير | | | |
| تجاري متوسط | | | |
| تجاري كبير | | | |
| مكاتب صغيرة | | | |
| مكاتب متوسطة | | | |
| مكاتب كبيرة | | | |

## 4. خطة السداد الموصى بها
| المرحلة | النسبة | التوقيت |
|---------|--------|---------|
| الحجز | % | |
| أثناء البناء | % | |
| التسليم | % | |
| ما بعد التسليم | % | |

## 5. تحليل الحساسية
| تغير السعر | الإيرادات | الربح | هامش الربح |
|------------|----------|-------|-----------|
| -20% | | | |
| -10% | | | |
| 0% (أساسي) | | | |
| +10% | | | |
| +20% | | | |

JSON:
\`\`\`json
{
  "scenarios": {
    "optimistic": {
      "residential": { "studio": number, "oneBr": number, "twoBr": number, "threeBr": number },
      "retail": { "small": number, "medium": number, "large": number },
      "offices": { "small": number, "medium": number, "large": number }
    },
    "base": {
      "residential": { "studio": number, "oneBr": number, "twoBr": number, "threeBr": number },
      "retail": { "small": number, "medium": number, "large": number },
      "offices": { "small": number, "medium": number, "large": number }
    },
    "conservative": {
      "residential": { "studio": number, "oneBr": number, "twoBr": number, "threeBr": number },
      "retail": { "small": number, "medium": number, "large": number },
      "offices": { "small": number, "medium": number, "large": number }
    }
  },
  "paymentPlan": {
    "booking": { "pct": number, "timing": "string" },
    "construction": { "pct": number, "timing": "string" },
    "handover": { "pct": number, "timing": "string" },
    "deferred": { "pct": number, "timing": "string" }
  },
  "weightedAvgPrice": { "studio": number, "oneBr": number, "twoBr": number, "threeBr": number }
}
\`\`\``;

        const response = await invokeLLMWithRetry({
          messages: [
            { role: "system", content: `أنتِ جويل، محللة السوق العقاري. التاريخ: ${reportDate}. تسعّرين المشاريع العقارية في دبي.` },
            { role: "user", content: prompt },
          ],
        });

        const output = response.choices[0]?.message?.content || "لم يتم إنشاء التحليل";
        let dataJson: string | null = null;
        const jsonMatch = output.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) dataJson = jsonMatch[1].trim();

        await saveStageResult(db, ctx.user.id, projectId, 7, STAGES[6].nameAr, 'completed', output, dataJson);
        return { success: true, output, dataJson };
      } catch (error: any) {
        await saveStageResult(db, ctx.user.id, projectId, 7, STAGES[6].nameAr, 'error', '', null, error.message);
        throw new Error(`فشل في محرك التسعير: ${error.message}`);
      }
    }),

  // ═══════════════════════════════════════════════════════════════
  // ENGINE 8: ABSORPTION ENGINE
  // Units/year, monthly velocity
  // ═══════════════════════════════════════════════════════════════
  runEngine8: publicProcedure
    .input(z.number())
    .mutation(async ({ ctx, input: projectId }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await saveStageResult(db, ctx.user.id, projectId, 8, STAGES[7].nameAr, 'running', '', null);

      try {
        const factSheet = await getProjectFactSheet(db, projectId, ctx.user.id);

        const prevStages = await db.select().from(joelleAnalysisStages)
          .where(and(
            eq(joelleAnalysisStages.userId, ctx.user.id),
            eq(joelleAnalysisStages.projectId, projectId),
          ))
          .orderBy(joelleAnalysisStages.stageNumber);

        const stage5Data = prevStages.find(s => s.stageNumber === 5)?.stageDataJson;
        const stage7Data = prevStages.find(s => s.stageNumber === 7)?.stageDataJson;

        const prompt = `أنتِ جويل. التاريخ: ${reportDate}.

المحرك الثامن: محرك الامتصاص.

المشروع: ${factSheet.project.name} — ${factSheet.community}
عدد الوحدات: ${factSheet.feasStudy?.numberOfUnits || 'غير محدد'}

${stage5Data ? `بيانات الطلب: ${stage5Data.substring(0, 1500)}` : ''}
${stage7Data ? `بيانات التسعير: ${stage7Data.substring(0, 1500)}` : ''}

اكتبي تحليل الامتصاص:

## 1. معدل الامتصاص المتوقع
| السيناريو | الحصة السوقية | وحدات/سنة | وحدات/شهر | مدة البيع الكاملة |
|-----------|-------------|----------|----------|-----------------|
| متحفظ | 5% | | | |
| أساسي | 8% | | | |
| متفائل | 12% | | | |

## 2. جدول المبيعات المتوقع (شهري)
| الشهر | وحدات متحفظ | وحدات أساسي | وحدات متفائل | إيرادات تراكمية |

## 3. عوامل تسريع/تبطيء الامتصاص

JSON:
\`\`\`json
{
  "absorption": {
    "conservative": { "unitsPerYear": number, "unitsPerMonth": number, "sellOutMonths": number },
    "base": { "unitsPerYear": number, "unitsPerMonth": number, "sellOutMonths": number },
    "optimistic": { "unitsPerYear": number, "unitsPerMonth": number, "sellOutMonths": number }
  }
}
\`\`\``;

        const response = await invokeLLMWithRetry({
          messages: [
            { role: "system", content: `أنتِ جويل، محللة السوق. التاريخ: ${reportDate}.` },
            { role: "user", content: prompt },
          ],
        });

        const output = response.choices[0]?.message?.content || "لم يتم إنشاء التحليل";
        let dataJson: string | null = null;
        const jsonMatch = output.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) dataJson = jsonMatch[1].trim();

        await saveStageResult(db, ctx.user.id, projectId, 8, STAGES[7].nameAr, 'completed', output, dataJson);
        return { success: true, output, dataJson };
      } catch (error: any) {
        await saveStageResult(db, ctx.user.id, projectId, 8, STAGES[7].nameAr, 'error', '', null, error.message);
        throw new Error(`فشل في محرك الامتصاص: ${error.message}`);
      }
    }),

  // ═══════════════════════════════════════════════════════════════
  // ENGINE 9: RISK INTELLIGENCE ENGINE
  // 5 risk categories + Project Market Risk Index
  // ═══════════════════════════════════════════════════════════════
  runEngine9: publicProcedure
    .input(z.number())
    .mutation(async ({ ctx, input: projectId }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await saveStageResult(db, ctx.user.id, projectId, 9, STAGES[8].nameAr, 'running', '', null);

      try {
        const factSheet = await getProjectFactSheet(db, projectId, ctx.user.id);

        const prevStages = await db.select().from(joelleAnalysisStages)
          .where(and(
            eq(joelleAnalysisStages.userId, ctx.user.id),
            eq(joelleAnalysisStages.projectId, projectId),
          ))
          .orderBy(joelleAnalysisStages.stageNumber);

        const allStagesContext = prevStages
          .filter(s => s.stageNumber <= 8 && s.stageDataJson)
          .map(s => `محرك ${s.stageNumber}: ${s.stageDataJson?.substring(0, 500)}`)
          .join('\n\n');

        const prompt = `أنتِ جويل. التاريخ: ${reportDate}.

المحرك التاسع: ذكاء المخاطر.

المشروع: ${factSheet.project.name} — ${factSheet.community}

${allStagesContext}

اكتبي تحليل المخاطر الشامل:

## 1. مخاطر خط الإمداد (Supply Pipeline Risk)
- حجم المعروض الحالي والمتوقع
- مخاطر فائض العرض
- **مستوى الخطر:** منخفض / متوسط / مرتفع / عالي

## 2. مخاطر حساسية التسعير (Pricing Sensitivity Risk)
- مدى واقعية الأسعار المقترحة
- هامش الأمان
- **مستوى الخطر:** منخفض / متوسط / مرتفع / عالي

## 3. مخاطر تقلب الطلب (Demand Volatility Risk)
- استقرار الطلب في المنطقة
- العوامل المؤثرة
- **مستوى الخطر:** منخفض / متوسط / مرتفع / عالي

## 4. مخاطر التشبع التنافسي (Competitive Saturation Risk)
- عدد المشاريع المنافسة
- مدى التشبع
- **مستوى الخطر:** منخفض / متوسط / مرتفع / عالي

## 5. مخاطر موقع المطور (Developer Positioning Risk)
- مقارنة Como مع المطورين الكبار
- التحديات التنافسية
- **مستوى الخطر:** منخفض / متوسط / مرتفع / عالي

## 6. مؤشر المخاطر الإجمالي (Project Market Risk Index)
- الدرجة الإجمالية: X/100
- التصنيف: منخفض المخاطر / متوسط / مرتفع / عالي المخاطر
- التوصيات لتخفيف المخاطر

JSON:
\`\`\`json
{
  "risks": {
    "supplyPipeline": { "level": "low|moderate|elevated|high", "score": number },
    "pricingSensitivity": { "level": "low|moderate|elevated|high", "score": number },
    "demandVolatility": { "level": "low|moderate|elevated|high", "score": number },
    "competitiveSaturation": { "level": "low|moderate|elevated|high", "score": number },
    "developerPositioning": { "level": "low|moderate|elevated|high", "score": number }
  },
  "overallRiskIndex": number,
  "overallRiskLevel": "low|moderate|elevated|high",
  "mitigationStrategies": ["string"]
}
\`\`\``;

        const response = await invokeLLMWithRetry({
          messages: [
            { role: "system", content: `أنتِ جويل، محللة المخاطر العقارية. التاريخ: ${reportDate}.` },
            { role: "user", content: prompt },
          ],
        });

        const output = response.choices[0]?.message?.content || "لم يتم إنشاء التحليل";
        let dataJson: string | null = null;
        const jsonMatch = output.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) dataJson = jsonMatch[1].trim();

        await saveStageResult(db, ctx.user.id, projectId, 9, STAGES[8].nameAr, 'completed', output, dataJson);
        return { success: true, output, dataJson };
      } catch (error: any) {
        await saveStageResult(db, ctx.user.id, projectId, 9, STAGES[8].nameAr, 'error', '', null, error.message);
        throw new Error(`فشل في محرك المخاطر: ${error.message}`);
      }
    }),

  // ═══════════════════════════════════════════════════════════════
  // ENGINE 10: DATA RECONCILIATION ENGINE
  // Source weighting system
  // ═══════════════════════════════════════════════════════════════
  runEngine10: publicProcedure
    .input(z.number())
    .mutation(async ({ ctx, input: projectId }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await saveStageResult(db, ctx.user.id, projectId, 10, STAGES[9].nameAr, 'running', '', null);

      try {
        const factSheet = await getProjectFactSheet(db, projectId, ctx.user.id);

        const prevStages = await db.select().from(joelleAnalysisStages)
          .where(and(
            eq(joelleAnalysisStages.userId, ctx.user.id),
            eq(joelleAnalysisStages.projectId, projectId),
          ))
          .orderBy(joelleAnalysisStages.stageNumber);

        const stage3Data = prevStages.find(s => s.stageNumber === 3)?.stageDataJson;
        const stage4Data = prevStages.find(s => s.stageNumber === 4)?.stageDataJson;
        const stage7Data = prevStages.find(s => s.stageNumber === 7)?.stageDataJson;

        const prompt = `أنتِ جويل. التاريخ: ${reportDate}.

االمحرك العاشر: مصالحة البيانات.

🚨 **تعليمات حاسمة للمصالحة:**
- جميع الأسعار المرجحة يجب أن تعكس **سوق الشقق السكنية في ${factSheet.community} تحديداً**
- لا تستخدمي متوسطات دبي العامة — استخدمي بيانات المنطقة فقط
- يجب أن تكون الأرقام النهائية **متسقة تماماً** مع أسعار المحرك 7 (التسعير) والمحرك 4 (المنافسين)
- إذا وجدتِ تضارباً بين المحركات، اذكريه واشرحي كيف تم حله

المشروع: ${factSheet.project.name} — ${factSheet.community}

${stage3Data ? `بيانات السوق: ${stage3Data.substring(0, 1000)}` : ''}
${stage4Data ? `بيانات المنافسين: ${stage4Data.substring(0, 1000)}` : ''}
${stage7Data ? `بيانات التسعير: ${stage7Data.substring(0, 1000)}` : ''}

## نظام أوزان الترجيح
| المصدر | الوزن |
|--------|-------|
| DXB Interact | 30% |
| Property Monitor | 20% |
| DataFinder | 20% |
| Property Finder | 10% |
| Bayut | 10% |
| تقارير السوق | 10% |

اكتبي تقرير مصالحة البيانات:

## 1. ملخص البيانات من كل مصدر
لكل نوع وحدة، اذكري السعر من كل مصدر والسعر المرجح النهائي.

## 2. حدود التباين
- الإجماليات: ±5%
- الأسعار الوسطية: ±3%
- خط الإمداد: ±10%
- أسعار الطلب: ±7%

## 3. التناقضات المكتشفة
أي تناقضات بين المصادر وكيف تم حلها.

## 4. مستوى الثقة
| البيان | مستوى الثقة | السبب |
|--------|------------|-------|

## 5. التوصيات لتحسين جودة البيانات

> **ملاحظة مهمة:** حالياً لا توجد مصادر بيانات خارجية مربوطة مباشرة. جميع الأسعار مبنية على تقديرات مهنية من الـ LLM. لتحسين الدقة، يُنصح بربط: DXB Interact API, Property Monitor API, DataFinder API.

JSON:
\`\`\`json
{
  "reconciledPrices": {
    "studio": { "weighted": number, "confidence": "high|medium|low" },
    "oneBr": { "weighted": number, "confidence": "high|medium|low" },
    "twoBr": { "weighted": number, "confidence": "high|medium|low" },
    "threeBr": { "weighted": number, "confidence": "high|medium|low" },
    "retail": { "weighted": number, "confidence": "high|medium|low" }
  },
  "dataQualityScore": number,
  "connectedSources": 1,
  "totalSources": 7,
  "recommendations": ["string"]
}
\`\`\``;

        const response = await invokeLLMWithRetry({
          messages: [
            { role: "system", content: `أنتِ جويل. التاريخ: ${reportDate}. تصالحين البيانات من مصادر متعددة.` },
            { role: "user", content: prompt },
          ],
        });

        const output = response.choices[0]?.message?.content || "لم يتم إنشاء التحليل";
        let dataJson: string | null = null;
        const jsonMatch = output.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) dataJson = jsonMatch[1].trim();

        await saveStageResult(db, ctx.user.id, projectId, 10, STAGES[9].nameAr, 'completed', output, dataJson);
        return { success: true, output, dataJson };
      } catch (error: any) {
        await saveStageResult(db, ctx.user.id, projectId, 10, STAGES[9].nameAr, 'error', '', null, error.message);
        throw new Error(`فشل في محرك مصالحة البيانات: ${error.message}`);
      }
    }),

  // ═══════════════════════════════════════════════════════════════
  // ENGINE 11: OUTPUT GENERATION
  // Auto-populate platform fields
  // ═══════════════════════════════════════════════════════════════
  runEngine11: publicProcedure
    .input(z.number())
    .mutation(async ({ ctx, input: projectId }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await saveStageResult(db, ctx.user.id, projectId, 11, STAGES[10].nameAr, 'running', '', null);

      try {
        // Collect all stage data
        const prevStages = await db.select().from(joelleAnalysisStages)
          .where(and(
            eq(joelleAnalysisStages.userId, ctx.user.id),
            eq(joelleAnalysisStages.projectId, projectId),
          ))
          .orderBy(joelleAnalysisStages.stageNumber);

        const stage6Data = prevStages.find(s => s.stageNumber === 6)?.stageDataJson;
        const stage7Data = prevStages.find(s => s.stageNumber === 7)?.stageDataJson;
        const stage8Data = prevStages.find(s => s.stageNumber === 8)?.stageDataJson;

        let outputFields: any = {};
        let outputSummary = '# محرك 11: توليد المخرجات\n\n';

        // Parse stage 6 (Product Strategy) for unit mix
        if (stage6Data) {
          try {
            const s6 = JSON.parse(stage6Data);
            if (s6.unitMix) {
              // Update marketOverview with unit mix
              const moExisting = await db.select().from(marketOverview)
                .where(and(eq(marketOverview.projectId, projectId), eq(marketOverview.userId, ctx.user.id)));

              const moData: any = {};
              if (s6.unitMix.studio) {
                moData.residentialStudioPct = String(s6.unitMix.studio.pct || 0);
                moData.residentialStudioAvgArea = s6.unitMix.studio.avgSize || 0;
              }
              if (s6.unitMix.oneBr) {
                moData.residential1brPct = String(s6.unitMix.oneBr.pct || 0);
                moData.residential1brAvgArea = s6.unitMix.oneBr.avgSize || 0;
              }
              if (s6.unitMix.twoBr) {
                moData.residential2brPct = String(s6.unitMix.twoBr.pct || 0);
                moData.residential2brAvgArea = s6.unitMix.twoBr.avgSize || 0;
              }
              if (s6.unitMix.threeBr) {
                moData.residential3brPct = String(s6.unitMix.threeBr.pct || 0);
                moData.residential3brAvgArea = s6.unitMix.threeBr.avgSize || 0;
              }
              if (s6.finishingQuality) {
                moData.finishingQuality = s6.finishingQuality;
              }

              if (moExisting[0]) {
                await db.update(marketOverview).set(moData).where(eq(marketOverview.id, moExisting[0].id));
              } else {
                await db.insert(marketOverview).values({ userId: ctx.user.id, projectId, ...moData });
              }

              outputFields.unitMix = s6.unitMix;
              outputSummary += '## ✅ تم تعبئة توزيع الوحدات (النظرة العامة)\n';
              outputSummary += `- استديو: ${s6.unitMix.studio?.pct || 0}% (${s6.unitMix.studio?.avgSize || 0} قدم²)\n`;
              outputSummary += `- غرفة وصالة: ${s6.unitMix.oneBr?.pct || 0}% (${s6.unitMix.oneBr?.avgSize || 0} قدم²)\n`;
              outputSummary += `- غرفتان وصالة: ${s6.unitMix.twoBr?.pct || 0}% (${s6.unitMix.twoBr?.avgSize || 0} قدم²)\n`;
              outputSummary += `- ثلاث غرف: ${s6.unitMix.threeBr?.pct || 0}% (${s6.unitMix.threeBr?.avgSize || 0} قدم²)\n\n`;
            }
          } catch (e) {
            outputSummary += '## ⚠️ لم يتم تعبئة توزيع الوحدات (خطأ في البيانات)\n\n';
          }
        }

        // Parse stage 7 (Pricing) for price scenarios
        if (stage7Data) {
          try {
            const s7 = JSON.parse(stage7Data);
            if (s7.scenarios) {
              const cpExisting = await db.select().from(competitionPricing)
                .where(and(eq(competitionPricing.projectId, projectId), eq(competitionPricing.userId, ctx.user.id)));

              const cpData: any = {};
              // Optimistic
              if (s7.scenarios.optimistic?.residential) {
                cpData.optStudioPrice = s7.scenarios.optimistic.residential.studio || 0;
                cpData.opt1brPrice = s7.scenarios.optimistic.residential.oneBr || 0;
                cpData.opt2brPrice = s7.scenarios.optimistic.residential.twoBr || 0;
                cpData.opt3brPrice = s7.scenarios.optimistic.residential.threeBr || 0;
              }
              if (s7.scenarios.optimistic?.retail) {
                cpData.optRetailSmallPrice = s7.scenarios.optimistic.retail.small || 0;
                cpData.optRetailMediumPrice = s7.scenarios.optimistic.retail.medium || 0;
                cpData.optRetailLargePrice = s7.scenarios.optimistic.retail.large || 0;
              }
              // Base
              if (s7.scenarios.base?.residential) {
                cpData.baseStudioPrice = s7.scenarios.base.residential.studio || 0;
                cpData.base1brPrice = s7.scenarios.base.residential.oneBr || 0;
                cpData.base2brPrice = s7.scenarios.base.residential.twoBr || 0;
                cpData.base3brPrice = s7.scenarios.base.residential.threeBr || 0;
              }
              if (s7.scenarios.base?.retail) {
                cpData.baseRetailSmallPrice = s7.scenarios.base.retail.small || 0;
                cpData.baseRetailMediumPrice = s7.scenarios.base.retail.medium || 0;
                cpData.baseRetailLargePrice = s7.scenarios.base.retail.large || 0;
              }
              // Conservative
              if (s7.scenarios.conservative?.residential) {
                cpData.consStudioPrice = s7.scenarios.conservative.residential.studio || 0;
                cpData.cons1brPrice = s7.scenarios.conservative.residential.oneBr || 0;
                cpData.cons2brPrice = s7.scenarios.conservative.residential.twoBr || 0;
                cpData.cons3brPrice = s7.scenarios.conservative.residential.threeBr || 0;
              }
              if (s7.scenarios.conservative?.retail) {
                cpData.consRetailSmallPrice = s7.scenarios.conservative.retail.small || 0;
                cpData.consRetailMediumPrice = s7.scenarios.conservative.retail.medium || 0;
                cpData.consRetailLargePrice = s7.scenarios.conservative.retail.large || 0;
              }
              // Payment plan
              if (s7.paymentPlan) {
                cpData.paymentBookingPct = String(s7.paymentPlan.booking?.pct || 10);
                cpData.paymentBookingTiming = s7.paymentPlan.booking?.timing || 'عند التوقيع';
                cpData.paymentConstructionPct = String(s7.paymentPlan.construction?.pct || 60);
                cpData.paymentConstructionTiming = s7.paymentPlan.construction?.timing || 'أثناء الإنشاء';
                cpData.paymentHandoverPct = String(s7.paymentPlan.handover?.pct || 30);
                cpData.paymentHandoverTiming = s7.paymentPlan.handover?.timing || 'عند التسليم';
                cpData.paymentDeferredPct = String(s7.paymentPlan.deferred?.pct || 0);
                cpData.paymentDeferredTiming = s7.paymentPlan.deferred?.timing || null;
              }

              if (cpExisting[0]) {
                await db.update(competitionPricing).set(cpData).where(eq(competitionPricing.id, cpExisting[0].id));
              } else {
                await db.insert(competitionPricing).values({ userId: ctx.user.id, projectId, ...cpData });
              }

              outputFields.pricing = s7.scenarios;
              outputFields.paymentPlan = s7.paymentPlan;
              outputSummary += '## ✅ تم تعبئة أسعار السيناريوهات الثلاثة (المنافسة والتسعير)\n';
              outputSummary += `- أساسي استديو: ${cpData.baseStudioPrice} درهم/قدم²\n`;
              outputSummary += `- أساسي 1BR: ${cpData.base1brPrice} درهم/قدم²\n`;
              outputSummary += `- أساسي 2BR: ${cpData.base2brPrice} درهم/قدم²\n`;
              outputSummary += `- أساسي 3BR: ${cpData.base3brPrice} درهم/قدم²\n\n`;
              outputSummary += '## ✅ تم تعبئة خطة السداد\n';
              outputSummary += `- الحجز: ${cpData.paymentBookingPct}%\n`;
              outputSummary += `- البناء: ${cpData.paymentConstructionPct}%\n`;
              outputSummary += `- التسليم: ${cpData.paymentHandoverPct}%\n`;
              outputSummary += `- ما بعد التسليم: ${cpData.paymentDeferredPct}%\n\n`;
            }
          } catch (e) {
            outputSummary += '## ⚠️ لم يتم تعبئة الأسعار (خطأ في البيانات)\n\n';
          }
        }

        if (!stage6Data && !stage7Data) {
          outputSummary += '## ⚠️ لا توجد بيانات كافية لتعبئة الحقول\nيرجى تشغيل المحركات 6 و 7 أولاً.\n';
        }

        // Cross-validate with cost & cashflow data
        const factSheet = await getProjectFactSheet(db, projectId, ctx.user.id);
        if (factSheet.costData) {
          outputSummary += '\n## ✅ ربط بيانات التكلفة والتدفقات\n';
          outputSummary += `- سعر الأرض: ${factSheet.costData.landPrice?.toLocaleString() || 'غير محدد'} درهم\n`;
          outputSummary += `- تكلفة البناء/قدم²: ${factSheet.costData.constructionCostPerSqft || 'غير محدد'} درهم\n`;
          outputSummary += `- رسوم المطور: ${factSheet.costData.developerFeePct}%\n`;
          outputSummary += `- التسويق: ${factSheet.costData.marketingPct}%\n`;
          outputSummary += `- عمولة البيع: ${factSheet.costData.agentCommissionSalePct}%\n`;
          outputSummary += `- مدة المشروع: ${factSheet.costData.projectDurationMonths} شهر\n`;
          outputSummary += `- حصة كومو: ${factSheet.costData.comoProfitSharePct}%\n\n`;
          outputFields.costData = factSheet.costData;

          // Validate pricing vs cost consistency
          if (outputFields.pricing && factSheet.costData.constructionCostPerSqft > 0) {
            const basePrice = outputFields.pricing.base?.residential?.oneBr || outputFields.pricing.base?.residential?.studio || 0;
            const costPerSqft = factSheet.costData.constructionCostPerSqft;
            if (basePrice > 0 && basePrice < costPerSqft * 1.3) {
              outputSummary += '## ⚠️ تحذير: سعر البيع الأساسي قريب جداً من تكلفة البناء\n';
              outputSummary += `سعر البيع: ${basePrice} درهم/قدم² مقابل تكلفة البناء: ${costPerSqft} درهم/قدم²\n\n`;
            }
          }
        } else {
          outputSummary += '\n## ⚠️ لا توجد بيانات تكلفة وتدفقات\nيرجى تعبئة تبويب "التكاليف والتدفقات" في دراسة الجدوى لربط البيانات.\n\n';
        }

        await saveStageResult(db, ctx.user.id, projectId, 11, STAGES[10].nameAr, 'completed', outputSummary, JSON.stringify(outputFields));
        return { success: true, output: outputSummary, dataJson: JSON.stringify(outputFields) };
      } catch (error: any) {
        await saveStageResult(db, ctx.user.id, projectId, 11, STAGES[10].nameAr, 'error', '', null, error.message);
        throw new Error(`فشل في محرك توليد المخرجات: ${error.message}`);
      }
    }),

  // ═══════════════════════════════════════════════════════════════
  // ENGINE 12: REPORT GENERATION
  // 7 professional reports
  // ═══════════════════════════════════════════════════════════════
  runEngine12: publicProcedure
    .input(z.number())
    .mutation(async ({ ctx, input: projectId }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await saveStageResult(db, ctx.user.id, projectId, 12, STAGES[11].nameAr, 'running', '', null);

      try {
        const factSheet = await getProjectFactSheet(db, projectId, ctx.user.id);

        // Collect ALL stage outputs
        const prevStages = await db.select().from(joelleAnalysisStages)
          .where(and(
            eq(joelleAnalysisStages.userId, ctx.user.id),
            eq(joelleAnalysisStages.projectId, projectId),
          ))
          .orderBy(joelleAnalysisStages.stageNumber);

        const stageOutputs = prevStages
          .filter(s => s.stageNumber <= 11 && s.stageOutput)
          .map(s => `### محرك ${s.stageNumber}: ${s.stageName}\n${s.stageOutput?.substring(0, 2000)}`)
          .join('\n\n---\n\n');

        // Generate all 7 reports
        const reportPrompts: { type: string; title: string; prompt: string }[] = [
          {
            type: 'market_intelligence',
            title: `تقرير الاستخبارات السوقية — ${factSheet.project.name}`,
            prompt: `اكتبي تقرير الاستخبارات السوقية الشامل (Market Intelligence Report) لمشروع "${factSheet.project.name}" في "${factSheet.community}". يتضمن: السياق الاقتصادي الكلي، تحليل المنطقة، هيكل السوق، اتجاهات الأسعار، العرض والطلب. التقرير 2000-3000 كلمة بالعربية بأسلوب JLL/Colliers.`,
          },
          {
            type: 'competitive_analysis',
            title: `تقرير التحليل التنافسي — ${factSheet.project.name}`,
            prompt: `اكتبي تقرير التحليل التنافسي (Competitive Analysis Report) لمشروع "${factSheet.project.name}". يتضمن: خريطة المنافسين (1/2/3 كم)، مقارنة المنتجات، مقارنة الأسعار، خطط السداد، سرعة البيع، نقاط القوة والضعف. 2000-3000 كلمة.`,
          },
          {
            type: 'product_strategy',
            title: `تقرير استراتيجية المنتج — ${factSheet.project.name}`,
            prompt: `اكتبي تقرير استراتيجية المنتج (Product Strategy Report) لمشروع "${factSheet.project.name}". يتضمن: توزيع الوحدات الموصى، المساحات، المزيج التجاري، التموضع، جودة التشطيب، المرافق، مقارنة مع المطورين الكبار. 1500-2500 كلمة.`,
          },
          {
            type: 'pricing_strategy',
            title: `تقرير استراتيجية التسعير — ${factSheet.project.name}`,
            prompt: `اكتبي تقرير استراتيجية التسعير (Pricing Strategy Report) لمشروع "${factSheet.project.name}". يتضمن: منهجية التسعير، أسعار المصادر والأوزان، 3 سيناريوهات، خطة السداد، تحليل الحساسية، التوصية النهائية. 2000-3000 كلمة.`,
          },
          {
            type: 'demand_forecast',
            title: `تقرير توقعات الطلب — ${factSheet.project.name}`,
            prompt: `اكتبي تقرير توقعات الطلب (Demand Forecast Report) لمشروع "${factSheet.project.name}". يتضمن: حجم الطلب السنوي، توزيع الطلب، سيناريوهات الحصة السوقية، سرعة المبيعات، جدول المبيعات، عوامل الطلب. 1500-2500 كلمة.`,
          },
          {
            type: 'risk_analysis',
            title: `تقرير تحليل المخاطر — ${factSheet.project.name}`,
            prompt: `اكتبي تقرير تحليل المخاطر (Risk Analysis Report) لمشروع "${factSheet.project.name}". يتضمن: 5 فئات مخاطر (Supply Pipeline, Pricing Sensitivity, Demand Volatility, Competitive Saturation, Developer Positioning)، مؤشر المخاطر الإجمالي، استراتيجيات التخفيف. 1500-2500 كلمة.`,
          },
          {
            type: 'executive_summary',
            title: `ملخص مجلس الإدارة — ${factSheet.project.name}`,
            prompt: `اكتبي الملخص التنفيذي لمجلس الإدارة (Executive Board Summary) لمشروع "${factSheet.project.name}". يتضمن: ملخص المشروع، أهم الأرقام، التوصية الرئيسية، المخاطر الرئيسية، الجدول الزمني، القرار المطلوب. صفحة واحدة (500-800 كلمة) مختصرة وفعالة.`,
          },
        ];

        const results: { type: string; title: string; success: boolean }[] = [];

        // Generate reports sequentially to avoid rate limits
        for (const rp of reportPrompts) {
          try {
            const response = await invokeLLMWithRetry({
              messages: [
                {
                  role: "system",
                  content: `أنتِ جويل، محللة السوق العقاري في Como Developments. التاريخ: ${reportDate} (عام ${currentYear}). تكتبين تقارير مهنية بمستوى JLL/Colliers. استخدمي جداول Markdown. كل رقم مع مصدره.`,
                },
                {
                  role: "user",
                  content: `${rp.prompt}\n\nبيانات التحليل المتراكمة من المحركات السابقة:\n${stageOutputs}`,
                },
              ],
            });

            const content = response.choices[0]?.message?.content || "لم يتم إنشاء التقرير";
            await saveReport(db, ctx.user.id, projectId, rp.type, rp.title, content);
            results.push({ type: rp.type, title: rp.title, success: true });
          } catch (e: any) {
            results.push({ type: rp.type, title: rp.title, success: false });
            console.error(`Error generating report ${rp.type}:`, e.message);
          }
        }

        const outputSummary = `# محرك 12: توليد التقارير

## التقارير المُنشأة
${results.map(r => `- ${r.success ? '✅' : '❌'} ${r.title}`).join('\n')}

## الملخص
- تم إنشاء ${results.filter(r => r.success).length} من ${results.length} تقارير
- التقارير متاحة في تبويب "تقارير جويل"
`;

        await saveStageResult(db, ctx.user.id, projectId, 12, STAGES[11].nameAr, 'completed', outputSummary, JSON.stringify(results));
        return { success: true, output: outputSummary, results };
      } catch (error: any) {
        await saveStageResult(db, ctx.user.id, projectId, 12, STAGES[11].nameAr, 'error', '', null, error.message);
        throw new Error(`فشل في محرك التقارير: ${error.message}`);
      }
    }),

  // ═══════════════════════════════════════════════════════════════
  // RUN ALL ENGINES SEQUENTIALLY
  // ═══════════════════════════════════════════════════════════════
  runAllEngines: publicProcedure
    .input(z.number())
    .mutation(async ({ ctx, input: projectId }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      // This just returns the stage list - the frontend will call each engine one by one
      return {
        stages: STAGES,
        message: 'استخدم الواجهة لتشغيل كل محرك بالترتيب',
      };
    }),

  // Get stage definitions
  getStageDefinitions: publicProcedure
    .query(() => {
      return STAGES;
    }),

  // Get report type definitions
  getReportTypes: publicProcedure
    .query(() => {
      return REPORT_TYPES.map(type => ({
        type,
        titleAr: {
          market_intelligence: 'تقرير الاستخبارات السوقية',
          competitive_analysis: 'تقرير التحليل التنافسي',
          product_strategy: 'تقرير استراتيجية المنتج',
          pricing_strategy: 'تقرير استراتيجية التسعير',
          demand_forecast: 'تقرير توقعات الطلب',
          risk_analysis: 'تقرير تحليل المخاطر',
          executive_summary: 'ملخص مجلس الإدارة',
        }[type] || type,
      }));
    }),

  // ═══════════════════════════════════════════════════════════════
  // APPLY JOELLE ENGINE OUTPUTS TO FEASIBILITY FIELDS
  // Reads Engine 6 (Product Strategy) → MarketOverview
  // Reads Engine 7 (Pricing Intelligence) → CompetitionPricing
  // ═══════════════════════════════════════════════════════════════
  applyJoelleOutputs: publicProcedure
    .input(z.number()) // projectId
    .mutation(async ({ ctx, input: projectId }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Fetch completed stages for this project
      const stages = await db.select().from(joelleAnalysisStages)
        .where(and(
          eq(joelleAnalysisStages.userId, ctx.user.id),
          eq(joelleAnalysisStages.projectId, projectId),
        ))
        .orderBy(joelleAnalysisStages.stageNumber);

      const stage6 = stages.find(s => s.stageNumber === 6 && s.stageStatus === 'completed');
      const stage7 = stages.find(s => s.stageNumber === 7 && s.stageStatus === 'completed');

      const results: { marketOverview: boolean; competitionPricing: boolean; details: string[] } = {
        marketOverview: false,
        competitionPricing: false,
        details: [],
      };

      // ─── Apply Engine 6 (Product Strategy) → MarketOverview ───
      if (stage6?.stageDataJson) {
        try {
          const data = JSON.parse(stage6.stageDataJson);
          const unitMix = data.unitMix || {};
          const retailMix = data.retailMix || {};

          const moData: any = {
            residentialStudioPct: String(unitMix.studio?.pct ?? 0),
            residentialStudioAvgArea: Math.round(unitMix.studio?.avgSize ?? 0),
            residential1brPct: String(unitMix.oneBr?.pct ?? 0),
            residential1brAvgArea: Math.round(unitMix.oneBr?.avgSize ?? 0),
            residential2brPct: String(unitMix.twoBr?.pct ?? 0),
            residential2brAvgArea: Math.round(unitMix.twoBr?.avgSize ?? 0),
            residential3brPct: String(unitMix.threeBr?.pct ?? 0),
            residential3brAvgArea: Math.round(unitMix.threeBr?.avgSize ?? 0),
            retailSmallPct: String(retailMix.small?.pct ?? 0),
            retailSmallAvgArea: Math.round(retailMix.small?.avgSize ?? 0),
            retailMediumPct: String(retailMix.medium?.pct ?? 0),
            retailMediumAvgArea: Math.round(retailMix.medium?.avgSize ?? 0),
            retailLargePct: String(retailMix.large?.pct ?? 0),
            retailLargeAvgArea: Math.round(retailMix.large?.avgSize ?? 0),
            finishingQuality: data.finishingQuality || 'ممتاز',
            aiRecommendationsJson: stage6.stageDataJson,
            aiReportGeneratedAt: new Date(),
          };

          // Upsert into marketOverview
          const existing = await db.select().from(marketOverview)
            .where(and(
              eq(marketOverview.projectId, projectId),
              eq(marketOverview.userId, ctx.user.id)
            ));

          if (existing[0]) {
            await db.update(marketOverview).set(moData).where(eq(marketOverview.id, existing[0].id));
          } else {
            await db.insert(marketOverview).values({
              userId: ctx.user.id,
              projectId,
              ...moData,
            });
          }
          results.marketOverview = true;
          results.details.push(`تم تطبيق استراتيجية المنتج (محرك 6): Studio ${unitMix.studio?.pct}%, 1BR ${unitMix.oneBr?.pct}%, 2BR ${unitMix.twoBr?.pct}%, 3BR ${unitMix.threeBr?.pct}%`);
        } catch (e: any) {
          results.details.push(`خطأ في تطبيق محرك 6: ${e.message}`);
        }
      } else {
        results.details.push('محرك 6 (استراتيجية المنتج) لم يكتمل بعد — لم يتم تحديث توزيع الوحدات');
      }

      // ─── Apply Engine 7 (Pricing Intelligence) → CompetitionPricing ───
      if (stage7?.stageDataJson) {
        try {
          const data = JSON.parse(stage7.stageDataJson);
          const scenarios = data.scenarios || {};
          const paymentPlan = data.paymentPlan || {};

          const opt = scenarios.optimistic?.residential || {};
          const optRet = scenarios.optimistic?.retail || {};
          const optOff = scenarios.optimistic?.offices || {};
          const base = scenarios.base?.residential || {};
          const baseRet = scenarios.base?.retail || {};
          const baseOff = scenarios.base?.offices || {};
          const cons = scenarios.conservative?.residential || {};
          const consRet = scenarios.conservative?.retail || {};
          const consOff = scenarios.conservative?.offices || {};

          const cpData: any = {
            optStudioPrice: Math.round(opt.studio ?? 0),
            opt1brPrice: Math.round(opt.oneBr ?? 0),
            opt2brPrice: Math.round(opt.twoBr ?? 0),
            opt3brPrice: Math.round(opt.threeBr ?? 0),
            optRetailSmallPrice: Math.round(optRet.small ?? 0),
            optRetailMediumPrice: Math.round(optRet.medium ?? 0),
            optRetailLargePrice: Math.round(optRet.large ?? 0),
            optOfficeSmallPrice: Math.round(optOff.small ?? 0),
            optOfficeMediumPrice: Math.round(optOff.medium ?? 0),
            optOfficeLargePrice: Math.round(optOff.large ?? 0),
            baseStudioPrice: Math.round(base.studio ?? 0),
            base1brPrice: Math.round(base.oneBr ?? 0),
            base2brPrice: Math.round(base.twoBr ?? 0),
            base3brPrice: Math.round(base.threeBr ?? 0),
            baseRetailSmallPrice: Math.round(baseRet.small ?? 0),
            baseRetailMediumPrice: Math.round(baseRet.medium ?? 0),
            baseRetailLargePrice: Math.round(baseRet.large ?? 0),
            baseOfficeSmallPrice: Math.round(baseOff.small ?? 0),
            baseOfficeMediumPrice: Math.round(baseOff.medium ?? 0),
            baseOfficeLargePrice: Math.round(baseOff.large ?? 0),
            consStudioPrice: Math.round(cons.studio ?? 0),
            cons1brPrice: Math.round(cons.oneBr ?? 0),
            cons2brPrice: Math.round(cons.twoBr ?? 0),
            cons3brPrice: Math.round(cons.threeBr ?? 0),
            consRetailSmallPrice: Math.round(consRet.small ?? 0),
            consRetailMediumPrice: Math.round(consRet.medium ?? 0),
            consRetailLargePrice: Math.round(consRet.large ?? 0),
            consOfficeSmallPrice: Math.round(consOff.small ?? 0),
            consOfficeMediumPrice: Math.round(consOff.medium ?? 0),
            consOfficeLargePrice: Math.round(consOff.large ?? 0),
            paymentBookingPct: String(paymentPlan.booking?.pct ?? 10),
            paymentBookingTiming: paymentPlan.booking?.timing || 'عند التوقيع',
            paymentConstructionPct: String(paymentPlan.construction?.pct ?? 60),
            paymentConstructionTiming: paymentPlan.construction?.timing || 'أثناء الإنشاء',
            paymentHandoverPct: String(paymentPlan.handover?.pct ?? 30),
            paymentHandoverTiming: paymentPlan.handover?.timing || 'عند التسليم',
            paymentDeferredPct: String(paymentPlan.deferred?.pct ?? 0),
            paymentDeferredTiming: paymentPlan.deferred?.timing || '',
            activeScenario: 'base',
            aiRecommendationsJson: stage7.stageDataJson,
            aiReportGeneratedAt: new Date(),
          };

          // Upsert into competitionPricing
          const existing = await db.select().from(competitionPricing)
            .where(and(
              eq(competitionPricing.projectId, projectId),
              eq(competitionPricing.userId, ctx.user.id)
            ));

          if (existing[0]) {
            await db.update(competitionPricing).set(cpData).where(eq(competitionPricing.id, existing[0].id));
          } else {
            await db.insert(competitionPricing).values({
              userId: ctx.user.id,
              projectId,
              ...cpData,
            });
          }
          results.competitionPricing = true;
          results.details.push(`تم تطبيق ذكاء التسعير (محرك 7): Base Studio ${base.studio}, 1BR ${base.oneBr}, 2BR ${base.twoBr}, 3BR ${base.threeBr}`);
        } catch (e: any) {
          results.details.push(`خطأ في تطبيق محرك 7: ${e.message}`);
        }
      } else {
        results.details.push('محرك 7 (ذكاء التسعير) لم يكتمل بعد — لم يتم تحديث الأسعار');
      }

      return results;
    }),

  // ═══════════════════════════════════════════════════════════════
  // GET JOELLE ENGINE DATA STATUS FOR AUTO-POPULATE UI
  // Returns which engines have completed and what data is available
  // ═══════════════════════════════════════════════════════════════
  getAutoPopulateStatus: publicProcedure
    .input(z.number()) // projectId
    .query(async ({ ctx, input: projectId }) => {
      if (!ctx.user) return { engine6Ready: false, engine7Ready: false, lastApplied: null };
      const db = await getDb();
      if (!db) return { engine6Ready: false, engine7Ready: false, lastApplied: null };

      const stages = await db.select().from(joelleAnalysisStages)
        .where(and(
          eq(joelleAnalysisStages.userId, ctx.user.id),
          eq(joelleAnalysisStages.projectId, projectId),
        ))
        .orderBy(joelleAnalysisStages.stageNumber);

      const stage6 = stages.find(s => s.stageNumber === 6 && s.stageStatus === 'completed');
      const stage7 = stages.find(s => s.stageNumber === 7 && s.stageStatus === 'completed');

      // Check if already applied (aiRecommendationsJson is set)
      const moResults = await db.select().from(marketOverview)
        .where(and(
          eq(marketOverview.projectId, projectId),
          eq(marketOverview.userId, ctx.user.id)
        ));
      const cpResults = await db.select().from(competitionPricing)
        .where(and(
          eq(competitionPricing.projectId, projectId),
          eq(competitionPricing.userId, ctx.user.id)
        ));

      let engine6Summary = null;
      if (stage6?.stageDataJson) {
        try {
          const d = JSON.parse(stage6.stageDataJson);
          engine6Summary = {
            totalUnits: d.totalUnits,
            positioning: d.positioning,
            unitMix: d.unitMix,
          };
        } catch {}
      }

      let engine7Summary = null;
      if (stage7?.stageDataJson) {
        try {
          const d = JSON.parse(stage7.stageDataJson);
          engine7Summary = {
            baseScenario: d.scenarios?.base?.residential,
            weightedAvgPrice: d.weightedAvgPrice,
          };
        } catch {}
      }

      return {
        engine6Ready: !!stage6?.stageDataJson,
        engine7Ready: !!stage7?.stageDataJson,
        engine6CompletedAt: stage6?.completedAt || null,
        engine7CompletedAt: stage7?.completedAt || null,
        engine6Summary,
        engine7Summary,
        moHasJoelleData: !!moResults[0]?.aiRecommendationsJson,
        cpHasJoelleData: !!cpResults[0]?.aiRecommendationsJson,
      };
    }),
});
