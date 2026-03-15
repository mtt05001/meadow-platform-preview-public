"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import dynamic from "next/dynamic";
import { marked } from "marked";
import type { Intake } from "@/lib/types";
import Nav from "@/components/nav";
import RiskTierBadge from "@/components/risk-tier-badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const QuillEditor = dynamic(() => import("@/components/quill-editor"), {
  ssr: false,
  loading: () => (
    <div className="h-[460px] rounded-[6px] bg-[#f9f6f1] animate-pulse" />
  ),
});

const tierBanner: Record<
  string,
  { bg: string; border: string; text: string; icon: string }
> = {
  red: {
    bg: "bg-[#fdeaea]",
    border: "border-[#c0392b]",
    text: "text-[#c0392b]",
    icon: "🔴",
  },
  yellow: {
    bg: "bg-[#fff8e1]",
    border: "border-[#d4a017]",
    text: "text-[#856404]",
    icon: "🟡",
  },
  green: {
    bg: "bg-[#eafaf1]",
    border: "border-[#27ae60]",
    text: "text-[#27ae60]",
    icon: "🟢",
  },
  unknown: {
    bg: "bg-[#f0ede8]",
    border: "border-[#d5cfc5]",
    text: "text-[#7f8c8d]",
    icon: "⚪",
  },
};

/** Convert markdown or raw text to HTML; pass through if already HTML */
function toHtml(text: string): string {
  if (!text) return "";
  if (text.trim().startsWith("<")) return text;
  return marked.parse(text, { async: false }) as string;
}

export default function IntakeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [riskHtml, setRiskHtml] = useState("");
  const [emailHtml, setEmailHtml] = useState("");
  const [approveOpen, setApproveOpen] = useState(false);
  const [approverName, setApproverName] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [pdfOpen, setPdfOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState("");
  const [feedbackText, setFeedbackText] = useState("");

  const { data: intake, isLoading } = useQuery({
    queryKey: ["intake", id],
    queryFn: async () => {
      const data = await apiFetch<Intake>(`/api/intakes/${id}`);
      const ai = data.ai_output as {
        risk_stratification?: string;
        email?: string;
      } | null;
      setRiskHtml(toHtml(data.edited_risk_strat || ai?.risk_stratification || ""));
      setEmailHtml(toHtml(ai?.email || ""));
      return data;
    },
  });

  const isApproved =
    intake?.status === "approved" || intake?.status === "rejected" || intake?.status === "sending";

  const saveRiskStrat = useMutation({
    mutationFn: () =>
      apiFetch(`/api/intakes/${id}/save-risk-strat`, {
        method: "POST",
        body: { risk_stratification: riskHtml },
      }),
    onSuccess: () => toast.success("Risk stratification saved"),
    onError: (e) => toast.error("Save failed: " + e.message),
  });

  const saveEmailDraft = useMutation({
    mutationFn: () =>
      apiFetch(`/api/intakes/${id}/save-email-draft`, {
        method: "POST",
        body: { email: emailHtml },
      }),
    onSuccess: () => toast.success("Email draft saved"),
    onError: (e) => toast.error("Save failed: " + e.message),
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      // Auto-save both editors before approving (like original)
      await Promise.all([
        apiFetch(`/api/intakes/${id}/save-risk-strat`, {
          method: "POST",
          body: { risk_stratification: riskHtml },
        }),
        apiFetch(`/api/intakes/${id}/save-email-draft`, {
          method: "POST",
          body: { email: emailHtml },
        }),
      ]).catch(() => {
        /* non-blocking */
      });

      return apiFetch<{ success: boolean; error?: string }>(
        `/api/intakes/${id}/approve`,
        {
          method: "POST",
          body: {
            intake_id: id,
            client_email: intake?.email,
            client_name: intake?.name,
            edited_email: emailHtml,
            risk_stratification: riskHtml,
            approved_by: approverName,
          },
        },
      );
    },
    onSuccess: () => {
      toast.success("Approved and email sent!");
      setApproveOpen(false);
      router.push("/intakes");
    },
    onError: (e) => toast.error("Approval failed: " + e.message),
  });

  const testEmailMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ success: boolean }>("/api/test-email", {
        method: "POST",
        body: {
          to: testEmail,
          subject: `[TEST] Medication Guidance - ${intake?.name}`,
          html: emailHtml,
        },
      }),
    onSuccess: () => toast.success(`Test email sent to ${testEmail}`),
    onError: (e) => toast.error("Send failed: " + e.message),
  });

  const handleApprove = () => {
    if (!approverName.trim()) return;
    approveMutation.mutate();
  };

  const handleSubmitFeedback = () => {
    if (!feedbackType) {
      toast.error("Please select a feedback type");
      return;
    }
    if (!feedbackText.trim()) {
      toast.error("Please enter your feedback");
      return;
    }
    // Store locally — same as original (localStorage-based)
    const feedbackLog = JSON.parse(
      localStorage.getItem("ai_feedback_log") || "[]",
    );
    feedbackLog.push({
      intake_id: id,
      client_name: intake?.name || "Unknown",
      feedback_type: feedbackType,
      feedback_text: feedbackText,
      timestamp: new Date().toISOString(),
    });
    localStorage.setItem("ai_feedback_log", JSON.stringify(feedbackLog));
    toast.success("Feedback saved! Thank you for helping improve the AI.");
    setFeedbackType("");
    setFeedbackText("");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f5f1eb] flex items-center justify-center">
        <div className="text-center text-[#7f8c8d]">
          Loading intake...
        </div>
      </div>
    );
  }

  if (!intake) return null;

  const tier = tierBanner[intake.risk_tier] || tierBanner.unknown;
  const client = intake.client_data || {};
  const clientName = (client.name as string) || intake.name || "Unknown";
  const clientAge = client.age ? `${client.age}yo` : "";
  const clientSex = client.sex
    ? String(client.sex).charAt(0).toUpperCase() + String(client.sex).slice(1)
    : "";
  const headerInfo = [clientAge, clientSex].filter(Boolean).join(" ");

  const jfId = intake.id || (intake.jotform_data?.id as string) || "";
  const jfFormId =
    (intake.jotform_data?.form_id as string) || "243226217742049";

  return (
    <div className="min-h-screen bg-[#f5f1eb]">
      <Nav />

      <main className="max-w-[1400px] mx-auto px-6 md:px-8 py-6">
        {/* Back link */}
        <a
          onClick={() => router.push("/intakes")}
          className="
            inline-flex items-center gap-1.5 text-[#1a4d2e] text-[14px]
            font-semibold mb-4 cursor-pointer
            hover:underline
          "
        >
          ← Back to Queue
        </a>

        {/* Client header — matches original format */}
        <div
          className="text-[24px] font-bold text-[#1a4d2e] mb-3"
          id="detail-client-name"
        >
          {clientName}
          {headerInfo && (
            <span className="text-[#2c3e50]"> — {headerInfo}</span>
          )}
          {jfId && (
            <>
              <a
                onClick={() => setPdfOpen(true)}
                className="text-[14px] font-normal text-[#2d7a4a] underline ml-3 cursor-pointer hover:text-[#1a4d2e]"
              >
                📄 View Original Intake
              </a>
            </>
          )}
        </div>

        {/* Tier banner */}
        <div
          className={`
            ${tier.bg} ${tier.text} border-2 ${tier.border}
            rounded-[10px] px-6 py-4 mb-5
            flex items-center gap-3 text-[16px] font-semibold
          `}
        >
          <span className="text-[28px]">{tier.icon}</span>
          <span>
            {intake.risk_tier_explanation ||
              `Risk tier: ${intake.risk_tier}`}
          </span>
          <span className="ml-auto">
            <RiskTierBadge tier={intake.risk_tier} size="lg" />
          </span>
        </div>

        {/* Hard contraindications */}
        {intake.hard_contraindications.length > 0 && (
          <div className="bg-[#fdeaea] border-2 border-[#c0392b] rounded-lg px-4 py-4 mb-5">
            <h3 className="font-bold text-[#c0392b] text-[14px] mb-2">
              Hard Contraindications Found
            </h3>
            <ul className="list-disc ml-5 space-y-1">
              {intake.hard_contraindications.map((c, i) => (
                <li key={i} className="text-[#c0392b] text-[14px]">
                  <strong className="capitalize">{c.category}:</strong>{" "}
                  {c.detail}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Two-column editor grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
          {/* Risk Stratification */}
          <div className="bg-white rounded-[10px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] overflow-hidden">
            <div className="bg-[#1a4d2e] text-white px-5 py-3 text-[15px] font-semibold">
              📋 Risk Stratification {!isApproved && "(Editable)"}
            </div>
            <div className="p-5">
              <div className="border border-[#e8e2d8] rounded-[6px] bg-white overflow-hidden">
                <QuillEditor
                  value={riskHtml}
                  onChange={setRiskHtml}
                  disabled={isApproved}
                  placeholder="Risk stratification notes..."
                />
              </div>
              {!isApproved && (
                <div className="flex items-center gap-2.5 mt-2">
                  <button
                    onClick={() => saveRiskStrat.mutate()}
                    disabled={saveRiskStrat.isPending}
                    className="
                      px-[18px] py-[7px] rounded-[6px] text-[13px] font-semibold                      bg-[#1a4d2e] text-white
                      hover:opacity-85 transition-opacity
                      disabled:opacity-50 disabled:cursor-not-allowed
                    "
                  >
                    {saveRiskStrat.isPending ? "Saving..." : "💾 Save Changes"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Email Editor */}
          <div className="bg-white rounded-[10px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] overflow-hidden">
            <div className="bg-[#1a4d2e] text-white px-5 py-3 text-[15px] font-semibold">
              📧 Medication Guidance Email {!isApproved && "(Editable)"}
            </div>
            <div className="p-5">
              <div className="border border-[#e8e2d8] rounded-[6px] bg-white overflow-hidden">
                <QuillEditor
                  value={emailHtml}
                  onChange={setEmailHtml}
                  disabled={isApproved}
                  placeholder="Medication guidance email..."
                />
              </div>
              {!isApproved && (
                <div className="flex items-center gap-2.5 mt-2">
                  <button
                    onClick={() => saveEmailDraft.mutate()}
                    disabled={saveEmailDraft.isPending}
                    className="
                      px-[18px] py-[7px] rounded-[6px] text-[13px] font-semibold                      bg-[#1a4d2e] text-white
                      hover:opacity-85 transition-opacity
                      disabled:opacity-50 disabled:cursor-not-allowed
                    "
                  >
                    {saveEmailDraft.isPending ? "Saving..." : "💾 Save Changes"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action bar */}
        {isApproved ? (
          /* Already processed — show approval info */
          <div className="flex items-center justify-between gap-4 py-5 border-t border-[#e8e2d8]">
            <span className="text-[#7f8c8d] italic text-[14px]">
              {intake.status === "approved" ? "✅" : "❌"}{" "}
              {intake.status.charAt(0).toUpperCase() + intake.status.slice(1)}
              {intake.approved_by && (
                <>
                  {" "}
                  by <strong className="text-[#2c3e50]">{intake.approved_by}</strong>
                </>
              )}
              {intake.approved_at && (
                <>
                  {" "}
                  ·{" "}
                  {new Date(intake.approved_at).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  })}
                </>
              )}
            </span>
            <button
              onClick={() =>
                window.open(
                  `/intakes/${intake.id}/readonly`,
                  "_blank",
                )
              }
              className="
                bg-white border border-[#e8e2d8] text-[#444]
                px-4 py-2 rounded-[6px] text-[13px] font-medium
                cursor-pointer hover:bg-[#f5f1eb] transition-colors
              "
            >
              👁 View Only
            </button>
          </div>
        ) : (
          /* Pending — show feedback + actions */
          <div className="flex items-start gap-5 py-5 border-t border-[#e8e2d8]">
            {/* Feedback for AI */}
            <div className="flex-1 bg-[#faf7f2] p-5 rounded-lg">
              <div className="text-[16px] font-semibold text-[#1a4d2e] mb-2">
                💬 Feedback for AI
              </div>
              <p className="text-[13px] text-[#7f8c8d] mb-3.5">
                Help improve the AI by sharing what could be better
              </p>
              <div className="mb-3">
                <label className="text-[13px] font-medium text-[#2c3e50] block mb-1.5">
                  Feedback Type:
                </label>
                <select
                  value={feedbackType}
                  onChange={(e) => setFeedbackType(e.target.value)}
                  className="
                    w-full px-3 py-2.5 border border-[#e8e2d8] rounded-[6px]
                    text-[13px] bg-white
                  "
                >
                  <option value="">Select type...</option>
                  <option value="risk_stratification">
                    Risk Stratification
                  </option>
                  <option value="medication_guidance">
                    Medication Guidance
                  </option>
                </select>
              </div>
              <div className="mb-3.5">
                <label className="text-[13px] font-medium text-[#2c3e50] block mb-1.5">
                  What should the AI do differently?
                </label>
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="e.g., 'Should have flagged SSRI interaction' or 'Too conservative on benzodiazepines'"
                  className="
                    w-full min-h-[80px] px-3 py-2.5 border border-[#e8e2d8] rounded-[6px]
                    text-[13px] resize-y
                  "
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleSubmitFeedback}
                  className="
                    px-4 py-2 rounded-[6px] text-[13px] font-semibold                    bg-transparent border-2 border-[#1a4d2e] text-[#1a4d2e]
                    hover:bg-[#1a4d2e] hover:text-white transition-all
                  "
                >
                  📝 Submit Feedback
                </button>
              </div>
            </div>

            {/* Right column: approve + test email */}
            <div className="flex flex-col items-end gap-3 shrink-0 min-w-[300px]">
              <button
                onClick={() => setApproveOpen(true)}
                className="
                  px-5 py-2.5 rounded-[6px] text-[14px] font-semibold
                  bg-[#1a4d2e] text-white
                  hover:bg-[#2d7a4a] transition-colors
                "
              >
                ✅ Approve & Send
              </button>
              <div className="text-[12px] text-[#7f8c8d] text-left leading-relaxed">
                <div className="font-semibold text-[#2c3e50] mb-1">
                  When approved, this will:
                </div>
                <ol className="list-decimal ml-4 space-y-0.5">
                  <li>
                    Send email to client:{" "}
                    <span className="italic">{intake.email}</span>
                  </li>
                  <li>Add a note in GHL</li>
                  <li>Update Health Intake status in GHL</li>
                </ol>
              </div>

              {/* Test email */}
              <div className="w-full border-t border-[#e8e2d8] pt-3 mt-1">
                <div className="text-[12px] font-medium text-[#2c3e50] mb-2">
                  📤 Send Test Email
                </div>
                <div className="flex gap-2 items-center">
                  <input
                    type="email"
                    placeholder="Test email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    className="
                      flex-1 px-2.5 py-2 border border-[#e8e2d8] rounded-[6px]
                      text-[13px]                    "
                  />
                  <button
                    onClick={() => testEmailMutation.mutate()}
                    disabled={testEmailMutation.isPending || !testEmail}
                    className="
                      px-3 py-2 rounded-[6px] text-[13px] font-semibold                      bg-transparent border-2 border-[#1a4d2e] text-[#1a4d2e]
                      hover:bg-[#1a4d2e] hover:text-white transition-all
                      disabled:opacity-50 disabled:cursor-not-allowed
                      whitespace-nowrap
                    "
                  >
                    {testEmailMutation.isPending ? "Sending..." : "Send"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Approve dialog */}
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent className="!max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-[#1a4d2e]">
              ✅ Confirm Approval
            </DialogTitle>
            <DialogDescription className="text-[14px]">
              Who is approving this health intake?
            </DialogDescription>
          </DialogHeader>
          <div className="py-3">
            <Input
              value={approverName}
              onChange={(e) => setApproverName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleApprove()}
              placeholder="Enter your name"
              autoComplete="name"
              className="bg-white"
            />
            <p className="text-[12px] text-[#7f8c8d] mt-2.5 leading-relaxed">
              This will send the medication guidance email and update the client
              record in GHL.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={approveMutation.isPending || !approverName.trim()}
              className="bg-[#1a4d2e] text-white hover:bg-[#2d7a4a]"
            >
              {approveMutation.isPending ? "Approving..." : "✅ Approve & Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
