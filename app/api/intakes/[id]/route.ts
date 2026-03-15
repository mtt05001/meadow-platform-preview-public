import { NextResponse } from "next/server";
import { getIntakeById } from "@/lib/db";
import { apiError, getErrorMessage } from "@/lib/api-utils";
import { auth } from "@clerk/nextjs/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await auth.protect();
  try {
    const { id } = await params;
    const intake = await getIntakeById(id);
    if (!intake) {
      return apiError("Not found", 404);
    }
    return NextResponse.json(intake);
  } catch (e) {
    return apiError(getErrorMessage(e));
  }
}
