"use client";

import { usePathway } from "@/components/pathway/pathway-provider";
import { QuestionShell } from "@/components/pathway/question-shell";
import { SingleSelect } from "@/components/pathway/single-select";
import { NavButtons } from "@/components/pathway/nav-buttons";
import { READINESS_OPTIONS } from "@/lib/pathway-types";

export default function ReadinessPage() {
  const { state, dispatch, goNext, goBack, saveStep } = usePathway();
  const value = state.answers.readiness;

  const handleContinue = async () => {
    if (!value) return;
    await saveStep({ current_step: 4, readiness: value });
    dispatch({ type: "SET_STEP", step: 4 });
    goNext();
  };

  return (
    <QuestionShell
      step={3}
      heading="How ready do you feel right now?"
      description="There's no wrong answer. This helps us meet you where you are."
    >
      <SingleSelect
        options={READINESS_OPTIONS}
        value={value}
        onChange={(v) => dispatch({ type: "SET_ANSWER", field: "readiness", value: v })}
      />
      <NavButtons
        onBack={goBack}
        onContinue={handleContinue}
        canContinue={!!value}
      />
    </QuestionShell>
  );
}
