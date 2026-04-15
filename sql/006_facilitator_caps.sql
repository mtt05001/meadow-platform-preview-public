-- Weekly capacity overrides per facilitator (Admin Capacity dashboard)
CREATE TABLE IF NOT EXISTS facilitator_caps (
  facilitator_name TEXT PRIMARY KEY,
  week_cap INTEGER NOT NULL CHECK (week_cap >= 1 AND week_cap <= 10),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
