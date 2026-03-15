import { NextResponse } from "next/server";
import { getIntakes, updateIntakeFields } from "@/lib/db";
import { searchContact, getOpportunityWithFacilitator, GHL_FIELDS, cfVal } from "@/lib/ghl";
import { apiError, getErrorMessage } from "@/lib/api-utils";

function fmtDate(d: string | null): string | null {
  if (!d) return null;
  return d.slice(0, 10); // already ISO
}

export async function POST() {
  try {
    const intakes = await getIntakes(500);
    const toSync = intakes.filter(
      (i) => i.email && (i.status as string) !== "deleted",
    );

    let updated = 0;
    const errors: string[] = [];

    for (const intake of toSync) {
      try {
        const { contact } = await searchContact(intake.email);
        if (!contact) continue;

        const { opportunity } = await getOpportunityWithFacilitator(contact.id);
        if (!opportunity) continue;

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
          updated++;
        }
      } catch (e) {
        errors.push(`${intake.name}: ${getErrorMessage(e).slice(0, 80)}`);
      }
    }

    return NextResponse.json({
      success: true,
      updated,
      total: toSync.length,
      errors: errors.slice(0, 10),
      message: `Updated ${updated}/${toSync.length} intakes with GHL data`,
    });
  } catch (e) {
    return apiError(getErrorMessage(e));
  }
}
