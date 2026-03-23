"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import Nav from "@/components/nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface AnalyticsData {
  statuses: Record<string, number>;
  risks: Record<string, number>;
  monthlyVolume: { month: string; count: number }[];
  avgTurnaroundHours: number | null;
  topContraindications: { category: string; count: number }[];
  approvers: { userId: string; count: number }[];
  pipelineStages: { name: string; group: string; count: number }[];
  facilitatorWorkload: { name: string; count: number }[];
  upcomingSessions: { name: string; type: string; date: string }[];
  totalIntakes: number;
  totalClients: number;
}

const STAGE_GROUP_COLORS: Record<string, string> = {
  onboarding: "bg-amber-500",
  prep: "bg-sky-500",
  journey: "bg-violet-500",
  integration: "bg-emerald-500",
  done: "bg-slate-400",
};

const STAGE_GROUP_LABELS: Record<string, string> = {
  onboarding: "Onboarding",
  prep: "Prep",
  journey: "Journey",
  integration: "Integration",
  done: "Complete",
};

function InfoTip({ text }: { text: string }) {
  return (
    <Popover>
      <PopoverTrigger
        className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full bg-muted text-muted-foreground text-[11px] font-medium hover:bg-muted-foreground/20 transition-colors shrink-0"
      >
        ?
      </PopoverTrigger>
      <PopoverContent
        side="top"
        className="max-w-[280px] text-[12px] leading-relaxed text-foreground"
      >
        {text}
      </PopoverContent>
    </Popover>
  );
}

function formatMonth(ym: string) {
  const [y, m] = ym.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(m, 10) - 1]} '${y.slice(2)}`;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function daysFromNow(iso: string) {
  const diff = Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return `In ${diff} days`;
}

// ── KPI Card ──────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  subtitle,
  accent,
  info,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  accent?: string;
  info?: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      {accent && (
        <div className={`absolute top-0 left-0 w-full h-1 ${accent}`} />
      )}
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-medium text-muted-foreground tracking-wide uppercase">
            {label}
          </p>
          {info && <InfoTip text={info} />}
        </div>
        <p className="text-[32px] font-bold tracking-tight leading-tight mt-1 text-foreground">
          {value}
        </p>
        {subtitle && (
          <p className="text-[12px] text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Bar Chart (CSS) ───────────────────────────────────────────────────

function BarChart({
  data,
  labelKey,
  valueKey,
  color = "bg-[var(--color-meadow)]",
}: {
  data: Record<string, unknown>[];
  labelKey: string;
  valueKey: string;
  color?: string;
}) {
  const max = Math.max(...data.map((d) => d[valueKey] as number), 1);
  return (
    <div className="space-y-2">
      {data.map((d, i) => {
        const val = d[valueKey] as number;
        const pct = (val / max) * 100;
        return (
          <div key={i} className="flex items-center gap-3">
            <span className="text-[12px] text-muted-foreground w-24 shrink-0 truncate text-right">
              {d[labelKey] as string}
            </span>
            <div className="flex-1 h-6 bg-muted/50 rounded-md overflow-hidden">
              <div
                className={`h-full rounded-md ${color} transition-all duration-700 ease-out`}
                style={{ width: `${Math.max(pct, 2)}%` }}
              />
            </div>
            <span className="text-[13px] font-semibold text-foreground w-8 text-right tabular-nums">
              {val}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Risk Tier Donut (SVG) ─────────────────────────────────────────────

function RiskDonut({ risks }: { risks: Record<string, number> }) {
  const green = risks["green"] || 0;
  const yellow = risks["yellow"] || 0;
  const red = risks["red"] || 0;
  const unknown = risks["unknown"] || 0;
  const total = green + yellow + red + unknown;
  if (total === 0) return <p className="text-muted-foreground text-sm">No data</p>;

  const segments = [
    { value: green, color: "var(--color-tier-green)", label: "Green" },
    { value: yellow, color: "var(--color-tier-yellow)", label: "Yellow" },
    { value: red, color: "var(--color-tier-red)", label: "Red" },
    { value: unknown, color: "#94a3b8", label: "Unknown" },
  ].filter((s) => s.value > 0);

  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 160 160" className="w-32 h-32 shrink-0">
        {segments.map((seg, i) => {
          const pct = seg.value / total;
          const dash = pct * circumference;
          const gap = circumference - dash;
          const currentOffset = offset;
          offset += dash;
          return (
            <circle
              key={i}
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth="18"
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-currentOffset}
              strokeLinecap="butt"
              className="transition-all duration-700"
              style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
            />
          );
        })}
        <text x="80" y="76" textAnchor="middle" className="fill-foreground text-[28px] font-bold">
          {total}
        </text>
        <text x="80" y="96" textAnchor="middle" className="fill-muted-foreground text-[12px]">
          intakes
        </text>
      </svg>
      <div className="space-y-2">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: seg.color }}
            />
            <span className="text-[13px] text-foreground">
              {seg.label}
            </span>
            <span className="text-[13px] font-semibold text-foreground ml-auto tabular-nums">
              {seg.value}
            </span>
            <span className="text-[11px] text-muted-foreground w-10 text-right tabular-nums">
              {Math.round((seg.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Volume Sparkline ──────────────────────────────────────────────────

function VolumeChart({ data }: { data: { month: string; count: number }[] }) {
  if (!data.length) return <p className="text-muted-foreground text-sm">No data</p>;
  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2" style={{ height: 120 }}>
        {data.map((d, i) => {
          const pct = (d.count / max) * 100;
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full min-w-0 group">
              <span className="text-[11px] font-semibold text-foreground tabular-nums mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {d.count}
              </span>
              <div
                className="w-full bg-[var(--color-meadow)] rounded-t-sm transition-all duration-700 ease-out group-hover:bg-[var(--color-meadow-light)]"
                style={{ height: `${Math.max(pct, 4)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-2">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center">
            <span className="text-[10px] text-muted-foreground">
              {formatMonth(d.month)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Pipeline Distribution ─────────────────────────────────────────────

function PipelineChart({
  stages,
}: {
  stages: { name: string; group: string; count: number }[];
}) {
  if (!stages.length) return <p className="text-muted-foreground text-sm">No data</p>;

  // Group stages by group
  const groups = new Map<string, number>();
  for (const s of stages) {
    groups.set(s.group, (groups.get(s.group) || 0) + s.count);
  }
  const total = stages.reduce((a, b) => a + b.count, 0);

  return (
    <div className="space-y-4">
      {/* Stacked bar */}
      <div className="h-8 flex rounded-lg overflow-hidden">
        {Array.from(groups.entries()).map(([group, count]) => {
          const pct = (count / total) * 100;
          if (pct < 1) return null;
          return (
            <div
              key={group}
              className={`${STAGE_GROUP_COLORS[group] || "bg-slate-300"} transition-all duration-700 flex items-center justify-center`}
              style={{ width: `${pct}%` }}
            >
              {pct > 10 && (
                <span className="text-[11px] font-semibold text-white truncate px-1">
                  {count}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {Array.from(groups.entries()).map(([group, count]) => (
          <div key={group} className="flex items-center gap-1.5">
            <div
              className={`w-2.5 h-2.5 rounded-sm ${STAGE_GROUP_COLORS[group] || "bg-slate-300"}`}
            />
            <span className="text-[12px] text-muted-foreground">
              {STAGE_GROUP_LABELS[group] || group}
            </span>
            <span className="text-[12px] font-semibold text-foreground tabular-nums">
              {count}
            </span>
          </div>
        ))}
      </div>

      {/* Individual stages */}
      <div className="space-y-1.5">
        {stages.map((s) => {
          const pct = (s.count / total) * 100;
          return (
            <div key={s.name} className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground w-28 shrink-0 truncate text-right">
                {s.name}
              </span>
              <div className="flex-1 h-4 bg-muted/40 rounded overflow-hidden">
                <div
                  className={`h-full rounded ${STAGE_GROUP_COLORS[s.group] || "bg-slate-300"} transition-all duration-700`}
                  style={{ width: `${Math.max(pct, 1.5)}%` }}
                />
              </div>
              <span className="text-[12px] font-semibold text-foreground w-6 text-right tabular-nums">
                {s.count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Upcoming Sessions ─────────────────────────────────────────────────

function UpcomingSessions({
  sessions,
}: {
  sessions: { name: string; type: string; date: string }[];
}) {
  if (!sessions.length) {
    return (
      <p className="text-muted-foreground text-sm py-4">
        No sessions in the next 14 days
      </p>
    );
  }

  const typeColors: Record<string, string> = {
    "Prep 1": "bg-sky-100 text-sky-700",
    "Prep 2": "bg-sky-100 text-sky-700",
    Journey: "bg-violet-100 text-violet-700",
    "Integration 1": "bg-emerald-100 text-emerald-700",
    "Integration 2": "bg-emerald-100 text-emerald-700",
  };

  return (
    <div className="space-y-1">
      {sessions.slice(0, 10).map((s, i) => (
        <div
          key={i}
          className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/40 transition-colors"
        >
          <div className="flex flex-col items-center w-12 shrink-0">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              {new Date(s.date).toLocaleDateString("en-US", { weekday: "short" })}
            </span>
            <span className="text-[18px] font-bold text-foreground leading-tight tabular-nums">
              {new Date(s.date).getDate()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-foreground truncate">
              {s.name}
            </p>
            <p className="text-[11px] text-muted-foreground">{daysFromNow(s.date)}</p>
          </div>
          <span
            className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${typeColors[s.type] || "bg-muted text-muted-foreground"}`}
          >
            {s.type}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Loading Skeleton ──────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="min-h-screen bg-background">
      <Nav subtitle="Analytics" />
      <div className="max-w-[1400px] mx-auto px-6 md:px-8 py-8">
        <div className="animate-pulse space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-muted/60 rounded-xl" />
            ))}
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="h-64 bg-muted/60 rounded-xl" />
            <div className="h-64 bg-muted/60 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { data, isLoading, error } = useQuery<AnalyticsData>({
    queryKey: ["analytics"],
    queryFn: () => apiFetch("/api/analytics"),
    staleTime: 60_000,
  });

  if (isLoading) return <Skeleton />;

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background">
        <Nav subtitle="Analytics" />
        <div className="max-w-[1400px] mx-auto px-6 md:px-8 py-12">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                Failed to load analytics. {error?.message || ""}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const pending = (data.statuses["pending"] || 0);
  const approved = (data.statuses["approved"] || 0) + (data.statuses["sending"] || 0);
  const total = data.totalIntakes;
  const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      <Nav subtitle="Analytics" />

      <div className="max-w-[1400px] mx-auto px-6 md:px-8 py-8 space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-[22px] font-bold text-foreground tracking-tight">
            Dashboard
          </h2>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Practice overview across intakes and client pipeline
          </p>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="Total Intakes"
            value={total}
            accent="bg-[var(--color-meadow)]"
            info="Total health intake forms submitted through Jotform and synced into the platform."
          />
          <KpiCard
            label="Pending Review"
            value={pending}
            subtitle={pending > 0 ? "Needs attention" : "All clear"}
            accent="bg-amber-500"
            info="Intakes that haven't been reviewed and approved yet. These need someone to review the risk assessment and send the medication guidance email."
          />
          <KpiCard
            label="Approval Rate"
            value={`${approvalRate}%`}
            subtitle={`${approved} approved`}
            accent="bg-[var(--color-tier-green)]"
            info="Percentage of all intakes that have been approved and had their guidance email sent."
          />
          <KpiCard
            label="Avg Turnaround"
            value={
              data.avgTurnaroundHours != null
                ? data.avgTurnaroundHours < 24
                  ? `${data.avgTurnaroundHours}h`
                  : `${(data.avgTurnaroundHours / 24).toFixed(1)}d`
                : "—"
            }
            subtitle="Submission → approval"
            accent="bg-sky-500"
            info="Average time from when an intake is submitted to when it gets approved. Lower is better."
          />
        </div>

        {/* Row 2: Risk donut + Volume chart */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-[15px] font-semibold">
                  Risk Tier Distribution
                </CardTitle>
                <InfoTip text="Automatic risk classification based on the health intake. The risk engine scans for ~100 medical conditions and ~130 medications. Red = hard contraindications or high soft score. Yellow = moderate flags. Green = no concerns. Excludes archived intakes." />
              </div>
            </CardHeader>
            <CardContent>
              <RiskDonut risks={data.risks} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-[15px] font-semibold">
                  Intake Volume
                </CardTitle>
                <InfoTip text="Number of new health intake submissions received each month. Based on when the intake was created in our system (synced from Jotform). Shows the last 12 months." />
              </div>
              <p className="text-[12px] text-muted-foreground">
                New submissions per month
              </p>
            </CardHeader>
            <CardContent>
              <VolumeChart data={data.monthlyVolume} />
            </CardContent>
          </Card>
        </div>

        {/* Row 3: Pipeline + Upcoming */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-[15px] font-semibold">
                  Client Pipeline
                </CardTitle>
                <InfoTip text="Where all active clients sit in their journey, from onboarding through integration. This data comes from GoHighLevel (the CRM) and updates when someone syncs from the Clients page." />
              </div>
              <p className="text-[12px] text-muted-foreground">
                {data.totalClients} active clients across stages
              </p>
            </CardHeader>
            <CardContent>
              <PipelineChart stages={data.pipelineStages} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-[15px] font-semibold">
                  Upcoming Sessions
                </CardTitle>
                <InfoTip text="Scheduled Prep, Journey, and Integration sessions in the next 14 days. Dates come from GoHighLevel calendar fields. If a session is missing, it may not be scheduled in GHL yet." />
              </div>
              <p className="text-[12px] text-muted-foreground">Next 14 days</p>
            </CardHeader>
            <CardContent className="px-3">
              <UpcomingSessions sessions={data.upcomingSessions} />
            </CardContent>
          </Card>
        </div>

        {/* Row 4: Contraindications + Facilitator workload */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-[15px] font-semibold">
                  Top Contraindications
                </CardTitle>
                <InfoTip text="The most common medical flags found across active intakes by the risk engine. These are conditions or medications that were automatically detected from health intake answers." />
              </div>
              <p className="text-[12px] text-muted-foreground">
                Most common flags across active intakes
              </p>
            </CardHeader>
            <CardContent>
              {data.topContraindications.length ? (
                <BarChart
                  data={data.topContraindications}
                  labelKey="category"
                  valueKey="count"
                  color="bg-[var(--color-tier-red)]"
                />
              ) : (
                <p className="text-muted-foreground text-sm py-4">No contraindications found</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-[15px] font-semibold">
                  Facilitator Workload
                </CardTitle>
                <InfoTip text="How many active clients each facilitator has assigned. Based on the Lead Facilitator field in GoHighLevel. 'Unassigned' means no facilitator has been set." />
              </div>
              <p className="text-[12px] text-muted-foreground">
                Active clients per facilitator
              </p>
            </CardHeader>
            <CardContent>
              {data.facilitatorWorkload.length ? (
                <BarChart
                  data={data.facilitatorWorkload}
                  labelKey="name"
                  valueKey="count"
                  color="bg-[var(--color-meadow-light)]"
                />
              ) : (
                <p className="text-muted-foreground text-sm py-4">No facilitator data</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
