"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Intake, Client } from "@/lib/types";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ── Shared helpers ───────────────────────────────────────────────────

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  pending: { label: "Pending Review", bg: "bg-[#fff8e1]", text: "text-[#8a6d00]" },
  sending: { label: "Sending...", bg: "bg-[#e3f0ff]", text: "text-[#1a5ea0]" },
  approved: { label: "Approved", bg: "bg-[#eafaf1]", text: "text-[#1a7a42]" },
  archived: { label: "Archived", bg: "bg-[#e8edf5]", text: "text-[#4a6080]" },
  rejected: { label: "Rejected", bg: "bg-[#fdeaea]", text: "text-[#c0392b]" },
};

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return dateStr;
  }
}

function utcToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function isOverdue(prep1Date: string | null | undefined): boolean {
  if (!prep1Date) return false;
  return new Date(prep1Date) < utcToday();
}

function isDueSoon(prep1Date: string | null | undefined): boolean {
  if (!prep1Date) return false;
  const d = new Date(prep1Date);
  const today = utcToday();
  const inThreeDays = new Date(today);
  inThreeDays.setDate(inThreeDays.getDate() + 3);
  return d >= today && d <= inThreeDays;
}

// ── Small UI pieces ──────────────────────────────────────────────────

function SmallTag({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-px text-[10px] font-semibold tracking-wide uppercase ${className}`}>
      {children}
    </span>
  );
}

function ArchiveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="5" rx="1" />
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
      <path d="M10 12h4" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  );
}

function ViewIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

// ── Helpers to normalize Intake | Client into common shape ───────────

type CardData = {
  id: string;
  name: string;
  email: string;
  facilitator: string | null;
  prep1: string | null;
  prep2: string | null;
  journey: string | null;
  submittedAt: string | null;
  status: string;
  stageName: string | null;
  href: string | undefined;
  borderColor: string;
  isPending: boolean;
  isCompleted: boolean;
  isOnboarding: boolean;
};

function fromIntake(intake: Intake): CardData {
  const isPending = intake.status === "pending" || intake.status === "sending";
  const isCompleted = intake.status === "approved" || intake.status === "rejected" || intake.status === "archived";
  return {
    id: intake.id,
    name: intake.name || "Unknown",
    email: intake.email,
    facilitator: intake.facilitator,
    prep1: intake.prep1_date,
    prep2: null,
    journey: null,
    submittedAt: intake.submitted_at,
    status: intake.status,
    stageName: null,
    href: `/intakes/${intake.id}`,
    borderColor: isPending ? "border-l-[#27ae60]" : "border-l-[#bbb]",
    isPending,
    isCompleted,
    isOnboarding: false,
  };
}

function fromClient(client: Client): CardData {
  const href = client.intake_id ? `/intakes/${client.intake_id}/readonly` : undefined;
  return {
    id: client.opp_id,
    name: client.name,
    email: client.email,
    facilitator: client.facilitator || null,
    prep1: client.prep1 || null,
    prep2: client.prep2 || null,
    journey: client.journey || null,
    submittedAt: null,
    status: "",
    stageName: client.stage_name || null,
    href,
    borderColor: "border-l-[#3498db]",
    isPending: false,
    isCompleted: false,
    isOnboarding: true,
  };
}

// ── Main component ───────────────────────────────────────────────────

type QueueCardProps =
  | { intake: Intake; client?: never }
  | { client: Client; intake?: never };

export default function QueueCard(props: QueueCardProps) {
  const data = props.intake ? fromIntake(props.intake) : fromClient(props.client);
  const [confirmAction, setConfirmAction] = useState<"archive" | "delete" | null>(null);
  const queryClient = useQueryClient();
  const router = useRouter();
  const status = statusConfig[data.status];

  const actionMutation = useMutation({
    mutationFn: (action: "archive" | "delete") =>
      apiFetch<{ success: boolean }>(`/api/intakes/${data.id}/actions`, {
        method: "POST",
        body: { action },
      }),
    onSuccess: (_, action) => {
      toast.success(action === "archive" ? "Intake archived" : "Intake deleted");
      queryClient.invalidateQueries({ queryKey: ["intakes"] });
    },
    onError: (e, action) => toast.error(`${action} failed: ${e.message}`),
    onSettled: () => setConfirmAction(null),
  });

  const card = (
    <div
      className={`
        relative bg-white rounded-[10px] border border-transparent
        border-l-[5px] ${data.borderColor}
        px-6 py-5 transition-all duration-200
        shadow-[0_2px_8px_rgba(0,0,0,0.08)]
        ${data.href ? "hover:shadow-[0_4px_16px_rgba(0,0,0,0.12)] hover:-translate-y-[2px]" : ""}
      `}
    >
      <div className="flex items-center gap-5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="text-[18px] font-semibold text-[#2c3e50] truncate">
              {data.name}
            </h3>
            {data.facilitator && (
              <SmallTag className="bg-[#dce9da] text-[#3a5c38]">
                👤 {data.facilitator}
              </SmallTag>
            )}
            {data.stageName && (
              <SmallTag className="bg-[#e3f0ff] text-[#1a5ea0]">
                {data.stageName}
              </SmallTag>
            )}
            {data.isPending && isOverdue(data.prep1) && (
              <SmallTag className="bg-[#fef3cd] text-[#856404]">
                ⚠️ Overdue
              </SmallTag>
            )}
            {data.isPending && isDueSoon(data.prep1) && (
              <SmallTag className="bg-[#fff3e0] text-[#e65100]">
                🕐 Due Soon
              </SmallTag>
            )}
            {data.isPending && !data.prep1 && (
              <SmallTag className="bg-[#fde8e8] text-[#c0392b]">
                🔴 No Prep 1
              </SmallTag>
            )}
          </div>

          <p className="text-[13px] text-[#7f8c8d]">
            {data.submittedAt ? formatDate(data.submittedAt) : ""}
            {data.email && (
              <span>{data.submittedAt ? " · " : ""}{data.email}</span>
            )}
            {data.prep1 && <span> · Prep 1: {formatDate(data.prep1)}</span>}
            {data.prep2 && <span> · Prep 2: {formatDate(data.prep2)}</span>}
            {data.journey && <span> · Journey: {formatDate(data.journey)}</span>}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {status && (
            <span className={`rounded-full px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.5px] ${status.bg} ${status.text}`}>
              {status.label}
            </span>
          )}

          {data.isPending && (
            <div className="flex items-center gap-0.5 ml-1">
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmAction("archive"); }}
                className="flex items-center justify-center w-7 h-7 rounded-md text-[#b8bfc6] hover:text-[#4a6080] hover:bg-[#f0ede8] transition-colors cursor-pointer border-none bg-transparent"
                title="Archive"
              >
                <ArchiveIcon />
              </button>
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmAction("delete"); }}
                className="flex items-center justify-center w-7 h-7 rounded-md text-[#b8bfc6] hover:text-[#c0392b] hover:bg-[#fef2f2] transition-colors cursor-pointer border-none bg-transparent"
                title="Delete"
              >
                <TrashIcon />
              </button>
            </div>
          )}
          {data.isCompleted && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/intakes/${data.id}?view=readonly`); }}
              className="flex items-center justify-center w-7 h-7 rounded-md ml-1 text-[#b8bfc6] hover:text-[#4a6080] hover:bg-[#f0ede8] transition-colors cursor-pointer border-none bg-transparent"
              title="View only"
            >
              <ViewIcon />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative">
      {data.href ? (
        <Link href={data.href} prefetch={false} className="block">
          {card}
        </Link>
      ) : (
        card
      )}

      {/* Confirmation dialog — only relevant for intake cards */}
      {props.intake && (
        <AlertDialog open={confirmAction !== null} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmAction === "delete" ? "Delete intake" : "Archive intake"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmAction === "delete"
                  ? `Permanently delete ${data.name}? This cannot be undone.`
                  : `Archive ${data.name}? You can find it in the archived section later.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant={confirmAction === "delete" ? "destructive" : "default"}
                disabled={actionMutation.isPending}
                onClick={() => { if (confirmAction) actionMutation.mutate(confirmAction); }}
              >
                {actionMutation.isPending ? "..." : confirmAction === "delete" ? "Delete" : "Archive"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
