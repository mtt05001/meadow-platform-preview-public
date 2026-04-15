import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { upsertFacilitatorCap } from "@/lib/db";
import { apiError, getErrorMessage } from "@/lib/api-utils";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  await auth.protect();
  try {
    const { name: rawName } = await params;
    const facilitatorName = decodeURIComponent(rawName).replace(/\+/g, " ");
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("Invalid JSON body", 400);
    }
    const weekCap = typeof body === "object" && body && "weekCap" in body
      ? Number((body as { weekCap: unknown }).weekCap)
      : NaN;
    if (!Number.isInteger(weekCap) || weekCap < 1 || weekCap > 10) {
      return apiError("weekCap must be an integer from 1 to 10", 400);
    }
    const row = await upsertFacilitatorCap(facilitatorName, weekCap);
    return NextResponse.json(row);
  } catch (e) {
    return apiError(getErrorMessage(e));
  }
}
