// Screening rules engine — purely deterministic, no API calls

import type { MedicationEntry } from "./medication-data";
import { getMedicationDisplayName } from "./medication-data";

export interface Contraindication {
  trigger: string;
  reason: string;
  detail?: string;
  points?: number;
}

export interface SubstanceUse {
  cannabis: string;
  alcohol: string;
  hardDrugs: string;
}

export interface ScreeningInput {
  medications: MedicationEntry[];
  substanceUse: SubstanceUse;
  age: string;
}

export interface ScreeningResult {
  result: string;
  resultColor: "green" | "yellow" | "red";
  nextAction: string;
  hardContraindications: Contraindication[];
  softContraindications: Contraindication[];
  softScore: number;
  hasHardContraindication: boolean;
}

export function evaluateScreening({ medications, substanceUse, age }: ScreeningInput): ScreeningResult {
  const hardContraindications: Contraindication[] = [];
  const softContraindications: Contraindication[] = [];
  let softScore = 0;

  // Evaluate each medication
  for (const med of medications) {
    const { medication, frequency, dailyUse, chronicUse } = med;

    // Skip if not currently taking
    if (frequency === "not_taking") continue;

    const displayName = getMedicationDisplayName(medication);

    // Hard contraindications - always hard
    if (medication.category === "hard_always") {
      hardContraindications.push({
        trigger: displayName,
        reason: "Hard contraindication",
        detail: medication.type.replace(/_/g, " "),
      });
      continue;
    }

    // Benzodiazepines - hard if daily
    if (medication.category === "hard_if_daily" && medication.type === "benzodiazepine") {
      if (dailyUse === true || frequency === "daily") {
        hardContraindications.push({
          trigger: displayName,
          reason: "Daily benzodiazepine use",
          detail: "Hard contraindication",
        });
      }
      continue;
    }

    // Sleep meds - hard if nightly
    if (medication.category === "hard_if_nightly") {
      if (frequency === "nightly") {
        hardContraindications.push({
          trigger: displayName,
          reason: "Nightly use",
          detail: "Hard contraindication",
        });
      } else if (frequency === "occasional" || frequency === "prn") {
        softContraindications.push({
          trigger: displayName,
          reason: "Occasional sleep medication",
          points: 1,
        });
        softScore += 1;
      }
      continue;
    }

    // Opioids - hard if chronic
    if (medication.category === "hard_if_chronic" && medication.type === "opioid") {
      if (chronicUse === true || frequency === "daily") {
        hardContraindications.push({
          trigger: displayName,
          reason: "Chronic opioid use",
          detail: "Hard contraindication",
        });
      }
      continue;
    }

    // Soft contraindications
    if (medication.category === "soft") {
      softContraindications.push({
        trigger: displayName,
        reason: medication.type.toUpperCase(),
        points: 1,
      });
      softScore += 1;
    }
  }

  // Substance use evaluation
  if (substanceUse.cannabis === "daily") {
    hardContraindications.push({
      trigger: "Cannabis",
      reason: "Daily use",
      detail: "Hard contraindication",
    });
  } else if (substanceUse.cannabis === "2_6_weekly") {
    softContraindications.push({
      trigger: "Cannabis",
      reason: "2\u20136x per week",
      points: 1,
    });
    softScore += 1;
  }

  if (substanceUse.alcohol === "daily") {
    hardContraindications.push({
      trigger: "Alcohol",
      reason: "Daily use",
      detail: "Hard contraindication",
    });
  } else if (substanceUse.alcohol === "less_6_weekly") {
    softContraindications.push({
      trigger: "Alcohol",
      reason: "<6 drinks per week",
      points: 1,
    });
    softScore += 1;
  }

  if (substanceUse.hardDrugs === "yes") {
    hardContraindications.push({
      trigger: "Hard drugs",
      reason: "Any use",
      detail: "Hard contraindication",
    });
  }

  // Age evaluation
  if (age !== null && age !== undefined && age !== "") {
    const ageNum = parseInt(age);
    if (ageNum < 26) {
      softContraindications.push({
        trigger: "Age",
        reason: `Under 26 (${ageNum})`,
        points: 1,
      });
      softScore += 1;
    }
    if (ageNum >= 80) {
      softContraindications.push({
        trigger: "Age",
        reason: `80 or older (${ageNum})`,
        points: 1,
      });
      softScore += 1;
    }
  }

  // Determine result
  let result: string;
  let resultColor: ScreeningResult["resultColor"];
  let nextAction: string;

  if (hardContraindications.length > 0) {
    result = "Red Light \u2014 Do Not Book Consult";
    resultColor = "red";
    nextAction = "Do not book";
  } else if (softScore >= 5) {
    result = "Red Light \u2014 Do Not Book Consult";
    resultColor = "red";
    nextAction = "Do not book";
  } else if (softScore >= 3) {
    result = "Yellow Light \u2014 MD Review Required";
    resultColor = "yellow";
    nextAction = "Route to MD";
  } else {
    result = "Green Light \u2014 Book Consult";
    resultColor = "green";
    nextAction = "Book consult";
  }

  return {
    result,
    resultColor,
    nextAction,
    hardContraindications,
    softContraindications,
    softScore,
    hasHardContraindication: hardContraindications.length > 0,
  };
}

export function generateSummary(screeningResult: ScreeningResult): string {
  const { result, hardContraindications, softContraindications, softScore } = screeningResult;

  let summary = `Client Medication Screen\nResult: ${result.split(" \u2014 ")[0]}\n\n`;

  summary += "Hard contraindications:\n";
  if (hardContraindications.length === 0) {
    summary += "\u2022 None\n";
  } else {
    for (const h of hardContraindications) {
      summary += `\u2022 ${h.trigger} \u2014 ${h.reason}\n`;
    }
  }

  summary += `\nSoft score: ${softScore}\n`;

  if (softContraindications.length > 0) {
    summary += "\nSoft triggers:\n";
    for (const s of softContraindications) {
      summary += `\u2022 ${s.trigger} \u2014 ${s.reason} (1 point)\n`;
    }
  }

  return summary;
}
