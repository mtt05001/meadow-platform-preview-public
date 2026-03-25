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

export interface AiFeedback {
  id: number;
  intake_id: string;
  feedback_type: string;
  feedback_text: string;
  reviewer: string;
  created_at: string;
}

export interface Client {
  opp_id: string;
  contact_id: string;
  name: string;
  email: string;
  phone: string;
  stage_id: string;
  stage_name: string;
  stage_order: number;
  stage_group: "onboarding" | "prep" | "journey" | "integration" | "done";
  facilitator: string;
  facilitator_email: string;
  prep1: string;
  prep2: string;
  ip_prep: string;
  journey: string;
  ip_integ: string;
  integ1: string;
  integ2: string;
  hi_status: string;
  oha_status: string;
  chart_status: string;
  intake_id: string | null;
  risk_tier: "red" | "yellow" | "green" | "unknown" | "";
  risk_explanation: string;
  hard_contra: HardContraindication[];
  soft_score: number;
  soft_details: string[];
  edited_risk_strat: string;
  approved_by: string;
  approved_at: string;
  intake_url: string;
}

export interface ClientCache {
  clients: Client[];
  last_synced: string;
  total: number;
}

// GHL Calendar API types

export interface GHLCalendarTeamMember {
  userId: string;
  priority?: number;
  isPrimary?: boolean;
}

export interface GHLCalendar {
  id: string;
  locationId: string;
  name: string;
  calendarType: string;
  slug?: string;
  widgetSlug: string;
  widgetType?: string;
  isActive: boolean;
  groupId?: string;
  description?: string;
  eventTitle?: string;
  slotDuration: number;
  slotDurationUnit?: string;
  teamMembers: GHLCalendarTeamMember[];
}

export interface GHLCalendarGroup {
  id: string;
  locationId?: string;
  name: string;
  description?: string;
  slug: string;
  isActive: boolean;
}
