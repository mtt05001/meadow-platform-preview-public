import { NextResponse } from "next/server";
import { updateIntakeFields, getIntakeById } from "@/lib/db";
import { apiError, getErrorMessage } from "@/lib/api-utils";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const email = body.email || "";

    // Save email edits into ai_output.email in Supabase
    const intake = await getIntakeById(id);
    if (!intake) {
      return apiError("Intake not found", 404);
    }

    const aiOutput = typeof intake.ai_output === "object" && intake.ai_output
      ? { ...intake.ai_output }
      : {};
    (aiOutput as Record<string, unknown>).email = email;

    await updateIntakeFields(id, {
      ai_output: JSON.stringify(aiOutput),
    });

    return NextResponse.json({ success: true, persisted: true });
  } catch (e) {
    return apiError(getErrorMessage(e));
  }
}
