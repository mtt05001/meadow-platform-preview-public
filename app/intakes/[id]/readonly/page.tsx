"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { marked } from "marked";
import type { Intake } from "@/lib/types";
import Nav from "@/components/nav";

/** Convert markdown or raw text to HTML; pass through if already HTML */
function toHtml(text: string): string {
  if (!text) return "";
  if (text.trim().startsWith("<")) return text;
  return marked.parse(text, { async: false }) as string;
}

function formatApprovalDate(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "America/Los_Angeles",
    }) + " PT";
  } catch {
    return dateStr;
  }
}

export default function IntakeReadonlyPage() {
  const params = useParams();
  const id = params.id as string;
  const [pdfOpen, setPdfOpen] = useState(false);

  const { data: intake, isLoading, error } = useQuery({
    queryKey: ["intake-readonly", id],
    queryFn: () => apiFetch<Intake>(`/api/intakes/${id}/readonly`),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f5f1eb] flex items-center justify-center">
        <div className="text-[#7f8c8d]">Loading...</div>
      </div>
    );
  }

  if (error || !intake) {
    return (
      <div className="min-h-screen bg-[#f5f1eb] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#c0392b] font-semibold">
            {error?.message || "Intake not found"}
          </p>
        </div>
      </div>
    );
  }

  const ai = intake.ai_output as {
    risk_stratification?: string;
    email?: string;
  } | null;
  const riskHtml = toHtml(intake.edited_risk_strat || ai?.risk_stratification || "");
  const emailHtml = toHtml(ai?.email || "");

  const client = intake.client_data || {};
  const clientName = (client.name as string) || intake.name || "Unknown";
  const clientAge = client.age ? `${client.age}yo` : "";
  const clientSex = client.sex
    ? String(client.sex).charAt(0).toUpperCase() + String(client.sex).slice(1)
    : "";
  const clientDob = client.dob ? `DOB ${client.dob}` : "";
  const headerInfo = [clientAge, clientSex].filter(Boolean).join(" ");

  const jfId = intake.id || (intake.jotform_data?.id as string) || "";
  const jfFormId =
    (intake.jotform_data?.form_id as string) || "243226217742049";

  // Content styles for the readonly panels
  const contentCss = `
    .ro-content h1, .ro-content h2 { font-size: 15px; font-weight: 700; margin: 12px 0 4px; color: #2d5016; }
    .ro-content h3 { font-size: 13px; font-weight: 700; margin: 10px 0 3px; }
    .ro-content ul, .ro-content ol { margin: 4px 0 8px 18px; }
    .ro-content p { margin: 0 0 6px; }
  `;

  return (
    <div className="min-h-screen bg-[#f5f1eb]">
      <style dangerouslySetInnerHTML={{ __html: contentCss }} />

      <Nav subtitle="Health Intake Review — Read Only" />

      <main className="max-w-[1200px] mx-auto px-6 md:px-8 py-6">
        {/* Header row */}
        <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
          <h2 className="text-[22px] font-bold text-[#1a1a1a]">
            {clientName}
            {headerInfo && (
              <span className="text-[#2c3e50]"> — {headerInfo}</span>
            )}
            {clientDob && (
              <span className="text-[#7f8c8d] text-[16px] font-normal">
                {" "}
                · {clientDob}
              </span>
            )}
          </h2>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* View Original Intake button */}
            {jfId && (
              <a
                onClick={() => setPdfOpen(true)}
                className="
                  inline-block bg-white border border-[#e8e2d8] text-[#1a4d2e]
                  px-3.5 py-2 rounded-[6px] text-[13px] font-medium
                  cursor-pointer hover:bg-[#f5f1eb] transition-colors no-underline
                "
              >
                📄 View Original Intake
              </a>
            )}

            {/* Approval badge */}
            {intake.approved_by && (
              <div className="bg-[#f0f7ee] border border-[#b8d9b2] rounded-lg px-4 py-2.5 text-[13px] text-[#2d5016] leading-relaxed">
                <div className="font-bold mb-0.5">✅ Approved</div>
                <div>
                  By: <strong>{intake.approved_by}</strong>
                </div>
                {intake.approved_at && (
                  <div>On: {formatApprovalDate(intake.approved_at)}</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Two-column readonly grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Risk Stratification */}
          <div className="bg-white border border-[#e8e2d8] rounded-[10px] overflow-hidden">
            <div className="bg-[#1a4d2e] text-white px-4 py-3 font-semibold text-[14px]">
              📋 Risk Stratification
            </div>
            <div
              className="ro-content p-5 text-[13px] leading-[1.7] text-[#333] max-h-[560px] overflow-y-auto"
              dangerouslySetInnerHTML={{
                __html:
                  riskHtml ||
                  '<em style="color:#999;">No risk stratification available.</em>',
              }}
            />
          </div>

          {/* Medication Guidance Email */}
          <div className="bg-white border border-[#e8e2d8] rounded-[10px] overflow-hidden">
            <div className="bg-[#1a4d2e] text-white px-4 py-3 font-semibold text-[14px]">
              📧 Medication Guidance Email
            </div>
            <div
              className="ro-content p-5 text-[13px] leading-[1.7] text-[#333] max-h-[560px] overflow-y-auto"
              dangerouslySetInnerHTML={{
                __html:
                  emailHtml ||
                  '<em style="color:#999;">No email guidance available.</em>',
              }}
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-8 py-4 text-center text-[11px] text-[#a0998e]">
        Meadow Medicine — Portland, Oregon
      </footer>

      {/* PDF Viewer Modal */}
      {pdfOpen && (
        <div
          className="fixed inset-0 z-[1000] bg-black/70 flex items-center justify-center"
          onClick={() => setPdfOpen(false)}
        >
          <div
            className="bg-white rounded-[10px] w-[90vw] h-[90vh] flex flex-col overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.4)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 bg-[#1a4d2e] text-white">
              <span className="font-semibold text-[15px]">
                📄 Original Health Intake
              </span>
              <button
                onClick={() => setPdfOpen(false)}
                className="bg-transparent border-none text-white text-[22px] cursor-pointer leading-none"
              >
                ✕
              </button>
            </div>
            <iframe
              src={`/api/intakes/${jfId}/pdf?form_id=${jfFormId}`}
              className="flex-1 border-none w-full"
            />
          </div>
        </div>
      )}
    </div>
  );
}
