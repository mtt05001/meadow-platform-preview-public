const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";
const LOCATION_ID = process.env.GHL_LOCATION_ID || "A4AjOJ6RQgzEHxtmZsOr";

// GHL custom field IDs (opportunity-level)
export const GHL_FIELDS = {
  PREP1_DATE: "47Nj5tCxZy6Zhze9m9c8",
  PREP2_DATE: "RHZA1YmoHFAJlAbYrLvw",
  JOURNEY_DATE: "1amX2K1pwdx2r39wwd9d",
  HI_STATUS: "JD7nHdPbcHWnEh2OEhhI",
  OHA_STATUS: "onZ8dloJ0Ho6JQpCt8PI",
  LEAD_FACILITATOR: "H4LM6jbUwR1woLSj2kzV",
  FACILITATOR_EMAIL: "l9dFoho2FPShAznPUrM9",
  HI_URL: "pypItuyHO6POQ2NpoTcZ",
} as const;

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
      body: JSON.stringify({ locationId: LOCATION_ID, query: email, limit: 1 }),
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
    const data = (await ghlFetch("/opportunities/search", {
      method: "POST",
      body: JSON.stringify({
        locationId: LOCATION_ID,
        contactId,
        limit: 1,
      }),
    })) as { opportunities?: Record<string, unknown>[] };

    const opps = data.opportunities || [];
    if (!opps.length)
      return { opportunity: null, facilitatorEmail: null, error: "No opportunity found" };

    const opp = opps[0];
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

export async function updateOpportunityField(
  contactId: string,
  hiStatus?: string,
  intakeId?: string,
): Promise<{ ok: boolean; error: string | null }> {
  try {
    // Find opportunity
    const data = (await ghlFetch("/opportunities/search", {
      method: "POST",
      body: JSON.stringify({ locationId: LOCATION_ID, contactId, limit: 5 }),
    })) as { opportunities?: { id: string }[] };

    const opps = data.opportunities || [];
    if (!opps.length) return { ok: false, error: "No opportunities found" };

    const oppId = opps[0].id;

    const customFields: { id: string; value?: string; field_value?: string }[] = [];
    if (hiStatus) {
      customFields.push({ id: GHL_FIELDS.HI_STATUS, value: hiStatus });
    }
    if (intakeId) {
      const hiUrl = `https://meadow-platform.vercel.app/intakes/${intakeId}/readonly`;
      customFields.push({ id: GHL_FIELDS.HI_URL, field_value: hiUrl });
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

export async function triggerWebhook(
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; error: string | null }> {
  const webhookUrl =
    process.env.GHL_APPROVE_WEBHOOK_URL ||
    "https://services.leadconnectorhq.com/hooks/A4AjOJ6RQgzEHxtmZsOr/webhook-trigger/9efa7df3-7d80-494c-ad10-227e9b323b19";

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
