"use client";

import { usePathway } from "@/components/pathway/pathway-provider";
import { QuestionShell } from "@/components/pathway/question-shell";
import { SingleSelect } from "@/components/pathway/single-select";
import { NavButtons } from "@/components/pathway/nav-buttons";
import { FINANCIAL_OPTIONS } from "@/lib/pathway-types";

export default function FinancialPage() {
  const { state, dispatch, goNext, goBack, saveStep } = usePathway();
  const value = state.answers.financial_ready;

  const handleContinue = async () => {
    if (!value) return;
    await saveStep({ current_step: 8, financial_ready: value });
    dispatch({ type: "SET_STEP", step: 8 });
    goNext();
  };

  return (
    <QuestionShell
      step={7}
      heading="How does your current financial situation feel?"
      description="We want to be transparent about the investment involved."
    >
      <SingleSelect
        options={FINANCIAL_OPTIONS}
        value={value}
        onChange={(v) => dispatch({ type: "SET_ANSWER", field: "financial_ready", value: v })}
      />
      <NavButtons
        onBack={goBack}
        onContinue={handleContinue}
        canContinue={!!value}
      />
    </QuestionShell>
  );
}
