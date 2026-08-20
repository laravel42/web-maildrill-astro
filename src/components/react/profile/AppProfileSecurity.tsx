import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '../Icon';
import { api, ApiError } from '@/lib/app/api';
import {
  isWebAuthnCancel,
  passkeysSupported,
  registerPasskey,
  WebAuthnTimeoutError,
} from '@/lib/app/webauthn';
import type { ToastTone } from '../shared/useToast';
import ConfirmDialog from '../shared/ConfirmDialog';
import styles from '../AppProfile.module.css';
import SecurityModal from './SecurityModal';
import ReauthDialog from './ReauthDialog';
import {
  formatDate,
  formatRelative,
  passkeySyncLabel,
  recoveryCodesFile,
  type SecurityOverview,
} from './security.logic';

type TotpModalState = {
  step: 'scan' | 'codes';
  secret: string;
  otpauthUrl: string;
  qrDataUrl: string | null;
  code: string;
  busy: boolean;
  error: string | null;
  recoveryCodes: string[];
};

type Confirming = {
  title: string;
  message: string;
  confirmLabel: string;
  run: () => Promise<void>;
} | null;

const errMsg = (e: unknown, fallback: string) =>
  e instanceof ApiError && e.message && !/^\d+ /.test(e.message) ? e.message : fallback;

/**
 * Security tab: sign-in methods, passkeys, authenticator app + recovery
 * codes. Sensitive mutations run through the reauth gate — a 403
 * `reauth_required` opens the step-up dialog and retries on success.
 */
export default function AppProfileSecurity({
  email,
  show,
}: {
  email: string | null;
  show: (msg: string, tone?: ToastTone) => void;
}) {
  const [overview, setOverview] = useState<SecurityOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [supported, setSupported] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);
  const [renameBusy, setRenameBusy] = useState(false);
  const [totpModal, setTotpModal] = useState<TotpModalState | null>(null);
  const [codesModal, setCodesModal] = useState<string[] | null>(null);
  const [codesCopied, setCodesCopied] = useState(false);
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [reauthRun, setReauthRun] = useState<(() => Promise<void>) | null>(null);
  const totpInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const data = await api.get<SecurityOverview>('me/security/overview');
    setOverview(data);
  }, []);

  useEffect(() => {
    setSupported(passkeysSupported());
    let alive = true;
    void refresh()
      .catch(() => undefined)
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [refresh]);

  /** Run a mutation that may demand recent authentication. */
  const sensitive = useCallback(async (run: () => Promise<void>) => {
    try {
      await run();
    } catch (err) {
      if (err instanceof ApiError && err.status === 403 && err.message === 'reauth_required') {
        setReauthRun(() => run);
        return;
      }
      throw err;
    }
  }, []);

  // ---------------------------------------------------------------------
  // Passkeys
  // ---------------------------------------------------------------------

  const addPasskey = async () => {
    setAddBusy(true);
    try {
      const passkey = await registerPasskey(addName.trim() || undefined);
      setAddOpen(false);
      setAddName('');
      await refresh().catch(() => undefined);
      show(`Passkey “${passkey.name}” added`);
    } catch (err) {
      if (isWebAuthnCancel(err)) return;
      // Timed out waiting on hardware (e.g. no built-in authenticator and no
      // key inserted) — the error's message says exactly what to do.
      if (err instanceof WebAuthnTimeoutError) {
        show(err.message, 'alert');
        return;
      }
      if (err instanceof ApiError && err.message === 'duplicate_credential') {
        show('That passkey is already registered on this account', 'alert');
        return;
      }
      show(errMsg(err, 'Could not add the passkey'), 'alert');
    } finally {
      setAddBusy(false);
    }
  };

  const saveRename = async () => {
    if (!renameTarget) return;
    const name = renameTarget.name.trim();
    if (!name) return;
    setRenameBusy(true);
    try {
      await api.patch(`me/security/passkeys/${renameTarget.id}`, { name });
      setRenameTarget(null);
      await refresh().catch(() => undefined);
      show('Passkey renamed');
    } catch (err) {
      show(errMsg(err, 'Could not rename the passkey'), 'alert');
    } finally {
      setRenameBusy(false);
    }
  };

  const removePasskey = (id: string, name: string) => {
    setConfirming({
      title: `Remove “${name}”?`,
      message:
        'This passkey stops working immediately for sign-in and identity checks. You can always sign in with an email code.',
      confirmLabel: 'Remove passkey',
      run: async () => {
        await sensitive(async () => {
          await api.del(`me/security/passkeys/${id}`);
        });
      },
    });
  };

  // ---------------------------------------------------------------------
  // Authenticator (TOTP)
  // ---------------------------------------------------------------------

  const startTotpSetup = async () => {
    try {
      const setup = await api.post<{ secret: string; otpauthUrl: string }>(
        'me/security/totp/setup',
      );
      setTotpModal({
        step: 'scan',
        secret: setup.secret,
        otpauthUrl: setup.otpauthUrl,
        qrDataUrl: null,
        code: '',
        busy: false,
        error: null,
        recoveryCodes: [],
      });
      // QR rendering is lazy — the modal shows the manual key meanwhile.
      const qrcode = await import('qrcode');
      const dataUrl = await qrcode.toDataURL(setup.otpauthUrl, { width: 220, margin: 1 });
      setTotpModal((m) => (m && m.step === 'scan' ? { ...m, qrDataUrl: dataUrl } : m));
    } catch (err) {
      show(errMsg(err, 'Could not start authenticator setup'), 'alert');
    }
  };

  const confirmTotp = async () => {
    if (!totpModal || totpModal.busy) return;
    const clean = totpModal.code.replace(/\D/g, '');
    if (clean.length !== 6) {
      setTotpModal({ ...totpModal, error: 'Enter the 6-digit code from your app.' });
      return;
    }
    setTotpModal({ ...totpModal, busy: true, error: null });
    try {
      const res = await api.post<{ recoveryCodes: string[] }>('me/security/totp/confirm', {
        code: clean,
      });
      setCodesCopied(false);
      setTotpModal((m) =>
        m ? { ...m, step: 'codes', busy: false, recoveryCodes: res.recoveryCodes } : m,
      );
      await refresh().catch(() => undefined);
    } catch (err) {
      const rateLimited = err instanceof ApiError && err.status === 429;
      setTotpModal((m) =>
        m
          ? {
              ...m,
              busy: false,
              error: rateLimited
                ? 'Too many attempts — wait a few minutes and try again.'
                : 'That code didn’t match. Codes rotate every 30 seconds — try the current one.',
            }
          : m,
      );
    }
  };

  const disableTotp = () => {
    setConfirming({
      title: 'Turn off the authenticator?',
      message:
        'Two-factor prompts stop, your recovery codes are deleted, and every trusted device is forgotten. You can set it up again at any time.',
      confirmLabel: 'Turn off',
      run: async () => {
        await sensitive(async () => {
          await api.post('me/security/totp/disable');
        });
      },
    });
  };

  const regenerateCodes = () => {
    setConfirming({
      title: 'Generate new recovery codes?',
      message:
        'Your current codes stop working immediately — including any you have printed or saved. The new set is shown only once.',
      confirmLabel: 'Generate new codes',
      run: async () => {
        await sensitive(async () => {
          const res = await api.post<{ recoveryCodes: string[] }>(
            'me/security/recovery-codes/regenerate',
          );
          setCodesCopied(false);
          setCodesModal(res.recoveryCodes);
        });
      },
    });
  };

  // ---------------------------------------------------------------------
  // Confirm-dialog plumbing (one dialog serves every destructive action)
  // ---------------------------------------------------------------------

  const runConfirmed = async () => {
    if (!confirming || confirmBusy) return;
    setConfirmBusy(true);
    try {
      await confirming.run();
      setConfirming(null);
      await refresh().catch(() => undefined);
    } catch (err) {
      show(errMsg(err, 'That didn’t go through — try again'), 'alert');
    } finally {
      setConfirmBusy(false);
    }
  };

  const onReauthSuccess = () => {
    const run = reauthRun;
    setReauthRun(null);
    setConfirming(null);
    if (run) {
      void (async () => {
        try {
          await run();
          await refresh().catch(() => undefined);
          show('Done — your security settings are updated');
        } catch (err) {
          show(errMsg(err, 'That didn’t go through — try again'), 'alert');
        }
      })();
    }
  };

  const copyCodes = (codes: string[]) => {
    void navigator.clipboard?.writeText(codes.join('\n')).then(() => {
      setCodesCopied(true);
      show('Recovery codes copied');
    });
  };

  const downloadCodes = (codes: string[]) => {
    const blob = new Blob([recoveryCodesFile(codes, email)], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'maildrill-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
    setCodesCopied(true);
  };

  const totp = overview?.totp;
  const passkeys = overview?.passkeys ?? [];

  const recoveryCodesGrid = (codes: string[], titleId: string) => (
    <>
      <p className={styles.modalSub} id={titleId}>
        Store these somewhere safe — a password manager or a printout. Each code signs you in once
        if you lose your authenticator, and <strong>they will not be shown again</strong>.
      </p>
      <ul className={styles.codeGrid} aria-labelledby={titleId}>
        {codes.map((c) => (
          <li key={c}>
            <code>{c}</code>
          </li>
        ))}
      </ul>
      <div className={styles.codeActions}>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnSm}`}
          onClick={() => copyCodes(codes)}
        >
          <Icon name="copy" size={13} /> Copy
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnSm}`}
          onClick={() => downloadCodes(codes)}
        >
          <Icon name="download" size={13} /> Download .txt
        </button>
      </div>
    </>
  );

  return (
    <>
      <div className={styles.section}>
        <div className={styles.sectionHead}>Sign-in</div>
        <ul className={styles.stack}>
          <li className={styles.stackRow}>
            <span className={styles.stackIcon}>
              <Icon name="mail" size={18} />
            </span>
            <div className={styles.stackBody}>
              <p className={styles.stackTitle}>Passwordless email codes</p>
              <p className={styles.stackDesc}>
                You sign in with a 6-digit code sent to {email ?? 'your email'}
              </p>
            </div>
            <span className={`${styles.chip} ${styles.chipOn}`}>On</span>
          </li>
          <li className={styles.stackRow}>
            <span className={styles.stackIcon}>
              <Icon name="fingerprint" size={18} />
            </span>
            <div className={styles.stackBody}>
              <p className={styles.stackTitle}>Passkeys</p>
              <p className={styles.stackDesc}>
                {passkeys.length === 0
                  ? 'Sign in with Touch ID, Face ID, Windows Hello, or a security key'
                  : `${passkeys.length} passkey${passkeys.length === 1 ? '' : 's'} registered — phishing-resistant and counts as two factors`}
              </p>
            </div>
            {passkeys.length > 0 ? (
              <span className={`${styles.chip} ${styles.chipOn}`}>On</span>
            ) : (
              <span className={`${styles.chip} ${styles.chipOff}`}>Off</span>
            )}
            <button
              className={`${styles.btn} ${styles.btnSm}`}
              type="button"
              disabled={!supported || loading}
              onClick={() => setAddOpen(true)}
            >
              Add passkey
            </button>
          </li>
        </ul>
        {!supported && (
          <p className={styles.sectionNote}>
            This browser doesn’t support passkeys — try a current Chrome, Safari, Edge, or Firefox.
          </p>
        )}
        {loading ? (
          <p className={styles.loadingRow}>Loading passkeys…</p>
        ) : passkeys.length > 0 ? (
          <ul className={styles.stack}>
            {passkeys.map((p) => (
              <li key={p.id} className={styles.stackRow}>
                <span className={styles.stackIcon}>
                  <Icon name="key" size={17} />
                </span>
                <div className={styles.stackBody}>
                  <p className={styles.stackTitle}>{p.name}</p>
                  <p className={styles.stackDesc}>
                    {passkeySyncLabel(p.deviceType, p.backedUp)} · Added {formatDate(p.createdAt)} ·
                    Last used {p.lastUsedAt ? formatRelative(p.lastUsedAt) : 'never'}
                  </p>
                </div>
                <button
                  className={`${styles.btn} ${styles.btnSm} ${styles.btnQuiet}`}
                  type="button"
                  onClick={() => setRenameTarget({ id: p.id, name: p.name })}
                >
                  Rename
                </button>
                <button
                  className={styles.revoke}
                  type="button"
                  onClick={() => removePasskey(p.id, p.name)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHead}>Two-factor authentication</div>
        <ul className={styles.stack}>
          <li className={styles.stackRow}>
            <span className={styles.stackIcon}>
              <Icon name="smartphone" size={18} />
            </span>
            <div className={styles.stackBody}>
              <p className={styles.stackTitle}>Authenticator app</p>
              <p className={styles.stackDesc}>
                {loading
                  ? 'Loading…'
                  : totp?.enabled
                    ? `On since ${formatDate(totp.enabledAt)} — codes from Google Authenticator, 1Password, Authy, and friends`
                    : 'Six-digit codes as a second step after your email code'}
              </p>
            </div>
            {totp?.enabled ? (
              <>
                <span className={`${styles.chip} ${styles.chipOn}`}>On</span>
                <button
                  className={styles.revoke}
                  type="button"
                  onClick={disableTotp}
                  disabled={loading}
                >
                  Turn off
                </button>
              </>
            ) : (
              <>
                <span className={`${styles.chip} ${styles.chipOff}`}>Off</span>
                <button
                  className={`${styles.btn} ${styles.btnSm}`}
                  type="button"
                  onClick={() => void startTotpSetup()}
                  disabled={loading}
                >
                  Set up
                </button>
              </>
            )}
          </li>
          <li className={styles.stackRow}>
            <span className={styles.stackIcon}>
              <Icon name="key" size={18} />
            </span>
            <div className={styles.stackBody}>
              <p className={styles.stackTitle}>Recovery codes</p>
              <p className={styles.stackDesc}>
                {totp?.enabled
                  ? `${totp.recoveryCodesRemaining} unused code${totp.recoveryCodesRemaining === 1 ? '' : 's'} left — each signs you in once without your authenticator`
                  : 'Generated automatically when you set up the authenticator'}
              </p>
            </div>
            {totp?.enabled ? (
              <button
                className={`${styles.btn} ${styles.btnSm}`}
                type="button"
                onClick={regenerateCodes}
              >
                Regenerate
              </button>
            ) : (
              <span className={`${styles.chip} ${styles.chipOff}`}>Off</span>
            )}
          </li>
        </ul>
      </div>

      {addOpen && (
        <SecurityModal
          title="Add a passkey"
          onClose={() => {
            if (!addBusy) setAddOpen(false);
          }}
          foot={
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => void addPasskey()}
              disabled={addBusy}
            >
              {addBusy ? 'Waiting for your device…' : 'Continue'}
            </button>
          }
        >
          <p className={styles.modalSub}>
            Your browser will ask you to confirm with Touch ID, Face ID, Windows Hello, your phone,
            or a security key. The private key never leaves that device.
          </p>
          <label className={styles.fieldLabel} htmlFor="passkey-name">
            Name <span className={styles.note}>optional</span>
          </label>
          <input
            id="passkey-name"
            className={styles.input}
            type="text"
            placeholder="e.g. MacBook Touch ID"
            maxLength={80}
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void addPasskey();
            }}
          />
          <p className={styles.fieldHint}>Left empty, it’s named after this browser.</p>
        </SecurityModal>
      )}

      {renameTarget && (
        <SecurityModal
          title="Rename passkey"
          onClose={() => {
            if (!renameBusy) setRenameTarget(null);
          }}
          foot={
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => void saveRename()}
              disabled={renameBusy || !renameTarget.name.trim()}
            >
              {renameBusy ? 'Saving…' : 'Save'}
            </button>
          }
        >
          <label className={styles.fieldLabel} htmlFor="passkey-rename">
            Name
          </label>
          <input
            id="passkey-rename"
            className={styles.input}
            type="text"
            maxLength={80}
            value={renameTarget.name}
            onChange={(e) => setRenameTarget({ ...renameTarget, name: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void saveRename();
            }}
            autoFocus
          />
        </SecurityModal>
      )}

      {totpModal && totpModal.step === 'scan' && (
        <SecurityModal
          title="Set up your authenticator"
          onClose={() => {
            if (!totpModal.busy) setTotpModal(null);
          }}
          foot={
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => void confirmTotp()}
              disabled={totpModal.busy || totpModal.code.replace(/\D/g, '').length !== 6}
            >
              {totpModal.busy ? 'Verifying…' : 'Verify & turn on'}
            </button>
          }
        >
          <p className={styles.modalSub}>
            Scan the QR code with Google Authenticator (or 1Password, Microsoft Authenticator,
            Authy, Bitwarden) — then enter the 6-digit code it shows.
          </p>
          <div className={styles.qrBox} aria-hidden={totpModal.qrDataUrl ? undefined : true}>
            {totpModal.qrDataUrl ? (
              <img
                src={totpModal.qrDataUrl}
                width={180}
                height={180}
                alt="QR code for your authenticator app"
              />
            ) : (
              <span className={styles.stackDesc}>Generating QR…</span>
            )}
          </div>
          <p className={styles.fieldLabel}>Can’t scan? Enter this key manually</p>
          <code className={styles.secretBox}>{totpModal.secret}</code>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSm}`}
            onClick={() => {
              void navigator.clipboard?.writeText(totpModal.secret);
              show('Setup key copied');
            }}
          >
            <Icon name="copy" size={13} /> Copy key
          </button>
          <div style={{ marginTop: 14 }}>
            <label className={styles.fieldLabel} htmlFor="totp-confirm">
              6-digit code
            </label>
            <input
              ref={totpInputRef}
              id="totp-confirm"
              className={styles.input}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={totpModal.code}
              onChange={(e) =>
                setTotpModal({ ...totpModal, code: e.target.value.replace(/\D/g, ''), error: null })
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') void confirmTotp();
              }}
            />
          </div>
          {totpModal.error && (
            <p className={styles.inlineErr} role="alert">
              <Icon name="alert-triangle" size={13} /> {totpModal.error}
            </p>
          )}
        </SecurityModal>
      )}

      {totpModal && totpModal.step === 'codes' && (
        <SecurityModal
          title="Authenticator is on — save your recovery codes"
          onClose={() => setTotpModal(null)}
          locked
          foot={
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => {
                setTotpModal(null);
                show('Two-factor authentication enabled');
              }}
            >
              {codesCopied ? 'Done' : 'I’ve saved them'}
            </button>
          }
        >
          {recoveryCodesGrid(totpModal.recoveryCodes, 'totp-codes-title')}
        </SecurityModal>
      )}

      {codesModal && (
        <SecurityModal
          title="Your new recovery codes"
          onClose={() => setCodesModal(null)}
          locked
          foot={
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => {
                setCodesModal(null);
                show('Recovery codes regenerated');
              }}
            >
              {codesCopied ? 'Done' : 'I’ve saved them'}
            </button>
          }
        >
          {recoveryCodesGrid(codesModal, 'regen-codes-title')}
        </SecurityModal>
      )}

      {confirming && (
        <ConfirmDialog
          title={confirming.title}
          message={confirming.message}
          confirmLabel={confirmBusy ? 'Working…' : confirming.confirmLabel}
          onConfirm={() => void runConfirmed()}
          onCancel={() => {
            if (!confirmBusy) setConfirming(null);
          }}
        />
      )}

      {reauthRun && (
        <ReauthDialog
          overview={overview}
          email={email}
          onSuccess={onReauthSuccess}
          onClose={() => setReauthRun(null)}
        />
      )}
    </>
  );
}
