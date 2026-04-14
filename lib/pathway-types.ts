export type PathwayOutcome = "discovery_call" | "nurture" | "disqualified";

export interface PathwayAnswers {
  email: string;
  primary_reason: string | null;
  readiness: string | null;
  medical_flags: string[];
  psych_flags: string[];
  can_travel: boolean | null;
  financial_ready: string | null;
  best_case: string | null;
  attribution: string | null;
}

export interface PathwayBookingInfo {
  first_name: string;
  last_name: string;
  phone: string;
  booking_id: string | null;
}

export interface PathwayMedication {
  name: string;
  dosage: string;
  duration: string;
  isCustom: boolean;
}

export interface PathwayState {
  currentStep: number;
  answers: PathwayAnswers;
  booking: PathwayBookingInfo;
  medications: PathwayMedication[];
  additionalNotes: string;
  routedOutcome: PathwayOutcome | null;
  completedAt: string | null;
}

export const INITIAL_PATHWAY_STATE: PathwayState = {
  currentStep: 1,
  answers: {
    email: "",
    primary_reason: null,
    readiness: null,
    medical_flags: [],
    psych_flags: [],
    can_travel: null,
    financial_ready: null,
    best_case: null,
    attribution: null,
  },
  booking: {
    first_name: "",
    last_name: "",
    phone: "",
    booking_id: null,
  },
  medications: [],
  additionalNotes: "",
  routedOutcome: null,
  completedAt: null,
};

export const REASON_OPTIONS = [
  { value: "anxiety_depression", label: "Anxiety, depression, or burnout" },
  { value: "purpose_clarity", label: "Purpose, clarity, or spiritual growth" },
  { value: "trauma", label: "Trauma healing" },
  { value: "chronic_pain", label: "Chronic pain or physical distress" },
] as const;

export const READINESS_OPTIONS = [
  { value: "ready", label: "I feel deeply ready and committed" },
  { value: "curious", label: "I'm open and curious but feeling some hesitation" },
  { value: "overwhelmed", label: "I want to heal but I feel emotionally unsure or overwhelmed right now" },
] as const;

export const MEDICAL_CONDITIONS = [
  { value: "dementia", label: "Dementia" },
  { value: "seizure_disorder", label: "Seizure disorder" },
  { value: "active_cancer", label: "Active cancer treatment" },
  { value: "stroke", label: "Stroke (in last 6 months)" },
  { value: "aneurysm", label: "Aortic or brain aneurysm" },
  { value: "heart_attack", label: "Heart attack (in last 6 months)" },
  { value: "unstable_angina", label: "Unstable angina or heart failure" },
  { value: "none", label: "None of the above" },
] as const;

export const PSYCH_CONDITIONS = [
  { value: "bipolar_i", label: "Bipolar I" },
  { value: "psychosis", label: "Psychosis or hallucinations" },
  { value: "bpd", label: "Borderline personality disorder" },
  { value: "schizophrenia", label: "Schizophrenia or schizoaffective disorder" },
  { value: "none", label: "None of the above" },
] as const;

export const TRAVEL_OPTIONS = [
  { value: "yes", label: "Yes, I can travel" },
  { value: "no", label: "No, I cannot travel to Portland" },
] as const;

export const FINANCIAL_OPTIONS = [
  { value: "ready", label: "I have the means and feel ready to invest if it's a fit" },
  { value: "credit_plan", label: "I would need to use credit or a payment plan to make it work" },
  { value: "no_means", label: "I don't currently have the financial means, but I'm curious" },
] as const;

export const ATTRIBUTION_OPTIONS = [
  { value: "google", label: "Google search" },
  { value: "oha", label: "Oregon Health Authority database" },
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "facebook", label: "Facebook" },
  { value: "podcast", label: "Podcast" },
  { value: "therapist", label: "Therapist / Clinician" },
  { value: "friend", label: "Friend or family" },
] as const;

export const MED_DURATION_OPTIONS = [
  { value: "less_1_month", label: "Less than 1 month" },
  { value: "1_6_months", label: "1–6 months" },
  { value: "6_12_months", label: "6–12 months" },
  { value: "1_plus_years", label: "1+ years" },
] as const;

export const STEP_ROUTES = [
  "/pathway",            // 1: email + OTP
  "/pathway/reason",     // 2: primary reason
  "/pathway/readiness",  // 3: readiness
  "/pathway/medical",    // 4: medical conditions
  "/pathway/psychiatric",// 5: psychiatric diagnoses
  "/pathway/travel",     // 6: travel
  "/pathway/financial",  // 7: financial
  "/pathway/vision",     // 8: best case (optional)
  "/pathway/attribution",// 9: attribution
] as const;

export const TOTAL_STEPS = STEP_ROUTES.length;
