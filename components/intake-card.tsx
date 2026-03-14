"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Intake } from "@/lib/types";
import RiskTierBadge from "./risk-tier-badge";
import { toast } from "sonner";

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
    });
  } catch {
    return dateStr;
  }
}

function isOverdue(prep1Date: string | null): boolean {
  if (!prep1Date) return false;
  const d = new Date(prep1Date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

function isDueSoon(prep1Date: string | null): boolean {
  if (!prep1Date) return false;
  const d = new Date(prep1Date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
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

export default function IntakeCard({
  intake,
}: {
  intake: Intake;
}) {
  const [confirmAction, setConfirmAction] = useState<"archive" | "delete" | null>(null);
  const queryClient = useQueryClient();
  const hardCount = intake.hard_contraindications?.length || 0;
  const status = statusConfig[intake.status] || statusConfig.pending;
  const isPending = intake.status === "pending";
  const isCompleted = intake.status === "approved" || intake.status === "rejected" || intake.status === "archived";

  // Border by STATUS like original: pending=green, completed=gray
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
    <div className="group relative">
      <Link href={`/intakes/${intake.id}`} className="block">
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

              <p className="text-[13px] text-[#7f8c8d] font-sans">
                {intake.submitted_at ? formatDate(intake.submitted_at) : ""}
                {intake.email && (
                  <span> · {intake.email}</span>
                )}
                {intake.prep1_date && (
                  <span> · Prep 1: {formatDate(intake.prep1_date)}</span>
                )}
              </p>

              {/* Flags row */}
              {(hardCount > 0 || intake.soft_score > 0) && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {hardCount > 0 && (
                    <SmallTag className="bg-[#fdeaea] text-[#c0392b]">
                      {hardCount} hard flag{hardCount > 1 ? "s" : ""}
                    </SmallTag>
                  )}
                  {intake.soft_score > 0 && (
                    <SmallTag className="bg-[#fff8e1] text-[#856404]">
                      Soft: {intake.soft_score}
                    </SmallTag>
                  )}
                </div>
              )}
            </div>

            {/* Right side: status + risk badge + action buttons */}
            <div className="flex items-center gap-3 shrink-0">
              <RiskTierBadge tier={intake.risk_tier} />
              <span
                className={`
                  rounded-full px-3 py-1 text-[12px] font-semibold
                  uppercase tracking-[0.5px]
                  ${status.bg} ${status.text}
                `}
              >
                {status.label}
              </span>
            </div>
          </div>
        </div>
      </Link>

      {/* Action buttons — overlaid on the card, right side */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
        {isCompleted && (
          <Link
            href={`/intakes/${intake.id}?view=readonly`}
            onClick={(e) => e.stopPropagation()}
            className="
              bg-white border border-[#e8e2d8] text-[#7f8c8d]
              px-2.5 py-1.5 rounded-[5px] text-[12px] font-sans
              hover:bg-[#f5f1eb] transition-colors no-underline
              opacity-0 group-hover:opacity-100
            "
          >
            👁 View Only
          </Link>
        )}
        {isPending && confirmAction === null && (
          <>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setConfirmAction("archive");
              }}
              className="
                bg-transparent border-none text-[#4a6080] text-[15px]
                cursor-pointer p-1.5 rounded leading-none
                opacity-0 group-hover:opacity-50 hover:!opacity-100
                transition-opacity
              "
              title="Archive intake"
            >
              🗂
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setConfirmAction("delete");
              }}
              className="
                bg-transparent border-none text-[#c0392b] text-[16px]
                cursor-pointer p-1.5 rounded leading-none
                opacity-0 group-hover:opacity-50 hover:!opacity-100
                transition-opacity
              "
              title="Delete intake"
            >
              🗑
            </button>
          </>
        )}
        {isPending && confirmAction && (
          <span
            className="flex items-center gap-1.5 text-[12px]"
            onClick={(e) => e.preventDefault()}
          >
            <span className="text-[#666] whitespace-nowrap">
              {confirmAction === "delete" ? "Delete" : "Archive"} {intake.name?.split(" ")[0]}?
            </span>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                actionMutation.mutate(confirmAction);
              }}
              disabled={actionMutation.isPending}
              className={`
                text-white border-none rounded px-2 py-0.5
                text-[11px] cursor-pointer font-sans
                ${confirmAction === "delete" ? "bg-[#c0392b]" : "bg-[#4a6080]"}
              `}
            >
              {actionMutation.isPending ? "…" : "Yes"}
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setConfirmAction(null);
              }}
              className="
                bg-white text-[#333] border border-[#ccc] rounded
                px-2 py-0.5 text-[11px] cursor-pointer font-sans
              "
            >
              No
            </button>
          </span>
        )}
      </div>
    </div>
  );
}
