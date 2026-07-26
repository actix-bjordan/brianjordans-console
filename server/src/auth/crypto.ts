import { createHash } from "node:crypto";
import { EncryptJWT, jwtDecrypt } from "jose";
import { config } from "../config.js";

/**
 * A256GCM needs exactly 32 bytes. The configured secret is arbitrary text, so
 * it is hashed to length rather than being required to be key-shaped.
 */
const key = createHash("sha256").update(config.sessionSecret).digest();

export async function encryptPayload(
  payload: Record<string, unknown>,
  ttlSeconds: number,
): Promise<string> {
  return new EncryptJWT(payload)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .encrypt(key);
}

export async function decryptPayload<T>(token: string): Promise<T | null> {
  try {
    const { payload } = await jwtDecrypt(token, key);
    return payload as T;
  } catch {
    // Tampered, expired, or encrypted under a rotated secret. All mean "no session".
    return null;
  }
}
