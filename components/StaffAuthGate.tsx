"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

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
    void client.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setReady(true);
    });
    return () => data.subscription.unsubscribe();
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
