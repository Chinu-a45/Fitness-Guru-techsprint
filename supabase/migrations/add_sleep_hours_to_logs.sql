-- =====================================================================
-- Migration: Sleep hours + make weight optional in public.logs
-- Run this once in the Supabase SQL Editor:
--   https://supabase.com/dashboard/project/wrjiulqrmuljivltodfc/sql
-- =====================================================================

-- 1. Add sleep_hours column (idempotent)
ALTER TABLE public.logs
  ADD COLUMN IF NOT EXISTS sleep_hours NUMERIC(4, 2)
    CHECK (sleep_hours IS NULL OR (sleep_hours >= 0 AND sleep_hours <= 24));

-- 2. Make weight_kg optional (drop NOT NULL + fix CHECK to allow NULL)
ALTER TABLE public.logs
  ALTER COLUMN weight_kg DROP NOT NULL;

ALTER TABLE public.logs
  DROP CONSTRAINT IF EXISTS logs_weight_kg_check;

ALTER TABLE public.logs
  ADD CONSTRAINT logs_weight_kg_check
    CHECK (weight_kg IS NULL OR (weight_kg >= 30 AND weight_kg <= 250));

-- 3. Ensure at least one metric is filled (optional guardrail at DB level)
ALTER TABLE public.logs
  DROP CONSTRAINT IF EXISTS logs_at_least_one_metric;

ALTER TABLE public.logs
  ADD CONSTRAINT logs_at_least_one_metric
    CHECK (
      weight_kg IS NOT NULL OR
      waist_cm  IS NOT NULL OR
      sleep_hours IS NOT NULL
    );

-- 4. Index for sleep analytics
CREATE INDEX IF NOT EXISTS idx_logs_sleep ON public.logs(client_id, sleep_hours)
  WHERE sleep_hours IS NOT NULL;
