import { router, protectedProcedure } from "../_core/trpc.js";
import { google } from "googleapis";
import { getDb } from "../db.js";
import { oauthTokens } from "../../drizzle/schema.js";
import { eq } from "drizzle-orm";
import { z } from "zod";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_OAUTH_CLIENT_ID,
  process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  `${process.env.VITE_APP_URL || 'https://3000-i6cd04a2vbblbk72jis4l-aa5a6d8a.sg1.manus.computer'}/api/google/oauth/callback`
);

export const googleOAuthRouter = router({
  // Get authorization URL
  getAuthUrl: protectedProcedure.query(() => {
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/drive.file',
      ],
      prompt: 'consent', // Force consent screen to get refresh token
    });
    return { authUrl };
  }),

  // Handle OAuth callback
  handleCallback: protectedProcedure
    .input(z.object({ code: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { tokens } = await oauth2Client.getToken(input.code);
      
      // Save tokens to database
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      
      await db.insert(oauthTokens).values({
        userId: ctx.user.id,
        provider: 'google',
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token || null,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        scope: tokens.scope || null,
      }).onDuplicateKeyUpdate({
        set: {
          accessToken: tokens.access_token!,
          refreshToken: tokens.refresh_token || null,
          expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
          scope: tokens.scope || null,
        },
      });

      return { success: true };
    }),

  // Check if user has connected Google Drive
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { connected: false, expiresAt: null };
    
    const [token] = await db
      .select()
      .from(oauthTokens)
      .where(eq(oauthTokens.userId, ctx.user.id))
      .limit(1);

    return {
      connected: !!token,
      expiresAt: token?.expiresAt || null,
    };
  }),

  // Disconnect Google Drive
  disconnect: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');
    await db.delete(oauthTokens).where(eq(oauthTokens.userId, ctx.user.id));
    return { success: true };
  }),
});
