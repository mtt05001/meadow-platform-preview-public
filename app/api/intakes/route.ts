import { NextResponse } from "next/server";
import { getIntakes, getLastUpdated } from "@/lib/db";
import { apiError, getErrorMessage } from "@/lib/api-utils";
import { auth } from "@clerk/nextjs/server";

export async function GET(request: Request) {
  await auth.protect();
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? undefined;
    const search = searchParams.get("search") ?? undefined;
    const intakes = await getIntakes(500, 0, status, search);
    const lastUpdated = await getLastUpdated();
    return NextResponse.json({ intakes, last_updated: lastUpdated });
  } catch (e) {
    return apiError(getErrorMessage(e));
  }
}
