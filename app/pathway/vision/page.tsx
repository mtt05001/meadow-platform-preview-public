"use client";

import { useState } from "react";
import { usePathway } from "@/components/pathway/pathway-provider";
import { QuestionShell } from "@/components/pathway/question-shell";
import { NavButtons } from "@/components/pathway/nav-buttons";

export default function VisionPage() {
  const { state, dispatch, goNext, goBack, saveStep } = usePathway();
  const [text, setText] = useState(state.answers.best_case || "");

  const handleContinue = async () => {
    await saveStep({ current_step: 9, best_case: text.trim() || null });
    dispatch({ type: "SET_ANSWER", field: "best_case", value: text.trim() || null });
    dispatch({ type: "SET_STEP", step: 9 });
    goNext();
  };

  const handleSkip = async () => {
    await saveStep({ current_step: 9, best_case: null });
    dispatch({ type: "SET_STEP", step: 9 });
    goNext();
  };

  return (
    <QuestionShell
      step={8}
      heading="If this worked, what would change for you?"
      description="Optional. This helps our team understand what matters most to you."
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Take your time with this one..."
        rows={4}
        className="w-full px-5 py-4 bg-white border border-[#e8e2d8] rounded-lg
          focus:border-[#1a4d2e]/40 focus:ring-1 focus:ring-[#1a4d2e]/10
          outline-none text-[14px] text-[#1a4d2e] placeholder:text-[#1a4d2e]/30
          resize-none leading-relaxed"
        style={{ fontFamily: "var(--font-sans)" }}
      />
      <NavButtons
        onBack={goBack}
        onContinue={handleContinue}
        showSkip
        onSkip={handleSkip}
      />
    </QuestionShell>
  );
}
