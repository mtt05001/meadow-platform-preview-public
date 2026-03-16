"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Intake } from "@/lib/types";
import IntakeCard from "@/components/intake-card";
import Nav from "@/components/nav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const PAGE_SIZE = 50;

/** Sort by prep 1 date, latest to earliest. No prep1 goes to the end. */
function sortByPrep1(intakes: Intake[]): Intake[] {
  return [...intakes].sort((a, b) => {
    if (!a.prep1_date && !b.prep1_date) return 0;
    if (!a.prep1_date) return 1;
    if (!b.prep1_date) return -1;
    return new Date(b.prep1_date).getTime() - new Date(a.prep1_date).getTime();
  });
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
  const queryClient = useQueryClient();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

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

  const sorted = sortByPrep1(intakes);
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
      <Nav sticky>
        <button
          onClick={() => syncGhl.mutate()}
          disabled={syncGhl.isPending}
          className="
            px-3.5 py-[7px] rounded-[6px] text-[13px] font-semibold
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
            px-3.5 py-[7px] rounded-[6px] text-[13px] font-semibold
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
        {lastUpdated && (
          <div className="flex items-center gap-2 text-[13px] text-white/85">
            <span className="w-2 h-2 bg-[#2ecc71] rounded-full animate-pulse" />
            <span>Updated {formatTimestamp(lastUpdated)}</span>
          </div>
        )}
      </Nav>

      {/* Content */}
      <main className="max-w-[1400px] mx-auto px-6 md:px-8 py-6">
        {/* Header row */}
        <div className="mb-6">
          <h2 className="text-[24px] font-semibold text-[#1a4d2e]">
            Review Queue
          </h2>
        </div>

        {isLoading ? (
          <div className="text-center py-10 text-[#7f8c8d]">
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
          <Tabs defaultValue="needs-review" className="gap-4">
            <TabsList variant="line" className="gap-0">
              <TabsTrigger value="needs-review" className="text-[15px] px-4 py-2">
                Needs Review ({needsReview.length})
              </TabsTrigger>
              <TabsTrigger value="completed" className="text-[15px] px-4 py-2">
                Completed ({reviewed.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="needs-review">
              {needsReview.length > 0 ? (
                <>
                  <div className="space-y-4">
                    {needsReview.slice(0, visibleCount).map((intake) => (
                      <IntakeCard
                        key={intake.id}
                        intake={intake}
                      />
                    ))}
                  </div>
                  {visibleCount < needsReview.length && (
                    <div className="flex items-center justify-center gap-3 mt-5">
                      <span className="text-[13px] text-[#7f8c8d]">
                        Showing {Math.min(visibleCount, needsReview.length)} of {needsReview.length}
                      </span>
                      <button
                        onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                        className="
                          px-4 py-2 rounded-[6px] text-[13px] font-semibold
                          bg-white border border-[#e8e2d8] text-[#2c3e50]
                          hover:bg-[#f5f1eb] transition-colors cursor-pointer
                        "
                      >
                        Show more
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="py-6 text-center text-[#7f8c8d] italic">
                  No pending reviews 🎉
                </div>
              )}
            </TabsContent>

            <TabsContent value="completed">
              {reviewed.length > 0 ? (
                <div className="space-y-4">
                  {reviewed.map((intake) => (
                    <IntakeCard key={intake.id} intake={intake} />
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-[#7f8c8d] italic">
                  No completed reviews yet
                </div>
              )}
            </TabsContent>
          </Tabs>
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
