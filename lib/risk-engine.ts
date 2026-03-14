/**
 * Meadow Health Intake Risk Engine
 * Ported from health_intake_processor.py
 *
 * Deterministic triage:
 *   1. Extract client data from Jotform submission
 *   2. Scan for hard contraindications (regex)
 *   3. Score soft contraindications (point system)
 *   4. Assign risk tier
 */

import type { HardContraindication } from "./types";

// ---------------------------------------------------------------------------
// Hard Contraindication Lists
// ---------------------------------------------------------------------------

const HARD_PSYCH_CONDITIONS = [
  "bipolar i", "bipolar 1", "schizophrenia", "schizoaffective",
  "history of psychosis", "psychosis", "psychotic", "mania", "manic",
  "psychiatric hospitalization", "psych hospitalization",
  "suicidal intent", "suicide attempt", "active suicidal",
  "personality disorder", "borderline personality",
  "first-degree relative.*schizophrenia", "first-degree relative.*mania",
  "first-degree relative.*psychosis", "family.*schizophrenia",
  "family.*psychosis",
];

const HARD_MEDICAL_CONDITIONS = [
  "heart attack", "myocardial infarction",
  "arterial calcification",
  "unstable angina",
  "decompensated heart failure",
  "severe arrhythmia", "ventricular tachycardia", "ventricular fibrillation",
  "aortic aneurysm",
  "uncontrolled.*blood pressure", "bp.*160", "blood pressure.*160",
  "history of stroke", "stroke", "cerebrovascular accident",
  "seizure disorder", "epilepsy", "seizures",
  "neurodegenerative", "\\bals\\b", "huntington", "advanced parkinson",
  "advanced alzheimer",
  "severe liver disease", "cirrhosis", "hepatitis.*severe", "liver transplant",
  "end.stage renal", "dialysis", "kidney transplant",
  "severe copd", "pulmonary fibrosis", "supplemental oxygen",
  "severe respiratory",
  "active cancer.*chemo", "chemotherapy",
  "eating disorder.*bmi.*1[0-7]", "anorexia.*bmi",
  "pregnan", "breastfeeding", "nursing",
];

const HARD_MEDICATIONS = new Set([
  // Antipsychotics
  "haloperidol", "haldol", "fluphenazine", "prolixin", "trifluoperazine", "stelazine",
  "perphenazine", "trilafon", "pimozide", "orap", "loxapine", "loxitane",
  "molindone", "moban", "chlorpromazine", "thorazine", "thioridazine", "mellaril",
  "mesoridazine", "serentil", "periciazine",
  "risperidone", "risperdal", "paliperidone", "invega",
  "olanzapine", "zyprexa", "quetiapine", "seroquel",
  "clozapine", "clozaril", "aripiprazole", "abilify",
  "ziprasidone", "geodon", "lurasidone", "latuda",
  "cariprazine", "vraylar", "brexpiprazole", "rexulti",
  "asenapine", "saphris", "iloperidone", "fanapt",
  "lumateperone", "caplyta",
  // Mood stabilizers
  "lithium", "lithobid", "eskalith",
  "valproate", "divalproex", "depakote", "depakene", "valproic",
  "lamotrigine", "lamictal",
  "carbamazepine", "tegretol",
  "oxcarbazepine", "trileptal",
  "topiramate", "topamax",
  // MAOIs
  "phenelzine", "nardil", "tranylcypromine", "parnate",
  "selegiline", "emsam",
  // TCAs
  "amitriptyline", "elavil", "nortriptyline", "pamelor",
  "imipramine", "tofranil", "doxepin", "sinequan",
  "clomipramine", "anafranil", "mirtazapine", "remeron",
]);

const BENZO_NAMES = new Set([
  "alprazolam", "xanax", "lorazepam", "ativan",
  "clonazepam", "klonopin", "diazepam", "valium",
  "temazepam", "restoril",
]);

const SLEEP_MED_NAMES = new Set([
  "trazodone", "zolpidem", "ambien",
  "eszopiclone", "lunesta", "hydroxyzine",
]);

const HARD_SUBSTANCES = [
  "daily cannabis", "cannabis.*daily", "marijuana.*daily",
  "daily alcohol", "alcohol.*daily",
  "heroin", "methamphetamine", "meth", "cocaine", "crack",
  "fentanyl", "hard drugs",
];

const HARD_ENVIRONMENTAL = [
  "unstable.*housing", "transient.*housing", "homeless",
];

const ALLOWABLE_MEDS = new Set([
  "sertraline", "zoloft", "fluoxetine", "prozac",
  "escitalopram", "lexapro", "citalopram", "celexa",
  "paroxetine", "paxil",
  "venlafaxine", "effexor", "duloxetine", "cymbalta",
  "desvenlafaxine", "pristiq",
  "buspirone", "buspar",
  "adderall", "vyvanse", "ritalin", "concerta", "focalin",
  "strattera", "atomoxetine",
  "hydroxyzine", "diphenhydramine", "benadryl",
]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Medication {
  name: string;
  dose: string;
  frequency: string;
  since: string;
  reason: string;
}

export interface ClientData {
  name: string;
  email: string;
  dob: string;
  age: number | null;
  sex: string;
  height: string;
  weight: string;
  conditions: string;
  conditions_detail: string;
  allergies: string;
  surgeries: string;
  cardiac_family: string;
  alcohol: string;
  tobacco: string;
  cannabis: string;
  caffeine: string;
  substance_history: string;
  psych_conditions: string;
  current_therapy: string;
  phq9_raw: unknown;
  gad7_raw: unknown;
  difficulty: string;
  medications: Medication[];
  supplements: Medication[];
  purpose: string;
  obstacles: string;
  fears: string;
  psychedelic_history: string;
  living_situation: string;
  stability: string;
  sleep_hours: string;
  sleep_falling: string;
  sleep_waking: string;
  sleep_refreshed: string;
  address: unknown;
  submission_id: string;
  submitted_at: string;
}

// ---------------------------------------------------------------------------
// Jotform Data Extraction
// ---------------------------------------------------------------------------

function getAnswer(answers: Record<string, Record<string, unknown>>, qid: string): unknown {
  return answers[qid]?.answer ?? "";
}

function str(val: unknown): string {
  if (val == null) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  return JSON.stringify(val);
}

export function extractClientData(submission: Record<string, unknown>): ClientData {
  const answers = (submission.answers ?? {}) as Record<string, Record<string, unknown>>;

  // Name
  const nameAns = getAnswer(answers, "4");
  let name: string;
  if (typeof nameAns === "object" && nameAns !== null && !Array.isArray(nameAns)) {
    const n = nameAns as Record<string, string>;
    name = `${n.first ?? ""} ${n.last ?? ""}`.trim();
  } else {
    name = str(nameAns);
  }

  // DOB & Age
  const dobAns = getAnswer(answers, "101");
  let age: number | null = null;
  let dobStr = "";
  if (typeof dobAns === "object" && dobAns !== null && !Array.isArray(dobAns)) {
    const d = dobAns as Record<string, string>;
    try {
      const dob = new Date(Number(d.year), Number(d.month) - 1, Number(d.day));
      dobStr = dob.toISOString().split("T")[0];
      const today = new Date();
      age = today.getFullYear() - dob.getFullYear() -
        (today.getMonth() < dob.getMonth() ||
          (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate()) ? 1 : 0);
    } catch { /* ignore */ }
  }

  // Email
  const emailAns = getAnswer(answers, "105") || getAnswer(answers, "7") ||
    getAnswer(answers, "97") || getAnswer(answers, "98") || "";
  let email: string;
  if (typeof emailAns === "object" && emailAns !== null && !Array.isArray(emailAns)) {
    email = (emailAns as Record<string, string>).email ?? "";
  } else {
    email = str(emailAns).includes("@") ? str(emailAns) : "";
  }

  // Height/Weight
  let height = "";
  let weight = "";
  const heightRaw = getAnswer(answers, "8");
  const weightRaw = getAnswer(answers, "9");
  try {
    if (typeof heightRaw === "string" && heightRaw.startsWith("[")) {
      const h = JSON.parse(heightRaw.replace(/&amp;/g, "&"));
      height = h[0]?.["Feet & Inches"] ?? h[0]?.CM ?? "";
    } else if (Array.isArray(heightRaw)) {
      height = str(heightRaw[0]);
    } else {
      height = str(heightRaw);
    }
  } catch { height = str(heightRaw); }
  try {
    if (typeof weightRaw === "string" && weightRaw.startsWith("[")) {
      const w = JSON.parse(weightRaw);
      weight = w[0]?.Lbs ?? w[0]?.KGs ?? "";
    } else if (Array.isArray(weightRaw)) {
      weight = str(weightRaw[0]);
    } else {
      weight = str(weightRaw);
    }
  } catch { weight = str(weightRaw); }

  // Conditions
  let conditions = getAnswer(answers, "20");
  if (Array.isArray(conditions)) conditions = conditions.join("; ");

  // Medications (matrix field)
  const medsRaw = getAnswer(answers, "99");
  const medications: Medication[] = [];
  if (Array.isArray(medsRaw)) {
    for (const row of medsRaw) {
      if (Array.isArray(row) && row.some((c: unknown) => str(c).trim())) {
        const med: Medication = {
          name: str(row[0]).trim(),
          dose: str(row[1]).trim(),
          frequency: str(row[2]).trim(),
          since: str(row[3]).trim(),
          reason: str(row[4]).trim(),
        };
        if (med.name) medications.push(med);
      }
    }
  }

  // Supplements (matrix field)
  const suppsRaw = getAnswer(answers, "100");
  const supplements: Medication[] = [];
  if (Array.isArray(suppsRaw)) {
    for (const row of suppsRaw) {
      if (Array.isArray(row) && row.some((c: unknown) => str(c).trim())) {
        const supp: Medication = {
          name: str(row[0]).trim(),
          dose: str(row[1]).trim(),
          frequency: str(row[2]).trim(),
          since: str(row[3]).trim(),
          reason: str(row[4]).trim(),
        };
        if (supp.name) supplements.push(supp);
      }
    }
  }

  return {
    name,
    email,
    dob: dobStr,
    age,
    sex: str(getAnswer(answers, "6")),
    height,
    weight,
    conditions: str(conditions),
    conditions_detail: str(getAnswer(answers, "21")),
    allergies: str(getAnswer(answers, "22")),
    surgeries: str(getAnswer(answers, "23")),
    cardiac_family: str(getAnswer(answers, "25")),
    alcohol: str(getAnswer(answers, "28")),
    tobacco: str(getAnswer(answers, "30")),
    cannabis: str(getAnswer(answers, "31")),
    caffeine: str(getAnswer(answers, "32")),
    substance_history: str(getAnswer(answers, "33")),
    psych_conditions: str(getAnswer(answers, "35")),
    current_therapy: str(getAnswer(answers, "36")),
    phq9_raw: getAnswer(answers, "37"),
    gad7_raw: getAnswer(answers, "38"),
    difficulty: str(getAnswer(answers, "39")),
    medications,
    supplements,
    purpose: str(getAnswer(answers, "10")),
    obstacles: str(getAnswer(answers, "14")),
    fears: str(getAnswer(answers, "15")),
    psychedelic_history: str(getAnswer(answers, "17")),
    living_situation: str(getAnswer(answers, "58")),
    stability: str(getAnswer(answers, "62")),
    sleep_hours: str(getAnswer(answers, "80")),
    sleep_falling: str(getAnswer(answers, "81")),
    sleep_waking: str(getAnswer(answers, "82")),
    sleep_refreshed: str(getAnswer(answers, "83")),
    address: getAnswer(answers, "96"),
    submission_id: str(submission.id),
    submitted_at: str(submission.created_at),
  };
}

// ---------------------------------------------------------------------------
// Hard Contraindication Scanner (Deterministic)
// ---------------------------------------------------------------------------

export function scanHardContraindications(client: ClientData): HardContraindication[] {
  const flags: HardContraindication[] = [];

  // Build text blob to search
  const allText = [
    client.conditions, client.conditions_detail, client.psych_conditions,
    client.surgeries, client.substance_history, client.cardiac_family,
    client.living_situation, client.stability,
  ].join(" ").toLowerCase();

  // Medication text
  const medText = client.medications
    .map((m) => `${m.name} ${m.dose} ${m.frequency}`)
    .join(" ")
    .toLowerCase();

  // Psychiatric conditions
  for (const pattern of HARD_PSYCH_CONDITIONS) {
    if (new RegExp(pattern, "i").test(allText)) {
      flags.push({ category: "psychiatric", detail: `Pattern matched: ${pattern}` });
    }
  }

  // Medical conditions
  for (const pattern of HARD_MEDICAL_CONDITIONS) {
    if (new RegExp(pattern, "i").test(allText)) {
      flags.push({ category: "medical", detail: `Pattern matched: ${pattern}` });
    }
  }

  // Hard medications
  for (const medName of HARD_MEDICATIONS) {
    if (medText.includes(medName)) {
      flags.push({ category: "medication", detail: `Disqualifying medication: ${medName}` });
    }
  }

  // Benzos — check if daily/frequent
  for (const benzo of BENZO_NAMES) {
    if (medText.includes(benzo)) {
      for (const m of client.medications) {
        if (m.name.toLowerCase().includes(benzo)) {
          const freq = m.frequency.toLowerCase();
          if (["daily", "every day", "7", "6", "5"].some((w) => freq.includes(w))) {
            flags.push({ category: "medication", detail: `Daily benzo: ${benzo}` });
          }
        }
      }
    }
  }

  // Sleep meds — check if nightly/frequent
  for (const sleepMed of SLEEP_MED_NAMES) {
    if (medText.includes(sleepMed)) {
      for (const m of client.medications) {
        if (m.name.toLowerCase().includes(sleepMed)) {
          const freq = m.frequency.toLowerCase();
          if (["daily", "nightly", "every night", "7", "6", "5"].some((w) => freq.includes(w))) {
            flags.push({ category: "medication", detail: `Nightly sleep med: ${sleepMed}` });
          }
        }
      }
    }
  }

  // Substances
  const substanceText = [client.alcohol, client.cannabis, client.substance_history]
    .join(" ")
    .toLowerCase();

  for (const pattern of HARD_SUBSTANCES) {
    if (new RegExp(pattern, "i").test(`${substanceText} ${allText}`)) {
      flags.push({ category: "substance", detail: `Pattern matched: ${pattern}` });
    }
  }

  // Environmental
  for (const pattern of HARD_ENVIRONMENTAL) {
    if (new RegExp(pattern, "i").test(allText)) {
      flags.push({ category: "environmental", detail: `Pattern matched: ${pattern}` });
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  return flags.filter((f) => {
    if (seen.has(f.detail)) return false;
    seen.add(f.detail);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Soft Contraindication Scoring
// ---------------------------------------------------------------------------

export function scoreSoftContraindications(
  client: ClientData,
): { score: number; details: string[] } {
  let score = 0;
  const details: string[] = [];

  // Age <26 or >80
  if (client.age != null) {
    if (client.age < 26) {
      score += 2;
      details.push(`Age ${client.age} (<26)`);
    } else if (client.age > 80) {
      score += 2;
      details.push(`Age ${client.age} (>80)`);
    }
  }

  // Alcohol >6 drinks/week
  const alcohol = client.alcohol.toLowerCase();
  const nums = alcohol.match(/(\d+)/);
  if (nums) {
    const drinks = parseInt(nums[1], 10);
    if (drinks > 6) {
      score += 2;
      details.push(`Alcohol: ${drinks} drinks/week (>6)`);
    }
  } else if (["moderate", "several", "frequent"].some((w) => alcohol.includes(w))) {
    score += 1;
    details.push(`Alcohol use noted: ${client.alcohol}`);
  }

  // Cannabis use (>5x/week but not daily)
  const cannabis = client.cannabis.toLowerCase();
  if (["frequent", "5", "6", "most days"].some((w) => cannabis.includes(w))) {
    score += 2;
    details.push(`Cannabis use noted: ${client.cannabis}`);
  }

  // 2+ psych meds → auto-disqualify (score 10)
  let psychMedCount = 0;
  for (const m of client.medications) {
    const medName = m.name.toLowerCase();
    for (const allowed of ALLOWABLE_MEDS) {
      if (medName.includes(allowed)) {
        psychMedCount++;
        break;
      }
    }
  }
  if (psychMedCount >= 2) {
    score = 10;
    details.push(`2+ psychiatric medications (${psychMedCount} found) — auto-disqualify`);
  }

  return { score, details };
}

// ---------------------------------------------------------------------------
// Risk Tier Assignment
// ---------------------------------------------------------------------------

export function assignRiskTier(
  hardFlags: HardContraindication[],
  softScore: number,
): { tier: "red" | "yellow" | "green"; explanation: string } {
  if (hardFlags.length > 0) {
    return { tier: "red", explanation: "Hard contraindication(s) found — auto-disqualified" };
  }
  if (softScore >= 5) {
    return { tier: "red", explanation: "High soft contraindication score (>=5)" };
  }
  if (softScore >= 2) {
    return { tier: "yellow", explanation: "Moderate soft contraindication score (2-4)" };
  }
  return { tier: "green", explanation: "No contraindications — cleared for review" };
}
