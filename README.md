# 🏋️‍♂️ BodyBuddy – Fitness Guru Gym

> **"Be Healthy"** · Personal Training Studio Web App & PWA · Indore, India

A full-featured, mobile-first Progressive Web App (PWA) connecting personal trainers with their clients to track customized workouts, meals, daily metrics (weight, waist, sleep), and real-time messaging.

---

## ⚡ Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables
Copy `.env.example` to `.env` and fill in your Supabase credentials:
```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key-here
```

### 3. Database Setup
1. In your [Supabase Dashboard](https://supabase.com/dashboard) → **SQL Editor**.
2. Run [`supabase/schema.sql`](supabase/schema.sql) to create tables and RLS security policies.
3. *(Optional)* Run [`supabase/seed.sql`](supabase/seed.sql) to load initial demo data.

### 4. Run Locally
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173).

---

## 🚀 Key Features

* **👤 Client App (`/client/*`)**:
  * Personalized daily plan checklist (workouts, nutrition, hydration).
  * Metrics tracker: weight (kg), waist (cm), and sleep (hours) with smart anomaly prompts.
  * Visual progress charts and weekly check-in forms.
  * Real-time notes & chat with the assigned coach.

* **🏋️ Trainer Portal (`/trainer/*`)**:
  * Client roster with adherence scores and automated follow-up flags.
  * Interactive Plan Builder (draft, approve, revision management).
  * Real-time WhatsApp-style client chat.
  * Weekly client check-in reviews.

* **🛡️ Admin Portal (`/admin`)**:
  * Studio manager dashboard to register trainers and generate invite codes.
  * Default Login: `Admin ID: guru143` | `Password: Guru@225`

---

## 🛠️ Tech Stack

* **Frontend**: React 19, Vite, Tailwind CSS
* **Backend & Auth**: Supabase (PostgreSQL, Row Level Security, Realtime WebSockets)
* **Icons & Charts**: Lucide React, Recharts
* **PWA**: `vite-plugin-pwa` with offline caching

---

## 📁 Project Structure

```
├── src/
│   ├── components/       # Layouts (Client & Trainer) and UI elements
│   ├── context/          # AuthContext (Supabase session)
│   ├── lib/              # Supabase client singleton, flag engine, utils
│   ├── pages/
│   │   ├── admin/        # Admin portal
│   │   ├── auth/         # Login, Signup, Onboarding
│   │   ├── client/       # Home, Plan, ProgressLog, Charts, Notes, Profile
│   │   └── trainer/      # Dashboard, Clients, PlanBuilder, Chat, Reviews
│   └── index.css         # Design tokens & Light Classic theme
├── supabase/             # PostgreSQL schema, migrations & seed data
└── public/               # PWA icons & manifest
```

---

## 📜 Available Scripts

| Command | Action |
| :--- | :--- |
| `npm run dev` | Start development server |
| `npm run build` | Build production bundle & PWA service worker |
| `npm run preview` | Preview production build |
| `npm run lint` | Run code quality checks (`oxlint`) |
