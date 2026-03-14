export interface HardContraindication {
  category: string;
  detail: string;
}

export interface AiOutput {
  email: string;
  risk_stratification: string;
  raw_response?: string;
}

export interface Intake {
  id: string;
  name: string;
  email: string;
  submitted_at: string | null;
  risk_tier: "red" | "yellow" | "green" | "unknown";
  status: "pending" | "sending" | "approved" | "rejected" | "archived";
  hard_contraindications: HardContraindication[];
  soft_score: number;
  soft_details: string[];
  risk_tier_explanation: string;
  ghl_hi_status: string;
  ghl_oha_status: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string | null;
  edited_risk_strat: string | null;
  prep1_date: string | null;
  facilitator: string | null;
  client_data: Record<string, unknown>;
  ai_output: AiOutput | Record<string, never>;
  jotform_data: Record<string, unknown>;
}
