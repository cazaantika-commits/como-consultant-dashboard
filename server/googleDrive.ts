import { google, drive_v3 } from "googleapis";

/**
 * Google Drive integration module for Como Developments
 * Uses Service Account credentials stored as base64-encoded JSON in GOOGLE_SERVICE_ACCOUNT_KEY env var
 */

let driveClient: drive_v3.Drive | null = null;

function getCredentials(): Record<string, string> {
  const base64Key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!base64Key) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set");
  }
  try {
    const jsonStr = Buffer.from(base64Key, "base64").toString("utf-8");
    return JSON.parse(jsonStr);
  } catch (e) {
    throw new Error("Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY: invalid base64 or JSON");
  }
}

export function getDriveClient(): drive_v3.Drive {
  if (driveClient) return driveClient;

  const credentials = getCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key,
      project_id: credentials.project_id,
    },
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  driveClient = google.drive({ version: "v3", auth });
  return driveClient;
}

/** Reset cached client (useful for testing) */
export function resetDriveClient(): void {
  driveClient = null;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  createdTime?: string;
  parents?: string[];
  webViewLink?: string;
  iconLink?: string;
  thumbnailLink?: string;
}

export interface DriveFolder {
  id: string;
  name: string;
  mimeType: string;
}

const FOLDER_MIME = "application/vnd.google-apps.folder";

/**
 * List root-level shared folders (only the top-level folders shared with the service account)
 */
export async function listSharedDrives(): Promise<DriveFolder[]> {
  const drive = getDriveClient();
  const res = await drive.files.list({
    q: "sharedWithMe = true and trashed = false",
    fields: "files(id, name, mimeType)",
    pageSize: 100,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return (res.data.files || []).map((f) => ({
    id: f.id!,
    name: f.name!,
    mimeType: f.mimeType!,
  }));
}

/**
 * List files inside a specific folder
 */
export async function listFilesInFolder(
  folderId: string,
  pageToken?: string
): Promise<{ files: DriveFile[]; nextPageToken?: string }> {
  const drive = getDriveClient();
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields:
      "nextPageToken, files(id, name, mimeType, size, modifiedTime, createdTime, parents, webViewLink, iconLink, thumbnailLink)",
    pageSize: 100,
    orderBy: "folder,name",
    pageToken: pageToken || undefined,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const files = (res.data.files || []).map((f) => ({
    id: f.id!,
    name: f.name!,
    mimeType: f.mimeType!,
    size: f.size || undefined,
    modifiedTime: f.modifiedTime || undefined,
    createdTime: f.createdTime || undefined,
    parents: f.parents || undefined,
    webViewLink: f.webViewLink || undefined,
    iconLink: f.iconLink || undefined,
    thumbnailLink: f.thumbnailLink || undefined,
  }));

  return {
    files,
    nextPageToken: res.data.nextPageToken || undefined,
  };
}

/**
 * Get file/folder metadata by ID
 */
export async function getFileMetadata(fileId: string): Promise<DriveFile> {
  const drive = getDriveClient();
  const res = await drive.files.get({
    fileId,
    fields:
      "id, name, mimeType, size, modifiedTime, createdTime, parents, webViewLink, iconLink, thumbnailLink",
    supportsAllDrives: true,
  });
  return {
    id: res.data.id!,
    name: res.data.name!,
    mimeType: res.data.mimeType!,
    size: res.data.size || undefined,
    modifiedTime: res.data.modifiedTime || undefined,
    createdTime: res.data.createdTime || undefined,
    parents: res.data.parents || undefined,
    webViewLink: res.data.webViewLink || undefined,
    iconLink: res.data.iconLink || undefined,
    thumbnailLink: res.data.thumbnailLink || undefined,
  };
}

/**
 * Copy a file to a destination folder
 */
export async function copyFile(
  fileId: string,
  destinationFolderId: string,
  newName?: string
): Promise<DriveFile> {
  const drive = getDriveClient();

  // Get original file info if no new name provided
  let name = newName;
  if (!name) {
    const original = await drive.files.get({
      fileId,
      fields: "name",
      supportsAllDrives: true,
    });
    name = original.data.name!;
  }

  const res = await drive.files.copy({
    fileId,
    requestBody: {
      name,
      parents: [destinationFolderId],
    },
    fields: "id, name, mimeType, size, modifiedTime, createdTime, parents, webViewLink",
    supportsAllDrives: true,
  });

  return {
    id: res.data.id!,
    name: res.data.name!,
    mimeType: res.data.mimeType!,
    size: res.data.size || undefined,
    modifiedTime: res.data.modifiedTime || undefined,
    createdTime: res.data.createdTime || undefined,
    parents: res.data.parents || undefined,
    webViewLink: res.data.webViewLink || undefined,
  };
}

/**
 * Create a new folder inside a parent folder
 */
export async function createFolder(
  name: string,
  parentFolderId: string
): Promise<DriveFolder> {
  const drive = getDriveClient();
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: FOLDER_MIME,
      parents: [parentFolderId],
    },
    fields: "id, name, mimeType",
    supportsAllDrives: true,
  });
  return {
    id: res.data.id!,
    name: res.data.name!,
    mimeType: res.data.mimeType!,
  };
}

/**
 * Search for files by name across shared folders
 */
export async function searchFiles(
  query: string,
  folderId?: string
): Promise<DriveFile[]> {
  const drive = getDriveClient();
  let q = `name contains '${query.replace(/'/g, "\\'")}' and trashed = false`;
  if (folderId) {
    q = `'${folderId}' in parents and ${q}`;
  }

  const res = await drive.files.list({
    q,
    fields:
      "files(id, name, mimeType, size, modifiedTime, createdTime, parents, webViewLink, iconLink)",
    pageSize: 50,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  return (res.data.files || []).map((f) => ({
    id: f.id!,
    name: f.name!,
    mimeType: f.mimeType!,
    size: f.size || undefined,
    modifiedTime: f.modifiedTime || undefined,
    createdTime: f.createdTime || undefined,
    parents: f.parents || undefined,
    webViewLink: f.webViewLink || undefined,
    iconLink: f.iconLink || undefined,
  }));
}

// ═══════════════════════════════════════════════════
// File Content Reading
// ═══════════════════════════════════════════════════

// Google Workspace MIME types that need export
const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";
const GOOGLE_SHEET_MIME = "application/vnd.google-apps.spreadsheet";
const GOOGLE_SLIDES_MIME = "application/vnd.google-apps.presentation";
const GOOGLE_DRAWING_MIME = "application/vnd.google-apps.drawing";

// Export formats for Google Workspace files
const EXPORT_FORMATS: Record<string, { mimeType: string; label: string }> = {
  [GOOGLE_DOC_MIME]: { mimeType: "text/plain", label: "Google Doc → نص" },
  [GOOGLE_SHEET_MIME]: { mimeType: "text/csv", label: "Google Sheet → CSV" },
  [GOOGLE_SLIDES_MIME]: { mimeType: "text/plain", label: "Google Slides → نص" },
  [GOOGLE_DRAWING_MIME]: { mimeType: "image/png", label: "Google Drawing → صورة" },
};

// Max content size to return to agent (prevent token overflow)
const MAX_CONTENT_CHARS = 15000;

export interface FileContentResult {
  fileId: string;
  fileName: string;
  mimeType: string;
  contentType: "text" | "csv" | "unsupported";
  content: string;
  truncated: boolean;
  totalChars: number;
  error?: string;
}

/**
 * Read the text content of a file from Google Drive.
 * Supports:
 * - Google Docs → exported as plain text
 * - Google Sheets → exported as CSV
 * - Google Slides → exported as plain text
 * - PDF files → text extracted via pdf-parse
 * - Plain text files (txt, csv, json, xml, html, md, etc.) → downloaded directly
 * - Excel files (.xlsx) → not supported yet (returns metadata only)
 */
export async function readFileContent(fileId: string): Promise<FileContentResult> {
  const drive = getDriveClient();

  // Step 1: Get file metadata
  const meta = await drive.files.get({
    fileId,
    fields: "id, name, mimeType, size",
    supportsAllDrives: true,
  });

  const fileName = meta.data.name || "unknown";
  const mimeType = meta.data.mimeType || "unknown";
  const fileSize = parseInt(meta.data.size || "0", 10);

  // Step 2: Check if it's a Google Workspace file that needs export
  const exportFormat = EXPORT_FORMATS[mimeType];
  if (exportFormat) {
    try {
      const res = await drive.files.export(
        { fileId, mimeType: exportFormat.mimeType },
        { responseType: "text" }
      );

      let content = String(res.data);
      const totalChars = content.length;
      const truncated = totalChars > MAX_CONTENT_CHARS;
      if (truncated) {
        content = content.substring(0, MAX_CONTENT_CHARS) + "\n\n... [تم اقتطاع المحتوى - الملف يحتوي على " + totalChars + " حرف]";
      }

      return {
        fileId,
        fileName,
        mimeType,
        contentType: mimeType === GOOGLE_SHEET_MIME ? "csv" : "text",
        content,
        truncated,
        totalChars,
      };
    } catch (e: any) {
      return {
        fileId,
        fileName,
        mimeType,
        contentType: "text",
        content: "",
        truncated: false,
        totalChars: 0,
        error: `فشل تصدير ${exportFormat.label}: ${e.message}`,
      };
    }
  }

  // Step 3: Handle PDF files
  if (mimeType === "application/pdf") {
    // Limit PDF size to 10MB
    if (fileSize > 10 * 1024 * 1024) {
      return {
        fileId,
        fileName,
        mimeType,
        contentType: "text",
        content: "",
        truncated: false,
        totalChars: 0,
        error: `ملف PDF كبير جداً (${Math.round(fileSize / 1024 / 1024)} MB). الحد الأقصى 10 MB.`,
      };
    }

    try {
      const res = await drive.files.get(
        { fileId, alt: "media", supportsAllDrives: true },
        { responseType: "arraybuffer" }
      );

      const pdfParse = (await import("pdf-parse")).default;
      const pdfData = await pdfParse(Buffer.from(res.data as ArrayBuffer));

      let content = pdfData.text || "";
      const totalChars = content.length;
      const truncated = totalChars > MAX_CONTENT_CHARS;
      if (truncated) {
        content = content.substring(0, MAX_CONTENT_CHARS) + "\n\n... [تم اقتطاع المحتوى - الملف يحتوي على " + totalChars + " حرف]";
      }

      return {
        fileId,
        fileName,
        mimeType,
        contentType: "text",
        content: content || "(ملف PDF فارغ أو يحتوي على صور فقط)",
        truncated,
        totalChars,
      };
    } catch (e: any) {
      return {
        fileId,
        fileName,
        mimeType,
        contentType: "text",
        content: "",
        truncated: false,
        totalChars: 0,
        error: `فشل قراءة PDF: ${e.message}`,
      };
    }
  }

  // Step 4: Handle plain text files
  const textMimeTypes = [
    "text/plain", "text/csv", "text/html", "text/xml",
    "application/json", "application/xml",
    "text/markdown", "text/tab-separated-values",
  ];
  const textExtensions = [".txt", ".csv", ".json", ".xml", ".html", ".md", ".yml", ".yaml", ".log", ".tsv"];
  const isTextFile = textMimeTypes.includes(mimeType) ||
    textExtensions.some(ext => fileName.toLowerCase().endsWith(ext));

  if (isTextFile) {
    // Limit text file size to 5MB
    if (fileSize > 5 * 1024 * 1024) {
      return {
        fileId,
        fileName,
        mimeType,
        contentType: "text",
        content: "",
        truncated: false,
        totalChars: 0,
        error: `ملف نصي كبير جداً (${Math.round(fileSize / 1024 / 1024)} MB). الحد الأقصى 5 MB.`,
      };
    }

    try {
      const res = await drive.files.get(
        { fileId, alt: "media", supportsAllDrives: true },
        { responseType: "text" }
      );

      let content = String(res.data);
      const totalChars = content.length;
      const truncated = totalChars > MAX_CONTENT_CHARS;
      if (truncated) {
        content = content.substring(0, MAX_CONTENT_CHARS) + "\n\n... [تم اقتطاع المحتوى - الملف يحتوي على " + totalChars + " حرف]";
      }

      return {
        fileId,
        fileName,
        mimeType,
        contentType: mimeType === "text/csv" || fileName.endsWith(".csv") ? "csv" : "text",
        content,
        truncated,
        totalChars,
      };
    } catch (e: any) {
      return {
        fileId,
        fileName,
        mimeType,
        contentType: "text",
        content: "",
        truncated: false,
        totalChars: 0,
        error: `فشل قراءة الملف النصي: ${e.message}`,
      };
    }
  }

  // Step 5: Unsupported file type
  return {
    fileId,
    fileName,
    mimeType,
    contentType: "unsupported",
    content: "",
    truncated: false,
    totalChars: 0,
    error: `نوع الملف غير مدعوم للقراءة: ${mimeType}. الأنواع المدعومة: Google Docs, Google Sheets, PDF, ملفات نصية (txt, csv, json, xml, html, md)`,
  };
}

/**
 * Verify connection to Google Drive - returns service account email and shared files count
 */
export async function verifyConnection(): Promise<{
  connected: boolean;
  email: string;
  sharedFilesCount: number;
}> {
  const credentials = getCredentials();
  const drive = getDriveClient();

  const res = await drive.files.list({
    q: "sharedWithMe or 'me' in readers",
    fields: "files(id)",
    pageSize: 200,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  return {
    connected: true,
    email: credentials.client_email,
    sharedFilesCount: res.data.files?.length || 0,
  };
}


// ═══════════════════════════════════════════════════
// File Upload & Creation
// ═══════════════════════════════════════════════════

/**
 * Upload a text-based file to Google Drive
 * Supports: plain text, CSV, JSON, HTML, Markdown
 */
export async function uploadTextFile(
  fileName: string,
  content: string,
  parentFolderId: string,
  mimeType: string = "text/plain"
): Promise<DriveFile> {
  const drive = getDriveClient();
  const { Readable } = await import("stream");

  const stream = new Readable();
  stream.push(content);
  stream.push(null);

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      mimeType,
      parents: [parentFolderId],
    },
    media: {
      mimeType,
      body: stream,
    },
    fields: "id, name, mimeType, size, modifiedTime, createdTime, parents, webViewLink",
    supportsAllDrives: true,
  });

  return {
    id: res.data.id!,
    name: res.data.name!,
    mimeType: res.data.mimeType!,
    size: res.data.size || undefined,
    modifiedTime: res.data.modifiedTime || undefined,
    createdTime: res.data.createdTime || undefined,
    parents: res.data.parents || undefined,
    webViewLink: res.data.webViewLink || undefined,
  };
}

/**
 * Create a Google Doc with content (converts from text/HTML)
 * The content can be plain text or HTML - Google will convert it
 */
export async function createGoogleDoc(
  title: string,
  content: string,
  parentFolderId: string,
  contentType: "text" | "html" = "text"
): Promise<DriveFile> {
  const drive = getDriveClient();
  const { Readable } = await import("stream");

  const mimeType = contentType === "html" ? "text/html" : "text/plain";
  const stream = new Readable();
  stream.push(content);
  stream.push(null);

  const res = await drive.files.create({
    requestBody: {
      name: title,
      mimeType: "application/vnd.google-apps.document", // Convert to Google Doc
      parents: [parentFolderId],
    },
    media: {
      mimeType,
      body: stream,
    },
    fields: "id, name, mimeType, size, modifiedTime, createdTime, parents, webViewLink",
    supportsAllDrives: true,
  });

  return {
    id: res.data.id!,
    name: res.data.name!,
    mimeType: res.data.mimeType!,
    size: res.data.size || undefined,
    modifiedTime: res.data.modifiedTime || undefined,
    createdTime: res.data.createdTime || undefined,
    parents: res.data.parents || undefined,
    webViewLink: res.data.webViewLink || undefined,
  };
}

/**
 * Create a Google Sheet from CSV data
 */
export async function createGoogleSheet(
  title: string,
  csvContent: string,
  parentFolderId: string
): Promise<DriveFile> {
  const drive = getDriveClient();
  const { Readable } = await import("stream");

  const stream = new Readable();
  stream.push(csvContent);
  stream.push(null);

  const res = await drive.files.create({
    requestBody: {
      name: title,
      mimeType: "application/vnd.google-apps.spreadsheet", // Convert to Google Sheet
      parents: [parentFolderId],
    },
    media: {
      mimeType: "text/csv",
      body: stream,
    },
    fields: "id, name, mimeType, size, modifiedTime, createdTime, parents, webViewLink",
    supportsAllDrives: true,
  });

  return {
    id: res.data.id!,
    name: res.data.name!,
    mimeType: res.data.mimeType!,
    size: res.data.size || undefined,
    modifiedTime: res.data.modifiedTime || undefined,
    createdTime: res.data.createdTime || undefined,
    parents: res.data.parents || undefined,
    webViewLink: res.data.webViewLink || undefined,
  };
}

/**
 * Update (overwrite) the content of an existing file
 */
export async function updateFileContent(
  fileId: string,
  content: string,
  mimeType: string = "text/plain"
): Promise<DriveFile> {
  const drive = getDriveClient();
  const { Readable } = await import("stream");

  const stream = new Readable();
  stream.push(content);
  stream.push(null);

  const res = await drive.files.update({
    fileId,
    media: {
      mimeType,
      body: stream,
    },
    fields: "id, name, mimeType, size, modifiedTime, createdTime, parents, webViewLink",
    supportsAllDrives: true,
  });

  return {
    id: res.data.id!,
    name: res.data.name!,
    mimeType: res.data.mimeType!,
    size: res.data.size || undefined,
    modifiedTime: res.data.modifiedTime || undefined,
    createdTime: res.data.createdTime || undefined,
    parents: res.data.parents || undefined,
    webViewLink: res.data.webViewLink || undefined,
  };
}


// ═══════════════════════════════════════════════════
// File Management: Rename, Move, Delete
// ═══════════════════════════════════════════════════

/**
 * Rename a file or folder in Google Drive
 */
export async function renameFile(
  fileId: string,
  newName: string
): Promise<DriveFile> {
  const drive = getDriveClient();
  const res = await drive.files.update({
    fileId,
    requestBody: { name: newName },
    fields: "id, name, mimeType, size, modifiedTime, createdTime, parents, webViewLink",
    supportsAllDrives: true,
  });

  return {
    id: res.data.id!,
    name: res.data.name!,
    mimeType: res.data.mimeType!,
    size: res.data.size || undefined,
    modifiedTime: res.data.modifiedTime || undefined,
    createdTime: res.data.createdTime || undefined,
    parents: res.data.parents || undefined,
    webViewLink: res.data.webViewLink || undefined,
  };
}

/**
 * Move a file or folder to a different parent folder in Google Drive
 */
export async function moveFile(
  fileId: string,
  newParentFolderId: string
): Promise<DriveFile> {
  const drive = getDriveClient();

  // Get current parents to remove them
  const current = await drive.files.get({
    fileId,
    fields: "parents",
    supportsAllDrives: true,
  });
  const previousParents = (current.data.parents || []).join(",");

  const res = await drive.files.update({
    fileId,
    addParents: newParentFolderId,
    removeParents: previousParents,
    fields: "id, name, mimeType, size, modifiedTime, createdTime, parents, webViewLink",
    supportsAllDrives: true,
  });

  return {
    id: res.data.id!,
    name: res.data.name!,
    mimeType: res.data.mimeType!,
    size: res.data.size || undefined,
    modifiedTime: res.data.modifiedTime || undefined,
    createdTime: res.data.createdTime || undefined,
    parents: res.data.parents || undefined,
    webViewLink: res.data.webViewLink || undefined,
  };
}

/**
 * Delete a file or folder from Google Drive (moves to trash)
 */
export async function deleteFile(fileId: string): Promise<{ success: boolean; fileId: string }> {
  const drive = getDriveClient();
  await drive.files.update({
    fileId,
    requestBody: { trashed: true },
    supportsAllDrives: true,
  });
  return { success: true, fileId };
}
