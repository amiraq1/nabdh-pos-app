import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import os from "os";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const PRIVATE_IPV4_PATTERNS = [
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
];

function getConfiguredCorsOrigins() {
  return new Set(
    (process.env.CORS_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map(origin => origin.trim())
      .filter(Boolean)
  );
}

function isPrivateNetworkHost(hostname: string) {
  return PRIVATE_IPV4_PATTERNS.some(pattern => pattern.test(hostname));
}

function isAllowedDevOrigin(origin: string) {
  if (origin === "capacitor://localhost" || origin === "ionic://localhost") {
    return true;
  }

  try {
    const url = new URL(origin);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }

    return LOCAL_HOSTS.has(url.hostname) || isPrivateNetworkHost(url.hostname);
  } catch {
    return false;
  }
}

function isAllowedCorsOrigin(origin: string, configuredOrigins: Set<string>) {
  if (configuredOrigins.has(origin)) {
    return true;
  }

  return process.env.NODE_ENV !== "production" && isAllowedDevOrigin(origin);
}

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
  const configuredCorsOrigins = getConfiguredCorsOrigins();
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  
  // CORS Middleware for Mobile Connectivity
  app.use((req, res, next) => {
    const origin = typeof req.headers.origin === "string" ? req.headers.origin : undefined;

    if (origin && isAllowedCorsOrigin(origin, configuredCorsOrigins)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Credentials", "true");
      res.header("Vary", "Origin");
    }

    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    const requestedHeaders = req.headers["access-control-request-headers"];
    res.header(
      "Access-Control-Allow-Headers",
      Array.isArray(requestedHeaders)
        ? requestedHeaders.join(", ")
        : requestedHeaders ||
            "Origin, X-Requested-With, Content-Type, Accept, Authorization, trpc-batch-mode"
    );
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // Auto-detect development mode if not explicitly set to production
  if (process.env.NODE_ENV !== "production") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, "0.0.0.0", () => {
    const addresses: string[] = [];
    const interfaces = os.networkInterfaces();
    for (const k in interfaces) {
        const networkInfs = interfaces[k];
        if (!networkInfs) continue;
        for (const address of networkInfs) {
            if (address.family === 'IPv4' && !address.internal) {
                addresses.push(address.address);
            }
        }
    }

    console.log(`\n🚀 Nabdh POS Server is live!`);
    console.log(`- Local:   http://localhost:${port}/`);
    addresses.forEach(ip => console.log(`- Network: http://${ip}:${port}/`));
    
    console.log(`\n[Capacitor Tip]`);
    console.log(`1. Emulator: Set VITE_API_URL=http://10.0.2.2:${port}`);
    if (addresses.length > 0) {
      console.log(`2. Real Device: Set VITE_API_URL=http://${addresses[0]}:${port}`);
    }
  });
}

startServer().catch(console.error);
