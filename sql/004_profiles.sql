-- Prospect profiles for the pathway flow (extends Supabase Auth users)
CREATE TABLE IF NOT EXISTS profiles (
  id              UUID PRIMARY KEY,
  email           TEXT NOT NULL,
  first_name      TEXT,
  last_name       TEXT,
  phone           TEXT,
  role            TEXT NOT NULL DEFAULT 'prospect'
                  CHECK (role IN ('prospect', 'client', 'admin')),
  pathway_status  TEXT NOT NULL DEFAULT 'in_progress'
                  CHECK (pathway_status IN (
                    'in_progress', 'discovery_call', 'nurture', 'disqualified'
                  )),
  ghl_contact_id  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email_lower
  ON profiles (LOWER(email));
