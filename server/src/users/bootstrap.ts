import type { FastifyBaseLogger } from "fastify";
import { config } from "../config.js";
import { countAdmins, createUser, getUser, updateUser } from "./repository.js";

/**
 * Ensures there is always a way in. If the directory has no active admin and a
 * bootstrap address is configured, that address is created (or promoted) so the
 * first sign-in can succeed and manage everyone else from the UI.
 */
export async function ensureBootstrapAdmin(log: FastifyBaseLogger): Promise<void> {
  const email = config.bootstrapAdminEmail;
  if (!email) {
    log.warn("No BOOTSTRAP_ADMIN_EMAIL configured; sign-in will fail until a user is seeded");
    return;
  }

  const admins = await countAdmins();
  if (admins > 0) return;

  const existing = await getUser(email);
  if (existing) {
    await updateUser(email, { role: "admin", status: "active" });
    log.info({ email }, "Promoted bootstrap admin because no active admin existed");
    return;
  }

  await createUser({ email, firstName: "Brian", lastName: "Jordan", role: "admin" });
  log.info({ email }, "Seeded bootstrap admin");
}
