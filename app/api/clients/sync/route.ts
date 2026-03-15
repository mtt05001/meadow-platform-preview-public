import { NextResponse } from "next/server";
import { getIntakes, upsertClientCache } from "@/lib/db";
import {
  GHL_FIELDS,
  PIPELINE_ID,
  STAGE_MAP,
  cfVal,
  getAppUrl,
  searchPipelineOpportunities,
  fetchOpportunityDetails,
  parseHiStatus,
  parseOhaStatus,
} from "@/lib/ghl";
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

export async function POST() {
  await auth.protect();
  try {
    // 1. Fetch all pipeline opps
    const allOpps = await searchPipelineOpportunities(PIPELINE_ID);

    // 2. Build intake index by email
    const intakes = await getIntakes(500);
    const intakeByEmail = new Map<string, (typeof intakes)[number]>();
    for (const intake of intakes) {
      if (intake.email) {
        intakeByEmail.set(intake.email.toLowerCase(), intake);
      }
    }

    // 3. Fetch details for each opp and build client records
    const clients: Client[] = [];
    for (const opp of allOpps) {
      try {
        const detail = await fetchOpportunityDetails(opp.id);
        await sleep(150);

        const cfs = (detail.customFields || []) as {
          id?: string;
          fieldValue?: string;
          fieldValueString?: string;
          value?: string;
        }[];

        const contact = opp.contact || {};
        const name =
          contact.name ||
          `${contact.firstName || ""} ${contact.lastName || ""}`.trim() ||
          "Unknown";
        const email = (contact.email || "").toLowerCase();
        let phone = contact.phone || "";
        if (!phone) phone = cfVal(cfs, GHL_FIELDS.PHONE_OPP);

        const stageId = opp.pipelineStageId || "";
        const stageInfo = STAGE_MAP[stageId] || { order: 99, name: "Unknown", group: "done" as const };

        const facilitator = cfVal(cfs, GHL_FIELDS.LEAD_FACILITATOR);
        const facilitatorEmail = cfVal(cfs, GHL_FIELDS.FACILITATOR_EMAIL);

        const hiRaw = cfVal(cfs, GHL_FIELDS.HI_STATUS);
        const ohaRaw = cfVal(cfs, GHL_FIELDS.OHA_STATUS);
        const hiStatus = parseHiStatus(hiRaw);
        const ohaStatus = parseOhaStatus(ohaRaw);
        const chartStatus = ohaStatus || "Pending";

        // Merge intake data
        const intake = intakeByEmail.get(email);
        const intakeId = intake?.id ?? null;
        const platformBase = getAppUrl();

        const client: Client = {
          opp_id: opp.id,
          contact_id: contact.id,
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
          hard_contra: intake?.hard_contraindications || [],
          soft_score: intake?.soft_score || 0,
          soft_details: intake?.soft_details || [],
          edited_risk_strat: intake?.edited_risk_strat || "",
          approved_by: intake?.approved_by || "",
          approved_at: intake?.approved_at || "",
          intake_url: intakeId ? `${platformBase}/intakes/${intakeId}/readonly` : "",
        };
        clients.push(client);
      } catch {
        // Skip individual failures (matches old Python behavior)
        continue;
      }
    }

    // 4. Sort by stage_order then name
    clients.sort((a, b) => a.stage_order - b.stage_order || a.name.localeCompare(b.name));

    // 5. Cache to DB
    await upsertClientCache(clients);

    return NextResponse.json({
      success: true,
      total: clients.length,
      message: `Synced ${clients.length} clients from GHL`,
    });
  } catch (e) {
    return apiError(getErrorMessage(e));
  }
}
