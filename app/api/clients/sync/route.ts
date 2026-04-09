import { NextResponse } from "next/server";
import { getClientCache, getIntakes, updateIntakeFields, upsertClientCache } from "@/lib/db";
import {
  GHL_FIELDS,
  GhlRateLimitError,
  PIPELINE_ID,
  STAGE_MAP,
  cfVal,
  getAppUrl,
  searchPipelineOpportunities,
  fetchOpportunityDetails,
  parseHiStatus,
  parseOhaStatus,
} from "@/lib/ghl";
import type { SearchOppCustomField } from "@/lib/ghl";
import { apiError, getErrorMessage } from "@/lib/api-utils";
import { auth } from "@clerk/nextjs/server";
import type { Client } from "@/lib/types";

export const maxDuration = 120;

function fmtDate(d: string): string {
  if (!d) return "";
  return d.slice(0, 10);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Build a Client record from search data + detail custom fields (for dates). */
function buildClient(
  opp: { id: string; contact: Record<string, unknown>; pipelineStageId: string },
  cfs: SearchOppCustomField[],
  intakeByEmail: Map<string, { id: string; risk_tier: string; risk_tier_explanation: string; hard_contraindications: unknown[]; soft_score: number; soft_details: string[]; edited_risk_strat: string | null; approved_by: string | null; approved_at: string | null }>,
  platformBase: string,
): Client {
  const contact = opp.contact || {};
  const name =
    (contact.name as string) ||
    `${(contact.firstName as string) || ""} ${(contact.lastName as string) || ""}`.trim() ||
    "Unknown";
  const email = ((contact.email as string) || "").toLowerCase();
  let phone = (contact.phone as string) || "";
  if (!phone) phone = cfVal(cfs, GHL_FIELDS.PHONE_OPP);

  const stageId = opp.pipelineStageId || "";
  const stageInfo = STAGE_MAP[stageId] || { order: 99, name: "Unknown", group: "done" as const };

  const facilitator = cfVal(cfs, GHL_FIELDS.LEAD_FACILITATOR);
  const facilitatorEmail = cfVal(cfs, GHL_FIELDS.FACILITATOR_EMAIL);

  const hiStatus = parseHiStatus(cfVal(cfs, GHL_FIELDS.HI_STATUS));
  const ohaStatus = parseOhaStatus(cfVal(cfs, GHL_FIELDS.OHA_STATUS));
  const chartStatus = ohaStatus || "Pending";

  const intake = intakeByEmail.get(email);
  const intakeId = intake?.id ?? null;

  return {
    opp_id: opp.id,
    contact_id: contact.id as string,
    name,
    email,
    phone,
    stage_id: stageId,
    stage_name: stageInfo.name,
    stage_order: stageInfo.order,
    stage_group: stageInfo.group,
    facilitator,
    facilitator_email: facilitatorEmail,
    prep1: fmtDate(cfVal(cfs, GHL_FIELDS.PREP1_DATE)),
    prep2: fmtDate(cfVal(cfs, GHL_FIELDS.PREP2_DATE)),
    ip_prep: fmtDate(cfVal(cfs, GHL_FIELDS.IP_PREP_DATE)),
    journey: fmtDate(cfVal(cfs, GHL_FIELDS.JOURNEY_DATE)),
    ip_integ: fmtDate(cfVal(cfs, GHL_FIELDS.IP_INTEG_DATE)),
    integ1: fmtDate(cfVal(cfs, GHL_FIELDS.INTEG1_DATE)),
    integ2: fmtDate(cfVal(cfs, GHL_FIELDS.INTEG2_DATE)),
    hi_status: hiStatus,
    oha_status: ohaStatus,
    chart_status: chartStatus,
    intake_id: intakeId,
    risk_tier: (intake?.risk_tier as Client["risk_tier"]) || "",
    risk_explanation: intake?.risk_tier_explanation || "",
    hard_contra: (intake?.hard_contraindications || []) as Client["hard_contra"],
    soft_score: intake?.soft_score || 0,
    soft_details: intake?.soft_details || [],
    edited_risk_strat: intake?.edited_risk_strat || "",
    approved_by: intake?.approved_by || "",
    approved_at: intake?.approved_at || "",
    intake_url: intakeId ? `${platformBase}/intakes/${intakeId}/readonly` : "",
    won_date: fmtDate(cfVal(cfs, GHL_FIELDS.WON_DATE_OPP)),
    program: cfVal(cfs, GHL_FIELDS.PROGRAM),
  };
}

const CACHE_TTL_MS = 60_000; // 1 minute

export async function POST() {
  await auth.protect();
  try {
    // 0. Skip if cache is fresh (prevents duplicate syncs across browsers)
    const prevCache = await getClientCache();
    if (prevCache?.last_synced) {
      const age = Date.now() - new Date(prevCache.last_synced).getTime();
      if (age < CACHE_TTL_MS) {
        console.log(`[clients-sync] Cache fresh (${Math.round(age / 1000)}s old), skipping`);
        return NextResponse.json({
          success: true,
          total: prevCache.total,
          refreshed: 0,
          cached: prevCache.total,
          failed: 0,
          intake_matches: prevCache.clients.filter((c) => c.intake_id).length,
          errors: [],
          message: `Cache is fresh (${Math.round(age / 1000)}s old), skipped sync`,
        });
      }
    }

    // 1. Fetch all pipeline opps (search is cheap — returns everything except date fields)
    const allOpps = await searchPipelineOpportunities(PIPELINE_ID);
    console.log(`[clients-sync] Fetched ${allOpps.length} pipeline opportunities`);

    // 2. Use previous cache for incremental sync
    //    If any cached row is missing won_date (added 2026-04-07), force a full
    //    refetch by ignoring the cache — one-time backfill cost.
    // Note: `program` does NOT need a backfill — it's returned by
    // /opportunities/search (text field), so the unchanged branch's
    // buildClient() call picks it up from searchCfs on the next sync.
    const cacheNeedsBackfill = prevCache?.clients.some((c) => c.won_date === undefined) ?? false;
    if (cacheNeedsBackfill) {
      console.log("[clients-sync] Cache missing won_date — forcing full refetch");
    }
    const prevByOppId = new Map<string, Client>();
    if (prevCache && !cacheNeedsBackfill) {
      for (const c of prevCache.clients) prevByOppId.set(c.opp_id, c);
    }
    const lastSynced = cacheNeedsBackfill ? null : (prevCache?.last_synced ?? null);

    // 3. Build intake index by email
    const intakes = await getIntakes(500);
    const intakeByEmail = new Map<string, (typeof intakes)[number]>();
    for (const intake of intakes) {
      if (intake.email) {
        intakeByEmail.set(intake.email.toLowerCase(), intake);
      }
    }
    console.log(`[clients-sync] Loaded ${intakes.length} intakes, ${intakeByEmail.size} with email`);

    // 4. Split opps into changed vs unchanged
    //    Search returns fieldValueString for text fields but NOT date fields.
    //    We only need detail calls for date fields, so skip unchanged opps.
    const needsDetail: typeof allOpps = [];
    const unchanged: typeof allOpps = [];

    for (const opp of allOpps) {
      const cached = prevByOppId.get(opp.id);
      if (cached && lastSynced && opp.updatedAt && opp.updatedAt <= lastSynced) {
        unchanged.push(opp);
      } else {
        needsDetail.push(opp);
      }
    }

    console.log(
      `[clients-sync] ${needsDetail.length} changed (need detail), ${unchanged.length} unchanged (use cache)`,
    );

    const platformBase = getAppUrl();

    // 5. Build client records for unchanged opps using search data + cached dates
    const clients: Client[] = [];
    for (const opp of unchanged) {
      const cached = prevByOppId.get(opp.id)!;
      // Use fresh text fields from search, but keep cached date values
      const searchCfs = (opp.customFields || []) as SearchOppCustomField[];
      const client = buildClient(
        { id: opp.id, contact: opp.contact as Record<string, unknown>, pipelineStageId: opp.pipelineStageId },
        searchCfs,
        intakeByEmail,
        platformBase,
      );
      // Restore dates from cache (search doesn't return them)
      client.prep1 = cached.prep1;
      client.prep2 = cached.prep2;
      client.ip_prep = cached.ip_prep;
      client.journey = cached.journey;
      client.ip_integ = cached.ip_integ;
      client.integ1 = cached.integ1;
      client.integ2 = cached.integ2;
      client.won_date = cached.won_date;
      clients.push(client);
    }

    // 6. Fetch details only for changed opps (need date field values)
    const BATCH_SIZE = 5;
    const BATCH_DELAY_MS = 1000;
    let failed = 0;
    let rateLimited = false;
    const errors: string[] = [];
    const totalBatches = Math.ceil(needsDetail.length / BATCH_SIZE);

    for (let i = 0; i < needsDetail.length; i += BATCH_SIZE) {
      const batch = needsDetail.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      let batchOk = 0;
      let batchFail = 0;

      const results = await Promise.allSettled(
        batch.map(async (opp) => {
          const detail = await fetchOpportunityDetails(opp.id);
          const cfs = (detail.customFields || []) as SearchOppCustomField[];
          return buildClient(
            { id: opp.id, contact: opp.contact as Record<string, unknown>, pipelineStageId: opp.pipelineStageId },
            cfs,
            intakeByEmail,
            platformBase,
          );
        }),
      );

      for (const r of results) {
        if (r.status === "fulfilled") {
          clients.push(r.value);
          batchOk++;
        } else {
          batchFail++;
          failed++;
          if (r.reason instanceof GhlRateLimitError) rateLimited = true;
          const oppId = batch[results.indexOf(r)]?.id ?? "unknown";
          errors.push(`opp ${oppId}: ${String(r.reason).slice(0, 120)}`);
        }
      }

      console.log(
        `[clients-sync] Batch ${batchNum}/${totalBatches}: ${batchOk} ok, ${batchFail} failed`,
      );
      if (batchFail > 0) {
        for (const e of errors.slice(-batchFail)) console.log(`[clients-sync]   FAIL: ${e}`);
      }

      if (rateLimited) {
        console.log(`[clients-sync] Aborting: GHL rate limit hit after retries`);
        break;
      }

      if (i + BATCH_SIZE < needsDetail.length) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    if (rateLimited) {
      return NextResponse.json(
        {
          success: false,
          total: clients.length,
          failed,
          errors: errors.slice(0, 10),
          message: `GHL rate limit hit — synced ${clients.length}/${allOpps.length} clients. Cache not updated. Try again shortly.`,
        },
        { status: 429 },
      );
    }

    // 7. Sort and cache
    clients.sort((a, b) => a.stage_order - b.stage_order || a.name.localeCompare(b.name));
    await upsertClientCache(clients);

    // 8. Update intake records with GHL data (replaces sync-ghl)
    let intakesUpdated = 0;
    let intakesSkipped = 0;
    for (const client of clients) {
      if (!client.intake_id) continue;
      const intake = intakeByEmail.get(client.email);
      if (!intake) continue;

      const fields: Record<string, string | null> = {};
      if (client.prep1 && client.prep1 !== intake.prep1_date) fields.prep1_date = client.prep1;
      if (client.facilitator && client.facilitator !== intake.facilitator) fields.facilitator = client.facilitator;
      if (client.hi_status && client.hi_status !== intake.ghl_hi_status) fields.ghl_hi_status = client.hi_status;

      if (Object.keys(fields).length) {
        await updateIntakeFields(intake.id, fields);
        intakesUpdated++;
        console.log(`[clients-sync] Intake ${intake.id} (${client.email}): updated ${Object.keys(fields).join(", ")}`);
      } else {
        intakesSkipped++;
      }
    }

    const intakeMatches = clients.filter((c) => c.intake_id).length;
    console.log(
      `[clients-sync] Done: ${clients.length} clients (${needsDetail.length} refreshed, ${unchanged.length} cached), ` +
        `${failed} failed, ${intakeMatches} matched to intakes, ` +
        `${intakesUpdated} intake records updated, ${intakesSkipped} unchanged`,
    );

    return NextResponse.json({
      success: true,
      total: clients.length,
      refreshed: needsDetail.length,
      cached: unchanged.length,
      failed,
      intake_matches: intakeMatches,
      errors: errors.slice(0, 10),
      message: `Synced ${clients.length} clients (${needsDetail.length} refreshed, ${unchanged.length} from cache)`,
    });
  } catch (e) {
    return apiError(getErrorMessage(e));
  }
}
