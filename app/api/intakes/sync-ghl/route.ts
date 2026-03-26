import { NextResponse } from "next/server";
import { getClientCache, getIntakes, updateIntakeFields } from "@/lib/db";
import { searchContact, getOpportunityWithFacilitator, fetchOpportunityDetails, GHL_FIELDS, GhlRateLimitError, cfVal, parseHiStatus } from "@/lib/ghl";
import { apiError, getErrorMessage } from "@/lib/api-utils";
import { auth } from "@clerk/nextjs/server";

const CACHE_TTL_MS = 60_000; // 1 minute

function fmtDate(d: string | null): string | null {
  if (!d) return null;
  // GHL calendar fields return epoch milliseconds
  const n = Number(d);
  if (!isNaN(n) && n > 1e12) {
    return new Date(n).toISOString().slice(0, 10);
  }
  // Already ISO-ish
  return d.slice(0, 10);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST() {
  await auth.protect();
  try {
    // Skip if GHL was synced recently (prevents duplicate syncs across browsers)
    const cache = await getClientCache();
    if (cache?.last_synced) {
      const age = Date.now() - new Date(cache.last_synced).getTime();
      if (age < CACHE_TTL_MS) {
        return NextResponse.json({
          success: true,
          updated: 0,
          total: 0,
          breakdown: { updated: 0, no_contact: 0, no_opportunity: 0, no_fields: 0, failed: 0 },
          errors: [],
          message: `GHL synced recently (${Math.round(age / 1000)}s ago), skipped`,
        });
      }
    }

    const intakes = await getIntakes(500);
    const toSync = intakes.filter(
      (i) => i.email && (i.status as string) !== "deleted",
    );

    const BATCH_SIZE = 3;
    const BATCH_DELAY_MS = 1500;
    const errors: string[] = [];
    let rateLimited = false;
    const totals = { updated: 0, no_contact: 0, no_opportunity: 0, no_fields: 0, failed: 0 };
    const totalBatches = Math.ceil(toSync.length / BATCH_SIZE);

    for (let i = 0; i < toSync.length; i += BATCH_SIZE) {
      const batch = toSync.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;

      const results = await Promise.allSettled(
        batch.map(async (intake): Promise<"updated" | "no_contact" | "no_opportunity" | "no_fields"> => {
          const { contact } = await searchContact(intake.email);
          if (!contact) return "no_contact";

          const { opportunity } = await getOpportunityWithFacilitator(contact.id);
          if (!opportunity) return "no_opportunity";

          // Fetch full opportunity details — search endpoint omits some field values
          const oppId = opportunity.id as string;
          const fullOpp = await fetchOpportunityDetails(oppId);
          const cfs = ((fullOpp.customFields || []) as {
            id?: string;
            fieldValue?: string;
            fieldValueString?: string;
            value?: string;
          }[]);

          const prep1 = fmtDate(cfVal(cfs, GHL_FIELDS.PREP1_DATE));
          const facilitator = cfVal(cfs, GHL_FIELDS.LEAD_FACILITATOR) || null;
          const hiStatus = parseHiStatus(cfVal(cfs, GHL_FIELDS.HI_STATUS));

          const fields: Record<string, string | null> = {};
          if (prep1) fields.prep1_date = prep1;
          if (facilitator) fields.facilitator = facilitator;
          if (hiStatus) fields.ghl_hi_status = hiStatus;

          if (Object.keys(fields).length) {
            await updateIntakeFields(intake.id, fields);
            return "updated";
          }
          return "no_fields";
        }),
      );

      const bc = { updated: 0, no_contact: 0, no_opportunity: 0, no_fields: 0, failed: 0 };
      for (const r of results) {
        if (r.status === "fulfilled") {
          bc[r.value]++;
          totals[r.value]++;
        } else {
          bc.failed++;
          totals.failed++;
          if (r.reason instanceof GhlRateLimitError) rateLimited = true;
          errors.push(String(r.reason).slice(0, 80));
        }
      }

      console.log(
        `[sync-ghl] Batch ${batchNum}/${totalBatches}: ` +
          `${bc.updated} updated, ${bc.no_contact} no contact, ` +
          `${bc.no_opportunity} no opp, ${bc.no_fields} no fields, ` +
          `${bc.failed} failed`,
      );

      if (rateLimited) {
        console.log(`[sync-ghl] Aborting: GHL rate limit hit after retries`);
        break;
      }

      // Delay between batches to stay under burst limit
      if (i + BATCH_SIZE < toSync.length) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    if (rateLimited) {
      return NextResponse.json(
        {
          success: false,
          updated: totals.updated,
          total: toSync.length,
          breakdown: totals,
          errors: errors.slice(0, 10),
          message: `GHL rate limit hit — only ${totals.updated}/${toSync.length} synced. Try again shortly.`,
        },
        { status: 429 },
      );
    }

    console.log(
      `[sync-ghl] Done: ${totals.updated}/${toSync.length} updated | ` +
        `${totals.no_contact} no contact, ${totals.no_opportunity} no opp, ` +
        `${totals.no_fields} no fields, ${totals.failed} failed`,
    );

    return NextResponse.json({
      success: true,
      updated: totals.updated,
      total: toSync.length,
      breakdown: totals,
      errors: errors.slice(0, 10),
      message: `Updated ${totals.updated}/${toSync.length} intakes with GHL data`,
    });
  } catch (e) {
    return apiError(getErrorMessage(e));
  }
}
