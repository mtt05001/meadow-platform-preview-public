"use client";

import { useRouter } from "next/navigation";
import { usePathway } from "@/components/pathway/pathway-provider";
import { QuestionShell } from "@/components/pathway/question-shell";
import { MultiSelect } from "@/components/pathway/multi-select";
import { NavButtons } from "@/components/pathway/nav-buttons";
import { MEDICAL_CONDITIONS } from "@/lib/pathway-types";
import { isDisqualifiedAtStep } from "@/lib/pathway-routing";

export default function MedicalPage() {
  const { state, dispatch, goNext, goBack, saveStep } = usePathway();
  const router = useRouter();
  const values = state.answers.medical_flags;

  const handleContinue = async () => {
    if (values.length === 0) return;

    if (isDisqualifiedAtStep("medical", values)) {
      await saveStep({
        current_step: 4,
        medical_flags: values,
        routed_outcome: "disqualified",
      });
      dispatch({ type: "SET_OUTCOME", outcome: "disqualified" });
      router.push("/pathway/disqualified");
      return;
    }

    await saveStep({ current_step: 5, medical_flags: values });
    dispatch({ type: "SET_STEP", step: 5 });
    goNext();
  };

  return (
    <QuestionShell
      step={4}
      heading="Have you ever had any of the following medical conditions?"
      description="Select all that apply. This helps us ensure your safety."
    >
      <MultiSelect
        options={MEDICAL_CONDITIONS}
        values={values}
        onChange={(v) => dispatch({ type: "SET_ANSWER", field: "medical_flags", value: v })}
      />
      <NavButtons
        onBack={goBack}
        onContinue={handleContinue}
        canContinue={values.length > 0}
      />
    </QuestionShell>
  );
}
