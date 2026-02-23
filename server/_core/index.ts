import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import dashboardDataRoute from "../dashboardDataRoute";
import agentApiRoute from "../agentApi";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { initTelegramBot, registerCallbackHandler, getBotInfo } from "../telegramBot";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Google OAuth callback for Drive integration
  app.get("/api/google/oauth/callback", async (req, res) => {
    const code = req.query.code as string;
    if (!code) {
      res.status(400).send("Missing code");
      return;
    }
    // Redirect to frontend with the code so it can exchange via tRPC
    res.redirect(302, `/google-connect?code=${encodeURIComponent(code)}`);
  });

  // Dashboard data API (for original HTML page)
  app.use("/api/dashboard-data", dashboardDataRoute);
  // Agent API (for Qasim, Salwa, and other agents)
  app.use("/api/agent", agentApiRoute);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });

  // Initialize Telegram bot (Salwa)
  try {
    const telegramBot = await initTelegramBot();
    if (telegramBot) {
      registerCallbackHandler(telegramBot);
      const info = await getBotInfo();
      if (info) {
        console.log(`[TelegramBot] \u2705 @${info.username} (${info.firstName}) is running`);
      }
    }
  } catch (error) {
    console.warn("[TelegramBot] Failed to start:", error);
  }
}

startServer().catch(console.error);
