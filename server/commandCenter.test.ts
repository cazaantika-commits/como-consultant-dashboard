import { describe, expect, it, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "admin-user",
      email: "admin@como.ae",
      name: "Admin",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

// We test the command center router procedures
// Note: These tests use the actual database, so they depend on seeded data

describe("commandCenter.verifyAccess", () => {
  it("rejects an invalid token", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.commandCenter.verifyAccess({ token: "invalid_token_12345" })
    ).rejects.toThrow();
  });

  it("accepts a valid token and returns member info", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    // Use the token we seeded for abdulrahman
    const result = await caller.commandCenter.verifyAccess({
      token: "cc_abdulrahman_2026_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0",
    });
    expect(result).toBeDefined();
    expect(result.memberId).toBe("abdulrahman");
    expect(result.nameAr).toBe("عبدالرحمن");
    expect(result.role).toBe("admin");
  });

  it("accepts Wael's token", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.commandCenter.verifyAccess({
      token: "cc_wael_2026_z9y8x7w6v5u4t3s2r1q0p9o8n7m6l5k4j3i2h1g0f9e8d7c6b5a4z3y2x1w0v9u8t7s6r5q4p3o2n1",
    });
    expect(result.memberId).toBe("wael");
    expect(result.nameAr).toBe("وائل");
    expect(result.role).toBe("executive");
  });

  it("accepts Sheikh Issa's token", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.commandCenter.verifyAccess({
      token: "cc_sheikh_issa_2026_m1n2o3p4q5r6s7t8u9v0w1x2y3z4a5b6c7d8e9f0g1h2i3j4k5l6m7n8o9p0q1r2s3t4u5v6w7x8",
    });
    expect(result.memberId).toBe("sheikh_issa");
    expect(result.nameAr).toBe("الشيخ عيسى");
  });
});

describe("commandCenter.getBubbleCounts", () => {
  it("returns counts for all bubble types", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.commandCenter.getBubbleCounts({
      token: "cc_abdulrahman_2026_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0",
    });
    expect(result).toBeDefined();
    expect(typeof result.reports).toBe("number");
    expect(typeof result.requests).toBe("number");
    expect(typeof result.meeting_minutes).toBe("number");
    expect(typeof result.evaluations).toBe("number");
    expect(typeof result.announcements).toBe("number");
    expect(typeof result.unread).toBe("number");
  });

  it("rejects invalid token for bubble counts", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.commandCenter.getBubbleCounts({ token: "bad_token" })
    ).rejects.toThrow();
  });
});

describe("commandCenter.getItems", () => {
  it("returns items list (may be empty)", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.commandCenter.getItems({
      token: "cc_abdulrahman_2026_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0",
    });
    expect(Array.isArray(result)).toBe(true);
  });

  it("filters by bubble type", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.commandCenter.getItems({
      token: "cc_abdulrahman_2026_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0",
      bubbleType: "reports",
    });
    expect(Array.isArray(result)).toBe(true);
    // All items should be reports type
    result.forEach((item: any) => {
      expect(item.bubbleType).toBe("reports");
    });
  });
});

describe("commandCenter.createItem", () => {
  it("creates a new item in reports bubble", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.commandCenter.createItem({
      token: "cc_abdulrahman_2026_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0",
      bubbleType: "reports",
      title: "تقرير اختبار",
      content: "هذا تقرير اختبار من vitest",
      priority: "normal",
    });
    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
  });

  it("creates an urgent announcement", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.commandCenter.createItem({
      token: "cc_abdulrahman_2026_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0",
      bubbleType: "announcements",
      title: "إعلان عاجل",
      content: "إعلان اختبار عاجل",
      priority: "urgent",
    });
    expect(result).toBeDefined();
  });
});

describe("commandCenter.notifications", () => {
  it("returns notifications list", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.commandCenter.getNotifications({
      token: "cc_wael_2026_z9y8x7w6v5u4t3s2r1q0p9o8n7m6l5k4j3i2h1g0f9e8d7c6b5a4z3y2x1w0v9u8t7s6r5q4p3o2n1",
    });
    expect(Array.isArray(result)).toBe(true);
    // Wael should have notifications from the items created above
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("commandCenter.chatWithSalwa", () => {
  it("returns a response from Salwa", { timeout: 30000 }, async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.commandCenter.chatWithSalwa({
      token: "cc_abdulrahman_2026_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0",
      message: "مرحبا سلوى",
    });
    expect(result).toBeDefined();
    expect(result.response).toBeDefined();
    expect(typeof result.response).toBe("string");
    expect(result.response.length).toBeGreaterThan(0);
  });
});

describe("commandCenter.getChatHistory", () => {
  it("returns chat history", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.commandCenter.getChatHistory({
      token: "cc_abdulrahman_2026_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0",
    });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("commandCenter.evaluationSessions", () => {
  it("returns evaluation sessions list", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.commandCenter.getEvaluationSessions({
      token: "cc_abdulrahman_2026_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0",
    });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("commandCenter.getProjectsWithConsultants", () => {
  it("returns projects with consultants", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.commandCenter.getProjectsWithConsultants({
      token: "cc_abdulrahman_2026_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0",
    });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("commandCenter.listMembers (admin only)", () => {
  it("rejects non-admin users", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.commandCenter.listMembers()).rejects.toThrow();
  });

  it("returns members list for admin", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.commandCenter.listMembers();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(3);
    const memberIds = result.map((m: any) => m.memberId);
    expect(memberIds).toContain("abdulrahman");
    expect(memberIds).toContain("wael");
    expect(memberIds).toContain("sheikh_issa");
  });
});

// --- Milestones & KPIs Tests ---

const ABDULRAHMAN_TOKEN = "cc_abdulrahman_2026_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0";

describe("commandCenter.milestones", () => {
  let createdMilestoneId: number;

  it("returns milestones list (may be empty initially)", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.commandCenter.getMilestones({
      token: ABDULRAHMAN_TOKEN,
    });
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns milestones summary", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.commandCenter.getMilestonesSummary({
      token: ABDULRAHMAN_TOKEN,
    });
    expect(result).toBeDefined();
    expect(typeof result.total).toBe("number");
    expect(typeof result.completed).toBe("number");
    expect(typeof result.inProgress).toBe("number");
    expect(typeof result.delayed).toBe("number");
    expect(typeof result.overallProgress).toBe("number");
  });

  it("creates a new milestone", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.commandCenter.createMilestone({
      token: ABDULRAHMAN_TOKEN,
      projectId: 1,
      title: "Test Milestone",
      titleAr: "مرحلة اختبار",
      description: "This is a test milestone from vitest",
      category: "construction",
      priority: "high",
      assignedTo: "Test Engineer",
    });
    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    createdMilestoneId = result.id;
  });

  it("filters milestones by project", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.commandCenter.getMilestones({
      token: ABDULRAHMAN_TOKEN,
      projectId: 1,
    });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    result.forEach((m: any) => {
      expect(m.projectId).toBe(1);
    });
  });

  it("updates a milestone", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.commandCenter.updateMilestone({
      token: ABDULRAHMAN_TOKEN,
      id: createdMilestoneId,
      status: "completed",
      progressPercent: 100,
    });
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });

  it("deletes a milestone", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.commandCenter.deleteMilestone({
      token: ABDULRAHMAN_TOKEN,
      id: createdMilestoneId,
    });
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });

  it("rejects invalid token for milestones", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.commandCenter.getMilestones({ token: "bad_token" })
    ).rejects.toThrow();
  });
});

describe("commandCenter.kpis", () => {
  let createdKpiId: number;

  it("returns KPIs list (may be empty initially)", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.commandCenter.getKpis({
      token: ABDULRAHMAN_TOKEN,
    });
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns KPIs summary", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.commandCenter.getKpisSummary({
      token: ABDULRAHMAN_TOKEN,
    });
    expect(result).toBeDefined();
    expect(typeof result.total).toBe("number");
    expect(typeof result.onTrack).toBe("number");
    expect(typeof result.atRisk).toBe("number");
    expect(typeof result.offTrack).toBe("number");
  });

  it("creates a new KPI", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.commandCenter.createKpi({
      token: ABDULRAHMAN_TOKEN,
      projectId: 1,
      name: "Test KPI",
      nameAr: "مؤشر أداء اختبار",
      description: "This is a test KPI from vitest",
      category: "financial",
      status: "on_track",
      targetValue: "100",
      currentValue: "50",
      unit: "%",
    });
    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    createdKpiId = result.id;
  });

  it("filters KPIs by project", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.commandCenter.getKpis({
      token: ABDULRAHMAN_TOKEN,
      projectId: 1,
    });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    result.forEach((k: any) => {
      expect(k.projectId).toBe(1);
    });
  });

  it("updates a KPI", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.commandCenter.updateKpi({
      token: ABDULRAHMAN_TOKEN,
      id: createdKpiId,
      currentValue: "75",
      status: "at_risk",
    });
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });

  it("deletes a KPI", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.commandCenter.deleteKpi({
      token: ABDULRAHMAN_TOKEN,
      id: createdKpiId,
    });
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });

  it("rejects invalid token for KPIs", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.commandCenter.getKpis({ token: "bad_token" })
    ).rejects.toThrow();
  });
});

describe("commandCenter.getBubbleCounts includes milestones_kpis", () => {
  it("returns milestones_kpis count in bubble counts", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.commandCenter.getBubbleCounts({
      token: ABDULRAHMAN_TOKEN,
    });
    expect(result).toBeDefined();
    expect(typeof result.milestones_kpis).toBe("number");
  });
});

describe("commandCenter.evaluationSessions (full flow)", () => {
  const adminToken = "cc_abdulrahman_2026_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0";
  const waelToken = "cc_wael_2026_z9y8x7w6v5u4t3s2r1q0p9o8n7m6l5k4j3i2h1g0f9e8d7c6b5a4z3y2x1w0v9u8t7s6r5q4p3o2n1";
  
  it("creates an evaluation session (admin only)", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const projects = await caller.commandCenter.getProjectsWithConsultants({ token: adminToken });
    
    if (projects.length > 0 && projects[0].consultants.length > 0) {
      const result = await caller.commandCenter.createEvaluationSession({
        token: adminToken,
        projectId: Number(projects[0].id),
        consultantId: Number(projects[0].consultants[0].id),
        title: "جلسة تقييم تجريبية للاختبار",
      });
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.sessionId).toBeDefined();
    }
  });

  it("gets evaluation sessions list with details", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const sessions = await caller.commandCenter.getEvaluationSessions({ token: adminToken });
    expect(Array.isArray(sessions)).toBe(true);
    if (sessions.length > 0) {
      const session = sessions[0];
      expect(session).toHaveProperty("projectName");
      expect(session).toHaveProperty("consultantName");
      expect(session).toHaveProperty("completedCount");
      expect(session).toHaveProperty("requiredCount");
    }
  });

  it("submits an evaluation for a session", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const sessions = await caller.commandCenter.getEvaluationSessions({ token: adminToken });
    
    if (sessions.length > 0) {
      const sessionId = sessions[0].sessionId; // use sessionId string, not id number
      const scores = {
        architectural_identity: 90,
        bim_technology: 91,
        planning_efficiency: 87,
        cost_control: 85,
        similar_experience: 89,
        team_strength: 92,
        timeline_commitment: 91,
        project_interest: 90,
        contract_flexibility: 90,
      };
      
      // Calculate weighted total score
      const totalScore = 87.6;
      const result = await caller.commandCenter.submitEvaluation({
        token: adminToken,
        sessionId,
        scores,
        totalScore,
        notes: "تقييم تجريبي من الاختبار",
      });
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    }
  });

  it("prevents duplicate evaluation from same member", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const sessions = await caller.commandCenter.getEvaluationSessions({ token: adminToken });
    
    if (sessions.length > 0) {
      const sessionId = sessions[0].sessionId; // use sessionId string
      const scores = {
        architectural_identity: 85,
        bim_technology: 85,
        planning_efficiency: 85,
        cost_control: 85,
        similar_experience: 85,
        team_strength: 85,
        timeline_commitment: 85,
        project_interest: 85,
        contract_flexibility: 85,
      };
      
      await expect(
        caller.commandCenter.submitEvaluation({
          token: adminToken,
          sessionId,
          scores,
          totalScore: 85,
          notes: "تقييم مكرر",
        })
      ).rejects.toThrow();
    }
  });

  it("gets evaluation results (blind - should show pending until all complete)", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const sessions = await caller.commandCenter.getEvaluationSessions({ token: adminToken });
    
    if (sessions.length > 0) {
      const result = await caller.commandCenter.getEvaluationResults({
        token: adminToken,
        sessionId: sessions[0].sessionId,
      });
      expect(result).toBeDefined();
      expect(result.isRevealed).toBe(false);
      // allEvaluations should be null since not revealed
      expect(result.allEvaluations).toBeNull();
    }
  });

  it("rejects non-admin creating evaluation session", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const projects = await caller.commandCenter.getProjectsWithConsultants({ token: waelToken });
    
    if (projects.length > 0 && projects[0].consultants.length > 0) {
      await expect(
        caller.commandCenter.createEvaluationSession({
          token: waelToken,
          projectId: Number(projects[0].id),
          consultantId: Number(projects[0].consultants[0].id),
          title: "محاولة غير مصرح بها",
        })
      ).rejects.toThrow();
    }
  });
});

describe("commandCenter.newsTicker (announcements)", () => {
  const adminToken = "cc_abdulrahman_2026_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0";

  it("returns announcements for news ticker", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const items = await caller.commandCenter.getItems({
      token: adminToken,
      bubbleType: "announcements",
    });
    expect(Array.isArray(items)).toBe(true);
  });
});
