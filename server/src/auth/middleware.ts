import type { FastifyReply, FastifyRequest } from "fastify";
import { config } from "../config.js";
import { getUserCached } from "../users/repository.js";
import type { ConsoleUser } from "../users/types.js";
import { clearSession, readSession } from "./session.js";

declare module "fastify" {
  interface FastifyRequest {
    consoleUser?: ConsoleUser;
  }
}

/**
 * Paths reachable without a session. Everything else, including the SPA bundle
 * and every static asset, requires one.
 */
const PUBLIC_PATHS = new Set(["/healthz", "/login", "/favicon.svg", "/auth/google", "/auth/callback"]);

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname);
}

function wantsJson(request: FastifyRequest): boolean {
  if (request.url.startsWith("/api/")) return true;
  const accept = request.headers.accept ?? "";
  return accept.includes("application/json") && !accept.includes("text/html");
}

/**
 * Global gate. Resolves the session to a live directory entry on every request,
 * so revoking access does not wait for the cookie to expire.
 */
export async function authGate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const pathname = new URL(request.url, config.publicBaseUrl).pathname;
  if (isPublic(pathname)) return;

  const session = await readSession(request);
  if (!session) {
    await deny(request, reply, 401);
    return;
  }

  const user = await getUserCached(session.email);
  if (!user || user.status !== "active") {
    clearSession(reply);
    await deny(request, reply, 403);
    return;
  }

  request.consoleUser = user;
}

async function deny(request: FastifyRequest, reply: FastifyReply, status: number): Promise<void> {
  if (wantsJson(request)) {
    await reply.code(status).send({ error: status === 401 ? "unauthenticated" : "forbidden" });
    return;
  }

  const returnTo = request.method === "GET" ? request.url : "/dashboard";
  await reply.redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`, 302);
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (request.consoleUser?.role !== "admin") {
    return reply.code(403).send({ error: "forbidden" });
  }
}

/**
 * Rejects state-changing requests that did not originate from this app. The
 * session cookie is SameSite=Lax, which already blocks cross-site form posts;
 * this closes the gap for same-site subdomains and malformed clients.
 */
export async function verifyOrigin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;

  const origin = request.headers.origin;
  if (!origin) return reply.code(403).send({ error: "missing_origin" });
  if (origin !== config.publicBaseUrl) {
    return reply.code(403).send({ error: "bad_origin" });
  }
}
