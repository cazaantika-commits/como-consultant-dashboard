import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { describeComoOAuthFailure, type ComoOAuthStage } from "../services/comoOAuthDiagnostics";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    const reference = `como-auth-${randomUUID()}`;
    let stage: ComoOAuthStage = "configuration";
    try {
      // Missing persistence/signing configuration must not consume a one-time
      // authorization code or create an unusable/unsigned session.
      if (!ENV.appId || !ENV.cookieSecret || !ENV.databaseUrl || !ENV.oAuthServerUrl) {
        throw new Error("COMO authentication configuration unavailable");
      }
      stage = "exchange_token";
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      stage = "user_info";
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      stage = "user_persistence";
      if (!(await db.getDb())) {
        throw Object.assign(new Error("COMO database unavailable"), { code: "COMO_DATABASE_UNAVAILABLE" });
      }
      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      stage = "session_signing";
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      stage = "session_cookie";
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      const failure = describeComoOAuthFailure(stage, error);
      if (stage === "session_cookie") {
        res.clearCookie(COOKIE_NAME, getSessionCookieOptions(req));
      }
      console.error("[OAuth] Callback failed", { reference, ...failure });
      res.status(failure.status).json({
        error: "OAuth callback failed",
        message: "تعذّر إكمال تسجيل الدخول إلى COMO. لم تُنشأ جلسة دخول. المرجع أدناه يحدد موضع العطل للفحص.",
        failure_stage: failure.stage,
        failure_code: failure.failureCode,
        reference,
      });
    }
  });
}
