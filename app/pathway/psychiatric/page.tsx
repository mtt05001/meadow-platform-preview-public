"use client";

import { useRouter } from "next/navigation";
import { usePathway } from "@/components/pathway/pathway-provider";
import { QuestionShell } from "@/components/pathway/question-shell";
import { MultiSelect } from "@/components/pathway/multi-select";
import { NavButtons } from "@/components/pathway/nav-buttons";
import { PSYCH_CONDITIONS } from "@/lib/pathway-types";
import { isDisqualifiedAtStep } from "@/lib/pathway-routing";

export default function PsychiatricPage() {
  const { state, dispatch, goNext, goBack, saveStep } = usePathway();
  const router = useRouter();
  const values = state.answers.psych_flags;

  const handleContinue = async () => {
    if (values.length === 0) return;

    if (isDisqualifiedAtStep("psychiatric", values)) {
      await saveStep({
        current_step: 5,
        psych_flags: values,
        routed_outcome: "disqualified",
      });
      dispatch({ type: "SET_OUTCOME", outcome: "disqualified" });
      router.push("/pathway/disqualified");
      return;
    }

    await saveStep({ current_step: 6, psych_flags: values });
    dispatch({ type: "SET_STEP", step: 6 });
    goNext();
  };

  return (
    <QuestionShell
      step={5}
      heading="Have you ever been diagnosed with any of the following?"
      description="Select all that apply."
    >
      <MultiSelect
        options={PSYCH_CONDITIONS}
        values={values}
        onChange={(v) => dispatch({ type: "SET_ANSWER", field: "psych_flags", value: v })}
      />
      <NavButtons
        onBack={goBack}
        onContinue={handleContinue}
        canContinue={values.length > 0}
      />
    </QuestionShell>
  );
}
