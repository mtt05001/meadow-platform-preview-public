import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { isAdmin, VALID_ROLES, type UserRole } from "@/lib/auth";
import { apiError, getErrorMessage } from "@/lib/api-utils";

/** GET /api/admin/users — list all users with their roles */
export async function GET() {
  const { sessionClaims } = await auth.protect();
  if (!isAdmin(sessionClaims)) return apiError("Forbidden", 403);

  try {
    const clerk = await clerkClient();
    const { data: users } = await clerk.users.getUserList({ limit: 200 });

    const result = users.map((u) => ({
      id: u.id,
      email: u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)
        ?.emailAddress ?? "",
      firstName: u.firstName,
      lastName: u.lastName,
      role: (u.publicMetadata?.role as UserRole) || "client",
      imageUrl: u.imageUrl,
      lastSignInAt: u.lastSignInAt,
      createdAt: u.createdAt,
    }));

    return NextResponse.json(result);
  } catch (e) {
    return apiError(getErrorMessage(e));
  }
}

/** POST /api/admin/users — send an invite */
export async function POST(request: Request) {
  const { sessionClaims } = await auth.protect();
  if (!isAdmin(sessionClaims)) return apiError("Forbidden", 403);

  try {
    const body = await request.json();
    const { email, role } = body as { email?: string; role?: string };

    if (!email || typeof email !== "string") {
      return apiError("Email is required", 400);
    }

    const assignedRole: UserRole =
      role && VALID_ROLES.includes(role as UserRole)
        ? (role as UserRole)
        : "client";

    const clerk = await clerkClient();
    const invitation = await clerk.invitations.createInvitation({
      emailAddress: email,
      publicMetadata: { role: assignedRole },
    });

    return NextResponse.json({
      id: invitation.id,
      email: invitation.emailAddress,
      role: assignedRole,
      status: invitation.status,
    });
  } catch (e) {
    return apiError(getErrorMessage(e));
  }
}
