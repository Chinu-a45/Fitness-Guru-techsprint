# 🏋️‍♂️ BodyBuddy – Fitness Guru Gym
> **"Be Healthy"** · Personal Training Studio Web App & PWA · Indore, Madhya Pradesh, India  
> Designed for one-on-one personal fitness coaching, client tracking, and studio administration.

---

## 📌 Project Overview
**BodyBuddy** is a full-featured, mobile-first Progressive Web App (PWA) built specifically for **Fitness Guru Gym**, a personal training studio located in Indore, India.

The application connects personal trainers with their busy clients (corporate executives, doctors, and professionals aged 25–65). The coach curates and approves personalized workout and nutrition plans, while clients track their daily routines, log metrics, and chat with their trainer in real-time.

A dedicated, password-protected **Admin Portal** allows the gym management to generate trainer profiles with auto-generated invite codes without exposing trainer registration to the public.

> ⚠️ **Core Disclaimer**:  
> *"Plans are created or approved by your trainer. This app does not give medical advice."*  
> BodyBuddy is designed to empower personal trainers and their clients, not replace certified coaching.

---

## 📦 Dependencies & Packages to Install

To set up this project, you need **Node.js** (v18.0.0 or higher) and **npm** (v9.0.0 or higher).

### Quick Install Command
Run this in the project root:
```bash
npm install
```

---

### Detailed Breakdown of Dependencies

#### 1. Runtime / Production Dependencies (`dependencies`)

| Package | Version | Purpose & Description |
| :--- | :--- | :--- |
| **`react`** | `^19.2.8` | Core UI library for building component trees, hooks, and reactive state. |
| **`react-dom`** | `^19.2.8` | React DOM renderer for mounting the web application to the browser. |
| **`react-router-dom`** | `^7.18.4` | Client-side routing engine (declarative nested routes, role guards, navigation). |
| **`@supabase/supabase-js`** | `^2.118.0` | Official client library for Supabase (Auth, PostgreSQL database, and Realtime websocket chat). |
| **`lucide-react`** | `^1.59.0` | Modern, consistent icon library used across navigation, buttons, status badges, and cards. |
| **`recharts`** | `^3.10.1` | Composable charting library built on React components for weight trends and adherence charts. |

If you ever need to install only the runtime dependencies:
```bash
npm install react react-dom react-router-dom @supabase/supabase-js lucide-react recharts
```

---

#### 2. Development Dependencies (`devDependencies`)

| Package | Version | Purpose & Description |
| :--- | :--- | :--- |
| **`vite`** | `^8.3.0` | Next-generation frontend build tool providing fast Hot Module Replacement (HMR) and optimized production bundles. |
| **`@vitejs/plugin-react`** | `^6.1.1` | Vite plugin providing Fast Refresh and JSX support for React. |
| **`tailwindcss`** | `^4.3.3` | Utility-first CSS framework for rapid UI styling and custom design tokens. |
| **`@tailwindcss/vite`** | `^4.3.3` | First-party Vite plugin for Tailwind CSS v4 seamless integration. |
| **`vite-plugin-pwa`** | `^2.0.0` | Zero-config PWA integration for Vite (generates Service Worker, offline caching, and web manifest). |
| **`oxlint`** | `^1.81.0` | High-performance, Rust-powered linter for JavaScript/JSX code quality. |
| **`@types/react`** | `^19.2.18` | TypeScript type declarations for React. |
| **`@types/react-dom`** | `^19.2.7` | TypeScript type declarations for ReactDOM. |

If you ever need to install only the dev dependencies:
```bash
npm install -D vite @vitejs/plugin-react tailwindcss @tailwindcss/vite vite-plugin-pwa oxlint @types/react @types/react-dom
```

---

## 🚀 Quick Start Guide

### Step 1: Clone or Navigate to the Project
```bash
cd "Guru fitness gym"
```

### Step 2: Install Node Dependencies
```bash
npm install
```

### Step 3: Configure Environment Variables
Create a `.env` file in the project root:
```bash
cp .env.example .env
```
Open `.env` and fill in your Supabase project credentials:
```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key-here
```
*(You can find these in your Supabase dashboard under: **Project Settings** → **API**).*

### Step 4: Database Setup (Supabase)
1. Open your [Supabase Project Dashboard](https://supabase.com/dashboard).
2. Go to the **SQL Editor** tab on the left sidebar.
3. Open [`supabase/schema.sql`](supabase/schema.sql), copy all lines, paste into the SQL editor, and click **Run**.
   - This creates tables: `profiles`, `plans`, `completions`, `logs`, `checkins`, and `notes`.
   - Sets up Row Level Security (RLS) policies and Realtime replication for messaging.
4. *(Optional Demo Data)*: Run [`supabase/seed.sql`](supabase/seed.sql) to populate initial demo trainers, clients, and plans.

### Step 5: Start the Development Server
```bash
npm run dev
```
By default, the server runs at:
```
http://localhost:5173
```
To access from a mobile phone on the same Wi-Fi network:
```bash
npm run dev -- --host
```

---

## 🔐 Portals & Routing Architecture

### 1. 🛡️ Admin Portal (`/admin`)
- **Route**: `http://localhost:5173/admin`
- **Protected by Credentials**:
  - **Admin ID**: `guru143`
  - **Password**: `Guru@225`
- **Capabilities**:
  - **Create Trainer Accounts**: Enter coach full name, email, and password.
  - **Auto-Generated Trainer Code**: Automatically creates codes like `GURU-RAHUL-4821` (or customizable).
  - **Non-Persisting Auth**: Creates coach credentials via an isolated Supabase client without logging out the administrator.
  - **One-Click Credential Copy**: Easily copy the generated coach invite code or full credentials to send to the trainer via WhatsApp or email.
  - **Studio Stats & Trainer Roster**: View all registered gym trainers, their assigned client counts, joined dates, and codes.

---

### 2. 🏋️ Trainer Portal (`/trainer/*`)
Accessible to accounts with `role: 'trainer'`:
- **Dashboard (`/trainer/dashboard`)**:
  - High-level KPI metrics: Active Clients, Flagged Clients, Plans Awaiting Approval, Average Adherence.
  - Automated follow-up alerts with direct links into client records.
- **Client Roster (`/trainer/clients`)**:
  - Sortable and filterable client list (`On track`, `Needs follow-up`, `Inactive`).
  - Displays adherence %, last workout/weight logged, and trainer invite code sharing.
- **Client Detail Hub (`/trainer/clients/:id`)**:
  - Private limitations notes, historical progress logs, check-ins, and active plan details.
- **Plan Builder (`/trainer/plans` or `/trainer/plans/:clientId`)**:
  - Build workout exercises (sets, reps, rest) and meal routines with water targets.
  - Save as **Draft** or **Approve**.
  - Delete unused or outdated plans with confirmation modal.
  - Version incrementing: Editing an approved plan safely creates a new draft version.
- **WhatsApp-Style Chat Hub (`/trainer/chat`)**:
  - Real-time conversation thread with all assigned clients.
  - Client search, unread badge indicators, and instant message synchronization.
- **Weekly Reviews (`/trainer/reviews`)**:
  - Centralized review feed for clients' weekly check-ins with 1–5 effort and energy ratings.

---

### 3. 👤 Client Portal (`/client/*`)
Accessible to gym members with `role: 'client'`:
- **Onboarding (`/onboarding`)**:
  - 3-step personalized setup: Fitness Goal (fat loss, strength, general fitness), Body Metrics (height, weight), Diet Preferences (veg, non-veg, eggetarian), Schedule, Trainer Invite Code, and Consent Agreement.
- **Home Dashboard (`/client/home`)**:
  - Dynamic greeting, streak counter, daily checklist progress ring, quick log shortcut.
- **Today's Plan (`/client/plan`)**:
  - Approved workout routines and meals.
  - Interactive tick-box checklist with immediate progress persistence.
- **Progress Log (`/client/progress`)**:
  - Daily weight (kg) and waist circumference (cm) tracker with range validations.
- **Visual Analytics (`/client/charts`)**:
  - Interactive Recharts line charts for weight trends and bar charts for weekly plan adherence.
- **Weekly Check-in (`/client/checkin`)**:
  - 1–5 Effort and recovery ratings submitted directly to the trainer once a week.
- **Trainer Notes & Chat (`/client/notes`)**:
  - Direct live chat with the assigned personal coach.
- **Profile & Data Privacy (`/client/profile`)**:
  - Update preferences, view consent records, or use the **"Delete My Data"** two-step purge.

---

## 🚩 Automated Follow-up Flag Engine (`src/lib/flagConfig.js`)
BodyBuddy automatically flags clients who require personal follow-up:
- 🚩 **Inactive**: No workout or meal completed for **5 or more days**.
- 🚩 **Low Adherence**: Weekly plan adherence falls below **50%**.
- 🚩 **Missing Weigh-in**: Body weight not logged for **14 or more days**.
- 🚩 **Overtraining Risk**: High effort rating (4 or 5) across two consecutive weekly check-ins.

---

## 🛠️ Available Scripts

| Command | Action |
| :--- | :--- |
| `npm run dev` | Starts Vite local development server with HMR. |
| `npm run build` | Builds the production bundle to the `dist/` directory (includes PWA Service Worker). |
| `npm run preview` | Locally preview the production build from `dist/`. |
| `npm run lint` | Runs `oxlint` to check code quality and syntax issues. |

---

## 📁 Directory Structure

```
├── public/
│   ├── favicon.svg              # Studio dumbbell logo
│   └── icons/                   # PWA 192x192 & 512x512 app icons
├── src/
│   ├── assets/                  # Brand assets
│   ├── components/
│   │   ├── layout/              # ClientLayout (bottom bar) & TrainerLayout (sidebar)
│   │   └── ui/                  # Spinner, ErrorMessage, EmptyState, OfflineBanner
│   ├── context/                 # AuthContext (Supabase Auth & session profile)
│   ├── hooks/                   # useOnlineStatus (Network detection)
│   ├── lib/
│   │   ├── flagConfig.js        # Follow-up thresholds and flags
│   │   ├── supabase.js          # Supabase client singleton
│   │   └── utils.js             # Date, streak, adherence, and formatting helpers
│   ├── pages/
│   │   ├── admin/               # AdminPortal.jsx (Password-protected trainer creation)
│   │   ├── auth/                # LoginPage, SignupPage, OnboardingPage
│   │   ├── client/              # ClientHome, TodayPlan, ProgressLog, Charts, Checkin, Notes, Profile
│   │   └── trainer/             # TrainerDashboard, ClientList, ClientDetail, PlanBuilder, WeeklyReviews, TrainerChat
│   ├── App.jsx                  # Main router with role-guarded routes
│   └── index.css                # Brand colors, typography & custom CSS
├── supabase/
│   ├── schema.sql               # PostgreSQL tables, RLS security policies, functions
│   └── seed.sql                 # Demo test data
├── .env.example                 # Environment variable template
├── package.json                 # Project dependencies and scripts
└── vite.config.js               # Vite config + PWA manifest & Workbox runtime caching
```

---

## 🛡️ Security & Privacy Architecture
- **Row Level Security (RLS)**: Strictly enforced on all PostgreSQL tables.
- **Client Data Isolation**: Gym members can only view and mutate their own records.
- **Trainer Scoping**: Trainers can only view clients assigned to them via `trainer_id`.
- **Admin Isolation**: Admin portal operations use non-persisting authentication sessions.
- **Confidentiality**: Private limitations/injury notes are strictly visible to the trainer and never exposed to other members.

---

## 📱 PWA (Progressive Web App) Installation
- **iOS Safari**: Tap the Share icon → **"Add to Home Screen"**.
- **Android Chrome**: Tap the menu (three dots) → **"Install App"** / **"Add to Home screen"**.
- Includes automatic offline caching for static assets via Workbox service worker.

---

## 🤝 Studio Information
- **Gym**: Fitness Guru Gym
- **Location**: Indore, Madhya Pradesh, India
- **Tagline**: *"Be Healthy"*
