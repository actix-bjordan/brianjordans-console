import type { FastifyInstance } from "fastify";
import { requireAdmin, verifyOrigin } from "../auth/middleware.js";
import {
  countAdmins,
  createUser,
  deleteUser,
  getUser,
  listUsers,
  updateUser,
} from "../users/repository.js";
import { isRole, isStatus, normalizeEmail } from "../users/types.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface CreateBody {
  email?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  role?: unknown;
}

interface UpdateBody {
  firstName?: unknown;
  lastName?: unknown;
  role?: unknown;
  status?: unknown;
}

function requiredString(value: unknown, max = 120): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > max) return null;
  return trimmed;
}

export async function registerUserRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/me", async (request) => {
    const user = request.consoleUser!;
    return {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    };
  });

  app.get("/api/users", { preHandler: requireAdmin }, async () => {
    return { users: await listUsers() };
  });

  app.post(
    "/api/users",
    { preHandler: [verifyOrigin, requireAdmin] },
    async (request, reply) => {
      const body = (request.body ?? {}) as CreateBody;

      const firstName = requiredString(body.firstName);
      const lastName = requiredString(body.lastName);
      const rawEmail = requiredString(body.email, 254);
      const role = body.role ?? "member";

      if (!firstName) return reply.code(400).send({ error: "first_name_required" });
      if (!lastName) return reply.code(400).send({ error: "last_name_required" });
      if (!rawEmail || !EMAIL_PATTERN.test(rawEmail)) {
        return reply.code(400).send({ error: "valid_email_required" });
      }
      if (!isRole(role)) return reply.code(400).send({ error: "invalid_role" });

      const email = normalizeEmail(rawEmail);
      if (await getUser(email)) {
        return reply.code(409).send({ error: "user_exists" });
      }

      const user = await createUser({ email, firstName, lastName, role });
      return reply.code(201).send({ user });
    },
  );

  app.patch(
    "/api/users/:email",
    { preHandler: [verifyOrigin, requireAdmin] },
    async (request, reply) => {
      const { email } = request.params as { email: string };
      const target = normalizeEmail(decodeURIComponent(email));
      const body = (request.body ?? {}) as UpdateBody;
      const actor = request.consoleUser!;

      const existing = await getUser(target);
      if (!existing) return reply.code(404).send({ error: "not_found" });

      const patch: Parameters<typeof updateUser>[1] = {};

      if (body.firstName !== undefined) {
        const value = requiredString(body.firstName);
        if (!value) return reply.code(400).send({ error: "first_name_required" });
        patch.firstName = value;
      }
      if (body.lastName !== undefined) {
        const value = requiredString(body.lastName);
        if (!value) return reply.code(400).send({ error: "last_name_required" });
        patch.lastName = value;
      }
      if (body.role !== undefined) {
        if (!isRole(body.role)) return reply.code(400).send({ error: "invalid_role" });
        patch.role = body.role;
      }
      if (body.status !== undefined) {
        if (!isStatus(body.status)) return reply.code(400).send({ error: "invalid_status" });
        patch.status = body.status;
      }

      // Guard rails: never let an admin lock themselves out, and never let the
      // last active admin be demoted or disabled.
      const losingAdmin =
        (patch.role !== undefined && existing.role === "admin" && patch.role !== "admin") ||
        (patch.status !== undefined && existing.role === "admin" && patch.status !== "active");

      if (losingAdmin) {
        if (target === actor.email) {
          return reply.code(400).send({ error: "cannot_demote_self" });
        }
        if ((await countAdmins()) <= 1) {
          return reply.code(400).send({ error: "last_admin" });
        }
      }

      const user = await updateUser(target, patch);
      return reply.send({ user });
    },
  );

  app.delete(
    "/api/users/:email",
    { preHandler: [verifyOrigin, requireAdmin] },
    async (request, reply) => {
      const { email } = request.params as { email: string };
      const target = normalizeEmail(decodeURIComponent(email));
      const actor = request.consoleUser!;

      if (target === actor.email) {
        return reply.code(400).send({ error: "cannot_remove_self" });
      }

      const existing = await getUser(target);
      if (!existing) return reply.code(404).send({ error: "not_found" });
      if (existing.role === "admin" && (await countAdmins()) <= 1) {
        return reply.code(400).send({ error: "last_admin" });
      }

      await deleteUser(target);
      return reply.code(204).send();
    },
  );
}
