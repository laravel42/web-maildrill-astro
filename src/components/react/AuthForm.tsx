import { useEffect, useRef, useState } from 'react';
import { signIn } from 'auth-astro/client';
import { mockResetPassword, mockSignUp } from '@/lib/app/services';
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

export default function AuthForm({ mode }: { mode: Mode }) {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState('');
  const [stage, setStage] = useState<'form' | 'code' | 'done'>('form');
  // Six positional slots so a digit typed into any box stays in place.
  const [code, setCode] = useState<string[]>(['', '', '', '', '', '']);
  const boxesRef = useRef<HTMLDivElement>(null);

  const focusBox = (i: number) => {
    const el = boxesRef.current?.querySelectorAll('input')[i];
    if (el) {
      el.focus();
      el.select();
    }
  };
  const setDigit = (i: number, v: string) => {
    setCode((prev) => {
      const next = prev.slice();
      next[i] = v;
      return next;
    });
    setError(null);
  };

  // Surface a friendly note when an expired/used sign-in link bounced here.
  useEffect(() => {
    if (mode !== 'login') return;
    if (new URLSearchParams(window.location.search).get('error')) {
      setError('That sign-in link expired or was already used — enter your email for a new code.');
    }
  }, [mode]);

  async function onSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'loading') return;
    const form = event.currentTarget;
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
        if (!email) throw new Error('Enter your work email.');
        const res = await fetch('/api/login-code', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        if (!res.ok) throw new Error('Could not send your code. Try again.');
        setSentTo(email);
        setCode(['', '', '', '', '', '']);
        setStage('code');
        setStatus('idle');
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

  async function onVerify(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'loading') return;
    const clean = code.join('').replace(/\D/g, '');
    if (clean.length !== 6) {
      setError('Enter all 6 digits from the email.');
      return;
    }
    setStatus('loading');
    setError(null);
    try {
      const doSignIn = signIn as (p: string, o: Record<string, unknown>) => Promise<unknown>;
      // redirect:false so we control the transition: on success it resolves to
      // undefined (session cookie already set); a bad code resolves to the raw
      // Response without navigating.
      const res = await doSignIn('credentials', {
        email: sentTo,
        code: clean,
        redirect: false,
        callbackUrl: '/dashboard',
      });
      if (res !== undefined) {
        setError('That code is invalid or expired.');
        setStatus('error');
        return;
      }
      // Success: show the "You're in" beat, then hand off to the workspace.
      setStatus('idle');
      setStage('done');
      window.setTimeout(() => window.location.assign('/dashboard'), 1100);
    } catch {
      setError('Something went wrong. Try again.');
      setStatus('error');
    }
  }

  // Send the sign-in email again for the same address.
  async function onResend() {
    try {
      await fetch('/api/login-code', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: sentTo }),
      });
      setCode(['', '', '', '', '', '']);
      setError(null);
      focusBox(0);
    } catch {
      setError('Could not resend. Try again.');
    }
  }
  // Back to the email step to use a different address.
  function onReset() {
    setStage('form');
    setStatus('idle');
    setError(null);
    setCode(['', '', '', '', '', '']);
  }

  // ---------- login: verified, handing off to the workspace ----------
  if (mode === 'login' && stage === 'done') {
    return (
      <div className={styles.af} style={{ maxWidth: '400px' }}>
        <div role="status" style={{ animation: 'pop .5s var(--ease-out) both' }}>
          <div className={`${styles.successicon} ${styles.iconTile} ${styles.iconTileCheck}`}>
            <svg
              width="26"
              height="26"
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
          <h1 className={styles.substep}>You&rsquo;re in</h1>
          <p className={styles.sub} style={{ margin: 0 }}>
            Code verified — taking you to your workspace.
          </p>
        </div>
      </div>
    );
  }

  // ---------- login: check email for the magic link (or enter the code) ----------
  if (mode === 'login' && stage === 'code') {
    const complete = code.join('').length === 6;
    return (
      <div className={styles.af} style={{ maxWidth: '400px' }}>
        <div className={`${styles.successicon} ${styles.iconTile} ${styles.iconTileMail}`}>
          <svg
            width="26"
            height="26"
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
        <h1 className={styles.substep}>Check your email</h1>
        <p className={styles.sub} style={{ margin: '0 0 22px' }}>
          We sent a magic link to <strong>{sentTo}</strong>. Click it to sign in — no password
          needed. The link expires in 15 minutes.
        </p>

        <div className={styles.otpSection}>
          <p className={styles.otpLabel}>Or enter the 6-digit code</p>
          <form onSubmit={onVerify} noValidate>
            <div className={styles.otp} ref={boxesRef}>
              {code.map((d, i) => (
                <input
                  // Fixed six-slot list that never reorders — index is stable.
                  key={i}
                  className={styles.otpBox}
                  inputMode="numeric"
                  autoComplete={i === 0 ? 'one-time-code' : 'off'}
                  maxLength={1}
                  value={d}
                  aria-label={`Digit ${i + 1}`}
                  autoFocus={i === 0}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(-1);
                    setDigit(i, v);
                    if (v && i < 5) focusBox(i + 1);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !code[i] && i > 0) {
                      e.preventDefault();
                      setDigit(i - 1, '');
                      focusBox(i - 1);
                    }
                  }}
                  onPaste={(e) => {
                    e.preventDefault();
                    const t = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                    if (!t) return;
                    const next = ['', '', '', '', '', ''];
                    t.split('').forEach((c, j) => (next[j] = c));
                    setCode(next);
                    setError(null);
                    focusBox(Math.min(t.length, 5));
                  }}
                />
              ))}
            </div>
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            <button
              className={styles.submit}
              type="submit"
              disabled={status === 'loading' || !complete}
            >
              {status === 'loading' ? 'Verifying…' : 'Verify code'}
            </button>
          </form>
        </div>

        <div className={styles.hintCard}>
          <p className={styles.hintTitle}>Didn&rsquo;t get it?</p>
          <p className={styles.hintText}>
            Check spam, or{' '}
            <button type="button" className={styles.linkbtn} onClick={() => void onResend()}>
              resend the link
            </button>
            . Wrong address?{' '}
            <button type="button" className={styles.linkbtn} onClick={onReset}>
              Use a different email
            </button>
            .
          </p>
        </div>
      </div>
    );
  }

  // ---------- success screens (signup / forgot) ----------
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
        ? 'Send magic link'
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

      {mode === 'signup' && (
        <>
          <div className={styles.sso}>
            <button
              type="button"
              className={styles.ssobtn}
              onClick={() => setStatus('success')}
              disabled={status === 'loading'}
            >
              <GoogleIcon />
              Sign up with Google
            </button>
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

        {mode === 'signup' && (
          <label className={styles.field}>
            <span className={styles.labelrow}>
              <span className={styles.label} style={{ marginBottom: 0 }}>
                Password
              </span>
            </span>
            <input
              className={styles.input}
              type="password"
              name="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              minLength={8}
              required
            />
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

        {mode === 'login' && (
          <p className={`${styles.note} ${styles.noteCenter}`}>
            We&rsquo;ll email you a one-time sign-in link
          </p>
        )}

        {mode === 'signup' && (
          <p className={`${styles.note} ${styles.noteCenter}`}>
            No credit card required · Cancel anytime
          </p>
        )}
      </form>

      {mode === 'login' && (
        <p className={styles.foot}>
          Passwordless &amp; secure by default — <a href="/support">need help?</a>
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
