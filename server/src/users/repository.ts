import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { config } from "../config.js";
import type { ConsoleUser, Role, Status } from "./types.js";
import { normalizeEmail } from "./types.js";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: config.awsRegion }), {
  marshallOptions: { removeUndefinedValues: true },
});

const TABLE = config.usersTable;

/**
 * Short-lived cache so the per-request authorization check does not become a
 * DynamoDB read on every asset fetch. The TTL is the upper bound on how long a
 * disabled user can keep using an existing session.
 */
const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { user: ConsoleUser | null; expiresAt: number }>();

export function invalidateUserCache(email?: string): void {
  if (email) cache.delete(normalizeEmail(email));
  else cache.clear();
}

export async function getUser(email: string): Promise<ConsoleUser | null> {
  const key = normalizeEmail(email);
  const result = await client.send(new GetCommand({ TableName: TABLE, Key: { email: key } }));
  return (result.Item as ConsoleUser | undefined) ?? null;
}

export async function getUserCached(email: string): Promise<ConsoleUser | null> {
  const key = normalizeEmail(email);
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.user;

  const user = await getUser(key);
  cache.set(key, { user, expiresAt: Date.now() + CACHE_TTL_MS });
  return user;
}

export async function listUsers(): Promise<ConsoleUser[]> {
  // The directory is small by design; a scan is appropriate and cheaper than
  // maintaining an index.
  const result = await client.send(new ScanCommand({ TableName: TABLE }));
  const users = (result.Items ?? []) as ConsoleUser[];
  return users.sort((a, b) => a.email.localeCompare(b.email));
}

export interface CreateUserInput {
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
}

export async function createUser(input: CreateUserInput): Promise<ConsoleUser> {
  const now = new Date().toISOString();
  const user: ConsoleUser = {
    email: normalizeEmail(input.email),
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    role: input.role,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };

  await client.send(
    new PutCommand({
      TableName: TABLE,
      Item: user,
      ConditionExpression: "attribute_not_exists(email)",
    }),
  );
  invalidateUserCache(user.email);
  return user;
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  role?: Role;
  status?: Status;
}

export async function updateUser(email: string, input: UpdateUserInput): Promise<ConsoleUser> {
  const key = normalizeEmail(email);
  const sets: string[] = ["#updatedAt = :updatedAt"];
  const names: Record<string, string> = { "#updatedAt": "updatedAt" };
  const values: Record<string, unknown> = { ":updatedAt": new Date().toISOString() };

  for (const field of ["firstName", "lastName", "role", "status"] as const) {
    const value = input[field];
    if (value === undefined) continue;
    sets.push(`#${field} = :${field}`);
    names[`#${field}`] = field;
    values[`:${field}`] = typeof value === "string" ? value.trim() : value;
  }

  const result = await client.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { email: key },
      UpdateExpression: `SET ${sets.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ConditionExpression: "attribute_exists(email)",
      ReturnValues: "ALL_NEW",
    }),
  );

  invalidateUserCache(key);
  return result.Attributes as ConsoleUser;
}

export async function deleteUser(email: string): Promise<void> {
  const key = normalizeEmail(email);
  await client.send(new DeleteCommand({ TableName: TABLE, Key: { email: key } }));
  invalidateUserCache(key);
}

/** Records the Google subject and sign-in time. Best effort; never blocks login. */
export async function recordLogin(email: string, googleSub: string): Promise<void> {
  const key = normalizeEmail(email);
  await client.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { email: key },
      UpdateExpression: "SET #googleSub = :sub, #lastLoginAt = :now",
      ExpressionAttributeNames: { "#googleSub": "googleSub", "#lastLoginAt": "lastLoginAt" },
      ExpressionAttributeValues: { ":sub": googleSub, ":now": new Date().toISOString() },
      ConditionExpression: "attribute_exists(email)",
    }),
  );
  invalidateUserCache(key);
}

export async function countAdmins(): Promise<number> {
  const users = await listUsers();
  return users.filter((user) => user.role === "admin" && user.status === "active").length;
}
