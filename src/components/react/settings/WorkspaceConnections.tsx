import { useCallback, useEffect, useState } from 'react';
import Icon from '../Icon';
import ConfirmDialog from '../shared/ConfirmDialog';
import { ApiError } from '@/lib/app/api';
import { automationsApi, type ConnectionSummary } from '@/lib/app/automations';
import styles from './WorkspaceConnections.module.css';

/**
 * Settings → Integrations.
 *
 * Credentials automations use to reach systems outside Maildrill. Two properties this
 * screen exists to preserve:
 *
 *  - a secret is **write-only**. It is encrypted (AES-256-GCM) the moment it arrives and
 *    never comes back — the list shows a name and where it is used, never a value. Editing
 *    means replacing.
 *  - a flow stores a connection **id**, never the credential. Rotating a key here changes
 *    every workflow that references it, and nothing has to be re-published.
 *
 * v1 covers the credential shape the HTTP Request step needs (an API key sent as a header).
 * OAuth-based upstream Activepieces integrations land on the same table when they ship —
 * see docs/architecture/automations-activepieces.md §8.
 */

/** Piece names that can carry a connection today. */
const PIECES: { value: string; label: string; hint: string }[] = [
  {
    value: '@maildrill/http',
    label: 'HTTP API key',
    hint: 'Sent by the HTTP Request step as an Authorization header.',
  },
];

export default function WorkspaceConnections({ live }: { live: boolean }) {
  const [rows, setRows] = useState<ConnectionSummary[]>([]);
  const [loading, setLoading] = useState(live);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ConnectionSummary | null>(null);

  const [name, setName] = useState('');
  const [pieceName, setPieceName] = useState(PIECES[0]!.value);
  const [apiKey, setApiKey] = useState('');
  const [header, setHeader] = useState('Authorization');
  const [prefix, setPrefix] = useState('Bearer ');

  const refresh = useCallback(async () => {
    if (!live) return;
    setLoading(true);
    try {
      setRows((await automationsApi.connections()).data);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load connections.');
    } finally {
      setLoading(false);
    }
  }, [live]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = async () => {
    setSaving(true);
    try {
      await automationsApi.createConnection({
        name: name.trim(),
        pieceName,
        secret: { apiKey, header, prefix },
        metadata: { header },
      });
      setAdding(false);
      setName('');
      setApiKey('');
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the connection.');
    } finally {
      setSaving(false);
    }
  };

  const destroy = async () => {
    if (!confirmDelete) return;
    const target = confirmDelete;
    setConfirmDelete(null);
    try {
      await automationsApi.deleteConnection(target.id);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete the connection.');
    }
  };

  if (!live) {
    return (
      <p className={styles.empty}>
        Connections load once this workspace is connected to the service.
      </p>
    );
  }

  return (
    <div className={styles.wrap}>
      {error ? (
        <p className={styles.error} role="status">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className={styles.empty}>Loading…</p>
      ) : rows.length === 0 ? (
        <p className={styles.empty}>
          Nothing connected yet. Add a credential and any automation&rsquo;s HTTP Request step can
          use it — without the key ever appearing in a workflow.
        </p>
      ) : (
        <ul className={styles.list}>
          {rows.map((row) => (
            <li key={row.id} className={styles.row}>
              <span className={styles.rowIcon}>
                <Icon name="key" size={16} />
              </span>
              <span className={styles.rowText}>
                <span className={styles.rowTitle}>{row.name}</span>
                <span className={styles.rowSub}>
                  {PIECES.find((p) => p.value === row.pieceName)?.label ?? row.pieceName} · secret
                  stored encrypted, never shown
                </span>
              </span>
              <button
                type="button"
                className="sbtn"
                onClick={() => setConfirmDelete(row)}
                aria-label={`Delete connection ${row.name}`}
              >
                <Icon name="trash" size={14} /> Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          {/* Each control gets an explicit label + a SEPARATE description. Nesting the hint
              inside the <label> folds it into the control's accessible name, which makes
              two fields answer to "API key". */}
          <div className={styles.field}>
            <label htmlFor="conn-name">Name</label>
            <input
              id="conn-name"
              type="text"
              value={name}
              required
              placeholder="Orders API"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="conn-type">Type</label>
            <select
              id="conn-type"
              value={pieceName}
              aria-describedby="conn-type-hint"
              onChange={(e) => setPieceName(e.target.value)}
            >
              {PIECES.map((piece) => (
                <option key={piece.value} value={piece.value}>
                  {piece.label}
                </option>
              ))}
            </select>
            <em id="conn-type-hint">{PIECES.find((p) => p.value === pieceName)?.hint}</em>
          </div>
          <div className={styles.field}>
            <label htmlFor="conn-secret">API key</label>
            <input
              id="conn-secret"
              type="password"
              value={apiKey}
              required
              autoComplete="off"
              placeholder="sk_live_…"
              aria-describedby="conn-secret-hint"
              onChange={(e) => setApiKey(e.target.value)}
            />
            <em id="conn-secret-hint">
              Encrypted at rest. It is never returned by the API or shown again.
            </em>
          </div>
          <div className={styles.two}>
            <div className={styles.field}>
              <label htmlFor="conn-header">Header</label>
              <input
                id="conn-header"
                type="text"
                value={header}
                onChange={(e) => setHeader(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="conn-prefix">Prefix</label>
              <input
                id="conn-prefix"
                type="text"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
              />
            </div>
          </div>
          <div className={styles.actions}>
            <button type="submit" className="pbtn" disabled={saving}>
              {saving ? 'Saving…' : 'Save connection'}
            </button>
            <button type="button" className="sbtn" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="pbtn" onClick={() => setAdding(true)}>
          <Icon name="plus" size={15} /> Add connection
        </button>
      )}

      {confirmDelete ? (
        <ConfirmDialog
          title={`Delete “${confirmDelete.name}”?`}
          message="Any automation step using it will fail on its next run until you point it at another connection."
          confirmLabel="Delete"
          onConfirm={() => void destroy()}
          onCancel={() => setConfirmDelete(null)}
        />
      ) : null}
    </div>
  );
}
