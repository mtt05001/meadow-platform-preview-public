import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import type { Intake, Client, ClientCache, AiFeedback } from "./types";

// WebSocket constructor needed for local dev (Vercel provides one natively)
neonConfig.webSocketConstructor = ws;

const COLS = [
  "id", "name", "email", "submitted_at", "risk_tier", "status",
  "hard_contraindications", "soft_score", "soft_details", "risk_tier_explanation",
  "ghl_hi_status", "ghl_oha_status", "approved_by", "approved_at",
  "created_at", "updated_at", "edited_risk_strat", "prep1_date", "facilitator",
  "client_data", "ai_output", "jotform_data",
] as const;

const SELECT_COLS = COLS.join(",");

function getPool() {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("POSTGRES_URL not set");
  return new Pool({ connectionString: url, max: 5 });
}

// Singleton pool — reused across requests in the same process
let _pool: Pool | null = null;
function pool(): Pool {
  if (!_pool) _pool = getPool();
  return _pool;
}

function jload<T>(val: unknown, fallback: T): T {
  if (Array.isArray(val) || (val && typeof val === "object")) return val as T;
  if (typeof val === "string") {
    try { return JSON.parse(val) as T; } catch { return fallback; }
  }
  return fallback;
}

function rowToIntake(row: Record<string, unknown>): Intake {
  return {
    id: row.id as string,
    name: (row.name as string) || "Unknown",
    email: (row.email as string) || "",
    submitted_at: (row.submitted_at as string) || null,
    risk_tier: (row.risk_tier as Intake["risk_tier"]) || "unknown",
    status: (row.status as Intake["status"]) || "pending",
    hard_contraindications: jload(row.hard_contraindications, []),
    soft_score: row.soft_score != null ? Number(row.soft_score) : 0,
    soft_details: jload(row.soft_details, []),
    risk_tier_explanation: (row.risk_tier_explanation as string) || "",
    ghl_hi_status: (row.ghl_hi_status as string) || "",
    ghl_oha_status: (row.ghl_oha_status as string) || "",
    approved_by: (row.approved_by as string) || null,
    approved_at: (row.approved_at as string) || null,
    created_at: row.created_at instanceof Date
      ? row.created_at.toISOString()
      : row.created_at ? String(row.created_at) : null,
    edited_risk_strat: (row.edited_risk_strat as string) || null,
    prep1_date: (row.prep1_date as string) || null,
    facilitator: (row.facilitator as string) || null,
    client_data: jload(row.client_data, {}),
    ai_output: jload(row.ai_output, {}),
    jotform_data: jload(row.jotform_data, {}),
  };
}

export async function getIntakes(
  limit = 500,
  offset = 0,
  statusFilter?: string,
  search?: string,
): Promise<Intake[]> {
  let q = `SELECT ${SELECT_COLS} FROM intakes`;
  const params: unknown[] = [];
  const where: string[] = [];
  if (statusFilter) {
    where.push(`status = $${params.length + 1}`);
    params.push(statusFilter);
  }
  if (search) {
    where.push(`name ILIKE $${params.length + 1}`);
    params.push(`%${search}%`);
  }
  if (where.length) q += ` WHERE ${where.join(" AND ")}`;
  q += ` ORDER BY created_at DESC NULLS LAST LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const { rows } = await pool().query(q, params);
  return rows.map(rowToIntake);
}

export async function getIntakeById(id: string): Promise<Intake | null> {
  const { rows } = await pool().query(
    `SELECT ${SELECT_COLS} FROM intakes WHERE id = $1`,
    [id],
  );
  return rows.length ? rowToIntake(rows[0]) : null;
}

export async function upsertIntake(payload: Record<string, unknown>): Promise<void> {
  const p = {
    id: String(payload.id),
    name: (payload.name as string) || "Unknown",
    email: (payload.email as string) || "",
    submitted_at: payload.submitted_at ?? null,
    risk_tier: (payload.risk_tier as string) || "unknown",
    status: (payload.status as string) || "pending",
    hard_contraindications: JSON.stringify(payload.hard_contraindications ?? []),
    soft_score: payload.soft_score ?? 0,
    soft_details: JSON.stringify(payload.soft_details ?? []),
    risk_tier_explanation: (payload.risk_tier_explanation as string) || "",
    ghl_hi_status: (payload.ghl_hi_status as string) || "",
    ghl_oha_status: (payload.ghl_oha_status as string) || "",
    approved_by: payload.approved_by ?? null,
    approved_at: payload.approved_at ?? null,
    created_at: payload.created_at ?? null,
    edited_risk_strat: payload.edited_risk_strat ?? null,
    prep1_date: payload.prep1_date ?? null,
    facilitator: payload.facilitator ?? null,
    client_data: JSON.stringify(payload.client_data ?? {}),
    ai_output: JSON.stringify(payload.ai_output ?? {}),
    jotform_data: JSON.stringify(payload.jotform_data ?? {}),
  };

  await pool().query(
    `INSERT INTO intakes (
      id,name,email,submitted_at,risk_tier,status,
      hard_contraindications,soft_score,soft_details,risk_tier_explanation,
      ghl_hi_status,ghl_oha_status,approved_by,approved_at,
      created_at,updated_at,edited_risk_strat,prep1_date,facilitator,
      client_data,ai_output,jotform_data
    ) VALUES (
      $1,$2,$3,$4,$5,$6,
      $7,$8,$9,$10,
      $11,$12,$13,$14,
      COALESCE($15::timestamptz,NOW()),NOW(),$16,$17,$18,
      $19,$20,$21
    )
    ON CONFLICT (id) DO UPDATE SET
      name=EXCLUDED.name, email=EXCLUDED.email, submitted_at=EXCLUDED.submitted_at,
      risk_tier=EXCLUDED.risk_tier, status=EXCLUDED.status,
      hard_contraindications=EXCLUDED.hard_contraindications,
      soft_score=EXCLUDED.soft_score, soft_details=EXCLUDED.soft_details,
      risk_tier_explanation=EXCLUDED.risk_tier_explanation,
      ghl_hi_status=EXCLUDED.ghl_hi_status, ghl_oha_status=EXCLUDED.ghl_oha_status,
      approved_by=EXCLUDED.approved_by, approved_at=EXCLUDED.approved_at,
      updated_at=NOW(), edited_risk_strat=EXCLUDED.edited_risk_strat,
      prep1_date=EXCLUDED.prep1_date, facilitator=EXCLUDED.facilitator,
      client_data=EXCLUDED.client_data, ai_output=EXCLUDED.ai_output,
      jotform_data=EXCLUDED.jotform_data`,
    [
      p.id, p.name, p.email, p.submitted_at, p.risk_tier, p.status,
      p.hard_contraindications, p.soft_score, p.soft_details, p.risk_tier_explanation,
      p.ghl_hi_status, p.ghl_oha_status, p.approved_by, p.approved_at,
      p.created_at, p.edited_risk_strat, p.prep1_date, p.facilitator,
      p.client_data, p.ai_output, p.jotform_data,
    ],
  );
}

const ALLOWED_COLS: Set<string> = new Set(COLS);

export async function updateIntakeFields(
  id: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const keys = Object.keys(fields).filter((k) => ALLOWED_COLS.has(k) && k !== "id");
  if (!keys.length) return;
  const setClauses = keys.map((k, i) => `${k} = $${i + 1}`);
  setClauses.push("updated_at = NOW()");
  const values = [...Object.values(fields), id];
  await pool().query(
    `UPDATE intakes SET ${setClauses.join(", ")} WHERE id = $${values.length}`,
    values,
  );
}

/** Atomically claim an intake for sending — prevents double-approve race condition. */
export async function claimIntakeForSending(
  id: string,
  approvedBy: string,
  approvedAt: string,
): Promise<boolean> {
  const { rowCount } = await pool().query(
    `UPDATE intakes SET status='sending', approved_by=$2, approved_at=$3, updated_at=NOW()
     WHERE id=$1 AND status='pending'`,
    [id, approvedBy, approvedAt],
  );
  return (rowCount ?? 0) > 0;
}

export async function deleteIntake(id: string): Promise<void> {
  await pool().query("DELETE FROM intakes WHERE id = $1", [id]);
}

export async function getLastUpdated(): Promise<string> {
  const { rows } = await pool().query("SELECT MAX(updated_at) as max_updated FROM intakes");
  if (rows[0]?.max_updated instanceof Date) {
    return rows[0].max_updated.toISOString();
  }
  return new Date().toISOString();
}

// ── Client cache ──────────────────────────────────────────────────────

export async function getClientCache(): Promise<ClientCache | null> {
  const { rows } = await pool().query(
    "SELECT data, synced_at FROM client_cache WHERE id = 'latest'",
  );
  if (!rows.length) return null;
  const data = typeof rows[0].data === "string" ? JSON.parse(rows[0].data) : rows[0].data;
  const synced = rows[0].synced_at instanceof Date
    ? rows[0].synced_at.toISOString()
    : String(rows[0].synced_at);
  return {
    clients: (data as { clients?: Client[] }).clients || [],
    last_synced: synced,
    total: ((data as { clients?: Client[] }).clients || []).length,
  };
}

export async function upsertClientCache(clients: Client[]): Promise<void> {
  const data = JSON.stringify({ clients });
  await pool().query(
    `INSERT INTO client_cache (id, data, synced_at)
     VALUES ('latest', $1::jsonb, NOW())
     ON CONFLICT (id) DO UPDATE SET data = $1::jsonb, synced_at = NOW()`,
    [data],
  );
}

// ── AI Feedback ──────────────────────────────────────────────────────

export async function insertFeedback(
  intakeId: string,
  feedbackType: string,
  feedbackText: string,
  reviewer: string,
): Promise<void> {
  await pool().query(
    `INSERT INTO ai_feedback (intake_id, feedback_type, feedback_text, reviewer)
     VALUES ($1, $2, $3, $4)`,
    [intakeId, feedbackType, feedbackText, reviewer],
  );
}

export async function getFeedbackByIntake(intakeId: string): Promise<AiFeedback[]> {
  const { rows } = await pool().query(
    `SELECT id, intake_id, feedback_type, feedback_text, reviewer, created_at
     FROM ai_feedback WHERE intake_id = $1 ORDER BY created_at DESC`,
    [intakeId],
  );
  return rows.map((r) => ({
    id: r.id as number,
    intake_id: r.intake_id as string,
    feedback_type: r.feedback_type as string,
    feedback_text: r.feedback_text as string,
    reviewer: r.reviewer as string,
    created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  }));
}
