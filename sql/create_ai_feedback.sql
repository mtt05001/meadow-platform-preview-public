CREATE TABLE IF NOT EXISTS ai_feedback (
  id SERIAL PRIMARY KEY,
  intake_id TEXT NOT NULL REFERENCES intakes(id) ON DELETE CASCADE,
  feedback_type TEXT NOT NULL,
  feedback_text TEXT NOT NULL,
  reviewer TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_feedback_intake ON ai_feedback(intake_id);
