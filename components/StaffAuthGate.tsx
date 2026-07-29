"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { getSupabaseClient, isSupabaseConfigured, isSupabaseTestMode } from "@/lib/supabase";

interface Props {
  children: (session: Session | null) => ReactNode;
}

export default function StaffAuthGate({ children }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!isSupabaseConfigured);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const client = getSupabaseClient();
    let active = true;
    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setReady(true);
    });

    void client.auth.getSession().then(async ({ data: sessionData, error: sessionError }) => {
      if (!active) return;
      if (sessionError) {
        setMessage(sessionError.message);
        setReady(true);
        return;
      }
      if (sessionData.session) {
        setSession(sessionData.session);
        setReady(true);
        return;
      }
      if (!isSupabaseTestMode) {
        setReady(true);
        return;
      }

      const { data: anonymousData, error } = await client.auth.signInAnonymously();
      if (!active) return;
      if (error) {
        setMessage(error.message);
        setReady(true);
        return;
      }
      setSession(anonymousData.session);
      setReady(true);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    const { error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
    if (error) setMessage(error.message);
    setSubmitting(false);
  };

  if (!ready) {
    return (
      <main className="access-page">
        <div className="access-card loading-card">
          <div className="district-mark" aria-hidden="true"><span>1ST</span></div>
          <p>Connecting to the district database…</p>
        </div>
      </main>
    );
  }

  if (isSupabaseConfigured && isSupabaseTestMode && !session) {
    return (
      <main className="access-page">
        <section className="access-card" aria-labelledby="test-access-title">
          <div className="access-brand">
            <div className="district-mark" aria-hidden="true"><span>1ST</span></div>
            <div>
              <p className="district-kicker">Antipolo City · First District</p>
              <h1 id="test-access-title">Shared Test Database</h1>
              <p>The automatic testing session could not be opened.</p>
            </div>
          </div>
          <div className="notice error" role="alert">
            {message || "Enable anonymous sign-ins in the Supabase Authentication settings, then reload this page."}
          </div>
          <button className="btn primary" type="button" onClick={() => window.location.reload()}>
            Try Again
          </button>
        </section>
      </main>
    );
  }

  if (isSupabaseConfigured && !session) {
    return (
      <main className="access-page">
        <section className="access-card" aria-labelledby="staff-access-title">
          <div className="access-brand">
            <div className="district-mark" aria-hidden="true"><span>1ST</span></div>
            <div>
              <p className="district-kicker">Antipolo City · First District</p>
              <h1 id="staff-access-title">Staff Access</h1>
              <p>Sign in to open the shared Assistance Program database.</p>
            </div>
          </div>
          <form className="access-form" onSubmit={signIn}>
            <label>
              Office email
              <input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label>
              Password
              <input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            {message && <div className="notice error" role="alert">{message}</div>}
            <button className="btn primary" type="submit" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in to Shared Database"}
            </button>
          </form>
          <p className="access-help">Staff accounts are created by the project administrator. Public registration is disabled.</p>
        </section>
      </main>
    );
  }

  return children(session);
}
