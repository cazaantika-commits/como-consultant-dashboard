import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { contractTypes, projectContracts, projects } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { storagePut } from "../storage";

// ═══════════════════════════════════════════════════
// Default contract types (31 types for real estate development)
// ═══════════════════════════════════════════════════
const DEFAULT_CONTRACT_TYPES = [
  // أراضي ومعاملات عقارية
  { name: "عقد بيع وشراء الأرض", nameEn: "Sale & Purchase Agreement (SPA)", code: "SPA", category: "land" },
  { name: "عقد تنازل عن الأرض", nameEn: "Novation Agreement", code: "NOV", category: "land" },
  { name: "عقد إيجار أرض طويل الأمد", nameEn: "Long-term Land Lease", code: "LTL", category: "land" },
  { name: "اتفاقية تطوير مشترك", nameEn: "Joint Development Agreement", code: "JDA", category: "land" },
  { name: "اتفاقية حق الانتفاع", nameEn: "Usufruct Agreement", code: "USF", category: "land" },
  
  // استشاريون
  { name: "عقد استشاري هندسي (تصميم)", nameEn: "Engineering Consultant (Design)", code: "ECD", category: "consultant" },
  { name: "عقد استشاري هندسي (إشراف)", nameEn: "Engineering Consultant (Supervision)", code: "ECS", category: "consultant" },
  { name: "عقد استشاري هندسي (تصميم وإشراف)", nameEn: "Engineering Consultant (Design & Supervision)", code: "ECDS", category: "consultant" },
  { name: "عقد مدير مشروع", nameEn: "Project Management Consultant (PMC)", code: "PMC", category: "consultant" },
  { name: "عقد استشاري كميات", nameEn: "Quantity Surveyor", code: "QS", category: "consultant" },
  { name: "عقد استشاري تربة وجيوتقني", nameEn: "Geotechnical Consultant", code: "GEO", category: "consultant" },
  { name: "عقد استشاري بيئي", nameEn: "Environmental Consultant", code: "ENV", category: "consultant" },
  { name: "عقد استشاري تسويق عقاري", nameEn: "Real Estate Marketing Consultant", code: "MKT", category: "consultant" },
  { name: "عقد مثمّن عقاري", nameEn: "Property Valuation", code: "VAL", category: "consultant" },
  { name: "عقد استشاري قانوني", nameEn: "Legal Consultant", code: "LEG", category: "consultant" },
  
  // مقاولات وبناء
  { name: "عقد مقاولة رئيسي", nameEn: "Main Contractor Agreement", code: "MCA", category: "construction" },
  { name: "عقد مقاولة من الباطن", nameEn: "Subcontractor Agreement", code: "SUB", category: "construction" },
  { name: "عقد توريد مواد", nameEn: "Material Supply Agreement", code: "MSA", category: "construction" },
  { name: "عقد تصميم وبناء", nameEn: "Design & Build Contract", code: "D&B", category: "construction" },
  { name: "عقد صيانة ما بعد التسليم", nameEn: "Post-Handover Maintenance", code: "PHM", category: "construction" },
  
  // جهات حكومية
  { name: "اتفاقية مع المطور الرئيسي", nameEn: "Master Developer Agreement", code: "MDA", category: "government" },
  { name: "رخصة بناء", nameEn: "Building Permit", code: "BPR", category: "government" },
  { name: "شهادة إنجاز", nameEn: "Completion Certificate", code: "CCR", category: "government" },
  { name: "اتفاقية خدمات بنية تحتية", nameEn: "Infrastructure Services Agreement", code: "ISA", category: "government" },
  { name: "اتفاقية RERA / DLD", nameEn: "RERA / DLD Agreement", code: "RERA", category: "government" },
  
  // مبيعات وتسويق
  { name: "عقد بيع وحدة عقارية (Off-plan)", nameEn: "Off-plan Unit Sale Agreement", code: "OPS", category: "sales" },
  { name: "عقد وكيل مبيعات", nameEn: "Sales Agent Agreement", code: "SAA", category: "sales" },
  { name: "اتفاقية وساطة عقارية", nameEn: "Brokerage Agreement", code: "BRK", category: "sales" },
  
  // تمويل وتأمين
  { name: "عقد تمويل مصرفي", nameEn: "Bank Financing Agreement", code: "BFA", category: "other" },
  { name: "عقد تأمين المشروع", nameEn: "Project Insurance", code: "INS", category: "other" },
  { name: "عقد ضمان أداء", nameEn: "Performance Bond", code: "PBD", category: "other" },
];

export const contractsRouter = router({
  // ═══════════════════════════════════════════════════
  // Contract Types CRUD
  // ═══════════════════════════════════════════════════
  
  listTypes: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    const types = await db.select().from(contractTypes)
      .where(eq(contractTypes.userId, ctx.user.id))
      .orderBy(contractTypes.sortOrder, contractTypes.name);
    return types;
  }),

  seedDefaultTypes: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    // Check if user already has types
    const existing = await db.select().from(contractTypes)
      .where(eq(contractTypes.userId, ctx.user.id));
    
    if (existing.length > 0) {
      return { seeded: false, count: existing.length, message: "أنواع العقود موجودة مسبقاً" };
    }

    // Insert default types
    for (let i = 0; i < DEFAULT_CONTRACT_TYPES.length; i++) {
      const t = DEFAULT_CONTRACT_TYPES[i];
      await db.insert(contractTypes).values({
        userId: ctx.user.id,
        name: t.name,
        nameEn: t.nameEn,
        code: t.code,
        category: t.category,
        isDefault: 1,
        sortOrder: i,
      });
    }

    return { seeded: true, count: DEFAULT_CONTRACT_TYPES.length, message: `تم إضافة ${DEFAULT_CONTRACT_TYPES.length} نوع عقد` };
  }),

  addType: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      nameEn: z.string().optional(),
      code: z.string().optional(),
      category: z.string().optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const result = await db.insert(contractTypes).values({
        userId: ctx.user.id,
        name: input.name,
        nameEn: input.nameEn || null,
        code: input.code || null,
        category: input.category || "other",
        description: input.description || null,
        isDefault: 0,
      });
      return { id: result[0].insertId, success: true };
    }),

  updateType: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      nameEn: z.string().optional(),
      code: z.string().optional(),
      category: z.string().optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const updates: any = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.nameEn !== undefined) updates.nameEn = input.nameEn;
      if (input.code !== undefined) updates.code = input.code;
      if (input.category !== undefined) updates.category = input.category;
      if (input.description !== undefined) updates.description = input.description;
      
      await db.update(contractTypes)
        .set(updates)
        .where(and(eq(contractTypes.id, input.id), eq(contractTypes.userId, ctx.user.id)));
      return { success: true };
    }),

  deleteType: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      // Check if any contracts use this type
      const usedContracts = await db.select().from(projectContracts)
        .where(eq(projectContracts.contractTypeId, input.id));
      
      if (usedContracts.length > 0) {
        throw new Error(`لا يمكن حذف هذا النوع لأنه مستخدم في ${usedContracts.length} عقد`);
      }

      await db.delete(contractTypes)
        .where(and(eq(contractTypes.id, input.id), eq(contractTypes.userId, ctx.user.id)));
      return { success: true };
    }),

  // ═══════════════════════════════════════════════════
  // Project Contracts CRUD
  // ═══════════════════════════════════════════════════

  list: protectedProcedure
    .input(z.object({
      projectId: z.number().optional(),
      contractTypeId: z.number().optional(),
      status: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      const conditions = [eq(projectContracts.userId, ctx.user.id)];
      
      if (input?.projectId) conditions.push(eq(projectContracts.projectId, input.projectId));
      if (input?.contractTypeId) conditions.push(eq(projectContracts.contractTypeId, input.contractTypeId));
      if (input?.status) conditions.push(eq(projectContracts.status, input.status as any));

      const contracts = await db.select().from(projectContracts)
        .where(and(...conditions))
        .orderBy(desc(projectContracts.createdAt));

      // Get related data
      const typeIds = [...new Set(contracts.map(c => c.contractTypeId))];
      const projectIds = [...new Set(contracts.map(c => c.projectId))];

      const types = typeIds.length > 0
        ? await db.select().from(contractTypes).where(eq(contractTypes.userId, ctx.user.id))
        : [];
      
      const projectsList = projectIds.length > 0
        ? await db.select().from(projects).where(eq(projects.userId, ctx.user.id))
        : [];

      return contracts.map(c => ({
        ...c,
        contractType: types.find(t => t.id === c.contractTypeId),
        project: projectsList.find(p => p.id === c.projectId),
      }));
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      const [contract] = await db.select().from(projectContracts)
        .where(and(eq(projectContracts.id, input.id), eq(projectContracts.userId, ctx.user.id)));
      
      if (!contract) throw new Error("العقد غير موجود");

      const [type] = await db.select().from(contractTypes)
        .where(eq(contractTypes.id, contract.contractTypeId));
      const [project] = await db.select().from(projects)
        .where(eq(projects.id, contract.projectId));

      return { ...contract, contractType: type, project };
    }),

  add: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      contractTypeId: z.number(),
      title: z.string().min(1),
      contractNumber: z.string().optional(),
      partyA: z.string().optional(),
      partyB: z.string().optional(),
      contractValue: z.string().optional(),
      currency: z.string().optional(),
      signDate: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      status: z.string().optional(),
      notes: z.string().optional(),
      fileUrl: z.string().optional(),
      fileKey: z.string().optional(),
      fileName: z.string().optional(),
      driveFileId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const result = await db.insert(projectContracts).values({
        userId: ctx.user.id,
        projectId: input.projectId,
        contractTypeId: input.contractTypeId,
        title: input.title,
        contractNumber: input.contractNumber || null,
        partyA: input.partyA || null,
        partyB: input.partyB || null,
        contractValue: input.contractValue || null,
        currency: input.currency || "AED",
        signDate: input.signDate || null,
        startDate: input.startDate || null,
        endDate: input.endDate || null,
        status: (input.status as any) || "draft",
        notes: input.notes || null,
        fileUrl: input.fileUrl || null,
        fileKey: input.fileKey || null,
        fileName: input.fileName || null,
        driveFileId: input.driveFileId || null,
      });
      return { id: result[0].insertId, success: true };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      contractNumber: z.string().optional(),
      partyA: z.string().optional(),
      partyB: z.string().optional(),
      contractValue: z.string().optional(),
      currency: z.string().optional(),
      signDate: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      status: z.string().optional(),
      notes: z.string().optional(),
      contractTypeId: z.number().optional(),
      fileUrl: z.string().optional(),
      fileKey: z.string().optional(),
      fileName: z.string().optional(),
      driveFileId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const { id, ...updates } = input;
      const cleanUpdates: any = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) cleanUpdates[key] = value;
      }
      
      await db.update(projectContracts)
        .set(cleanUpdates)
        .where(and(eq(projectContracts.id, id), eq(projectContracts.userId, ctx.user.id)));
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      await db.delete(projectContracts)
        .where(and(eq(projectContracts.id, input.id), eq(projectContracts.userId, ctx.user.id)));
      return { success: true };
    }),

  // ═══════════════════════════════════════════════════
  // File Upload for contracts
  // ═══════════════════════════════════════════════════

  uploadFile: protectedProcedure
    .input(z.object({
      contractId: z.number(),
      fileName: z.string(),
      fileBase64: z.string(),
      contentType: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const buffer = Buffer.from(input.fileBase64, "base64");
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const fileKey = `contracts/${ctx.user.id}/${input.contractId}/${randomSuffix}-${input.fileName}`;
      
      const { url } = await storagePut(fileKey, buffer, input.contentType);
      
      await db.update(projectContracts)
        .set({ fileUrl: url, fileKey, fileName: input.fileName })
        .where(and(eq(projectContracts.id, input.contractId), eq(projectContracts.userId, ctx.user.id)));
      
      return { url, fileKey, success: true };
    }),

  // ═══════════════════════════════════════════════════
  // Farouq Analysis
  // ═══════════════════════════════════════════════════

  analyzeContract: protectedProcedure
    .input(z.object({ contractId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      
      // Get contract
      const [contract] = await db.select().from(projectContracts)
        .where(and(eq(projectContracts.id, input.contractId), eq(projectContracts.userId, ctx.user.id)));
      
      if (!contract) throw new Error("العقد غير موجود");
      if (!contract.fileUrl && !contract.driveFileId) {
        throw new Error("لا يوجد ملف مرفق بالعقد للتحليل");
      }

      // Get contract type
      const [type] = await db.select().from(contractTypes)
        .where(eq(contractTypes.id, contract.contractTypeId));

      // Mark as analyzing
      await db.update(projectContracts)
        .set({ analysisStatus: "analyzing" })
        .where(eq(projectContracts.id, input.contractId));

      try {
        // Build LLM message
        const userContent: any[] = [];
        
        const contextText = `أنت فاروق، المحلل القانوني الخبير في شركة Como Developments.
حلل هذا العقد بشكل شامل ومفصل:

نوع العقد: ${type?.name || "غير محدد"} (${type?.nameEn || ""})
عنوان العقد: ${contract.title}
${contract.partyA ? `الطرف الأول: ${contract.partyA}` : ""}
${contract.partyB ? `الطرف الثاني: ${contract.partyB}` : ""}
${contract.contractValue ? `قيمة العقد: ${contract.contractValue} ${contract.currency}` : ""}

استخرج من العقد التالي:
1. ملخص شامل (3-5 جمل)
2. المواعيد المهمة (تواريخ بدء، انتهاء، تسليم، مراحل)
3. الغرامات والجزاءات (تأخير، إخلال، عدم التزام)
4. الالتزامات (التزامات كل طرف)
5. المخاطر القانونية (ثغرات، بنود غير واضحة، مخاطر)
6. الأطراف وأدوارهم
7. شروط الإنهاء والفسخ
8. ملاحظات وتوصيات فاروق

أجب بصيغة JSON:
{
  "summary": "ملخص شامل...",
  "keyDates": [{"date": "التاريخ", "description": "الوصف", "importance": "high/medium/low"}],
  "penalties": [{"type": "نوع الغرامة", "amount": "المبلغ أو النسبة", "condition": "الشرط", "severity": "high/medium/low"}],
  "obligations": [{"party": "الطرف", "obligation": "الالتزام", "deadline": "الموعد"}],
  "risks": [{"risk": "المخاطرة", "severity": "high/medium/low", "recommendation": "التوصية"}],
  "parties": [{"name": "الاسم", "role": "الدور", "responsibilities": "المسؤوليات"}],
  "terminationClauses": "شروط الإنهاء...",
  "notes": "ملاحظات فاروق وتوصياته..."
}`;

        userContent.push({ type: "text", text: contextText });

        // Add file if available
        if (contract.fileUrl) {
          userContent.push({
            type: "file_url",
            file_url: {
              url: contract.fileUrl,
              mime_type: "application/pdf",
            },
          });
        }

        const response = await invokeLLM({
          messages: [
            { role: "system", content: "أنت فاروق، محلل قانوني خبير في التطوير العقاري بدبي. خبرة 25+ سنة. أجب دائماً بصيغة JSON صحيحة." },
            { role: "user", content: userContent },
          ],
        });

        const content = response.choices[0]?.message?.content || "{}";
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        
        if (!jsonMatch) throw new Error("فشل في استخراج التحليل");
        
        const analysis = JSON.parse(jsonMatch[0]);

        // Save analysis
        await db.update(projectContracts)
          .set({
            analysisStatus: "completed",
            analysisSummary: analysis.summary || null,
            analysisKeyDates: JSON.stringify(analysis.keyDates || []),
            analysisPenalties: JSON.stringify(analysis.penalties || []),
            analysisObligations: JSON.stringify(analysis.obligations || []),
            analysisRisks: JSON.stringify(analysis.risks || []),
            analysisParties: JSON.stringify(analysis.parties || []),
            analysisTermination: analysis.terminationClauses || null,
            analysisNotes: analysis.notes || null,
            analysisFullJson: JSON.stringify(analysis),
            analyzedAt: new Date(),
          })
          .where(eq(projectContracts.id, input.contractId));

        return { success: true, analysis };
      } catch (err: any) {
        await db.update(projectContracts)
          .set({ analysisStatus: "failed" })
          .where(eq(projectContracts.id, input.contractId));
        throw new Error(`فشل تحليل العقد: ${err.message}`);
      }
    }),

  // Stats for dashboard
  stats: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    const allContracts = await db.select().from(projectContracts)
      .where(eq(projectContracts.userId, ctx.user.id));
    
    const total = allContracts.length;
    const active = allContracts.filter(c => c.status === "active").length;
    const analyzed = allContracts.filter(c => c.analysisStatus === "completed").length;
    const pending = allContracts.filter(c => c.analysisStatus === "not_analyzed").length;
    const expired = allContracts.filter(c => c.status === "expired").length;

    return { total, active, analyzed, pending, expired };
  }),
});
