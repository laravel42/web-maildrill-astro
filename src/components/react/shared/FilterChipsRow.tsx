import type { CSSProperties } from 'react';
import Icon from '../Icon';
import styles from './FilterChipsRow.module.css';

export type FilterChip = {
  key: string;
  label: string;
  onRemove: () => void;
  /** Optional chip surface override (e.g. channel tint). */
  style?: CSSProperties;
  className?: string;
};

/**
 * Full-width row of active filter badges + Clear all. Always renders below
 * the filter controls (parent places it on its own row).
 */
export default function FilterChipsRow({
  chips,
  onClearAll,
}: {
  chips: FilterChip[];
  onClearAll: () => void;
}) {
  if (chips.length === 0) return null;
  return (
    <div className={styles.row} aria-label="Active filters">
      {chips.map((c) => (
        <span key={c.key} className={`${styles.chip}${c.className ? ` ${c.className}` : ''}`} style={c.style}>
          {c.label}
          <button
            type="button"
            className={styles.x}
            aria-label={`Remove ${c.label}`}
            onClick={c.onRemove}
          >
            <Icon name="x" size={14} stroke={3} />
          </button>
        </span>
      ))}
      <button type="button" className={styles.clear} onClick={onClearAll}>
        Clear all
      </button>
    </div>
  );
}
