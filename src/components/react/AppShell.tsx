import { useCallback, useEffect, useMemo, useState } from 'react';
import { appNav, appSettingsNav } from '@/config/navigation';
import { currentUser } from '@/lib/app/mock-data';
import Icon from './Icon';
import type { IconName } from '@/lib/icons';
import type { Props } from './AppShell.types';
import { COMMANDS } from './AppShell.logic';
import styles from './AppShell.module.css';
import { signOut } from 'auth-astro/client';

export default function AppShell({ currentPath, title, children, userEmail }: Props) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [cmdOpen, setCmdOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [mobileNav, setMobileNav] = useState(false);

  // Theme: hydrate from the value the pre-paint script already applied.
  useEffect(() => {
    const attr = document.documentElement.getAttribute('data-theme');
    setTheme(attr === 'dark' ? 'dark' : 'light');
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try {
        localStorage.setItem('md-theme', next);
      } catch {
        /* no-op */
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCmdOpen((v) => !v);
        setQuery('');
      }
      if (event.key === 'Escape') {
        setCmdOpen(false);
        setMobileNav(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMMANDS;
    return COMMANDS.filter((c) => c.label.toLowerCase().includes(q));
  }, [query]);

  const isActive = (href: string) =>
    href === '/app' ? currentPath === '/app' : currentPath.startsWith(href);

  const navItem = (item: { label: string; href: string; icon: IconName }) => {
    const active = isActive(item.href);
    return (
      <a
        key={item.href}
        href={item.href}
        className={`${styles.ashsbNavItem}${active ? ' is-active' : ''}`}
        aria-current={active ? 'page' : undefined}
      >
        <span className={styles.ashsbNavIc}>
          <Icon name={item.icon} size={20} stroke={1.9} />
        </span>
        {item.label}
      </a>
    );
  };

  return (
    <div className={styles.ash}>
      {/* backdrop for mobile sidebar */}
      {mobileNav && (
        <button
          type="button"
          className={styles.ashScrim}
          aria-label="Close menu"
          onClick={() => setMobileNav(false)}
        />
      )}

      <aside
        className={`${styles.ashsb}${mobileNav ? ` ${styles.isOpen}` : ''}`}
        aria-label="Workspace"
      >
        <a href="/app" className={styles.ashsbBrand} aria-label="Maildrill workspace">
          <svg viewBox="0 0 30 26.76" width="23" height="20" aria-hidden="true">
            <path
              fill="#ff441f"
              d="M13.39,0c-2.86,2.06-5.61,4-8.47,6.06C3.89,4,2.86,2.06,1.95,0h11.44Z"
            />
            <path
              fill="#ff441f"
              d="M19.57,17.49c-1.49,3.09-3.09,6.17-4.58,9.26-.69-1.49-1.49-2.97-2.17-4.34l6.75-4.92Z"
            />
            <path
              fill="#ff441f"
              d="M26.32,0c-6.07,4.23-12.02,8.58-18.08,12.81-.8-1.6-1.6-3.2-2.4-4.92,3.66-2.63,7.44-5.26,11.1-7.89h9.38Z"
            />
            <path
              fill="#ff441f"
              d="M27.12,2.17c-1.83,3.66-3.66,7.32-5.49,10.98-3.2,2.29-6.52,4.57-9.73,6.86l-2.63-5.15c5.95-4.23,11.9-8.46,17.85-12.69Z"
            />
          </svg>
          <span className={styles.ashsbWord}>
            Mail<span>drill</span>
          </span>
        </a>

        <p className={styles.ashsbGroup}>Workspace</p>
        <nav className={styles.ashsbNav} aria-label="Primary">
          {appNav.map(navItem)}
        </nav>

        <div className={styles.ashsbFoot}>
          {navItem({ ...appSettingsNav })}
          <span className={`${styles.ashsbNavItem} ${styles.ashsbNavItemStatic}`}>
            <span className={styles.ashsbNavIc}>
              <Icon name="help" size={20} stroke={1.9} />
            </span>
            Help &amp; docs
          </span>
          <div className={styles.ashsbUser}>
            <span className={styles.ashsbAvatar} aria-hidden="true">
              {currentUser.name.charAt(0)}
            </span>
            <span className={styles.ashsbUsermeta}>
              <span className={styles.ashsbUsername}>{currentUser.name} Rossi</span>
              <span className={styles.ashsbUseremail}>{userEmail ?? currentUser.email}</span>
            </span>
            <button
              type="button"
              onClick={() => void signOut()}
              title="Log out"
              aria-label="Log out"
              className={styles.ashsbUserchev}
              style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'inherit' }}
            >
              <Icon name="chevron-down" size={14} stroke={2} />
            </button>
          </div>
        </div>
      </aside>

      <div className={styles.ashMain}>
        <header className={styles.topbar}>
          <div className={styles.topbarCrumb}>
            <button
              type="button"
              className={styles.topbarMenu}
              aria-label="Open menu"
              onClick={() => setMobileNav(true)}
            >
              <Icon name="menu" size={18} />
            </button>
            <span className={styles.topbarWs}>Maildrill</span>
            <span className="topbar__sep">/</span>
            <span className={styles.topbarTitle}>{title}</span>
          </div>
          <div className={styles.topbarControls}>
            <button
              type="button"
              className={styles.topbarSearch}
              onClick={() => setCmdOpen(true)}
              aria-haspopup="dialog"
            >
              <Icon name="search" size={14} className={styles.topbarSearchic} />
              <span>Search…</span>
              <kbd>⌘K</kbd>
            </button>
            <button
              type="button"
              className="iconbtn"
              onClick={toggleTheme}
              title="Toggle theme"
              aria-label="Toggle theme"
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
            </button>
            <button
              type="button"
              className="iconbtn"
              title="Notifications"
              aria-label="Notifications"
            >
              <Icon name="inbox" size={16} />
              <span className={styles.topbarDot} aria-hidden="true" />
            </button>
          </div>
        </header>

        <main id="main" className={styles.ashScroll}>
          {children}
        </main>
      </div>

      {cmdOpen && (
        <div className={styles.cmdk} role="dialog" aria-modal="true" aria-label="Command palette">
          <button
            type="button"
            className={styles.cmdkBackdrop}
            aria-label="Close"
            onClick={() => setCmdOpen(false)}
          />
          <div className={styles.cmdkPanel} style={{ animation: 'pop 0.16s var(--ease-out)' }}>
            <div className={styles.cmdkSearch}>
              <Icon name="search" size={17} className={styles.cmdkSearchic} />
              <input
                autoFocus
                className={styles.cmdkInput}
                placeholder="Search or jump to…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search commands"
              />
              <kbd className={styles.cmdkEsc}>ESC</kbd>
            </div>
            <ul className={styles.cmdkList}>
              {filtered.length === 0 ? (
                <li className={styles.cmdkEmpty}>No results for "{query}"</li>
              ) : (
                filtered.map((c) => (
                  <li key={c.label}>
                    <a href={c.href} className={styles.cmdkItem} onClick={() => setCmdOpen(false)}>
                      <span
                        className={`${styles.cmdkIc} ${
                          c.hint === 'Action' ? styles.cmdkIcAction : styles.cmdkIcNav
                        }`}
                      >
                        <Icon name={c.icon} size={15} />
                      </span>
                      <span className={styles.cmdkLabel}>{c.label}</span>
                      <span className={styles.cmdkHint}>{c.hint}</span>
                    </a>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
