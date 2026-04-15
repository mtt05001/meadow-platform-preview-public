import {
  cfVal,
  fetchOpportunityDetails,
  getCapacityFieldIds,
  getCapacityPipelineId,
  searchPipelineOpportunities,
  type SearchOppCustomField,
} from "@/lib/ghl";
import { parseJourneyYmd, type CapacityOppInput } from "@/lib/capacity-engine";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeFacilitator(raw: string): string {
  const t = raw.trim();
  if (!t) return "Unassigned";
  if (/^[0-9a-f-]{36}$/i.test(t)) return `GHL user ${t.slice(0, 8)}…`;
  return t;
}

function contactFirstName(opp: { contact?: { name?: string; firstName?: string; lastName?: string } }): string {
  const c = opp.contact || {};
  if (c.firstName) return String(c.firstName).trim() || "—";
  const name = (c.name as string) || `${c.firstName || ""} ${c.lastName || ""}`.trim();
  return (name.split(/\s+/)[0] || name || "—").trim();
}

/**
 * Load won opportunities in the Core Journey pipeline with journey + facilitator fields.
 * Batches detail fetches to fill custom fields GHL sometimes omits from search.
 */
export async function fetchCapacityOpportunities(): Promise<CapacityOppInput[]> {
  const pipelineId = getCapacityPipelineId();
  const { journey: journeyFieldId, facilitator: facilitatorFieldId } = getCapacityFieldIds();
  const searchList = await searchPipelineOpportunities(pipelineId, { status: "won" });
  const BATCH = 6;
  const out: CapacityOppInput[] = [];

  for (let i = 0; i < searchList.length; i += BATCH) {
    const chunk = searchList.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      chunk.map(async (opp) => {
        const detail = await fetchOpportunityDetails(opp.id);
        const detailCfs = (detail.customFields || []) as SearchOppCustomField[];
        const searchCfs = (opp.customFields || []) as SearchOppCustomField[];
        const jRaw = cfVal(detailCfs, journeyFieldId) || cfVal(searchCfs, journeyFieldId);
        const fRaw = cfVal(detailCfs, facilitatorFieldId) || cfVal(searchCfs, facilitatorFieldId);
        const journeyYmd = parseJourneyYmd(jRaw);
        return {
          oppId: opp.id,
          firstName: contactFirstName(opp),
          facilitator: normalizeFacilitator(fRaw),
          stageId: opp.pipelineStageId,
          journeyYmd,
        } satisfies CapacityOppInput;
      }),
    );

    for (let k = 0; k < results.length; k++) {
      const r = results[k];
      const opp = chunk[k];
      if (r.status === "fulfilled") out.push(r.value);
      else console.warn(`[capacity-fetch] opp ${opp?.id}:`, r.reason);
    }

    if (i + BATCH < searchList.length) await sleep(400);
  }

  return out;
}
