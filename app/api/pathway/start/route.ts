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
    const { email, user_id } = (await req.json()) as {
      email?: string;
      user_id?: string;
    };

    if (!email || !user_id) {
      return NextResponse.json(
        { error: "email and user_id are required" },
        { status: 400 },
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    await pool().query(
      `INSERT INTO profiles (id, email)
       VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET
         email = EXCLUDED.email,
         updated_at = NOW()`,
      [user_id, normalizedEmail],
    );

    await pool().query(
      `INSERT INTO pathway_responses (user_id, current_step)
       VALUES ($1, 1)
       ON CONFLICT (user_id) DO NOTHING`,
      [user_id],
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[pathway/start]", e);
    return NextResponse.json(
      { error: String(e) },
      { status: 500 },
    );
  }
}
