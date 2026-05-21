-- ============================================================
-- Trading Journal — Supabase Schema
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- Trades table
CREATE TABLE IF NOT EXISTS trades (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Identity
  source                   TEXT NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('MANUAL', 'MT5_IMPORT')),
  status                   TEXT NOT NULL DEFAULT 'COMPLETE' CHECK (status IN ('COMPLETE', 'PENDING_REVIEW')),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Factual trade data
  instrument               TEXT NOT NULL,
  direction                TEXT NOT NULL CHECK (direction IN ('LONG', 'SHORT')),
  entry_price              NUMERIC NOT NULL,
  exit_price               NUMERIC NOT NULL,
  entry_time               TIMESTAMPTZ NOT NULL,
  exit_time                TIMESTAMPTZ NOT NULL,
  lot_size                 NUMERIC NOT NULL,
  stop_loss                NUMERIC,
  take_profit              NUMERIC,
  commission               NUMERIC DEFAULT 0,
  swap                     NUMERIC DEFAULT 0,
  mt5_ticket_id            TEXT,
  mt5_profit               NUMERIC,

  -- Context (user fills in)
  timeframe                TEXT CHECK (timeframe IN ('1M','5M','15M','30M','1H','4H','D','W')),
  setup                    TEXT CHECK (setup IN ('BREAKOUT','REVERSAL','SUPPORT_RESISTANCE','TREND_FOLLOWING','RANGE','NEWS','OTHER')),
  notes                    TEXT,
  tags                     TEXT[],
  chart_image_base64       TEXT,
  account_balance_at_entry NUMERIC
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS trades_user_id_idx      ON trades(user_id);
CREATE INDEX IF NOT EXISTS trades_exit_time_idx    ON trades(exit_time DESC);
CREATE INDEX IF NOT EXISTS trades_instrument_idx   ON trades(instrument);
CREATE INDEX IF NOT EXISTS trades_status_idx       ON trades(status);
CREATE INDEX IF NOT EXISTS trades_mt5_ticket_idx   ON trades(mt5_ticket_id) WHERE mt5_ticket_id IS NOT NULL;

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trades_updated_at
  BEFORE UPDATE ON trades
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Row Level Security — users only see their own trades
-- ============================================================
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can SELECT their own trades"
  ON trades FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can INSERT their own trades"
  ON trades FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can UPDATE their own trades"
  ON trades FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can DELETE their own trades"
  ON trades FOR DELETE
  USING (auth.uid() = user_id);
