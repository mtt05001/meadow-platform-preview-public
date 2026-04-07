export interface McEvent {
  time: string;
  sort_key: string;
  type: string;
  name: string;
  facilitator: string | null;
  journey: string;
  hi: string;
  oha: string;
  status: "green" | "yellow" | "red";
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
