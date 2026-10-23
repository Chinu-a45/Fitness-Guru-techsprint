// src/components/layout/TrainerLayout.jsx
// ──────────────────────────────────────────────────────────────────
// Wraps all trainer pages. Provides:
//  • Sidebar navigation on desktop, collapsible top bar on mobile
//  • Offline banner
//  • Outlet for nested trainer routes
// ──────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, ClipboardList,
  Star, LogOut, Menu, X, Dumbbell, MessageSquare,
} from 'lucide-react';
import { OfflineBanner } from '../ui/OfflineBanner';
import { useAuth } from '../../context/AuthContext';

const NAV_ITEMS = [
  { to: '/trainer/dashboard',  icon: LayoutDashboard, label: 'Dashboard'   },
  { to: '/trainer/clients',    icon: Users,           label: 'Clients'     },
  { to: '/trainer/chat',       icon: MessageSquare,   label: 'Chat'        },
  { to: '/trainer/reviews',    icon: Star,            label: 'Reviews'     },
  { to: '/trainer/plans',      icon: ClipboardList,   label: 'Plan Builder'},
];

export function TrainerLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  const NavItems = () => (
    <>
      {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `sidebar-item${isActive ? ' active' : ''}`
          }
          onClick={() => setMobileOpen(false)}
          aria-label={label}
        >
          <Icon aria-hidden="true" />
          {label}
        </NavLink>
      ))}

      <div style={{ marginTop: 'auto', borderTop: '1px solid var(--color-border)', paddingTop: '0.75rem', paddingBottom: '0.5rem' }}>
        <button
          className="sidebar-item"
          onClick={handleSignOut}
          style={{ color: '#ff6b6b' }}
        >
          <LogOut aria-hidden="true" size={18} />
          Sign out
        </button>
      </div>
    </>
  );

  const location = useLocation();
  const isChat = location.pathname.startsWith('/trainer/chat');

  return (
    <div style={{ display: 'flex', minHeight: '100dvh' }}>
      <OfflineBanner />

      {/* ── Desktop sidebar ── */}
      <aside className="sidebar" style={{ display: 'none' }} id="trainer-sidebar">
        <div className="sidebar-logo">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '8px',
                background: 'rgba(61, 255, 79, 0.1)',
                border: '1px solid rgba(61, 255, 79, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Dumbbell size={20} color="var(--color-brand)" />
            </div>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2 }}>BodyBuddy</div>
              <div style={{ color: 'var(--color-text-muted)', fontSize: '0.72rem' }}>Trainer Dashboard</div>
            </div>
          </div>
          {profile && (
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', marginTop: '0.75rem' }}>
              👋 {profile.full_name}
            </p>
          )}
        </div>
        <NavItems />
      </aside>

      {/* ── Mobile top bar + drawer ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: isChat ? '100dvh' : 'auto' }}>
        {/* Mobile header */}
        <header
          style={{
            background: 'var(--color-surface)',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 1rem',
            color: '#fff',
            flexShrink: 0,
            position: 'sticky',
            top: 0,
            zIndex: 40,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                background: 'rgba(61, 255, 79, 0.1)',
                border: '1px solid rgba(61, 255, 79, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Dumbbell size={18} color="var(--color-brand)" />
            </div>
            <div>
              <span style={{ fontWeight: 700, fontSize: '0.95rem', letterSpacing: '-0.01em', color: '#fff' }}>BodyBuddy</span>
              <span style={{ fontSize: '0.65rem', background: 'rgba(61, 255, 79, 0.15)', color: 'var(--color-brand)', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', marginLeft: '6px' }}>TRAINER</span>
            </div>
          </div>
          <button
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              width: 38,
              height: 38,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text)',
              cursor: 'pointer',
            }}
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu size={20} />
          </button>
        </header>

        {/* Mobile drawer overlay */}
        {mobileOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 100,
              background: 'rgba(0, 0, 0, 0.72)',
              backdropFilter: 'blur(4px)',
              animation: 'fadeInOverlay 0.2s ease-out',
            }}
            onClick={() => setMobileOpen(false)}
          >
            <div
              style={{
                width: '260px',
                maxWidth: '82vw',
                background: 'var(--color-surface)',
                borderRight: '1px solid var(--color-border)',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                padding: '1.25rem 0',
                boxShadow: '8px 0 32px rgba(0, 0, 0, 0.6)',
                animation: 'drawerSlideIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 1.25rem 1rem',
                  borderBottom: '1px solid var(--color-border)',
                  marginBottom: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: '8px',
                      background: 'rgba(61, 255, 79, 0.1)',
                      border: '1px solid rgba(61, 255, 79, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Dumbbell size={18} color="var(--color-brand)" />
                  </div>
                  <div>
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2 }}>BodyBuddy</div>
                    <div style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem' }}>Trainer Portal</div>
                  </div>
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '6px',
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--color-text-muted)',
                    cursor: 'pointer',
                  }}
                  aria-label="Close navigation menu"
                >
                  <X size={18} />
                </button>
              </div>

              {profile && (
                <div style={{ padding: '0 1.25rem 0.85rem', borderBottom: '1px solid var(--color-border)', marginBottom: '0.75rem' }}>
                  <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>Trainer Account</div>
                  <div style={{ color: '#fff', fontWeight: 600, fontSize: '0.88rem', marginTop: '2px' }}>
                    👋 {profile.full_name}
                  </div>
                </div>
              )}

              <NavItems />
            </div>
          </div>
        )}

        {/* Main content */}
        <main
          style={{
            flex: 1,
            overflowY: isChat ? 'hidden' : 'auto',
            background: 'var(--color-bg)',
            display: isChat ? 'flex' : 'block',
            flexDirection: 'column',
            minHeight: 0,
          }}
        >
          <div
            className={isChat ? 'chat-layout-wrapper' : 'page-content-trainer'}
            style={
              isChat
                ? {
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 0,
                    width: '100%',
                    height: '100%',
                    boxSizing: 'border-box',
                  }
                : undefined
            }
          >
            <Outlet />
          </div>
        </main>
      </div>

      {/* ── CSS Animations & Responsive Rules ── */}
      <style>{`
        @keyframes drawerSlideIn {
          from {
            transform: translateX(-100%);
          }
          to {
            transform: translateX(0);
          }
        }
        @keyframes fadeInOverlay {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @media (max-width: 767px) {
          .chat-layout-wrapper {
            padding: 0 !important;
          }
        }
        @media (min-width: 768px) {
          #trainer-sidebar { display: flex !important; }
          header { display: none !important; }
          .chat-layout-wrapper {
            padding: 0.75rem !important;
          }
        }
      `}</style>
    </div>
  );
}
