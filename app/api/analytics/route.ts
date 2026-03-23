import { NextResponse } from "next/server";
import { Pool } from "@neondatabase/serverless";

function getPool() {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("POSTGRES_URL not set");
  return new Pool({ connectionString: url, max: 3 });
}

let _pool: Pool | null = null;
function pool(): Pool {
  if (!_pool) _pool = getPool();
  return _pool;
}

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = pool();

    // Run all queries in parallel
    const [
      statusCounts,
      riskCounts,
      monthlyVolume,
      turnaroundAvg,
      topContraindications,
      approverCounts,
      clientCacheRow,
    ] = await Promise.all([
      // 1. Status breakdown
      db.query(`
        SELECT status, COUNT(*)::int as count
        FROM intakes
        GROUP BY status
      `),

      // 2. Risk tier distribution
      db.query(`
        SELECT risk_tier, COUNT(*)::int as count
        FROM intakes
        WHERE status != 'archived'
        GROUP BY risk_tier
      `),

      // 3. Monthly intake volume (last 12 months)
      db.query(`
        SELECT
          TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') as month,
          COUNT(*)::int as count
        FROM intakes
        WHERE created_at >= NOW() - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY DATE_TRUNC('month', created_at)
      `),

      // 4. Average approval turnaround (hours)
      db.query(`
        SELECT
          ROUND(AVG(EXTRACT(EPOCH FROM (approved_at::timestamptz - created_at)) / 3600)::numeric, 1) as avg_hours
        FROM intakes
        WHERE approved_at IS NOT NULL AND created_at IS NOT NULL
      `),

      // 5. Top hard contraindications
      db.query(`
        SELECT
          elem->>'category' as category,
          COUNT(*)::int as count
        FROM intakes,
          jsonb_array_elements(
            CASE
              WHEN jsonb_typeof(hard_contraindications) = 'array' THEN hard_contraindications
              ELSE '[]'::jsonb
            END
          ) as elem
        WHERE status != 'archived'
        GROUP BY elem->>'category'
        ORDER BY count DESC
        LIMIT 8
      `),

      // 6. Approvals by reviewer
      db.query(`
        SELECT approved_by, COUNT(*)::int as count
        FROM intakes
        WHERE approved_by IS NOT NULL
        GROUP BY approved_by
        ORDER BY count DESC
      `),

      // 7. Client cache for pipeline data
      db.query(`SELECT data FROM client_cache WHERE id = 'latest'`),
    ]);

    // Process status counts into a map
    const statuses: Record<string, number> = {};
    for (const row of statusCounts.rows) {
      statuses[row.status as string] = row.count as number;
    }

    // Process risk counts
    const risks: Record<string, number> = {};
    for (const row of riskCounts.rows) {
      risks[row.risk_tier as string] = row.count as number;
    }

    // Process client cache for pipeline & facilitator stats
    let pipelineStages: { name: string; group: string; count: number }[] = [];
    let facilitatorWorkload: { name: string; count: number }[] = [];
    let upcomingSessions: { name: string; type: string; date: string }[] = [];

    if (clientCacheRow.rows.length) {
      const data =
        typeof clientCacheRow.rows[0].data === "string"
          ? JSON.parse(clientCacheRow.rows[0].data)
          : clientCacheRow.rows[0].data;
      const clients = (data?.clients || []) as Array<Record<string, string | number>>;

      // Pipeline stage distribution
      const stageMap = new Map<string, { group: string; count: number }>();
      for (const c of clients) {
        const name = (c.stage_name as string) || "Unknown";
        const group = (c.stage_group as string) || "unknown";
        const existing = stageMap.get(name);
        if (existing) existing.count++;
        else stageMap.set(name, { group, count: 1 });
      }
      pipelineStages = Array.from(stageMap.entries())
        .map(([name, val]) => ({ name, ...val }))
        .sort((a, b) => b.count - a.count);

      // Facilitator workload
      const facMap = new Map<string, number>();
      for (const c of clients) {
        const fac = (c.facilitator as string) || "Unassigned";
        facMap.set(fac, (facMap.get(fac) || 0) + 1);
      }
      facilitatorWorkload = Array.from(facMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      // Upcoming sessions (next 14 days)
      const now = new Date();
      const twoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      const sessionTypes = [
        { key: "prep1", label: "Prep 1" },
        { key: "prep2", label: "Prep 2" },
        { key: "journey", label: "Journey" },
        { key: "integ1", label: "Integration 1" },
        { key: "integ2", label: "Integration 2" },
      ] as const;

      for (const c of clients) {
        for (const st of sessionTypes) {
          const dateStr = c[st.key] as string;
          if (!dateStr) continue;
          const d = new Date(dateStr);
          if (d >= now && d <= twoWeeks) {
            upcomingSessions.push({
              name: c.name as string,
              type: st.label,
              date: dateStr,
            });
          }
        }
      }
      upcomingSessions.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      );
    }

    return NextResponse.json({
      statuses,
      risks,
      monthlyVolume: monthlyVolume.rows.map((r) => ({
        month: r.month as string,
        count: r.count as number,
      })),
      avgTurnaroundHours: turnaroundAvg.rows[0]?.avg_hours
        ? Number(turnaroundAvg.rows[0].avg_hours)
        : null,
      topContraindications: topContraindications.rows.map((r) => ({
        category: r.category as string,
        count: r.count as number,
      })),
      approvers: approverCounts.rows.map((r) => ({
        userId: r.approved_by as string,
        count: r.count as number,
      })),
      pipelineStages,
      facilitatorWorkload,
      upcomingSessions,
      totalIntakes:
        Object.values(statuses).reduce((a, b) => a + b, 0),
      totalClients: facilitatorWorkload.reduce((a, b) => a + b.count, 0),
    });
  } catch (e) {
    console.error("Analytics error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 },
    );
  }
}
