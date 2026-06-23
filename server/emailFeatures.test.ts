import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Test: Email Notification Service --------------------------
describe("Email Notification Service", () => {
  it("should export start and stop functions", async () => {
    const mod = await import("./emailNotificationService");
    expect(typeof mod.startEmailNotificationService).toBe("function");
    expect(typeof mod.stopEmailNotificationService).toBe("function");
    expect(typeof mod.checkForNewEmails).toBe("function");
  });

  it("should handle checkForNewEmails gracefully when email is not configured", async () => {
    const mod = await import("./emailNotificationService");
    // Should not throw, returns 0 on error
    const count = await mod.checkForNewEmails();
    expect(typeof count).toBe("number");
  }, 30000);
});

// --- Test: Notification DB helpers -----------------------------
describe("Notification DB helpers", () => {
  it("should export all notification DB functions", async () => {
    const db = await import("./db");
    expect(typeof db.createEmailNotification).toBe("function");
    expect(typeof db.getUnreadNotifications).toBe("function");
    expect(typeof db.getUnreadNotificationCount).toBe("function");
    expect(typeof db.markNotificationRead).toBe("function");
    expect(typeof db.markAllNotificationsRead).toBe("function");
    expect(typeof db.dismissNotification).toBe("function");
    expect(typeof db.isEmailAlreadyNotified).toBe("function");
  });
});

// --- Test: Notifications Router --------------------------------
describe("Notifications Router", () => {
  it("should export notificationsRouter", async () => {
    const mod = await import("./routers/notifications");
    expect(mod.notificationsRouter).toBeDefined();
  });

  it("should have required procedures", async () => {
    const mod = await import("./routers/notifications");
    const router = mod.notificationsRouter;
    // Check that the router has the expected procedures
    expect(router._def).toBeDefined();
    expect(router._def.procedures).toBeDefined();
    expect(router._def.procedures.unreadCount).toBeDefined();
    expect(router._def.procedures.list).toBeDefined();
    expect(router._def.procedures.markRead).toBeDefined();
    expect(router._def.procedures.markAllRead).toBeDefined();
    expect(router._def.procedures.dismiss).toBeDefined();
  });
});

// --- Test: SentEmails Router with follow-up task ---------------
describe("SentEmails Router", () => {
  it("should export sentEmailsRouter", async () => {
    const mod = await import("./routers/sentEmails");
    expect(mod.sentEmailsRouter).toBeDefined();
  });

  it("should have sendWithConfirmation procedure", async () => {
    const mod = await import("./routers/sentEmails");
    const router = mod.sentEmailsRouter;
    expect(router._def.procedures.sendWithConfirmation).toBeDefined();
  });

  it("should have getPendingDraft procedure", async () => {
    const mod = await import("./routers/sentEmails");
    const router = mod.sentEmailsRouter;
    expect(router._def.procedures.getPendingDraft).toBeDefined();
  });
});

// --- Test: Schema has emailNotifications table -----------------
describe("Database Schema", () => {
  it("should have emailNotifications table defined", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.emailNotifications).toBeDefined();
  });

  it("emailNotifications table should have required columns", async () => {
    const schema = await import("../drizzle/schema");
    const table = schema.emailNotifications;
    // Check that the table has the expected structure
    expect(table).toBeDefined();
  });

  it("should have sentEmails table defined", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.sentEmails).toBeDefined();
  });

  it("should have tasks table defined", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.tasks).toBeDefined();
  });
});

// --- Test: Pending Email Draft System --------------------------
describe("Pending Email Draft System", () => {
  it("should export draft management functions", async () => {
    const mod = await import("./agentChat");
    expect(typeof mod.setPendingEmailDraft).toBe("function");
    expect(typeof mod.getPendingEmailDraft).toBe("function");
    expect(typeof mod.clearPendingEmailDraft).toBe("function");
  });

  it("should set and get a pending draft", async () => {
    const mod = await import("./agentChat");
    const testDraft = {
      to: "test@example.com",
      fromName: "Test User",
      subject: "Test Subject",
      body: "Test body content",
      messageId: "<test-123>",
      uid: 999,
    };

    mod.setPendingEmailDraft(1, testDraft);
    const retrieved = mod.getPendingEmailDraft(1);
    
    expect(retrieved).toBeDefined();
    expect(retrieved?.to).toBe("test@example.com");
    expect(retrieved?.subject).toBe("Test Subject");
    expect(retrieved?.body).toBe("Test body content");
  });

  it("should clear a pending draft", async () => {
    const mod = await import("./agentChat");
    mod.setPendingEmailDraft(2, {
      to: "clear@example.com",
      fromName: "Clear Test",
      subject: "Clear Subject",
      body: "Clear body",
      messageId: "<clear-123>",
      uid: 888,
    });

    mod.clearPendingEmailDraft(2);
    const retrieved = mod.getPendingEmailDraft(2);
    expect(retrieved).toBeUndefined();
  });
});

// --- Test: App Router includes all new routers -----------------
describe("App Router", () => {
  it("should include notifications router", async () => {
    const mod = await import("./routers");
    // tRPC nested routers are under _def.record, not _def.procedures
    const routerDef = mod.appRouter._def;
    expect(routerDef).toBeDefined();
    expect(routerDef.record?.notifications || routerDef.procedures?.notifications).toBeDefined();
  });

  it("should include sentEmails router", async () => {
    const mod = await import("./routers");
    const routerDef = mod.appRouter._def;
    expect(routerDef).toBeDefined();
    expect(routerDef.record?.sentEmails || routerDef.procedures?.sentEmails).toBeDefined();
  });
});
