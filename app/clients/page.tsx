"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Client, ClientCache } from "@/lib/types";
import ClientDrawer from "@/components/client-drawer";
import Nav from "@/components/nav";
import { toast } from "sonner";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type SortKey =
  | "stage_order"
  | "name"
  | "email"
  | "hi_status"
  | "chart_status"
  | "prep1"
  | "journey";
type SortDir = "asc" | "desc";
type StageGroup = "all" | "onboarding" | "prep" | "journey" | "integration" | "done";
type HiFilter = "all" | "Reviewed" | "Signed" | "Sent" | "None";

function sortClients(
  clients: Client[],
  key: SortKey,
  dir: SortDir,
): Client[] {
  const sorted = [...clients];
  const m = dir === "asc" ? 1 : -1;
  sorted.sort((a, b) => {
    switch (key) {
      case "stage_order":
        return (a.stage_order - b.stage_order) * m;
      case "name":
        return a.name.localeCompare(b.name) * m;
      case "email":
        return a.email.localeCompare(b.email) * m;
      case "hi_status":
        return (a.hi_status || "").localeCompare(b.hi_status || "") * m;
      case "chart_status":
        return (a.chart_status || "").localeCompare(b.chart_status || "") * m;
      case "prep1":
        return ((a.prep1 || "9999") > (b.prep1 || "9999") ? 1 : -1) * m;
      case "journey":
        return ((a.journey || "9999") > (b.journey || "9999") ? 1 : -1) * m;
      default:
        return 0;
    }
  });
  return sorted;
}

function fmtShortDate(d: string): string {
  if (!d) return "";
  try {
    const dt = new Date(d + "T00:00:00");
    return `${dt.getMonth() + 1}/${dt.getDate()}`;
  } catch {
    return d;
  }
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

const stageGroupColors: Record<string, string> = {
  onboarding: "bg-amber-50 text-amber-700",
  prep: "bg-blue-50 text-blue-700",
  journey: "bg-purple-50 text-purple-700",
  integration: "bg-teal-50 text-teal-700",
  done: "bg-gray-50 text-gray-500",
};

export default function ClientsPage() {
  const [search, setSearch] = useState("");
  const [stageGroup, setStageGroup] = useState<StageGroup>("all");
  const [hiFilter, setHiFilter] = useState<HiFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("stage_order");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: () => apiFetch<ClientCache>("/api/clients"),
  });

  const syncMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ success: boolean; message?: string }>(
        "/api/clients/sync",
        { method: "POST" },
      ),
    onSuccess: (res) => {
      toast.success(res.message || "Client sync complete");
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e) => toast.error("Sync failed: " + e.message),
  });

  const clients = data?.clients ?? [];
  const lastSynced = data?.last_synced ?? null;

  const filtered = useMemo(() => {
    let result = clients;

    // Search filter
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.facilitator.toLowerCase().includes(q),
      );
    }

    // Stage group filter
    if (stageGroup !== "all") {
      result = result.filter((c) => c.stage_group === stageGroup);
    }

    // HI status filter
    if (hiFilter !== "all") {
      result = result.filter((c) => c.hi_status === hiFilter);
    }

    return result;
  }, [clients, search, stageGroup, hiFilter]);

  const sorted = useMemo(
    () => sortClients(filtered, sortKey, sortDir),
    [filtered, sortKey, sortDir],
  );

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="text-[#c0c5cb] ml-0.5">{"\u2195"}</span>;
    return <span className="ml-0.5">{sortDir === "asc" ? "\u2191" : "\u2193"}</span>;
  }

  return (
    <div className="min-h-screen bg-[#f5f1eb]">
      <Nav subtitle="Client List" sticky>
        <Link
          href="/intakes"
          className="px-3.5 py-[7px] rounded-[6px] text-[13px] font-semibold bg-[#1a4d2e] text-white border border-white/20 hover:bg-[#2d7a4a] transition-all duration-150 no-underline"
        >
          Intakes
        </Link>
        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="
            px-3.5 py-[7px] rounded-[6px] text-[13px] font-semibold
            bg-[#1a4d2e] text-white border border-white/20
            hover:bg-[#2d7a4a] transition-all duration-150
            disabled:opacity-50 disabled:cursor-not-allowed
            flex items-center gap-1.5
          "
        >
          {syncMutation.isPending ? (
            <>
              <Spinner /> Syncing...
            </>
          ) : (
            "Sync GHL"
          )}
        </button>
        {lastSynced && (
          <div className="flex items-center gap-2 text-[13px] text-white/85">
            <span className="w-2 h-2 bg-[#2ecc71] rounded-full animate-pulse" />
            <span>Synced {formatTimestamp(lastSynced)}</span>
          </div>
        )}
      </Nav>

      {/* Filters */}
      <main className="max-w-[1600px] mx-auto px-6 md:px-8 py-6">
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <input
            type="text"
            placeholder="Search name, email, facilitator..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="
              px-3.5 py-2 rounded-[6px] bg-white border border-[#e8e2d8]
              text-[13px] text-[#2c3e50] w-72
              focus:outline-none focus:ring-2 focus:ring-[#2d7a4a]/30 focus:border-[#2d7a4a]
              placeholder:text-[#b0b8c0]
            "
          />
          <select
            value={stageGroup}
            onChange={(e) => setStageGroup(e.target.value as StageGroup)}
            className="
              px-3.5 py-2 rounded-[6px] bg-white border border-[#e8e2d8]
              text-[13px] text-[#2c3e50] cursor-pointer
              focus:outline-none focus:ring-2 focus:ring-[#2d7a4a]/30 focus:border-[#2d7a4a]
            "
          >
            <option value="all">All Stages</option>
            <option value="onboarding">Onboarding</option>
            <option value="prep">Prep</option>
            <option value="journey">Journey</option>
            <option value="integration">Integration</option>
            <option value="done">Done</option>
          </select>
          <select
            value={hiFilter}
            onChange={(e) => setHiFilter(e.target.value as HiFilter)}
            className="
              px-3.5 py-2 rounded-[6px] bg-white border border-[#e8e2d8]
              text-[13px] text-[#2c3e50] cursor-pointer
              focus:outline-none focus:ring-2 focus:ring-[#2d7a4a]/30 focus:border-[#2d7a4a]
            "
          >
            <option value="all">All HI Status</option>
            <option value="Reviewed">Reviewed</option>
            <option value="Signed">Signed</option>
            <option value="Sent">Sent</option>
            <option value="None">None</option>
          </select>
          <div className="ml-auto text-[13px] text-[#7f8c8d]">
            {sorted.length} client{sorted.length !== 1 && "s"}
            {clients.length !== sorted.length && ` of ${clients.length}`}
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="text-center py-10 text-[#7f8c8d]">
            Loading clients...
          </div>
        ) : clients.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4 opacity-40">🌿</div>
            <h3 className="text-lg font-semibold text-[#2c3e50] mb-2">
              No clients yet
            </h3>
            <p className="text-[13px] text-[#7f8c8d] max-w-sm mx-auto">
              Click &ldquo;Sync GHL&rdquo; to pull client data from
              GoHighLevel. This may take 1-2 minutes.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-[#e8e2d8] bg-white overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#f9f7f4] hover:bg-[#f9f7f4]">
                  <TableHead className="w-10 text-center text-[11px]">#</TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort("name")} className="flex items-center text-[11px] font-semibold uppercase tracking-wide hover:text-[#1a4d2e]">
                      Name <SortIcon col="name" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort("stage_order")} className="flex items-center text-[11px] font-semibold uppercase tracking-wide hover:text-[#1a4d2e]">
                      Stage <SortIcon col="stage_order" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort("email")} className="flex items-center text-[11px] font-semibold uppercase tracking-wide hover:text-[#1a4d2e]">
                      Email <SortIcon col="email" />
                    </button>
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide">Phone</TableHead>
                  <TableHead className="text-center">
                    <button onClick={() => toggleSort("prep1")} className="flex items-center justify-center text-[11px] font-semibold uppercase tracking-wide hover:text-[#1a4d2e]">
                      P1 <SortIcon col="prep1" />
                    </button>
                  </TableHead>
                  <TableHead className="text-center text-[11px] font-semibold uppercase tracking-wide">P2</TableHead>
                  <TableHead className="text-center text-[11px] font-semibold uppercase tracking-wide">IP-P</TableHead>
                  <TableHead className="text-center">
                    <button onClick={() => toggleSort("journey")} className="flex items-center justify-center text-[11px] font-semibold uppercase tracking-wide hover:text-[#1a4d2e]">
                      Jrny <SortIcon col="journey" />
                    </button>
                  </TableHead>
                  <TableHead className="text-center text-[11px] font-semibold uppercase tracking-wide">IP-I</TableHead>
                  <TableHead className="text-center text-[11px] font-semibold uppercase tracking-wide">I1</TableHead>
                  <TableHead className="text-center text-[11px] font-semibold uppercase tracking-wide">I2</TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort("hi_status")} className="flex items-center text-[11px] font-semibold uppercase tracking-wide hover:text-[#1a4d2e]">
                      HI <SortIcon col="hi_status" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort("chart_status")} className="flex items-center text-[11px] font-semibold uppercase tracking-wide hover:text-[#1a4d2e]">
                      Chart <SortIcon col="chart_status" />
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((client, i) => (
                  <TableRow
                    key={client.opp_id}
                    onClick={() => setSelectedClient(client)}
                    className="cursor-pointer hover:bg-[#f5f1eb]/60 transition-colors"
                  >
                    <TableCell className="text-center text-[12px] text-[#b0b8c0]">
                      {i + 1}
                    </TableCell>
                    <TableCell>
                      <div className="text-[13px] font-medium text-[#2c3e50]">
                        {client.name}
                      </div>
                      {client.facilitator && (
                        <div className="text-[11px] text-[#7f8c8d]">
                          {client.facilitator}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${stageGroupColors[client.stage_group] || ""}`}
                      >
                        {client.stage_name}
                      </span>
                    </TableCell>
                    <TableCell className="text-[12px] text-[#5a6c7d] max-w-[180px] truncate">
                      {client.email}
                    </TableCell>
                    <TableCell className="text-[12px] text-[#5a6c7d] whitespace-nowrap">
                      {client.phone}
                    </TableCell>
                    <TableCell className="text-center text-[12px] text-[#5a6c7d]">
                      {fmtShortDate(client.prep1)}
                    </TableCell>
                    <TableCell className="text-center text-[12px] text-[#5a6c7d]">
                      {fmtShortDate(client.prep2)}
                    </TableCell>
                    <TableCell className="text-center text-[12px] text-[#5a6c7d]">
                      {fmtShortDate(client.ip_prep)}
                    </TableCell>
                    <TableCell className="text-center text-[12px] text-[#5a6c7d]">
                      {fmtShortDate(client.journey)}
                    </TableCell>
                    <TableCell className="text-center text-[12px] text-[#5a6c7d]">
                      {fmtShortDate(client.ip_integ)}
                    </TableCell>
                    <TableCell className="text-center text-[12px] text-[#5a6c7d]">
                      {fmtShortDate(client.integ1)}
                    </TableCell>
                    <TableCell className="text-center text-[12px] text-[#5a6c7d]">
                      {fmtShortDate(client.integ2)}
                    </TableCell>
                    <TableCell className="text-[12px] text-[#5a6c7d]">
                      {client.hi_status}
                    </TableCell>
                    <TableCell className="text-[12px] text-[#5a6c7d]">
                      {client.chart_status}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>

      {/* Detail Drawer */}
      <ClientDrawer
        client={selectedClient}
        open={!!selectedClient}
        onClose={() => setSelectedClient(null)}
      />
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
