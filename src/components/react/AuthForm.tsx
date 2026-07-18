import { useState } from 'react';
import { mockResetPassword, mockSignIn, mockSignUp } from '@/lib/app/services';

type Mode = 'login' | 'signup' | 'forgot';
type Status = 'idle' | 'loading' | 'success' | 'error';

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

  const styleTag = (
    <style>{`
      .af { width: 100%; max-width: ${mode === 'signup' ? '420px' : '400px'}; }
      .af__eyebrow { font-family: var(--font-mono); font-size: 12px; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); margin: 0; }
      .af__title { font-size: clamp(32px, 4vw, 46px); line-height: 1; letter-spacing: -.035em; font-weight: 800; margin: 12px 0 8px; }
      .af__sub { font-size: 15px; line-height: 1.6; color: var(--text3); margin: 0 0 26px; }
      .af__sub a, .af a { color: var(--accent); font-weight: 600; }
      .af__sso { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; }
      .af__ssobtn {
        display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%;
        padding: 12px; border-radius: 10px; border: 1px solid var(--border2); background: var(--surface);
        font-size: 14px; font-weight: 600; color: var(--text); transition: background .15s;
      }
      .af__ssobtn:hover { background: var(--surface3); }
      .af__divider { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; }
      .af__divider span:first-child, .af__divider span:last-child { flex: 1; height: 1px; background: var(--border2); }
      .af__divider .af__or { flex: 0; font-family: var(--font-mono); font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
      .af__row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
      .af label.af__field { display: block; margin-bottom: 14px; }
      .af__label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; }
      .af__labelrow { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
      .af__labelrow a { font-size: 12px; }
      .af__input {
        width: 100%; box-sizing: border-box; padding: 12px 14px; border-radius: 10px;
        border: 1px solid var(--border2); font-size: 15px; background: var(--surface); color: var(--text);
        outline: none; transition: border-color .15s, box-shadow .15s;
      }
      .af__input:focus { border-color: var(--accent); box-shadow: var(--focus-ring); }
      .af__check { display: flex; align-items: flex-start; gap: 8px; margin: 0 0 20px; font-size: 13px; line-height: 1.5; color: var(--text3); cursor: pointer; }
      .af__check input { width: 15px; height: 15px; margin-top: 2px; accent-color: var(--accent); flex-shrink: 0; }
      .af__submit {
        width: 100%; padding: 13px; border-radius: 10px; border: none; background: var(--ink);
        color: #fff; font-size: 15px; font-weight: 600; transition: background .2s;
      }
      .af__submit:hover:not(:disabled) { background: var(--accent); }
      .af__submit:disabled { opacity: .7; cursor: default; }
      .af__note { font-family: var(--font-mono); font-size: 11px; letter-spacing: .04em; color: var(--muted); margin: 14px 0 0; }
      .af__note--center { text-align: center; }
      .af__error { color: var(--danger); font-size: 13px; font-weight: 500; margin: 0 0 14px; }
      .af__foot { font-family: var(--font-mono); font-size: 11px; letter-spacing: .04em; color: var(--muted); margin: 28px 0 0; }
      .af__foot a { color: var(--accent); }
      .af__back { display: inline-flex; align-items: center; gap: 7px; margin-top: 30px; font-size: 14px; font-weight: 600; color: var(--accent); }
      .af__success { animation: pop .5s var(--ease-out) both; }
      .af__success--center { text-align: center; padding: 36px 0; }
      .af__successicon { width: 56px; height: 56px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
      .af__successicon--mail { border-radius: 14px; background: var(--accent-tint); color: var(--accent); margin: 24px 0 20px; }
      .af__successicon--check { background: var(--success-bg); color: var(--success); margin: 0 auto 18px; }
      .af__successtitle { font-size: 22px; font-weight: 700; letter-spacing: -.02em; margin: 0 0 8px; }
      .af__successtitle--lg { font-size: clamp(28px, 3.4vw, 40px); line-height: 1.02; letter-spacing: -.03em; font-weight: 800; }
      .af__successtext { font-size: 15px; color: var(--text3); margin: 0; line-height: 1.6; }
      .af__ghost { padding: 11px 18px; border-radius: 10px; border: 1px solid var(--border2); background: var(--surface); font-size: 14px; font-weight: 600; color: var(--text); margin-top: 24px; }
      .af__ghost:hover { background: var(--surface3); }
    `}</style>
  );

  // ---------- success screens ----------
  if (status === 'success' && mode === 'login') {
    return (
      <div className="af">
        <div className="af__success af__success--center" role="status">
          <div className="af__successicon af__successicon--check" style={{ margin: '0 auto 18px' }}>
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
          <h1 className="af__successtitle">Signing you in…</h1>
          <p className="af__successtext">Taking you to your workspace.</p>
        </div>
        {styleTag}
      </div>
    );
  }

  if (status === 'success' && mode === 'signup') {
    return (
      <div className="af">
        <div className="af__success af__success--center" role="status">
          <div className="af__successicon af__successicon--check">
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
          <h1 className="af__successtitle">Check your inbox</h1>
          <p className="af__successtext">
            We sent a verification link to confirm your email and finish setting up your workspace.
          </p>
        </div>
        {styleTag}
      </div>
    );
  }

  if (status === 'success' && mode === 'forgot') {
    return (
      <div className="af">
        <p className="af__eyebrow">/ Account recovery</p>
        <div className="af__success" role="status">
          <div className="af__successicon af__successicon--mail">
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
          <h1 className="af__successtitle af__successtitle--lg">Check your inbox</h1>
          <p className="af__successtext">
            If an account matches that email, a reset link is on its way. It expires in 30 minutes.
          </p>
          <button type="button" className="af__ghost" onClick={() => setStatus('idle')}>
            Use a different email
          </button>
        </div>
        <a className="af__back" href="/login">
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
        {styleTag}
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
    <div className="af">
      <p className="af__eyebrow">{eyebrow}</p>
      <h1 className="af__title">{heading}</h1>
      {mode === 'login' && (
        <p className="af__sub">
          New to Maildrill? <a href="/signup">Create an account</a>
        </p>
      )}
      {mode === 'signup' && (
        <p className="af__sub">
          Already have one? <a href="/login">Log in</a>
        </p>
      )}
      {mode === 'forgot' && (
        <p className="af__sub">
          Enter the email on your account and we'll send you a secure link to set a new password.
        </p>
      )}

      {mode !== 'forgot' && (
        <>
          <div className="af__sso">
            <button
              type="button"
              className="af__ssobtn"
              onClick={mode === 'login' ? runLogin : () => setStatus('success')}
              disabled={status === 'loading'}
            >
              <GoogleIcon />
              {mode === 'login' ? 'Continue with Google' : 'Sign up with Google'}
            </button>
            {mode === 'login' && (
              <button
                type="button"
                className="af__ssobtn"
                onClick={runLogin}
                disabled={status === 'loading'}
              >
                <AppleIcon />
                Continue with Apple
              </button>
            )}
          </div>
          <div className="af__divider">
            <span></span>
            <span className="af__or">or</span>
            <span></span>
          </div>
        </>
      )}

      <form onSubmit={onSubmit} noValidate method="post" action="#">
        {mode === 'signup' && (
          <div className="af__row">
            <label className="af__field">
              <span className="af__label">First name</span>
              <input className="af__input" name="firstName" autoComplete="given-name" required />
            </label>
            <label className="af__field">
              <span className="af__label">Last name</span>
              <input className="af__input" name="lastName" autoComplete="family-name" required />
            </label>
          </div>
        )}

        <label className="af__field">
          <span className="af__label">Work email</span>
          <input
            className="af__input"
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@company.com"
            required
          />
        </label>

        {mode !== 'forgot' && (
          <label className="af__field">
            <span className="af__labelrow">
              <span className="af__label" style={{ marginBottom: 0 }}>
                Password
              </span>
              {mode === 'login' && <a href="/forgot-password">Forgot?</a>}
            </span>
            <input
              className="af__input"
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
          <label className="af__check">
            <input type="checkbox" name="remember" />
            Keep me signed in for 30 days
          </label>
        )}

        {mode === 'signup' && (
          <label className="af__check">
            <input type="checkbox" name="terms" />
            <span>
              I agree to the <a href="/legal/terms">Terms</a> and{' '}
              <a href="/legal/privacy">Privacy Policy</a>.
            </span>
          </label>
        )}

        {error && (
          <p className="af__error" role="alert">
            {error}
          </p>
        )}

        <button className="af__submit" type="submit" disabled={status === 'loading'}>
          {submitLabel}
        </button>

        {mode === 'signup' && (
          <p className="af__note af__note--center">No credit card required · Cancel anytime</p>
        )}
      </form>

      {mode === 'login' && (
        <p className="af__foot">
          Protected by SSO &amp; 2FA — <a href="/support">need help?</a>
        </p>
      )}
      {mode === 'forgot' && (
        <a className="af__back" href="/login">
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

      {styleTag}
    </div>
  );
}
