import type { PathwayAnswers, PathwayOutcome } from "./pathway-types";

export function routePathway(answers: PathwayAnswers): PathwayOutcome {
  const hasRealMedical =
    answers.medical_flags.length > 0 &&
    !answers.medical_flags.every((f) => f === "none");
  if (hasRealMedical) return "disqualified";

  const hasRealPsych =
    answers.psych_flags.length > 0 &&
    !answers.psych_flags.every((f) => f === "none");
  if (hasRealPsych) return "disqualified";

  if (answers.can_travel === false) return "nurture";

  if (answers.financial_ready === "no_means") return "nurture";

  if (answers.readiness === "overwhelmed") return "nurture";

  return "discovery_call";
}

export function isDisqualifiedAtStep(
  step: "medical" | "psychiatric",
  flags: string[],
): boolean {
  return flags.length > 0 && !flags.every((f) => f === "none");
}
