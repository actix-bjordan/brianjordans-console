export const ROLES = ["admin", "member"] as const;
export type Role = (typeof ROLES)[number];

export const STATUSES = ["active", "disabled"] as const;
export type Status = (typeof STATUSES)[number];

export interface ConsoleUser {
  /** Lowercased email. Partition key, and the link to the Google identity. */
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  status: Status;
  /** Google subject id, bound on first successful sign-in. */
  googleSub?: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function isStatus(value: unknown): value is Status {
  return typeof value === "string" && (STATUSES as readonly string[]).includes(value);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
