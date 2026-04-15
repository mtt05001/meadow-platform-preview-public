import { NextRequest, NextResponse } from "next/server";
import { getFacilitatorCaps } from "@/lib/db";
import { fetchCapacityOpportunities } from "@/lib/capacity-fetch";
import { buildCapacitySnapshot } from "@/lib/capacity-engine";
import { apiError, getErrorMessage } from "@/lib/api-utils";
import { isGhlConfigured } from "@/lib/ghl";

export const maxDuration = 120;

const TTL_MS = 5 * 60 * 1000;
let cache: { at: number; body: unknown } | null = null;

export async function GET(req: NextRequest) {
  const refresh = req.nextUrl.searchParams.get("refresh") === "1";
  const now = Date.now();
  if (!refresh && cache && now - cache.at < TTL_MS) {
    return NextResponse.json(cache.body);
  }
  try {
    const ghlOk = isGhlConfigured();
    const opps = ghlOk ? await fetchCapacityOpportunities() : [];
    const dbCaps = await getFacilitatorCaps();
    const snapshot = buildCapacitySnapshot(opps, dbCaps, new Date());
    const body = ghlOk
      ? snapshot
      : {
          ...snapshot,
          warnings: [
            "Go High Level is not configured on this deployment (set GHL_ACCESS_TOKEN or GHL_API_KEY in the server environment). Showing facilitator defaults and saved caps only — no live opportunities.",
          ],
        };
    cache = { at: now, body };
    return NextResponse.json(body);
  } catch (e) {
    return apiError(getErrorMessage(e));
  }
}
