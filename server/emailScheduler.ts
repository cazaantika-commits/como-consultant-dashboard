import { checkAndNotifyEmails } from "./emailIntegration";

/**
 * Email Scheduler
 * Checks emails at specific times: 9:30, 11:30, 14:00, 21:00 (Dubai time, UTC+4)
 */

let schedulerInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

const SCHEDULE_TIMES_UTC = [
  { hour: 5, minute: 30 },
  { hour: 7, minute: 30 },
  { hour: 10, minute: 0 },
  { hour: 17, minute: 0 },
];

let lastCheckKey = "";

function getCurrentCheckKey(): string {
  const now = new Date();
  return now.getUTCFullYear() + "-" + now.getUTCMonth() + "-" + now.getUTCDate() + "-" + now.getUTCHours() + "-" + now.getUTCMinutes();
}

function isScheduledTime(): boolean {
  const now = new Date();
  const h = now.getUTCHours();
  const m = now.getUTCMinutes();
  for (const t of SCHEDULE_TIMES_UTC) {
    if (h === t.hour && m >= t.minute && m <= t.minute + 2) return true;
  }
  return false;
}

async function checkSchedule() {
  if (isRunning) return;
  if (isScheduledTime()) {
    const key = getCurrentCheckKey();
    if (key === lastCheckKey) return;
    lastCheckKey = key;
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
  console.log("[EmailScheduler] Starting - Schedule (Dubai): 9:30, 11:30, 14:00, 21:00");
  schedulerInterval = setInterval(checkSchedule, 60 * 1000);
  checkSchedule();
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
  const dubaiHour = (now.getUTCHours() + 4) % 24;
  const dubaiMinute = now.getUTCMinutes();
  const dubaiTimes = [
    { hour: 9, minute: 30 },
    { hour: 11, minute: 30 },
    { hour: 14, minute: 0 },
    { hour: 21, minute: 0 },
  ];
  let nextCheck = "غداً 9:30 صباحاً";
  for (const t of dubaiTimes) {
    if (t.hour > dubaiHour || (t.hour === dubaiHour && t.minute > dubaiMinute)) {
      nextCheck = t.hour + ":" + (t.minute === 0 ? "00" : t.minute);
      break;
    }
  }
  return {
    isActive: schedulerInterval !== null,
    isRunning,
    currentDubaiTime: dubaiHour + ":" + (dubaiMinute < 10 ? "0" : "") + dubaiMinute,
    nextScheduledCheck: nextCheck,
    lastCheckKey,
  };
}
