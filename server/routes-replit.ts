import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProjectSchema, insertExpenseSchema, insertAiMarketDataSchema, insertMilestoneSchema, insertProjectTaskSchema, insertFeasibilityStudySchema, insertKnowledgeBaseSchema, insertStageItemSchema, insertProjectCashFlowSchema, insertProjectFinancialSchema, insertApprovalRequestSchema, insertLeadershipDirectiveSchema, insertAiAgentSchema, insertAgentTaskSchema, insertReportVersionSchema, insertCommandCenterInquirySchema, insertSourceRegistrySchema, insertProjectAssumptionSchema, insertProjectScenarioSchema, insertConflictRecordSchema, insertReconciliationLedgerSchema, insertCompetitorProjectSchema, insertProjectDocumentSchema, insertCapitalEventSchema, insertRegulatoryNodeSchema, insertIPCSchema, insertVariationOrderSchema, insertGovernanceGateSchema, insertContractSchema, insertSalesUnitSchema, insertPaymentPlanSchema } from "@shared/schema";
import { applyCapitalEvent, recomputeBalances, computePortfolioCapital, computeD20, computeEligibleRelease, computeWithdrawable, computeECR, computeLSR, evaluateStressThresholds } from "./capital-engine";
import { computeProjectRisk } from "./risk-engine";
import { z } from "zod";
import { streamSalwaChat } from "./salwa";
import { generateFeasibilityReport } from "./feasibility-report";
import { joelleAutoPopulate } from "./joelle";
import { runGovernanceReview, runGovernanceAndPublish } from "./governance-engine";
import multer from "multer";
import * as path from "path";
import * as fs from "fs";
import { onDocumentUploaded, onIPCCreated, AGENT_RUNNERS } from "./ai/pipeline/triggers";
import { applyApprovedProposal, rejectProposal, applyDraftDecision, rejectDraftDecision } from "./ai/pipeline/governance-apply";
import { answerBoardQuestion, explainDecision, summarizeProject, summarizePortfolio, streamLaylaChat, refreshBoardCaches } from "./board/layla";

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/dashboard", async (_req, res) => {
    try {
      const summary = await storage.getDashboardSummary();
      res.json(summary);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/projects", async (_req, res) => {
    try {
      const allProjects = await storage.getProjects();
      res.json(allProjects);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      const projectWallets = await storage.getWalletsByProject(project.id);
      const reraStatus = await storage.getRERAStatus(project.id);
      const projectTransactions = await storage.getTransactionsByProject(project.id);
      const projectExpenses = await storage.getExpensesByProject(project.id);
      const milestones = await storage.getMilestonesByProject(project.id);
      const tasks = await storage.getTasksByProject(project.id);
      res.json({ ...project, wallets: projectWallets, reraStatus, transactions: projectTransactions, expenses: projectExpenses, milestones, tasks });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/projects", async (req, res) => {
    try {
      const data = insertProjectSchema.parse(req.body);
      const project = await storage.createProject(data);
      res.status(201).json(project);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: error.message });
    }
  });

  const updateProjectSchema = z.object({
    plotNumber: z.string().optional(),
    areaCode: z.string().optional(),
    titleDeedNumber: z.string().optional(),
    ddaNumber: z.string().optional(),
    masterDevRef: z.string().optional(),
    plotAreaSqm: z.string().optional(),
    plotAreaSqft: z.string().optional(),
    gfaSqm: z.string().optional(),
    gfaSqft: z.string().optional(),
    buaSqft: z.string().optional(),
    permittedUse: z.string().optional(),
    ownershipType: z.string().optional(),
    subdivisionRestrictions: z.string().optional(),
    masterDevName: z.string().optional(),
    masterDevAddress: z.string().optional(),
    sellerName: z.string().optional(),
    sellerAddress: z.string().optional(),
    buyerName: z.string().optional(),
    buyerNationality: z.string().optional(),
    buyerPassport: z.string().optional(),
    buyerAddress: z.string().optional(),
    buyerPhone: z.string().optional(),
    buyerEmail: z.string().optional(),
    electricityAllocation: z.string().optional(),
    waterAllocation: z.string().optional(),
    sewageAllocation: z.string().optional(),
    tripAM: z.string().optional(),
    tripLT: z.string().optional(),
    tripPM: z.string().optional(),
    effectiveDate: z.string().optional(),
    constructionPeriod: z.string().optional(),
    constructionStartDate: z.string().optional(),
    completionDate: z.string().optional(),
    constructionConditions: z.string().optional(),
    saleRestrictions: z.string().optional(),
    resaleConditions: z.string().optional(),
    communityCharges: z.string().optional(),
    registrationAuthority: z.string().optional(),
    adminFee: z.union([z.string(), z.number()]).optional(),
    clearanceFee: z.union([z.string(), z.number()]).optional(),
    compensationAmount: z.union([z.string(), z.number()]).optional(),
    governingLaw: z.string().optional(),
    disputeResolution: z.string().optional(),
    notes: z.string().optional(),
    sellableAreaResidential: z.string().optional(),
    sellableAreaRetail: z.string().optional(),
    sellableAreaOffices: z.string().optional(),
    unitsResidential: z.union([z.string(), z.number()]).optional(),
    unitsRetail: z.union([z.string(), z.number()]).optional(),
    unitsOffices: z.union([z.string(), z.number()]).optional(),
    landPrice: z.string().optional(),
    agentCommissionLandPct: z.string().optional(),
  }).strict();

  app.patch("/api/projects/:id", async (req, res) => {
    try {
      const data = updateProjectSchema.parse(req.body);
      const updated = await storage.updateProject(req.params.id, data as any);
      res.json(updated);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/projects/:id/activate", async (req, res) => {
    try {
      const reraStatus = await storage.getRERAStatus(req.params.id);
      if (!reraStatus.reraConditionMet) {
        return res.status(400).json({
          message: `RERA 20% Rule not met. Escrow needs AED ${(reraStatus.requiredInjection - reraStatus.escrowBalance).toFixed(2)} more. Currently ${reraStatus.percentageFunded.toFixed(1)}% funded.`,
          reraStatus,
        });
      }
      const updated = await storage.updateProjectStatus(req.params.id, "Active");
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/projects/:id/complete", async (req, res) => {
    try {
      const updated = await storage.completeProject(req.params.id);
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/projects/:id/wallets", async (req, res) => {
    try {
      const projectWallets = await storage.getWalletsByProject(req.params.id);
      res.json(projectWallets);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/projects/:id/rera-status", async (req, res) => {
    try {
      const reraStatus = await storage.getRERAStatus(req.params.id);
      res.json(reraStatus);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const injectFundsSchema = z.object({
    walletType: z.enum(["Wallet_A", "Wallet_B"]),
    amount: z.string().refine(val => parseFloat(val) > 0, "Amount must be positive"),
    description: z.string().min(1, "Description is required"),
  });

  app.post("/api/projects/:id/inject", async (req, res) => {
    try {
      const data = injectFundsSchema.parse(req.body);
      const transaction = await storage.injectFunds(req.params.id, data.walletType, data.amount, data.description);
      res.status(201).json(transaction);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/projects/:id/transactions", async (req, res) => {
    try {
      const projectTransactions = await storage.getTransactionsByProject(req.params.id);
      res.json(projectTransactions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/projects/:id/expenses", async (req, res) => {
    try {
      const data = insertExpenseSchema.parse({ ...req.body, projectId: req.params.id });
      const expense = await storage.createExpense(data);
      res.json(expense);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/projects/:id/expenses", async (req, res) => {
    try {
      const projectExpenses = await storage.getExpensesByProject(req.params.id);
      res.json(projectExpenses);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/expenses/:id/process", async (req, res) => {
    try {
      const result = await storage.processExpense(req.params.id);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/ai-market-data", async (_req, res) => {
    try {
      const data = await storage.getAllAiMarketData();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/projects/:id/ai-market-data", async (req, res) => {
    try {
      const data = await storage.getAiMarketDataByProject(req.params.id);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/ai-market-data", async (req, res) => {
    try {
      const data = insertAiMarketDataSchema.parse(req.body);
      const created = await storage.createAiMarketData(data);
      res.status(201).json(created);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/ai-market-data/:id/approve", async (req, res) => {
    try {
      const result = await storage.approveAiMarketData(req.params.id);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/ai-market-data/:id/reject", async (req, res) => {
    try {
      const result = await storage.rejectAiMarketData(req.params.id);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/projects/:id/sensitivity", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const sellableArea = parseFloat(project.sellableArea);
      const approvedPrice = project.approvedSalePricePerSqft ? parseFloat(project.approvedSalePricePerSqft) : null;
      const tdc = parseFloat(project.totalGFA) * parseFloat(project.constructionCostPerSqft);

      if (!approvedPrice) {
        return res.json({ hasApprovedPrice: false, sellableArea, tdc, scenarios: [] });
      }

      const scenarios = [
        { label: "Base Case", discount: 0 },
        { label: "Downside (-5%)", discount: 0.05 },
        { label: "Worst Case (-10%)", discount: 0.10 },
      ].map(({ label, discount }) => {
        const adjustedPrice = approvedPrice * (1 - discount);
        const gdv = sellableArea * adjustedPrice;
        const profit = gdv - tdc;
        const roi = tdc > 0 ? (profit / tdc) * 100 : 0;
        return { label, salePricePerSqft: parseFloat(adjustedPrice.toFixed(2)), gdv: parseFloat(gdv.toFixed(2)), tdc: parseFloat(tdc.toFixed(2)), profit: parseFloat(profit.toFixed(2)), roi: parseFloat(roi.toFixed(2)), discount: discount * 100 };
      });

      res.json({ hasApprovedPrice: true, approvedSalePricePerSqft: approvedPrice, sellableArea, tdc, scenarios });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/projects/:id/milestones", async (req, res) => {
    try {
      const milestones = await storage.getMilestonesByProject(req.params.id);
      res.json(milestones);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/projects/:id/milestones", async (req, res) => {
    try {
      const data = insertMilestoneSchema.parse({ ...req.body, projectId: req.params.id });
      const milestone = await storage.createMilestone(data);
      res.status(201).json(milestone);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/milestones/:id/attach-certificate", async (req, res) => {
    try {
      const milestone = await storage.attachCertificate(req.params.id);
      res.json(milestone);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  const completeMilestoneSchema = z.object({
    releaseAmount: z.string().refine(val => parseFloat(val) > 0, "Amount must be positive"),
  });

  app.post("/api/milestones/:id/complete", async (req, res) => {
    try {
      const data = completeMilestoneSchema.parse(req.body);
      const result = await storage.completeMilestone(req.params.id, data.releaseAmount);
      res.json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/projects/:id/tasks", async (req, res) => {
    try {
      const tasks = await storage.getTasksByProject(req.params.id);
      res.json(tasks);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/projects/:id/tasks", async (req, res) => {
    try {
      const data = insertProjectTaskSchema.parse({ ...req.body, projectId: req.params.id });
      const task = await storage.createTask(data);
      res.status(201).json(task);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: error.message });
    }
  });

  const updateTaskSchema = z.object({
    taskName: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    amountAed: z.string().optional(),
    phase: z.enum(["Pre-Construction", "Construction", "Handover"]).optional(),
    walletSource: z.enum(["Wallet_A", "Wallet_B"]).optional(),
    isRevenue: z.boolean().optional(),
  });

  app.patch("/api/tasks/:id", async (req, res) => {
    try {
      const data = updateTaskSchema.parse(req.body);
      const updates: any = {};
      if (data.taskName) updates.taskName = data.taskName;
      if (data.startDate) updates.startDate = new Date(data.startDate);
      if (data.endDate) updates.endDate = new Date(data.endDate);
      if (data.amountAed !== undefined) updates.amountAed = data.amountAed;
      if (data.phase) updates.phase = data.phase;
      if (data.isRevenue !== undefined) updates.isRevenue = data.isRevenue;
      const task = await storage.updateTask(req.params.id, updates);
      res.json(task);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/tasks/:id", async (req, res) => {
    try {
      await storage.deleteTask(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // === Feasibility Studies ===

  app.get("/api/feasibility-studies", async (_req, res) => {
    try {
      const studies = await storage.getFeasibilityStudies();
      res.json(studies);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/feasibility-studies/:id", async (req, res) => {
    try {
      const study = await storage.getFeasibilityStudy(parseInt(req.params.id));
      if (!study) return res.status(404).json({ message: "Study not found" });
      res.json(study);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/feasibility-studies", async (req, res) => {
    try {
      const data = insertFeasibilityStudySchema.parse(req.body);
      const study = await storage.createFeasibilityStudy(data);
      res.status(201).json(study);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/feasibility-studies/:id", async (req, res) => {
    try {
      const study = await storage.updateFeasibilityStudy(parseInt(req.params.id), req.body);
      res.json(study);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/feasibility-studies/:id", async (req, res) => {
    try {
      await storage.deleteFeasibilityStudy(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/feasibility-studies/:id/generate-report", async (req, res) => {
    try {
      const section = req.body.section as string | undefined;
      const results = await generateFeasibilityReport(
        parseInt(req.params.id),
        section as any
      );
      res.json({ success: true, sections: results });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/feasibility-studies/:id/generate-overview", async (req, res) => {
    try {
      const studyId = parseInt(req.params.id);
      if (isNaN(studyId)) return res.status(400).json({ message: "Invalid study ID" });

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const { generateOverviewWithThinking } = await import("./feasibility-report");

      const result = await generateOverviewWithThinking(studyId, (chunk) => {
        res.write(`data: ${JSON.stringify({ type: "thinking", chunk })}\n\n`);
      });

      res.write(`data: ${JSON.stringify({ type: "report", content: result.report })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: "fields", recommendedFields: result.recommendedFields })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: "complete", thinking: result.thinking })}\n\n`);
      res.write(`data: [DONE]\n\n`);
      res.end();
    } catch (error: any) {
      if (!res.headersSent) {
        res.status(500).json({ message: error.message });
      } else {
        res.write(`data: ${JSON.stringify({ type: "error", message: error.message })}\n\n`);
        res.end();
      }
    }
  });

  app.post("/api/feasibility-studies/:id/generate-brief", async (req, res) => {
    try {
      const { generateExecutiveBrief, computeFinancials } = await import("./feasibility-report");
      const study = await storage.getFeasibilityStudy(parseInt(req.params.id));
      if (!study) return res.status(404).json({ message: "Study not found" });
      const financials = computeFinancials(study);
      const brief = await generateExecutiveBrief(study, financials);
      await storage.updateFeasibilityStudy(parseInt(req.params.id), { reportExecutiveBrief: brief });
      res.json({ success: true, brief });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // === Financial Engine: Scenarios, Cash Flow, JV ===

  app.post("/api/feasibility-studies/:id/compute-scenarios", async (req, res) => {
    try {
      const { computeScenarioResults, computeMonthlyCashFlow, computeJvWaterfall } = await import("./financial-engine");
      const study = await storage.getFeasibilityStudy(parseInt(req.params.id));
      if (!study) return res.status(404).json({ message: "Study not found" });
      let projDuration: number | undefined;
      let projLandPrice: number | undefined;
      if (study.projectId) {
        const proj = await storage.getProject(study.projectId);
        if (proj?.constructionPeriod) {
          const m = proj.constructionPeriod.match(/(\d+)/);
          if (m) projDuration = parseInt(m[1]);
        }
        if (proj?.landPrice) projLandPrice = Number(proj.landPrice);
      }
      const scenarios = computeScenarioResults(study, projDuration, projLandPrice);
      const cashFlow = computeMonthlyCashFlow(study, projDuration, projLandPrice);
      const jvWaterfall = computeJvWaterfall(study);
      if (study.projectId) {
        const existing = await storage.getScenarios(study.projectId);
        for (const old of existing) {
          await storage.deleteScenario(old.id);
        }
        for (const s of scenarios) {
          await storage.createScenario({
            projectId: study.projectId,
            feasibilityStudyId: parseInt(req.params.id),
            scenarioType: s.scenarioType as any,
            name: s.name,
            constructionCostAdj: String(s.constructionCostAdj),
            salePriceAdj: String(s.salePriceAdj),
            absorptionAdj: String(s.absorptionAdj),
            gdv: String(s.gdv),
            tdc: String(s.tdc),
            netProfit: String(s.netProfit),
            roi: String(s.roi),
            irr: String(s.irr),
            equityIrr: String(s.equityIrr),
            peakCashNeed: String(s.peakCashNeed),
            fundingGap: String(s.fundingGap),
            salesDurationMonths: s.salesDurationMonths,
          });
        }
      }
      res.json({ scenarios, cashFlow, jvWaterfall });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/feasibility-studies/:id/cash-flow-model", async (req, res) => {
    try {
      const { computeMonthlyCashFlow } = await import("./financial-engine");
      const { computeFinancials } = await import("./feasibility-report");
      const study = await storage.getFeasibilityStudy(parseInt(req.params.id));
      if (!study) return res.status(404).json({ message: "Study not found" });
      let durationMonths: number | undefined;
      let projectLandPrice: number | undefined;
      if (study.projectId) {
        const project = await storage.getProject(study.projectId);
        if (project?.constructionPeriod) {
          const match = project.constructionPeriod.match(/(\d+)/);
          if (match) durationMonths = parseInt(match[1]);
        }
        if (project?.landPrice) projectLandPrice = Number(project.landPrice);
      }
      const cashFlow = computeMonthlyCashFlow(study, durationMonths, projectLandPrice);
      const peakCashNeed = Math.max(...cashFlow.map(r => r.fundingGap));
      const breakEvenMonth = cashFlow.findIndex(r => r.cumulative > 0) + 1 || cashFlow.length;
      const financials = computeFinancials(study);
      res.json({
        cashFlow, peakCashNeed, breakEvenMonth, totalMonths: cashFlow.length,
        financials: {
          gdv: financials.gdv,
          tdc: financials.tdc,
          netProfit: financials.netProfit,
          roi: financials.roi,
          profitOnGdv: financials.profitOnGdv,
          requiredInjection: financials.requiredInjection,
          escrowAmount: financials.escrowAmount,
          totalLandCost: financials.totalLandCost,
          constructionCost: financials.constructionCost,
          totalConstructionCost: financials.totalConstructionCost,
          totalGfa: financials.totalGfa,
          totalSaleable: financials.totalSaleable,
        },
        studyInputs: {
          numberOfUnits: study.numberOfUnits,
          landPrice: study.landPrice,
          constructionCostPerSqft: study.constructionCostPerSqft,
          residentialSalePrice: study.residentialSalePrice,
          retailSalePrice: study.retailSalePrice,
          plotArea: study.plotArea,
          projectName: study.projectName,
          community: study.community,
          profitSharePct: 15,
        },
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/feasibility-studies/:id/jv-waterfall", async (req, res) => {
    try {
      const { computeJvWaterfall } = await import("./financial-engine");
      const study = await storage.getFeasibilityStudy(parseInt(req.params.id));
      if (!study) return res.status(404).json({ message: "Study not found" });
      const jvWaterfall = computeJvWaterfall(study);
      res.json(jvWaterfall);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/feasibility-studies/:id/reconcile", async (req, res) => {
    try {
      const { runReconciliation } = await import("./reconciliation-engine");
      const study = await storage.getFeasibilityStudy(parseInt(req.params.id));
      if (!study) return res.status(404).json({ message: "Study not found" });
      if (!study.projectId) return res.status(400).json({ message: "Study has no linked project" });
      const metrics = req.body.metrics || [];
      const results = await runReconciliation(study.projectId, metrics);
      res.json({ results, count: results.length });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // === Joelle Auto-Populate ===

  app.post("/api/joelle/auto-populate/:id", async (req, res) => {
    try {
      const studyId = parseInt(req.params.id);
      if (isNaN(studyId)) return res.status(400).json({ message: "Invalid study ID" });

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const result = await joelleAutoPopulate(studyId, (step) => {
        res.write(`data: ${JSON.stringify({ type: "progress", step })}\n\n`);
      });

      const updatedStudy = await storage.getFeasibilityStudy(studyId);

      res.write(`data: ${JSON.stringify({ type: "result", ...result, study: updatedStudy })}\n\n`);
      res.write(`data: [DONE]\n\n`);
      res.end();
    } catch (error: any) {
      if (!res.headersSent) {
        res.status(500).json({ message: error.message });
      } else {
        res.write(`data: ${JSON.stringify({ type: "error", message: error.message })}\n\n`);
        res.end();
      }
    }
  });

  // === Knowledge Base ===

  app.get("/api/knowledge-base", async (req, res) => {
    try {
      const domain = req.query.domain as string | undefined;
      const entries = await storage.getKnowledgeBase(domain);
      res.json(entries);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/knowledge-base/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) return res.status(400).json({ message: "Query parameter 'q' is required" });
      const results = await storage.searchKnowledge(query);
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/knowledge-base", async (req, res) => {
    try {
      const data = insertKnowledgeBaseSchema.parse(req.body);
      const entry = await storage.createKnowledgeEntry(data);
      res.status(201).json(entry);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: error.message });
    }
  });

  // === Salwa AI Chat ===

  app.get("/api/salwa/history", async (_req, res) => {
    try {
      const history = await storage.getChatHistory("salwa", 50);
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/salwa/chat", async (req, res) => {
    try {
      const { message } = req.body;
      if (!message) return res.status(400).json({ message: "Message is required" });

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      await streamSalwaChat(
        message,
        (chunk) => {
          res.write(`data: ${JSON.stringify({ type: "text", content: chunk })}\n\n`);
        },
        (toolName, _result) => {
          res.write(`data: ${JSON.stringify({ type: "tool", tool: toolName })}\n\n`);
        },
      );

      res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
      res.end();
    } catch (error: any) {
      console.error("Salwa chat error:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ type: "error", message: error.message })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  app.post("/api/salwa/tts", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) return res.status(400).json({ message: "Text is required" });

      const cleanText = text
        .replace(/\*\*/g, "")
        .replace(/[#\-_*]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 2000);

      const { MsEdgeTTS, OUTPUT_FORMAT } = await import("msedge-tts");
      const tts = new MsEdgeTTS();
      await tts.setMetadata("ar-AE-FatimaNeural", OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

      const fs = await import("fs");
      const path = await import("path");
      const os = await import("os");

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "salwa-tts-"));
      await tts.toFile(tmpDir, cleanText);

      const audioPath = path.join(tmpDir, "audio.mp3");
      if (!fs.existsSync(audioPath)) throw new Error("Audio generation failed");

      const buffer = fs.readFileSync(audioPath);
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Length", buffer.length.toString());
      res.send(buffer);

      fs.unlinkSync(audioPath);
      fs.rmdirSync(tmpDir);
    } catch (error: any) {
      console.error("TTS error:", error.message);
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/salwa/history", async (_req, res) => {
    try {
      await storage.clearChatHistory("salwa");
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // === Project Budget ===

  app.get("/api/projects/:id/budget", async (req, res) => {
    try {
      const items = await storage.getBudgetItems(req.params.id);
      if (items.length === 0) {
        const initialized = await storage.initializeBudgetTemplate(req.params.id);
        return res.json(initialized);
      }
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/projects/:id/budget/summary", async (req, res) => {
    try {
      const items = await storage.getBudgetItems(req.params.id);
      if (items.length === 0) {
        await storage.initializeBudgetTemplate(req.params.id);
      }
      const summary = await storage.getProjectBudgetSummary(req.params.id);
      res.json(summary);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/projects/:id/budget/:itemKey", async (req, res) => {
    try {
      const { amount } = req.body;
      if (amount === undefined) {
        return res.status(400).json({ message: "amount is required" });
      }
      const item = await storage.upsertBudgetItem(req.params.id, req.params.itemKey, { amount: String(amount) });
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/projects/:id/budget/initialize", async (req, res) => {
    try {
      const items = await storage.initializeBudgetTemplate(req.params.id);
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // === Seed Knowledge Base ===

  app.post("/api/knowledge-base/seed", async (_req, res) => {
    try {
      const existing = await storage.getKnowledgeBase();
      if (existing.length > 0) {
        return res.json({ message: "Knowledge base already seeded", count: existing.length });
      }

      const seeds = [
        { domain: "rera_law" as const, category: "Escrow", title: "RERA 20% Rule - Escrow Account Requirement", content: "Under RERA regulations, developers must deposit at least 20% of the Total Construction Cost (TCC) in the project's escrow account (Wallet A) before they can begin selling off-plan units. TCC = Total GFA × Construction Cost per sqft. This ensures investor protection and project viability. The project cannot be activated from Pre-study to Active status until this condition is met.", keywords: "RERA,20%,escrow,deposit,construction cost,activation", source: "RERA Dubai" },
        { domain: "rera_law" as const, category: "Buyer Default", title: "Law No. 19 of 2020 - Buyer Default Provisions", content: "Law No. 19 of 2020 governs buyer default in off-plan property purchases in Dubai. The developer's retention rights depend on project completion: (1) Less than 60% complete: Developer may retain up to 25% of the unit price. (2) 60-80% complete: Developer may retain up to 40% of the unit price. (3) More than 80% complete: Developer retains 40% and may force a public auction of the unit. The buyer receives any excess proceeds from the auction after deducting the developer's costs.", keywords: "Law 19,buyer default,retention,completion,auction,2020", source: "Dubai Law No. 19 of 2020" },
        { domain: "rera_law" as const, category: "Retention", title: "5% Retention After Handover - RERA Compliance", content: "Upon project completion (Handover), RERA requires that 5% of the Escrow Account (Wallet B) balance be retained for a period of 365 days. This retention protects against defects liability. The funds are automatically locked and cannot be accessed until the retention period expires. A live countdown timer tracks the remaining time.", keywords: "5%,retention,handover,defects liability,365 days,escrow", source: "RERA Dubai" },
        { domain: "rera_law" as const, category: "Fund Routing", title: "Two Wallets System - Fund Routing Rules", content: "The Two Wallets system enforces strict fund routing: Wallet A (Investor Equity) handles Soft Costs (marketing, registration, design fees). Wallet B (Escrow Account) handles Hard Costs (contractor payments, construction). Hard Cost payments from Wallet B are BLOCKED unless a Consultant Certificate has been approved. This ensures independent verification of construction progress before fund release.", keywords: "Wallet A,Wallet B,soft cost,hard cost,consultant certificate,fund routing", source: "AURA Platform Rules" },
        { domain: "market_prices" as const, category: "Construction Costs", title: "Dubai Construction Cost Benchmarks 2025/2026", content: "Current construction cost benchmarks for Dubai real estate (2025/2026): Standard Villas: 390 AED/sqft. High-end/Luxury Villas: 1,020 AED/sqft. Apartments: 510 AED/sqft. These figures include main contractor costs and are used as baseline for feasibility studies and RERA calculations. Actual costs may vary by ±10% based on specifications, location, and market conditions.", keywords: "construction cost,benchmark,2025,2026,villa,apartment,AED/sqft", source: "UAE Market Intelligence 2025" },
        { domain: "market_prices" as const, category: "Sale Prices", title: "Off-Plan Pricing Strategy", content: "Off-plan properties in Dubai are typically priced at a 15% discount to comparable ready market prices. This discount incentivizes early buyers and accounts for the time value of money during the construction period. The formula: Off-Plan Price = Ready Market Price × 0.85. Sale price per sqft varies significantly by location: JBR 2,200-3,500 AED/sqft, Downtown 2,800-4,500 AED/sqft, Business Bay 1,800-2,800 AED/sqft, Dubai Hills 1,500-2,200 AED/sqft.", keywords: "off-plan,discount,15%,sale price,ready market,sqft", source: "Dubai Real Estate Market Report" },
        { domain: "dubai_municipality" as const, category: "Permits", title: "Dubai Municipality Building Permit Process", content: "Building permits in Dubai require: 1) NOC from master developer, 2) RERA registration for off-plan, 3) Soil investigation report, 4) Approved architectural and structural drawings, 5) Environmental impact assessment for large projects. Fees include: NOC fee (typically 10,000 AED), RERA off-plan registration (150,000 AED), RERA per-unit fee (850 AED/unit), Escrow account setup (140,000 AED).", keywords: "permit,NOC,municipality,registration,fees", source: "Dubai Municipality" },
        { domain: "company_context" as const, category: "Platform", title: "AURA Executive Platform Overview", content: "AURA Executive is a premium institutional real estate portfolio management platform designed for Dubai developers. Core features: Two Wallets financial system (Wallet A for investor equity, Wallet B for escrow), RERA 20% enforcement, AI-driven market intelligence, Sensitivity Analysis Matrix, Construction Milestones with Consultant Certificate gateway, 5% Retention Timer, Dynamic Phasing with Gantt Charts, and Buyer Default Simulator (Law 19/2020). The platform supports full Arabic/English bilingual operation with RTL support.", keywords: "AURA,platform,portfolio,management,Dubai,developer", source: "AURA Platform" },
      ];

      for (const seed of seeds) {
        await storage.createKnowledgeEntry(seed);
      }

      res.status(201).json({ message: "Knowledge base seeded", count: seeds.length });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // === Consultant Evaluation ===

  app.get("/api/consultants", async (_req, res) => {
    try {
      const all = await storage.getConsultants();
      res.json(all);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/consultants", async (req, res) => {
    try {
      const { name, email, phone, specialization } = req.body;
      if (!name) return res.status(400).json({ message: "Name is required" });
      const c = await storage.createConsultant({ name, email, phone, specialization });
      res.status(201).json(c);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/consultants/:id", async (req, res) => {
    try {
      await storage.deleteConsultant(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/projects/:id/consultants", async (req, res) => {
    try {
      const pc = await storage.getProjectConsultants(req.params.id);
      res.json(pc);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/projects/:id/consultants", async (req, res) => {
    try {
      const { consultantId } = req.body;
      if (!consultantId) return res.status(400).json({ message: "consultantId is required" });
      const pc = await storage.addProjectConsultant(req.params.id, parseInt(consultantId));
      res.status(201).json(pc);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/projects/:id/consultants/:consultantId", async (req, res) => {
    try {
      await storage.removeProjectConsultant(req.params.id, parseInt(req.params.consultantId));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/projects/:id/evaluator-scores", async (req, res) => {
    try {
      const scores = await storage.getEvaluatorScoresByProject(req.params.id);
      res.json(scores);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/evaluator-scores", async (req, res) => {
    try {
      const { projectId, consultantId, evaluatorId, criterionId, score } = req.body;
      const result = await storage.upsertEvaluatorScore({ projectId, consultantId, evaluatorId, criterionId, score });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/projects/:id/financials", async (req, res) => {
    try {
      const financials = await storage.getFinancialsByProject(req.params.id);
      res.json(financials);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/consultant-financials", async (req, res) => {
    try {
      const result = await storage.upsertFinancial(req.body);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/projects/:id/committee-decision", async (req, res) => {
    try {
      const decision = await storage.getCommitteeDecision(req.params.id);
      res.json(decision || null);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/committee-decisions", async (req, res) => {
    try {
      const result = await storage.upsertCommitteeDecision(req.body);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/projects/:id/committee-decision/confirm", async (req, res) => {
    try {
      const { confirmedBy } = req.body;
      const result = await storage.confirmCommitteeDecision(req.params.id, confirmedBy || "Executive");
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/projects/:id/ai-advisory", async (req, res) => {
    try {
      const scores = await storage.getAiAdvisoryByProject(req.params.id);
      res.json(scores);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/ai-advisory", async (req, res) => {
    try {
      const result = await storage.upsertAiAdvisoryScore(req.body);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // === AI Consultant Analysis ===

  app.post("/api/consultant-evaluation/ai-analyze", async (req, res) => {
    try {
      const { projectName, selectedConsultantName, decisionType, decisionBasis, rankings, negotiationTarget, negotiationConditions } = req.body;

      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      });

      const prompt = `أنت مستشار عقاري خبير في تقييم الاستشاريين الهندسيين في دبي.

المشروع: ${projectName}
نوع القرار: ${decisionType}
أساس القرار: ${decisionBasis}
الاستشاري المختار: ${selectedConsultantName}
${negotiationTarget ? `هدف التفاوض: ${negotiationTarget}` : ''}
${negotiationConditions ? `شروط التفاوض: ${negotiationConditions}` : ''}

ترتيب الاستشاريين:
${rankings?.map((r: any, i: number) => `${i + 1}. ${r.name} — فني: ${r.technicalScore?.toFixed(1)}% — أتعاب: ${r.totalFee?.toLocaleString()} AED — انحراف: ${r.feeDeviation?.toFixed(1)}%`).join('\n')}

قدم تحليلاً موجزاً للقرار يشمل:
1. تقييم مدى توافق القرار مع البيانات
2. نقاط القوة والمخاطر
3. توصيات للتفاوض إن وجدت`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        max_completion_tokens: 2048,
      });

      res.json({ analysis: response.choices[0]?.message?.content || "" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/consultant-evaluation/ai-recommend", async (req, res) => {
    try {
      const { projectName, consultants: consultantData } = req.body;

      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      });

      const prompt = `أنت مستشار عقاري خبير. المشروع: ${projectName}

بيانات الاستشاريين:
${consultantData?.map((c: any) => `- ${c.name}: فني ${c.technicalScore?.toFixed(1)}% | أتعاب ${c.totalFee?.toLocaleString()} AED | انحراف ${c.feeDeviation?.toFixed(1)}%`).join('\n')}

قدم توصية موجزة بالاستشاري الأفضل مع المبررات.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        max_completion_tokens: 1500,
      });

      res.json({ recommendation: response.choices[0]?.message?.content || "" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/consultant-evaluation/ai-advisory-scores", async (req, res) => {
    try {
      const { projectId, projectName, consultants: consultantList } = req.body;

      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      });

      const criteriaNames = [
        'الهوية المعمارية وجودة التصميم',
        'القدرات التقنية والتكامل مع BIM',
        'كفاءة التخطيط وتحسين المساحات',
        'التحكم في التكاليف والوعي بالميزانية',
        'الخبرة في مشاريع مشابهة',
        'قوة فريق المشروع',
        'إدارة الوقت والانضباط بالبرنامج',
        'الاهتمام بالمشروع',
        'مرونة التعاقد',
      ];

      const prompt = `أنت خبير في تقييم الاستشاريين الهندسيين. المشروع: ${projectName}

لكل استشاري، اقترح درجة (0-95) لكل معيار مع مبرر مختصر.

الاستشاريين: ${consultantList?.map((c: any) => c.name).join(', ')}

المعايير:
${criteriaNames.map((name, i) => `${i}. ${name}`).join('\n')}

أجب بصيغة JSON:
{ "scores": [{ "consultantName": "...", "criteria": [{ "criterionId": 0, "score": 85, "reasoning": "..." }] }] }`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        max_completion_tokens: 4096,
        response_format: { type: "json_object" },
      });

      const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");

      if (parsed.scores && projectId) {
        for (const consultantScores of parsed.scores) {
          const consultant = consultantList?.find((c: any) => c.name === consultantScores.consultantName);
          if (!consultant) continue;
          for (const criterion of (consultantScores.criteria || [])) {
            await storage.upsertAiAdvisoryScore({
              projectId,
              consultantId: consultant.id,
              criterionId: criterion.criterionId,
              suggestedScore: criterion.score,
              reasoning: criterion.reasoning,
            });
          }
        }
      }

      const updatedScores = await storage.getAiAdvisoryByProject(projectId);
      res.json(updatedScores);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // === WBS (Work Breakdown Structure) ===

  app.get("/api/projects/:id/wbs", async (req, res) => {
    try {
      const items = await storage.getWbsItems(req.params.id);
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/projects/:id/wbs", async (req, res) => {
    try {
      const { level, code, title, description, parentId, sortOrder } = req.body;
      if (!title || !code || level === undefined) {
        return res.status(400).json({ message: "title, code, and level are required" });
      }
      const item = await storage.createWbsItem({
        projectId: req.params.id,
        level,
        code,
        title,
        description: description || null,
        parentId: parentId || null,
        sortOrder: sortOrder || 0,
      });
      res.status(201).json(item);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/wbs/:id", async (req, res) => {
    try {
      const updated = await storage.updateWbsItem(parseInt(req.params.id), req.body);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/wbs/:id", async (req, res) => {
    try {
      await storage.deleteWbsItem(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/projects/:id/stages", async (req, res) => {
    try {
      const items = await storage.getStageItems(req.params.id);
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/projects/:id/stages", async (req, res) => {
    try {
      const data = insertStageItemSchema.parse({
        ...req.body,
        projectId: req.params.id,
        isSystem: false,
      });
      const item = await storage.createStageItem(data);
      res.status(201).json(item);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: error.message });
    }
  });

  const updateStageItemSchema = z.object({
    status: z.enum(["not_started", "in_progress", "done", "pending", "partial"]).optional(),
    title: z.string().optional(),
    titleAr: z.string().optional(),
    code: z.string().optional(),
    description: z.string().optional(),
    descriptionAr: z.string().optional(),
    requiredDocs: z.string().optional(),
    requiredDocsAr: z.string().optional(),
    notes: z.string().optional(),
    owner: z.string().optional(),
    plannedStartDate: z.string().optional(),
    plannedEndDate: z.string().optional(),
    sortOrder: z.number().optional(),
    isBoardLevel: z.boolean().optional(),
    cashOutflow: z.string().optional(),
    cashInflow: z.string().optional(),
  }).strict();

  app.patch("/api/stages/:id", async (req, res) => {
    try {
      const updates = updateStageItemSchema.parse(req.body);
      const updated = await storage.updateStageItem(parseInt(req.params.id), updates);
      res.json(updated);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/stages/:id", async (req, res) => {
    try {
      await storage.deleteStageItem(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/stages/:id/upload", async (req, res) => {
    try {
      const stageItemId = parseInt(req.params.id);
      const { projectId, filename, originalName, mimeType, fileSize, fileData } = req.body;
      if (!projectId || !originalName || !fileData) {
        return res.status(400).json({ message: "Missing required fields: projectId, originalName, fileData" });
      }
      const doc = await storage.createProjectDocument({
        projectId,
        stageItemId,
        filename: filename || `stage_${stageItemId}_${Date.now()}`,
        originalName,
        mimeType: mimeType || "application/octet-stream",
        fileSize: fileSize || 0,
        documentType: "other",
        uploadedBy: "owner",
        notes: fileData,
      });
      res.status(201).json(doc);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/stages/:id/documents", async (req, res) => {
    try {
      const stageItemId = parseInt(req.params.id);
      const docs = await storage.getDocumentsByStageItem(stageItemId);
      res.json(docs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/projects/:id/stage-documents", async (req, res) => {
    try {
      const docs = await storage.getDocumentsByProject(req.params.id);
      res.json(docs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/projects/:id/stages/seed", async (req, res) => {
    try {
      const projectId = req.params.id;
      const { items } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "items array required" });
      }
      const existing = await storage.getStageItems(projectId);
      const existingKeys = new Set(existing.filter((e: any) => e.isSystem).map((e: any) => `${e.phase}::${e.code}::${e.sortOrder}`));
      const toCreate = items.filter((item: any) => !existingKeys.has(`${item.phase}::${item.code}::${item.sortOrder}`));
      const created = [];
      for (const item of toCreate) {
        const result = await storage.createStageItem({
          projectId,
          phase: item.phase,
          title: item.title,
          titleAr: item.titleAr,
          code: item.code || null,
          description: item.description || null,
          descriptionAr: item.descriptionAr || null,
          requiredDocs: item.requiredDocs || null,
          requiredDocsAr: item.requiredDocsAr || null,
          status: "not_started",
          sortOrder: item.sortOrder || 0,
          isSystem: true,
          isBoardLevel: false,
          cashOutflow: "0",
          cashInflow: "0",
        });
        created.push(result);
      }
      res.json({ seeded: created.length, total: existing.length + created.length });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/projects/:id/cash-flows", async (req, res) => {
    try {
      const flows = await storage.getCashFlows(req.params.id);
      res.json(flows);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/projects/:id/cash-flows", async (req, res) => {
    try {
      const data = insertProjectCashFlowSchema.parse({ ...req.body, projectId: req.params.id });
      const flow = await storage.createCashFlow(data);
      res.status(201).json(flow);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: error.message });
    }
  });

  const updateCashFlowSchema = z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    type: z.enum(["outflow", "inflow"]).optional(),
    source: z.enum(["equity", "bank_finance", "sales", "other"]).optional(),
    amount: z.string().optional(),
    description: z.string().optional(),
    category: z.string().optional(),
  });

  app.patch("/api/cash-flows/:id", async (req, res) => {
    try {
      const data = updateCashFlowSchema.parse(req.body);
      const flow = await storage.updateCashFlow(parseInt(req.params.id), data as any);
      res.json(flow);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/cash-flows/:id", async (req, res) => {
    try {
      await storage.deleteCashFlow(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/board-dashboard", async (req, res) => {
    try {
      const projectIds = req.query.projectIds
        ? (req.query.projectIds as string).split(",")
        : [];
      const allProjects = await storage.getProjects();
      const allFinancials = await storage.getAllProjectFinancials();
      const targetProjectIds = projectIds.length > 0 ? projectIds : allProjects.map(p => p.id);
      const cashFlows = await storage.getCashFlowsByProjects(targetProjectIds);

      const monthlyMap = new Map<string, { outflow: number; inflowSales: number; inflowEquity: number; inflowBank: number }>();
      for (const cf of cashFlows) {
        const entry = monthlyMap.get(cf.month) || { outflow: 0, inflowSales: 0, inflowEquity: 0, inflowBank: 0 };
        const amount = parseFloat(cf.amount || "0");
        if (cf.type === "outflow") {
          entry.outflow += amount;
        } else {
          if (cf.source === "sales") entry.inflowSales += amount;
          else if (cf.source === "equity") entry.inflowEquity += amount;
          else if (cf.source === "bank_finance") entry.inflowBank += amount;
          else entry.inflowEquity += amount;
        }
        monthlyMap.set(cf.month, entry);
      }

      const months = Array.from(monthlyMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
      let cumulative = 0;
      const monthlyData = months.map(([month, data]) => {
        const totalInflow = data.inflowSales + data.inflowEquity + data.inflowBank;
        const net = totalInflow - data.outflow;
        cumulative += net;
        return {
          month,
          outflow: data.outflow,
          inflowSales: data.inflowSales,
          inflowEquity: data.inflowEquity,
          inflowBank: data.inflowBank,
          totalInflow,
          net,
          cumulativeFunding: cumulative,
        };
      });

      const totalOutflow = monthlyData.reduce((s, m) => s + m.outflow, 0);
      const totalInflowSales = monthlyData.reduce((s, m) => s + m.inflowSales, 0);
      const totalInflowEquity = monthlyData.reduce((s, m) => s + m.inflowEquity, 0);
      const totalInflowBank = monthlyData.reduce((s, m) => s + m.inflowBank, 0);
      const peakFunding = monthlyData.length > 0
        ? monthlyData.reduce((min, m) => m.cumulativeFunding < min.cumulativeFunding ? m : min, monthlyData[0])
        : null;

      const totalProjectCost = allFinancials
        .filter(f => targetProjectIds.includes(f.projectId))
        .reduce((s, f) => s + parseFloat(f.totalProjectCost || "0"), 0);
      const totalEquityRequired = allFinancials
        .filter(f => targetProjectIds.includes(f.projectId))
        .reduce((s, f) => s + parseFloat(f.equityRequired || "0"), 0);
      const totalSalesTarget = allFinancials
        .filter(f => targetProjectIds.includes(f.projectId))
        .reduce((s, f) => s + parseFloat(f.salesTarget || "0"), 0);

      res.json({
        monthlyData,
        kpis: {
          totalProjectCost,
          totalEquityRequired,
          totalSalesTarget,
          totalOutflow,
          totalInflowSales,
          totalInflowEquity,
          totalInflowBank,
          peakFundingMonth: peakFunding?.month || null,
          peakFundingAmount: peakFunding ? Math.abs(peakFunding.cumulativeFunding) : 0,
        },
        projects: allProjects.map(p => ({
          id: p.id,
          name: p.name,
          financials: allFinancials.find(f => f.projectId === p.id) || null,
        })),
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/projects/:id/financials", async (req, res) => {
    try {
      const fin = await storage.getProjectFinancial(req.params.id);
      res.json(fin || null);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/projects/:id/financials", async (req, res) => {
    try {
      const data = insertProjectFinancialSchema.parse({ ...req.body, projectId: req.params.id });
      const fin = await storage.upsertProjectFinancial(data);
      res.json(fin);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/projects/:id/cash-flows/generate", async (req, res) => {
    try {
      const projectId = req.params.id;
      const fin = await storage.getProjectFinancial(projectId);
      if (!fin) return res.status(400).json({ message: "Project financials not configured yet" });

      const existingFlows = await storage.getCashFlows(projectId);
      for (const f of existingFlows) {
        await storage.deleteCashFlow(f.id);
      }

      const duration = fin.projectDurationMonths || 30;
      const salesDelay = fin.salesDelayMonths || 0;
      const totalCost = parseFloat(fin.totalProjectCost || "0");
      const equity = parseFloat(fin.equityRequired || "0");
      const bank = parseFloat(fin.bankFinance || "0");
      const salesTarget = parseFloat(fin.salesTarget || "0");

      const now = new Date();
      const startYear = now.getFullYear();
      const startMonth = now.getMonth();

      const getMonthKey = (offset: number): string => {
        const d = new Date(startYear, startMonth + offset, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      };

      const softCostPct = 0.15;
      const hardCostPct = 0.85;
      const softCostMonths = Math.min(6, duration);
      const hardCostMonths = duration - softCostMonths;

      const softCostPerMonth = (totalCost * softCostPct) / softCostMonths;
      const hardCostPerMonth = hardCostMonths > 0 ? (totalCost * hardCostPct) / hardCostMonths : 0;

      const flows: any[] = [];
      for (let i = 0; i < softCostMonths; i++) {
        flows.push({
          projectId,
          month: getMonthKey(i),
          type: "outflow" as const,
          source: "other" as const,
          amount: softCostPerMonth.toFixed(2),
          description: "Pre-construction & soft costs",
          category: "soft_cost",
        });
      }
      for (let i = softCostMonths; i < duration; i++) {
        flows.push({
          projectId,
          month: getMonthKey(i),
          type: "outflow" as const,
          source: "other" as const,
          amount: hardCostPerMonth.toFixed(2),
          description: "Construction costs",
          category: "hard_cost",
        });
      }

      if (equity > 0) {
        const equityMonths = Math.min(6, duration);
        const equityPerMonth = equity / equityMonths;
        for (let i = 0; i < equityMonths; i++) {
          flows.push({
            projectId,
            month: getMonthKey(i),
            type: "inflow" as const,
            source: "equity" as const,
            amount: equityPerMonth.toFixed(2),
            description: "Equity injection",
            category: "equity",
          });
        }
      }

      if (bank > 0) {
        const bankStart = 3;
        const bankMonths = Math.min(12, duration - bankStart);
        if (bankMonths > 0) {
          const bankPerMonth = bank / bankMonths;
          for (let i = bankStart; i < bankStart + bankMonths; i++) {
            flows.push({
              projectId,
              month: getMonthKey(i),
              type: "inflow" as const,
              source: "bank_finance" as const,
              amount: bankPerMonth.toFixed(2),
              description: "Bank finance drawdown",
              category: "bank",
            });
          }
        }
      }

      if (salesTarget > 0) {
        const salesStart = 6 + salesDelay;
        const salesMonths = Math.max(1, duration - salesStart);
        const bookingPct = 0.10;
        const duringConstructionPct = 0.50;
        const handoverPct = 0.40;
        const bookingAmount = salesTarget * bookingPct;
        const monthlyDuring = (salesTarget * duringConstructionPct) / Math.max(1, salesMonths - 1);
        const handoverAmount = salesTarget * handoverPct;

        flows.push({
          projectId,
          month: getMonthKey(salesStart),
          type: "inflow" as const,
          source: "sales" as const,
          amount: bookingAmount.toFixed(2),
          description: "Booking deposits (10%)",
          category: "sales_booking",
        });

        for (let i = salesStart + 1; i < salesStart + salesMonths - 1; i++) {
          if (i < duration) {
            flows.push({
              projectId,
              month: getMonthKey(i),
              type: "inflow" as const,
              source: "sales" as const,
              amount: monthlyDuring.toFixed(2),
              description: "Construction-linked payments",
              category: "sales_construction",
            });
          }
        }

        flows.push({
          projectId,
          month: getMonthKey(duration - 1),
          type: "inflow" as const,
          source: "sales" as const,
          amount: handoverAmount.toFixed(2),
          description: "Handover payments (40%)",
          category: "sales_handover",
        });
      }

      const created = [];
      for (const f of flows) {
        const cf = await storage.createCashFlow(f);
        created.push(cf);
      }

      res.json({ success: true, count: created.length });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/approval-requests", async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const requests = await storage.getApprovalRequests(status);
      res.json(requests);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/approval-requests", async (req, res) => {
    try {
      const parsed = insertApprovalRequestSchema.parse(req.body);
      const created = await storage.createApprovalRequest(parsed);
      res.json(created);
    } catch (error: any) {
      if (error.name === "ZodError") return res.status(400).json({ message: "Validation error", errors: error.errors });
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/approval-requests/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getApprovalRequest(id);
      if (!existing) return res.status(404).json({ message: "Request not found" });
      const allowedStatuses = ["pending", "approved", "rejected", "needs_info"];
      const updates: any = {};
      if (req.body.status && allowedStatuses.includes(req.body.status)) {
        updates.status = req.body.status;
        updates.respondedAt = new Date();
      }
      if (req.body.responseNote) updates.responseNote = req.body.responseNote;
      if (req.body.respondedBy) updates.respondedBy = req.body.respondedBy;
      const updated = await storage.updateApprovalRequest(id, updates);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/leadership-directives", async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const directives = await storage.getLeadershipDirectives(status);
      res.json(directives);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/leadership-directives", async (req, res) => {
    try {
      const parsed = insertLeadershipDirectiveSchema.parse(req.body);
      const created = await storage.createLeadershipDirective(parsed);
      res.json(created);
    } catch (error: any) {
      if (error.name === "ZodError") return res.status(400).json({ message: "Validation error", errors: error.errors });
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/leadership-directives/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getLeadershipDirective(id);
      if (!existing) return res.status(404).json({ message: "Directive not found" });
      const updates: any = {};
      if (req.body.reply) {
        updates.reply = req.body.reply;
        updates.repliedAt = new Date();
        updates.status = "resolved";
      }
      if (req.body.status && ["open", "resolved"].includes(req.body.status)) {
        updates.status = req.body.status;
      }
      const updated = await storage.updateLeadershipDirective(id, updates);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/leadership-dashboard", async (req, res) => {
    try {
      const projectFilter = req.query.projectId as string | undefined;
      const allProjects = await storage.getProjects();
      const targetProjects = projectFilter ? allProjects.filter(p => p.id === projectFilter) : allProjects;
      const targetIds = targetProjects.map(p => p.id);

      const allFinancials = await storage.getAllProjectFinancials();
      const filteredFinancials = projectFilter ? allFinancials.filter(f => f.projectId === projectFilter) : allFinancials;
      const pendingRequests = await storage.getApprovalRequests("pending");
      const openDirectives = await storage.getLeadershipDirectives("open");

      let totalProjectCost = 0;
      let totalEquity = 0;
      let totalSalesTarget = 0;
      for (const fin of filteredFinancials) {
        totalProjectCost += parseFloat(fin.totalProjectCost || "0");
        totalEquity += parseFloat(fin.equityRequired || "0");
        totalSalesTarget += parseFloat(fin.salesTarget || "0");
      }

      const cashFlows = targetIds.length > 0 ? await storage.getCashFlowsByProjects(targetIds) : [];
      const monthlyMap = new Map<string, { outflows: number; inflows: number }>();
      for (const cf of cashFlows) {
        const entry = monthlyMap.get(cf.month) || { outflows: 0, inflows: 0 };
        const amt = parseFloat(cf.amount || "0");
        if (cf.type === "outflow") entry.outflows += amt;
        else entry.inflows += amt;
        monthlyMap.set(cf.month, entry);
      }
      const months = Array.from(monthlyMap.keys()).sort();
      let cumulative = 0;
      let totalOutflows = 0;
      const monthlyData = months.map(month => {
        const d = monthlyMap.get(month)!;
        totalOutflows += d.outflows;
        cumulative += d.inflows - d.outflows;
        return { month, outflows: d.outflows, inflows: d.inflows, cumulative };
      });

      const boardTasks: any[] = [];
      for (const proj of targetProjects) {
        const items = await storage.getStageItems(proj.id);
        const boardItems = items.filter((i: any) => i.isBoardLevel);
        for (const item of boardItems) {
          boardTasks.push({
            ...item,
            projectName: proj.name,
            projectNameAr: proj.name,
          });
        }
      }

      res.json({
        portfolioValue: totalProjectCost,
        totalEquityRequired: totalEquity,
        totalSalesTarget: totalSalesTarget,
        totalOutflows,
        activeProjects: allProjects.filter(p => p.status === "Active").length,
        totalProjects: allProjects.length,
        pendingRequestsCount: pendingRequests.length,
        openDirectivesCount: openDirectives.length,
        boardTasks,
        monthlyData,
        projects: allProjects.map(p => ({ id: p.id, name: p.name, nameAr: p.name, status: p.status })),
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/agents", async (_req, res) => {
    try {
      const agents = await storage.getAiAgents();
      res.json(agents);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/agents/:id", async (req, res) => {
    try {
      const agent = await storage.getAiAgent(req.params.id);
      if (!agent) return res.status(404).json({ message: "Agent not found" });
      res.json(agent);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/agents/seed", async (_req, res) => {
    try {
      const agentDefinitions = [
        {
          id: "salwa",
          nameEn: "Salwa",
          nameAr: "سلوى",
          roleEn: "Main Coordinator",
          roleAr: "المنسقة الرئيسية",
          descriptionEn: "Executive AI coordinator — manages workflows, delegates to other agents, interfaces with leadership and clients",
          descriptionAr: "منسقة ذكاء اصطناعي تنفيذية — تدير سير العمل وتنسق بين الوكلاء وتتواصل مع القيادة والعملاء",
          avatarColor: "#F59E0B",
          avatarInitial: "S",
          toolIds: ["list_projects", "get_project_detail", "get_wallet_balances", "get_rera_status", "get_sensitivity_analysis", "get_dashboard_summary", "search_knowledge_base", "get_feasibility_studies", "calculate_buyer_default"],
          capabilities: ["email_triage", "task_delegation", "client_communication", "workflow_orchestration", "project_overview"],
          status: "active" as const,
          sortOrder: 0,
        },
        {
          id: "khazen",
          nameEn: "Khazen",
          nameAr: "خازن",
          roleEn: "Document Archivist",
          roleAr: "أمين الأرشيف",
          descriptionEn: "Specialized in document archival — reads attachments, classifies files, extracts land/property data, creates project records",
          descriptionAr: "متخصص في الأرشفة — يقرأ المرفقات ويصنف الملفات ويستخرج بيانات الأراضي وينشئ سجلات المشاريع",
          avatarColor: "#6366F1",
          avatarInitial: "خ",
          toolIds: [],
          capabilities: ["document_parsing", "file_classification", "data_extraction", "project_creation", "archival_naming"],
          status: "coming_soon" as const,
          sortOrder: 1,
        },
        {
          id: "joelle",
          nameEn: "Joelle",
          nameAr: "جويل",
          roleEn: "Feasibility Studies & Market Analyst",
          roleAr: "محللة دراسات الجدوى والسوق",
          descriptionEn: "Researches market data, auto-populates feasibility studies with construction costs, sale prices, and financial projections for Dubai real estate",
          descriptionAr: "تبحث في بيانات السوق وتعبئ دراسات الجدوى تلقائياً بتكاليف البناء وأسعار البيع والتوقعات المالية لعقارات دبي",
          avatarColor: "#8B5CF6",
          avatarInitial: "J",
          toolIds: ["get_project_detail", "get_feasibility_studies", "get_sensitivity_analysis", "search_knowledge_base"],
          capabilities: ["feasibility_modeling", "financial_projections", "market_analysis", "scenario_building", "report_generation"],
          status: "active" as const,
          sortOrder: 2,
        },
        {
          id: "farouq",
          nameEn: "Farouq",
          nameAr: "فاروق",
          roleEn: "Legal Advisor",
          roleAr: "المستشار القانوني",
          descriptionEn: "Analyzes contracts, SPAs, and legal documents — identifies risks, suggests amendments, ensures RERA compliance",
          descriptionAr: "يحلل العقود والملاحق والمستندات القانونية — يبرز المخاطر ويقترح التعديلات ويضمن الالتزام بقوانين ريرا",
          avatarColor: "#059669",
          avatarInitial: "F",
          toolIds: [],
          capabilities: ["contract_analysis", "risk_identification", "rera_compliance", "amendment_drafting", "legal_research"],
          status: "coming_soon" as const,
          sortOrder: 3,
        },
        {
          id: "elena",
          nameEn: "Elena",
          nameAr: "إلينا",
          roleEn: "Financial Controller",
          roleAr: "المراقبة المالية",
          descriptionEn: "Reads and explains financial reports, analyzes cash flows, models scenarios, and presents data to leadership and investors",
          descriptionAr: "تقرأ وتشرح التقارير المالية وتحلل التدفقات النقدية وتبني السيناريوهات وتعرض البيانات للقيادة والمستثمرين",
          avatarColor: "#DC2626",
          avatarInitial: "E",
          toolIds: [],
          capabilities: ["financial_reporting", "cashflow_analysis", "scenario_modeling", "investor_presentation", "budget_tracking"],
          status: "coming_soon" as const,
          sortOrder: 4,
        },
      ];

      const results = [];
      for (const agent of agentDefinitions) {
        const result = await storage.upsertAiAgent(agent);
        results.push(result);
      }
      res.json({ message: "Agents seeded", agents: results });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/agent-tasks", async (req, res) => {
    try {
      const { agentId, status } = req.query;
      const tasks = await storage.getAgentTasks(agentId as string, status as string);
      res.json(tasks);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/agent-tasks", async (req, res) => {
    try {
      const data = insertAgentTaskSchema.parse(req.body);
      const task = await storage.createAgentTask(data);
      res.status(201).json(task);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/report-versions", async (req, res) => {
    try {
      const studyId = req.query.studyId ? Number(req.query.studyId) : undefined;
      const versions = await storage.getReportVersions(studyId);
      res.json(versions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/report-versions/board", async (_req, res) => {
    try {
      const versions = await storage.getLatestBoardVersions();
      res.json(versions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/report-versions", async (req, res) => {
    try {
      const data = insertReportVersionSchema.parse(req.body);
      const version = await storage.createReportVersion(data);
      res.status(201).json(version);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/report-versions/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const existing = await storage.getReportVersion(id);
      if (!existing) return res.status(404).json({ message: "Version not found" });
      if (existing.versionStatus === "board_issue") {
        return res.status(403).json({ message: "Board Issue versions are immutable and cannot be modified" });
      }
      const version = await storage.updateReportVersion(id, req.body);
      res.json(version);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/report-versions/:studyId/publish", async (req, res) => {
    try {
      const studyId = Number(req.params.studyId);
      const study = await storage.getFeasibilityStudy(studyId);
      if (!study) return res.status(404).json({ message: "Study not found" });

      const existingVersions = await storage.getReportVersions(studyId);
      const boardVersions = existingVersions.filter(v => v.versionStatus === "board_issue");
      const nextMajor = boardVersions.length + 1;
      const versionNumber = `${nextMajor}.0`;

      const { computeFinancials } = await import("./feasibility-report");

      const financials = computeFinancials(study);

      const profitMargin = financials.gdv > 0 ? (financials.netProfit / financials.gdv) * 100 : 0;

      let riskLevel: "green" | "yellow" | "red" = "yellow";
      if (financials.roi > 25 && profitMargin > 15) riskLevel = "green";
      else if (financials.roi < 10 || profitMargin < 5) riskLevel = "red";

      let recommendation: "go" | "go_with_adjustment" | "hold" | "no_go" = "hold";
      if (riskLevel === "green") recommendation = "go";
      else if (riskLevel === "yellow") recommendation = "go_with_adjustment";
      else recommendation = "no_go";

      let requiredAction = "مراجعة الدراسة";
      if (recommendation === "go") requiredAction = "الموافقة على إطلاق المشروع";
      else if (recommendation === "go_with_adjustment") requiredAction = "مراجعة التسعير وإعادة التقييم";
      else if (recommendation === "no_go") requiredAction = "رفض المشروع — المخاطر عالية";

      const version = await storage.createReportVersion({
        feasibilityStudyId: studyId,
        projectId: study.projectId,
        versionNumber,
        versionStatus: "board_issue",
        gdv: financials.gdv.toString(),
        tdc: financials.tdc.toString(),
        netProfit: financials.netProfit.toString(),
        profitMarginPct: profitMargin.toFixed(2),
        projectIrr: financials.roi.toFixed(2),
        equityIrr: (financials.roi * 1.3).toFixed(2),
        expectedSalesDuration: "18-24 شهر",
        fundingGap: financials.requiredInjection > 0 ? financials.requiredInjection.toString() : "0",
        riskLevel,
        recommendation,
        requiredAction,
        reportSnapshot: JSON.stringify({
          executiveSummary: study.reportExecutiveSummary,
          recommendations: study.reportRecommendations,
          riskAnalysis: study.reportRiskAnalysis,
        }),
      });

      res.status(201).json(version);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/command-center", async (_req, res) => {
    try {
      const allProjects = await storage.getProjects();
      const allStudies = await storage.getFeasibilityStudies();
      const boardVersions = await storage.getLatestBoardVersions();
      const inquiries = await storage.getInquiries();

      const { computeFinancials } = await import("./feasibility-report");

      const latestBoardByProject = new Map<string, typeof boardVersions[0]>();
      for (const v of boardVersions) {
        if (v.projectId && !latestBoardByProject.has(v.projectId)) {
          latestBoardByProject.set(v.projectId, v);
        }
      }

      const projectSummaries = allProjects.map(project => {
        const study = allStudies.find(s => s.projectId === project.id);
        const boardVersion = latestBoardByProject.get(project.id);

        if (boardVersion) {
          return {
            projectId: project.id,
            projectName: project.name,
            location: project.location,
            projectType: study?.landUse || "Mixed Use",
            status: boardVersion.versionStatus,
            versionNumber: boardVersion.versionNumber,
            gdv: Number(boardVersion.gdv || 0),
            tdc: Number(boardVersion.tdc || 0),
            netProfit: Number(boardVersion.netProfit || 0),
            profitMarginPct: Number(boardVersion.profitMarginPct || 0),
            projectIrr: Number(boardVersion.projectIrr || 0),
            equityIrr: Number(boardVersion.equityIrr || 0),
            expectedSalesDuration: boardVersion.expectedSalesDuration || "—",
            fundingGap: Number(boardVersion.fundingGap || 0),
            riskLevel: boardVersion.riskLevel || "yellow",
            recommendation: boardVersion.recommendation || "hold",
            requiredAction: boardVersion.requiredAction || "—",
            issuedAt: boardVersion.issuedAt || boardVersion.createdAt,
            executiveBrief: study?.reportExecutiveBrief || null,
            studyId: study?.id || null,
          };
        }

        if (study) {
          const financials = computeFinancials(study);
          const profitMargin = financials.gdv > 0 ? (financials.netProfit / financials.gdv) * 100 : 0;
          let riskLevel: string = "yellow";
          if (financials.roi > 25 && profitMargin > 15) riskLevel = "green";
          else if (financials.roi < 10 || profitMargin < 5) riskLevel = "red";

          return {
            projectId: project.id,
            projectName: project.name,
            location: project.location,
            projectType: study.landUse || "Mixed Use",
            status: study.reportStatus || "draft",
            versionNumber: "Draft",
            gdv: financials.gdv,
            tdc: financials.tdc,
            netProfit: financials.netProfit,
            profitMarginPct: profitMargin,
            projectIrr: financials.roi,
            equityIrr: financials.roi * 1.3,
            expectedSalesDuration: "—",
            fundingGap: financials.requiredInjection > 0 ? financials.requiredInjection : 0,
            riskLevel,
            recommendation: "hold",
            requiredAction: "الدراسة تحت المراجعة",
            issuedAt: null,
            executiveBrief: study.reportExecutiveBrief || null,
            studyId: study.id,
          };
        }

        return {
          projectId: project.id,
          projectName: project.name,
          location: project.location,
          projectType: "—",
          status: "pre_study",
          versionNumber: "—",
          gdv: 0, tdc: 0, netProfit: 0, profitMarginPct: 0,
          projectIrr: 0, equityIrr: 0,
          expectedSalesDuration: "—", fundingGap: 0,
          riskLevel: "yellow", recommendation: "hold",
          requiredAction: "لم تبدأ الدراسة بعد",
          issuedAt: null,
          executiveBrief: null,
          studyId: null,
        };
      });

      res.json({
        projects: projectSummaries,
        inquiries: inquiries.slice(0, 20),
        totalProjects: allProjects.length,
        boardReadyCount: boardVersions.length,
        pendingInquiries: inquiries.filter(i => i.status === "open").length,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/inquiries", async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const inquiries = await storage.getInquiries(status);
      res.json(inquiries);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/inquiries", async (req, res) => {
    try {
      const data = insertCommandCenterInquirySchema.parse(req.body);
      const inquiry = await storage.createInquiry(data);
      res.status(201).json(inquiry);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/inquiries/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const inquiry = await storage.updateInquiry(id, req.body);
      res.json(inquiry);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ─── AI Governance Engine ───
  app.post("/api/governance/review/:studyId", async (req, res) => {
    try {
      const studyId = Number(req.params.studyId);
      const result = await runGovernanceReview(studyId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/governance/review-and-govern/:studyId", async (req, res) => {
    try {
      const studyId = Number(req.params.studyId);
      const result = await runGovernanceAndPublish(studyId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ─── Source Registry ───
  app.get("/api/sources", async (_req, res) => {
    try {
      const sources = await storage.getSources();
      res.json(sources);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/sources", async (req, res) => {
    try {
      const data = insertSourceRegistrySchema.parse(req.body);
      const source = await storage.createSource(data);
      res.status(201).json(source);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: error.errors });
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/sources/:id", async (req, res) => {
    try {
      const source = await storage.updateSource(Number(req.params.id), req.body);
      res.json(source);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ─── Project Assumptions ───
  app.get("/api/assumptions/:projectId", async (req, res) => {
    try {
      const assumptions = await storage.getAssumptions(req.params.projectId);
      res.json(assumptions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/assumptions", async (req, res) => {
    try {
      const data = insertProjectAssumptionSchema.parse(req.body);
      const assumption = await storage.createAssumption(data);
      res.status(201).json(assumption);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: error.errors });
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/assumptions/:id", async (req, res) => {
    try {
      const assumption = await storage.updateAssumption(Number(req.params.id), req.body);
      res.json(assumption);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/assumptions/:id/approve", async (req, res) => {
    try {
      const { approvedBy, rationale } = req.body;
      const assumption = await storage.approveAssumption(Number(req.params.id), approvedBy || "abdulrahman", rationale);
      res.json(assumption);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ─── Project Scenarios ───
  app.get("/api/scenarios/:projectId", async (req, res) => {
    try {
      const scenarios = await storage.getScenarios(req.params.projectId);
      res.json(scenarios);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/scenarios", async (req, res) => {
    try {
      const data = insertProjectScenarioSchema.parse(req.body);
      const scenario = await storage.createScenario(data);
      res.status(201).json(scenario);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: error.errors });
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/scenarios/:id", async (req, res) => {
    try {
      const scenario = await storage.updateScenario(Number(req.params.id), req.body);
      res.json(scenario);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/scenarios/:id", async (req, res) => {
    try {
      await storage.deleteScenario(Number(req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ─── Conflict Records ───
  app.get("/api/conflicts/:projectId", async (req, res) => {
    try {
      const conflicts = await storage.getConflicts(req.params.projectId);
      res.json(conflicts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/conflicts", async (req, res) => {
    try {
      const data = insertConflictRecordSchema.parse(req.body);
      const conflict = await storage.createConflict(data);
      res.status(201).json(conflict);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: error.errors });
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/conflicts/:id/resolve", async (req, res) => {
    try {
      const { resolvedValue, resolution, resolvedBy, rationale } = req.body;
      const conflict = await storage.resolveConflict(
        Number(req.params.id), resolvedValue, resolution || "resolved_owner", resolvedBy || "abdulrahman", rationale
      );
      res.json(conflict);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ─── Audit Log ───
  app.get("/api/audit-log", async (req, res) => {
    try {
      const projectId = req.query.projectId as string | undefined;
      const limit = req.query.limit ? Number(req.query.limit) : 100;
      const log = await storage.getAuditLog(projectId, limit);
      res.json(log);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ─── Reconciliation Ledger ───
  app.get("/api/reconciliation-ledger/:projectId", async (req, res) => {
    try {
      const entries = await storage.getReconciliationLedger(req.params.projectId);
      res.json(entries);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/reconciliation-ledger/entry/:id", async (req, res) => {
    try {
      const entry = await storage.getReconciliationLedgerEntry(Number(req.params.id));
      if (!entry) return res.status(404).json({ message: "Entry not found" });
      res.json(entry);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/reconciliation-ledger", async (req, res) => {
    try {
      const data = insertReconciliationLedgerSchema.parse(req.body);
      const entry = await storage.createReconciliationLedgerEntry(data);
      res.status(201).json(entry);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: error.errors });
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/reconciliation-ledger/:id", async (req, res) => {
    try {
      const entry = await storage.updateReconciliationLedgerEntry(Number(req.params.id), req.body);
      res.json(entry);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/reconciliation-ledger/:id", async (req, res) => {
    try {
      await storage.deleteReconciliationLedgerEntry(Number(req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ─── Competitor Projects ───
  app.get("/api/competitors/:projectId", async (req, res) => {
    try {
      const competitors = await storage.getCompetitorProjects(req.params.projectId);
      res.json(competitors);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/competitors/entry/:id", async (req, res) => {
    try {
      const competitor = await storage.getCompetitorProject(Number(req.params.id));
      if (!competitor) return res.status(404).json({ message: "Competitor not found" });
      res.json(competitor);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/competitors", async (req, res) => {
    try {
      const data = insertCompetitorProjectSchema.parse(req.body);
      const competitor = await storage.createCompetitorProject(data);
      res.status(201).json(competitor);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: error.errors });
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/competitors/:id", async (req, res) => {
    try {
      const competitor = await storage.updateCompetitorProject(Number(req.params.id), req.body);
      res.json(competitor);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/competitors/:id", async (req, res) => {
    try {
      await storage.deleteCompetitorProject(Number(req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ─── Project Documents ───
  app.get("/api/documents/:projectId", async (req, res) => {
    try {
      const documents = await storage.getProjectDocuments(req.params.projectId);
      res.json(documents);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/documents/entry/:id", async (req, res) => {
    try {
      const document = await storage.getProjectDocument(Number(req.params.id));
      if (!document) return res.status(404).json({ message: "Document not found" });
      res.json(document);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/documents", async (req, res) => {
    try {
      const data = insertProjectDocumentSchema.parse(req.body);
      const document = await storage.createProjectDocument(data);
      res.status(201).json(document);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: error.errors });
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/documents/:id", async (req, res) => {
    try {
      const document = await storage.updateProjectDocument(Number(req.params.id), req.body);
      res.json(document);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/documents/:id", async (req, res) => {
    try {
      await storage.deleteProjectDocument(Number(req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ─── Source Registry Seed ───
  app.post("/api/sources/seed", async (_req, res) => {
    try {
      const existing = await storage.getSources();
      if (existing.length > 0) {
        return res.json({ message: "Sources already seeded", count: existing.length });
      }

      const dubaiSources = [
        {
          name: "Dubai Land Department (DLD)",
          tier: "tier1_official" as const,
          accessMethod: "manual_file" as const,
          url: "https://dubailand.gov.ae",
          description: "Official government registry for all real estate transactions, title deeds, and property registrations in Dubai",
          fieldsProvided: ["transaction_price", "transaction_date", "property_type", "area", "plot_number", "buyer_nationality", "mortgage_data"],
          refreshCadence: "Daily",
          licenseNotes: "Government open data; some datasets require registration",
          isActive: true,
        },
        {
          name: "Property Monitor (PM)",
          tier: "tier2_primary" as const,
          accessMethod: "manual_file" as const,
          url: "https://propertymonitor.ae",
          description: "Comprehensive real estate analytics platform covering Dubai transactions, supply pipeline, and market trends",
          fieldsProvided: ["avg_price_psf", "transaction_volume", "supply_pipeline", "absorption_rate", "rental_yields", "market_trends"],
          refreshCadence: "Monthly",
          licenseNotes: "Subscription required; enterprise license for API access",
          isActive: true,
        },
        {
          name: "REIDIN",
          tier: "tier2_primary" as const,
          accessMethod: "manual_file" as const,
          url: "https://reidin.com",
          description: "Real estate information and analytics for emerging markets including Dubai; indices and benchmarking data",
          fieldsProvided: ["price_index", "rental_index", "area_benchmarks", "historical_trends", "comparable_transactions"],
          refreshCadence: "Monthly",
          licenseNotes: "Subscription required; data licensing terms apply",
          isActive: true,
        },
        {
          name: "JLL (Jones Lang LaSalle)",
          tier: "tier3_professional" as const,
          accessMethod: "manual_file" as const,
          url: "https://jll.ae",
          description: "Global real estate services firm providing market research, valuations, and advisory for Dubai property market",
          fieldsProvided: ["market_outlook", "sector_reports", "capital_values", "rental_rates", "vacancy_rates", "investment_volumes"],
          refreshCadence: "Quarterly",
          licenseNotes: "Public reports available; detailed data requires engagement",
          isActive: true,
        },
        {
          name: "CBRE",
          tier: "tier3_professional" as const,
          accessMethod: "manual_file" as const,
          url: "https://cbre.ae",
          description: "Commercial real estate services and investment firm with comprehensive Dubai market coverage and analytics",
          fieldsProvided: ["market_reports", "rental_analysis", "investment_yields", "occupancy_rates", "development_pipeline"],
          refreshCadence: "Quarterly",
          licenseNotes: "Public reports available; bespoke research requires engagement",
          isActive: true,
        },
        {
          name: "Knight Frank (KF)",
          tier: "tier3_professional" as const,
          accessMethod: "manual_file" as const,
          url: "https://knightfrank.ae",
          description: "Global property consultancy providing residential and commercial market intelligence for Dubai",
          fieldsProvided: ["prime_residential_index", "luxury_market_data", "wealth_report", "rental_analysis", "capital_values"],
          refreshCadence: "Quarterly",
          licenseNotes: "Public reports available; detailed data by request",
          isActive: true,
        },
        {
          name: "Property Finder (PF)",
          tier: "tier4_listings" as const,
          accessMethod: "scrape" as const,
          url: "https://propertyfinder.ae",
          description: "Leading property portal in Dubai with extensive listings data for sales and rentals across all segments",
          fieldsProvided: ["listing_prices", "asking_rents", "inventory_count", "days_on_market", "agent_listings", "area_coverage"],
          refreshCadence: "Real-time",
          licenseNotes: "Public listing data; bulk access requires partnership",
          isActive: true,
        },
        {
          name: "Bayut",
          tier: "tier4_listings" as const,
          accessMethod: "scrape" as const,
          url: "https://bayut.com",
          description: "Major property listings platform in UAE providing asking prices, inventory, and market trends for Dubai",
          fieldsProvided: ["listing_prices", "asking_rents", "market_trends", "popular_areas", "price_per_sqft", "inventory_levels"],
          refreshCadence: "Real-time",
          licenseNotes: "Public listing data; API access via partnership",
          isActive: true,
        },
        {
          name: "Dubai Statistics Center (DSC/DDSE)",
          tier: "tier1_official" as const,
          accessMethod: "manual_file" as const,
          url: "https://dsc.gov.ae",
          description: "Official statistical authority providing demographic, economic, and sectoral data for Dubai emirate",
          fieldsProvided: ["population_data", "gdp_growth", "employment_stats", "tourism_data", "construction_permits", "trade_data"],
          refreshCadence: "Quarterly",
          licenseNotes: "Government open data portal",
          isActive: true,
        },
        {
          name: "Data.Dubai (Smart Dubai)",
          tier: "tier1_official" as const,
          accessMethod: "api" as const,
          url: "https://data.dubai.ae",
          description: "Dubai's open data platform providing government datasets across various sectors including real estate and infrastructure",
          fieldsProvided: ["building_permits", "infrastructure_projects", "population_density", "land_use_data", "utility_connections"],
          refreshCadence: "Monthly",
          licenseNotes: "Open data; API access available",
          isActive: true,
        },
        {
          name: "DubaiNow",
          tier: "tier1_official" as const,
          accessMethod: "api" as const,
          url: "https://dubainow.com",
          description: "Unified government services platform providing access to various Dubai government data and services",
          fieldsProvided: ["ejari_data", "trakheesi_permits", "utility_bills", "government_fees", "service_requests"],
          refreshCadence: "Real-time",
          licenseNotes: "Government platform; integration via API",
          isActive: true,
        },
        {
          name: "Dubai REST",
          tier: "tier1_official" as const,
          accessMethod: "api" as const,
          url: "https://dubairest.gov.ae",
          description: "Dubai Real Estate Self Transaction platform by DLD providing transaction data, valuations, and property information",
          fieldsProvided: ["transaction_history", "property_valuations", "ownership_records", "mortgage_status", "noc_status", "escrow_accounts"],
          refreshCadence: "Real-time",
          licenseNotes: "Government platform; requires DLD account",
          isActive: true,
        },
      ];

      const results = [];
      for (const source of dubaiSources) {
        const created = await storage.createSource(source);
        results.push(created);
      }

      res.json({ message: "12 Dubai data sources seeded successfully", count: results.length, sources: results });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // === Export Engine: PDF + Excel ===

  app.get("/api/feasibility-studies/:id/export/excel", async (req, res) => {
    try {
      const { generateExcel } = await import("./export-engine");
      const studyId = parseInt(req.params.id);
      const study = await storage.getFeasibilityStudy(studyId);
      if (!study) return res.status(404).json({ message: "Study not found" });
      const buf = await generateExcel(studyId);
      const filename = `COMO_Feasibility_${(study.projectName || "Study").replace(/\s+/g, "_")}_${new Date().toISOString().slice(0,10)}.xlsx`;
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(buf);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/feasibility-studies/:id/export/pdf", async (req, res) => {
    try {
      const { generatePDFBuffer } = await import("./export-engine");
      const studyId = parseInt(req.params.id);
      const study = await storage.getFeasibilityStudy(studyId);
      if (!study) return res.status(404).json({ message: "Study not found" });
      const buffer = await generatePDFBuffer(studyId);
      const filename = `COMO_Feasibility_${(study.projectName || "Report").replace(/\s+/g, "_")}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // === Version Control: Submit for Governance + Issue to Board ===

  app.post("/api/feasibility-studies/:id/submit-governance", async (req, res) => {
    try {
      const { computeFinancials } = await import("./feasibility-report");
      const studyId = parseInt(req.params.id);
      const study = await storage.getFeasibilityStudy(studyId);
      if (!study) return res.status(404).json({ message: "Study not found" });
      const fin = computeFinancials(study);
      const profitMargin = fin.gdv > 0 ? (fin.netProfit / fin.gdv) * 100 : 0;
      let riskLevel: "green" | "yellow" | "red" = "yellow";
      if (fin.roi > 25 && profitMargin > 15) riskLevel = "green";
      else if (fin.roi < 10 || profitMargin < 5) riskLevel = "red";

      const version = await storage.createReportVersion({
        feasibilityStudyId: studyId,
        projectId: study.projectId || null,
        versionNumber: "1.0",
        versionStatus: "draft",
        gdv: String(Math.round(fin.gdv)),
        tdc: String(Math.round(fin.tdc)),
        netProfit: String(Math.round(fin.netProfit)),
        profitMarginPct: String(Math.round(profitMargin * 100) / 100),
        projectIrr: null,
        equityIrr: null,
        expectedSalesDuration: null,
        fundingGap: String(Math.round(fin.requiredInjection)),
        riskLevel,
        recommendation: null,
        requiredAction: null,
        reportSnapshot: JSON.stringify(study),
        technicalValidation: null,
        financialValidation: null,
        legalValidation: null,
        validatedBy: null,
      });
      res.json({ success: true, version });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/feasibility-studies/:id/validate-governance", async (req, res) => {
    try {
      const { versionId, validationType, result, validatedBy } = req.body;
      if (!versionId || !validationType || !result) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      const updates: any = { validatedBy, validatedAt: new Date() };
      if (validationType === "technical") updates.technicalValidation = result;
      if (validationType === "financial") updates.financialValidation = result;
      if (validationType === "legal") updates.legalValidation = result;

      const version = await storage.updateReportVersion(versionId, updates);
      if (version.technicalValidation && version.financialValidation && version.legalValidation) {
        await storage.updateReportVersion(versionId, { versionStatus: "governed", versionNumber: "1.1" });
      }
      res.json({ success: true, version });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/feasibility-studies/:id/issue-board", async (req, res) => {
    try {
      const studyId = parseInt(req.params.id);
      const { versionId, recommendation, requiredAction } = req.body;
      if (!versionId) return res.status(400).json({ message: "Missing versionId" });
      const version = await storage.updateReportVersion(versionId, {
        versionStatus: "board_issue",
        versionNumber: "2.0",
        recommendation: recommendation || null,
        requiredAction: requiredAction || null,
        issuedAt: new Date(),
      });
      res.json({ success: true, version });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/feasibility-studies/:id/versions", async (req, res) => {
    try {
      const versions = await storage.getReportVersions(parseInt(req.params.id));
      res.json(versions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/projects/:id/capital/events", async (req, res) => {
    try {
      const events = await storage.getCapitalEvents(req.params.id);
      res.json(events);
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  app.post("/api/capital/events", async (req, res) => {
    try {
      const data = insertCapitalEventSchema.parse(req.body);
      const snapshot = await applyCapitalEvent(data);
      res.json({ snapshot });
    } catch (error: any) { res.status(400).json({ message: error.message }); }
  });

  app.get("/api/projects/:id/capital/balances", async (req, res) => {
    try {
      let bal = await storage.getCapitalBalance(req.params.id);
      if (!bal) bal = await recomputeBalances(req.params.id) as any;
      res.json(bal);
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  app.get("/api/portfolio/capital", async (_req, res) => {
    try {
      const metrics = await computePortfolioCapital();
      res.json(metrics);
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  app.post("/api/portfolio/recompute", async (_req, res) => {
    try {
      const metrics = await computePortfolioCapital();
      res.json(metrics);
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  app.get("/api/projects/:id/regulatory", async (req, res) => {
    try {
      const nodes = await storage.getRegulatoryNodes(req.params.id);
      res.json(nodes);
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  app.post("/api/projects/:id/regulatory", async (req, res) => {
    try {
      const data = insertRegulatoryNodeSchema.parse({ ...req.body, projectId: req.params.id });
      const node = await storage.createRegulatoryNode(data);
      res.json(node);
    } catch (error: any) { res.status(400).json({ message: error.message }); }
  });

  app.patch("/api/regulatory/:id", async (req, res) => {
    try {
      const node = await storage.updateRegulatoryNode(parseInt(req.params.id), req.body);
      res.json(node);
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  app.post("/api/projects/:id/regulatory/seed", async (req, res) => {
    try {
      const nodeTypes = [
        "DLD_TITLE", "RERA_DEV_REG", "ESCROW_OPENING", "QS_TCC_CERT",
        "MUNICIPALITY_PLANNING", "BUILDING_PERMIT", "CIVIL_DEFENSE",
        "DEWA_NOC", "MASTER_DEV_NOC", "OQOOD_ACTIVATION",
        "PROJECT_REG_RERA", "COMPLETION_CERT", "UNIT_TITLE_ISSUANCE"
      ];
      const existing = await storage.getRegulatoryNodes(req.params.id);
      if (existing.length > 0) { res.json(existing); return; }
      const nodes = [];
      for (const nt of nodeTypes) {
        const n = await storage.createRegulatoryNode({ projectId: req.params.id, nodeType: nt as any, status: "NOT_STARTED" });
        nodes.push(n);
      }
      res.json(nodes);
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  app.get("/api/projects/:id/ipcs", async (req, res) => {
    try {
      const list = await storage.getIPCs(req.params.id);
      res.json(list);
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  app.post("/api/projects/:id/ipcs", async (req, res) => {
    try {
      const data = insertIPCSchema.parse({ ...req.body, projectId: req.params.id });
      const ipc = await storage.createIPC(data);
      onIPCCreated(req.params.id, ipc.id).catch(console.error);
      res.json(ipc);
    } catch (error: any) { res.status(400).json({ message: error.message }); }
  });

  app.patch("/api/ipcs/:id/approve", async (req, res) => {
    try {
      const ipc = await storage.updateIPC(parseInt(req.params.id), { status: "APPROVED", approvedBy: req.body.approvedBy || "owner", approvedAt: new Date() });
      res.json(ipc);
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  app.post("/api/ipcs/:id/pay", async (req, res) => {
    try {
      const ipc = await storage.updateIPC(parseInt(req.params.id), { status: "PAID", paidAt: new Date() });
      res.json(ipc);
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  app.get("/api/projects/:id/vos", async (req, res) => {
    try {
      const list = await storage.getVariationOrders(req.params.id);
      res.json(list);
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  app.post("/api/projects/:id/vos", async (req, res) => {
    try {
      const data = insertVariationOrderSchema.parse({ ...req.body, projectId: req.params.id });
      const vo = await storage.createVariationOrder(data);
      res.json(vo);
    } catch (error: any) { res.status(400).json({ message: error.message }); }
  });

  app.patch("/api/vos/:id", async (req, res) => {
    try {
      const vo = await storage.updateVariationOrder(parseInt(req.params.id), req.body);
      res.json(vo);
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  app.get("/api/projects/:id/risk", async (req, res) => {
    try {
      const risk = await computeProjectRisk(req.params.id);
      res.json(risk);
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  app.post("/api/projects/:id/risk/recompute", async (req, res) => {
    try {
      const risk = await computeProjectRisk(req.params.id);
      res.json(risk);
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  app.get("/api/portfolio/risk", async (_req, res) => {
    try {
      const projects = await storage.getProjects();
      const risks = [];
      for (const p of projects) {
        const score = await storage.getRiskScore(p.id);
        risks.push({ projectId: p.id, projectName: p.name, ...score });
      }
      res.json(risks);
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  app.get("/api/projects/:id/transitions", async (req, res) => {
    try {
      const list = await storage.getProjectStateTransitions(req.params.id);
      res.json(list);
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  app.post("/api/projects/:id/transition", async (req, res) => {
    try {
      const { toState, reason, triggeredBy } = req.body;
      const transitions = await storage.getProjectStateTransitions(req.params.id);
      const fromState = transitions.length > 0 ? transitions[0].toState : null;
      const bal = await storage.getCapitalBalance(req.params.id);
      const transition = await storage.createProjectStateTransition({
        projectId: req.params.id, fromState, toState, reason,
        triggeredBy: triggeredBy || "owner",
        gatesPassed: req.body.gatesPassed || [],
        capitalSnapshot: bal || {},
      });
      res.json(transition);
    } catch (error: any) { res.status(400).json({ message: error.message }); }
  });

  app.get("/api/projects/:id/contracts", async (req, res) => {
    try {
      const list = await storage.getContracts(req.params.id);
      res.json(list);
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  app.post("/api/projects/:id/contracts", async (req, res) => {
    try {
      const data = insertContractSchema.parse({ ...req.body, projectId: req.params.id });
      const contract = await storage.createContract(data);
      res.json(contract);
    } catch (error: any) { res.status(400).json({ message: error.message }); }
  });

  app.patch("/api/contracts/:id", async (req, res) => {
    try {
      const contract = await storage.updateContract(parseInt(req.params.id), req.body);
      res.json(contract);
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  app.get("/api/projects/:id/units", async (req, res) => {
    try {
      const list = await storage.getSalesUnits(req.params.id);
      res.json(list);
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  app.post("/api/projects/:id/units", async (req, res) => {
    try {
      const data = insertSalesUnitSchema.parse({ ...req.body, projectId: req.params.id });
      const unit = await storage.createSalesUnit(data);
      res.json(unit);
    } catch (error: any) { res.status(400).json({ message: error.message }); }
  });

  app.patch("/api/units/:id", async (req, res) => {
    try {
      const unit = await storage.updateSalesUnit(parseInt(req.params.id), req.body);
      res.json(unit);
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  app.get("/api/projects/:id/gates", async (req, res) => {
    try {
      const list = await storage.getGovernanceGates(req.params.id);
      res.json(list);
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  app.post("/api/projects/:id/gates", async (req, res) => {
    try {
      const data = insertGovernanceGateSchema.parse({ ...req.body, projectId: req.params.id });
      const gate = await storage.createGovernanceGate(data);
      res.json(gate);
    } catch (error: any) { res.status(400).json({ message: error.message }); }
  });

  app.patch("/api/gates/:id", async (req, res) => {
    try {
      const gate = await storage.updateGovernanceGate(parseInt(req.params.id), req.body);
      res.json(gate);
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  app.get("/api/projects/:id/payment-plans", async (req, res) => {
    try {
      const list = await storage.getPaymentPlans(req.params.id);
      res.json(list);
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  app.post("/api/projects/:id/payment-plans", async (req, res) => {
    try {
      const data = insertPaymentPlanSchema.parse({ ...req.body, projectId: req.params.id });
      const plan = await storage.createPaymentPlan(data);
      res.json(plan);
    } catch (error: any) { res.status(400).json({ message: error.message }); }
  });

  app.get("/api/portfolio/dashboard", async (_req, res) => {
    try {
      const capital = await computePortfolioCapital();
      const projects = await storage.getProjects();
      const projectRisks = [];
      for (const p of projects) {
        const risk = await storage.getRiskScore(p.id);
        const bal = await storage.getCapitalBalance(p.id);
        const events = await storage.getCapitalEvents(p.id);
        let totalCashOut = 0;
        for (const ev of events) {
          if (ev.eventType === "BURN_PAYMENT" || ev.eventType === "ESCROW_DEPOSIT" || ev.eventType === "VO_COST") {
            totalCashOut += Number(ev.amount);
          }
        }
        const projFin = await storage.getProjectFinancial(p.id);
        const equityRequired = projFin ? parseFloat(projFin.equityRequired || "0") : 0;
        projectRisks.push({
          id: p.id, name: p.name, status: p.status, location: p.location,
          riskLevel: risk?.riskLevel || "LOW", totalRisk: risk?.totalRisk || "0",
          lsr: risk?.lsr || "0", ecr: risk?.ecr || "0",
          c1: bal?.c1FreeEquity || 0, c3: bal?.c3EscrowLocked || 0, c4: bal?.c4DeployedBurn || 0,
          c5: bal?.c5RetentionHeld || 0, totalCashOut, equityRequired,
        });
      }
      res.json({ capital, projects: projectRisks });
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  app.post("/api/projects/:id/documents/upload", upload.single("file"), async (req: any, res) => {
    try {
      if (!req.file) { res.status(400).json({ message: "No file uploaded" }); return; }
      const projectId = req.params.id;
      const doc = await storage.createProjectDocument({
        projectId,
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        documentType: "other",
        uploadedBy: req.body.uploadedBy || "owner",
        notes: req.body.notes,
      });
      onDocumentUploaded(projectId, doc.id, req.file.path, req.file.mimetype).catch(console.error);
      res.json(doc);
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  app.get("/api/documents/:id/extractions", async (req, res) => {
    try {
      const runs = await storage.getExtractionRuns(parseInt(req.params.id));
      const result = [];
      for (const run of runs) {
        const fields = await storage.getExtractionFields(run.id);
        result.push({ ...run, fields });
      }
      res.json(result);
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  app.get("/api/agent-runs", async (req, res) => {
    try {
      const { agentId, projectId } = req.query;
      const runs = await storage.getAgentRuns(agentId as string, projectId as string);
      res.json(runs);
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  app.get("/api/agent-runs/:id", async (req, res) => {
    try {
      const run = await storage.getAgentRun(parseInt(req.params.id));
      if (!run) { res.status(404).json({ message: "Run not found" }); return; }
      const outputs = await storage.getAgentOutputs(run.id);
      res.json({ ...run, outputs });
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  app.post("/api/agents/:agentId/run", async (req, res) => {
    try {
      const { agentId } = req.params;
      const { projectId } = req.body;
      const runners: Record<string, any> = {
        khazen: AGENT_RUNNERS.documentAgent,
        farouq: AGENT_RUNNERS.contractAgent,
        "alina-finance": AGENT_RUNNERS.financeAgent,
        "alina-qs": AGENT_RUNNERS.qsTccAgent,
        "khaled-risk": AGENT_RUNNERS.riskAgent,
        "khaled-ipc": AGENT_RUNNERS.ipcAgent,
        baraq: AGENT_RUNNERS.regulatoryAgent,
        baz: AGENT_RUNNERS.salesAgent,
        joelle: AGENT_RUNNERS.economicBrainAgent,
      };
      const runner = runners[agentId];
      if (!runner) { res.status(404).json({ message: "Agent runner not found" }); return; }
      runner.execute(projectId || "portfolio", { trigger: "manual" }).catch(console.error);
      res.json({ message: "Agent run started", agentId, projectId });
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  app.get("/api/recommendations", async (req, res) => {
    try {
      const { projectId, status } = req.query;
      const list = await storage.getRecommendations(projectId as string, status as string);
      res.json(list);
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  app.patch("/api/recommendations/:id", async (req, res) => {
    try {
      const updated = await storage.updateRecommendation(parseInt(req.params.id), req.body);
      res.json(updated);
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  app.get("/api/alerts", async (req, res) => {
    try {
      const { projectId } = req.query;
      const acknowledged = req.query.acknowledged === "true" ? true : req.query.acknowledged === "false" ? false : undefined;
      const list = await storage.getAlerts(projectId as string, acknowledged);
      res.json(list);
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  app.patch("/api/alerts/:id/acknowledge", async (req, res) => {
    try {
      const updated = await storage.updateAlert(parseInt(req.params.id), {
        acknowledged: true,
        acknowledgedBy: req.body.acknowledgedBy || "owner",
        acknowledgedAt: new Date(),
      });
      res.json(updated);
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  app.get("/api/proposals", async (req, res) => {
    try {
      const { projectId, status } = req.query;
      const list = await storage.getReconciliationProposals(projectId as string, status as string);
      const withItems = [];
      for (const p of list) {
        const items = await storage.getProposalItems(p.id);
        withItems.push({ ...p, items });
      }
      res.json(withItems);
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  app.post("/api/proposals/:id/approve", async (req, res) => {
    try {
      const result = await applyApprovedProposal(parseInt(req.params.id), req.body.approvedBy || "owner");
      res.json(result);
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  app.post("/api/proposals/:id/reject", async (req, res) => {
    try {
      await rejectProposal(parseInt(req.params.id), req.body.rejectedBy || "owner", req.body.reason || "");
      res.json({ success: true });
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  app.get("/api/draft-decisions", async (req, res) => {
    try {
      const { projectId, status } = req.query;
      const list = await storage.getDraftDecisions(projectId as string, status as string);
      res.json(list);
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  app.post("/api/draft-decisions/:id/approve", async (req, res) => {
    try {
      await applyDraftDecision(parseInt(req.params.id), req.body.decidedBy || "owner");
      res.json({ success: true });
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  app.post("/api/draft-decisions/:id/reject", async (req, res) => {
    try {
      await rejectDraftDecision(parseInt(req.params.id), req.body.decidedBy || "owner");
      res.json({ success: true });
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  app.get("/api/inbox", async (_req, res) => {
    try {
      const inbox = await storage.getPendingInboxItems();
      res.json(inbox);
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  const BOARD_USERS: Record<string, string> = {
    abdulrahman: "owner",
    sheikh_isa: "partner",
    wael: "partner",
  };
  function requireBoardAccess(req: any, res: any): string | null {
    const userId = req.body?.userId || req.query?.userId;
    if (!userId || !BOARD_USERS[userId]) {
      res.status(403).json({ message: "Access denied: board role required" });
      return null;
    }
    return userId;
  }
  function requireOwnerAccess(req: any, res: any): string | null {
    const userId = req.body?.userId || req.query?.userId;
    if (!userId || BOARD_USERS[userId] !== "owner") {
      res.status(403).json({ message: "Access denied: owner role required" });
      return null;
    }
    return userId;
  }

  app.post("/api/board/layla/chat", async (req, res) => {
    try {
      const userId = requireBoardAccess(req, res);
      if (!userId) return;
      const { message, projectId } = req.body;
      if (!message) {
        res.status(400).json({ message: "message is required" });
        return;
      }
      const answer = await answerBoardQuestion(userId, message, projectId);
      res.json({ answer, intent: "answer_question" });
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  app.post("/api/board/layla/stream", async (req, res) => {
    try {
      const userId = requireBoardAccess(req, res);
      if (!userId) return;
      const { message, projectId } = req.body;
      if (!message) {
        res.status(400).json({ message: "message is required" });
        return;
      }
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      await streamLaylaChat(userId, message, projectId, (chunk) => {
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      });
      res.write(`data: [DONE]\n\n`);
      res.end();
    } catch (error: any) {
      if (!res.headersSent) {
        res.status(500).json({ message: error.message });
      } else {
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
      }
    }
  });

  app.post("/api/board/layla/explain-decision", async (req, res) => {
    try {
      const userId = requireBoardAccess(req, res);
      if (!userId) return;
      const { decisionId } = req.body;
      if (!decisionId) {
        res.status(400).json({ message: "decisionId is required" });
        return;
      }
      const answer = await explainDecision(userId, decisionId);
      res.json({ answer });
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  app.post("/api/board/layla/summarize-project", async (req, res) => {
    try {
      const userId = requireBoardAccess(req, res);
      if (!userId) return;
      const { projectId } = req.body;
      if (!projectId) {
        res.status(400).json({ message: "projectId is required" });
        return;
      }
      const answer = await summarizeProject(userId, projectId);
      res.json({ answer });
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  app.post("/api/board/layla/summarize-portfolio", async (req, res) => {
    try {
      const userId = requireBoardAccess(req, res);
      if (!userId) return;
      const answer = await summarizePortfolio(userId);
      res.json({ answer });
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  app.get("/api/board/layla/history", async (req, res) => {
    try {
      const userId = requireBoardAccess(req, res);
      if (!userId) return;
      const conversations = await storage.getLaylaConversations(userId, 50);
      res.json(conversations.reverse());
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  app.post("/api/board/cache/refresh", async (req, res) => {
    try {
      const userId = requireOwnerAccess(req, res);
      if (!userId) return;
      await refreshBoardCaches();
      res.json({ success: true, message: "Board caches refreshed" });
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  app.get("/api/board/portfolio", async (req, res) => {
    try {
      const userId = requireBoardAccess(req, res);
      if (!userId) return;
      const cache = await storage.getBoardPortfolioCache();
      res.json(cache || null);
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  app.get("/api/board/projects", async (req, res) => {
    try {
      const userId = requireBoardAccess(req, res);
      if (!userId) return;
      const caches = await storage.getBoardProjectCaches();
      res.json(caches);
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  app.get("/api/board/decisions", async (req, res) => {
    try {
      const userId = requireBoardAccess(req, res);
      if (!userId) return;
      const { projectId, status } = req.query;
      const decisions = await storage.getBoardDecisions(projectId as string, status as string);
      res.json(decisions);
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  app.post("/api/seed-demo-project", async (_req, res) => {
    try {
      const project = await storage.createProject({
        name: "مشروع ند الشبا – تجريبي",
        location: "Nad Al Sheba, Dubai",
        plotNumber: "6189999",
        areaCode: "NAS-DEMO",
        totalGFA: "55000.00",
        sellableArea: "48000.00",
        constructionCostPerSqft: "380.00",
        status: "Pre-study",
        ddaNumber: "DDA-NAS-6189999",
        masterDevRef: "NASGNA19-DEMO",
        plotAreaSqm: "1700.00",
        plotAreaSqft: "18300.00",
        gfaSqm: "5110.00",
        gfaSqft: "55000.00",
        buaSqft: "120000.00",
        permittedUse: "Residential Apartments (G+2P+8)",
        ownershipType: "Single Ownership Property",
        masterDevName: "Shamal Estates LLC",
        masterDevAddress: "P.O. Box 123311, Dubai, UAE",
        sellerName: "محمد أحمد الفلاسي",
        sellerAddress: "دبي، الإمارات",
        buyerName: "COMO Real Estate Development",
        buyerNationality: "UAE",
        buyerPhone: "+971-50-1234567",
        buyerEmail: "info@como-dev.com",
        electricityAllocation: "180 kW",
        waterAllocation: "30 m³/day",
        sewageAllocation: "25 m³/day",
        effectiveDate: "2025",
        constructionPeriod: "24 months",
        constructionStartDate: "Q2 2025",
        completionDate: "Q2 2027",
        notes: "مشروع تجريبي — G+2P+8 سكني. (20) 2BHK + (40) 1BHK = 60 وحدة. مسبح، جيم، ملعب أطفال، 80 موقف سيارات."
      });

      const pid = project.id;

      await storage.createFeasibilityStudy({
        projectId: pid,
        projectName: "مشروع ند الشبا – تجريبي",
        projectLocation: "Nad Al Sheba, Dubai",
        projectDescription: "مبنى سكني G+2P+8 يتضمن 60 وحدة سكنية",
        plotArea: "18300",
        totalGFA: "55000",
        gfaResidential: "48000",
        gfaRetail: "5000",
        gfaOffices: "2000",
        landPrice: "15000000",
        agentCommission: "2",
        soilInvestigation: "150000",
        topographySurvey: "75000",
        constructionArea: "55000",
        saleableAreaResidential: "43200",
        saleableAreaRetail: "4500",
        constructionCostPerSqft: "380",
        salePricePerSqft: "1850",
        salePriceRetailPerSqft: "2200",
        salePriceOfficesPerSqft: "1650",
        designFeePercent: "2",
        supervisionFeePercent: "1.75",
        authoritiesFee: "250000",
        communityFee: "180000",
        contingencies: "2",
        developerFeePercent: "5",
        agentCommissionSalesPercent: "5",
        marketingPercent: "2",
        reraFees: "420000",
        finishesQuality: "Premium",
        projectFacilities: ["Swimming Pool", "Gym", "Kids Play Area", "BBQ Area"],
        unitsCount: "60",
        unitsMix: "20x 2BHK + 40x 1BHK",
        status: "active",
      });

      const mainContract = await storage.createContract({
        projectId: pid,
        contractorName: "Al Habtoor Engineering",
        contractorNameAr: "الحبتور للمقاولات",
        contractType: "MAIN_CONTRACTOR",
        contractValue: 20900000,
        retentionPercent: "10",
        performanceBondPercent: "10",
        ldTerms: "5,000 AED/day delay after 24 months",
        startDate: "2025-06-01",
        endDate: "2027-06-01",
        status: "ACTIVE",
      });
      const designContract = await storage.createContract({
        projectId: pid,
        contractorName: "AECOM Middle East",
        contractorNameAr: "إيكوم الشرق الأوسط",
        contractType: "DESIGN_CONSULTANT",
        contractValue: 1650000,
        retentionPercent: "5",
        performanceBondPercent: "5",
        startDate: "2025-03-01",
        endDate: "2027-09-01",
        status: "ACTIVE",
      });
      await storage.createContract({
        projectId: pid,
        contractorName: "Hill International",
        contractorNameAr: "هيل إنترناشيونال",
        contractType: "PMC",
        contractValue: 980000,
        retentionPercent: "5",
        startDate: "2025-05-01",
        endDate: "2027-07-01",
        status: "ACTIVE",
      });

      const events = [
        { eventType: "EQUITY_INJECT" as const, amount: 8500000, toState: "C1" as const, description: "ضخ رأسمال المؤسسين — الدفعة الأولى" },
        { eventType: "EQUITY_INJECT" as const, amount: 4200000, toState: "C1" as const, description: "ضخ رأسمال إضافي — الشريك الاستراتيجي" },
        { eventType: "EQUITY_INJECT" as const, amount: 3300000, toState: "C1" as const, description: "تحويل إضافي — صندوق الطوارئ" },
        { eventType: "ESCROW_DEPOSIT" as const, amount: 5600000, fromState: "C1" as const, toState: "C3" as const, description: "إيداع حساب الضمان — مبيعات الربع الأول" },
        { eventType: "ESCROW_DEPOSIT" as const, amount: 3800000, fromState: "C1" as const, toState: "C3" as const, description: "إيداع حساب الضمان — مبيعات الربع الثاني" },
        { eventType: "BURN_PAYMENT" as const, amount: 2100000, fromState: "C3" as const, toState: "C4" as const, description: "دفعة المقاول — IPC #1 أعمال الأساسات", referenceType: "IPC" },
        { eventType: "BURN_PAYMENT" as const, amount: 3200000, fromState: "C3" as const, toState: "C4" as const, description: "دفعة المقاول — IPC #2 الهيكل الخرساني", referenceType: "IPC" },
        { eventType: "BURN_PAYMENT" as const, amount: 1500000, fromState: "C3" as const, toState: "C4" as const, description: "دفعة المقاول — IPC #3 أعمال البلوك", referenceType: "IPC" },
        { eventType: "RETENTION_HOLD" as const, amount: 680000, fromState: "C4" as const, toState: "C5" as const, description: "احتجاز 10% — IPC #1+#2+#3" },
        { eventType: "SALES_RECEIPT" as const, amount: 4200000, toState: "C3" as const, description: "تحصيل أقساط مشترين — الدفعة الثالثة" },
        { eventType: "BURN_PAYMENT" as const, amount: 2800000, fromState: "C3" as const, toState: "C4" as const, description: "دفعة المقاول — IPC #4 MEP مرحلة أولى", referenceType: "IPC" },
        { eventType: "VO_COST" as const, amount: 450000, fromState: "C1" as const, toState: "C4" as const, description: "أمر تغيير — تحسين واجهات زجاجية", referenceType: "VO" },
      ];
      for (const ev of events) {
        await storage.createCapitalEvent({ projectId: pid, ...ev });
      }

      const totalEquity = 8500000 + 4200000 + 3300000;
      const totalEscrowIn = 5600000 + 3800000 + 4200000;
      const totalBurn = 2100000 + 3200000 + 1500000 + 2800000 + 450000;
      const totalRetention = 680000;
      const c1 = totalEquity - (5600000 + 3800000) - 450000;
      const c3 = totalEscrowIn - totalBurn + totalRetention;
      const c4 = totalBurn;
      const c5 = totalRetention;
      await storage.upsertCapitalBalance(pid, {
        projectId: pid,
        c1FreeEquity: c1,
        c2CommittedEquity: 0,
        c3EscrowLocked: c3,
        c4DeployedBurn: c4,
        c5RetentionHeld: c5,
        liquidityReal: c1 + Math.max(0, c3 - c5),
      });

      const ipcData = [
        { ipcNumber: 1, periodFrom: "2025-06-01", periodTo: "2025-08-31", grossCertifiedValue: 2100000, retentionDeduction: 210000, netPayable: 1890000, physicalProgress: 12, status: "PAID" as const, contractId: mainContract.id },
        { ipcNumber: 2, periodFrom: "2025-09-01", periodTo: "2025-11-30", grossCertifiedValue: 3200000, retentionDeduction: 320000, netPayable: 2880000, physicalProgress: 28, status: "PAID" as const, contractId: mainContract.id },
        { ipcNumber: 3, periodFrom: "2025-12-01", periodTo: "2026-02-28", grossCertifiedValue: 1500000, retentionDeduction: 150000, netPayable: 1350000, physicalProgress: 38, status: "APPROVED" as const, contractId: mainContract.id },
        { ipcNumber: 4, periodFrom: "2026-03-01", periodTo: "2026-05-31", grossCertifiedValue: 2800000, retentionDeduction: 280000, netPayable: 2520000, physicalProgress: 52, status: "SUBMITTED" as const, contractId: mainContract.id },
        { ipcNumber: 5, periodFrom: "2026-06-01", periodTo: "2026-08-31", grossCertifiedValue: 3500000, retentionDeduction: 350000, netPayable: 3150000, physicalProgress: 65, status: "DRAFT" as const, contractId: mainContract.id },
      ];
      for (const ipc of ipcData) {
        await storage.createIPC({ projectId: pid, ...ipc });
      }

      const voData = [
        { voNumber: "VO-001", voType: "VO_A_DEVELOPER" as const, title: "Upgraded Glass Facades", titleAr: "تحسين الواجهات الزجاجية", description: "ترقية الزجاج من مزدوج إلى ثلاثي العزل مع طلاء حراري", estimatedCost: 450000, approvedCost: 420000, status: "APPROVED" as const, impactOnTCC: 420000, impactOnScheduleDays: 15, cumulativeVOPercent: "2.010", contractId: mainContract.id },
        { voNumber: "VO-002", voType: "VO_B_AUTHORITY" as const, title: "Fire Escape Stairwell Addition", titleAr: "إضافة درج طوارئ إضافي", description: "متطلب الدفاع المدني — درج إضافي في الجهة الشرقية", estimatedCost: 680000, status: "UNDER_REVIEW" as const, impactOnTCC: 680000, impactOnScheduleDays: 30, cumulativeVOPercent: "5.260", contractId: mainContract.id },
        { voNumber: "VO-003", voType: "VO_C_CONTRACTOR" as const, title: "Soil Remediation Extra", titleAr: "معالجة تربة إضافية", description: "اكتشاف طبقة صخرية غير متوقعة تتطلب تكسير إضافي", estimatedCost: 320000, approvedCost: 290000, status: "APPROVED" as const, impactOnTCC: 290000, impactOnScheduleDays: 10, cumulativeVOPercent: "6.648", contractId: mainContract.id },
      ];
      for (const vo of voData) {
        await storage.createVariationOrder({ projectId: pid, ...vo });
      }

      await storage.createGovernanceGate({ projectId: pid, gateCode: "G1_RERA_20", gateName: "RERA 20% Deposit", gateNameAr: "إيداع 20% ريرا", status: "PASSED", requiredConditions: { minDeposit: "20% of TCC" }, decidedBy: "abdulrahman" });
      await storage.createGovernanceGate({ projectId: pid, gateCode: "G2_ESCROW_OPEN", gateName: "Escrow Account Opening", gateNameAr: "فتح حساب الضمان", status: "PASSED", requiredConditions: { bank: "Emirates NBD", accountType: "RERA Escrow" }, decidedBy: "abdulrahman" });
      await storage.createGovernanceGate({ projectId: pid, gateCode: "G3_SALES_LAUNCH", gateName: "Sales Launch Approval", gateNameAr: "اعتماد إطلاق المبيعات", status: "PASSED", requiredConditions: { minProgress: "20%", marketingReady: true }, decidedBy: "abdulrahman" });
      await storage.createGovernanceGate({ projectId: pid, gateCode: "G4_DESIGN_FREEZE", gateName: "Design Freeze", gateNameAr: "تجميد التصميم", status: "PASSED", requiredConditions: { designApproval: true, clientSignoff: true } });
      await storage.createGovernanceGate({ projectId: pid, gateCode: "G5_CONTRACT_AWARD", gateName: "Main Contract Award", gateNameAr: "ترسية العقد الرئيسي", status: "PASSED", requiredConditions: { minBids: 3, boardApproval: true }, decidedBy: "sheikh_isa" });
      await storage.createGovernanceGate({ projectId: pid, gateCode: "G6_HANDOVER", gateName: "Handover Readiness", gateNameAr: "جاهزية التسليم", status: "PENDING", requiredConditions: { completionCert: true, snagging: "completed", utilities: "connected" } });

      const unitTypes = [
        { type: "1BHK", area: "650", price: 1202500, count: 40 },
        { type: "2BHK", area: "950", price: 1757500, count: 20 },
      ];
      const statuses = ["AVAILABLE", "RESERVED", "SOLD", "HANDED_OVER"] as const;
      const buyers = ["أحمد الكعبي", "فاطمة المنصوري", "خالد العامري", "مريم السويدي", "علي الهاشمي", "نورة الشامسي", "سعيد الدرمكي", "هند المهيري"];
      let unitIdx = 0;
      for (const ut of unitTypes) {
        for (let i = 0; i < ut.count; i++) {
          unitIdx++;
          const floor = Math.ceil(unitIdx / 8);
          let status: typeof statuses[number] = "AVAILABLE";
          let buyerName: string | undefined;
          let salePrice: number | undefined;
          let saleDate: string | undefined;
          let oqoodRegistered = false;
          if (unitIdx <= 22) { status = "SOLD"; buyerName = buyers[(unitIdx - 1) % buyers.length]; salePrice = ut.price; saleDate = "2025-" + String(3 + Math.floor((unitIdx-1)/5)).padStart(2, "0") + "-15"; oqoodRegistered = true; }
          else if (unitIdx <= 30) { status = "RESERVED"; buyerName = buyers[(unitIdx - 1) % buyers.length]; salePrice = ut.price; }
          await storage.createSalesUnit({
            projectId: pid,
            unitNumber: `${ut.type === "1BHK" ? "A" : "B"}${String(unitIdx).padStart(3, "0")}`,
            unitType: ut.type,
            floor,
            area: ut.area,
            askingPrice: ut.price,
            status,
            buyerName,
            salePrice,
            saleDate,
            oqoodRegistered,
          });
        }
      }

      await storage.createPaymentPlan({
        projectId: pid,
        planName: "Standard 15/45/40",
        planNameAr: "الخطة الأساسية 15/45/40",
        totalAmount: 1202500,
        installments: [
          { milestone: "Booking", percent: 15, amount: 180375, dueDate: "On Booking" },
          { milestone: "Foundation Complete", percent: 10, amount: 120250, dueDate: "Month 6" },
          { milestone: "Superstructure 50%", percent: 10, amount: 120250, dueDate: "Month 12" },
          { milestone: "Superstructure 100%", percent: 10, amount: 120250, dueDate: "Month 15" },
          { milestone: "MEP Rough-in", percent: 10, amount: 120250, dueDate: "Month 18" },
          { milestone: "Finishing", percent: 5, amount: 60125, dueDate: "Month 21" },
          { milestone: "Handover", percent: 40, amount: 481000, dueDate: "On Handover" },
        ],
      });
      await storage.createPaymentPlan({
        projectId: pid,
        planName: "Premium 20/50/30",
        planNameAr: "الخطة المميزة 20/50/30",
        totalAmount: 1757500,
        installments: [
          { milestone: "Booking", percent: 20, amount: 351500, dueDate: "On Booking" },
          { milestone: "Foundation Complete", percent: 15, amount: 263625, dueDate: "Month 6" },
          { milestone: "Superstructure 50%", percent: 10, amount: 175750, dueDate: "Month 12" },
          { milestone: "Superstructure 100%", percent: 10, amount: 175750, dueDate: "Month 15" },
          { milestone: "MEP Rough-in", percent: 10, amount: 175750, dueDate: "Month 18" },
          { milestone: "Finishing", percent: 5, amount: 87875, dueDate: "Month 21" },
          { milestone: "Handover", percent: 30, amount: 527250, dueDate: "On Handover" },
        ],
      });

      await storage.createRegulatoryNode({ projectId: pid, nodeType: "DLD_TITLE", status: "APPROVED", documentRef: "TD-2025-NAS-6189999", notes: "سند ملكية مسجّل" });
      await storage.createRegulatoryNode({ projectId: pid, nodeType: "RERA_DEV_REG", status: "APPROVED", documentRef: "RERA-DEV-2025-0184", notes: "تسجيل مطوّر معتمد" });
      await storage.createRegulatoryNode({ projectId: pid, nodeType: "ESCROW_OPENING", status: "APPROVED", documentRef: "ESC-ENBD-2025-443", notes: "حساب ضمان بنك الإمارات دبي الوطني" });
      await storage.createRegulatoryNode({ projectId: pid, nodeType: "QS_TCC_CERT", status: "APPROVED", documentRef: "QS-TCC-2025-0087", notes: "شهادة تكلفة البناء — 20.9M درهم" });
      await storage.createRegulatoryNode({ projectId: pid, nodeType: "MUNICIPALITY_PLANNING", status: "APPROVED", documentRef: "DM-PLAN-2025-1123", notes: "موافقة التخطيط" });
      await storage.createRegulatoryNode({ projectId: pid, nodeType: "BUILDING_PERMIT", status: "APPROVED", documentRef: "BP-2025-NAS-7892", notes: "رخصة بناء صادرة" });
      await storage.createRegulatoryNode({ projectId: pid, nodeType: "CIVIL_DEFENSE", status: "APPROVED", documentRef: "CD-2025-1456", notes: "موافقة الدفاع المدني" });
      await storage.createRegulatoryNode({ projectId: pid, nodeType: "DEWA_NOC", status: "APPROVED", documentRef: "DEWA-NOC-2025-8834", notes: "عدم ممانعة كهرباء ومياه" });
      await storage.createRegulatoryNode({ projectId: pid, nodeType: "MASTER_DEV_NOC", status: "APPROVED", documentRef: "SHAMAL-NOC-2025-045", notes: "عدم ممانعة المطور الرئيسي" });
      await storage.createRegulatoryNode({ projectId: pid, nodeType: "OQOOD_ACTIVATION", status: "IN_PROGRESS", documentRef: "OQOOD-2025-PENDING", notes: "تفعيل نظام عقود — قيد التسجيل" });
      await storage.createRegulatoryNode({ projectId: pid, nodeType: "PROJECT_REG_RERA", status: "APPROVED", documentRef: "RERA-PROJ-2025-0312", notes: "تسجيل مشروع في ريرا" });
      await storage.createRegulatoryNode({ projectId: pid, nodeType: "COMPLETION_CERT", status: "NOT_STARTED", notes: "لم يبدأ — المشروع قيد البناء" });
      await storage.createRegulatoryNode({ projectId: pid, nodeType: "UNIT_TITLE_ISSUANCE", status: "NOT_STARTED", notes: "لم يبدأ — يعتمد على شهادة الإنجاز" });

      const transitions = [
        { fromState: null, toState: "S0_ACTIVATED" as const, triggeredBy: "abdulrahman", reason: "تفعيل المشروع — إيداع 20% ريرا مكتمل", capitalSnapshot: { c1: 16000000 } },
        { fromState: "S0_ACTIVATED" as const, toState: "S1_CONSULTANTS_PROCURED" as const, triggeredBy: "abdulrahman", reason: "ترسية عقود التصميم والإشراف — AECOM + Hill", gatesPassed: ["G1_RERA_20"] },
        { fromState: "S1_CONSULTANTS_PROCURED" as const, toState: "S2_DESIGN_IN_PROGRESS" as const, triggeredBy: "system", reason: "بدء مرحلة التصميم", gatesPassed: ["G4_DESIGN_FREEZE"] },
        { fromState: "S2_DESIGN_IN_PROGRESS" as const, toState: "S3_REGULATORY_IN_PROGRESS" as const, triggeredBy: "system", reason: "تقديم طلبات التصاريح" },
        { fromState: "S3_REGULATORY_IN_PROGRESS" as const, toState: "S4_READY_FOR_TENDER" as const, triggeredBy: "system", reason: "اكتمال جميع التصاريح التنظيمية" },
        { fromState: "S4_READY_FOR_TENDER" as const, toState: "S5_TENDER_IN_PROGRESS" as const, triggeredBy: "abdulrahman", reason: "بدء المناقصات — 5 مقاولين مدعوين" },
        { fromState: "S5_TENDER_IN_PROGRESS" as const, toState: "S6_CONTRACT_AWARDED" as const, triggeredBy: "sheikh_isa", reason: "ترسية العقد الرئيسي — الحبتور للمقاولات", gatesPassed: ["G5_CONTRACT_AWARD"] },
        { fromState: "S6_CONTRACT_AWARDED" as const, toState: "S7_SALES_READY" as const, triggeredBy: "system", reason: "جاهزية إطلاق المبيعات" },
        { fromState: "S7_SALES_READY" as const, toState: "S8_SALES_ACTIVE" as const, triggeredBy: "abdulrahman", reason: "إطلاق المبيعات — 60 وحدة", gatesPassed: ["G3_SALES_LAUNCH"] },
        { fromState: "S8_SALES_ACTIVE" as const, toState: "S9_CONSTRUCTION_ACTIVE" as const, triggeredBy: "system", reason: "بدء التنفيذ — البناء والمبيعات معاً" },
      ];
      for (const t of transitions) {
        await storage.createProjectStateTransition({ projectId: pid, ...t });
      }

      await storage.injectFunds(pid, "Wallet_A", "16000000", "ضخ رأسمال كامل — إيداع 20% ريرا + تشغيلي");

      try {
        const { computeProjectRisk } = await import("./risk-engine");
        await computeProjectRisk(pid);
      } catch (e: any) { console.log("Risk compute note:", e.message); }

      const totalSold = 22;
      const totalReserved = 8;
      const totalUnits = 60;
      const salesPercent = Math.round(((totalSold + totalReserved) / totalUnits) * 100);

      res.json({
        message: `تم إنشاء مشروع تجريبي كامل بنجاح`,
        projectId: pid,
        summary: {
          contracts: 3,
          capitalEvents: events.length,
          ipcs: ipcData.length,
          variationOrders: voData.length,
          governanceGates: 6,
          salesUnits: totalUnits,
          soldUnits: totalSold,
          reservedUnits: totalReserved,
          salesProgress: `${salesPercent}%`,
          paymentPlans: 2,
          regulatoryNodes: 13,
          stateTransitions: transitions.length,
          capitalBalance: { C1: 5450000, C2: 2800000, C3: 3800000, C4: 10050000, C5: 680000 },
        }
      });
    } catch (error: any) {
      console.error("Seed error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  return httpServer;
}
