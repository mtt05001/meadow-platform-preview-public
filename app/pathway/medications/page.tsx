"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePathway } from "@/components/pathway/pathway-provider";
import { MedPickerPathway } from "@/components/pathway/med-picker-pathway";
import type { PathwayMedication } from "@/lib/pathway-types";

export default function MedicationsPage() {
  const { state, dispatch, saveStep, userId, isDemo } = usePathway();
  const router = useRouter();
  const [meds, setMeds] = useState<PathwayMedication[]>(state.medications);
  const [notes, setNotes] = useState(state.additionalNotes);
  const [loading, setLoading] = useState(false);

  const handleMedsChange = (updated: PathwayMedication[]) => {
    setMeds(updated);
    dispatch({ type: "SET_MEDICATIONS", meds: updated });
  };

  const handleContinue = async () => {
    setLoading(true);
    await saveStep({
      medications: meds,
      additional_notes: notes.trim() || null,
    });
    dispatch({ type: "SET_NOTES", notes: notes.trim() });

    if (!isDemo && userId) {
      await fetch("/api/pathway/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
    }

    setLoading(false);
    router.push("/pathway/confirm");
  };

  const handleSkip = async () => {
    if (!isDemo && userId) {
      await fetch("/api/pathway/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
    }
    router.push("/pathway/confirm");
  };

  return (
    <div className="min-h-[calc(100dvh-4px)] flex flex-col bg-[#f5f1eb]">
      <div className="flex-1 flex flex-col items-center px-5 py-8">
        <div className="w-full max-w-lg">
          <p
            className="text-[11px] tracking-[0.35em] uppercase font-medium text-[#1a4d2e]/40 mb-3"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            One more thing
          </p>
          <h1
            className="text-[#1a4d2e] text-2xl sm:text-3xl leading-snug mb-2"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Current medications
          </h1>
          <p
            className="text-[#1a4d2e]/55 text-[15px] leading-relaxed mb-8"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            This helps our team prepare for your discovery call. Search for your
            medications below, or skip if you&rsquo;re not currently taking any.
          </p>

          <MedPickerPathway medications={meds} onChange={handleMedsChange} />

          <div className="mt-6">
            <label
              className="block text-[11px] uppercase tracking-[0.1em] font-semibold text-[#1a4d2e]/50 mb-1.5"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              Anything else we should know?
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
              rows={3}
              className="w-full px-4 py-3 bg-white border border-[#e8e2d8] rounded-lg
                focus:border-[#1a4d2e]/40 focus:ring-1 focus:ring-[#1a4d2e]/10
                outline-none text-[14px] text-[#1a4d2e] placeholder:text-[#1a4d2e]/30
                resize-none leading-relaxed"
              style={{ fontFamily: "var(--font-sans)" }}
            />
          </div>

          <div className="mt-8 flex items-center justify-between">
            <button
              type="button"
              onClick={handleSkip}
              className="text-[#1a4d2e]/40 hover:text-[#1a4d2e]/60 text-[13px] transition-colors cursor-pointer"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              Skip for now
            </button>
            <button
              type="button"
              onClick={handleContinue}
              disabled={loading}
              className="px-8 py-3 bg-[#1a4d2e] text-white text-[14px] font-semibold tracking-wide rounded-lg
                hover:bg-[#2d7a4a] transition-colors duration-200 cursor-pointer
                disabled:opacity-40 disabled:cursor-not-allowed
                flex items-center gap-2"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              {loading && (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
