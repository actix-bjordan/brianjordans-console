import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() !== "" ? value.trim() : fallback;
}

const here = dirname(fileURLToPath(import.meta.url));

export const config = {
  nodeEnv: optional("NODE_ENV", "development"),
  port: Number.parseInt(optional("PORT", "8080"), 10),
  host: optional("HOST", "0.0.0.0"),

  /** Absolute base URL the browser reaches this app on. Used to build the OAuth redirect URI. */
  publicBaseUrl: required("PUBLIC_BASE_URL").replace(/\/+$/, ""),

  google: {
    clientId: required("GOOGLE_CLIENT_ID"),
    clientSecret: required("GOOGLE_CLIENT_SECRET"),
  },

  /** Used to derive the AES key that encrypts session and OAuth transaction cookies. */
  sessionSecret: required("SESSION_SECRET"),
  sessionTtlSeconds: Number.parseInt(optional("SESSION_TTL_SECONDS", "43200"), 10),

  usersTable: required("USERS_TABLE"),
  awsRegion: optional("AWS_REGION", "us-east-1"),

  /**
   * Seeded as an active admin at startup when the directory has no admin yet,
   * so there is a way in before any user exists.
   */
  bootstrapAdminEmail: optional("BOOTSTRAP_ADMIN_EMAIL", "").toLowerCase(),

  /** Built SPA served only to authenticated requests. */
  clientDist: resolve(optional("CLIENT_DIST", resolve(here, "../../app/dist"))),
} as const;

export const isProduction = config.nodeEnv === "production";
