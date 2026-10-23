// src/context/AuthContext.jsx
// ──────────────────────────────────────────────────────────────────
// Provides authentication state (session, user, profile) to the
// whole app via React context. Components call useAuth() to access.
// ──────────────────────────────────────────────────────────────────
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession]   = useState(undefined); // undefined = loading
  const [profile, setProfile]   = useState(null);
  const [loading, setLoading]   = useState(true);

  // Fetch the profile row for the current user
  async function fetchProfile(user) {
    if (!user) return null;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (error) {
      console.error('fetchProfile error:', error.message);
      return null;
    }
    return {
      ...data,
      session_days: (Array.isArray(data?.session_days) && data.session_days.length > 0)
        ? data.session_days
        : (user.user_metadata?.session_days || []),
    };
  }

  useEffect(() => {
    // 1. Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        const p = await fetchProfile(session.user);
        setProfile(p);
      }
      setLoading(false);
    });

    // 2. Listen for auth state changes (login / logout / token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        if (session?.user) {
          const p = await fetchProfile(session.user);
          setProfile(p);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Helper: refresh profile after onboarding / profile edit
  async function refreshProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const p = await fetchProfile(user);
    setProfile(p);
  }

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    refreshProfile,
    isTrainer: profile?.role === 'trainer',
    isClient:  profile?.role === 'client',
    signOut: () => supabase.auth.signOut(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Hook – use inside any component to access auth state. */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
