"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Intake } from "@/lib/types";

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

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  pending: { label: "Pending Review", bg: "bg-[#fff8e1]", text: "text-[#8a6d00]" },
  sending: { label: "Sending...", bg: "bg-[#e3f0ff]", text: "text-[#1a5ea0]" },
  approved: { label: "Approved", bg: "bg-[#eafaf1]", text: "text-[#1a7a42]" },
  archived: { label: "Archived", bg: "bg-[#e8edf5]", text: "text-[#4a6080]" },
  rejected: { label: "Rejected", bg: "bg-[#fdeaea]", text: "text-[#c0392b]" },
};

function formatDate(dateStr: string | null): string {
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

/** Get today's date as a UTC-midnight timestamp for comparing against date-only strings. */
function utcToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function isOverdue(prep1Date: string | null): boolean {
  if (!prep1Date) return false;
  const d = new Date(prep1Date);
  return d < utcToday();
}

function isDueSoon(prep1Date: string | null): boolean {
  if (!prep1Date) return false;
  const d = new Date(prep1Date);
  const today = utcToday();
  const inThreeDays = new Date(today);
  inThreeDays.setDate(inThreeDays.getDate() + 3);
  return d >= today && d <= inThreeDays;
}

function SmallTag({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-px text-[10px] font-semibold tracking-wide uppercase ${className}`}
    >
      {children}
    </span>
  );
}

/* ── Inline icon components (no emoji, clean SVG) ── */

function ArchiveIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="5" rx="1" />
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
      <path d="M10 12h4" />
    </svg>
  );
}

function TrashIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  );
}

export default function IntakeCard({
  intake,
}: {
  intake: Intake;
}) {
  const [confirmAction, setConfirmAction] = useState<"archive" | "delete" | null>(null);
  const queryClient = useQueryClient();
  const router = useRouter();
  const status = statusConfig[intake.status] || statusConfig.pending;
  const isPending = intake.status === "pending";
  const isCompleted = intake.status === "approved" || intake.status === "rejected" || intake.status === "archived";

  const borderColor = isPending ? "border-l-[#27ae60]" : "border-l-[#bbb]";

  const actionMutation = useMutation({
    mutationFn: (action: "archive" | "delete") =>
      apiFetch<{ success: boolean }>(`/api/intakes/${intake.id}/actions`, {
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

  return (
    <div className="relative">
      <Link href={`/intakes/${intake.id}`} prefetch={false} className="block">
        <div
          className={`
            relative bg-white rounded-[10px] border border-transparent
            border-l-[5px] ${borderColor}
            px-6 py-5 transition-all duration-200
            shadow-[0_2px_8px_rgba(0,0,0,0.08)]
            hover:shadow-[0_4px_16px_rgba(0,0,0,0.12)]
            hover:-translate-y-[2px]
          `}
        >
          <div className="flex items-center gap-5">
            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h3 className="text-[18px] font-semibold text-[#2c3e50] truncate">
                  {intake.name || "Unknown"}
                </h3>
                {intake.facilitator && (
                  <SmallTag className="bg-[#dce9da] text-[#3a5c38]">
                    👤 {intake.facilitator}
                  </SmallTag>
                )}
                {isPending && isOverdue(intake.prep1_date) && (
                  <SmallTag className="bg-[#fef3cd] text-[#856404]">
                    ⚠️ Overdue
                  </SmallTag>
                )}
                {isPending && isDueSoon(intake.prep1_date) && (
                  <SmallTag className="bg-[#fff3e0] text-[#e65100]">
                    🕐 Due Soon
                  </SmallTag>
                )}
                {isPending && !intake.prep1_date && (
                  <SmallTag className="bg-[#fde8e8] text-[#c0392b]">
                    🔴 No Prep 1
                  </SmallTag>
                )}
              </div>

              <p className="text-[13px] text-[#7f8c8d]">
                {intake.submitted_at ? formatDate(intake.submitted_at) : ""}
                {intake.email && (
                  <span> · {intake.email}</span>
                )}
                {intake.prep1_date && (
                  <span> · Prep 1: {formatDate(intake.prep1_date)}</span>
                )}
              </p>

            </div>

            {/* Right side: status + actions */}
            <div className="flex items-center gap-3 shrink-0">
              <span
                className={`
                  rounded-full px-3 py-1 text-[12px] font-semibold
                  uppercase tracking-[0.5px]
                  ${status.bg} ${status.text}
                `}
              >
                {status.label}
              </span>

              {/* Inline action buttons — always visible, muted */}
              {isPending && (
                <div className="flex items-center gap-0.5 ml-1">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setConfirmAction("archive");
                    }}
                    className="
                      flex items-center justify-center w-7 h-7 rounded-md
                      text-[#b8bfc6] hover:text-[#4a6080] hover:bg-[#f0ede8]
                      transition-colors cursor-pointer border-none bg-transparent
                    "
                    title="Archive"
                  >
                    <ArchiveIcon />
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setConfirmAction("delete");
                    }}
                    className="
                      flex items-center justify-center w-7 h-7 rounded-md
                      text-[#b8bfc6] hover:text-[#c0392b] hover:bg-[#fef2f2]
                      transition-colors cursor-pointer border-none bg-transparent
                    "
                    title="Delete"
                  >
                    <TrashIcon />
                  </button>
                </div>
              )}
              {isCompleted && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    router.push(`/intakes/${intake.id}?view=readonly`);
                  }}
                  className="
                    flex items-center justify-center w-7 h-7 rounded-md ml-1
                    text-[#b8bfc6] hover:text-[#4a6080] hover:bg-[#f0ede8]
                    transition-colors cursor-pointer border-none bg-transparent
                  "
                  title="View only"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </Link>

      {/* ── Confirmation dialog ── */}
      <AlertDialog open={confirmAction !== null} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "delete" ? "Delete intake" : "Archive intake"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "delete"
                ? `Permanently delete ${intake.name || "this intake"}? This cannot be undone.`
                : `Archive ${intake.name || "this intake"}? You can find it in the archived section later.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={confirmAction === "delete" ? "destructive" : "default"}
              disabled={actionMutation.isPending}
              onClick={() => {
                if (confirmAction) {
                  actionMutation.mutate(confirmAction);
                }
              }}
            >
              {actionMutation.isPending ? "..." : confirmAction === "delete" ? "Delete" : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
