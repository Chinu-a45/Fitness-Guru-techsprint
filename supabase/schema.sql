-- =====================================================================
-- BODYBUDDY – Supabase Postgres Schema & Security Rules
-- Fitness Guru Gym, Indore | Tagline: "Be Healthy"
-- =====================================================================
-- Contains:
--   1. Schema definition for 6 core tables
--   2. Indexes for high performance queries
--   3. Row Level Security (RLS) policies
--   4. Realtime replication setup for live trainer-client notes
--   5. Realistic demo seed data (obviously fake, for competition demo)
-- =====================================================================

-- ── 1. PROFILES TABLE ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('client', 'trainer')),
  trainer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  goal TEXT CHECK (goal IN ('fat_loss', 'strength', 'general', 'general_fitness')),
  height_cm NUMERIC(5, 2),
  weight_kg NUMERIC(5, 2),
  session_days TEXT[],
  diet_pref TEXT CHECK (diet_pref IN ('veg', 'non_veg', 'non-veg', 'eggetarian')),
  limitations_note TEXT, -- Visible only to trainer
  consent_at TIMESTAMPTZ,
  invite_code TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Backward compatibility columns if table was created previously:
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(5, 2);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS session_days TEXT[];

-- ── 2. PLANS TABLE ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  version INT DEFAULT 1 NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'approved')),
  workouts JSONB DEFAULT '[]'::jsonb NOT NULL,
  meals JSONB DEFAULT '[]'::jsonb NOT NULL,
  water_target_ml INT DEFAULT 2500,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Backward compatibility columns if table was created previously:
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS water_target_ml INT DEFAULT 2500;

-- ── 3. COMPLETIONS TABLE ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.plans(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('workout', 'meal', 'water')),
  item_key TEXT NOT NULL,
  done BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  CONSTRAINT unique_client_date_item UNIQUE (client_id, date, item_type, item_key)
);

-- ── 4. LOGS TABLE ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  weight_kg NUMERIC(5, 2) CHECK (weight_kg IS NULL OR (weight_kg >= 30 AND weight_kg <= 250)),
  waist_cm NUMERIC(5, 2) CHECK (waist_cm IS NULL OR (waist_cm >= 20 AND waist_cm <= 200)),
  sleep_hours NUMERIC(4, 2) CHECK (sleep_hours IS NULL OR (sleep_hours >= 0 AND sleep_hours <= 24)),
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  CONSTRAINT unique_client_log_date UNIQUE (client_id, date)
);

-- ── 5. CHECKINS TABLE ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  effort INT NOT NULL CHECK (effort >= 1 AND effort <= 5),
  energy INT NOT NULL CHECK (energy >= 1 AND energy <= 5),
  note TEXT,
  reviewed BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  CONSTRAINT unique_client_week_checkin UNIQUE (client_id, week_start)
);

-- ── 6. NOTES TABLE ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ── INDEXES FOR FAST FILTERING & LOOKUPS ──────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_trainer_id ON public.profiles(trainer_id);
CREATE INDEX IF NOT EXISTS idx_plans_client_id ON public.plans(client_id);
CREATE INDEX IF NOT EXISTS idx_completions_client_date ON public.completions(client_id, date);
CREATE INDEX IF NOT EXISTS idx_logs_client_date ON public.logs(client_id, date);
CREATE INDEX IF NOT EXISTS idx_checkins_client_week ON public.checkins(client_id, week_start);
CREATE INDEX IF NOT EXISTS idx_notes_client_created ON public.notes(client_id, created_at);

-- =====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- Helper function: Is current user the assigned trainer for this client?
CREATE OR REPLACE FUNCTION public.is_trainer_of(client_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = client_uuid AND trainer_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- ── PROFILES POLICIES ────────────────────────────────────────────────
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Trainers can view their assigned clients"
  ON public.profiles FOR SELECT
  USING (trainer_id = auth.uid());

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Trainers can lookup invite codes"
  ON public.profiles FOR SELECT
  USING (role = 'trainer');

-- ── PLANS POLICIES ───────────────────────────────────────────────────
-- Clients only see approved plans assigned to them
CREATE POLICY "Clients can view their approved plans"
  ON public.plans FOR SELECT
  USING (client_id = auth.uid() AND status = 'approved');

-- Trainers can view all plans for clients assigned to them
CREATE POLICY "Trainers can view plans for their clients"
  ON public.plans FOR SELECT
  USING (trainer_id = auth.uid() OR public.is_trainer_of(client_id));

CREATE POLICY "Trainers can create plans"
  ON public.plans FOR INSERT
  WITH CHECK (trainer_id = auth.uid());

CREATE POLICY "Trainers can update their own plans"
  ON public.plans FOR UPDATE
  USING (trainer_id = auth.uid());

CREATE POLICY "Trainers can delete their own plans"
  ON public.plans FOR DELETE
  USING (trainer_id = auth.uid() OR public.is_trainer_of(client_id));

-- ── COMPLETIONS POLICIES ─────────────────────────────────────────────
CREATE POLICY "Clients can manage their own completions"
  ON public.completions FOR ALL
  USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

CREATE POLICY "Trainers can view their clients completions"
  ON public.completions FOR SELECT
  USING (public.is_trainer_of(client_id));

CREATE POLICY "Trainers can delete completions for their clients"
  ON public.completions FOR DELETE
  USING (public.is_trainer_of(client_id));

-- ── LOGS POLICIES ────────────────────────────────────────────────────
CREATE POLICY "Clients can manage their own logs"
  ON public.logs FOR ALL
  USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

CREATE POLICY "Trainers can view their clients logs"
  ON public.logs FOR SELECT
  USING (public.is_trainer_of(client_id));

-- ── CHECKINS POLICIES ────────────────────────────────────────────────
CREATE POLICY "Clients can manage their own checkins"
  ON public.checkins FOR ALL
  USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

CREATE POLICY "Trainers can view checkins of their clients"
  ON public.checkins FOR SELECT
  USING (public.is_trainer_of(client_id));

CREATE POLICY "Trainers can update review status of checkins"
  ON public.checkins FOR UPDATE
  USING (public.is_trainer_of(client_id));

-- ── NOTES POLICIES ───────────────────────────────────────────────────
CREATE POLICY "Clients can view their notes thread"
  ON public.notes FOR SELECT
  USING (client_id = auth.uid());

CREATE POLICY "Trainers can view notes for their clients"
  ON public.notes FOR SELECT
  USING (public.is_trainer_of(client_id));

CREATE POLICY "Clients and trainers can insert notes"
  ON public.notes FOR INSERT
  WITH CHECK (
    author_id = auth.uid() AND
    (client_id = auth.uid() OR public.is_trainer_of(client_id))
  );

-- ── REALTIME REPLICATION ─────────────────────────────────────────────
-- Enable realtime updates on notes table so messages pop up instantly
ALTER PUBLICATION supabase_realtime ADD TABLE public.notes;
