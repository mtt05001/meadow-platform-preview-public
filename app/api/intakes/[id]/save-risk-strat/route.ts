import { NextResponse } from "next/server";
import { updateIntakeFields } from "@/lib/db";
import { apiError, getErrorMessage } from "@/lib/api-utils";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    await updateIntakeFields(id, {
      edited_risk_strat: body.risk_stratification || "",
    });
    return NextResponse.json({ success: true, persisted: true });
  } catch (e) {
    return apiError(getErrorMessage(e));
  }
}
