"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import dynamic from "next/dynamic";
import { marked } from "marked";
import type { Intake, AiFeedback } from "@/lib/types";
import { titleCase } from "@/lib/utils";
import Nav from "@/components/nav";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
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

/** Convert markdown or raw text to HTML; pass through if already HTML */
function toHtml(text: string): string {
  if (!text) return "";
  if (text.trim().startsWith("<")) return text;
  return marked.parse(text, { async: false }) as string;
}

export default function IntakeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;

  const [riskHtml, setRiskHtml] = useState("");
  const [emailHtml, setEmailHtml] = useState("");
  const [approveOpen, setApproveOpen] = useState(false);
  const [approverName, setApproverName] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [feedbackType, setFeedbackType] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [regenerateGuidance, setRegenerateGuidance] = useState("");
  const [aiSheetOpen, setAiSheetOpen] = useState(false);
  const [riskSaveStatus, setRiskSaveStatus] = useState<"idle" | "unsaved" | "saving" | "saved">("idle");
  const [emailSaveStatus, setEmailSaveStatus] = useState<"idle" | "unsaved" | "saving" | "saved">("idle");

  // Track whether editors have been initialized from server data
  const editorsInitialized = useRef(false);

  const { data: intake, isLoading } = useQuery({
    queryKey: ["intake", id],
    queryFn: () => apiFetch<Intake>(`/api/intakes/${id}`),
  });

  const { data: medComplex } = useQuery({
    queryKey: ["intake", id, "medically-complex"],
    queryFn: () => apiFetch<{ value: string }>(`/api/intakes/${id}/medically-complex`),
  });

  const setMedComplex = useMutation({
    mutationFn: (value: "Yes" | "No") =>
      apiFetch<{ value: string }>(`/api/intakes/${id}/medically-complex`, {
        method: "PUT",
        body: { value },
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(["intake", id, "medically-complex"], data);
      toast.success(`Medically complex set to ${data.value}`);
    },
    onError: (e) => toast.error("Failed to update: " + e.message),
  });

  // Only initialize editor content once from server data (not on every refetch)
  useEffect(() => {
    if (!intake || editorsInitialized.current) return;
    const ai = intake.ai_output as {
      risk_stratification?: string;
      email?: string;
    } | null;
    setRiskHtml(toHtml(intake.edited_risk_strat || ai?.risk_stratification || ""));
    setEmailHtml(toHtml(ai?.email || ""));
    editorsInitialized.current = true;
  }, [intake]);

  const isApproved =
    intake?.status === "approved" || intake?.status === "rejected" || intake?.status === "sending";

  const saveRiskStrat = useMutation({
    mutationFn: () =>
      apiFetch(`/api/intakes/${id}/save-risk-strat`, {
        method: "POST",
        body: { risk_stratification: riskHtml },
      }),
    onSuccess: () => {
      toast.success("Risk stratification saved");
      queryClient.invalidateQueries({ queryKey: ["intake", id] });
    },
    onError: (e) => toast.error("Save failed: " + e.message),
  });

  const saveEmailDraft = useMutation({
    mutationFn: () =>
      apiFetch(`/api/intakes/${id}/save-email-draft`, {
        method: "POST",
        body: { email: emailHtml },
      }),
    onSuccess: () => {
      toast.success("Email draft saved");
      queryClient.invalidateQueries({ queryKey: ["intake", id] });
    },
    onError: (e) => toast.error("Save failed: " + e.message),
  });

  // Debounced autosave — saves 3s after last edit, per editor
  const riskSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emailSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const riskHtmlRef = useRef(riskHtml);
  const emailHtmlRef = useRef(emailHtml);
  riskHtmlRef.current = riskHtml;
  emailHtmlRef.current = emailHtml;

  const handleRiskChange = useCallback((html: string) => {
    setRiskHtml(html);
    setRiskSaveStatus("unsaved");
    if (riskSaveTimer.current) clearTimeout(riskSaveTimer.current);
    riskSaveTimer.current = setTimeout(async () => {
      setRiskSaveStatus("saving");
      try {
        await apiFetch(`/api/intakes/${id}/save-risk-strat`, {
          method: "POST",
          body: { risk_stratification: riskHtmlRef.current },
        });
        setRiskSaveStatus("saved");
      } catch {
        setRiskSaveStatus("unsaved");
      }
    }, 3000);
  }, [id]);

  const handleEmailChange = useCallback((html: string) => {
    setEmailHtml(html);
    setEmailSaveStatus("unsaved");
    if (emailSaveTimer.current) clearTimeout(emailSaveTimer.current);
    emailSaveTimer.current = setTimeout(async () => {
      setEmailSaveStatus("saving");
      try {
        await apiFetch(`/api/intakes/${id}/save-email-draft`, {
          method: "POST",
          body: { email: emailHtmlRef.current },
        });
        setEmailSaveStatus("saved");
      } catch {
        setEmailSaveStatus("unsaved");
      }
    }, 3000);
  }, [id]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (riskSaveTimer.current) clearTimeout(riskSaveTimer.current);
      if (emailSaveTimer.current) clearTimeout(emailSaveTimer.current);
    };
  }, []);

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
      queryClient.invalidateQueries({ queryKey: ["intakes"] });
      router.push("/intakes");
    },
    onError: (e) => toast.error("Approval failed: " + e.message),
  });

  const resendMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ success: boolean }>(`/api/intakes/${id}/resend-email`, {
        method: "POST",
      }),
    onSuccess: () => toast.success("Email resent successfully"),
    onError: (e) => toast.error("Resend failed: " + e.message),
  });

  const testEmailMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ success: boolean }>("/api/test-email", {
        method: "POST",
        body: {
          to: testEmail,
          subject: `[TEST] Meadow Medication Guidance - ${intake?.name}`,
          html: emailHtml,
        },
      }),
    onSuccess: () => toast.success(`Test email sent to ${testEmail}`),
    onError: (e) => toast.error("Send failed: " + e.message),
  });

  const regenerateAi = useMutation({
    mutationFn: (guidance?: string) =>
      apiFetch<{ success: boolean }>(`/api/intakes/${id}/regenerate-ai`, {
        method: "POST",
        body: guidance?.trim() ? { guidance } : {},
      }),
    onSuccess: () => {
      toast.success("AI output regenerated");
      editorsInitialized.current = false; // Allow re-init from new AI data
      queryClient.invalidateQueries({ queryKey: ["intake", id] });
      setRegenerateOpen(false);
      setRegenerateGuidance("");
    },
    onError: (e) => {
      toast.error("Regeneration failed: " + e.message);
      setRegenerateOpen(false);
    },
  });

  const handleApprove = () => {
    if (!approverName.trim()) return;
    approveMutation.mutate();
  };

  const submitFeedback = useMutation({
    mutationFn: () =>
      apiFetch<{ success: boolean }>(`/api/intakes/${id}/feedback`, {
        method: "POST",
        body: { feedback_type: feedbackType, feedback_text: feedbackText },
      }),
    onSuccess: () => {
      toast.success("Feedback saved! Thank you for helping improve the AI.");
      setFeedbackType("");
      setFeedbackText("");
      setFeedbackOpen(false);
    },
    onError: (e) => toast.error("Failed to save feedback: " + e.message),
  });

  const handleSubmitFeedback = () => {
    if (!feedbackType) {
      toast.error("Please select a feedback type");
      return;
    }
    if (!feedbackText.trim()) {
      toast.error("Please enter your feedback");
      return;
    }
    submitFeedback.mutate();
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

  const client = intake.client_data || {};
  const clientName = titleCase((client.name as string) || intake.name || "Unknown");
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

        {/* Patient chart header */}
        <div className="bg-white rounded-[10px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] mb-5 overflow-hidden">
          <div className="px-5 py-4 flex items-start justify-between gap-4">
            {/* Left: client info */}
            <div className="flex flex-col gap-1.5 min-w-0">
              <div className="flex items-center gap-3 flex-wrap" id="detail-client-name">
                <h1 className="text-[22px] font-bold text-[#1a4d2e] leading-tight">{clientName}</h1>
                {headerInfo && (
                  <span className="text-[14px] font-semibold text-[#2c3e50] bg-[#f5f1eb] px-2.5 py-0.5 rounded-full">{headerInfo}</span>
                )}
              </div>
              {intake.facilitator && (
                <div className="flex items-center gap-2 text-[16px]">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2d7a4a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <span className="text-[#5a6c7d]">Lead Facilitator</span>
                  <span className="font-semibold text-[#1a4d2e]">{intake.facilitator}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-[14px] mt-1">
                <span className="text-[#5a6c7d] font-medium">Medically Complex</span>
                <div className="inline-flex rounded-md border border-[#e8e2d8] overflow-hidden">
                  {(["Yes", "No"] as const).map((opt) => {
                    const active = medComplex?.value === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        disabled={setMedComplex.isPending}
                        onClick={() => setMedComplex.mutate(opt)}
                        className={
                          "px-3 py-1 text-[13px] font-semibold transition-colors disabled:opacity-50 " +
                          (active
                            ? opt === "Yes"
                              ? "bg-[#c0392b] text-white"
                              : "bg-[#1a4d2e] text-white"
                            : "bg-white text-[#5a6c7d] hover:bg-[#f5f1eb]")
                        }
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
                {medComplex === undefined && (
                  <span className="text-[12px] text-[#9aa5b1]">loading…</span>
                )}
              </div>
            </div>

            {/* Right: utility links */}
            {jfId && (
              <div className="flex items-center gap-1.5 shrink-0 pt-1">
                <a
                  href={`/api/intakes/${jfId}/pdf?form_id=${jfFormId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="
                    inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium
                    text-[#2c3e50] bg-[#f5f1eb] hover:bg-[#ebe5db] transition-colors
                  "
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  Original Intake
                </a>
                <a
                  href={`https://www.jotform.com/inbox/${jfFormId}/${jfId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="
                    inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium
                    text-[#2c3e50] bg-[#f5f1eb] hover:bg-[#ebe5db] transition-colors
                  "
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  Jotform
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Hard contraindications */}
        {/* Two-column editor grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-4">
          {/* Risk Stratification */}
          <div className="bg-white rounded-[10px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] overflow-hidden">
            <div className="bg-[#1a4d2e] text-white px-5 py-3 text-[15px] font-semibold flex items-center justify-between">
              <span>📋 Risk Stratification</span>
              <SaveIndicator status={riskSaveStatus} />
            </div>
            <div className="p-5">
              <div className="border border-[#e8e2d8] rounded-[6px] bg-white overflow-hidden">
                <QuillEditor
                  value={riskHtml}
                  onChange={handleRiskChange}
                  placeholder="Risk stratification notes..."
                />
              </div>
            </div>
          </div>

          {/* Email Editor */}
          <div className="bg-white rounded-[10px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] overflow-hidden">
            <div className="bg-[#1a4d2e] text-white px-5 py-3 text-[15px] font-semibold flex items-center justify-between">
              <span>📧 Medication Guidance Email</span>
              <SaveIndicator status={emailSaveStatus} />
            </div>
            <div className="p-5">
              <div className="border border-[#e8e2d8] rounded-[6px] bg-white overflow-hidden">
                <QuillEditor
                  value={emailHtml}
                  onChange={handleEmailChange}
                  placeholder="Medication guidance email..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* AI toolbar — grouped controls for regenerate, feedback, prompt */}
        {!isApproved && (
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setRegenerateOpen(true)}
              disabled={regenerateAi.isPending}
              className="
                px-3 py-1.5 rounded-[6px] text-[13px] font-medium
                bg-white border border-[#e8e2d8] text-[#2c3e50]
                hover:bg-[#f5f1eb] transition-colors cursor-pointer
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              {regenerateAi.isPending ? "Generating..." : "↻ Regenerate AI"}
            </button>
            <button
              onClick={() => setFeedbackOpen(true)}
              className="
                px-3 py-1.5 rounded-[6px] text-[13px] font-medium
                bg-white border border-[#e8e2d8] text-[#2c3e50]
                hover:bg-[#f5f1eb] transition-colors cursor-pointer
              "
            >
              💬 Leave Feedback
            </button>
            <button
              onClick={() => setAiSheetOpen(true)}
              className="
                px-3 py-1.5 rounded-[6px] text-[13px] font-medium
                bg-white border border-[#e8e2d8] text-[#2c3e50]
                hover:bg-[#f5f1eb] transition-colors cursor-pointer
              "
            >
              📋 Prompt & Log
            </button>
          </div>
        )}

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
            <div className="flex gap-2">
              <button
                onClick={() => resendMutation.mutate()}
                disabled={resendMutation.isPending}
                className="
                  bg-white border border-[#e8e2d8] text-[#444]
                  px-4 py-2 rounded-[6px] text-[13px] font-medium
                  cursor-pointer hover:bg-[#f5f1eb] transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
              >
                {resendMutation.isPending ? "Sending…" : "Resend Email"}
              </button>
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
          </div>
        ) : (
          /* Pending — approve + test email */
          <div className="flex items-start justify-end gap-5 py-5 border-t border-[#e8e2d8]">
            <div className="flex flex-col items-end gap-3 shrink-0 min-w-[300px]">
              <button
                onClick={() => setApproveOpen(true)}
                className="
                  px-5 py-2.5 rounded-[6px] text-[14px] font-semibold
                  bg-[#1a4d2e] text-white
                  hover:bg-[#2d7a4a] transition-colors cursor-pointer
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
                      text-[13px]
                    "
                  />
                  <button
                    onClick={() => testEmailMutation.mutate()}
                    disabled={testEmailMutation.isPending || !testEmail}
                    className="
                      px-3 py-2 rounded-[6px] text-[13px] font-semibold
                      bg-transparent border-2 border-[#1a4d2e] text-[#1a4d2e]
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

      {/* Regenerate AI dialog */}
      <Dialog open={regenerateOpen} onOpenChange={(open) => {
        setRegenerateOpen(open);
        if (!open) setRegenerateGuidance("");
      }}>
        <DialogContent className="!max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-[#1a4d2e]">
              Regenerate AI Output
            </DialogTitle>
            <DialogDescription className="text-[14px]">
              This will generate a new risk stratification and medication
              guidance email. Any existing AI output will be overwritten.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label className="text-[13px] font-medium text-[#2c3e50] block mb-1.5">
              Additional guidance for the AI
              <span className="text-[#7f8c8d] font-normal"> (optional)</span>
            </label>
            <textarea
              value={regenerateGuidance}
              onChange={(e) => setRegenerateGuidance(e.target.value)}
              placeholder="e.g., 'Be less conservative about the SSRI tapering' or 'Flag the MAOI interaction more prominently'"
              className="
                w-full min-h-[90px] px-3 py-2.5 border border-[#e8e2d8] rounded-[6px]
                text-[13px] resize-y bg-white
              "
            />
            <p className="text-[12px] text-[#7f8c8d] mt-1.5">
              Leave empty to regenerate with the default prompt.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegenerateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => regenerateAi.mutate(regenerateGuidance || undefined)}
              disabled={regenerateAi.isPending}
              className="bg-[#1a4d2e] text-white hover:bg-[#2d7a4a]"
            >
              {regenerateAi.isPending ? "Generating..." : "Regenerate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Feedback dialog */}
      <Dialog open={feedbackOpen} onOpenChange={(open) => {
        setFeedbackOpen(open);
        if (!open) { setFeedbackType(""); setFeedbackText(""); }
      }}>
        <DialogContent className="!max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-[#1a4d2e]">
              Leave Feedback for AI
            </DialogTitle>
            <DialogDescription className="text-[14px]">
              Help improve the AI by sharing what could be better.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <div>
              <label className="text-[13px] font-medium text-[#2c3e50] block mb-1.5">
                Feedback Type
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
                <option value="risk_stratification">Risk Stratification</option>
                <option value="medication_guidance">Medication Guidance</option>
              </select>
            </div>
            <div>
              <label className="text-[13px] font-medium text-[#2c3e50] block mb-1.5">
                What should the AI do differently?
              </label>
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="e.g., 'Should have flagged SSRI interaction' or 'Too conservative on benzodiazepines'"
                className="
                  w-full min-h-[90px] px-3 py-2.5 border border-[#e8e2d8] rounded-[6px]
                  text-[13px] resize-y bg-white
                "
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeedbackOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                handleSubmitFeedback();
                // Close on success via the mutation's onSuccess
              }}
              disabled={submitFeedback.isPending}
              className="bg-[#1a4d2e] text-white hover:bg-[#2d7a4a]"
            >
              {submitFeedback.isPending ? "Saving..." : "Submit Feedback"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Prompt & Feedback Sheet */}
      <AiSheet open={aiSheetOpen} onOpenChange={setAiSheetOpen} />

    </div>
  );
}

type FeedbackRow = AiFeedback & { client_name: string };

function AiSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [promptExpanded, setPromptExpanded] = useState(false);

  const { data: promptData } = useQuery({
    queryKey: ["admin-ai-prompt"],
    queryFn: () =>
      apiFetch<{ prompt: string; static_email_footer: string }>("/api/admin/ai-prompt"),
    enabled: open,
  });

  const { data: feedback } = useQuery({
    queryKey: ["admin-ai-feedback"],
    queryFn: () => apiFetch<FeedbackRow[]>("/api/admin/ai-feedback"),
    enabled: open,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="!w-[520px] !max-w-[90vw] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-[#1a4d2e]">AI Configuration</SheetTitle>
          <SheetDescription>
            Current prompt and reviewer feedback log
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-6 space-y-6">
          {/* Prompt viewer */}
          <div>
            <button
              onClick={() => setPromptExpanded(!promptExpanded)}
              className="
                w-full flex items-center justify-between py-2.5
                text-left bg-transparent border-none cursor-pointer
              "
            >
              <span className="text-[14px] font-semibold text-[#2c3e50]">
                System Prompt
              </span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                className={`text-[#7f8c8d] transition-transform ${promptExpanded ? "rotate-180" : ""}`}
              >
                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {promptExpanded && promptData && (
              <div className="space-y-4 mt-1">
                <pre className="text-[11px] leading-relaxed text-[#2c3e50] whitespace-pre-wrap font-mono bg-[#f9f7f4] rounded-lg p-3 max-h-[400px] overflow-y-auto border border-[#e8e2d8]">
                  {promptData.prompt}
                </pre>
                <div>
                  <p className="text-[11px] font-semibold text-[#5a6c7d] mb-1.5 uppercase tracking-wide">
                    Static Email Footer
                  </p>
                  <pre className="text-[11px] leading-relaxed text-[#2c3e50] whitespace-pre-wrap font-mono bg-[#f9f7f4] rounded-lg p-3 max-h-[250px] overflow-y-auto border border-[#e8e2d8]">
                    {promptData.static_email_footer}
                  </pre>
                </div>
              </div>
            )}
          </div>

          {/* Feedback log */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[14px] font-semibold text-[#2c3e50]">
                Feedback Log
              </span>
              {feedback && feedback.length > 0 && (
                <Badge variant="secondary" className="text-[11px]">
                  {feedback.length}
                </Badge>
              )}
            </div>

            {!feedback?.length ? (
              <p className="text-[13px] text-[#7f8c8d] italic">
                No feedback submitted yet.
              </p>
            ) : (
              <div className="space-y-2.5">
                {feedback.map((row) => (
                  <div
                    key={row.id}
                    className="bg-[#f9f7f4] rounded-lg p-3 border border-[#e8e2d8]"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          row.feedback_type === "medication_guidance"
                            ? "border-blue-200 text-blue-700 bg-blue-50"
                            : "border-amber-200 text-amber-700 bg-amber-50"
                        }`}
                      >
                        {row.feedback_type === "medication_guidance"
                          ? "Email"
                          : row.feedback_type === "risk_stratification"
                            ? "Risk Strat"
                            : row.feedback_type}
                      </Badge>
                      <span className="text-[11px] text-[#7f8c8d]">
                        {row.client_name}
                      </span>
                    </div>
                    <p className="text-[12px] text-[#2c3e50] leading-relaxed">
                      {row.feedback_text}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 text-[11px] text-[#7f8c8d]">
                      <span>{row.reviewer}</span>
                      <span>&middot;</span>
                      <span>
                        {new Date(row.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SaveIndicator({ status }: { status: "idle" | "unsaved" | "saving" | "saved" }) {
  if (status === "idle") return null;

  return (
    <span className="flex items-center gap-1.5 text-[12px] font-normal">
      {status === "unsaved" && (
        <>
          <span className="w-2 h-2 rounded-full bg-yellow-400" />
          <span className="text-white/70">Unsaved changes</span>
        </>
      )}
      {status === "saving" && (
        <>
          <svg className="w-3.5 h-3.5 animate-spin text-white/70" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.3" />
            <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="text-white/70">Saving...</span>
        </>
      )}
      {status === "saved" && (
        <>
          <svg className="w-3.5 h-3.5 text-emerald-300" viewBox="0 0 16 16" fill="none">
            <path d="M3 8.5l3.5 3.5 6.5-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-white/90">Saved</span>
        </>
      )}
    </span>
  );
}
