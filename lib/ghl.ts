const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";
const LOCATION_ID = process.env.GHL_LOCATION_ID || "A4AjOJ6RQgzEHxtmZsOr";

export function getAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (!url) throw new Error("NEXT_PUBLIC_APP_URL or VERCEL_PROJECT_PRODUCTION_URL must be set");
  return url.startsWith("http") ? url : `https://${url}`;
}

// GHL custom field IDs (opportunity-level)
export const GHL_FIELDS = {
  PREP1_DATE: "47Nj5tCxZy6Zhze9m9c8",
  PREP2_DATE: "RHZA1YmoHFAJlAbYrLvw",
  IP_PREP_DATE: "BfOJM06jZJEVzM8IZWvF",
  JOURNEY_DATE: "1amX2K1pwdx2r39wwd9d",
  IP_INTEG_DATE: "MqIrwgUFNNja5XI3zVmk",
  INTEG1_DATE: "DkOFs5E0bvSEw9NkAYyv",
  INTEG2_DATE: "vCu9ljd1boLc1iTYqEoD",
  HI_STATUS: "JD7nHdPbcHWnEh2OEhhI",
  OHA_STATUS: "onZ8dloJ0Ho6JQpCt8PI",
  LEAD_FACILITATOR: "H4LM6jbUwR1woLSj2kzV",
  FACILITATOR_EMAIL: "l9dFoho2FPShAznPUrM9",
  HI_URL: "pypItuyHO6POQ2NpoTcZ",
  PHONE_OPP: "fWDDWkgGC79IssdGjIei",
} as const;

export const PIPELINE_ID = "b1raXFqNeALdRrsQwPD5";

export const STAGE_MAP: Record<string, { order: number; name: string; group: "onboarding" | "prep" | "journey" | "integration" | "done" }> = {
  "59b0882d-8ba7-414e-8b30-ba8eb8b81758": { order: 1, name: "Onboarding", group: "onboarding" },
  "f9d83167-1471-4291-a333-2dd12d3a670f": { order: 2, name: "Ready for Prep 1", group: "prep" },
  "7c56c2e0-bff4-4419-aa62-e7c72428d7d4": { order: 3, name: "Not Ready for Prep 2", group: "prep" },
  "a5a89180-55de-4220-94bc-478fa29d6a5d": { order: 4, name: "Ready for Prep 2", group: "prep" },
  "7878a11b-7d13-4ccc-913c-2262611714ab": { order: 5, name: "Not Ready for Journey", group: "journey" },
  "44edcee2-3bb7-45f2-a21a-c440a09721cb": { order: 6, name: "Ready for Journey", group: "journey" },
  "009dcf45-59bd-4c34-8c29-c8ab0ddba95c": { order: 7, name: "Not Ready for Integ 1", group: "integration" },
  "81d12d23-826f-42f2-808d-64200c162c93": { order: 8, name: "Ready for Integ 1", group: "integration" },
  "d32a2495-436c-4ffd-8d13-6df809c3bd53": { order: 9, name: "Not Ready for Integ 2", group: "integration" },
  "e6759ec7-9904-46d3-8e79-244fcdd43636": { order: 10, name: "Ready for Integ 2", group: "integration" },
  "6d864314-a081-45a7-a523-0ba96a3d4094": { order: 11, name: "Feedback Invite", group: "done" },
  "0fb7dbb8-ff89-4d20-9e34-68edd167b37c": { order: 12, name: "Ready for Debrief", group: "done" },
  "4467861d-8e0a-487b-baef-960c8e464d33": { order: 13, name: "Group Call Email", group: "done" },
  "1fb21912-70df-4887-ae6c-a3b8996a5cc4": { order: 14, name: "Journey Done", group: "done" },
  "4bf4ea07-0c39-46ca-a71c-85812aa53c48": { order: 15, name: "Refunded", group: "done" },
  "3428066c-efac-4bd1-b3e0-4b1d19c1ac74": { order: 16, name: "Coaching", group: "done" },
};

/** Extract custom field value by ID, handling fieldValue/fieldValueString/value keys. */
export function cfVal(
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

function getToken(): string {
  const token = process.env.GHL_ACCESS_TOKEN;
  if (!token) throw new Error("GHL_ACCESS_TOKEN not set");
  return token;
}

async function ghlFetch(
  path: string,
  options: RequestInit = {},
): Promise<unknown> {
  const token = getToken();
  const res = await fetch(`${GHL_BASE}${path}`, {
    ...options,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Version: GHL_VERSION,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GHL API ${res.status}: ${body}`);
  }
  return res.json();
}

export interface GHLContact {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  [key: string]: unknown;
}

export async function searchContact(
  email: string,
): Promise<{ contact: GHLContact | null; error: string | null }> {
  try {
    const data = (await ghlFetch("/contacts/search", {
      method: "POST",
      body: JSON.stringify({ locationId: LOCATION_ID, query: email, pageLimit: 1 }),
    })) as { contacts?: GHLContact[] };
    const contacts = data.contacts || [];
    return contacts.length
      ? { contact: contacts[0], error: null }
      : { contact: null, error: "Contact not found" };
  } catch (e) {
    return { contact: null, error: String(e) };
  }
}

export async function getOpportunityWithFacilitator(
  contactId: string,
): Promise<{
  opportunity: Record<string, unknown> | null;
  facilitatorEmail: string | null;
  error: string | null;
}> {
  try {
    const params = new URLSearchParams({
      location_id: LOCATION_ID,
      contact_id: contactId,
      limit: "5",
    });
    const data = (await ghlFetch(`/opportunities/search?${params}`)) as {
      opportunities?: Record<string, unknown>[];
    };

    const opps = data.opportunities || [];
    // Prefer journey pipeline, fall back to first
    const opp = opps.find((o) => o.pipelineId === PIPELINE_ID) || opps[0];
    if (!opp)
      return { opportunity: null, facilitatorEmail: null, error: "No opportunity found" };
    let facilitatorEmail: string | null = null;
    const customFields = (opp.customFields as { name?: string; value?: string }[]) || [];
    for (const field of customFields) {
      const name = (field.name || "").toLowerCase();
      if (name.includes("facilitator") && name.includes("email")) {
        facilitatorEmail = field.value || null;
        break;
      }
    }

    return { opportunity: opp, facilitatorEmail, error: null };
  } catch (e) {
    return { opportunity: null, facilitatorEmail: null, error: String(e) };
  }
}

export async function addNote(
  contactId: string,
  body: string,
): Promise<{ ok: boolean; error: string | null }> {
  try {
    await ghlFetch(`/contacts/${contactId}/notes`, {
      method: "POST",
      body: JSON.stringify({ body }),
    });
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function updateOpportunity(
  oppId: string,
  fields: { hiStatus?: string; hiUrl?: string },
): Promise<{ ok: boolean; error: string | null }> {
  try {
    const customFields: { id: string; value?: string; field_value?: string }[] = [];
    if (fields.hiStatus) {
      customFields.push({ id: GHL_FIELDS.HI_STATUS, value: fields.hiStatus });
    }
    if (fields.hiUrl) {
      customFields.push({ id: GHL_FIELDS.HI_URL, field_value: fields.hiUrl });
    }

    if (!customFields.length) return { ok: true, error: null };

    await ghlFetch(`/opportunities/${oppId}`, {
      method: "PUT",
      body: JSON.stringify({ customFields }),
    });

    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/** Paginated search for all opportunities in a pipeline. */
export async function searchPipelineOpportunities(
  pipelineId: string,
): Promise<{ id: string; contact: { id: string; name?: string; firstName?: string; lastName?: string; email?: string; phone?: string }; pipelineStageId: string }[]> {
  type Opp = { id: string; contact: { id: string; name?: string; firstName?: string; lastName?: string; email?: string; phone?: string }; pipelineStageId: string };
  const allOpps: Opp[] = [];
  let page = 1;
  while (true) {
    const params = new URLSearchParams({
      location_id: LOCATION_ID,
      pipeline_id: pipelineId,
      limit: "100",
      page: String(page),
    });
    const data = (await ghlFetch(`/opportunities/search?${params}`)) as {
      opportunities?: Opp[];
    };
    const opps = data.opportunities || [];
    if (!opps.length) break;
    allOpps.push(...opps);
    if (opps.length < 100) break;
    page++;
    await sleep(300);
  }
  return allOpps;
}

/** Fetch full opportunity details (includes custom fields). */
export async function fetchOpportunityDetails(
  oppId: string,
): Promise<Record<string, unknown>> {
  const data = (await ghlFetch(`/opportunities/${oppId}`)) as {
    opportunity?: Record<string, unknown>;
  };
  return data.opportunity || {};
}

/** Normalize raw HI status string. */
export function parseHiStatus(raw: string): string {
  if (!raw) return "";
  const r = raw.toLowerCase();
  if (r.includes("reviewed") || r.startsWith("3")) return "Reviewed";
  if (r.includes("signed") || r.startsWith("2")) return "Signed";
  if (r.includes("sent") || r.startsWith("1")) return "Sent";
  if (r.includes("none") || r.startsWith("0")) return "None";
  return raw;
}

/** Normalize raw OHA status string. */
export function parseOhaStatus(raw: string): string {
  if (!raw) return "";
  const r = raw.toLowerCase();
  if (r.includes("reviewed") || r.startsWith("4")) return "Reviewed";
  if (r.includes("signed") || r.startsWith("3")) return "Signed";
  if (r.includes("sent") || r.startsWith("2")) return "Sent";
  if (r.includes("created") || r.startsWith("1")) return "Created";
  if (r.includes("none") || r.startsWith("0")) return "None";
  return raw;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Calendar API uses a different version than the rest of GHL
const GHL_CALENDAR_VERSION = "2021-04-15";

/** Fetch all calendars in the location. */
export async function fetchCalendars(): Promise<
  import("./types").GHLCalendar[]
> {
  const data = (await ghlFetch(`/calendars/?locationId=${LOCATION_ID}`, {
    headers: { Version: GHL_CALENDAR_VERSION },
  })) as { calendars?: import("./types").GHLCalendar[] };
  return data.calendars || [];
}

/** Fetch all calendar groups in the location. */
export async function fetchCalendarGroups(): Promise<
  import("./types").GHLCalendarGroup[]
> {
  const data = (await ghlFetch(`/calendars/groups?locationId=${LOCATION_ID}`, {
    headers: { Version: GHL_CALENDAR_VERSION },
  })) as { groups?: import("./types").GHLCalendarGroup[] };
  return data.groups || [];
}

export async function triggerWebhook(
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; error: string | null }> {
  const webhookUrl = process.env.GHL_APPROVE_WEBHOOK_URL;
  if (!webhookUrl) throw new Error("GHL_APPROVE_WEBHOOK_URL not set");

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Webhook ${res.status}: ${await res.text()}`);
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
