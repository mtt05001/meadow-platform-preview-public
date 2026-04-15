"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { CapacitySnapshot, FacilitatorStatusBadge } from "@/lib/capacity-engine";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pencil, RefreshCw } from "lucide-react";

const BADGE_LABEL: Record<FacilitatorStatusBadge, string> = {
  has_capacity: "Has capacity",
  near_full: "Near full",
  over_capacity: "Over capacity",
  no_clients: "No clients",
};

const BADGE_CLASS: Record<FacilitatorStatusBadge, string> = {
  has_capacity: "bg-emerald-100 text-emerald-900 border-emerald-200",
  near_full: "bg-amber-100 text-amber-950 border-amber-200",
  over_capacity: "bg-red-100 text-red-900 border-red-200",
  no_clients: "bg-slate-100 text-slate-600 border-slate-200",
};

function formatShort(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function CapacityDashboard() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["capacity"],
    queryFn: () => apiFetch<CapacitySnapshot>("/api/capacity"),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const refresh = () => {
    void (async () => {
      const snap = await apiFetch<CapacitySnapshot>("/api/capacity?refresh=1");
      queryClient.setQueryData(["capacity"], snap);
    })();
  };

  if (isLoading && !data) {
    return (
      <div className="rounded-xl border border-dashed border-[#1a4d2e]/25 bg-white/60 px-6 py-16 text-center text-[#1a4d2e]/70">
        Loading capacity data from GHL…
      </div>
    );
  }

  if (isError || !data) {
    const msg = error instanceof ApiError ? error.message : "Failed to load";
    return (
      <Card className="border-red-200 bg-red-50/80">
        <CardHeader>
          <CardTitle className="text-red-900">Could not load capacity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-red-900/90">
          <p>{msg}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[#1a4d2e]/70">
          Last updated {formatShort(data.revalidatedAt)} · Refreshes every 5 min
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void refresh()}
          disabled={isFetching}
          className="gap-2"
        >
          <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
          Refresh now
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Active pre-journey" value={data.summary.activePreJourneyTotal} />
        <MetricCard title="Journeys (next 4 weeks)" value={data.summary.journeysNext4Weeks} />
        <MetricCard title="Open slots (next 4 weeks)" value={data.summary.openSlotsNext4Weeks} />
        <MetricCard title="At / over weekly cap" value={data.summary.facilitatorsAtOrOverCap} />
      </div>

      <Card className="border-[#1a4d2e]/20 bg-[#1a4d2e]/[0.04]">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-[#1a4d2e]">Lead routing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-lg font-semibold text-[#1a4d2e]">
            Send next lead to:{" "}
            <span className="text-[#2d7a4a]">
              {data.routing.names.length ? data.routing.names.join(", ") : "—"}
            </span>
          </p>
          <p className="text-sm text-[#1a4d2e]/75">Ordered by fewest journeys booked in the next four weeks.</p>
          <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
            {data.routing.details.map((d) => (
              <li key={d.name} className="rounded-md bg-white/80 px-3 py-2 text-[#1a4d2e] shadow-sm">
                <span className="font-medium">{d.name}</span>
                <span className="text-[#1a4d2e]/70">
                  {" "}
                  — {d.used} of {d.total} slots used (next 4 weeks)
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-base font-semibold text-[#1a4d2e]">Facilitators</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.facilitators.map((f) => (
            <FacilitatorCard key={f.name} row={f} />
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-base font-semibold text-[#1a4d2e]">10-week journey calendar</h2>
        <div className="overflow-x-auto rounded-xl border border-[#1a4d2e]/15 bg-white shadow-sm">
          <table className="w-full min-w-[640px] border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-[#1a4d2e]/15 bg-[#f5f1eb]">
                <th className="sticky left-0 z-10 bg-[#f5f1eb] px-2 py-2 font-semibold text-[#1a4d2e]">Week of</th>
                {data.calendar.columns.map((c) => (
                  <th key={c} className="min-w-[100px] px-2 py-2 font-semibold text-[#1a4d2e]">
                    <span className="line-clamp-2">{c}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.calendar.weekStarts.map((w, wi) => (
                <tr key={w} className="border-b border-[#1a4d2e]/10">
                  <td className="sticky left-0 z-10 bg-white px-2 py-2 font-medium text-[#1a4d2e]">{w}</td>
                  {data.calendar.columns.map((c, ci) => {
                    const cell = data.calendar.cells[wi]?.[ci];
                    if (!cell) return <td key={c} className="px-2 py-2" />;
                    const ring =
                      cell.tone === "red"
                        ? "ring-2 ring-red-400/80"
                        : cell.tone === "amber"
                          ? "ring-2 ring-amber-400/70"
                          : "ring-1 ring-emerald-200/80";
                    return (
                      <td key={c} className="px-2 py-2 align-top">
                        <div
                          className={`rounded-lg bg-white/90 p-2 shadow-sm ${ring}`}
                        >
                          <div className="mb-1 flex items-center gap-2">
                            <span
                              className={`flex size-7 items-center justify-center rounded-full text-xs font-bold ${
                                cell.tone === "red"
                                  ? "bg-red-500 text-white"
                                  : cell.tone === "amber"
                                    ? "bg-amber-500 text-white"
                                    : "bg-emerald-600 text-white"
                              }`}
                            >
                              {cell.count}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {cell.firstNames.map((n, idx) => (
                              <span
                                key={`${wi}-${ci}-${idx}-${n}`}
                                className="rounded-full bg-[#e8f5e9] px-2 py-0.5 text-[11px] font-medium text-[#1a4d2e]"
                              >
                                {n}
                              </span>
                            ))}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-[#1a4d2e]/60">
          Green: under weekly cap · Amber: at cap · Red: over cap (journeys that week vs cap).
        </p>
      </div>

      {data.flags.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-amber-950">Flags</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm text-amber-950/90">
              {data.flags.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: number }) {
  return (
    <Card className="border-[#1a4d2e]/15 bg-white/90 shadow-sm">
      <CardHeader className="pb-1 pt-4">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-[#1a4d2e]/65">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <p className="text-3xl font-semibold tabular-nums text-[#1a4d2e]">{value}</p>
      </CardContent>
    </Card>
  );
}

function FacilitatorCard({
  row,
}: {
  row: CapacitySnapshot["facilitators"][number];
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(row.weekCap));
  const [localErr, setLocalErr] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) setDraft(String(row.weekCap));
  }, [row.weekCap, editing]);

  const mut = useMutation({
    mutationFn: async (weekCap: number) => {
      return apiFetch<{ facilitator_name: string; week_cap: number; updated_at: string }>(
        `/api/facilitators/${encodeURIComponent(row.name)}/cap`,
        { method: "PATCH", body: { weekCap } },
      );
    },
    onSuccess: () => {
      setEditing(false);
      setLocalErr(null);
      void queryClient.invalidateQueries({ queryKey: ["capacity"] });
    },
    onError: (e: unknown) => {
      setLocalErr(e instanceof ApiError ? e.message : "Save failed");
    },
  });

  const save = () => {
    setLocalErr(null);
    const n = Number.parseInt(draft, 10);
    if (!Number.isInteger(n) || n < 1 || n > 10) {
      setLocalErr("Cap must be a whole number from 1 to 10.");
      return;
    }
    mut.mutate(n);
  };

  return (
    <Card className="border-[#1a4d2e]/15 bg-white/95 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
        <div>
          <CardTitle className="text-base text-[#1a4d2e]">{row.name}</CardTitle>
          <span
            className={`mt-2 inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${BADGE_CLASS[row.badge]}`}
          >
            {BADGE_LABEL[row.badge]}
          </span>
        </div>
        {!editing ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-[#1a4d2e]"
            aria-label={`Edit weekly cap for ${row.name}`}
            onClick={() => {
              setDraft(String(row.weekCap));
              setEditing(true);
              setLocalErr(null);
            }}
          >
            <Pencil className="size-4" />
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-[#1a4d2e]/85">
        {editing ? (
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#1a4d2e]/70">Weekly cap</label>
              <Input
                type="number"
                min={1}
                max={10}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="h-9 w-24"
              />
            </div>
            <Button type="button" size="sm" onClick={save} disabled={mut.isPending}>
              {mut.isPending ? "Saving…" : "Save"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setEditing(false);
                setDraft(String(row.weekCap));
                setLocalErr(null);
              }}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <p>
            <span className="font-medium text-[#1a4d2e]">Weekly cap:</span> {row.weekCap}
          </p>
        )}
        {localErr ? <p className="text-sm text-red-700">{localErr}</p> : null}
        <p>
          <span className="font-medium text-[#1a4d2e]">Active pre-journey:</span> {row.activePreJourney}
        </p>
        <p>
          <span className="font-medium text-[#1a4d2e]">Upcoming journeys:</span> {row.upcomingJourneys}
        </p>
        <p>
          <span className="font-medium text-[#1a4d2e]">Next journey:</span>{" "}
          {row.nextJourneyYmd ?? "—"}
        </p>
      </CardContent>
    </Card>
  );
}
