import { NextRequest, NextResponse } from "next/server";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

function getPool() {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("POSTGRES_URL not set");
  return new Pool({ connectionString: url, max: 5 });
}

let _pool: Pool | null = null;
function pool(): Pool {
  if (!_pool) _pool = getPool();
  return _pool;
}

const ALLOWED_FIELDS = new Set([
  "current_step",
  "primary_reason",
  "readiness",
  "medical_flags",
  "psych_flags",
  "can_travel",
  "financial_ready",
  "best_case",
  "attribution",
  "routed_outcome",
  "first_name",
  "last_name",
  "phone",
  "medications",
  "additional_notes",
  "booking_id",
  "completed_at",
]);

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const userId = body.user_id as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: "user_id is required" }, { status: 400 });
    }

    const sets: string[] = ["updated_at = NOW()"];
    const vals: unknown[] = [];
    let paramIdx = 1;

    for (const [key, value] of Object.entries(body)) {
      if (key === "user_id") continue;
      if (!ALLOWED_FIELDS.has(key)) continue;

      if (key === "medical_flags" || key === "psych_flags") {
        sets.push(`${key} = $${paramIdx}::text[]`);
      } else if (key === "medications") {
        sets.push(`${key} = $${paramIdx}::jsonb`);
      } else {
        sets.push(`${key} = $${paramIdx}`);
      }

      if (key === "medications") {
        vals.push(JSON.stringify(value));
      } else {
        vals.push(value);
      }
      paramIdx++;
    }

    if (sets.length <= 1) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    vals.push(userId);
    await pool().query(
      `UPDATE pathway_responses SET ${sets.join(", ")} WHERE user_id = $${paramIdx}`,
      vals,
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[pathway/save]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("user_id");
    if (!userId) {
      return NextResponse.json({ error: "user_id is required" }, { status: 400 });
    }

    const { rows } = await pool().query(
      `SELECT pr.*, p.email
       FROM pathway_responses pr
       JOIN profiles p ON p.id = pr.user_id
       WHERE pr.user_id = $1`,
      [userId],
    );

    if (rows.length === 0) {
      return NextResponse.json({ data: null });
    }

    return NextResponse.json({ data: rows[0] });
  } catch (e) {
    console.error("[pathway/save GET]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
