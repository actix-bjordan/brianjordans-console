import { existsSync } from "node:fs";
import fastifyCookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { authGate } from "./auth/middleware.js";
import { config, isProduction } from "./config.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerUserRoutes } from "./routes/users.js";
import { ensureBootstrapAdmin } from "./users/bootstrap.js";

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? "info",
    redact: ["req.headers.cookie", "req.headers.authorization"],
  },
  // The ALB terminates TLS, so the real scheme and client IP arrive in headers.
  trustProxy: true,
});

await app.register(fastifyCookie);

// Applies to every route registered after this point, including static assets.
app.addHook("onRequest", authGate);

app.addHook("onSend", async (_request, reply, payload) => {
  reply.header("x-content-type-options", "nosniff");
  reply.header("x-frame-options", "DENY");
  reply.header("referrer-policy", "strict-origin-when-cross-origin");
  reply.header("x-robots-tag", "noindex, nofollow");
  if (isProduction) {
    reply.header("strict-transport-security", "max-age=63072000; includeSubDomains; preload");
  }
  return payload;
});

app.get("/healthz", async () => ({ status: "ok" }));

await registerAuthRoutes(app);
await registerUserRoutes(app);

if (!existsSync(config.clientDist)) {
  app.log.error({ path: config.clientDist }, "Client bundle not found; build the app first");
}

await app.register(fastifyStatic, {
  root: config.clientDist,
  prefix: "/",
  index: false,
  setHeaders(res, path) {
    if (path.endsWith(".html")) {
      res.setHeader("cache-control", "no-store");
    } else {
      // Vite emits content-hashed asset filenames.
      res.setHeader("cache-control", "public, max-age=31536000, immutable");
    }
  },
});

// SPA fallback. The auth gate already ran, so anything reaching here is a
// signed-in user asking for a client-side route.
app.setNotFoundHandler(async (request, reply) => {
  if (request.url.startsWith("/api/")) {
    return reply.code(404).send({ error: "not_found" });
  }
  return reply.type("text/html; charset=utf-8").header("cache-control", "no-store").sendFile(
    "index.html",
    config.clientDist,
  );
});

async function start(): Promise<void> {
  try {
    await ensureBootstrapAdmin(app.log);
  } catch (error) {
    // A directory problem should not stop the container from serving /healthz,
    // otherwise the deployment rolls back and hides the real error.
    app.log.error({ err: error }, "Bootstrap admin check failed");
  }

  await app.listen({ port: config.port, host: config.host });
  app.log.info(
    { publicBaseUrl: config.publicBaseUrl, clientDist: config.clientDist },
    "Console server listening",
  );
}

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    app.log.info({ signal }, "Shutting down");
    app.close().then(
      () => process.exit(0),
      () => process.exit(1),
    );
  });
}

await start();
