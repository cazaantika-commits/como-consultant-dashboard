import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { 
  createProposal, 
  getProposals, 
  getProposalById,
  updateProposalAnalysis,
  createComparison,
  getComparisons,
  getComparisonById
} from "../db";
import { storagePut } from "../storage";
import { invokeLLM } from "../_core/llm";

// ═══════════════════════════════════════════════════
// Stage 1: Pre-Processing Agent — تصفية الصفحات قبل التحليل
// ═══════════════════════════════════════════════════

// Keywords that indicate relevant pages (financial/contractual/scope)
const RELEVANT_KEYWORDS_EN = [
  'fee', 'fees', 'payment', 'schedule', 'terms', 'conditions', 'exclusion',
  'scope', 'deliverable', 'proposal', 'aed', 'usd', 'eur', 'lump sum',
  'milestone', 'retainer', 'supervision', 'additional', 'insurance',
  'liability', 'termination', 'duration', 'timeline', 'phase',
  'design', 'construction', 'rera', 'dld', 'noc', 'permit',
  'consultant', 'sub-consultant', 'man-month', 'hourly rate',
  'reimbursable', 'variation', 'amendment', 'penalty', 'delay',
  'professional', 'indemnity', 'arbitration', 'jurisdiction',
  'copyright', 'intellectual property', 'confidential',
  'total', 'amount', 'price', 'cost', 'budget', 'estimate',
  'vat', 'tax', 'invoice', 'billing',
];

const RELEVANT_KEYWORDS_AR = [
  'أتعاب', 'رسوم', 'دفع', 'جدول', 'شروط', 'استثناء', 'نطاق',
  'مخرجات', 'عرض', 'درهم', 'دولار', 'مبلغ مقطوع', 'مرحلة',
  'إشراف', 'إضافي', 'تأمين', 'مسؤولية', 'إنهاء', 'مدة',
  'تصميم', 'بناء', 'ريرا', 'تسليم', 'استشاري', 'ساعة',
  'تعويض', 'تعديل', 'غرامة', 'تأخير', 'إجمالي', 'سعر',
  'تكلفة', 'ميزانية', 'ضريبة', 'فاتورة',
];

// Keywords that indicate promotional/portfolio pages (to skip)
const SKIP_KEYWORDS = [
  'our projects', 'portfolio', 'our team', 'about us', 'company profile',
  'established in', 'years of experience', 'our clients', 'testimonial',
  'award', 'certificate', 'iso', 'accreditation', 'our vision',
  'our mission', 'core values', 'organizational chart',
  'مشاريعنا', 'فريقنا', 'من نحن', 'ملف الشركة', 'عملاؤنا',
  'شهادة', 'جائزة', 'رؤيتنا', 'رسالتنا', 'الهيكل التنظيمي',
];

interface PageClassification {
  pageIndex: number;
  category: 'financial' | 'contractual' | 'scope' | 'technical' | 'promotional' | 'cv' | 'cover';
  relevanceScore: number;
  hasNumbers: boolean;
  snippet: string;
}

function classifyPage(pageText: string, pageIndex: number): PageClassification {
  const textLower = pageText.toLowerCase();
  const textTrimmed = pageText.trim();
  
  // Check if page has meaningful content
  if (textTrimmed.length < 50) {
    return { pageIndex, category: 'cover', relevanceScore: 0, hasNumbers: false, snippet: textTrimmed.substring(0, 100) };
  }
  
  // Count relevant keywords
  let financialScore = 0;
  let contractualScore = 0;
  let scopeScore = 0;
  let promotionalScore = 0;
  
  // Check for numbers/currency (strong financial indicator)
  const hasNumbers = /(?:aed|usd|eur|درهم|دولار|\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+%)/i.test(pageText);
  const hasCurrencyAmounts = /(?:aed|usd|eur|درهم)\s*[\d,.]+|[\d,.]+\s*(?:aed|usd|eur|درهم)/i.test(pageText);
  
  // Financial keywords
  for (const kw of [...RELEVANT_KEYWORDS_EN.slice(0, 15), ...RELEVANT_KEYWORDS_AR.slice(0, 10)]) {
    if (textLower.includes(kw.toLowerCase())) financialScore++;
  }
  
  // Contractual keywords
  for (const kw of [...RELEVANT_KEYWORDS_EN.slice(15, 30), ...RELEVANT_KEYWORDS_AR.slice(10, 20)]) {
    if (textLower.includes(kw.toLowerCase())) contractualScore++;
  }
  
  // Scope keywords
  for (const kw of [...RELEVANT_KEYWORDS_EN.slice(5, 12), ...RELEVANT_KEYWORDS_AR.slice(5, 12)]) {
    if (textLower.includes(kw.toLowerCase())) scopeScore++;
  }
  
  // Promotional/skip keywords
  for (const kw of SKIP_KEYWORDS) {
    if (textLower.includes(kw.toLowerCase())) promotionalScore++;
  }
  
  // CV detection
  const cvIndicators = ['curriculum vitae', 'cv', 'education', 'qualification', 'experience', 'السيرة الذاتية', 'المؤهلات', 'الخبرات'];
  let cvScore = 0;
  for (const kw of cvIndicators) {
    if (textLower.includes(kw.toLowerCase())) cvScore++;
  }
  
  // Determine category
  if (hasCurrencyAmounts || financialScore >= 3) {
    return { pageIndex, category: 'financial', relevanceScore: financialScore + (hasCurrencyAmounts ? 5 : 0), hasNumbers: true, snippet: textTrimmed.substring(0, 150) };
  }
  if (contractualScore >= 2) {
    return { pageIndex, category: 'contractual', relevanceScore: contractualScore, hasNumbers, snippet: textTrimmed.substring(0, 150) };
  }
  if (scopeScore >= 2) {
    return { pageIndex, category: 'scope', relevanceScore: scopeScore, hasNumbers, snippet: textTrimmed.substring(0, 150) };
  }
  if (cvScore >= 2) {
    return { pageIndex, category: 'cv', relevanceScore: 0, hasNumbers: false, snippet: textTrimmed.substring(0, 150) };
  }
  if (promotionalScore >= 2) {
    return { pageIndex, category: 'promotional', relevanceScore: 0, hasNumbers: false, snippet: textTrimmed.substring(0, 150) };
  }
  
  // Default: if page has numbers, likely technical; otherwise promotional
  if (hasNumbers) {
    return { pageIndex, category: 'technical', relevanceScore: 1, hasNumbers: true, snippet: textTrimmed.substring(0, 150) };
  }
  
  return { pageIndex, category: 'promotional', relevanceScore: 0, hasNumbers: false, snippet: textTrimmed.substring(0, 150) };
}

function preprocessPages(fullText: string): {
  filteredText: string;
  totalPages: number;
  relevantPages: number;
  skippedPages: number;
  classifications: PageClassification[];
  savingsPercent: number;
} {
  // Split by common page separators or by large gaps
  // PDF.js typically separates pages with multiple newlines
  const pages = fullText.split(/\n{3,}|\f/).filter(p => p.trim().length > 20);
  
  if (pages.length <= 6) {
    // Small document — send everything
    return {
      filteredText: fullText,
      totalPages: pages.length,
      relevantPages: pages.length,
      skippedPages: 0,
      classifications: pages.map((p, i) => classifyPage(p, i)),
      savingsPercent: 0,
    };
  }
  
  const classifications = pages.map((page, idx) => classifyPage(page, idx));
  
  // Keep: financial, contractual, scope, technical (with numbers)
  // Skip: promotional, cv, cover (unless it's the first page)
  const relevantPages: string[] = [];
  const relevantClassifications: PageClassification[] = [];
  
  classifications.forEach((cls, idx) => {
    const isRelevant = 
      cls.category === 'financial' ||
      cls.category === 'contractual' ||
      cls.category === 'scope' ||
      (cls.category === 'technical' && cls.hasNumbers) ||
      idx === 0; // Always keep first page (usually has consultant name/project)
    
    if (isRelevant) {
      relevantPages.push(pages[idx]);
      relevantClassifications.push(cls);
    }
  });
  
  const filteredText = relevantPages.join('\n\n---\n\n');
  const skippedCount = pages.length - relevantPages.length;
  const savingsPercent = Math.round((skippedCount / pages.length) * 100);
  
  return {
    filteredText,
    totalPages: pages.length,
    relevantPages: relevantPages.length,
    skippedPages: skippedCount,
    classifications,
    savingsPercent,
  };
}

// ═══════════════════════════════════════════════════
// Stage 2: AI Analysis with Smart Warnings
// ═══════════════════════════════════════════════════

async function analyzeProposalWithAI(extractedText: string, proposalTitle: string) {
  try {
    const prompt = `أنت محلل خبير في عروض الاستشاريين الهندسيين في قطاع التطوير العقاري في الإمارات. حلل العرض التالي بشكل شامل ومحايد واستخرج كل التفاصيل المهمة.

عنوان العرض: ${proposalTitle}

محتوى العرض:
${extractedText.substring(0, 25000)} 

استخرج المعلومات التالية بدقة وحيادية. إذا لم تجد معلومة معينة في العرض، اكتب "غير مذكور في العرض".

أجب بصيغة JSON فقط:
{
  "summary": "ملخص شامل للعرض في 3-5 جمل",
  "keyPoints": ["النقاط الرئيسية في العرض"],
  "strengths": ["نقاط القوة"],
  "weaknesses": ["نقاط الضعف والثغرات"],
  "recommendation": "التوصية النهائية",
  "score": 85,
  "financialSummary": {
    "totalFees": "إجمالي الأتعاب بالأرقام (مثال: 7856068)",
    "totalFeesFormatted": "إجمالي الأتعاب منسق (مثال: 7,856,068 AED)",
    "currency": "AED أو USD أو EUR",
    "feeType": "مبلغ مقطوع / نسبة مئوية / man-month / مختلط",
    "vatIncluded": false,
    "supervisionFees": "أتعاب الإشراف إن ذُكرت (رقم أو غير محدد)",
    "supervisionType": "مشمول في الأتعاب / منفصل / غير مشمول / man-month",
    "optionalItems": [{"item": "وصف البند الاختياري", "amount": "المبلغ"}],
    "priceValidity": "مدة صلاحية الأسعار"
  },
  "warnings": [
    {
      "level": "high",
      "category": "financial",
      "title": "عنوان التحذير",
      "detail": "تفصيل التحذير",
      "impact": "الأثر المحتمل"
    }
  ],
  "scope": {
    "items": ["قائمة تفصيلية بكل الأعمال المشمولة في العرض"],
    "phases": ["مراحل العمل إن وجدت"],
    "notes": "ملاحظات إضافية عن نطاق الأعمال"
  },
  "exclusions": {
    "items": ["قائمة بكل الأعمال المستثناة وغير المشمولة"],
    "risks": ["المخاطر المترتبة على هذه الاستثناءات"],
    "count": 0,
    "notes": "ملاحظات عن الاستثناءات"
  },
  "additionalWorks": {
    "items": [{"work": "وصف العمل الإضافي", "cost": "التكلفة إن ذُكرت", "condition": "شرط تطبيقه"}],
    "notes": "ملاحظات عن الأعمال الإضافية"
  },
  "supervisionTerms": {
    "included": true,
    "type": "نسبة مئوية / مبلغ مقطوع / man-month / غير مشمول",
    "value": "القيمة أو النسبة",
    "scope": "نطاق أعمال الإشراف المشمولة",
    "duration": "مدة الإشراف",
    "team": "فريق الإشراف المقترح",
    "notes": "ملاحظات عن الإشراف"
  },
  "timeline": {
    "totalDuration": "المدة الإجمالية",
    "phases": [{"phase": "اسم المرحلة", "duration": "المدة", "deliverables": "المخرجات"}],
    "notes": "ملاحظات عن الجدول الزمني"
  },
  "paymentTerms": {
    "method": "طريقة الدفع (أقساط/مراحل/شهري)",
    "schedule": [{"milestone": "المرحلة", "percentage": "النسبة", "condition": "الشرط"}],
    "retainer": "دفعة مقدمة إن وجدت",
    "notes": "ملاحظات عن شروط الدفع"
  },
  "conditions": {
    "general": ["الشروط العامة"],
    "special": ["الشروط الخاصة أو غير المعتادة"],
    "termination": "شروط الإنهاء",
    "liability": "حدود المسؤولية",
    "insurance": "التأمين المطلوب",
    "notes": "ملاحظات عن الشروط"
  },
  "teamComposition": {
    "members": [{"role": "الدور", "name": "الاسم إن ذُكر", "experience": "الخبرة"}],
    "totalSize": "حجم الفريق",
    "subConsultants": [{"name": "اسم الاستشاري الفرعي", "discipline": "التخصص"}],
    "notes": "ملاحظات عن الفريق"
  },
  "deliverables": {
    "items": [{"deliverable": "المخرج", "format": "الصيغة", "copies": "عدد النسخ"}],
    "notes": "ملاحظات عن المخرجات"
  }
}

تحذيرات مهمة يجب رصدها:
- إشراف غير محدد الإجمالي (man-month بدون سقف)
- استثناءات كثيرة (أكثر من 10)
- أعمال إضافية بأسعار غير محددة
- مصاريف قابلة للتعويض (reimbursable) مفتوحة
- صلاحية أسعار قصيرة
- عدم وجود تأمين مهني
- شروط إنهاء غير عادلة
- حدود مسؤولية منخفضة
- LOD منخفض (أقل من 350)
- عدم شمول BIM أو LEED إن كان مطلوباً

مستويات التحذير:
- high: خطر مالي مباشر أو ثغرة تعاقدية كبيرة
- medium: نقطة تحتاج توضيح أو تفاوض
- low: ملاحظة للمعلومية`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: "أنت محلل خبير ومحايد في عروض الاستشاريين الهندسيين في الإمارات. مهمتك استخراج كل التفاصيل بدقة وحيادية بدون تحيز لأي طرف. أجب دائماً بصيغة JSON صحيحة فقط بدون أي نص إضافي." },
        { role: "user", content: prompt }
      ],
    });

    const content = response.choices[0]?.message?.content || "{}";
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in AI response");
    }
    
    const analysis = JSON.parse(jsonMatch[0]);
    
    return {
      aiSummary: analysis.summary || "",
      aiKeyPoints: analysis.keyPoints || [],
      aiStrengths: analysis.strengths || [],
      aiWeaknesses: analysis.weaknesses || [],
      aiRecommendation: analysis.recommendation || "",
      aiScore: analysis.score || 0,
      aiFinancialSummary: analysis.financialSummary || null,
      aiWarnings: analysis.warnings || [],
      aiScope: analysis.scope || null,
      aiExclusions: analysis.exclusions || null,
      aiAdditionalWorks: analysis.additionalWorks || null,
      aiSupervisionTerms: analysis.supervisionTerms || null,
      aiTimeline: analysis.timeline || null,
      aiPaymentTerms: analysis.paymentTerms || null,
      aiConditions: analysis.conditions || null,
      aiTeamComposition: analysis.teamComposition || null,
      aiDeliverables: analysis.deliverables || null,
    };
  } catch (error) {
    console.error("Error analyzing proposal with AI:", error);
    throw error;
  }
}

// Comprehensive comparison - compares proposals item by item
async function compareProposalsWithAI(proposals: any[]) {
  try {
    const proposalsText = proposals.map((p, idx) => {
      const scope = p.aiScope ? JSON.stringify(p.aiScope) : "غير متوفر";
      const exclusions = p.aiExclusions ? JSON.stringify(p.aiExclusions) : "غير متوفر";
      const supervision = p.aiSupervisionTerms ? JSON.stringify(p.aiSupervisionTerms) : "غير متوفر";
      const additional = p.aiAdditionalWorks ? JSON.stringify(p.aiAdditionalWorks) : "غير متوفر";
      const conditions = p.aiConditions ? JSON.stringify(p.aiConditions) : "غير متوفر";
      const timeline = p.aiTimeline ? JSON.stringify(p.aiTimeline) : "غير متوفر";
      const payment = p.aiPaymentTerms ? JSON.stringify(p.aiPaymentTerms) : "غير متوفر";
      const deliverables = p.aiDeliverables ? JSON.stringify(p.aiDeliverables) : "غير متوفر";
      const financial = p.aiFinancialSummary ? JSON.stringify(p.aiFinancialSummary) : "غير متوفر";
      
      return `=== العرض ${idx + 1}: ${p.title} (استشاري ${idx+1}) ===
الملخص: ${p.aiSummary || 'غير متوفر'}
التقييم: ${p.aiScore || 0}/100
الملخص المالي: ${financial}
نطاق الأعمال: ${scope}
الاستثناءات: ${exclusions}
الإشراف: ${supervision}
الأعمال الإضافية: ${additional}
الشروط: ${conditions}
الجدول الزمني: ${timeline}
شروط الدفع: ${payment}
المخرجات: ${deliverables}`;
    }).join('\n\n---\n\n');

    const prompt = `أنت محلل محايد. قارن بين العروض التالية بند ببند بشكل حيادي وشامل:

${proposalsText}

قدم مقارنة تفصيلية تشمل:
1. مقارنة نطاق الأعمال — ما يشمله كل عرض وما لا يشمله
2. مقارنة الاستثناءات — أي استشاري استثنى أعمالاً يشملها الآخرون
3. مقارنة الإشراف — هل الإشراف مشمول؟ بأي شروط؟
4. مقارنة الأعمال الإضافية — ما يعتبره كل استشاري إضافياً
5. مقارنة الشروط — أي شروط غير معتادة أو مختلفة
6. مقارنة الجدول الزمني — المدد والمراحل
7. مقارنة شروط الدفع
8. مقارنة مالية — الأتعاب والإشراف والبنود الاختيارية
9. ملاحظات مهمة وتحذيرات

أجب بصيغة JSON:
{
  "scopeComparison": {"summary": "ملخص مقارنة النطاق", "details": [{"aspect": "الجانب", "findings": [{"consultant": "اسم", "status": "مشمول/غير مشمول/جزئي", "detail": "التفصيل"}]}]},
  "exclusionsComparison": {"summary": "ملخص", "highlights": ["نقاط مهمة عن الاستثناءات"]},
  "supervisionComparison": {"summary": "ملخص", "details": [{"consultant": "اسم", "included": true, "terms": "الشروط"}]},
  "additionalWorksComparison": {"summary": "ملخص", "highlights": ["نقاط مهمة"]},
  "conditionsComparison": {"summary": "ملخص", "unusualTerms": [{"consultant": "اسم", "term": "الشرط غير المعتاد"}]},
  "timelineComparison": {"summary": "ملخص"},
  "paymentComparison": {"summary": "ملخص"},
  "financialComparison": {
    "summary": "ملخص المقارنة المالية",
    "matrix": [{"aspect": "البند", "values": [{"consultant": "اسم", "value": "القيمة", "status": "أفضل/أسوأ/متوسط"}]}]
  },
  "warnings": ["تحذيرات مهمة يجب الانتباه لها"],
  "overallSummary": "ملخص شامل للمقارنة",
  "recommendation": "التوصية النهائية مع التبرير",
  "bestProposalIndex": 0
}`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: "أنت محلل محايد وخبير في مقارنة عروض الاستشاريين الهندسيين. مهمتك المقارنة الحيادية بند ببند بدون تحيز. أجب بصيغة JSON فقط." },
        { role: "user", content: prompt }
      ],
    });

    const content = response.choices[0]?.message?.content || "{}";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in AI response");
    }
    
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("Error comparing proposals with AI:", error);
    throw error;
  }
}

// Helper to parse JSON fields safely
function parseJsonField(field: string | null): any {
  if (!field) return null;
  try { return JSON.parse(field); } catch { return null; }
}

export const proposalsRouter = router({
  // Upload a new proposal
  upload: protectedProcedure
    .input(z.object({
      consultantId: z.number().optional(),
      projectId: z.number().optional(),
      title: z.string(),
      fileData: z.string(), // base64 encoded file
      fileName: z.string(),
      mimeType: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const fileBuffer = Buffer.from(input.fileData, 'base64');
      const fileKey = `proposals/${ctx.user.id}/${Date.now()}-${input.fileName}`;
      
      const { url } = await storagePut(fileKey, fileBuffer, input.mimeType);
      
      const result = await createProposal({
        userId: ctx.user.id,
        consultantId: input.consultantId,
        projectId: input.projectId,
        title: input.title,
        fileUrl: url,
        fileKey: fileKey,
        fileName: input.fileName,
        fileSize: fileBuffer.length,
        mimeType: input.mimeType,
      });
      
      return { 
        success: true, 
        proposalId: Number(result[0].insertId),
        fileUrl: url 
      };
    }),

  // Pre-process extracted text — classify pages and filter
  preprocess: protectedProcedure
    .input(z.object({
      extractedText: z.string(),
    }))
    .mutation(async ({ input }) => {
      const result = preprocessPages(input.extractedText);
      return {
        filteredText: result.filteredText,
        totalPages: result.totalPages,
        relevantPages: result.relevantPages,
        skippedPages: result.skippedPages,
        savingsPercent: result.savingsPercent,
        classifications: result.classifications.map(c => ({
          pageIndex: c.pageIndex,
          category: c.category,
          relevanceScore: c.relevanceScore,
          snippet: c.snippet,
        })),
      };
    }),

  // Analyze a proposal with comprehensive detailed extraction (uses pre-processed text)
  analyze: protectedProcedure
    .input(z.object({
      proposalId: z.number(),
      extractedText: z.string(), // Full text (for storage)
      filteredText: z.string().optional(), // Pre-processed text (for AI analysis)
    }))
    .mutation(async ({ ctx, input }) => {
      const proposal = await getProposalById(input.proposalId, ctx.user.id);
      if (!proposal) {
        throw new Error("Proposal not found");
      }
      
      await updateProposalAnalysis(input.proposalId, ctx.user.id, {
        analysisStatus: 'processing',
        extractedText: input.extractedText,
      });
      
      try {
        // Use filtered text if available, otherwise full text
        const textForAnalysis = input.filteredText || input.extractedText;
        const analysis = await analyzeProposalWithAI(textForAnalysis, proposal.title);
        
        // Serialize JSON fields for storage
        const dbUpdate: any = {
          aiSummary: analysis.aiSummary,
          aiKeyPoints: JSON.stringify(analysis.aiKeyPoints),
          aiStrengths: JSON.stringify(analysis.aiStrengths),
          aiWeaknesses: JSON.stringify(analysis.aiWeaknesses),
          aiRecommendation: analysis.aiRecommendation,
          aiScore: analysis.aiScore,
          aiScope: analysis.aiScope ? JSON.stringify(analysis.aiScope) : null,
          aiExclusions: analysis.aiExclusions ? JSON.stringify(analysis.aiExclusions) : null,
          aiAdditionalWorks: analysis.aiAdditionalWorks ? JSON.stringify(analysis.aiAdditionalWorks) : null,
          aiSupervisionTerms: analysis.aiSupervisionTerms ? JSON.stringify(analysis.aiSupervisionTerms) : null,
          aiTimeline: analysis.aiTimeline ? JSON.stringify(analysis.aiTimeline) : null,
          aiPaymentTerms: analysis.aiPaymentTerms ? JSON.stringify(analysis.aiPaymentTerms) : null,
          aiConditions: analysis.aiConditions ? JSON.stringify(analysis.aiConditions) : null,
          aiTeamComposition: analysis.aiTeamComposition ? JSON.stringify(analysis.aiTeamComposition) : null,
          aiDeliverables: analysis.aiDeliverables ? JSON.stringify(analysis.aiDeliverables) : null,
          // New fields stored as JSON text
          aiFinancialSummary: analysis.aiFinancialSummary ? JSON.stringify(analysis.aiFinancialSummary) : null,
          aiWarnings: analysis.aiWarnings ? JSON.stringify(analysis.aiWarnings) : null,
          extractedText: input.extractedText,
          analysisStatus: 'completed',
          analysisError: null,
        };
        
        await updateProposalAnalysis(input.proposalId, ctx.user.id, dbUpdate);
        
        return { success: true, analysis };
      } catch (error: any) {
        await updateProposalAnalysis(input.proposalId, ctx.user.id, {
          analysisStatus: 'failed',
          analysisError: error.message,
        });
        
        throw error;
      }
    }),

  // Re-analyze an existing proposal
  reanalyze: protectedProcedure
    .input(z.object({
      proposalId: z.number(),
      filteredText: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const proposal = await getProposalById(input.proposalId, ctx.user.id);
      if (!proposal) {
        throw new Error("Proposal not found");
      }
      
      if (!proposal.extractedText) {
        throw new Error("لا يوجد نص مستخرج لإعادة التحليل. يرجى رفع العرض مرة أخرى.");
      }
      
      await updateProposalAnalysis(input.proposalId, ctx.user.id, {
        analysisStatus: 'processing',
        analysisError: null,
      });
      
      try {
        const textForAnalysis = input.filteredText || proposal.extractedText;
        const analysis = await analyzeProposalWithAI(textForAnalysis, proposal.title);
        
        const dbUpdate: any = {
          aiSummary: analysis.aiSummary,
          aiKeyPoints: JSON.stringify(analysis.aiKeyPoints),
          aiStrengths: JSON.stringify(analysis.aiStrengths),
          aiWeaknesses: JSON.stringify(analysis.aiWeaknesses),
          aiRecommendation: analysis.aiRecommendation,
          aiScore: analysis.aiScore,
          aiScope: analysis.aiScope ? JSON.stringify(analysis.aiScope) : null,
          aiExclusions: analysis.aiExclusions ? JSON.stringify(analysis.aiExclusions) : null,
          aiAdditionalWorks: analysis.aiAdditionalWorks ? JSON.stringify(analysis.aiAdditionalWorks) : null,
          aiSupervisionTerms: analysis.aiSupervisionTerms ? JSON.stringify(analysis.aiSupervisionTerms) : null,
          aiTimeline: analysis.aiTimeline ? JSON.stringify(analysis.aiTimeline) : null,
          aiPaymentTerms: analysis.aiPaymentTerms ? JSON.stringify(analysis.aiPaymentTerms) : null,
          aiConditions: analysis.aiConditions ? JSON.stringify(analysis.aiConditions) : null,
          aiTeamComposition: analysis.aiTeamComposition ? JSON.stringify(analysis.aiTeamComposition) : null,
          aiDeliverables: analysis.aiDeliverables ? JSON.stringify(analysis.aiDeliverables) : null,
          aiFinancialSummary: analysis.aiFinancialSummary ? JSON.stringify(analysis.aiFinancialSummary) : null,
          aiWarnings: analysis.aiWarnings ? JSON.stringify(analysis.aiWarnings) : null,
          analysisStatus: 'completed',
          analysisError: null,
        };
        
        await updateProposalAnalysis(input.proposalId, ctx.user.id, dbUpdate);
        
        return { success: true, analysis };
      } catch (error: any) {
        await updateProposalAnalysis(input.proposalId, ctx.user.id, {
          analysisStatus: 'failed',
          analysisError: error.message,
        });
        throw error;
      }
    }),

  // Delete a proposal
  delete: protectedProcedure
    .input(z.object({ proposalId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const { consultantProposals } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      
      // Verify ownership
      const proposal = await getProposalById(input.proposalId, ctx.user.id);
      if (!proposal) {
        throw new Error("العرض غير موجود أو لا تملك صلاحية حذفه");
      }
      
      await db.delete(consultantProposals)
        .where(and(
          eq(consultantProposals.id, input.proposalId),
          eq(consultantProposals.userId, ctx.user.id)
        ));
      
      return { success: true };
    }),

  // Update financial summary manually (review step)
  updateFinancials: protectedProcedure
    .input(z.object({
      proposalId: z.number(),
      financialSummary: z.object({
        totalFees: z.string().optional(),
        totalFeesFormatted: z.string().optional(),
        currency: z.string().optional(),
        feeType: z.string().optional(),
        vatIncluded: z.boolean().optional(),
        supervisionFees: z.string().optional(),
        supervisionType: z.string().optional(),
        priceValidity: z.string().optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      const proposal = await getProposalById(input.proposalId, ctx.user.id);
      if (!proposal) {
        throw new Error("العرض غير موجود");
      }
      
      await updateProposalAnalysis(input.proposalId, ctx.user.id, {
        aiFinancialSummary: JSON.stringify(input.financialSummary),
      });
      
      return { success: true };
    }),

  // Get all proposals with parsed JSON fields
  list: protectedProcedure
    .input(z.object({
      consultantId: z.number().optional(),
      projectId: z.number().optional(),
      analysisStatus: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const proposals = await getProposals(ctx.user.id, input);
      
      return proposals.map(p => ({
        ...p,
        aiKeyPoints: parseJsonField(p.aiKeyPoints) || [],
        aiStrengths: parseJsonField(p.aiStrengths) || [],
        aiWeaknesses: parseJsonField(p.aiWeaknesses) || [],
        aiScope: parseJsonField(p.aiScope),
        aiExclusions: parseJsonField(p.aiExclusions),
        aiAdditionalWorks: parseJsonField(p.aiAdditionalWorks),
        aiSupervisionTerms: parseJsonField(p.aiSupervisionTerms),
        aiTimeline: parseJsonField(p.aiTimeline),
        aiPaymentTerms: parseJsonField(p.aiPaymentTerms),
        aiConditions: parseJsonField(p.aiConditions),
        aiTeamComposition: parseJsonField(p.aiTeamComposition),
        aiDeliverables: parseJsonField(p.aiDeliverables),
        aiFinancialSummary: parseJsonField((p as any).aiFinancialSummary),
        aiWarnings: parseJsonField((p as any).aiWarnings) || [],
      }));
    }),

  // Get single proposal with all details
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const proposal = await getProposalById(input.id, ctx.user.id);
      if (!proposal) return null;
      
      return {
        ...proposal,
        aiKeyPoints: parseJsonField(proposal.aiKeyPoints) || [],
        aiStrengths: parseJsonField(proposal.aiStrengths) || [],
        aiWeaknesses: parseJsonField(proposal.aiWeaknesses) || [],
        aiScope: parseJsonField(proposal.aiScope),
        aiExclusions: parseJsonField(proposal.aiExclusions),
        aiAdditionalWorks: parseJsonField(proposal.aiAdditionalWorks),
        aiSupervisionTerms: parseJsonField(proposal.aiSupervisionTerms),
        aiTimeline: parseJsonField(proposal.aiTimeline),
        aiPaymentTerms: parseJsonField(proposal.aiPaymentTerms),
        aiConditions: parseJsonField(proposal.aiConditions),
        aiTeamComposition: parseJsonField(proposal.aiTeamComposition),
        aiDeliverables: parseJsonField(proposal.aiDeliverables),
        aiFinancialSummary: parseJsonField((proposal as any).aiFinancialSummary),
        aiWarnings: parseJsonField((proposal as any).aiWarnings) || [],
      };
    }),

  // Comprehensive comparison between proposals
  compare: protectedProcedure
    .input(z.object({
      projectId: z.number().optional(),
      title: z.string(),
      proposalIds: z.array(z.number()),
    }))
    .mutation(async ({ ctx, input }) => {
      const proposals = await Promise.all(
        input.proposalIds.map(id => getProposalById(id, ctx.user.id))
      );
      
      const validProposals = proposals.filter(p => p !== null).map(p => ({
        ...p!,
        aiKeyPoints: parseJsonField(p!.aiKeyPoints) || [],
        aiStrengths: parseJsonField(p!.aiStrengths) || [],
        aiWeaknesses: parseJsonField(p!.aiWeaknesses) || [],
        aiScope: parseJsonField(p!.aiScope),
        aiExclusions: parseJsonField(p!.aiExclusions),
        aiAdditionalWorks: parseJsonField(p!.aiAdditionalWorks),
        aiSupervisionTerms: parseJsonField(p!.aiSupervisionTerms),
        aiTimeline: parseJsonField(p!.aiTimeline),
        aiPaymentTerms: parseJsonField(p!.aiPaymentTerms),
        aiConditions: parseJsonField(p!.aiConditions),
        aiTeamComposition: parseJsonField(p!.aiTeamComposition),
        aiDeliverables: parseJsonField(p!.aiDeliverables),
        aiFinancialSummary: parseJsonField((p as any)?.aiFinancialSummary),
        aiWarnings: parseJsonField((p as any)?.aiWarnings) || [],
      }));
      
      if (validProposals.length < 2) {
        throw new Error("يجب اختيار عرضين على الأقل للمقارنة");
      }
      
      const comparisonResult = await compareProposalsWithAI(validProposals);
      
      const winnerProposalId = validProposals[comparisonResult.bestProposalIndex]?.id;
      
      const result = await createComparison({
        userId: ctx.user.id,
        projectId: input.projectId,
        title: input.title,
        proposalIds: input.proposalIds,
        comparisonResult: comparisonResult,
        aiRecommendation: comparisonResult.recommendation,
        winnerProposalId: winnerProposalId,
      });
      
      return { 
        success: true, 
        comparisonId: Number(result[0]?.insertId || 0),
        comparisonResult 
      };
    }),

  // Get all comparisons
  listComparisons: protectedProcedure
    .input(z.object({
      projectId: z.number().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      return await getComparisons(ctx.user.id, input?.projectId);
    }),

  // Get single comparison
  getComparisonById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      return await getComparisonById(input.id, ctx.user.id);
    }),
});
