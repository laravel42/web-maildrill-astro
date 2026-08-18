import { useEffect, useRef, useState } from 'react';
import { signIn } from 'auth-astro/client';
import { mockResetPassword } from '@/lib/app/services';
import { isAllowedLoginEmail } from '@/lib/auth/login-allowlist';
import { isWebAuthnCancel, passkeyLoginTicket, passkeysSupported } from '@/lib/app/webauthn';
import PhoneField from './PhoneField';
import type { Mode, Status } from './AuthForm.types';
import styles from './AuthForm.module.css';

export default function AuthForm({ mode }: { mode: Mode }) {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState('');
  // Set when a login is attempted with an address that isn't on the allowlist.
  const [notInvited, setNotInvited] = useState(false);
  // Signup collects a name and phone before the code is sent; verification is
  // what actually creates the user, so they ride along to that call.
  const [pendingProfile, setPendingProfile] = useState<{ name: string; phone: string } | null>(
    null,
  );
  const [stage, setStage] = useState<'form' | 'code' | 'twofa' | 'done'>('form');
  // Six positional slots so a digit typed into any box stays in place.
  const [code, setCode] = useState<string[]>(['', '', '', '', '', '']);
  // Two-factor challenge (accounts with an authenticator app enabled).
  const [twofaMode, setTwofaMode] = useState<'totp' | 'recovery'>('totp');
  const [twofaValue, setTwofaValue] = useState('');
  const [rememberDevice, setRememberDevice] = useState(false);
  const [pkSupported, setPkSupported] = useState(false);
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

  // Surface a friendly note when an expired/used sign-in link bounced here,
  // and resume a two-factor challenge handed over by the magic-link page
  // (the challenge ticket rides an HttpOnly cookie, never the URL).
  useEffect(() => {
    if (mode !== 'login') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('error')) {
      setError('That sign-in link expired or was already used — enter your email for a new code.');
    }
    if (params.get('stage') === '2fa') {
      setSentTo(params.get('email') ?? '');
      setStage('twofa');
    }
  }, [mode]);

  useEffect(() => {
    setPkSupported(passkeysSupported());
  }, []);

  /**
   * Terminal step for every path: exchange a one-time login ticket for the
   * Auth.js session, then play the "you're in" beat and hand off.
   */
  async function completeTicket(ticket: string) {
    const doSignIn = signIn as (p: string, o: Record<string, unknown>) => Promise<unknown>;
    const res = await doSignIn('credentials', {
      ticket,
      redirect: false,
      callbackUrl: '/dashboard',
    });
    if (res !== undefined) {
      setError('That sign-in expired — request a new code.');
      setStatus('error');
      return;
    }
    if (sentTo) window.posthog?.identify(sentTo, { email: sentTo });
    window.posthog?.capture('login_succeeded');
    setStatus('idle');
    setStage('done');
    window.setTimeout(() => window.location.assign('/dashboard'), 1100);
  }

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

    setStatus('loading');
    setError(null);
    setNotInvited(false);
    try {
      if (mode === 'login') {
        if (!email) throw new Error('Enter your work email.');
        // Private rollout: only allowlisted accounts get a sign-in code. Anyone
        // else is pointed at the waitlist rather than emailed a code.
        if (!isAllowedLoginEmail(email)) {
          setNotInvited(true);
          setStatus('idle');
          return;
        }
        const res = await fetch('/api/login-code', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        if (!res.ok) throw new Error('Could not send your code. Try again.');
        window.posthog?.capture('login_code_requested');
        setSentTo(email);
        setCode(['', '', '', '', '', '']);
        setStage('code');
        setStatus('idle');
        return;
      }
      if (mode === 'signup') {
        const firstName = String(data.get('firstName') || '').trim();
        const lastName = String(data.get('lastName') || '').trim();
        // PhoneField emits E.164 (guided country prefix + length validation);
        // this is only a backstop behind the form's native validity gate.
        const phoneRaw = String(data.get('phone') || '').trim();
        const terms = data.get('terms') === 'on';
        if (!firstName || !lastName || !email || !phoneRaw) {
          throw new Error('Please complete all fields.');
        }
        if (!/^\+\d{7,16}$/.test(phoneRaw)) {
          throw new Error('Enter a valid phone number.');
        }
        if (!terms) throw new Error('Please accept the Terms and Privacy Policy.');
        // Same gate as the login branch. Without it the server still refused —
        // /api/login-code only calls the backend for allowlisted addresses —
        // but this form read the deliberate no-enumeration 202 as success and
        // advanced to "enter your code", so a private rollout looked wide open
        // and the visitor waited for a code that was never sent.
        if (!isAllowedLoginEmail(email)) {
          setNotInvited(true);
          setStatus('idle');
          return;
        }
        window.posthog?.capture('signup_form_submitted', { channel: 'email' });
        // Registration is self-service: the same code flow as login, and
        // verifying it creates the user, their workspace and its Infobip
        // entity. The name and phone are held until that call.
        const res = await fetch('/api/login-code', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        if (!res.ok) throw new Error('Could not send your code. Try again.');
        setPendingProfile({ name: `${firstName} ${lastName}`.trim(), phone: phoneRaw });
        setSentTo(email);
        setCode(['', '', '', '', '', '']);
        setStage('code');
        setStatus('idle');
        return;
      }
      if (!email) throw new Error('Enter your work email.');
      await mockResetPassword(email);
      setStatus('success');
    } catch (err) {
      if (err instanceof Error) window.posthog?.captureException(err);
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
      // The BFF verifies (and consumes) the code, then answers with either a
      // one-time login ticket or a two-factor challenge.
      const res = await fetch('/api/login-verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: sentTo,
          code: clean,
          ...(pendingProfile ?? {}),
        }),
      });
      if (res.status === 429) {
        setError('Too many attempts — wait a few minutes and try again.');
        setStatus('error');
        return;
      }
      if (!res.ok) {
        setError('That code is invalid or expired.');
        setStatus('error');
        return;
      }
      const data = (await res.json()) as { requiresSecondFactor?: boolean; ticket?: string };
      if (data.requiresSecondFactor) {
        setTwofaMode('totp');
        setTwofaValue('');
        setError(null);
        setStatus('idle');
        setStage('twofa');
        return;
      }
      await completeTicket(data.ticket ?? '');
    } catch {
      setError('Something went wrong. Try again.');
      setStatus('error');
    }
  }

  async function onTwofa(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'loading') return;
    const value = twofaValue.trim();
    if (!value) return;
    setStatus('loading');
    setError(null);
    try {
      const res = await fetch('/api/twofa-verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...(twofaMode === 'totp' ? { totp: value } : { recoveryCode: value }),
          rememberDevice,
        }),
      });
      if (res.status === 429) {
        setError('Too many attempts — wait a few minutes and try again.');
        setStatus('error');
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (data.error === 'challenge_expired') {
          setStage('form');
          setStatus('idle');
          setError('That two-factor challenge expired — sign in again.');
          return;
        }
        setError(
          twofaMode === 'recovery'
            ? 'That recovery code is invalid or already used.'
            : 'That code didn’t match. Codes rotate every 30 seconds — try the current one.',
        );
        setStatus('error');
        return;
      }
      const data = (await res.json()) as { ticket: string };
      window.posthog?.capture('login_2fa_succeeded', { method: twofaMode });
      await completeTicket(data.ticket);
    } catch {
      setError('Something went wrong. Try again.');
      setStatus('error');
    }
  }

  async function onPasskey() {
    if (status === 'loading') return;
    setStatus('loading');
    setError(null);
    try {
      const ticket = await passkeyLoginTicket();
      window.posthog?.capture('login_passkey_succeeded');
      await completeTicket(ticket);
    } catch (err) {
      if (isWebAuthnCancel(err)) {
        setStatus('idle');
        return;
      }
      setError(err instanceof Error ? err.message : 'Passkey sign-in failed. Try an email code.');
      setStatus('error');
    }
  }

  // Send a fresh code to the same address (login and signup both use the
  // real code exchange).
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
    setTwofaValue('');
    setRememberDevice(false);
  }

  // Login and signup share one column: the header (and, for login, the footer)
  // stay put per the design and only this middle swaps. Copy differs by mode.
  const codeComplete = code.join('').length === 6;
  const resetLabel = 'Use a different email';

  // The terminal state, shared by both modes: registration is self-service, so
  // sign-up now ends where login does — a verified code, an account created and
  // a workspace to land in.
  const doneMiddle = (
    <div role="status" style={{ animation: 'pop .5s var(--ease-out) both' }}>
      <div className={styles.stepHead}>
        <div className={`${styles.successicon} ${styles.iconTile} ${styles.iconTileCheck}`}>
          {
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
          }
        </div>
        <h2 className={styles.substep}>You’re in</h2>
      </div>
      <p className={styles.sub} style={{ margin: 0 }}>
        Code verified — taking you to your workspace.
      </p>
    </div>
  );

  const codeMiddle = (
    <div style={{ animation: 'pop .5s var(--ease-out) both' }}>
      <div className={styles.stepHead}>
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
        <h2 className={styles.substep}>Check your email</h2>
      </div>
      <p className={styles.sub} style={{ margin: '0 0 22px' }}>
        We sent a magic link to <strong>{sentTo}</strong>. Click it to sign in — no password needed.
        The link expires in 15 minutes.
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
            disabled={status === 'loading' || !codeComplete}
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
            {resetLabel}
          </button>
          .
        </p>
      </div>
    </div>
  );

  // Two-factor challenge — after a valid email code, before the session.
  const twofaMiddle = (
    <div style={{ animation: 'pop .5s var(--ease-out) both' }}>
      <div className={styles.stepHead}>
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
            <path d="M12 2 4 5.5v5.2c0 4.9 3.4 9.5 8 10.8 4.6-1.3 8-5.9 8-10.8V5.5L12 2Z" />
            <path d="m9 12 2 2 4-4.5" />
          </svg>
        </div>
        <h2 className={styles.substep}>Two-factor check</h2>
      </div>
      <p className={styles.sub} style={{ margin: '0 0 18px' }}>
        {twofaMode === 'totp'
          ? 'Your account is protected with an authenticator app. Enter the 6-digit code it shows.'
          : 'Enter one of your recovery codes (like AB12-CD34). Each works once.'}
      </p>
      <form onSubmit={onTwofa} noValidate>
        <label className={styles.field}>
          <span className={styles.label}>
            {twofaMode === 'totp' ? 'Authenticator code' : 'Recovery code'}
          </span>
          <input
            className={styles.input}
            inputMode={twofaMode === 'totp' ? 'numeric' : 'text'}
            autoComplete="one-time-code"
            maxLength={twofaMode === 'totp' ? 6 : 9}
            value={twofaValue}
            autoFocus
            aria-label={twofaMode === 'totp' ? 'Authenticator code' : 'Recovery code'}
            onChange={(e) => {
              const raw = e.target.value;
              setTwofaValue(twofaMode === 'totp' ? raw.replace(/\D/g, '') : raw.toUpperCase());
              if (error) setError(null);
            }}
          />
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={rememberDevice}
            onChange={(e) => setRememberDevice(e.target.checked)}
          />
          <span>Trust this device for 60 days — skip this step next time.</span>
        </label>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <button
          className={styles.submit}
          type="submit"
          disabled={status === 'loading' || !twofaValue.trim()}
        >
          {status === 'loading' ? 'Verifying…' : 'Verify'}
        </button>
      </form>
      <div className={styles.hintCard}>
        <p className={styles.hintText}>
          <button
            type="button"
            className={styles.linkbtn}
            onClick={() => {
              setTwofaMode((m) => (m === 'totp' ? 'recovery' : 'totp'));
              setTwofaValue('');
              setError(null);
            }}
          >
            {twofaMode === 'totp'
              ? 'Use a recovery code instead'
              : 'Use your authenticator instead'}
          </button>{' '}
          ·{' '}
          <button type="button" className={styles.linkbtn} onClick={onReset}>
            Start over
          </button>
        </p>
      </div>
    </div>
  );

  // ---------- success screen (forgot) ----------
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
        ? '/ Try before buy — no credit card requested'
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

      {stage === 'code' ? (
        codeMiddle
      ) : stage === 'twofa' ? (
        twofaMiddle
      ) : stage === 'done' ? (
        doneMiddle
      ) : (
        <form onSubmit={onSubmit} noValidate method="post" action="#">
          {mode === 'signup' && (
            <div className={styles.row}>
              <label className={styles.field}>
                <span className={styles.label}>First name</span>
                <input
                  className={styles.input}
                  name="firstName"
                  autoComplete="given-name"
                  required
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Last name</span>
                <input
                  className={styles.input}
                  name="lastName"
                  autoComplete="family-name"
                  required
                />
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
              onChange={() => {
                if (notInvited) setNotInvited(false);
                if (error) setError(null);
              }}
            />
          </label>

          {mode === 'signup' && (
            <div className={styles.field}>
              <span className={styles.label}>Phone number</span>
              <PhoneField name="phone" required />
            </div>
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

          {/* Rendered in BOTH modes. Gated on `login` alone, the signup form
              set this state and displayed nothing — so a blocked signup just
              silently did nothing when submitted, which is worse than the
              unguarded form it replaced. The copy differs because the login
              notice points at /signup, and on the signup page that is a link
              back to itself. */}
          {notInvited && (
            <div className={styles.gate} role="status">
              {mode === 'login' ? (
                <>
                  We couldn&rsquo;t find an active account for that email. If you already signed
                  up, your confirmation email is on its way — expect it within a few days.
                  Otherwise <a href="/signup">join the waitlist</a> and you&rsquo;ll be part of the
                  crew in 3&ndash;7 days.
                </>
              ) : (
                <>
                  Maildrill is in a private rollout, so sign-ups are limited to invited accounts
                  right now. We&rsquo;ve noted your interest — if you were expecting access, check
                  the address you entered or <a href="/contact">get in touch</a>.
                </>
              )}
            </div>
          )}

          <button className={styles.submit} type="submit" disabled={status === 'loading'}>
            {submitLabel}
          </button>

          {mode === 'login' && pkSupported && (
            <>
              <div className={styles.orRow} aria-hidden="true">
                <span>or</span>
              </div>
              <button
                type="button"
                className={styles.pkbtn}
                onClick={() => void onPasskey()}
                disabled={status === 'loading'}
              >
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 11a3 3 0 0 0-3 3c0 1.8-.3 3.5-.9 5" />
                  <path d="M15 14c0 2.4-.3 4.6-.9 6.7" />
                  <path d="M17.8 18.4c.1-.9.2-2 .2-3.4a6 6 0 0 0-9-5.2" />
                  <path d="M5.4 12.9A6 6 0 0 0 6 14c0 1.4-.2 2.7-.5 4" />
                  <path d="M3.7 9.4A9 9 0 0 1 12 5a9 9 0 0 1 8.3 4.4" />
                  <path d="M6.2 3.9A11 11 0 0 1 12 2c2.1 0 4.1.6 5.8 1.7" />
                </svg>
                Sign in with a passkey
              </button>
            </>
          )}

          {mode === 'login' && (
            <p className={`${styles.note} ${styles.noteCenter}`}>
              We&rsquo;ll email you a one-time sign-in link
            </p>
          )}

          {mode === 'signup' && (
            <p className={`${styles.note} ${styles.noteCenter}`}>
              No password, no credit card · Cancel anytime
            </p>
          )}
        </form>
      )}

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
