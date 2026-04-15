import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getFacilitatorCaps } from "@/lib/db";
import { fetchCapacityOpportunities } from "@/lib/capacity-fetch";
import { buildCapacitySnapshot } from "@/lib/capacity-engine";
import { apiError, getErrorMessage } from "@/lib/api-utils";

export const maxDuration = 120;

const TTL_MS = 5 * 60 * 1000;
let cache: { at: number; body: unknown } | null = null;

export async function GET(req: NextRequest) {
  await auth.protect();
  const refresh = req.nextUrl.searchParams.get("refresh") === "1";
  const now = Date.now();
  if (!refresh && cache && now - cache.at < TTL_MS) {
    return NextResponse.json(cache.body);
  }
  try {
    const opps = await fetchCapacityOpportunities();
    const dbCaps = await getFacilitatorCaps();
    const snapshot = buildCapacitySnapshot(opps, dbCaps, new Date());
    cache = { at: now, body: snapshot };
    return NextResponse.json(snapshot);
  } catch (e) {
    return apiError(getErrorMessage(e));
  }
}
