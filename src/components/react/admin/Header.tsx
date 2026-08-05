import type { ReactNode } from 'react';
import Icon from '../Icon';
import styles from './AppAdmin.module.css';

export function Header({
  section,
  page,
  theme,
  status,
  onToggleTheme,
  onOpenMobileNav,
}: {
  section: string;
  page: string;
  theme: 'light' | 'dark';
  status?: ReactNode;
  onToggleTheme: () => void;
  onOpenMobileNav: () => void;
}) {
  return (
    <header className={styles.header}>
      <div className={styles.crumb}>
        <button
          type="button"
          className={`iconbtn ${styles.menuBtn}`}
          aria-label="Open menu"
          onClick={onOpenMobileNav}
        >
          <Icon name="menu" size={18} />
        </button>
        <span className="dim">Maildrill</span>
        <span>/</span>
        <span className="dim">{section}</span>
        <span>/</span>
        <span className="cur">{page}</span>
      </div>
      <div className={styles.headerControls}>
        {status}
        <button
          type="button"
          className="iconbtn"
          onClick={onToggleTheme}
          title="Toggle theme"
          aria-label="Toggle theme"
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
        </button>
      </div>
    </header>
  );
}
