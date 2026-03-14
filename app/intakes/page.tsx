"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Intake } from "@/lib/types";
import IntakeCard from "@/components/intake-card";
import { toast } from "sonner";

type SortKey = "submitted" | "risk" | "prep1";

const riskOrder: Record<string, number> = {
  red: 0,
  yellow: 1,
  green: 2,
  unknown: 3,
};

function sortIntakes(intakes: Intake[], key: SortKey): Intake[] {
  const sorted = [...intakes];
  switch (key) {
    case "risk":
      sorted.sort(
        (a, b) =>
          (riskOrder[a.risk_tier] ?? 3) - (riskOrder[b.risk_tier] ?? 3),
      );
      break;
    case "prep1":
      sorted.sort((a, b) => {
        if (!a.prep1_date && !b.prep1_date) return 0;
        if (!a.prep1_date) return 1;
        if (!b.prep1_date) return -1;
        return (
          new Date(a.prep1_date).getTime() - new Date(b.prep1_date).getTime()
        );
      });
      break;
    default:
      sorted.sort(
        (a, b) =>
          new Date(b.submitted_at || b.created_at || "").getTime() -
          new Date(a.submitted_at || a.created_at || "").getTime(),
      );
  }
  return sorted;
}

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return ts;
  }
}

export default function IntakesPage() {
  const [sortKey, setSortKey] = useState<SortKey>("submitted");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["intakes"],
    queryFn: () =>
      apiFetch<{ intakes: Intake[]; last_updated: string | null }>(
        "/api/intakes",
      ),
  });

  const intakes = data?.intakes ?? [];
  const lastUpdated = data?.last_updated ?? null;

  const syncJotform = useMutation({
    mutationFn: () =>
      apiFetch<{ success: boolean; message?: string }>(
        "/api/intakes/sync-jotform",
        { method: "POST" },
      ),
    onSuccess: (res) => {
      toast.success(res.message || "Sync complete");
      queryClient.invalidateQueries({ queryKey: ["intakes"] });
    },
    onError: (e) => toast.error("Sync failed: " + e.message),
  });

  const syncGhl = useMutation({
    mutationFn: () =>
      apiFetch<{ success: boolean; message?: string }>(
        "/api/intakes/sync-ghl",
        { method: "POST" },
      ),
    onSuccess: (res) => {
      toast.success(res.message || "GHL sync complete");
      queryClient.invalidateQueries({ queryKey: ["intakes"] });
    },
    onError: (e) => toast.error("GHL sync failed: " + e.message),
  });

  const sorted = sortIntakes(intakes, sortKey);
  const needsReview = sorted.filter((i) => i.status === "pending" || i.status === "sending");
  // Completed always sorted by date submitted (newest first) like original
  const reviewed = sorted
    .filter((i) => i.status !== "pending" && i.status !== "sending")
    .sort(
      (a, b) =>
        new Date(b.submitted_at || "").getTime() -
        new Date(a.submitted_at || "").getTime(),
    );

  return (
    <div className="min-h-screen bg-[#f5f1eb]">
      {/* Nav */}
      <nav className="sticky top-0 z-40 bg-[#1a4d2e] shadow-[0_2px_12px_rgba(0,0,0,0.15)]">
        <div className="max-w-[1400px] mx-auto px-6 md:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-[28px] leading-none select-none" aria-hidden>
              🌿
            </div>
            <div>
              <h1 className="text-white text-[20px] font-semibold tracking-[0.5px] leading-tight">
                Meadow Medicine
              </h1>
              <p className="text-white/70 text-[13px] italic font-serif">
                Health Intake Review Platform
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => syncGhl.mutate()}
              disabled={syncGhl.isPending}
              className="
                px-3.5 py-[7px] rounded-[6px] text-[13px] font-semibold font-serif
                bg-[#1a4d2e] text-white border border-white/20
                hover:bg-[#2d7a4a] transition-all duration-150
                disabled:opacity-50 disabled:cursor-not-allowed
                flex items-center gap-1.5
              "
            >
              {syncGhl.isPending ? (
                <>
                  <Spinner /> Syncing...
                </>
              ) : (
                "🔄 Sync GHL"
              )}
            </button>
            <button
              onClick={() => syncJotform.mutate()}
              disabled={syncJotform.isPending}
              className="
                px-3.5 py-[7px] rounded-[6px] text-[13px] font-semibold font-serif
                bg-[#1a4d2e] text-white border border-white/20
                hover:bg-[#2d7a4a] transition-all duration-150
                disabled:opacity-50 disabled:cursor-not-allowed
                flex items-center gap-1.5
              "
            >
              {syncJotform.isPending ? (
                <>
                  <Spinner /> Syncing...
                </>
              ) : (
                "🔄 Refresh"
              )}
            </button>
            {/* Timestamp with live dot */}
            {lastUpdated && (
              <div className="flex items-center gap-2 text-[13px] text-white/85 font-sans">
                <span className="w-2 h-2 bg-[#2ecc71] rounded-full animate-pulse" />
                <span>Updated {formatTimestamp(lastUpdated)}</span>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-[1400px] mx-auto px-6 md:px-8 py-6">
        {/* Header row */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[24px] font-semibold text-[#1a4d2e]">
            Review Queue
          </h2>
          <select
            id="sort-select"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="
              px-3.5 py-2 rounded-[6px] bg-white border border-[#e8e2d8]
              text-[13px] text-[#2c3e50] cursor-pointer
              focus:outline-none focus:ring-2 focus:ring-[#2d7a4a]/30 focus:border-[#2d7a4a]
            "
          >
            <option value="submitted">Date Submitted</option>
            <option value="risk">Risk Tier</option>
            <option value="prep1">Prep 1 Date</option>
          </select>
        </div>

        {isLoading ? (
          <div className="text-center py-10 text-[#7f8c8d] font-serif">
            Loading intakes...
          </div>
        ) : intakes.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4 opacity-40">🌿</div>
            <h3 className="text-lg font-semibold text-[#2c3e50] mb-2">
              No intakes yet
            </h3>
            <p className="text-[13px] text-[#7f8c8d] max-w-sm mx-auto">
              Click &ldquo;Refresh&rdquo; to pull new health intake submissions
              from Jotform.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Needs Review — always shown */}
            <section>
              <div className="mb-2 pb-2.5 border-b-2 border-[#1a4d2e] flex items-center justify-between">
                <h3 className="text-[16px] font-semibold text-[#1a4d2e]">
                  📋 Needs Review ({needsReview.length})
                </h3>
              </div>
              {needsReview.length > 0 ? (
                <div className="space-y-4">
                  {needsReview.map((intake) => (
                    <IntakeCard
                      key={intake.id}
                      intake={intake}
                    />
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-[#7f8c8d] italic font-serif">
                  No pending reviews 🎉
                </div>
              )}
            </section>

            {/* Review Complete — always shown */}
            <section>
              <div className="mb-2 pb-2.5 border-b-2 border-[#e8e2d8] flex items-center">
                <h3 className="text-[16px] font-semibold text-[#7f8c8d]">
                  ✅ Review Complete ({reviewed.length})
                </h3>
              </div>
              {reviewed.length > 0 ? (
                <div className="space-y-4">
                  {reviewed.map((intake) => (
                    <IntakeCard key={intake.id} intake={intake} />
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-[#7f8c8d] italic font-serif">
                  No completed reviews yet
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="w-3.5 h-3.5 animate-spin"
      viewBox="0 0 16 16"
      fill="none"
    >
      <circle
        cx="8"
        cy="8"
        r="6"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.3"
      />
      <path
        d="M14 8a6 6 0 0 0-6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
