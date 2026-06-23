/**
 * Lifecycle Deadline Scheduler
 * Runs every 2 days at 8:00 AM Dubai time (UTC+4 = 04:00 UTC)
 * Checks all project service instances for overdue or upcoming deadlines (within 3 days)
 * and sends a notification to the owner.
 */

import { getDb } from "./db";
import {
  projectServiceInstances,
  lifecycleServices,
  lifecycleStages,
  projects,
} from "../drizzle/schema";
import { and, isNotNull, sql } from "drizzle-orm";
import { notifyOwner } from "./_core/notification";

let schedulerInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

async function runDeadlineCheck(): Promise<void> {
  if (isRunning) return;
  isRunning = true;
  try {
    const db = await getDb();
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const nowMs = now.getTime();
    const threeDaysMs = threeDaysFromNow.getTime();

    const instances = await db
      .select()
      .from(projectServiceInstances)
      .where(
        and(
          isNotNull(projectServiceInstances.plannedDueDate),
          sql`${projectServiceInstances.operationalStatus} NOT IN ('completed', 'submitted', 'na')`
        )
      );

    if (instances.length === 0) {
      console.log("[LifecycleScheduler] No pending services with due dates.");
      return;
    }

    const services = await db.select().from(lifecycleServices);
    const stages = await db.select().from(lifecycleStages);
    const projectsList = await db
      .select({ id: projects.id, name: projects.name })
      .from(projects);

    const overdueItems: string[] = [];
    const upcomingItems: string[] = [];

    for (const inst of instances) {
      if (!inst.plannedDueDate) continue;
      const dueMs = new Date(inst.plannedDueDate).getTime();
      const service = services.find((s) => s.serviceCode === inst.serviceCode);
      const stage = stages.find((s) => s.stageCode === service?.stageCode);
      const project = projectsList.find((p) => p.id === inst.projectId);
      const label = `[${project?.name ?? `مشروع ${inst.projectId}`}] ${stage?.nameAr ?? ""} > ${service?.nameAr ?? inst.serviceCode}`;
      const dueDate = new Date(inst.plannedDueDate).toLocaleDateString("ar-AE");

      if (dueMs < nowMs) {
        overdueItems.push(`• ${label} — موعد الاستحقاق: ${dueDate} (متأخرة)`);
      } else if (dueMs <= threeDaysMs) {
        upcomingItems.push(
          `• ${label} — موعد الاستحقاق: ${dueDate} (خلال 3 أيام)`
        );
      }
    }

    const alerts = [...overdueItems, ...upcomingItems];
    if (alerts.length === 0) {
      console.log("[LifecycleScheduler] No overdue or upcoming deadlines.");
      return;
    }

    const lines: string[] = [];
    if (overdueItems.length > 0) {
      lines.push(
        `🔴 خدمات متأخرة (${overdueItems.length}):\n${overdueItems.join("\n")}`
      );
    }
    if (upcomingItems.length > 0) {
      lines.push(
        `🟡 خدمات تستحق خلال 3 أيام (${upcomingItems.length}):\n${upcomingItems.join("\n")}`
      );
    }

    await notifyOwner({
      title: `تنبيه مواعيد DLD/RERA — ${alerts.length} خدمة تحتاج متابعة`,
      content: lines.join("\n\n"),
    });

    console.log(
      `[LifecycleScheduler] Sent deadline alert: ${overdueItems.length} overdue, ${upcomingItems.length} upcoming`
    );
  } catch (error) {
    console.error("[LifecycleScheduler] Error during deadline check:", error);
  } finally {
    isRunning = false;
  }
}

function shouldRunNow(): boolean {
  // Run at 8:00 AM Dubai time (UTC+4), every 2 days (even days of month)
  const now = new Date();
  const dubaiOffset = 4 * 60; // minutes
  const dubaiMs = now.getTime() + dubaiOffset * 60 * 1000;
  const dubaiDate = new Date(dubaiMs);
  const dubaiHour = dubaiDate.getUTCHours();
  const dubaiMinute = dubaiDate.getUTCMinutes();
  const dubaiDay = dubaiDate.getUTCDate();
  // Only run on even days (1, 3, 5... = odd days skipped; 2, 4, 6... = run)
  return dubaiHour === 8 && dubaiMinute === 0 && dubaiDay % 2 === 0;
}

let lastRunDate: string | null = null;

function checkSchedule(): void {
  const today = new Date().toISOString().split("T")[0];
  if (shouldRunNow() && lastRunDate !== today) {
    lastRunDate = today;
    console.log("[LifecycleScheduler] Running scheduled deadline check at 8:00 AM Dubai time");
    runDeadlineCheck().catch((err) =>
      console.error("[LifecycleScheduler] Scheduled check failed:", err)
    );
  }
}

export function startLifecycleDeadlineScheduler(): void {
  if (schedulerInterval) return;
  console.log(
    "[LifecycleScheduler] Starting — will check deadlines daily at 8:00 AM Dubai time"
  );
  schedulerInterval = setInterval(checkSchedule, 60 * 1000); // check every minute
  // No immediate run on startup — prevents sending emails on every server restart
}

export function stopLifecycleDeadlineScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[LifecycleScheduler] Stopped");
  }
}

export async function forceLifecycleDeadlineCheck(): Promise<void> {
  console.log("[LifecycleScheduler] Manual check triggered");
  await runDeadlineCheck();
}

export function getLifecycleSchedulerStatus(): {
  isActive: boolean;
  isRunning: boolean;
  lastRunDate: string | null;
} {
  return {
    isActive: schedulerInterval !== null,
    isRunning,
    lastRunDate,
  };
}
