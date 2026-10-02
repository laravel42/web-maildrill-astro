import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../Icon';
import Modal from '../shared/Modal';
import { matchesSearchQuery } from '@/lib/app/search-match';
import type { PieceMeta } from '@/lib/app/automations';
import styles from './StepPicker.module.css';

/**
 * The step picker.
 *
 * Opened by every `+` on the canvas and by the trigger node. Deliberately search-first
 * with a small set of named groups rather than a wall of integrations: the brief's own
 * warning about "hundreds of integrations on the first screen" is the failure mode here,
 * and it stays true as the registry grows because groups come from the catalog, not from
 * a hard-coded list.
 */

export interface PickerChoice {
  kind: 'trigger' | 'action';
  pieceName: string;
  pieceVersion: string;
  /** Action or trigger name within the piece. */
  name: string;
  displayName: string;
  description: string;
  category: string;
  accent: string | null;
  props: Record<string, { required: boolean; defaultValue?: unknown }>;
}

/** Logic steps the engine implements itself; they have no piece behind them. */
export const STRUCTURAL_CHOICES: PickerChoice[] = [
  {
    kind: 'action',
    pieceName: '__router__',
    pieceVersion: '1.0.0',
    name: 'router',
    displayName: 'Branch',
    description: 'Split the journey down different paths depending on the data.',
    category: 'Logic',
    accent: '--text3',
    props: {},
  },
  {
    kind: 'action',
    pieceName: '__loop__',
    pieceVersion: '1.0.0',
    name: 'loop',
    displayName: 'Loop',
    description: 'Repeat the steps inside once for every item in a list.',
    category: 'Logic',
    accent: '--text3',
    props: {},
  },
];

/** Groups in the order a marketer looks for them, not alphabetical. */
const CATEGORY_ORDER = [
  'Subscribers',
  'Campaigns',
  'Email',
  'SMS',
  'WhatsApp',
  'Voice',
  'Logic',
  'Data',
  'Webhooks',
  'Manual',
];

export function choicesFrom(pieces: PieceMeta[], kind: 'trigger' | 'action'): PickerChoice[] {
  const fromPieces = pieces.flatMap((piece) =>
    (kind === 'trigger' ? piece.triggers : piece.actions).map((entry) => ({
      kind,
      pieceName: piece.name,
      pieceVersion: piece.version,
      name: entry.name,
      displayName: entry.displayName,
      description: entry.description,
      category: entry.category,
      accent: entry.accent,
      props: entry.props as PickerChoice['props'],
    })),
  );
  return kind === 'action' ? [...fromPieces, ...STRUCTURAL_CHOICES] : fromPieces;
}

export default function StepPicker({
  pieces,
  kind,
  onPick,
  onClose,
}: {
  pieces: PieceMeta[];
  kind: 'trigger' | 'action';
  onPick: (choice: PickerChoice) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const all = useMemo(() => choicesFrom(pieces, kind), [pieces, kind]);

  const matches = useMemo(() => {
    if (!query.trim()) return all;
    // Signature is (text, query): one haystack string per choice, built from the fields a
    // user would actually type — its name, what it does, and the group it lives in.
    return all.filter((choice) =>
      matchesSearchQuery(`${choice.displayName} ${choice.description} ${choice.category}`, query),
    );
  }, [all, query]);

  const groups = useMemo(() => {
    const byCategory = new Map<string, PickerChoice[]>();
    for (const choice of matches) {
      const list = byCategory.get(choice.category) ?? [];
      list.push(choice);
      byCategory.set(choice.category, list);
    }
    return [...byCategory.entries()].sort(
      (a, b) => (CATEGORY_ORDER.indexOf(a[0]) + 1 || 99) - (CATEGORY_ORDER.indexOf(b[0]) + 1 || 99),
    );
  }, [matches]);

  const flat = useMemo(() => groups.flatMap(([, list]) => list), [groups]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  return (
    <Modal
      open
      onClose={onClose}
      title={kind === 'trigger' ? 'Choose a trigger' : 'Add a step'}
      overlayClassName={styles.overlay}
      panelClassName={styles.panel}
      initialFocus={inputRef}
    >
      <div className={styles.head}>
        <Icon name="search" size={16} className={styles.searchIcon} />
        <input
          ref={inputRef}
          type="search"
          className={styles.input}
          value={query}
          placeholder={kind === 'trigger' ? 'Search triggers…' : 'Search steps…'}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((i) => Math.min(flat.length - 1, i + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((i) => Math.max(0, i - 1));
            } else if (e.key === 'Enter' && flat[active]) {
              e.preventDefault();
              onPick(flat[active]);
            }
          }}
        />
        <button type="button" className="kbtn" aria-label="Close" onClick={onClose}>
          <Icon name="x" size={16} />
        </button>
      </div>

      <div className={styles.list}>
        {flat.length === 0 ? (
          <p className={styles.empty}>Nothing matches “{query}”.</p>
        ) : (
          groups.map(([category, list]) => (
            <section key={category}>
              <h3 className={styles.group}>{category}</h3>
              {list.map((choice) => {
                const index = flat.indexOf(choice);
                return (
                  <button
                    key={`${choice.pieceName}.${choice.name}`}
                    type="button"
                    className={`${styles.item} ${index === active ? styles.itemActive : ''}`}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => onPick(choice)}
                  >
                    <span
                      className={styles.dot}
                      style={{ background: `var(${choice.accent ?? '--text3'})` }}
                      aria-hidden="true"
                    />
                    <span className={styles.itemText}>
                      <span className={styles.itemTitle}>{choice.displayName}</span>
                      <span className={styles.itemDesc}>{choice.description}</span>
                    </span>
                  </button>
                );
              })}
            </section>
          ))
        )}
      </div>
    </Modal>
  );
}
