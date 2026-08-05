import type { ChipOption } from '../types';
import styles from '../AppAdmin.module.css';

export function ChipRow({
  options,
  value,
  onChange,
}: {
  options: ChipOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className={styles.chips}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={`${styles.chip}${value === o.id ? ` ${styles.chipActive}` : ''}`}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
