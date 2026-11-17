/**
 * Live mode: requires a Supabase sign-in and a newsroom role (super_admin, editor,
 * district_moderator, reporter). Readers who sign in get a "no access" screen.
 * Demo mode (no keys): passes straight through to the in-memory CMS.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { Session as AuthSession } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { loadSession } from '../lib/db';
import { StoreProvider, type Session } from '../lib/store';
import Login from '../pages/Login';

type State =
  | { kind: 'loading' }
  | { kind: 'signedOut' }
  | { kind: 'noAccess'; phone?: string; email?: string }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; session: Session };

export function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ kind: 'loading' });

  const resolve = useCallback(async (auth: AuthSession | null) => {
    if (!auth) return setState({ kind: 'signedOut' });
    try {
      const s = await loadSession(auth.user.id);
      if (!s.isStaff) return setState({ kind: 'noAccess', phone: auth.user.phone, email: auth.user.email });
      setState({ kind: 'ready', session: { name: s.name, role: s.role, districts: s.districts, userId: s.userId, permissions: s.permissions, staffRole: s.staffRole } });
    } catch (e) {
      setState({ kind: 'error', message: (e as Error).message });
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => resolve(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') resolve(session);
    });
    return () => sub.subscription.unsubscribe();
  }, [resolve]);

  const signOut = useCallback(() => { supabase?.auth.signOut(); }, []);

  if (!supabase) return <StoreProvider>{children}</StoreProvider>;
  if (state.kind === 'loading') return <div className="auth-shell"><div className="auth-card"><p className="muted">Checking your session…</p></div></div>;
  if (state.kind === 'signedOut') return <Login />;
  if (state.kind === 'noAccess' || state.kind === 'error') {
    return (
      <div className="auth-shell">
        <div className="auth-card grid" style={{ gap: 14 }}>
          <div className="brand-lg"><img className="mono" src="/chatimpu-emblem.png" alt="" />Chatimpu Newsroom</div>
          {state.kind === 'noAccess' ? (
            <>
              <h2>No newsroom access</h2>
              <p className="muted">You're signed in as <b>{state.phone ? `+${state.phone}` : state.email}</b>, but this account doesn't have a newsroom role yet.
                Ask a Super Admin to give you a role in <b>Users & roles</b>.</p>
            </>
          ) : (
            <>
              <h2>Couldn't load your profile</h2>
              <p className="muted">{state.message}</p>
              <p className="faint" style={{ fontSize: 12.5 }}>If this is a new project, check that all migrations in supabase/migrations have been run.</p>
            </>
          )}
          <button className="btn dark" onClick={signOut}>Sign out</button>
        </div>
      </div>
    );
  }
  return <StoreProvider liveSession={state.session} onSignOut={signOut}>{children}</StoreProvider>;
}
