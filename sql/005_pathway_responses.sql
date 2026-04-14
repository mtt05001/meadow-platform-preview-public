-- Pathway qualifier responses (one row per user, upserted on every step)
CREATE TABLE IF NOT EXISTS pathway_responses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  current_step    INT NOT NULL DEFAULT 1,
  completed_at    TIMESTAMPTZ,

  -- Step answers
  primary_reason  TEXT,
  readiness       TEXT,
  medical_flags   TEXT[] DEFAULT '{}',
  psych_flags     TEXT[] DEFAULT '{}',
  can_travel      BOOLEAN,
  financial_ready TEXT,
  best_case       TEXT,
  attribution     TEXT,

  -- Routing result
  routed_outcome  TEXT CHECK (routed_outcome IN (
                    'discovery_call', 'nurture', 'disqualified'
                  )),

  -- Post-routing data (discovery path)
  first_name      TEXT,
  last_name       TEXT,
  phone           TEXT,
  medications     JSONB DEFAULT '[]',
  additional_notes TEXT,
  booking_id      TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_pathway_user UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_pathway_responses_user
  ON pathway_responses (user_id);
