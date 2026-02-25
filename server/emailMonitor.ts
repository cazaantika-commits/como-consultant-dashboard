import Imap from "imap";
import { simpleParser, ParsedMail, Attachment } from "mailparser";
import nodemailer from "nodemailer";

/**
 * Email Monitor Service for Salwa
 * Reads emails via IMAP from Namecheap Private Email
 * Sends replies via SMTP
 */

// ─── Config ────────────────────────────────────────────────────
const EMAIL_HOST = process.env.EMAIL_HOST || "mail.privateemail.com";
const EMAIL_USER = process.env.EMAIL_USER || "a.zaqout@comodevelopments.com";
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD || "";

// ─── Types ─────────────────────────────────────────────────────
export interface EmailMessage {
  uid: number;
  messageId: string;
  from: string;
  fromName: string;
  to: string;
  cc: string;
  subject: string;
  date: Date;
  textBody: string;
  htmlBody: string;
  attachments: EmailAttachment[];
  isRead: boolean;
}

export interface EmailAttachment {
  filename: string;
  contentType: string;
  size: number;
  content?: Buffer;
}

// ─── Track processed emails ────────────────────────────────────
// Store UIDs of emails we've already notified about (persists in memory per server session)
const processedUIDs = new Set<number>();
let lastCheckUID = 0;

/**
 * Fetch new (unseen) emails from IMAP
 */
export function fetchNewEmails(): Promise<EmailMessage[]> {
  return new Promise((resolve, reject) => {
    if (!EMAIL_PASSWORD) {
      reject(new Error("EMAIL_PASSWORD not configured"));
      return;
    }

    const imap = new Imap({
      user: EMAIL_USER,
      password: EMAIL_PASSWORD,
      host: EMAIL_HOST,
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      connTimeout: 15000,
      authTimeout: 10000,
    });

    const emails: EmailMessage[] = [];

    imap.once("ready", () => {
      imap.openBox("INBOX", false, (err, box) => {
        if (err) {
          imap.end();
          reject(err);
          return;
        }

        // Search for UNSEEN emails
        imap.search(["UNSEEN"], (err, uids) => {
          if (err) {
            imap.end();
            reject(err);
            return;
          }

          if (!uids || uids.length === 0) {
            imap.end();
            resolve([]);
            return;
          }

          // Filter out already processed UIDs
          const newUIDs = uids.filter(uid => !processedUIDs.has(uid));
          if (newUIDs.length === 0) {
            imap.end();
            resolve([]);
            return;
          }

          const fetch = imap.fetch(newUIDs, {
            bodies: "",
            struct: true,
            markSeen: false, // Don't mark as seen yet
          });

          let pending = newUIDs.length;

          fetch.on("message", (msg, seqno) => {
            let uid = 0;
            const chunks: Buffer[] = [];

            msg.on("attributes", (attrs) => {
              uid = attrs.uid;
            });

            msg.on("body", (stream) => {
              stream.on("data", (chunk: Buffer) => {
                chunks.push(chunk);
              });
            });

            msg.once("end", async () => {
              try {
                const raw = Buffer.concat(chunks);
                const parsed: ParsedMail = await simpleParser(raw);

                const email: EmailMessage = {
                  uid,
                  messageId: parsed.messageId || "",
                  from: parsed.from?.value?.[0]?.address || "",
                  fromName: parsed.from?.value?.[0]?.name || parsed.from?.value?.[0]?.address || "",
                  to: parsed.to
                    ? (Array.isArray(parsed.to) ? parsed.to : [parsed.to])
                        .map(t => t.value.map(v => v.address).join(", "))
                        .join(", ")
                    : "",
                  cc: parsed.cc
                    ? (Array.isArray(parsed.cc) ? parsed.cc : [parsed.cc])
                        .map(t => t.value.map(v => v.address).join(", "))
                        .join(", ")
                    : "",
                  subject: parsed.subject || "(بدون عنوان)",
                  date: parsed.date || new Date(),
                  textBody: parsed.text || "",
                  htmlBody: parsed.html || "",
                  attachments: (parsed.attachments || []).map((att: Attachment) => ({
                    filename: att.filename || "unnamed",
                    contentType: att.contentType || "application/octet-stream",
                    size: att.size || 0,
                    content: att.content,
                  })),
                  isRead: false,
                };

                emails.push(email);
              } catch (parseErr) {
                console.error("[EmailMonitor] Failed to parse email:", parseErr);
              }

              pending--;
              if (pending === 0) {
                imap.end();
              }
            });
          });

          fetch.once("error", (err) => {
            console.error("[EmailMonitor] Fetch error:", err);
            imap.end();
          });

          fetch.once("end", () => {
            // If no messages were processed, end
            if (pending === 0) {
              imap.end();
            }
          });
        });
      });
    });

    imap.once("error", (err: Error) => {
      console.error("[EmailMonitor] IMAP error:", err.message);
      reject(err);
    });

    imap.once("end", () => {
      // Sort by date descending (newest first)
      emails.sort((a, b) => b.date.getTime() - a.date.getTime());
      resolve(emails);
    });

    imap.connect();
  });
}

/**
 * Fetch emails from the last N hours (both read and unread)
 * Used for the 48-hour check feature
 */
export function fetchEmailsSince(hours: number = 48): Promise<EmailMessage[]> {
  return new Promise((resolve, reject) => {
    if (!EMAIL_PASSWORD) {
      reject(new Error("EMAIL_PASSWORD not configured"));
      return;
    }

    const imap = new Imap({
      user: EMAIL_USER,
      password: EMAIL_PASSWORD,
      host: EMAIL_HOST,
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      connTimeout: 15000,
      authTimeout: 10000,
    });

    const emails: EmailMessage[] = [];

    imap.once("ready", () => {
      imap.openBox("INBOX", true, (err, box) => {
        if (err) {
          imap.end();
          reject(err);
          return;
        }

        const sinceDate = new Date();
        sinceDate.setHours(sinceDate.getHours() - hours);
        const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        const sinceDateStr = `${sinceDate.getDate()}-${months[sinceDate.getMonth()]}-${sinceDate.getFullYear()}`;

        imap.search([["SINCE", sinceDateStr]], (err, uids) => {
          if (err) {
            imap.end();
            reject(err);
            return;
          }

          if (!uids || uids.length === 0) {
            imap.end();
            resolve([]);
            return;
          }

          const fetch = imap.fetch(uids, { bodies: "", struct: true });
          let pending = uids.length;

          fetch.on("message", (msg) => {
            let uid = 0;
            const chunks: Buffer[] = [];
            let flags: string[] = [];

            msg.on("attributes", (attrs) => {
              uid = attrs.uid;
              flags = attrs.flags || [];
            });

            msg.on("body", (stream) => {
              stream.on("data", (chunk: Buffer) => { chunks.push(chunk); });
            });

            msg.once("end", async () => {
              try {
                const raw = Buffer.concat(chunks);
                const parsed: ParsedMail = await simpleParser(raw);
                emails.push({
                  uid,
                  messageId: parsed.messageId || "",
                  from: parsed.from?.value?.[0]?.address || "",
                  fromName: parsed.from?.value?.[0]?.name || parsed.from?.value?.[0]?.address || "",
                  to: parsed.to ? (Array.isArray(parsed.to) ? parsed.to : [parsed.to]).map(t => t.value.map(v => v.address).join(", ")).join(", ") : "",
                  cc: parsed.cc ? (Array.isArray(parsed.cc) ? parsed.cc : [parsed.cc]).map(t => t.value.map(v => v.address).join(", ")).join(", ") : "",
                  subject: parsed.subject || "(بدون عنوان)",
                  date: parsed.date || new Date(),
                  textBody: parsed.text || "",
                  htmlBody: parsed.html || "",
                  attachments: (parsed.attachments || []).map((att: Attachment) => ({
                    filename: att.filename || "unnamed",
                    contentType: att.contentType || "application/octet-stream",
                    size: att.size || 0,
                  })),
                  isRead: flags.includes("\\Seen"),
                });
              } catch (parseErr) {
                console.error("[EmailMonitor] Parse error:", parseErr);
              }
              pending--;
              if (pending === 0) imap.end();
            });
          });

          fetch.once("error", (err) => { console.error("[EmailMonitor] Fetch error:", err); imap.end(); });
          fetch.once("end", () => { if (pending === 0) imap.end(); });
        });
      });
    });

    imap.once("error", (err: Error) => reject(err));
    imap.once("end", () => {
      emails.sort((a, b) => b.date.getTime() - a.date.getTime());
      resolve(emails);
    });

    imap.connect();
  });
}

/**
 * Fetch a single email by UID with full attachments
 */
export function fetchEmailByUID(targetUID: number): Promise<EmailMessage | null> {
  return new Promise((resolve, reject) => {
    if (!EMAIL_PASSWORD) {
      reject(new Error("EMAIL_PASSWORD not configured"));
      return;
    }

    const imap = new Imap({
      user: EMAIL_USER,
      password: EMAIL_PASSWORD,
      host: EMAIL_HOST,
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      connTimeout: 15000,
      authTimeout: 10000,
    });

    let result: EmailMessage | null = null;

    imap.once("ready", () => {
      imap.openBox("INBOX", true, (err, box) => {
        if (err) { imap.end(); reject(err); return; }

        const fetch = imap.fetch([targetUID], { bodies: "", struct: true });

        fetch.on("message", (msg) => {
          let uid = 0;
          const chunks: Buffer[] = [];
          let flags: string[] = [];

          msg.on("attributes", (attrs) => { uid = attrs.uid; flags = attrs.flags || []; });
          msg.on("body", (stream) => { stream.on("data", (chunk: Buffer) => { chunks.push(chunk); }); });

          msg.once("end", async () => {
            try {
              const raw = Buffer.concat(chunks);
              const parsed: ParsedMail = await simpleParser(raw);
              result = {
                uid,
                messageId: parsed.messageId || "",
                from: parsed.from?.value?.[0]?.address || "",
                fromName: parsed.from?.value?.[0]?.name || parsed.from?.value?.[0]?.address || "",
                to: parsed.to ? (Array.isArray(parsed.to) ? parsed.to : [parsed.to]).map(t => t.value.map(v => v.address).join(", ")).join(", ") : "",
                cc: parsed.cc ? (Array.isArray(parsed.cc) ? parsed.cc : [parsed.cc]).map(t => t.value.map(v => v.address).join(", ")).join(", ") : "",
                subject: parsed.subject || "(بدون عنوان)",
                date: parsed.date || new Date(),
                textBody: parsed.text || "",
                htmlBody: parsed.html || "",
                attachments: (parsed.attachments || []).map((att: Attachment) => ({
                  filename: att.filename || "unnamed",
                  contentType: att.contentType || "application/octet-stream",
                  size: att.size || 0,
                  content: att.content,
                })),
                isRead: flags.includes("\\Seen"),
              };
            } catch (parseErr) {
              console.error("[EmailMonitor] Parse error for UID " + targetUID + ":", parseErr);
            }
          });
        });

        fetch.once("error", (err) => { console.error("[EmailMonitor] Fetch error:", err); imap.end(); });
        fetch.once("end", () => { imap.end(); });
      });
    });

    imap.once("error", (err: Error) => reject(err));
    imap.once("end", () => resolve(result));

    imap.connect();
  });
}

/**
 * Fetch recent emails (both read and unread) for display
 */
export function fetchRecentEmails(count: number = 10): Promise<EmailMessage[]> {
  return new Promise((resolve, reject) => {
    if (!EMAIL_PASSWORD) {
      reject(new Error("EMAIL_PASSWORD not configured"));
      return;
    }

    const imap = new Imap({
      user: EMAIL_USER,
      password: EMAIL_PASSWORD,
      host: EMAIL_HOST,
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      connTimeout: 15000,
      authTimeout: 10000,
    });

    const emails: EmailMessage[] = [];

    imap.once("ready", () => {
      imap.openBox("INBOX", true, (err, box) => {
        if (err) {
          imap.end();
          reject(err);
          return;
        }

        const total = box.messages.total;
        if (total === 0) {
          imap.end();
          resolve([]);
          return;
        }

        const start = Math.max(1, total - count + 1);
        const range = `${start}:${total}`;

        const fetch = imap.seq.fetch(range, {
          bodies: "",
          struct: true,
        });

        let pending = 0;

        fetch.on("message", (msg) => {
          pending++;
          let uid = 0;
          const chunks: Buffer[] = [];
          let flags: string[] = [];

          msg.on("attributes", (attrs) => {
            uid = attrs.uid;
            flags = attrs.flags || [];
          });

          msg.on("body", (stream) => {
            stream.on("data", (chunk: Buffer) => {
              chunks.push(chunk);
            });
          });

          msg.once("end", async () => {
            try {
              const raw = Buffer.concat(chunks);
              const parsed: ParsedMail = await simpleParser(raw);

              emails.push({
                uid,
                messageId: parsed.messageId || "",
                from: parsed.from?.value?.[0]?.address || "",
                fromName: parsed.from?.value?.[0]?.name || parsed.from?.value?.[0]?.address || "",
                to: parsed.to
                  ? (Array.isArray(parsed.to) ? parsed.to : [parsed.to])
                      .map(t => t.value.map(v => v.address).join(", "))
                      .join(", ")
                  : "",
                cc: parsed.cc
                  ? (Array.isArray(parsed.cc) ? parsed.cc : [parsed.cc])
                      .map(t => t.value.map(v => v.address).join(", "))
                      .join(", ")
                  : "",
                subject: parsed.subject || "(بدون عنوان)",
                date: parsed.date || new Date(),
                textBody: parsed.text || "",
                htmlBody: parsed.html || "",
                attachments: (parsed.attachments || []).map((att: Attachment) => ({
                  filename: att.filename || "unnamed",
                  contentType: att.contentType || "application/octet-stream",
                  size: att.size || 0,
                  // Don't include content for listing - too heavy
                })),
                isRead: flags.includes("\\Seen"),
              });
            } catch (parseErr) {
              console.error("[EmailMonitor] Parse error:", parseErr);
            }

            pending--;
            if (pending === 0) {
              imap.end();
            }
          });
        });

        fetch.once("error", (err) => {
          console.error("[EmailMonitor] Fetch error:", err);
          imap.end();
        });

        fetch.once("end", () => {
          if (pending === 0) imap.end();
        });
      });
    });

    imap.once("error", (err: Error) => {
      reject(err);
    });

    imap.once("end", () => {
      emails.sort((a, b) => b.date.getTime() - a.date.getTime());
      resolve(emails);
    });

    imap.connect();
  });
}

/**
 * Mark an email as processed (so we don't notify again)
 */
export function markAsProcessed(uid: number): void {
  processedUIDs.add(uid);
}

/**
 * Mark email as seen on the IMAP server
 */
export function markAsSeen(uid: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!EMAIL_PASSWORD) {
      reject(new Error("EMAIL_PASSWORD not configured"));
      return;
    }

    const imap = new Imap({
      user: EMAIL_USER,
      password: EMAIL_PASSWORD,
      host: EMAIL_HOST,
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
    });

    imap.once("ready", () => {
      imap.openBox("INBOX", false, (err) => {
        if (err) {
          imap.end();
          reject(err);
          return;
        }

        imap.addFlags(uid, ["\\Seen"], (err) => {
          imap.end();
          if (err) reject(err);
          else resolve();
        });
      });
    });

    imap.once("error", (err: Error) => reject(err));
    imap.connect();
  });
}

/**
 * Send a reply email via SMTP
 */
export async function sendReply(
  to: string,
  subject: string,
  body: string,
  inReplyTo?: string,
  cc?: string
): Promise<boolean> {
  if (!EMAIL_PASSWORD) {
    throw new Error("EMAIL_PASSWORD not configured");
  }

  const transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: 465,
    secure: true,
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASSWORD,
    },
  });

  try {
    const finalSubject = subject.startsWith("Re:") ? subject : `Re: ${subject}`;
    const mailOptions: nodemailer.SendMailOptions = {
      from: `"Como Developments" <${EMAIL_USER}>`,
      to,
      subject: finalSubject,
      html: body,
      ...(inReplyTo ? { inReplyTo, references: inReplyTo } : {}),
      ...(cc ? { cc } : {}),
    };

    await transporter.sendMail(mailOptions);
    console.log(`[EmailMonitor] Reply sent to ${to}: ${finalSubject}`);

    // Save a copy to the Sent folder via IMAP so it appears in the user's email client
    try {
      await saveSentEmailToIMAP(to, finalSubject, body, inReplyTo, cc);
      console.log(`[EmailMonitor] Saved copy to Sent folder`);
    } catch (imapErr) {
      console.warn(`[EmailMonitor] Failed to save to Sent folder (email was still sent):`, imapErr);
    }

    return true;
  } catch (error) {
    console.error("[EmailMonitor] SMTP send error:", error);
    return false;
  }
}

/**
 * Save a sent email to the IMAP Sent folder so it appears in the user's email client
 */
function saveSentEmailToIMAP(
  to: string,
  subject: string,
  htmlBody: string,
  inReplyTo?: string,
  cc?: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!EMAIL_PASSWORD) {
      reject(new Error("EMAIL_PASSWORD not configured"));
      return;
    }

    const imap = new Imap({
      user: EMAIL_USER,
      password: EMAIL_PASSWORD,
      host: EMAIL_HOST,
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
    });

    // Build the raw email message (RFC 2822 format)
    const date = new Date().toUTCString();
    const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    
    let rawMessage = `From: "Como Developments" <${EMAIL_USER}>\r\n`;
    rawMessage += `To: ${to}\r\n`;
    if (cc) rawMessage += `Cc: ${cc}\r\n`;
    rawMessage += `Subject: ${subject}\r\n`;
    rawMessage += `Date: ${date}\r\n`;
    rawMessage += `MIME-Version: 1.0\r\n`;
    if (inReplyTo) {
      rawMessage += `In-Reply-To: ${inReplyTo}\r\n`;
      rawMessage += `References: ${inReplyTo}\r\n`;
    }
    rawMessage += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n`;
    rawMessage += `\r\n`;
    rawMessage += `--${boundary}\r\n`;
    rawMessage += `Content-Type: text/html; charset=utf-8\r\n`;
    rawMessage += `Content-Transfer-Encoding: quoted-printable\r\n`;
    rawMessage += `\r\n`;
    rawMessage += `${htmlBody}\r\n`;
    rawMessage += `--${boundary}--\r\n`;

    imap.once("ready", () => {
      // Try common Sent folder names
      const sentFolderNames = ["Sent", "INBOX.Sent", "Sent Items", "Sent Messages", "INBOX.Sent Items"];
      
      const tryAppend = (folders: string[], index: number) => {
        if (index >= folders.length) {
          imap.end();
          reject(new Error("Could not find Sent folder"));
          return;
        }
        
        imap.append(rawMessage, { mailbox: folders[index], flags: ["\\Seen"] }, (err: Error | null) => {
          if (err) {
            // Try next folder name
            tryAppend(folders, index + 1);
          } else {
            imap.end();
            resolve();
          }
        });
      };

      tryAppend(sentFolderNames, 0);
    });

    imap.once("error", (err: Error) => {
      reject(err);
    });

    imap.connect();
  });
}

/**
 * Test IMAP connection
 */
export function testConnection(): Promise<{ success: boolean; messageCount: number; error?: string }> {
  return new Promise((resolve) => {
    if (!EMAIL_PASSWORD) {
      resolve({ success: false, messageCount: 0, error: "EMAIL_PASSWORD not configured" });
      return;
    }

    const imap = new Imap({
      user: EMAIL_USER,
      password: EMAIL_PASSWORD,
      host: EMAIL_HOST,
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      connTimeout: 10000,
      authTimeout: 8000,
    });

    imap.once("ready", () => {
      imap.openBox("INBOX", true, (err, box) => {
        imap.end();
        if (err) {
          resolve({ success: false, messageCount: 0, error: err.message });
        } else {
          resolve({ success: true, messageCount: box.messages.total });
        }
      });
    });

    imap.once("error", (err: Error) => {
      resolve({ success: false, messageCount: 0, error: err.message });
    });

    imap.connect();
  });
}
