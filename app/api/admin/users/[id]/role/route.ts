import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { isAdmin, VALID_ROLES, type UserRole } from "@/lib/auth";
import { apiError, getErrorMessage } from "@/lib/api-utils";

/** PATCH /api/admin/users/[id]/role — update a user's role */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { sessionClaims } = await auth.protect();
  if (!isAdmin(sessionClaims)) return apiError("Forbidden", 403);

  try {
    const { id } = await params;
    const body = await request.json();
    const { role } = body as { role?: string };

    if (!role || !VALID_ROLES.includes(role as UserRole)) {
      return apiError(`Invalid role. Must be one of: ${VALID_ROLES.join(", ")}`, 400);
    }

    const clerk = await clerkClient();

    // Get current metadata so we don't overwrite other fields
    const user = await clerk.users.getUser(id);
    const updatedMetadata = { ...user.publicMetadata, role };

    await clerk.users.updateUser(id, {
      publicMetadata: updatedMetadata,
    });

    return NextResponse.json({ id, role });
  } catch (e) {
    return apiError(getErrorMessage(e));
  }
}
