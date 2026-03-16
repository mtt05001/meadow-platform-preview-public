const JOTFORM_BASE = "https://api.jotform.com";
const DEFAULT_FORM_ID = "243226217742049";

function getApiKey(): string {
  const key = process.env.JOTFORM_API_KEY;
  if (!key) throw new Error("JOTFORM_API_KEY not set");
  return key;
}

export async function fetchRecentSubmissions(
  formId = DEFAULT_FORM_ID,
  limit = 20,
): Promise<Record<string, unknown>[]> {
  const key = getApiKey();
  const url = `${JOTFORM_BASE}/form/${formId}/submissions?apiKey=${key}&limit=${limit}&orderby=created_at`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Jotform API ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { content?: Record<string, unknown>[] };
  return data.content || [];
}

export async function fetchSubmissionById(
  submissionId: string,
): Promise<Record<string, unknown> | null> {
  const key = getApiKey();
  const url = `${JOTFORM_BASE}/submission/${submissionId}?apiKey=${key}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Jotform API ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { content?: Record<string, unknown> };
  return data.content || null;
}

export async function fetchSubmissionPdf(
  submissionId: string,
  formId = DEFAULT_FORM_ID,
): Promise<Response> {
  const key = getApiKey();
  const url = `https://www.jotform.com/server.php?action=getSubmissionPDF&sid=${submissionId}&formID=${formId}&apiKey=${key}`;
  return fetch(url);
}
