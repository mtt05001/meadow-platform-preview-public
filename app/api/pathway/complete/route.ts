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

export async function POST(req: NextRequest) {
  try {
    const { user_id } = (await req.json()) as { user_id?: string };
    if (!user_id) {
      return NextResponse.json({ error: "user_id is required" }, { status: 400 });
    }

    const { rows } = await pool().query(
      `SELECT pr.*, p.email
       FROM pathway_responses pr
       JOIN profiles p ON p.id = pr.user_id
       WHERE pr.user_id = $1`,
      [user_id],
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "No pathway found" }, { status: 404 });
    }

    const data = rows[0];

    await pool().query(
      `UPDATE pathway_responses
       SET completed_at = NOW(), updated_at = NOW()
       WHERE user_id = $1`,
      [user_id],
    );

    await pool().query(
      `UPDATE profiles
       SET pathway_status = $1, updated_at = NOW()
       WHERE id = $2`,
      [data.routed_outcome || "discovery_call", user_id],
    );

    const webhookUrl = process.env.GHL_PATHWAY_WEBHOOK_URL;
    if (webhookUrl) {
      const payload = {
        email: data.email,
        firstName: data.first_name || "",
        lastName: data.last_name || "",
        phone: data.phone || "",
        routed_outcome: data.routed_outcome,
        primary_reason: data.primary_reason,
        readiness: data.readiness,
        financial_ready: data.financial_ready,
        medical_flags: (data.medical_flags || []).join(", "),
        psych_flags: (data.psych_flags || []).join(", "),
        disqualified:
          data.routed_outcome === "disqualified",
        can_travel: data.can_travel,
        best_case: data.best_case || "",
        attribution: data.attribution || "",
        medications: JSON.stringify(data.medications || []),
        additional_notes: data.additional_notes || "",
        pathway_completed_at: new Date().toISOString(),
        booking_id: data.booking_id || "",
      };

      try {
        const res = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          console.error("[pathway/complete] GHL webhook failed:", res.status, await res.text());
        }
      } catch (webhookErr) {
        console.error("[pathway/complete] GHL webhook error:", webhookErr);
      }
    }

    return NextResponse.json({ ok: true, outcome: data.routed_outcome });
  } catch (e) {
    console.error("[pathway/complete]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
