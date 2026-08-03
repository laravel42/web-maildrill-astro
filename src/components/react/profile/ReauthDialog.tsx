import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/app/api';
import {
  isWebAuthnCancel,
  passkeysSupported,
  reauthWithPasskey,
  WebAuthnTimeoutError,
} from '@/lib/app/webauthn';
import Icon from '../Icon';
import styles from '../AppProfile.module.css';
import SecurityModal from './SecurityModal';
import type { SecurityOverview } from './security.logic';

type Method = 'passkey' | 'totp' | 'recovery' | 'email';

/**
 * Step-up challenge shown when a sensitive action answers `reauth_required`.
 * Offers whatever the account actually has: a passkey assertion, an
 * authenticator or recovery code, and always the emailed-code fallback.
 * Success stamps a fresh-authentication window server-side, then the caller
 * retries its action.
 */
export default function ReauthDialog({
  overview,
  email,
  onSuccess,
  onClose,
}: {
  overview: SecurityOverview | null;
  email: string | null;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const hasPasskey = Boolean(overview?.passkeys.length) && passkeysSupported();
  const hasTotp = Boolean(overview?.totp.enabled);
  const methods: Method[] = [
    ...(hasPasskey ? (['passkey'] as const) : []),
    ...(hasTotp ? (['totp', 'recovery'] as const) : []),
    'email',
  ];
  const [method, setMethod] = useState<Method>(methods[0] ?? 'email');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCode('');
    setError(null);
    if (method !== 'passkey') inputRef.current?.focus();
  }, [method]);

  const fail = (err: unknown, fallback: string) => {
    if (err instanceof ApiError && err.status === 429) {
      setError('Too many attempts — wait a few minutes and try again.');
      return;
    }
    setError(err instanceof ApiError && err.message !== 'invalid_code' ? err.message : fallback);
  };

  const runPasskey = async () => {
    setBusy(true);
    setError(null);
    try {
      await reauthWithPasskey();
      onSuccess();
    } catch (err) {
      if (err instanceof WebAuthnTimeoutError) {
        setError(err.message);
      } else if (!isWebAuthnCancel(err)) {
        fail(err, 'That passkey was not recognized.');
      }
    } finally {
      setBusy(false);
    }
  };

  const sendEmailCode = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post('me/security/reauth/code/request');
      setEmailSent(true);
      inputRef.current?.focus();
    } catch (err) {
      fail(err, 'Could not send the code. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async () => {
    const clean = code.trim();
    if (!clean) return;
    setBusy(true);
    setError(null);
    const path =
      method === 'totp'
        ? 'me/security/reauth/totp'
        : method === 'recovery'
          ? 'me/security/reauth/recovery'
          : 'me/security/reauth/code/verify';
    try {
      await api.post(path, { code: clean });
      onSuccess();
    } catch (err) {
      fail(
        err,
        method === 'recovery'
          ? 'That recovery code is invalid or already used.'
          : 'That code is invalid or expired.',
      );
    } finally {
      setBusy(false);
    }
  };

  const methodLabel: Record<Method, string> = {
    passkey: 'Passkey',
    totp: 'Authenticator',
    recovery: 'Recovery code',
    email: 'Email code',
  };

  return (
    <SecurityModal
      title="Confirm it's you"
      onClose={onClose}
      foot={
        method === 'passkey' ? (
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => void runPasskey()}
            disabled={busy}
          >
            {busy ? 'Waiting…' : 'Use passkey'}
          </button>
        ) : method === 'email' && !emailSent ? (
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => void sendEmailCode()}
            disabled={busy}
          >
            {busy ? 'Sending…' : 'Email me a code'}
          </button>
        ) : (
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => void submitCode()}
            disabled={busy || !code.trim()}
          >
            {busy ? 'Checking…' : 'Confirm'}
          </button>
        )
      }
    >
      <p className={styles.modalSub}>
        This action changes how your account is protected, so confirm your identity first.
      </p>
      {methods.length > 1 && (
        <div className={styles.methodRow} role="radiogroup" aria-label="Verification method">
          {methods.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={method === m}
              className={`${styles.methodChip}${method === m ? ` ${styles.methodChipOn}` : ''}`}
              onClick={() => setMethod(m)}
            >
              {methodLabel[m]}
            </button>
          ))}
        </div>
      )}

      {method === 'passkey' && (
        <p className={styles.stackDesc}>
          Your browser will ask for the passkey you registered — Touch ID, Face ID, Windows Hello,
          or a security key.
        </p>
      )}
      {method === 'totp' && (
        <div>
          <label className={styles.fieldLabel} htmlFor="reauth-code">
            6-digit code from your authenticator app
          </label>
          <input
            ref={inputRef}
            id="reauth-code"
            className={styles.input}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submitCode();
            }}
          />
        </div>
      )}
      {method === 'recovery' && (
        <div>
          <label className={styles.fieldLabel} htmlFor="reauth-code">
            One of your recovery codes (XXXX-XXXX)
          </label>
          <input
            ref={inputRef}
            id="reauth-code"
            className={styles.input}
            autoComplete="off"
            maxLength={9}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submitCode();
            }}
          />
        </div>
      )}
      {method === 'email' && (
        <div>
          {emailSent ? (
            <>
              <label className={styles.fieldLabel} htmlFor="reauth-code">
                6-digit code sent to {email ?? 'your email'}
              </label>
              <input
                ref={inputRef}
                id="reauth-code"
                className={styles.input}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void submitCode();
                }}
              />
            </>
          ) : (
            <p className={styles.stackDesc}>
              We’ll email a one-time code to {email ?? 'your account address'}.
            </p>
          )}
        </div>
      )}

      {error && (
        <p className={styles.inlineErr} role="alert">
          <Icon name="alert-triangle" size={13} /> {error}
        </p>
      )}
    </SecurityModal>
  );
}
