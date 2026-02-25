/**
 * Email Notification Service
 * Polls for new emails every 5 minutes and creates notifications
 */
import { fetchRecentEmails } from "./emailMonitor";
import { createEmailNotification, isEmailAlreadyNotified } from "./db";

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
let intervalId: ReturnType<typeof setInterval> | null = null;
let isChecking = false;

// Default user ID (owner) - since this is a single-user platform
const OWNER_USER_ID = 1;

/**
 * Check for new emails and create notifications
 */
export async function checkForNewEmails(): Promise<number> {
  if (isChecking) return 0;
  isChecking = true;
  
  let newCount = 0;
  try {
    const emails = await fetchRecentEmails(10);
    
    for (const email of emails) {
      // Skip if we already notified about this email
      const alreadyNotified = await isEmailAlreadyNotified(email.uid);
      if (alreadyNotified) continue;
      
      // Create notification
      const preview = email.textBody
        ? email.textBody.substring(0, 200).replace(/\n/g, " ").trim()
        : "";
      
      await createEmailNotification({
        userId: OWNER_USER_ID,
        emailUid: email.uid,
        fromEmail: email.from,
        fromName: email.fromName || undefined,
        subject: email.subject,
        preview: preview || undefined,
        receivedAt: email.date.getTime(),
      });
      
      newCount++;
      console.log(`[EmailNotification] New email notification: ${email.subject} from ${email.fromName || email.from}`);
    }
    
    if (newCount > 0) {
      console.log(`[EmailNotification] Created ${newCount} new notification(s)`);
    }
  } catch (error: any) {
    console.error(`[EmailNotification] Error checking emails:`, error.message);
  } finally {
    isChecking = false;
  }
  
  return newCount;
}

/**
 * Start the background email checker
 */
export function startEmailNotificationService() {
  if (intervalId) {
    console.log("[EmailNotification] Service already running");
    return;
  }
  
  console.log(`[EmailNotification] Starting service (checking every ${CHECK_INTERVAL_MS / 1000}s)`);
  
  // Initial check after 30 seconds (give server time to fully start)
  setTimeout(() => {
    checkForNewEmails().catch(err => 
      console.error("[EmailNotification] Initial check failed:", err.message)
    );
  }, 30000);
  
  // Then check every 5 minutes
  intervalId = setInterval(() => {
    checkForNewEmails().catch(err => 
      console.error("[EmailNotification] Periodic check failed:", err.message)
    );
  }, CHECK_INTERVAL_MS);
}

/**
 * Stop the background email checker
 */
export function stopEmailNotificationService() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("[EmailNotification] Service stopped");
  }
}
