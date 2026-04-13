export interface McEvent {
  time: string;
  sort_key: string;
  type: string;
  name: string;
  facilitator: string | null;
  journey: string;
  hi: string;
  oha: string;
  hi_needed: boolean;
  oha_needed: boolean;
  program: string;
  consult_note: string;
  consult_needed: boolean;
  status: "green" | "yellow" | "red";
  medically_complex?: boolean;
}

export interface McDay {
  date: string;
  events: McEvent[];
}

export interface McAlert {
  name: string;
  type: string;
  issue: string;
}

export interface McStats {
  journeys: number;
  rooms: number;
  preps: number;
  integration: number;
  alerts: number;
  total: number;
}

export interface McData {
  generated: string;
  stats: McStats;
  days: McDay[];
  alerts: McAlert[];
}
