import Imap from "imap";
import { simpleParser, ParsedMail, Attachment } from "mailparser";
import nodemailer from "nodemailer";
import {
  DatabaseMailboxDraftLedger,
  deterministicDraftMessageId,
  mailboxKeyForDraftLedger,
  saveMailboxDraftExactlyOnce,
  type MailboxDraftLookup,
} from "./services/comoMailboxDraftLedger";

/**
 * Email Monitor Service for COMO
 * Reads emails via IMAP from Namecheap Private Email
 * Legacy SMTP helpers are locked by default during the read-only phase.
 */

// --- Config ----------------------------------------------------
const EMAIL_HOST = process.env.EMAIL_HOST || "mail.privateemail.com";
const EMAIL_USER = process.env.EMAIL_USER || "a.zaqout@comodevelopments.com";
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD || "";

// --- Types -----------------------------------------------------
export interface EmailMessage {
  uid: number;
  messageId: string;
  /** Scalar RFC header projection for read-only identity/lineage checks. */
  headers?: Readonly<Record<string, string | readonly string[] | undefined>>;
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
  contentId?: string | null;
  disposition?: string | null;
}

export interface ReadonlyMailboxBatch {
  mailbox: string;
  folderName: string;
  uidValidity: string;
  messages: EmailMessage[];
}

/** Preserve scalar headers only; structured MIME values are intentionally excluded. */
export function readonlyEmailHeadersFromParsedMail(parsed: Pick<ParsedMail, "headers">): Readonly<Record<string, string | readonly string[] | undefined>> {
  const result: Record<string, string | readonly string[] | undefined> = {};
  parsed.headers.forEach((value, name) => {
    const key = String(name || "").trim().toLowerCase();
    if (!key) return;
    if (typeof value === "string") result[key] = value;
    else if (Array.isArray(value) && value.every(item => typeof item === "string")) result[key] = value as string[];
  });
  return result;
}

export function getConfiguredMailboxAddress() {
  return EMAIL_USER.trim().toLowerCase();
}

export function assertMailboxWritesEnabled() {
  if (process.env.COMO_MAILBOX_WRITE_ENABLED !== "true") {
    throw new Error("Mailbox write operations are disabled during the COMO Next read-only phase");
  }
}

export function assertOutboundEmailEnabled() {
  if (process.env.COMO_OUTBOUND_EMAIL_ENABLED !== "true") {
    throw new Error("Outbound email is disabled during the COMO Next read-only phase");
  }
}

// --- Track processed emails ------------------------------------
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

export function readonlyCursorAfterUid(cursor: { lastUid: number; uidValidity: string } | undefined, currentValidity: string): number {
  return cursor?.uidValidity === currentValidity && Number.isSafeInteger(cursor.lastUid)
    ? Math.max(0, cursor.lastUid)
    : 0;
}


export type ReadonlyAutomationSignal = "known_non_system" | "known_system" | "unknown";

type ReadonlyAutomationHeaders = Readonly<Record<string, string | readonly string[] | undefined>>;

function headerValues(headers: ReadonlyAutomationHeaders, name: string): string[] {
  const value = headers[name.toLowerCase()];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  return [];
}

/**
 * Applies only explicit, message-header signals. An absent automation header is
 * deliberately not treated as evidence of a human sender.
 */
export function classifyReadonlyAutomationHeaders(headers: ReadonlyAutomationHeaders): ReadonlyAutomationSignal {
  const autoSubmitted = headerValues(headers, "auto-submitted").map(value => value.trim().toLowerCase()).filter(Boolean);
  const precedence = headerValues(headers, "precedence").map(value => value.trim().toLowerCase()).filter(Boolean);
  const listId = headerValues(headers, "list-id").some(value => value.trim().length > 0);
  const autoResponseSuppress = headerValues(headers, "x-auto-response-suppress").some(value => value.trim().length > 0);
  const senderValues = [
    ...headerValues(headers, "from"),
    ...headerValues(headers, "return-path"),
  ];
  const noReplySender = senderValues.some(value => /\b(?:no[-_.]?reply|do[-_.]?not[-_.]?reply|donotreply|mailer-daemon)\b/i.test(value));

  // A signed response in an existing human conversation is positive evidence;
  // a missing Auto-Submitted header alone is not. A later Sent review still
  // checks the precise counterparty/thread and avoids replying twice.
  const from = headerValues(headers, "from");
  const fromAddress = from.length === 1
    ? from[0].match(/(?:<|^)([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})(?:>|$)/i)?.[1]?.toLowerCase()
    : undefined;
  const fromDomain = fromAddress?.split("@")[1];
  const authenticatedThreadReply = Boolean(fromDomain
    && headerValues(headers, "in-reply-to").some(value => /^\s*<[^<>\s]+@[^<>\s]+>\s*$/.test(value))
    && headerValues(headers, "authentication-results").some(value =>
      /\bdkim=pass\b/i.test(value)
      && new RegExp(`\\bheader\\.d=${fromDomain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[;\\s]|$)`, "i").test(value)));

  const explicitNonSystem = autoSubmitted.some(value => value === "no")
    || precedence.some(value => value === "personal")
    || authenticatedThreadReply;
  const explicitSystem = autoSubmitted.some(value => value !== "no")
    || precedence.some(value => /^(?:bulk|list|junk|auto[_ -]?reply)$/.test(value))
    || listId
    || autoResponseSuppress
    || noReplySender;

  // Contradictory explicit metadata is not safe to classify. This also covers
  // messages that claim Auto-Submitted: no while carrying list/automation data.
  if (explicitSystem && explicitNonSystem) return "unknown";
  if (explicitSystem) return "known_system";
  if (explicitNonSystem) return "known_non_system";
  return "unknown";
}

function parseReadonlyAutomationHeaders(rawHeaders: Buffer): ReadonlyAutomationHeaders | null {
  const headers: Record<string, string[]> = {};
  let currentName: string | undefined;
  // IMAP header section responses include only headers, but stopping at the
  // first blank line keeps this defensive if a server returns a full RFC822 part.
  for (const line of rawHeaders.toString("utf8").split(/\r?\n/)) {
    if (line === "") break;
    if (/^[ \t]/.test(line)) {
      if (!currentName || !headers[currentName]?.length) return null;
      headers[currentName][headers[currentName].length - 1] += ` ${line.trim()}`;
      continue;
    }
    const separator = line.indexOf(":");
    if (separator <= 0) return null;
    const name = line.slice(0, separator).trim().toLowerCase();
    if (!/^[a-z0-9-]+$/i.test(name)) return null;
    currentName = name;
    (headers[name] ||= []).push(line.slice(separator + 1).trim());
  }
  return headers;
}

/**
 * Fetches a single message's automation metadata without reading its body or
 * attachments. The mailbox remains read-only and any transport, UIDVALIDITY,
 * parsing, or classification ambiguity resolves to "unknown".
 */
export function fetchReadonlyAutomationSignalByUID(input: {
  uid: number;
  uidValidity: string;
  folderName: string;
}): Promise<ReadonlyAutomationSignal> {
  return new Promise(resolve => {
    if (!EMAIL_PASSWORD
      || !Number.isSafeInteger(input.uid)
      || input.uid <= 0
      || !input.uidValidity.trim()
      || !input.folderName.trim()) {
      resolve("unknown");
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
    let settled = false;
    const finish = (signal: ReadonlyAutomationSignal) => {
      if (settled) return;
      settled = true;
      try { imap.end(); } catch { /* connection already closed */ }
      resolve(signal);
    };

    imap.once("ready", () => {
      // true opens the box read-only. Combined with markSeen: false below,
      // node-imap uses a non-mutating header peek and does not alter flags.
      imap.openBox(input.folderName, true, (openError, box) => {
        if (openError || String(box?.uidvalidity ?? "") !== input.uidValidity) {
          finish("unknown");
          return;
        }

        let messageCount = 0;
        let pendingMessages = 0;
        let fetchEnded = false;
        let signal: ReadonlyAutomationSignal = "unknown";
        const finishAfterFetch = () => {
          if (!fetchEnded) return;
          if (messageCount === 0) { finish("unknown"); return; }
          if (pendingMessages !== 0) return;
          finish(messageCount === 1 ? signal : "unknown");
        };
        const fetch = imap.fetch([input.uid], {
          // Header fields only: no RFC822 body, MIME parts, or attachments.
          bodies: "HEADER.FIELDS (AUTO-SUBMITTED PRECEDENCE LIST-ID X-AUTO-RESPONSE-SUPPRESS FROM RETURN-PATH IN-REPLY-TO AUTHENTICATION-RESULTS)",
          markSeen: false,
        });

        fetch.on("message", msg => {
          messageCount += 1;
          pendingMessages += 1;
          let fetchedUid: number | undefined;
          let messageFailed = false;
          const chunks: Buffer[] = [];
          msg.on("attributes", attrs => { fetchedUid = attrs.uid; });
          msg.on("body", stream => {
            stream.on("data", (chunk: Buffer) => chunks.push(chunk));
            stream.once("error", () => { messageFailed = true; });
          });
          msg.once("end", () => {
            if (!messageFailed && fetchedUid === input.uid) {
              const parsedHeaders = parseReadonlyAutomationHeaders(Buffer.concat(chunks));
              signal = parsedHeaders ? classifyReadonlyAutomationHeaders(parsedHeaders) : "unknown";
            }
            pendingMessages -= 1;
            finishAfterFetch();
          });
        });
        fetch.once("error", () => finish("unknown"));
        fetch.once("end", () => {
          fetchEnded = true;
          finishAfterFetch();
        });
      });
    });
    imap.once("error", () => finish("unknown"));
    imap.once("end", () => finish("unknown"));
    imap.connect();
  });
}

/**
 * Strict read-only mailbox snapshot for COMO Next.
 * Every folder is opened read-only and markSeen is explicitly disabled.
 */
export function fetchReadonlyFolderSince(folderName: string, hours: number = 72, maxMessages: number = 100, cursor?: { lastUid: number; uidValidity: string }): Promise<ReadonlyMailboxBatch> {
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
    const messages: EmailMessage[] = [];
    let uidValidity = "0";
    let settled = false;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    imap.once("ready", () => {
      imap.openBox(folderName, true, (openError, box) => {
        if (openError) { imap.end(); fail(openError); return; }
        uidValidity = String(box.uidvalidity ?? "0");
        // A UID is only meaningful within one UIDVALIDITY. Fall back to the
        // bounded date search when the mailbox was recreated or reset.
        const afterUid = readonlyCursorAfterUid(cursor, uidValidity);
        if (afterUid > 0 && typeof box.uidnext === "number" && box.uidnext <= afterUid + 1) {
          imap.end();
          return;
        }
        const since = new Date(Date.now() - Math.max(1, Math.min(hours, 24 * 365)) * 60 * 60 * 1000);
        const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        const sinceValue = `${since.getDate()}-${months[since.getMonth()]}-${since.getFullYear()}`;
        // Once a cursor exists, UID is authoritative even after a multi-day
        // outage; SINCE would silently exclude mail that arrived before the
        // lookback window but has never been imported.
        imap.search(afterUid > 0 ? [["UID", `${afterUid + 1}:*`]] : [["SINCE", sinceValue]], (searchError, found) => {
          if (searchError) { imap.end(); fail(searchError); return; }
          const limit = Math.max(1, Math.min(maxMessages, 250));
          // Some IMAP servers resolve the '*' range to the last existing UID
          // even if it precedes our cursor. Filter locally as well.
          // Consume the oldest unseen UIDs first. Taking the newest N and then
          // advancing the cursor would permanently skip any earlier overflow.
          const uids = (found || []).filter(uid => uid > afterUid).sort((a, b) => a - b).slice(0, limit);
          if (!uids.length) { imap.end(); return; }
          let pending = uids.length;
          const fetch = imap.fetch(uids, { bodies: "", struct: true, markSeen: false });
          fetch.on("message", msg => {
            let uid = 0;
            let flags: string[] = [];
            const chunks: Buffer[] = [];
            msg.on("attributes", attrs => { uid = attrs.uid; flags = attrs.flags || []; });
            msg.on("body", stream => stream.on("data", (chunk: Buffer) => chunks.push(chunk)));
            msg.once("end", async () => {
              try {
                const parsed = await simpleParser(Buffer.concat(chunks));
                messages.push({
                  uid,
                  messageId: parsed.messageId || "",
                  headers: readonlyEmailHeadersFromParsedMail(parsed),
                  from: parsed.from?.value?.[0]?.address || "",
                  fromName: parsed.from?.value?.[0]?.name || parsed.from?.value?.[0]?.address || "",
                  to: parsed.to ? (Array.isArray(parsed.to) ? parsed.to : [parsed.to]).map(item => item.value.map(value => value.address).join(", ")).join(", ") : "",
                  cc: parsed.cc ? (Array.isArray(parsed.cc) ? parsed.cc : [parsed.cc]).map(item => item.value.map(value => value.address).join(", ")).join(", ") : "",
                  subject: parsed.subject || "(بدون عنوان)",
                  date: parsed.date || new Date(),
                  textBody: parsed.text || "",
                  htmlBody: "",
                  attachments: (parsed.attachments || []).map((attachment: Attachment) => ({
                    filename: attachment.filename || "unnamed",
                    contentType: attachment.contentType || "application/octet-stream",
                    size: attachment.size || 0,
                    contentId: attachment.contentId || null,
                    disposition: attachment.contentDisposition || null,
                  })),
                  isRead: flags.includes("\\Seen"),
                });
              } catch (parseError) {
                imap.end();
                fail(parseError instanceof Error ? parseError : new Error("Read-only IMAP parse failed"));
              } finally {
                pending -= 1;
                if (pending === 0) imap.end();
              }
            });
          });
          fetch.once("error", error => { imap.end(); fail(error); });
        });
      });
    });
    imap.once("error", fail);
    imap.once("end", () => {
      if (settled) return;
      settled = true;
      messages.sort((a, b) => b.date.getTime() - a.date.getTime());
      resolve({ mailbox: getConfiguredMailboxAddress(), folderName, uidValidity, messages });
    });
    imap.connect();
  });
}

export function fetchReadonlyInboxSince(hours: number = 72, maxMessages: number = 100, cursor?: { lastUid: number; uidValidity: string }) {
  return fetchReadonlyFolderSince("INBOX", hours, maxMessages, cursor);
}

export function fetchReadonlySentSince(hours: number = 72, maxMessages: number = 100, cursor?: { lastUid: number; uidValidity: string }) {
  return fetchReadonlyFolderSince("Sent", hours, maxMessages, cursor);
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
export function fetchEmailByUID(targetUID: number, expectedUidValidity?: string, folderName: string = "INBOX"): Promise<EmailMessage | null> {
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
    let pendingParses = 0;
    let fetchEnded = false;
    const closeWhenParsed = () => {
      if (fetchEnded && pendingParses === 0) imap.end();
    };

    imap.once("ready", () => {
      imap.openBox(folderName, true, (err, box) => {
        if (err) { imap.end(); reject(err); return; }
        if (expectedUidValidity && String(box.uidvalidity ?? "0") !== expectedUidValidity) {
          imap.end();
          reject(new Error(`Mailbox UIDVALIDITY changed for ${folderName}; refresh the mailbox before linking this message`));
          return;
        }

        const fetch = imap.fetch([targetUID], { bodies: "", struct: true });

        fetch.on("message", (msg) => {
          pendingParses += 1;
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
            } finally {
              pendingParses -= 1;
              closeWhenParsed();
            }
          });
        });

        fetch.once("error", (err) => { console.error("[EmailMonitor] Fetch error:", err); imap.end(); });
        // MIME parsing (especially large attachments) can outlive the fetch
        // stream. Closing here used to resolve the promise with null first.
        fetch.once("end", () => { fetchEnded = true; closeWhenParsed(); });
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
    try { assertMailboxWritesEnabled(); } catch (error) { reject(error); return; }
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
  assertOutboundEmailEnabled();
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

function plainTextToSafeHtml(body: string) {
  return body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/\r?\n/g, "<br>");
}

type ImapMailboxNode = {
  attribs?: string[];
  delimiter?: string;
  children?: Record<string, ImapMailboxNode>;
};

function findDraftMailbox(boxes: Record<string, ImapMailboxNode>) {
  const rows: Array<{ path: string; attribs: string[] }> = [];
  const walk = (nodes: Record<string, ImapMailboxNode>, parent = "") => {
    for (const [name, node] of Object.entries(nodes || {})) {
      const path = parent ? `${parent}${node.delimiter || "/"}${name}` : name;
      rows.push({ path, attribs: node.attribs || [] });
      if (node.children) walk(node.children, path);
    }
  };
  walk(boxes);
  return rows.find(row => row.attribs.includes("\\Drafts"))?.path
    || rows.find(row => /(^|[./])drafts?$/i.test(row.path))?.path
    || "Drafts";
}

function findSentMailbox(boxes: Record<string, ImapMailboxNode>) {
  const rows: Array<{ path: string; attribs: string[] }> = [];
  const walk = (nodes: Record<string, ImapMailboxNode>, parent = "") => {
    for (const [name, node] of Object.entries(nodes || {})) {
      const path = parent ? `${parent}${node.delimiter || "/"}${name}` : name;
      rows.push({ path, attribs: node.attribs || [] });
      if (node.children) walk(node.children, path);
    }
  };
  walk(boxes);
  return rows.find(row => row.attribs.includes("\\Sent"))?.path
    || rows.find(row => /(^|[./])sent(?: items| messages)?$/i.test(row.path))?.path
    || "Sent";
}

const WAEL_EMAIL = "wael@zooma.ae";
const MIA_EMAIL = "pa@zooma.ae";

function recipientAddress(value: string) {
  return value.match(/<([^>]+@[^>]+)>/)?.[1]?.trim().toLowerCase()
    || value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase()
    || value.trim().toLowerCase();
}

export function applyComoCcPolicy(input: { to: string; cc?: string; waelAppointment?: boolean }) {
  const toAddresses = new Set(input.to.split(/[;,]/).map(recipientAddress).filter(Boolean));
  const ccRecipients = (input.cc || "").split(/[;,]/).map(item => item.trim()).filter(Boolean);
  // Wael is copied on other correspondence. Mia is NOT his default CC; only
  // add her when the originating workflow has verified this is his appointment.
  const required = toAddresses.has(WAEL_EMAIL) ? null : WAEL_EMAIL;
  const merged = [...ccRecipients, ...(required ? [required] : []), ...(input.waelAppointment ? [MIA_EMAIL] : [])];
  const seen = new Set<string>();
  return merged.filter(recipient => {
    const address = recipientAddress(recipient);
    if (!address || toAddresses.has(address) || seen.has(address)) return false;
    seen.add(address);
    return true;
  }).join(", ");
}

/**
 * Save a message in the real Private Email Drafts folder. This is the review
 * boundary: the owner opens the normal email client, edits if needed, and sends
 * from there. No SMTP delivery occurs in this function.
 */
export async function saveComoMailboxDraft(input: {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  waelAppointment?: boolean;
  inReplyTo?: string;
  draftKey: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType: string }>;
  /** Existing command association; never inferred from untrusted mailbox text. */
  lineage?: { userId: number; projectId: number; workFileId: number; communicationId: number } | null;
}): Promise<{ folder: string; uid: number | null; created: boolean; observedInSent?: boolean }> {
  if (!EMAIL_PASSWORD) throw new Error("EMAIL_PASSWORD not configured");
  const to = input.to.trim();
  const subject = input.subject.replace(/[\r\n]+/g, " ").trim();
  const body = input.body.trim();
  const cc = applyComoCcPolicy({ to, cc: input.cc, waelAppointment: input.waelAppointment });
  const draftKey = input.draftKey.trim();
  if (!to || !to.includes("@") || !subject || !body || !draftKey) {
    throw new Error("Draft recipient, subject, body, and key are required");
  }
  if ((input.attachments?.length || 0) > 5
    || input.attachments?.some(file => !file.filename.trim() || file.content.length > 15 * 1024 * 1024)) {
    throw new Error("Draft attachments exceed the allowed count or size");
  }
  const mailboxKey = mailboxKeyForDraftLedger(EMAIL_USER);
  const messageId = deterministicDraftMessageId({ mailboxKey, draftKey });

  const streamTransport = nodemailer.createTransport({
    streamTransport: true,
    buffer: true,
    newline: "unix",
  });
  const generated = await streamTransport.sendMail({
    from: { name: "Abdalrahman Zaqout", address: EMAIL_USER },
    to,
    cc: cc || undefined,
    subject,
    text: body,
    html: `<div dir="auto" style="white-space:normal;line-height:1.7">${plainTextToSafeHtml(body)}</div>`,
    ...(input.attachments?.length ? { attachments: input.attachments } : {}),
    ...(input.inReplyTo ? { inReplyTo: input.inReplyTo, references: input.inReplyTo } : {}),
    messageId,
    headers: { "X-COMO-Draft-Key": draftKey },
  });
  const raw = generated.message as Buffer;
  const saved = await saveMailboxDraftExactlyOnce({
    ledger: new DatabaseMailboxDraftLedger(),
    claim: { mailboxKey, draftKey, messageId, subject, body, to, cc, lineage: input.lineage || null },
    mailbox: privateEmailDraftAppendPort(raw),
  });
  return { folder: saved.folder, uid: saved.uid, created: saved.created, observedInSent: saved.observedInSent };
}

/** IMAP is a narrow port: inspection is read-only; append occurs only after the durable ledger transitions to append_started. */
function privateEmailDraftAppendPort(raw: Buffer) {
  return {
    findByStableIdentity(input: { draftKey: string; messageId: string }): Promise<MailboxDraftLookup> {
      return new Promise((resolve, reject) => {
        const imap = new Imap({ user: EMAIL_USER, password: EMAIL_PASSWORD, host: EMAIL_HOST, port: 993, tls: true,
          tlsOptions: { rejectUnauthorized: false }, connTimeout: 15000, authTimeout: 10000 });
        let settled = false;
        const finish = (error?: Error, value?: MailboxDraftLookup) => {
          if (settled) return;
          settled = true;
          try { imap.end(); } catch { /* already closed */ }
          if (error) reject(error); else resolve(value!);
        };
        imap.once("ready", () => imap.getBoxes((boxError, boxes) => {
          if (boxError) return finish(boxError);
          const nodes = boxes as unknown as Record<string, ImapMailboxNode>;
          const folders = [
            { folder: findDraftMailbox(nodes), sent: false },
            { folder: findSentMailbox(nodes), sent: true },
          ];
          const matches: Array<{ folder: string; uid: number; sent: boolean }> = [];
          const inspectOne = (index: number) => {
            if (index >= folders.length) {
              const unique = matches.filter((match, matchIndex, all) => matchIndex === all.findIndex(item => item.folder === match.folder && item.uid === match.uid));
              if (!unique.length) return finish(undefined, { kind: "missing" });
              if (unique.length === 1) return finish(undefined, { kind: "found", ...unique[0]! });
              return finish(undefined, { kind: "ambiguous", folders: unique });
            }
            const target = folders[index]!;
            imap.openBox(target.folder, true, openError => {
              if (openError) return finish(openError);
              // node-imap's OR grammar is one search criterion inside the
              // outer criteria list. A selected box is inspected to completion
              // before the next one is opened on this connection.
              imap.search([["OR", ["HEADER", "X-COMO-Draft-Key", input.draftKey], ["HEADER", "Message-ID", input.messageId]]], (searchError, uids) => {
                if (searchError) return finish(searchError);
                if (Array.isArray(uids)) {
                  for (const uid of uids) matches.push({ folder: target.folder, uid, sent: target.sent });
                }
                inspectOne(index + 1);
              });
            });
          };
          inspectOne(0);
        }));
        imap.once("error", (error: Error) => finish(error));
        imap.connect();
      });
    },
    appendDraft(): Promise<void> {
      return new Promise((resolve, reject) => {
        const imap = new Imap({ user: EMAIL_USER, password: EMAIL_PASSWORD, host: EMAIL_HOST, port: 993, tls: true,
          tlsOptions: { rejectUnauthorized: false }, connTimeout: 15000, authTimeout: 10000 });
        let settled = false;
        const finish = (error?: Error) => {
          if (settled) return;
          settled = true;
          try { imap.end(); } catch { /* already closed */ }
          if (error) reject(error); else resolve();
        };
        imap.once("ready", () => imap.getBoxes((boxError, boxes) => {
          if (boxError) return finish(boxError);
          const folder = findDraftMailbox(boxes as unknown as Record<string, ImapMailboxNode>);
          imap.append(raw, { mailbox: folder, flags: ["\\Draft"], date: new Date() }, appendError => finish(appendError || undefined));
        }));
        imap.once("error", (error: Error) => finish(error));
        imap.connect();
      });
    },
  };
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
