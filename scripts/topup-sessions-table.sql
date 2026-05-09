-- ============================================================================
-- Create topup_sessions table for idempotency tracking
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Table to track processed top-up Stripe sessions
-- Prevents duplicate item additions when confirm endpoint is called multiple times
CREATE TABLE IF NOT EXISTS topup_sessions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_session_id  text UNIQUE NOT NULL,
  order_id           uuid REFERENCES orders(id) ON DELETE CASCADE,
  created_at         timestamptz DEFAULT now()
);

-- Index for fast lookups by session ID
CREATE INDEX IF NOT EXISTS idx_topup_sessions_stripe_session_id ON topup_sessions(stripe_session_id);

-- RLS policies
ALTER TABLE topup_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all topup_sessions" ON topup_sessions FOR ALL USING (true) WITH CHECK (true);
