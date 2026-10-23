// src/components/layout/ClientLayout.jsx
// ──────────────────────────────────────────────────────────────────
// Wraps all client pages. Provides:
//  • Offline banner at the top
//  • Main scrollable content area
//  • Bottom tab navigation
//  • Disclaimer bar above the nav
// ──────────────────────────────────────────────────────────────────
import { NavLink, Outlet } from 'react-router-dom';
import {
  Home, Dumbbell, TrendingUp, MessageSquare, User,
} from 'lucide-react';
import { OfflineBanner } from '../ui/OfflineBanner';

const TABS = [
  { to: '/client/home',     icon: Home,          label: 'Home'     },
  { to: '/client/plan',     icon: Dumbbell,      label: 'Plan'     },
  { to: '/client/progress', icon: TrendingUp,    label: 'Progress' },
  { to: '/client/notes',    icon: MessageSquare, label: 'Notes'    },
  { to: '/client/profile',  icon: User,          label: 'Profile'  },
];

export function ClientLayout() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <OfflineBanner />

      {/* Page content rendered by nested routes */}
      <main style={{ flex: 1, overflowY: 'auto' }}>
        <Outlet />
      </main>

      {/* Disclaimer above the nav */}
      <p className="disclaimer">
        Plans are created or approved by your trainer. This app does not give medical advice.
      </p>

      {/* Bottom tab navigation */}
      <nav className="bottom-nav" aria-label="Main navigation">
        {TABS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `bottom-nav-item${isActive ? ' active' : ''}`
            }
            aria-label={label}
          >
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
