// Complete medication database with categories and contraindication rules

export interface Medication {
  name: string;
  brandNames: string[];
  category: "hard_always" | "hard_if_daily" | "hard_if_nightly" | "hard_if_chronic" | "soft";
  type: string;
}

export interface MedicationEntry {
  medication: Medication;
  frequency: string | null;
  dailyUse: boolean | null;
  chronicUse: boolean | null;
}

export const MEDICATION_DATABASE: Medication[] = [
  // HARD CONTRAINDICATIONS - Always Hard
  { name: "Buspirone", brandNames: ["Buspar"], category: "hard_always", type: "anxiolytic" },
  { name: "Mirtazapine", brandNames: ["Remeron"], category: "hard_always", type: "antidepressant" },

  // Antipsychotics (Hard)
  { name: "Haloperidol", brandNames: ["Haldol"], category: "hard_always", type: "antipsychotic" },
  { name: "Fluphenazine", brandNames: ["Prolixin"], category: "hard_always", type: "antipsychotic" },
  { name: "Trifluoperazine", brandNames: ["Stelazine"], category: "hard_always", type: "antipsychotic" },
  { name: "Perphenazine", brandNames: ["Trilafon"], category: "hard_always", type: "antipsychotic" },
  { name: "Pimozide", brandNames: ["Orap"], category: "hard_always", type: "antipsychotic" },
  { name: "Loxapine", brandNames: ["Loxitane"], category: "hard_always", type: "antipsychotic" },
  { name: "Molindone", brandNames: ["Moban"], category: "hard_always", type: "antipsychotic" },
  { name: "Chlorpromazine", brandNames: ["Thorazine"], category: "hard_always", type: "antipsychotic" },
  { name: "Thioridazine", brandNames: ["Mellaril"], category: "hard_always", type: "antipsychotic" },
  { name: "Mesoridazine", brandNames: ["Serentil"], category: "hard_always", type: "antipsychotic" },
  { name: "Periciazine", brandNames: ["Neuleptil"], category: "hard_always", type: "antipsychotic" },
  { name: "Risperidone", brandNames: ["Risperdal"], category: "hard_always", type: "antipsychotic" },
  { name: "Paliperidone", brandNames: ["Invega"], category: "hard_always", type: "antipsychotic" },
  { name: "Olanzapine", brandNames: ["Zyprexa"], category: "hard_always", type: "antipsychotic" },
  { name: "Quetiapine", brandNames: ["Seroquel"], category: "hard_always", type: "antipsychotic" },
  { name: "Clozapine", brandNames: ["Clozaril"], category: "hard_always", type: "antipsychotic" },
  { name: "Aripiprazole", brandNames: ["Abilify"], category: "hard_always", type: "antipsychotic" },
  { name: "Ziprasidone", brandNames: ["Geodon"], category: "hard_always", type: "antipsychotic" },
  { name: "Lurasidone", brandNames: ["Latuda"], category: "hard_always", type: "antipsychotic" },
  { name: "Cariprazine", brandNames: ["Vraylar"], category: "hard_always", type: "antipsychotic" },
  { name: "Brexpiprazole", brandNames: ["Rexulti"], category: "hard_always", type: "antipsychotic" },
  { name: "Asenapine", brandNames: ["Saphris"], category: "hard_always", type: "antipsychotic" },
  { name: "Iloperidone", brandNames: ["Fanapt"], category: "hard_always", type: "antipsychotic" },
  { name: "Lumateperone", brandNames: ["Caplyta"], category: "hard_always", type: "antipsychotic" },

  // Mood Stabilizers (Hard)
  { name: "Lithium", brandNames: [], category: "hard_always", type: "mood_stabilizer" },
  { name: "Valproate", brandNames: ["Depakote", "Divalproex"], category: "hard_always", type: "mood_stabilizer" },
  { name: "Lamotrigine", brandNames: ["Lamictal"], category: "hard_always", type: "mood_stabilizer" },
  { name: "Carbamazepine", brandNames: ["Tegretol"], category: "hard_always", type: "mood_stabilizer" },
  { name: "Oxcarbazepine", brandNames: ["Trileptal"], category: "hard_always", type: "mood_stabilizer" },
  { name: "Topiramate", brandNames: ["Topamax"], category: "hard_always", type: "mood_stabilizer" },

  // MAOIs (Hard)
  { name: "Phenelzine", brandNames: ["Nardil"], category: "hard_always", type: "maoi" },
  { name: "Tranylcypromine", brandNames: ["Parnate"], category: "hard_always", type: "maoi" },
  { name: "Selegiline patch", brandNames: ["Emsam"], category: "hard_always", type: "maoi" },

  // TCAs (Hard)
  { name: "Amitriptyline", brandNames: ["Elavil"], category: "hard_always", type: "tca" },
  { name: "Nortriptyline", brandNames: ["Pamelor", "Aventyl"], category: "hard_always", type: "tca" },
  { name: "Imipramine", brandNames: ["Tofranil"], category: "hard_always", type: "tca" },
  { name: "Doxepin", brandNames: ["Sinequan", "Silenor"], category: "hard_always", type: "tca" },
  { name: "Clomipramine", brandNames: ["Anafranil"], category: "hard_always", type: "tca" },

  // Benzodiazepines (Hard if daily)
  { name: "Alprazolam", brandNames: ["Xanax"], category: "hard_if_daily", type: "benzodiazepine" },
  { name: "Lorazepam", brandNames: ["Ativan"], category: "hard_if_daily", type: "benzodiazepine" },
  { name: "Clonazepam", brandNames: ["Klonopin"], category: "hard_if_daily", type: "benzodiazepine" },
  { name: "Diazepam", brandNames: ["Valium"], category: "hard_if_daily", type: "benzodiazepine" },
  { name: "Temazepam", brandNames: ["Restoril"], category: "hard_if_daily", type: "benzodiazepine" },

  // Nightly Sleep Meds (Hard if nightly)
  { name: "Trazodone", brandNames: [], category: "hard_if_nightly", type: "sleep_med" },
  { name: "Zolpidem", brandNames: ["Ambien"], category: "hard_if_nightly", type: "sleep_med" },
  { name: "Eszopiclone", brandNames: ["Lunesta"], category: "hard_if_nightly", type: "sleep_med" },
  { name: "Hydroxyzine", brandNames: [], category: "hard_if_nightly", type: "sleep_med" },

  // Opioids (Hard if chronic)
  { name: "Oxycodone", brandNames: [], category: "hard_if_chronic", type: "opioid" },
  { name: "Hydrocodone", brandNames: [], category: "hard_if_chronic", type: "opioid" },
  { name: "Morphine", brandNames: [], category: "hard_if_chronic", type: "opioid" },
  { name: "Fentanyl patch", brandNames: [], category: "hard_if_chronic", type: "opioid" },
  { name: "Methadone", brandNames: [], category: "hard_if_chronic", type: "opioid" },
  { name: "Buprenorphine", brandNames: [], category: "hard_if_chronic", type: "opioid" },
  { name: "Buprenorphine/naloxone", brandNames: ["Suboxone"], category: "hard_if_chronic", type: "opioid" },
  { name: "Codeine", brandNames: [], category: "hard_if_chronic", type: "opioid" },
  { name: "Tramadol", brandNames: [], category: "hard_if_chronic", type: "opioid" },

  // SOFT CONTRAINDICATIONS (1 point each)
  // SSRIs
  { name: "Sertraline", brandNames: ["Zoloft"], category: "soft", type: "ssri" },
  { name: "Fluoxetine", brandNames: ["Prozac"], category: "soft", type: "ssri" },
  { name: "Escitalopram", brandNames: ["Lexapro"], category: "soft", type: "ssri" },
  { name: "Citalopram", brandNames: ["Celexa"], category: "soft", type: "ssri" },
  { name: "Paroxetine", brandNames: ["Paxil"], category: "soft", type: "ssri" },

  // SNRIs
  { name: "Venlafaxine", brandNames: ["Effexor"], category: "soft", type: "snri" },
  { name: "Duloxetine", brandNames: ["Cymbalta"], category: "soft", type: "snri" },
  { name: "Desvenlafaxine", brandNames: ["Pristiq"], category: "soft", type: "snri" },

  // Stimulants
  { name: "Amphetamine/dextroamphetamine", brandNames: ["Adderall"], category: "soft", type: "stimulant" },
  { name: "Lisdexamfetamine", brandNames: ["Vyvanse"], category: "soft", type: "stimulant" },
  { name: "Methylphenidate", brandNames: ["Ritalin", "Concerta"], category: "soft", type: "stimulant" },

  // Other Soft
  { name: "Gabapentin", brandNames: ["Neurontin"], category: "soft", type: "other" },
  { name: "Pregabalin", brandNames: ["Lyrica"], category: "soft", type: "other" },
  { name: "Bupropion", brandNames: ["Wellbutrin"], category: "soft", type: "other" },
];

export const FREQUENCY_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "nightly", label: "Nightly" },
  { value: "prn", label: "PRN / As needed" },
  { value: "occasional", label: "Occasional" },
  { value: "not_taking", label: "Not currently taking" },
] as const;

export const CANNABIS_OPTIONS = [
  { value: "none", label: "None" },
  { value: "occasional", label: "Occasional" },
  { value: "2_6_weekly", label: "2\u20136x per week" },
  { value: "daily", label: "Daily" },
] as const;

export const ALCOHOL_OPTIONS = [
  { value: "none", label: "None" },
  { value: "less_6_weekly", label: "<6 drinks per week" },
  { value: "daily", label: "Daily" },
] as const;

export const HARD_DRUG_OPTIONS = [
  { value: "no", label: "No" },
  { value: "yes", label: "Yes" },
] as const;

export function getMedicationDisplayName(med: Medication): string {
  if (med.brandNames.length > 0) {
    return `${med.name} (${med.brandNames[0]})`;
  }
  return med.name;
}

export function searchMedications(query: string): Medication[] {
  const lowerQuery = query.toLowerCase();
  return MEDICATION_DATABASE.filter((med) => {
    const nameMatch = med.name.toLowerCase().includes(lowerQuery);
    const brandMatch = med.brandNames.some((brand) =>
      brand.toLowerCase().includes(lowerQuery),
    );
    return nameMatch || brandMatch;
  });
}

export function getCategoryLabel(category: Medication["category"]): string {
  switch (category) {
    case "hard_always": return "Hard";
    case "hard_if_daily": return "Hard if daily";
    case "hard_if_nightly": return "Hard if nightly";
    case "hard_if_chronic": return "Hard if chronic";
    case "soft": return "Soft";
  }
}

export function getCategoryDetailLabel(category: Medication["category"]): string {
  switch (category) {
    case "hard_always": return "Hard contraindication";
    case "hard_if_daily": return "Hard if daily use";
    case "hard_if_nightly": return "Hard if nightly use";
    case "hard_if_chronic": return "Hard if chronic use";
    case "soft": return "Soft contraindication (1 point)";
  }
}
