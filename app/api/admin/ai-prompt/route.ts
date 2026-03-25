import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/auth";
import { TRACY_PROMPT, STATIC_EMAIL_FOOTER } from "@/lib/ai";
import { apiError } from "@/lib/api-utils";

/** GET /api/admin/ai-prompt — return current AI prompt (read-only) */
export async function GET() {
  const { sessionClaims } = await auth.protect();
  if (!isAdmin(sessionClaims)) return apiError("Forbidden", 403);

  return NextResponse.json({
    prompt: TRACY_PROMPT,
    static_email_footer: STATIC_EMAIL_FOOTER,
  });
}
