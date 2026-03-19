import { NextResponse } from "next/server";
import { getIntakeById } from "@/lib/db";
import { apiError, getErrorMessage } from "@/lib/api-utils";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const intake = await getIntakeById(id);
    if (!intake) return apiError("Not found", 404);

    // Return only the fields the readonly page needs
    return NextResponse.json({
      id: intake.id,
      name: intake.name,
      status: intake.status,
      client_data: intake.client_data,
      ai_output: intake.ai_output,
      edited_risk_strat: intake.edited_risk_strat,
      approved_by: intake.approved_by,
      approved_at: intake.approved_at,
      jotform_data: intake.jotform_data,
    });
  } catch (e) {
    return apiError(getErrorMessage(e));
  }
}
