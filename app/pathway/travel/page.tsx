"use client";

import { usePathway } from "@/components/pathway/pathway-provider";
import { QuestionShell } from "@/components/pathway/question-shell";
import { SingleSelect } from "@/components/pathway/single-select";
import { NavButtons } from "@/components/pathway/nav-buttons";
import { TRAVEL_OPTIONS } from "@/lib/pathway-types";

export default function TravelPage() {
  const { state, dispatch, goNext, goBack, saveStep } = usePathway();
  const raw = state.answers.can_travel;
  const value = raw === true ? "yes" : raw === false ? "no" : null;

  const handleContinue = async () => {
    if (value === null) return;
    const canTravel = value === "yes";
    await saveStep({ current_step: 7, can_travel: canTravel });
    dispatch({ type: "SET_STEP", step: 7 });
    goNext();
  };

  return (
    <QuestionShell
      step={6}
      heading="Are you able to travel to Portland, Oregon?"
      description="Our sessions take place in person at our Portland location."
    >
      <SingleSelect
        options={TRAVEL_OPTIONS}
        value={value}
        onChange={(v) => dispatch({ type: "SET_ANSWER", field: "can_travel", value: v === "yes" })}
      />
      <NavButtons
        onBack={goBack}
        onContinue={handleContinue}
        canContinue={value !== null}
      />
    </QuestionShell>
  );
}
