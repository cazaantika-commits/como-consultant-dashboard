import { checkAndNotifyEmails } from "./emailIntegration";

/**
 * Email Scheduler
 * Checks emails once every 2 days at 9:00 AM Dubai time (UTC+4 = 05:00 UTC)
 */

let schedulerInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;
let lastRunDate: string | null = null;

function shouldRunNow(): boolean {
  // Run at 9:00 AM Dubai time (UTC+4 = 05:00 UTC), every 2 days (even days of month)
  const now = new Date();
  const dubaiOffset = 4 * 60; // minutes
  const dubaiMs = now.getTime() + dubaiOffset * 60 * 1000;
  const dubaiDate = new Date(dubaiMs);
  const dubaiHour = dubaiDate.getUTCHours();
  const dubaiMinute = dubaiDate.getUTCMinutes();
  const dubaiDay = dubaiDate.getUTCDate();
  // Only run on even days at 9:00 AM Dubai time
  return dubaiHour === 9 && dubaiMinute === 0 && dubaiDay % 2 === 0;
}

async function checkSchedule() {
  if (isRunning) return;
  const today = new Date().toISOString().split("T")[0];
  if (shouldRunNow() && lastRunDate !== today) {
    lastRunDate = today;
    isRunning = true;
    try {
      console.log("[EmailScheduler] Scheduled check at", new Date().toISOString());
      const count = await checkAndNotifyEmails();
      console.log("[EmailScheduler] Found " + count + " new emails");
    } catch (error) {
      console.error("[EmailScheduler] Error:", error);
    } finally {
      isRunning = false;
    }
  }
}

export function startEmailScheduler() {
  if (schedulerInterval) return;
  console.log("[EmailScheduler] Starting - Schedule: every 2 days at 9:00 AM Dubai time");
  schedulerInterval = setInterval(checkSchedule, 60 * 1000);
  // No immediate run on startup — prevents sending emails on every server restart
}

export function stopEmailScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[EmailScheduler] Stopped");
  }
}

export async function forceEmailCheck(): Promise<number> {
  if (isRunning) return -1;
  isRunning = true;
  try {
    console.log("[EmailScheduler] Manual check triggered");
    const count = await checkAndNotifyEmails();
    return count;
  } catch (error) {
    console.error("[EmailScheduler] Manual check error:", error);
    return -1;
  } finally {
    isRunning = false;
  }
}

export function getSchedulerStatus() {
  const now = new Date();
  const dubaiOffset = 4 * 60;
  const dubaiMs = now.getTime() + dubaiOffset * 60 * 1000;
  const dubaiDate = new Date(dubaiMs);
  const dubaiHour = dubaiDate.getUTCHours();
  const dubaiMinute = dubaiDate.getUTCMinutes();
  const dubaiDay = dubaiDate.getUTCDate();
  const nextEvenDay = dubaiDay % 2 === 0 ? dubaiDay + 2 : dubaiDay + 1;
  return {
    isActive: schedulerInterval !== null,
    isRunning,
    currentDubaiTime: dubaiHour + ":" + (dubaiMinute < 10 ? "0" : "") + dubaiMinute,
    nextScheduledCheck: `يوم ${nextEvenDay} الساعة 9:00 صباحاً`,
    lastRunDate,
  };
}
