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
