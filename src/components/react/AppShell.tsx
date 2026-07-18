import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { appNav, appSettingsNav } from '@/config/navigation';
import { currentUser } from '@/lib/app/mock-data';
import Icon from './Icon';
import type { IconName } from '@/lib/icons';

type Props = {
  currentPath: string;
  title: string;
  children: ReactNode;
};

type Cmd = { label: string; hint: 'Navigate' | 'Action'; href?: string; icon: IconName };

const COMMANDS: Cmd[] = [
  ...appNav.map((n) => ({ label: `Go to ${n.label}`, hint: 'Navigate' as const, href: n.href, icon: n.icon })),
  { label: 'Go to Settings', hint: 'Navigate', href: appSettingsNav.href, icon: 'settings' },
  { label: 'New campaign', hint: 'Action', href: '/app/campaigns', icon: 'plus' },
  { label: 'New template', hint: 'Action', href: '/app/templates', icon: 'templates' },
  { label: 'Import contacts', hint: 'Action', href: '/app/subscribers', icon: 'upload' },
];

export default function AppShell({ currentPath, title, children }: Props) {
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
        className={`ashsb-nav__item${active ? ' is-active' : ''}`}
        aria-current={active ? 'page' : undefined}
      >
        <span className="ashsb-nav__ic">
          <Icon name={item.icon} size={20} stroke={1.9} />
        </span>
        {item.label}
      </a>
    );
  };

  return (
    <div className="ash">
      {/* backdrop for mobile sidebar */}
      {mobileNav && <button type="button" className="ash__scrim" aria-label="Close menu" onClick={() => setMobileNav(false)} />}

      <aside className={`ashsb${mobileNav ? ' is-open' : ''}`} aria-label="Workspace">
        <a href="/app" className="ashsb__brand" aria-label="Maildrill workspace">
          <svg viewBox="0 0 30 26.76" width="23" height="20" aria-hidden="true">
            <path fill="#ff441f" d="M13.39,0c-2.86,2.06-5.61,4-8.47,6.06C3.89,4,2.86,2.06,1.95,0h11.44Z" />
            <path fill="#ff441f" d="M19.57,17.49c-1.49,3.09-3.09,6.17-4.58,9.26-.69-1.49-1.49-2.97-2.17-4.34l6.75-4.92Z" />
            <path fill="#ff441f" d="M26.32,0c-6.07,4.23-12.02,8.58-18.08,12.81-.8-1.6-1.6-3.2-2.4-4.92,3.66-2.63,7.44-5.26,11.1-7.89h9.38Z" />
            <path fill="#ff441f" d="M27.12,2.17c-1.83,3.66-3.66,7.32-5.49,10.98-3.2,2.29-6.52,4.57-9.73,6.86l-2.63-5.15c5.95-4.23,11.9-8.46,17.85-12.69Z" />
          </svg>
          <span className="ashsb__word">
            Mail<span>drill</span>
          </span>
        </a>

        <p className="ashsb__group">Workspace</p>
        <nav className="ashsb-nav" aria-label="Primary">
          {appNav.map(navItem)}
        </nav>

        <div className="ashsb__foot">
          {navItem({ ...appSettingsNav })}
          <span className="ashsb-nav__item ashsb-nav__item--static">
            <span className="ashsb-nav__ic">
              <Icon name="help" size={20} stroke={1.9} />
            </span>
            Help &amp; docs
          </span>
          <div className="ashsb__user">
            <span className="ashsb__avatar" aria-hidden="true">
              {currentUser.name.charAt(0)}
            </span>
            <span className="ashsb__usermeta">
              <span className="ashsb__username">{currentUser.name} Rossi</span>
              <span className="ashsb__useremail">{currentUser.email}</span>
            </span>
            <Icon name="chevron-down" size={14} stroke={2} className="ashsb__userchev" />
          </div>
        </div>
      </aside>

      <div className="ash__main">
        <header className="topbar">
          <div className="topbar__crumb">
            <button
              type="button"
              className="topbar__menu"
              aria-label="Open menu"
              onClick={() => setMobileNav(true)}
            >
              <Icon name="menu" size={18} />
            </button>
            <span className="topbar__ws">Maildrill</span>
            <span className="topbar__sep">/</span>
            <span className="topbar__title">{title}</span>
          </div>
          <div className="topbar__controls">
            <button type="button" className="topbar__search" onClick={() => setCmdOpen(true)} aria-haspopup="dialog">
              <Icon name="search" size={14} className="topbar__searchic" />
              <span>Search…</span>
              <kbd>⌘K</kbd>
            </button>
            <button type="button" className="iconbtn" onClick={toggleTheme} title="Toggle theme" aria-label="Toggle theme">
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
            </button>
            <button type="button" className="iconbtn" title="Notifications" aria-label="Notifications">
              <Icon name="inbox" size={16} />
              <span className="topbar__dot" aria-hidden="true" />
            </button>
          </div>
        </header>

        <main id="main" className="ash__scroll">
          {children}
        </main>
      </div>

      {cmdOpen && (
        <div className="cmdk" role="dialog" aria-modal="true" aria-label="Command palette">
          <button type="button" className="cmdk__backdrop" aria-label="Close" onClick={() => setCmdOpen(false)} />
          <div className="cmdk__panel">
            <div className="cmdk__search">
              <Icon name="search" size={17} className="cmdk__searchic" />
              <input
                autoFocus
                className="cmdk__input"
                placeholder="Search or jump to…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search commands"
              />
              <kbd className="cmdk__esc">ESC</kbd>
            </div>
            <ul className="cmdk__list">
              {filtered.length === 0 ? (
                <li className="cmdk__empty">No results for "{query}"</li>
              ) : (
                filtered.map((c) => (
                  <li key={c.label}>
                    <a href={c.href} className="cmdk__item" onClick={() => setCmdOpen(false)}>
                      <span className={`cmdk__ic cmdk__ic--${c.hint === 'Action' ? 'action' : 'nav'}`}>
                        <Icon name={c.icon} size={15} />
                      </span>
                      <span className="cmdk__label">{c.label}</span>
                      <span className="cmdk__hint">{c.hint}</span>
                    </a>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}

      <style>{`
        .ash { display: flex; height: 100vh; width: 100%; background: var(--bg); overflow: hidden; }
        .ash__main { flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden; }
        .ash__scroll { flex: 1; overflow-y: auto; }
        .ash__scrim { display: none; }

        /* sidebar */
        .ashsb {
          width: 238px; flex: none; background: var(--surface); border-right: 1px solid var(--border);
          display: flex; flex-direction: column; padding: 16px 14px;
        }
        .ashsb__brand {
          display: flex; align-items: center; gap: 9px; justify-content: center;
          padding: 6px 8px 18px; color: var(--text);
        }
        .ashsb__word { font-size: 18px; font-weight: 600; letter-spacing: -0.02em; }
        .ashsb__word span { color: var(--brand); }
        .ashsb__group {
          margin: 0; font-size: 10.5px; font-weight: 600; color: var(--muted2);
          letter-spacing: 0.6px; text-transform: uppercase; padding: 0 10px 8px;
        }
        .ashsb-nav { display: flex; flex-direction: column; gap: 6px; }
        .ashsb-nav__item {
          display: flex; align-items: center; gap: 14px; padding: 11px 14px; border-radius: 12px;
          font-size: 14.5px; font-weight: 500; color: var(--text3);
          transition: background 0.13s var(--ease-out), color 0.13s var(--ease-out);
        }
        .ashsb-nav__item:hover { background: var(--surface2); }
        .ashsb-nav__item.is-active { font-weight: 600; background: var(--accent-tint); color: var(--accent); }
        .ashsb-nav__item--static { color: var(--text3); cursor: default; }
        .ashsb-nav__item--static:hover { background: transparent; }
        .ashsb-nav__ic { width: 22px; height: 22px; flex: none; display: flex; align-items: center; justify-content: center; }
        .ashsb__foot { margin-top: auto; display: flex; flex-direction: column; gap: 6px; }
        .ashsb__user {
          display: flex; align-items: center; gap: 9px; margin-top: 10px; padding: 9px 8px;
          border-top: 1px solid var(--divider);
        }
        .ashsb__avatar {
          width: 30px; height: 30px; flex: none; border-radius: 9px; color: #fff; font-weight: 700; font-size: 12px;
          background: linear-gradient(135deg, #818cf8, #4f46e5); display: flex; align-items: center; justify-content: center;
        }
        .ashsb__usermeta { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .ashsb__username { font-size: 12.5px; font-weight: 600; color: var(--text); }
        .ashsb__useremail { font-size: 11px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ashsb__userchev { color: var(--muted); }

        /* topbar */
        .topbar {
          height: 57px; flex: none; display: flex; align-items: center; justify-content: space-between;
          padding: 0 28px; border-bottom: 1px solid var(--border);
          background: var(--header-bg); backdrop-filter: blur(10px); position: relative; z-index: 5;
        }
        .topbar__crumb { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted); }
        .topbar__menu { display: none; color: var(--text3); }
        .topbar__ws { color: var(--text4); }
        .topbar__title { font-weight: 600; color: var(--text2); }
        .topbar__controls { display: flex; align-items: center; gap: 10px; }
        .topbar__search {
          display: flex; align-items: center; gap: 8px; background: var(--surface2);
          border: 1px solid var(--border); border-radius: 9px; padding: 0 10px; height: 33px;
          min-width: 220px; color: var(--muted); font-size: 12.5px;
        }
        .topbar__searchic { color: var(--muted); }
        .topbar__search span { flex: 1; text-align: left; }
        .topbar__search kbd {
          font-size: 10.5px; color: var(--muted2); font-weight: 600; background: var(--surface);
          border: 1px solid var(--border); border-radius: 5px; padding: 1px 5px;
        }
        .topbar__dot {
          position: absolute; top: 7px; right: 8px; width: 6px; height: 6px; border-radius: 50%;
          background: #ea580c; border: 1.5px solid var(--surface);
        }

        /* command palette */
        .cmdk { position: fixed; inset: 0; z-index: var(--z-modal); display: flex; align-items: flex-start; justify-content: center; padding-top: 120px; }
        .cmdk__backdrop { position: absolute; inset: 0; background: rgba(28,25,23,.32); backdrop-filter: blur(3px); border: 0; }
        .cmdk__panel {
          position: relative; width: 560px; max-width: 92%; background: var(--surface);
          border-radius: 16px; box-shadow: 0 24px 60px rgba(28,25,23,.32); overflow: hidden;
          animation: pop 0.16s var(--ease-out);
        }
        .cmdk__search { display: flex; align-items: center; gap: 11px; padding: 15px 18px; border-bottom: 1px solid var(--divider); }
        .cmdk__searchic { color: var(--muted); }
        .cmdk__input { flex: 1; border: none; background: none; font-size: 15px; color: var(--text); outline: none; }
        .cmdk__esc { font-size: 10.5px; color: var(--muted2); font-weight: 600; background: var(--surface2); border-radius: 5px; padding: 2px 6px; }
        .cmdk__list { list-style: none; margin: 0; padding: 8px; max-height: 340px; overflow-y: auto; }
        .cmdk__item { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 10px; }
        .cmdk__item:hover { background: var(--surface2); }
        .cmdk__ic { width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex: none; }
        .cmdk__ic--action { background: var(--accent-tint); color: var(--accent); }
        .cmdk__ic--nav { background: var(--surface2); color: var(--text4); }
        .cmdk__label { flex: 1; font-size: 13.5px; font-weight: 500; color: var(--text); }
        .cmdk__hint { font-size: 11.5px; color: var(--muted2); }
        .cmdk__empty { padding: 32px; text-align: center; color: var(--muted); font-size: 13px; }

        @media (max-width: 900px) {
          .ashsb {
            position: fixed; top: 0; left: 0; bottom: 0; z-index: var(--z-drawer);
            transform: translateX(-100%); transition: transform 0.28s var(--ease-out);
            box-shadow: 8px 0 40px rgba(28,25,23,.18);
          }
          .ashsb.is-open { transform: translateX(0); }
          .ash__scrim { display: block; position: fixed; inset: 0; z-index: calc(var(--z-drawer) - 1); background: rgba(28,25,23,.32); border: 0; }
          .topbar__menu { display: inline-flex; }
          .topbar { padding: 0 16px; }
          .topbar__search { min-width: 0; }
          .topbar__search span, .topbar__search kbd { display: none; }
          .topbar__search { width: 33px; height: 33px; justify-content: center; padding: 0; }
        }
      `}</style>
    </div>
  );
}
