import { NextResponse } from "next/server";
import { updateIntakeFields } from "@/lib/db";
import { apiError, getErrorMessage } from "@/lib/api-utils";
import { auth } from "@clerk/nextjs/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await auth.protect();
  try {
    const { id } = await params;
    const body = await request.json();
    await updateIntakeFields(id, {
      status: "approved",
      approved_by: body.approved_by || "Dr. Tracy Townsend",
      approved_at: body.approved_at || new Date().toISOString(),
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    return apiError(getErrorMessage(e));
  }
}
