"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { useClientSync } from "@/lib/use-client-sync";
import type { McData, McEvent } from "@/lib/mission-control-types";
import Nav from "@/components/nav";

function pillClass(v: string, needed: boolean): string {
  if (!needed) return "na";
  if (!v || v === "—" || v === "None") return "miss";
  const l = v.toLowerCase();
  if (l.includes("reviewed")) return "ok";
  return "miss";
}

const PILL_STYLES: Record<string, string> = {
  ok: "bg-tier-green-bg text-green-800",
  miss: "bg-red-50 text-red-700",
  na: "bg-gray-100 text-gray-400",
};

function badgeClass(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("journey")) return "bg-purple-100 text-purple-700";
  if (t.includes("room") || t.includes("in-person"))
    return "bg-blue-100 text-blue-700";
  if (t.includes("prep")) return "bg-tier-green-bg text-green-800";
  if (t.includes("integration")) return "bg-pink-100 text-pink-700";
  if (t.includes("taper")) return "bg-blue-50 text-blue-500";
  if (t.includes("consult")) return "bg-gray-100 text-gray-500";
  return "bg-gray-100 text-gray-500";
}

const STATUS_DOT: Record<string, string> = {
  green: "bg-tier-green shadow-[0_0_6px_var(--color-tier-green)]",
  yellow: "bg-tier-yellow shadow-[0_0_6px_var(--color-tier-yellow)]",
  red: "bg-tier-red shadow-[0_0_6px_var(--color-tier-red)]",
  pipeline: "bg-gray-400",
};

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  green: { text: "Ready", color: "text-tier-green" },
  yellow: { text: "In Progress", color: "text-tier-yellow" },
  red: { text: "Missing", color: "text-tier-red" },
  pipeline: { text: "Pipeline", color: "text-gray-400" },
};

function formatJourneyDate(value: string): string {
  if (!value) return "None";
  // Expected YYYY-MM-DD; parse as local date to avoid TZ shifts
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return value;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatTimestamp(iso: string): string {
  try {
    return (
      "Updated " +
      new Date(iso).toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "America/Los_Angeles",
      }) +
      " PT"
    );
  } catch {
    return "";
  }
}

function computeFacilitatorLoad(data: McData): [string, number][] {
  const counts: Record<string, number> = {};
  for (const day of data.days) {
    for (const ev of day.events) {
      if (ev.facilitator) {
        counts[ev.facilitator] = (counts[ev.facilitator] || 0) + 1;
      }
    }
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

function EventRow({ ev }: { ev: McEvent }) {
  const programLabel = ev.program || "Standard Journey";
  const hiPill = pillClass(ev.hi, ev.hi_needed);
  const ohaPill = pillClass(ev.oha, ev.oha_needed);
  const consultPill = ev.consult_needed
    ? (ev.consult_note.toLowerCase() === "yes" ? "ok" : "miss")
    : "na";

  return (
    <div className="grid grid-cols-[1fr_110px] px-5 py-3.5 border-b border-border/50 last:border-b-0 hover:bg-cream-warm/50 transition-colors">
      <div className="flex flex-col gap-1.5">
        {/* Row 1: Client name + Program */}
        <div className="flex items-center gap-2.5">
          <span className="font-semibold text-base text-bark">{ev.name}</span>
          <span className="text-sm font-semibold text-bark-light">{programLabel}</span>
          {ev.medically_complex && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide bg-tier-red text-white">
              Complex
            </span>
          )}
        </div>
        {/* Row 2: Time + Appointment type + Facilitator */}
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-semibold text-bark tabular-nums">{ev.time}</span>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${badgeClass(ev.type)}`}
          >
            {ev.type}
          </span>
          {ev.facilitator && (
            <>
              <span className="text-bark-light/40">·</span>
              <span className="text-sm text-bark-light">{ev.facilitator}</span>
            </>
          )}
        </div>
        {/* Row 3: HI + OHA + Journey date */}
        <div className="flex gap-2 flex-wrap">
          <span
            className={`text-sm px-2.5 py-0.5 rounded-full font-semibold ${PILL_STYLES[hiPill]}`}
          >
            HI: {ev.hi}
          </span>
          <span
            className={`text-sm px-2.5 py-0.5 rounded-full font-semibold ${PILL_STYLES[ohaPill]}`}
          >
            OHA: {ev.oha}
          </span>
          <span
            className={`text-sm px-2.5 py-0.5 rounded-full font-semibold ${PILL_STYLES[consultPill]}`}
          >
            CN: {ev.consult_note || "None"}
          </span>
          <span className="text-sm font-medium text-bark-light">
            Journey: {formatJourneyDate(ev.journey)}
          </span>
        </div>
      </div>
      <div className="flex items-start justify-end gap-2 pt-1">
        <span className={`text-xs font-semibold whitespace-nowrap ${(STATUS_LABEL[ev.status] || STATUS_LABEL.pipeline).color}`}>
          {(STATUS_LABEL[ev.status] || STATUS_LABEL.pipeline).text}
        </span>
        <div
          className={`w-3 h-3 rounded-full shrink-0 ${STATUS_DOT[ev.status] || STATUS_DOT.pipeline}`}
        />
      </div>
    </div>
  );
}

function StatCard({
  num,
  label,
  colorClass,
}: {
  num: number;
  label: string;
  colorClass: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl px-5 py-4 text-center">
      <div className={`text-3xl font-extrabold leading-none ${colorClass}`}>
        {num}
      </div>
      <div className="text-xs text-bark-light uppercase tracking-wider mt-1">
        {label}
      </div>
    </div>
  );
}

export default function MissionControlPage() {
  // Auto-sync GHL data on mount (shared hook — 1-min TTL guard prevents redundant syncs)
  const { sync, isSyncing } = useClientSync();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["mission-control"],
    queryFn: () => apiFetch<McData>("/api/mission-control/refresh"),
    staleTime: 5 * 60 * 1000, // treat data as fresh for 5 min
    refetchOnWindowFocus: false,
  });

  const facLoad = data ? computeFacilitatorLoad(data) : [];
  const filteredAlerts = data
    ? data.alerts.filter((a) => !/\btest\b/i.test(a.name))
    : [];

  return (
    <>
      <Nav subtitle="Mission Control" />

      <div className="max-w-[1400px] mx-auto px-6 md:px-8 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          {data && (
            <p className="text-xs text-bark-light">
              {formatTimestamp(data.generated)}
            </p>
          )}
          <div className="ml-auto">
            <button
              onClick={() => sync()}
              disabled={isFetching || isSyncing}
              title="Sync GHL data and reload the 7-day forecast"
              className="
                px-3 py-2 rounded-[6px] text-[13px] font-medium
                bg-white border border-[#e0d9ce] text-[#2c3e50]
                hover:bg-[#f5f1eb] transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
                flex items-center gap-1.5
              "
            >
              {isFetching || isSyncing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {/* Stats bar */}
        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <StatCard
              num={data.stats.journeys}
              label="Journeys"
              colorClass="text-purple-600"
            />
            <StatCard
              num={data.stats.rooms}
              label="In-Person"
              colorClass="text-blue-600"
            />
            <StatCard
              num={data.stats.preps}
              label="Preps"
              colorClass="text-tier-green"
            />
            <StatCard
              num={data.stats.integration}
              label="Integration"
              colorClass="text-pink-600"
            />
            <StatCard
              num={data.stats.alerts}
              label="Alerts"
              colorClass="text-tier-red"
            />
            <StatCard
              num={data.stats.total}
              label="Total"
              colorClass="text-meadow"
            />
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-20 text-bark-light">
            Loading schedule...
          </div>
        )}

        {/* Main content: schedule + sidebar */}
        {data && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
            {/* Forecast */}
            <div className="flex flex-col gap-4">
              <h2 className="text-base font-bold text-bark uppercase tracking-wider pb-2 border-b border-border">
                Client Seven-Day Forecast
              </h2>
              {data.days.length === 0 && (
                <p className="text-bark-light text-sm py-8 text-center">
                  No events in the next 7 days.
                </p>
              )}
              {data.days.map((day) => {
                const visible = day.events.filter(
                  (e) =>
                    !["Other", "Consult", "Discovery"].includes(e.type) &&
                    !/\btest\b/i.test(e.name),
                );
                return (
                  <div
                    key={day.date}
                    className="bg-card border border-border rounded-xl overflow-hidden"
                  >
                    <div className="bg-bark px-5 py-3 font-bold text-[15px] flex items-center justify-between text-white">
                      <span>{day.date}</span>
                      <span className="text-xs font-medium text-white/70">
                        {day.events.length} events
                      </span>
                    </div>
                    {visible.map((ev, i) => (
                      <EventRow key={`${ev.time}-${ev.name}-${i}`} ev={ev} />
                    ))}
                    {visible.length === 0 && (
                      <div className="px-5 py-4 text-sm text-bark-light">
                        No clinical events
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Sidebar */}
            <div className="flex flex-col gap-4">
              {/* Alerts */}
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="bg-tier-red-bg px-5 py-3 font-bold text-sm border-b border-border flex items-center gap-2">
                  <span className="text-tier-red">Integrity Alerts</span>
                  <span className="text-sm text-bark-light font-medium">
                    ({filteredAlerts.length})
                  </span>
                </div>
                {filteredAlerts.length === 0 ? (
                  <div className="px-5 py-3 text-sm text-tier-green">
                    All clear — no issues detected
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto">
                    {filteredAlerts.map((a, i) => (
                      <div
                        key={`${a.name}-${i}`}
                        className="px-5 py-3 border-b border-border/50 last:border-b-0"
                      >
                        <div className="font-bold text-sm text-tier-yellow">{a.name}</div>
                        <div className="text-bark-light text-sm mt-0.5">{a.issue}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Facilitator Load */}
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="bg-cream-dark/40 px-5 py-3 border-b border-border">
                  <h3 className="text-xs font-bold text-bark uppercase tracking-wider">
                    Facilitator Load (7-Day)
                  </h3>
                </div>
                <div className="px-5 py-3">
                  {facLoad.length === 0 && (
                    <p className="text-sm text-bark-light">No facilitators assigned</p>
                  )}
                  {facLoad.map(([name, count]) => (
                    <div
                      key={name}
                      className="flex justify-between items-center py-2 border-b border-border/30 last:border-b-0 text-sm"
                    >
                      <span className="text-bark">{name}</span>
                      <span className="font-bold text-meadow-light">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </>
  );
}
