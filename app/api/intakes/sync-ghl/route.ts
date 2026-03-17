import { NextResponse } from "next/server";
import { getIntakes, updateIntakeFields } from "@/lib/db";
import { searchContact, getOpportunityWithFacilitator, GHL_FIELDS, cfVal } from "@/lib/ghl";
import { apiError, getErrorMessage } from "@/lib/api-utils";
import { auth } from "@clerk/nextjs/server";

function fmtDate(d: string | null): string | null {
  if (!d) return null;
  return d.slice(0, 10); // already ISO
}

export async function POST() {
  await auth.protect();
  try {
    const intakes = await getIntakes(500);
    const toSync = intakes.filter(
      (i) => i.email && (i.status as string) !== "deleted",
    );

    const BATCH_SIZE = 10;
    const errors: string[] = [];
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

          const cfs = (opportunity.customFields || []) as {
            id?: string;
            fieldValue?: string;
            fieldValueString?: string;
            value?: string;
          }[];

          const prep1 = fmtDate(cfVal(cfs, GHL_FIELDS.PREP1_DATE));
          const facilitator = cfVal(cfs, GHL_FIELDS.LEAD_FACILITATOR) || null;

          const fields: Record<string, string | null> = {};
          if (prep1) fields.prep1_date = prep1;
          if (facilitator) fields.facilitator = facilitator;

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
          errors.push(String(r.reason).slice(0, 80));
        }
      }

      console.log(
        `[sync-ghl] Batch ${batchNum}/${totalBatches}: ` +
          `${bc.updated} updated, ${bc.no_contact} no contact, ` +
          `${bc.no_opportunity} no opp, ${bc.no_fields} no fields, ` +
          `${bc.failed} failed`,
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
