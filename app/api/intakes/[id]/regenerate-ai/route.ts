import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getIntakeById, updateIntakeFields } from "@/lib/db";
import { generateAiOutput } from "@/lib/ai";
import { apiError, getErrorMessage } from "@/lib/api-utils";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await auth.protect();
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const guidance = typeof body.guidance === "string" ? body.guidance : undefined;

    const intake = await getIntakeById(id);
    if (!intake) return apiError("Intake not found", 404);

    const clientData = intake.client_data;
    if (!clientData || Object.keys(clientData).length === 0) {
      return apiError("No client data available to generate AI output", 400);
    }

    const { result, error } = await generateAiOutput(clientData, guidance);
    if (error || !result) {
      return apiError(error || "AI generation failed", 500);
    }

    await updateIntakeFields(id, {
      ai_output: JSON.stringify(result),
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    return apiError(getErrorMessage(e));
  }
}
