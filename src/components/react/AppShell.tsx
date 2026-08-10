import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { appNavGroups, appSettingsNav } from '@/config/navigation';
import { routes } from '@/config/routes';
import Icon from './Icon';
import type { IconName } from '@/lib/icons';
import type { Props } from './AppShell.types';
import { COMMANDS } from './AppShell.logic';
import PinPickerModal, { type Pin, type PinKind } from './PinPickerModal';
import NotificationsInbox from './shared/NotificationsInbox';
import styles from './AppShell.module.css';
import { signOut } from 'auth-astro/client';

const PINS_KEY = 'md:pins:v1';
/** Session echo of the profile photo — the auth session carries no avatar. */
const AVATAR_CACHE_KEY = 'md:avatar:v1';

const PIN_SECTIONS: { kind: PinKind; label: string }[] = [
  { kind: 'list', label: 'Lists' },
  { kind: 'campaign', label: 'Campaigns' },
  { kind: 'template', label: 'Templates' },
  { kind: 'subscriber', label: 'Subscribers' },
];

function pinHref(p: Pin): string {
  if (p.kind === 'campaign') {
    return routes.app.campaignReport(p.id);
  }
  if (p.kind === 'template') {
    const channel = p.channel ?? 'email';
    return `${routes.app.templateBuilder(channel)}?id=${encodeURIComponent(p.id)}`;
  }
  if (p.kind === 'subscriber') {
    return routes.app.subscriber(p.id);
  }
  return routes.app.list(p.id);
}

const PIN_KINDS = new Set(['campaign', 'list', 'template', 'subscriber']);

function readPins(): Pin[] {
  try {
    const raw = localStorage.getItem(PINS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Pin[];
    return Array.isArray(parsed)
      ? parsed.filter(
          (p): p is Pin =>
            !!p && typeof p.id === 'string' && typeof p.label === 'string' && PIN_KINDS.has(p.kind),
        )
      : [];
  } catch {
    return [];
  }
}

export default function AppShell({
  currentPath,
  title,
  crumbs,
  children,
  userEmail,
  userName,
  userDisplayName = null,
}: Props) {
  // Home uses title "Dashboard" — skip the trail so we don't show "Dashboard / Dashboard".
  const trail = crumbs?.length ? crumbs : title && title !== 'Dashboard' ? [{ label: title }] : [];
  // Prefer profile display name, then full name, then email local-part.
  const fallbackName = userName?.trim() || (userEmail ? userEmail.split('@')[0] : 'Your workspace');
  const [labelName, setLabelName] = useState(() => userDisplayName?.trim() || fallbackName);
  const displayName = labelName.trim() || fallbackName;
  const avatarInitial = displayName.charAt(0).toUpperCase();
  // Profile photo — event/sessionStorage fed (see the maildrill:profile hook);
  // starts null on purpose so SSR and hydration render the same initial.
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [cmdOpen, setCmdOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const [userMenu, setUserMenu] = useState(false);

  // PINNED section state.
  const [pins, setPins] = useState<Pin[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const dragFrom = useRef<{ kind: PinKind; index: number } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const pinGroups = useMemo(
    () =>
      PIN_SECTIONS.map((s) => ({
        ...s,
        items: pins.filter((p) => p.kind === s.kind),
      })).filter((g) => g.items.length > 0),
    [pins],
  );

  // Theme: hydrate from the value the pre-paint script already applied.
  useEffect(() => {
    const attr = document.documentElement.getAttribute('data-theme');
    setTheme(attr === 'dark' ? 'dark' : 'light');
  }, []);

  // Keep sidebar in sync when Profile saves display name or photo (same tab).
  // The photo also echoes through sessionStorage so it survives navigation —
  // the session token carries no avatar, so this is the shell's only source.
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(AVATAR_CACHE_KEY);
      if (cached) setAvatarUrl(cached);
    } catch {
      /* private mode */
    }
    const onProfile = (e: Event) => {
      const detail = (e as CustomEvent<{ displayName?: string; avatarUrl?: string | null }>).detail;
      const next = detail?.displayName?.trim();
      if (next) setLabelName(next);
      if (detail && 'avatarUrl' in detail) {
        setAvatarUrl(detail.avatarUrl ?? null);
        try {
          if (detail.avatarUrl) sessionStorage.setItem(AVATAR_CACHE_KEY, detail.avatarUrl);
          else sessionStorage.removeItem(AVATAR_CACHE_KEY);
        } catch {
          /* private mode */
        }
      }
    };
    window.addEventListener('maildrill:profile', onProfile);
    return () => window.removeEventListener('maildrill:profile', onProfile);
  }, []);

  // SSR prop may arrive/update after first paint (e.g. soft nav) — prefer it.
  useEffect(() => {
    const next = userDisplayName?.trim();
    if (next) setLabelName(next);
  }, [userDisplayName]);

  useEffect(() => {
    setPins(readPins());
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
        setUserMenu(false);
        setPickerOpen(false);
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

  const savePins = useCallback((next: Pin[]) => {
    setPins(next);
    try {
      localStorage.setItem(PINS_KEY, JSON.stringify(next));
    } catch {
      /* no-op */
    }
  }, []);

  const reorderPinsInKind = (kind: PinKind, over: number) => {
    const from = dragFrom.current;
    if (from == null || from.kind !== kind || from.index === over) return;
    const group = pins.filter((p) => p.kind === kind);
    const [moved] = group.splice(from.index, 1);
    group.splice(over, 0, moved);
    dragFrom.current = { kind, index: over };
    setPins(
      PIN_SECTIONS.flatMap((s) =>
        s.kind === kind ? group : pins.filter((p) => p.kind === s.kind),
      ),
    );
  };

  const isActive = (href: string) =>
    href === '/dashboard' ? currentPath === '/dashboard' : currentPath.startsWith(href);

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
          <Icon name={item.icon} size={17} stroke={1.75} />
        </span>
        <span className={styles.ashsbNavLabel}>{item.label}</span>
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
        <a href="/dashboard" className={styles.ashsbBrand} aria-label="Maildrill workspace">
          <svg
            className={styles.ashsbMark}
            viewBox="0 0 30 26.76"
            width="25"
            height="22"
            aria-hidden="true"
            focusable="false"
          >
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
            Mail<span className={styles.ashsbWordBrand}>drill</span>
          </span>
          <span className={styles.ashsbPlan}>Beta</span>
        </a>

        <nav className={styles.ashsbNav} aria-label="Primary">
          {appNavGroups.map((group) => (
            <div key={group.label} className={styles.navGroup}>
              <div className={styles.navGroupHead} aria-hidden="true">
                <span className={styles.navGroupLabel}>{group.label}</span>
                <span className={styles.navGroupRule} />
              </div>
              {group.items.map(navItem)}
            </div>
          ))}

          {/* PINNED — user-curated records, reorderable by drag. */}
          <div className={`${styles.navGroup} ${styles.pinGroup}`}>
            <div className={styles.navGroupHead}>
              <span className={styles.navGroupLabel}>Pinned</span>
              {pins.length > 0 && <span className={`tnum ${styles.pinCount}`}>{pins.length}</span>}
              <span className={styles.navGroupRule} />
              <button
                type="button"
                className={styles.pinAdd}
                title="Pin a record"
                aria-label="Pin a record"
                aria-haspopup="dialog"
                aria-expanded={pickerOpen}
                onClick={() => setPickerOpen(true)}
              >
                <Icon name="plus" size={13} stroke={2.3} />
              </button>
            </div>

            {pinGroups.map((group) => (
              <div key={group.kind} className={styles.pinSection}>
                <p className={styles.pinSectionLabel}>{group.label}</p>
                {group.items.map((p, i) => (
                  <a
                    key={`${p.kind}:${p.id}`}
                    href={pinHref(p)}
                    className={`${styles.pinRow}${draggingId === p.id ? ` ${styles.pinRowDragging}` : ''}`}
                    draggable
                    onDragStart={(e) => {
                      dragFrom.current = { kind: group.kind, index: i };
                      setDraggingId(p.id);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      reorderPinsInKind(group.kind, i);
                    }}
                    onDrop={(e) => e.preventDefault()}
                    onDragEnd={() => {
                      dragFrom.current = null;
                      setDraggingId(null);
                      savePins(pins);
                    }}
                  >
                    <span className={styles.pinDot} style={{ background: p.color }} />
                    <span className={styles.pinLabel}>{p.label}</span>
                    <button
                      type="button"
                      className={styles.pinUnpin}
                      title="Unpin"
                      aria-label={`Unpin ${p.label}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        savePins(pins.filter((x) => !(x.kind === p.kind && x.id === p.id)));
                      }}
                    >
                      <Icon name="x" size={12} stroke={2.3} />
                    </button>
                  </a>
                ))}
              </div>
            ))}
            {pins.length === 0 && (
              <p className={styles.pinEmpty}>
                Nothing pinned. Use <span className={styles.pinEmptyPlus}>+</span> to keep a list,
                campaign, template, or subscriber here.
              </p>
            )}
          </div>
        </nav>

        <div className={styles.ashsbFoot}>
          <div className={styles.ashsbUser}>
            {userMenu && (
              <>
                <button
                  type="button"
                  className={styles.userMenuBackdrop}
                  aria-label="Close account menu"
                  onClick={() => setUserMenu(false)}
                />
                <div
                  className={styles.userMenu}
                  role="menu"
                  aria-label="Account"
                  style={{ animation: 'pop 0.14s var(--ease-out)' }}
                >
                  <div className={styles.userMenuHead}>
                    <span
                      className={`${styles.ashsbAvatar} ${styles.userMenuAvatar}`}
                      aria-hidden="true"
                    >
                      {avatarUrl ? (
                        <img className={styles.ashsbAvatarImg} src={avatarUrl} alt="" />
                      ) : (
                        avatarInitial
                      )}
                    </span>
                    <span className={styles.ashsbUsermeta}>
                      <span className={styles.ashsbUsername}>{displayName}</span>
                      <span className={styles.ashsbUseremail}>{userEmail ?? ''}</span>
                    </span>
                  </div>
                  <div className={styles.userMenuDivider} aria-hidden="true" />
                  <a href="/dashboard/profile" role="menuitem" className={styles.userMenuItem}>
                    <Icon name="user" size={16} stroke={1.8} />
                    Your profile
                  </a>
                  <a href={appSettingsNav.href} role="menuitem" className={styles.userMenuItem}>
                    <Icon name="settings" size={16} stroke={1.8} />
                    Workspace settings
                  </a>
                  <a
                    href={routes.guides}
                    target="_blank"
                    rel="noreferrer"
                    role="menuitem"
                    className={styles.userMenuItem}
                  >
                    <Icon name="help" size={16} stroke={1.8} />
                    Help &amp; docs
                    <span className={styles.userMenuValue} aria-hidden="true">
                      <Icon name="arrow-up-right" size={12} stroke={2.2} />
                    </span>
                  </a>
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.userMenuItem}
                    onClick={toggleTheme}
                  >
                    <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} stroke={1.8} />
                    Appearance
                    <span className={styles.userMenuValue}>{theme}</span>
                  </button>
                  <div
                    className={`${styles.userMenuDivider} ${styles.userMenuDividerTight}`}
                    aria-hidden="true"
                  />
                  <button
                    type="button"
                    role="menuitem"
                    className={`${styles.userMenuItem} ${styles.userMenuDanger}`}
                    onClick={() => void signOut()}
                  >
                    <Icon name="logout" size={16} stroke={1.8} />
                    Sign out
                  </button>
                </div>
              </>
            )}
            <button
              type="button"
              className={styles.userRow}
              onClick={() => setUserMenu((v) => !v)}
              aria-label="Account menu"
              aria-haspopup="menu"
              aria-expanded={userMenu}
            >
              <span className={styles.ashsbAvatar} aria-hidden="true">
                {avatarUrl ? (
                  <img className={styles.ashsbAvatarImg} src={avatarUrl} alt="" />
                ) : (
                  avatarInitial
                )}
              </span>
              <span className={styles.ashsbUsermeta}>
                <span className={styles.ashsbUsername}>{displayName}</span>
                <span className={styles.ashsbUserrole}>Owner</span>
              </span>
              <Icon name="more" size={15} className={styles.userRowKebab} />
            </button>
          </div>
        </div>
      </aside>

      <div className={styles.ashMain}>
        <header className={styles.topbar}>
          <div className={styles.topbarCrumb} aria-label="Breadcrumb">
            <button
              type="button"
              className={styles.topbarMenu}
              aria-label="Open menu"
              onClick={() => setMobileNav(true)}
            >
              <Icon name="menu" size={18} />
            </button>
            <span className={styles.topbarWs}>Dashboard</span>
            {trail.map((crumb, i) => {
              const isLast = i === trail.length - 1;
              return (
                <span key={`${crumb.label}-${i}`} className={styles.topbarCrumbSeg}>
                  <span className={styles.topbarSep} aria-hidden="true">
                    /
                  </span>
                  {crumb.href && !isLast ? (
                    <a className={styles.topbarCrumbLink} href={crumb.href}>
                      {crumb.label}
                    </a>
                  ) : (
                    <span className={isLast ? styles.topbarTitle : styles.topbarCrumbPlain}>
                      {crumb.label}
                    </span>
                  )}
                </span>
              );
            })}
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
            <NotificationsInbox />
          </div>
        </header>

        <main id="main" className={styles.ashScroll}>
          {children}
        </main>
      </div>

      {pickerOpen && (
        <PinPickerModal
          pinned={pins}
          onPin={(next) => {
            savePins(next);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}

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
