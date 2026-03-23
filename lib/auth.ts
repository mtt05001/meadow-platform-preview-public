import { auth } from "@clerk/nextjs/server";

export type UserRole = "admin" | "facilitator" | "client";

export const VALID_ROLES: UserRole[] = ["admin", "facilitator", "client"];

/**
 * Get the current user's role from Clerk session claims.
 * Defaults to "client" (no access) if no role is set.
 *
 * Requires Clerk Dashboard → Sessions → Customize session token:
 *   { "metadata": "{{user.public_metadata}}" }
 */
export async function getUserRole(): Promise<UserRole> {
  const { sessionClaims } = await auth();
  return getRoleFromClaims(sessionClaims);
}

export function getRoleFromClaims(
  sessionClaims: { metadata?: { role?: string } } | null,
): UserRole {
  const role = sessionClaims?.metadata?.role;
  if (role === "admin") return "admin";
  if (role === "facilitator") return "facilitator";
  return "client";
}

export function isAdmin(
  sessionClaims: { metadata?: { role?: string } } | null,
): boolean {
  return sessionClaims?.metadata?.role === "admin";
}
