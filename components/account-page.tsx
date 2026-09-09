'use client';

import { useEffect, useRef, useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import Link from '@/components/site-link';
import { Input } from '@/components/ui/input';
import { connected, initialAuthCallback, supabase } from '@/lib/supabase';
import { accountError, passwordProblem, performAccountAction, readAuthCallback, type AccountAction } from '@/lib/account-auth';
import type { State } from '@/components/workspace-content';

export function AccountPage({ state }: { state: State }) {
  const [mode, setMode] = useState<AccountAction>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailWait, setEmailWait] = useState(0);
  const inFlight = useRef(false);

  useEffect(() => {
    const callback = initialAuthCallback || readAuthCallback(window.location.href);
    if (callback.error) setError(callback.error);
    if (callback.recovery) { setRecovery(true); setMode('password'); }
    const current = readAuthCallback(window.location.href);
    if (current.cleanUrl) window.history.replaceState(window.history.state, '', current.cleanUrl);
    // No asynchronous auth calls inside this callback: the SDK holds its auth lock.
    const subscription = supabase?.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') { setRecovery(true); setMode('password'); setError(''); }
      if (event === 'SIGNED_OUT') { setRecovery(false); setMode('sign-in'); setPassword(''); setConfirmation(''); }
    });
    return () => subscription?.data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!emailWait) return;
    const timer = window.setTimeout(() => setEmailWait(value => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [emailWait]);

  function choose(next: AccountAction) {
    if (inFlight.current) return;
    setMode(next); setError(''); setMessage(''); setPassword(''); setConfirmation(''); setShowPassword(false);
    if (next !== 'password') setRecovery(false);
  }

  const sendsEmail = mode === 'forgot';
  async function submit() {
    if (!supabase || inFlight.current || !state.authReady || (sendsEmail && emailWait > 0)) return;
    if (mode === 'sign-up' || mode === 'password') {
      const problem = passwordProblem(password, confirmation);
      if (problem) { setError(problem); setMessage(''); return; }
    }
    inFlight.current = true; setBusy(true); setMessage(''); setError('');
    try {
      const result = await performAccountAction(supabase.auth, mode, {
        email, password, confirmation, returnUrl: window.location.href,
      });
      setError(result.error); setMessage(result.message);
      // This only prevents rapid repeat clicks, not a promise that the sender limit has reset.
      if (sendsEmail) setEmailWait(60);
      if (!result.error) {
        setPassword(''); setConfirmation(''); setShowPassword(false);
        if (mode === 'password' || mode === 'sign-up') { setMode('sign-in'); setRecovery(false); }
      }
    } finally {
      inFlight.current = false; setBusy(false);
    }
  }

  async function signOut() {
    if (!supabase || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const { error: failure } = await supabase.auth.signOut({ scope: 'local' });
      if (failure) setError(accountError(failure));
    } catch (failure) { setError(accountError(failure)); }
    finally { inFlight.current = false; setBusy(false); }
  }

  const status = <>
    {error && <p role="alert" className="notice error-text">{error}</p>}
    {message && <p role="status" className="notice">{message}</p>}
  </>;
  const editingPassword = mode === 'password';
  const newPassword = mode === 'sign-up' || editingPassword;
  const needsPassword = mode === 'sign-in' || newPassword;
  const title = {
    'sign-in': 'Sign in', 'sign-up': 'Create your account', forgot: 'Set or reset your password',
    password: recovery ? 'Choose a new password' : 'Set or change your password',
  }[mode];
  const description = {
    'sign-in': 'Use your email and password. No email code for everyday sign-in.',
    'sign-up': 'Enter your email and choose a password to start using your account. Email verification is off for now.',
    forgot: 'We’ll email a secure link to set a password. This also works if you previously signed in using an email link.',
    password: 'Use a unique password you don’t use on other websites. Your private plans and account will stay the same.',
  }[mode];

  return <>
    <div className="page-heading"><div><p className="eyebrow">{state.user ? 'YOUR WORKSPACE' : 'WELCOME TO THE COMMUNITY'}</p>
      <h1>{state.user ? 'Your account.' : 'A space of your own.'}</h1>
      <p className="muted">{state.user ? 'Your personal plans stay with your account.' : 'Read freely. Sign in to contribute and keep your plans across devices.'}</p>
    </div></div>
    <section className="panel account-panel">
      <LockKeyhole size={30}/>
      {state.user && !editingPassword ? <>
        <h2 className="space-top">{state.user.email}</h2>
        <p className="muted space-top">Role: {state.role}. Contributions can appear publicly as Anonymous.</p>
        {status}
        <div className="inline-actions space-top">
          <Link href="/calendar/" className="button">Open your calendar</Link>
          {state.role !== 'student' && <Link href="/admin/" className="button secondary">Administration</Link>}
          <button className="button secondary" disabled={busy} onClick={() => choose('password')}>Set / change password</button>
          <button className="text-link" disabled={busy} onClick={() => void signOut()}>Sign out</button>
        </div>
      </> : <>
        <h2 className="space-top">{title}</h2>
        <p className="muted space-top">{description}</p>
        {!connected ? <p className="notice">Sign-in is not connected in this preview. You can still explore the site and use the planning tools on this browser.</p> : <>
          {(mode === 'sign-in' || mode === 'sign-up') && <div className="inline-actions space-top" role="group" aria-label="Account access">
            <button className={`button${mode === 'sign-in' ? '' : ' secondary'}`} aria-pressed={mode === 'sign-in'} disabled={busy} onClick={() => choose('sign-in')}>Sign in</button>
            <button className={`button${mode === 'sign-up' ? '' : ' secondary'}`} aria-pressed={mode === 'sign-up'} disabled={busy} onClick={() => choose('sign-up')}>Create account</button>
          </div>}
          {status}
          {!state.authReady && <p role="status" className="notice">Checking your sign-in…</p>}
          {editingPassword && !state.user ? <>
            {state.authReady && <p className="notice">A valid password-reset link or signed-in account is needed. If your link didn’t work, request a new one when email sending is available.</p>}
            <button className="button secondary" disabled={busy} onClick={() => choose('forgot')}>Request a password-reset email</button>
          </> : <form className="form-stack space-top" onSubmit={event => { event.preventDefault(); void submit(); }}>
            <label className="field">Email address
              <Input required type="email" name="email" autoComplete="username" value={editingPassword ? state.user?.email || '' : email}
                disabled={busy} readOnly={editingPassword} onChange={event => setEmail(event.target.value)} placeholder="you@example.com"/>
            </label>
            {needsPassword && <label className="field">{newPassword ? 'New password' : 'Password'}
              <Input required type={showPassword ? 'text' : 'password'} name="password" autoComplete={newPassword ? 'new-password' : 'current-password'}
                minLength={newPassword ? 12 : undefined} value={password} disabled={busy} onChange={event => setPassword(event.target.value)}
                aria-describedby={newPassword ? 'password-guidance' : undefined}/>
              {newPassword && <small id="password-guidance">Use at least 12 characters. A few unrelated words make a memorable password.</small>}
            </label>}
            {newPassword && <label className="field">Confirm new password
              <Input required type={showPassword ? 'text' : 'password'} name="confirm-password" autoComplete="new-password" value={confirmation} disabled={busy} onChange={event => setConfirmation(event.target.value)}/>
            </label>}
            {needsPassword && <button type="button" className="text-link" aria-pressed={showPassword} disabled={busy} onClick={() => setShowPassword(value => !value)}>{showPassword ? 'Hide password' : 'Show password'}</button>}
            {sendsEmail && emailWait > 0 && <p role="status" className="muted">Please wait {emailWait}s before another email request. The provider’s sending limit may last longer.</p>}
            <button type="submit" className="button" disabled={busy || !state.authReady || (sendsEmail && emailWait > 0)}>
              {busy ? 'Please wait…' : { 'sign-in': 'Sign in with password', 'sign-up': 'Create account', forgot: 'Send password-reset email', password: 'Save password' }[mode]}
            </button>
          </form>}
          <div className="inline-actions space-top">
            {mode === 'sign-in' && <button className="text-link" disabled={busy} onClick={() => choose('forgot')}>Forgot or haven’t set a password?</button>}
            {mode !== 'sign-in' && <button className="text-link" disabled={busy} onClick={() => choose('sign-in')}>{state.user ? 'Back to account' : 'Back to sign in'}</button>}
          </div>
        </>}
      </>}
      <p className="privacy-caption space-top">Your email is private. The owner can look up the account behind a contribution. Email addresses are currently unverified. <Link href="/privacy/" className="text-link">How privacy works</Link></p>
    </section>
  </>;
}
