"use client";

import { useRouter } from "next/navigation";
import { usePathway } from "@/components/pathway/pathway-provider";
import { QuestionShell } from "@/components/pathway/question-shell";
import { SingleSelect } from "@/components/pathway/single-select";
import { NavButtons } from "@/components/pathway/nav-buttons";
import { ATTRIBUTION_OPTIONS } from "@/lib/pathway-types";
import { routePathway } from "@/lib/pathway-routing";

export default function AttributionPage() {
  const { state, dispatch, goBack, saveStep } = usePathway();
  const router = useRouter();
  const value = state.answers.attribution;

  const handleContinue = async () => {
    if (!value) return;

    dispatch({ type: "SET_ANSWER", field: "attribution", value });

    const updatedAnswers = { ...state.answers, attribution: value };
    const outcome = routePathway(updatedAnswers);
    dispatch({ type: "SET_OUTCOME", outcome });

    await saveStep({
      current_step: 9,
      attribution: value,
      routed_outcome: outcome,
    });

    if (outcome === "discovery_call") {
      router.push("/pathway/booking");
    } else {
      router.push("/pathway/outcome");
    }
  };

  return (
    <QuestionShell
      step={9}
      heading="How did you hear about us?"
    >
      <SingleSelect
        options={ATTRIBUTION_OPTIONS}
        value={value}
        onChange={(v) => dispatch({ type: "SET_ANSWER", field: "attribution", value: v })}
      />
      <NavButtons
        onBack={goBack}
        onContinue={handleContinue}
        canContinue={!!value}
      />
    </QuestionShell>
  );
}
