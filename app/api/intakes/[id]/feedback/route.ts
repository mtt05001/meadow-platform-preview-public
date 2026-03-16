import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { insertFeedback } from "@/lib/db";
import { apiError, getErrorMessage } from "@/lib/api-utils";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await auth.protect();
  try {
    const { id } = await params;
    const body = await request.json();
    const { feedback_type, feedback_text } = body as {
      feedback_type?: string;
      feedback_text?: string;
    };

    if (!feedback_type || !feedback_text?.trim()) {
      return apiError("feedback_type and feedback_text are required", 400);
    }

    const user = await currentUser();
    const reviewer =
      body.reviewer ||
      [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
      "Unknown";

    await insertFeedback(id, feedback_type, feedback_text.trim(), reviewer);

    return NextResponse.json({ success: true });
  } catch (e) {
    return apiError(getErrorMessage(e));
  }
}
