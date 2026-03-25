"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Intake } from "@/lib/types";

function useDebouncedValue(value: string, ms = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}
import IntakeCard from "@/components/intake-card";
import Nav from "@/components/nav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const PAGE_SIZE = 50;

/** Sort by prep 1 date, earliest to latest. No prep1 goes to the end. */
function sortByPrep1(intakes: Intake[]): Intake[] {
  return [...intakes].sort((a, b) => {
    if (!a.prep1_date && !b.prep1_date) return 0;
    if (!a.prep1_date) return 1;
    if (!b.prep1_date) return -1;
    return new Date(a.prep1_date).getTime() - new Date(b.prep1_date).getTime();
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
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);

  const { data, isLoading } = useQuery({
    queryKey: ["intakes", debouncedSearch],
    queryFn: () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      const qs = params.toString();
      return apiFetch<{ intakes: Intake[]; last_updated: string | null }>(
        `/api/intakes${qs ? `?${qs}` : ""}`,
      );
    },
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

  // Auto-sync GHL data on page load
  const didAutoSync = useRef(false);
  const [ghlSyncing, setGhlSyncing] = useState(false);
  useEffect(() => {
    if (didAutoSync.current) return;
    didAutoSync.current = true;
    setGhlSyncing(true);
    apiFetch("/api/intakes/sync-ghl", { method: "POST" })
      .then(() => queryClient.invalidateQueries({ queryKey: ["intakes"] }))
      .catch(() => {})
      .finally(() => setGhlSyncing(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      <Nav sticky />

      {/* Content */}
      <main className="max-w-[1400px] mx-auto px-6 md:px-8 py-6">
        {/* Header row */}
        <div className="mb-6 flex items-center gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-[24px] font-semibold text-[#1a4d2e]">
              Review Queue
            </h2>
            {ghlSyncing ? (
              <div className="flex items-center gap-1.5 text-[12px] text-[#7f8c8d]">
                <Spinner />
                <span>Syncing GHL…</span>
              </div>
            ) : lastUpdated ? (
              <div className="flex items-center gap-1.5 text-[12px] text-[#7f8c8d]">
                <span className="w-1.5 h-1.5 bg-[#2ecc71] rounded-full animate-pulse" />
                <span>Updated {formatTimestamp(lastUpdated)}</span>
              </div>
            ) : null}
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search by name..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
              className="
                px-3 py-2 rounded-[6px] border border-[#e8e2d8] bg-white
                text-[14px] text-[#2c3e50] placeholder:text-[#b8bfc6]
                w-[220px] focus:outline-none focus:border-[#1a4d2e]
                transition-colors
              "
            />
            <div className="w-px h-6 bg-[#e0d9ce]" />
            <button
              onClick={() => syncJotform.mutate()}
              disabled={syncJotform.isPending}
              title="Check Jotform for new health intake submissions"
              className="
                px-3 py-2 rounded-[6px] text-[13px] font-medium
                bg-white border border-[#e0d9ce] text-[#2c3e50]
                hover:bg-[#f5f1eb] transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
                flex items-center gap-1.5
              "
            >
              {syncJotform.isPending ? <Spinner /> : <RefreshIcon />}
              Fetch New Forms
            </button>
          </div>
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
    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.3" />
      <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13.5 6.5H9.5" />
      <path d="M13.5 6.5V2.5" />
      <path d="M13.5 6.5L10.2 3.2A5.5 5.5 0 1 0 13 10.5" />
    </svg>
  );
}
