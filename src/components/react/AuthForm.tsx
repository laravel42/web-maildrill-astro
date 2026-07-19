import { useState } from 'react';
import { mockResetPassword, mockSignIn, mockSignUp } from '@/lib/app/services';
import type { Mode, Status } from './AuthForm.types';
import styles from './AuthForm.module.css';

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path
      fill="#EA4335"
      d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.2 13.5 17.6 9.5 24 9.5Z"
    />
    <path
      fill="#4285F4"
      d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9.1h12.4c-.5 2.9-2.2 5.3-4.6 7l7.1 5.5c4.2-3.9 6.6-9.6 6.6-16.4Z"
    />
    <path
      fill="#FBBC05"
      d="M10.4 28.3a14.5 14.5 0 0 1 0-8.6l-7.8-6.1a24 24 0 0 0 0 20.8l7.8-6.1Z"
    />
    <path
      fill="#34A853"
      d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.1-5.5c-2 1.3-4.5 2.1-8.8 2.1-6.4 0-11.8-4-13.6-9.8l-7.8 6.1C6.5 42.6 14.6 48 24 48Z"
    />
  </svg>
);

const AppleIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M16.4 1.3c.1 1-.3 2-1 2.8-.7.8-1.7 1.4-2.7 1.3-.1-1 .4-2 1-2.7.7-.8 1.8-1.3 2.7-1.4ZM19 17c-.5 1.2-.8 1.7-1.4 2.7-.9 1.4-2.2 3.1-3.8 3.1-1.4 0-1.8-.9-3.7-.9s-2.4.9-3.7.9c-1.6 0-2.8-1.5-3.7-2.9C.6 16.1.3 11.5 2 9c.9-1.4 2.4-2.3 3.9-2.3 1.5 0 2.5 1 3.7 1 1.2 0 1.9-1 3.7-1 1.3 0 2.7.7 3.7 2-3.2 1.8-2.7 6.4.9 7.6Z" />
  </svg>
);

export default function AuthForm({ mode }: { mode: Mode }) {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  async function runLogin() {
    setStatus('loading');
    setError(null);
    try {
      await mockSignIn('sso@maildrill.com', 'sso-placeholder');
      setStatus('success');
      window.setTimeout(() => {
        window.location.href = '/app';
      }, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setStatus('error');
    }
  }

  async function onSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'loading') return;
    const form = event.currentTarget;
    // Enforce native constraints (required / type=email / minLength) despite noValidate.
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const data = new FormData(form);
    const email = String(data.get('email') || '').trim();
    const password = String(data.get('password') || '');

    setStatus('loading');
    setError(null);
    try {
      if (mode === 'login') {
        if (!email || !password) throw new Error('Enter email and password.');
        await mockSignIn(email, password);
        setStatus('success');
        window.setTimeout(() => {
          window.location.href = '/app';
        }, 900);
        return;
      }
      if (mode === 'signup') {
        const firstName = String(data.get('firstName') || '').trim();
        const lastName = String(data.get('lastName') || '').trim();
        const terms = data.get('terms') === 'on';
        if (!firstName || !lastName || !email || !password) {
          throw new Error('Please complete all fields.');
        }
        if (!terms) throw new Error('Please accept the Terms and Privacy Policy.');
        await mockSignUp({ firstName, lastName, email, password });
        setStatus('success');
        return;
      }
      if (!email) throw new Error('Enter your work email.');
      await mockResetPassword(email);
      setStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setStatus('error');
    }
  }

  // ---------- success screens ----------
  if (status === 'success' && mode === 'login') {
    return (
      <div className={styles.af} style={{ maxWidth: '400px' }}>
        <div
          className={styles.successCenter}
          role="status"
          style={{ animation: 'pop .5s var(--ease-out) both' }}
        >
          <div
            className={`${styles.successicon} ${styles.successiconCheck}`}
            style={{ margin: '0 auto 18px' }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <h1 className={styles.successtitle}>Signing you in…</h1>
          <p className={styles.successtext}>Taking you to your workspace.</p>
        </div>
      </div>
    );
  }

  if (status === 'success' && mode === 'signup') {
    return (
      <div className={styles.af} style={{ maxWidth: '420px' }}>
        <div
          className={styles.successCenter}
          role="status"
          style={{ animation: 'pop .5s var(--ease-out) both' }}
        >
          <div className={`${styles.successicon} ${styles.successiconCheck}`}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <h1 className={styles.successtitle}>Check your inbox</h1>
          <p className={styles.successtext}>
            We sent a verification link to confirm your email and finish setting up your workspace.
          </p>
        </div>
      </div>
    );
  }

  if (status === 'success' && mode === 'forgot') {
    return (
      <div className={styles.af} style={{ maxWidth: '400px' }}>
        <p className={styles.eyebrow}>/ Account recovery</p>
        <div role="status" style={{ animation: 'pop .5s var(--ease-out) both' }}>
          <div className={`${styles.successicon} ${styles.successiconMail}`}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m22 7-10 6L2 7" />
            </svg>
          </div>
          <h1 className={`${styles.successtitle} ${styles.successtitleLg}`}>Check your inbox</h1>
          <p className={styles.successtext}>
            If an account matches that email, a reset link is on its way. It expires in 30 minutes.
          </p>
          <button type="button" className={styles.ghost} onClick={() => setStatus('idle')}>
            Use a different email
          </button>
        </div>
        <a className={styles.back} href="/login">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M19 12H5M11 18l-6-6 6-6" />
          </svg>
          Back to log in
        </a>
      </div>
    );
  }

  // ---------- form ----------
  const heading =
    mode === 'login' ? 'Log in' : mode === 'signup' ? 'Create account' : 'Reset password';
  const eyebrow =
    mode === 'login'
      ? '/ Welcome back'
      : mode === 'signup'
        ? '/ 14-day free trial'
        : '/ Account recovery';
  const submitLabel =
    status === 'loading'
      ? 'Please wait…'
      : mode === 'login'
        ? 'Log in'
        : mode === 'signup'
          ? 'Start free trial'
          : 'Send reset link';

  return (
    <div className={styles.af} style={{ maxWidth: mode === 'signup' ? '420px' : '400px' }}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h1 className={styles.title}>{heading}</h1>
      {mode === 'login' && (
        <p className={styles.sub}>
          New to Maildrill? <a href="/signup">Create an account</a>
        </p>
      )}
      {mode === 'signup' && (
        <p className={styles.sub}>
          Already have one? <a href="/login">Log in</a>
        </p>
      )}
      {mode === 'forgot' && (
        <p className={styles.sub}>
          Enter the email on your account and we'll send you a secure link to set a new password.
        </p>
      )}

      {mode !== 'forgot' && (
        <>
          <div className={styles.sso}>
            <button
              type="button"
              className={styles.ssobtn}
              onClick={mode === 'login' ? runLogin : () => setStatus('success')}
              disabled={status === 'loading'}
            >
              <GoogleIcon />
              {mode === 'login' ? 'Continue with Google' : 'Sign up with Google'}
            </button>
            {mode === 'login' && (
              <button
                type="button"
                className={styles.ssobtn}
                onClick={runLogin}
                disabled={status === 'loading'}
              >
                <AppleIcon />
                Continue with Apple
              </button>
            )}
          </div>
          <div className={styles.divider}>
            <span></span>
            <span className={styles.or}>or</span>
            <span></span>
          </div>
        </>
      )}

      <form onSubmit={onSubmit} noValidate method="post" action="#">
        {mode === 'signup' && (
          <div className={styles.row}>
            <label className={styles.field}>
              <span className={styles.label}>First name</span>
              <input className={styles.input} name="firstName" autoComplete="given-name" required />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Last name</span>
              <input className={styles.input} name="lastName" autoComplete="family-name" required />
            </label>
          </div>
        )}

        <label className={styles.field}>
          <span className={styles.label}>Work email</span>
          <input
            className={styles.input}
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@company.com"
            required
          />
        </label>

        {mode !== 'forgot' && (
          <label className={styles.field}>
            <span className={styles.labelrow}>
              <span className={styles.label} style={{ marginBottom: 0 }}>
                Password
              </span>
              {mode === 'login' && <a href="/forgot-password">Forgot?</a>}
            </span>
            <input
              className={styles.input}
              type="password"
              name="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'}
              minLength={8}
              required
            />
          </label>
        )}

        {mode === 'login' && (
          <label className={styles.check}>
            <input type="checkbox" name="remember" />
            Keep me signed in for 30 days
          </label>
        )}

        {mode === 'signup' && (
          <label className={styles.check}>
            <input type="checkbox" name="terms" />
            <span>
              I agree to the <a href="/legal/terms">Terms</a> and{' '}
              <a href="/legal/privacy">Privacy Policy</a>.
            </span>
          </label>
        )}

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <button className={styles.submit} type="submit" disabled={status === 'loading'}>
          {submitLabel}
        </button>

        {mode === 'signup' && (
          <p className={`${styles.note} ${styles.noteCenter}`}>
            No credit card required · Cancel anytime
          </p>
        )}
      </form>

      {mode === 'login' && (
        <p className={styles.foot}>
          Protected by SSO &amp; 2FA — <a href="/support">need help?</a>
        </p>
      )}
      {mode === 'forgot' && (
        <a className={styles.back} href="/login">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M19 12H5M11 18l-6-6 6-6" />
          </svg>
          Back to log in
        </a>
      )}
    </div>
  );
}
