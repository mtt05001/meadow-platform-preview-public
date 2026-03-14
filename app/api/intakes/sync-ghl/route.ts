import { NextResponse } from "next/server";
import { getIntakes, updateIntakeFields } from "@/lib/db";
import { searchContact, getOpportunityWithFacilitator } from "@/lib/ghl";
import { apiError, getErrorMessage } from "@/lib/api-utils";

const FIELD_PREP1 = "47Nj5tCxZy6Zhze9m9c8";
const FIELD_FACILITATOR = "H4LM6jbUwR1woLSj2kzV";

function cfVal(
  customFields: { id?: string; fieldValue?: string; fieldValueString?: string; value?: string }[],
  fieldId: string,
): string {
  for (const cf of customFields) {
    if (cf.id === fieldId) {
      const v = cf.fieldValue || cf.fieldValueString || cf.value || "";
      return String(v).trim();
    }
  }
  return "";
}

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

        const prep1 = fmtDate(cfVal(cfs, FIELD_PREP1));
        const facilitator = cfVal(cfs, FIELD_FACILITATOR) || null;

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
