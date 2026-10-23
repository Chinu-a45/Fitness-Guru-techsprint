// src/App.jsx
// ──────────────────────────────────────────────────────────────────
// Root component. Sets up routing and auth-guarded routes.
// ──────────────────────────────────────────────────────────────────
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoadingScreen } from './components/ui/Spinner';

// ── Layouts ──────────────────────────────────────────────────────
import { ClientLayout }  from './components/layout/ClientLayout';
import { TrainerLayout } from './components/layout/TrainerLayout';

// ── Auth pages ────────────────────────────────────────────────────
import { LoginPage }      from './pages/auth/LoginPage';
import { SignupPage }     from './pages/auth/SignupPage';
import { OnboardingPage } from './pages/auth/OnboardingPage';

// ── Client pages ──────────────────────────────────────────────────
import { ClientHome }     from './pages/client/ClientHome';
import { TodayPlan }      from './pages/client/TodayPlan';
import { ProgressLog }    from './pages/client/ProgressLog';
import { ProgressCharts } from './pages/client/ProgressCharts';
import { WeeklyCheckin }  from './pages/client/WeeklyCheckin';
import { ClientNotes }    from './pages/client/ClientNotes';
import { ClientProfile }  from './pages/client/ClientProfile';

// ── Trainer pages ─────────────────────────────────────────────────
import { TrainerDashboard }    from './pages/trainer/TrainerDashboard';
import { ClientList }          from './pages/trainer/ClientList';
import { ClientDetail }        from './pages/trainer/ClientDetail';
import { PlanBuilder }         from './pages/trainer/PlanBuilder';
import { WeeklyReviews }       from './pages/trainer/WeeklyReviews';
import { TrainerChat }         from './pages/trainer/TrainerChat';

// ── Admin pages ───────────────────────────────────────────────────
import { AdminPortal }         from './pages/admin/AdminPortal';

// ─────────────────────────────────────────────────────────────────
// Guard: only lets authenticated users of the right role through.
// ─────────────────────────────────────────────────────────────────
function RequireAuth({ role, children }) {
  const { loading, user, profile } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user)   return <Navigate to="/login" replace />;

  // Profile not yet created → send to onboarding
  if (!profile) return <Navigate to="/onboarding" replace />;

  // Role check
  if (role && profile.role !== role) {
    // Trainer trying to access client routes → redirect to trainer dash
    if (profile.role === 'trainer') return <Navigate to="/trainer/dashboard" replace />;
    return <Navigate to="/client/home" replace />;
  }

  return children;
}

// ─────────────────────────────────────────────────────────────────
// Root redirect: send logged-in users to their dashboard.
// ─────────────────────────────────────────────────────────────────
function RootRedirect() {
  const { loading, user, profile } = useAuth();
  if (loading)  return <LoadingScreen />;
  if (!user)    return <Navigate to="/login" replace />;
  if (!profile) return <Navigate to="/onboarding" replace />;
  if (profile.role === 'trainer') return <Navigate to="/trainer/dashboard" replace />;
  return <Navigate to="/client/home" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* ── Root ── */}
          <Route index element={<RootRedirect />} />

          {/* ── Auth ── */}
          <Route path="/login"      element={<LoginPage />} />
          <Route path="/signup"     element={<SignupPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/admin"      element={<AdminPortal />} />

          {/* ── Client ── */}
          <Route
            path="/client"
            element={
              <RequireAuth role="client">
                <ClientLayout />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="home" replace />} />
            <Route path="home"     element={<ClientHome />} />
            <Route path="plan"     element={<TodayPlan />} />
            <Route path="progress" element={<ProgressLog />} />
            <Route path="charts"   element={<ProgressCharts />} />
            <Route path="checkin"  element={<WeeklyCheckin />} />
            <Route path="notes"    element={<ClientNotes />} />
            <Route path="profile"  element={<ClientProfile />} />
          </Route>

          {/* ── Trainer ── */}
          <Route
            path="/trainer"
            element={
              <RequireAuth role="trainer">
                <TrainerLayout />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard"        element={<TrainerDashboard />} />
            <Route path="clients"          element={<ClientList />} />
            <Route path="clients/:id"      element={<ClientDetail />} />
            <Route path="plans"            element={<PlanBuilder />} />
            <Route path="plans/:clientId"  element={<PlanBuilder />} />
            <Route path="reviews"          element={<WeeklyReviews />} />
            <Route path="chat"             element={<TrainerChat />} />
          </Route>

          {/* ── 404 ── */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
