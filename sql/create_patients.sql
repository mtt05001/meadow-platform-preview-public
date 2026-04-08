-- Step 1 of the patient-centric data model.
-- `patients` is the canonical local record of a person. Populated lazily
-- (upserted whenever we resolve a GHL contact id). Future features (clinical
-- flags, consent, etc.) hang off this table instead of creating new ones.
CREATE TABLE IF NOT EXISTS patients (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ghl_contact_id    TEXT UNIQUE NOT NULL,
  email             TEXT,
  name              TEXT,
  medically_complex TEXT NOT NULL DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS patients_email_idx ON patients (email);
