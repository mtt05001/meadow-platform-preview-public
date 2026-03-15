import { NextResponse } from "next/server";
import { getClientCache } from "@/lib/db";
import { apiError, getErrorMessage } from "@/lib/api-utils";
import { auth } from "@clerk/nextjs/server";

export async function GET() {
  await auth.protect();
  try {
    const cache = await getClientCache();
    if (!cache) {
      return NextResponse.json({ clients: [], last_synced: null, total: 0 });
    }
    return NextResponse.json(cache);
  } catch (e) {
    return apiError(getErrorMessage(e));
  }
}
