import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/auth";
import { getAllFeedback } from "@/lib/db";
import { apiError, getErrorMessage } from "@/lib/api-utils";

/** GET /api/admin/ai-feedback — list all AI feedback across intakes */
export async function GET() {
  const { sessionClaims } = await auth.protect();
  if (!isAdmin(sessionClaims)) return apiError("Forbidden", 403);

  try {
    const feedback = await getAllFeedback();
    return NextResponse.json(feedback);
  } catch (e) {
    return apiError(getErrorMessage(e));
  }
}
