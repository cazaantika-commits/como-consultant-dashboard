import { google } from "googleapis";
import { getDb } from "./db.js";
import { oauthTokens } from "../drizzle/schema.js";
import { eq } from "drizzle-orm";

/**
 * Get OAuth2 client for a user with valid tokens
 * Returns null if user hasn't connected Google Drive or tokens are invalid
 */
export async function getOAuthClientForUser(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const [tokenRecord] = await db
    .select()
    .from(oauthTokens)
    .where(eq(oauthTokens.userId, userId))
    .limit(1);

  if (!tokenRecord) {
    return null;
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    `${process.env.VITE_APP_URL || 'https://3000-i6cd04a2vbblbk72jis4l-aa5a6d8a.sg1.manus.computer'}/api/google/oauth/callback`
  );

  oauth2Client.setCredentials({
    access_token: tokenRecord.accessToken,
    refresh_token: tokenRecord.refreshToken || undefined,
    expiry_date: tokenRecord.expiresAt?.getTime(),
    scope: tokenRecord.scope || undefined,
  });

  // Auto-refresh tokens
  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.refresh_token) {
      // Update both access and refresh tokens
      const db = await getDb();
      if (!db) return;
      await db
        .update(oauthTokens)
        .set({
          accessToken: tokens.access_token!,
          refreshToken: tokens.refresh_token,
          expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        })
        .where(eq(oauthTokens.userId, userId));
    } else {
      // Update only access token
      const db = await getDb();
      if (!db) return;
      await db
        .update(oauthTokens)
        .set({
          accessToken: tokens.access_token!,
          expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        })
        .where(eq(oauthTokens.userId, userId));
    }
  });

  return oauth2Client;
}
