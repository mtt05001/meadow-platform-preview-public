"use client";

import { usePathway } from "@/components/pathway/pathway-provider";
import { QuestionShell } from "@/components/pathway/question-shell";
import { SingleSelect } from "@/components/pathway/single-select";
import { NavButtons } from "@/components/pathway/nav-buttons";
import { REASON_OPTIONS } from "@/lib/pathway-types";

export default function ReasonPage() {
  const { state, dispatch, goNext, goBack, saveStep } = usePathway();
  const value = state.answers.primary_reason;

  const handleContinue = async () => {
    if (!value) return;
    await saveStep({ current_step: 3, primary_reason: value });
    dispatch({ type: "SET_STEP", step: 3 });
    goNext();
  };

  return (
    <QuestionShell
      step={2}
      heading="What's your primary reason for seeking support?"
      description="This helps us understand what matters most to you."
    >
      <SingleSelect
        options={REASON_OPTIONS}
        value={value}
        onChange={(v) => dispatch({ type: "SET_ANSWER", field: "primary_reason", value: v })}
      />
      <NavButtons
        onBack={goBack}
        onContinue={handleContinue}
        canContinue={!!value}
      />
    </QuestionShell>
  );
}
