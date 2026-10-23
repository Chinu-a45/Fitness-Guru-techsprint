-- =====================================================================
-- BODYBUDDY – Demo Seed Data (COMPETITION DEMO ONLY)
-- Fitness Guru Gym, Indore | Tagline: "Be Healthy"
--
-- Note: All seed data is obviously fake and created solely for
-- business competition product demonstration.
-- =====================================================================

-- To use this seed data:
-- 1. Create two auth users in Supabase Auth (e.g. trainer@gurugym.fake and client@gurugym.fake)
-- 2. Substitute their Auth UUIDs into TRAINER_UUID and CLIENT_UUID below, or execute directly.

DO $$
DECLARE
  v_trainer_id UUID := '00000000-0000-0000-0000-000000000001';
  v_client_1   UUID := '00000000-0000-0000-0000-000000000002';
  v_client_2   UUID := '00000000-0000-0000-0000-000000000003';
  v_plan_1     UUID := gen_random_uuid();
  v_plan_2     UUID := gen_random_uuid();
  v_today      DATE := CURRENT_DATE;
BEGIN
  -- 1. Insert Demo Auth Users (Allows direct login with email/password)
  -- Passwords:
  --   Trainer: trainer@gurugym.fake / Trainer@123
  --   Client:  client@gurugym.fake  / Client@123
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  )
  VALUES
    (
      v_trainer_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'trainer@gurugym.fake',
      crypt('Trainer@123', gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Coach Vikram Joshi"}'::jsonb,
      NOW(), NOW()
    ),
    (
      v_client_1,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'client@gurugym.fake',
      crypt('Client@123', gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Dr. Ananya Sharma"}'::jsonb,
      NOW(), NOW()
    ),
    (
      v_client_2,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'rajesh@gurugym.fake',
      crypt('Client@123', gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Rajesh Malviya"}'::jsonb,
      NOW(), NOW()
    )
  ON CONFLICT (id) DO NOTHING;

  -- 2. Insert Demo Profiles
  INSERT INTO public.profiles (id, full_name, role, trainer_id, goal, height_cm, diet_pref, limitations_note, consent_at, invite_code)
  VALUES
    (v_trainer_id, 'Coach Vikram Joshi', 'trainer', NULL, NULL, 180, 'veg', NULL, NOW(), 'GURU-INDORE'),
    (v_client_1, 'Dr. Ananya Sharma', 'client', v_trainer_id, 'general', 165, 'veg', 'Mild lower back stiffness after long surgery hours.', NOW(), NULL),
    (v_client_2, 'Rajesh Malviya', 'client', v_trainer_id, 'fat_loss', 174, 'non_veg', 'Knee sensitivity on deep squats.', NOW(), NULL)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    trainer_id = EXCLUDED.trainer_id;

  -- Demo Approved Plan for Dr. Ananya Sharma
  INSERT INTO public.plans (id, client_id, trainer_id, version, status, workouts, meals, approved_at)
  VALUES (
    v_plan_1,
    v_client_1,
    v_trainer_id,
    1,
    'approved',
    '[
      {"name": "Warm-up Mobility & Cat-Cow", "sets": "2", "reps": "10", "duration": "5 min", "note": "Focus on thoracic spine release"},
      {"name": "Goblet Squats", "sets": "3", "reps": "12", "duration": "", "note": "Use 8kg dumbbell, upright chest"},
      {"name": "Dumbbell Overhead Press", "sets": "3", "reps": "10", "duration": "", "note": "Exhale on press"},
      {"name": "Lat Pulldown (Band or Cable)", "sets": "3", "reps": "12", "duration": "", "note": "Controlled eccentric tempo"},
      {"name": "Side Plank Hold", "sets": "3", "reps": "", "duration": "30 sec", "note": "Keep hips elevated"},
      {"name": "Post-Workout Hamstring Stretch", "sets": "1", "reps": "", "duration": "5 min", "note": "Deep breathing"}
    ]'::jsonb,
    '[
      {"label": "Breakfast", "description": "Vegetable poha with roasted peanuts + 1 glass low-fat milk", "calories": 380},
      {"label": "Mid-Morning", "description": "1 apple or orange + 5 almonds", "calories": 140},
      {"label": "Lunch", "description": "2 whole wheat rotis, 1 bowl dal tadka, cucumber salad & curd", "calories": 520},
      {"label": "Evening Snack", "description": "Roasted chana with green tea", "calories": 180},
      {"label": "Dinner", "description": "Paneer bhurji (100g) with stir-fried greens & 1 roti", "calories": 460},
      {"label": "Water Target", "description": "3.0 Litres throughout the day", "calories": 0}
    ]'::jsonb,
    NOW() - INTERVAL '7 days'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Completions for Dr. Ananya (high adherence demo)
  INSERT INTO public.completions (client_id, plan_id, date, item_type, item_key, done)
  VALUES
    (v_client_1, v_plan_1, v_today, 'workout', 'workout-0', true),
    (v_client_1, v_plan_1, v_today, 'workout', 'workout-1', true),
    (v_client_1, v_plan_1, v_today, 'workout', 'workout-2', true),
    (v_client_1, v_plan_1, v_today, 'meal', 'meal-0', true),
    (v_client_1, v_plan_1, v_today, 'meal', 'meal-1', true),
    (v_client_1, v_plan_1, v_today, 'meal', 'meal-2', true),
    (v_client_1, v_plan_1, v_today, 'water', 'water-target', true)
  ON CONFLICT DO NOTHING;

  -- 4 Weeks of Weight Logs for Dr. Ananya
  INSERT INTO public.logs (client_id, date, weight_kg, waist_cm)
  VALUES
    (v_client_1, v_today - INTERVAL '21 days', 68.2, 82.0),
    (v_client_1, v_today - INTERVAL '14 days', 67.6, 81.5),
    (v_client_1, v_today - INTERVAL '7 days',  67.1, 80.8),
    (v_client_1, v_today,                     66.5, 80.0)
  ON CONFLICT DO NOTHING;

  -- Weekly Check-ins for Dr. Ananya
  INSERT INTO public.checkins (client_id, week_start, effort, energy, note, reviewed)
  VALUES
    (v_client_1, DATE_TRUNC('week', v_today - INTERVAL '7 days')::DATE, 3, 4, 'Felt very energetic! The back stiffness is noticeably better with the mobility drills.', true),
    (v_client_1, DATE_TRUNC('week', v_today)::DATE, 3, 4, 'Completed all sessions this week on schedule despite night rounds.', false)
  ON CONFLICT DO NOTHING;

  -- Notes thread between Coach Vikram and Dr. Ananya
  INSERT INTO public.notes (client_id, author_id, body, created_at)
  VALUES
    (v_client_1, v_trainer_id, 'Welcome to BodyBuddy, Dr. Sharma! I added extra thoracic mobility to support your spine during surgeries.', NOW() - INTERVAL '5 days'),
    (v_client_1, v_client_1, 'Thank you Coach Vikram! Really enjoying the routine so far.', NOW() - INTERVAL '4 days'),
    (v_client_1, v_trainer_id, 'Great job staying consistent this week! Keep water intake at 3L.', NOW() - INTERVAL '1 day')
  ON CONFLICT DO NOTHING;

END $$;
