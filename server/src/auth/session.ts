import type { FastifyReply, FastifyRequest } from "fastify";
import { config, isProduction } from "../config.js";
import { decryptPayload, encryptPayload } from "./crypto.js";

export const SESSION_COOKIE = "bj_session";
export const OAUTH_COOKIE = "bj_oauth";

export interface SessionPayload {
  /** Google subject identifier, stable per account. */
  sub: string;
  email: string;
}

export interface OAuthTransaction {
  state: string;
  nonce: string;
  codeVerifier: string;
  returnTo: string;
}

const baseCookie = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax",
  path: "/",
} as const;

export async function issueSession(reply: FastifyReply, payload: SessionPayload): Promise<void> {
  const token = await encryptPayload({ ...payload }, config.sessionTtlSeconds);
  reply.setCookie(SESSION_COOKIE, token, {
    ...baseCookie,
    maxAge: config.sessionTtlSeconds,
  });
}

export function clearSession(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE, { ...baseCookie });
}

export async function readSession(request: FastifyRequest): Promise<SessionPayload | null> {
  const token = request.cookies[SESSION_COOKIE];
  if (!token) return null;
  const payload = await decryptPayload<SessionPayload>(token);
  if (!payload?.email || !payload.sub) return null;
  return payload;
}

export async function startOAuthTransaction(
  reply: FastifyReply,
  transaction: OAuthTransaction,
): Promise<void> {
  const token = await encryptPayload({ ...transaction }, 600);
  reply.setCookie(OAUTH_COOKIE, token, { ...baseCookie, maxAge: 600 });
}

export async function consumeOAuthTransaction(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<OAuthTransaction | null> {
  const token = request.cookies[OAUTH_COOKIE];
  reply.clearCookie(OAUTH_COOKIE, { ...baseCookie });
  if (!token) return null;
  return decryptPayload<OAuthTransaction>(token);
}
