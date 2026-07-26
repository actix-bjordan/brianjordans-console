import type { FastifyInstance } from "fastify";
import {
  buildAuthorizeUrl,
  createPkcePair,
  exchangeCodeForIdentity,
  randomToken,
} from "../auth/google.js";
import {
  clearSession,
  consumeOAuthTransaction,
  issueSession,
  startOAuthTransaction,
} from "../auth/session.js";
import { renderLoginPage } from "../login-page.js";
import { getUser, recordLogin } from "../users/repository.js";

/** Only allow relative paths back into this app, never an attacker-supplied host. */
function safeReturnTo(value: unknown): string {
  if (typeof value !== "string") return "/dashboard";
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  if (value.startsWith("/login") || value.startsWith("/auth/")) return "/dashboard";
  return value;
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/login", async (request, reply) => {
    const query = request.query as { reason?: string; returnTo?: string };
    return reply
      .type("text/html; charset=utf-8")
      .header("cache-control", "no-store")
      .send(renderLoginPage({ reason: query.reason, returnTo: query.returnTo }));
  });

  app.get("/auth/google", async (request, reply) => {
    const query = request.query as { returnTo?: string };
    const { verifier, challenge } = createPkcePair();
    const state = randomToken();
    const nonce = randomToken();

    await startOAuthTransaction(reply, {
      state,
      nonce,
      codeVerifier: verifier,
      returnTo: safeReturnTo(query.returnTo),
    });

    return reply.redirect(buildAuthorizeUrl({ state, nonce, codeChallenge: challenge }), 302);
  });

  app.get("/auth/callback", async (request, reply) => {
    const query = request.query as { code?: string; state?: string; error?: string };
    const transaction = await consumeOAuthTransaction(request, reply);

    if (query.error || !query.code || !query.state) {
      return reply.redirect("/login?reason=failed", 302);
    }
    if (!transaction) {
      return reply.redirect("/login?reason=expired", 302);
    }
    if (transaction.state !== query.state) {
      request.log.warn("OAuth state mismatch on callback");
      return reply.redirect("/login?reason=failed", 302);
    }

    let identity;
    try {
      identity = await exchangeCodeForIdentity(query.code, transaction.codeVerifier, transaction.nonce);
    } catch (error) {
      request.log.error({ err: error }, "Google code exchange failed");
      return reply.redirect("/login?reason=failed", 302);
    }

    if (!identity.emailVerified) {
      request.log.warn({ email: identity.email }, "Rejected sign-in with unverified Google email");
      return reply.redirect("/login?reason=denied", 302);
    }

    // Authorization is the app's decision, not Google's: the address must
    // already exist in the directory and be active.
    const user = await getUser(identity.email);
    if (!user) {
      request.log.warn({ email: identity.email }, "Rejected sign-in for unknown account");
      return reply.redirect("/login?reason=denied", 302);
    }
    if (user.status !== "active") {
      request.log.warn({ email: identity.email }, "Rejected sign-in for disabled account");
      return reply.redirect("/login?reason=disabled", 302);
    }

    try {
      await recordLogin(user.email, identity.sub);
    } catch (error) {
      request.log.warn({ err: error }, "Could not record login metadata");
    }

    await issueSession(reply, { sub: identity.sub, email: user.email });
    return reply.redirect(transaction.returnTo, 302);
  });

  app.post("/auth/logout", async (_request, reply) => {
    clearSession(reply);
    return reply.send({ ok: true });
  });
}
