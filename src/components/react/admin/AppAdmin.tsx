import { useCallback, useEffect, useState } from 'react';
import { NAV_SECTIONS, SCREEN_TITLES, type ScreenId } from '@/lib/app/admin-data';
import type { AdminLiveData } from './live-types';
import { LIVE_SCREENS } from './live-types';
import type { Selection } from './types';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { StatusBadge } from './components';
import { AdminDrawer } from './drawers';
import {
  AuditScreen,
  BillingScreen,
  BlogScreen,
  CacheScreen,
  CampaignsScreen,
  DeliverScreen,
  DomainsScreen,
  EventsScreen,
  FaqScreen,
  FlagsScreen,
  GuidesScreen,
  InvoicesScreen,
  LegalScreen,
  LlmScreen,
  LogsScreen,
  McpScreen,
  OverviewScreen,
  PricingScreen,
  QueuesScreen,
  SeoScreen,
  SkillsScreen,
  SupportScreen,
  TokensScreen,
  UsersScreen,
  WorkspacesScreen,
} from './screens';
import styles from './AppAdmin.module.css';

interface Props {
  userName?: string | null;
  role?: string | null;
  live?: AdminLiveData | null;
}

/** Which live slice backs each live-capable screen, for the status badge. */
const SCREEN_SLICE: Partial<Record<ScreenId, keyof AdminLiveData>> = {
  overview: 'overview',
  campaigns: 'campaigns',
  deliver: 'deliver',
  queues: 'queues',
  blogCms: 'blog',
  guidesCms: 'guides',
  legalCms: 'legal',
};

export default function AppAdmin({ userName, live }: Props) {
  const [screen, setScreen] = useState<ScreenId>('overview');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NAV_SECTIONS.map((s) => [s.id, s.defaultOpen ?? false])),
  );
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mobileNav, setMobileNav] = useState(false);
  const [sel, setSel] = useState<Selection | null>(null);

  const admin = userName?.trim() || 'Sam Underwood';

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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSel(null);
        setMobileNav(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const go = (id: ScreenId) => {
    setScreen(id);
    setSel(null);
    setMobileNav(false);
  };
  const toggleSection = (id: string) =>
    setOpenSections((s) => ({ ...s, [id]: !s[id] }));

  const crumb = SCREEN_TITLES[screen];

  const sliceKey = SCREEN_SLICE[screen];
  const hasLiveData = Boolean(sliceKey && live && live[sliceKey]);
  const canBeLive = LIVE_SCREENS.includes(screen as (typeof LIVE_SCREENS)[number]);
  const statusLabel = hasLiveData
    ? `Live · ${live?.workspaceName ?? 'workspace'}`
    : canBeLive
      ? 'Preview · no live data'
      : 'Preview data';

  return (
    <div className={styles.shell}>
      {mobileNav && (
        <button
          type="button"
          className={styles.scrim}
          aria-label="Close menu"
          onClick={() => setMobileNav(false)}
        />
      )}

      <Sidebar
        screen={screen}
        openSections={openSections}
        onToggleSection={toggleSection}
        onNavigate={go}
        admin={admin}
        mobileOpen={mobileNav}
      />

      <div className={styles.main}>
        <Header
          section={crumb.section}
          page={crumb.page}
          theme={theme}
          status={<StatusBadge live={hasLiveData} label={statusLabel} />}
          onToggleTheme={toggleTheme}
          onOpenMobileNav={() => setMobileNav(true)}
        />

        <main className={styles.scroll}>
          <div className={styles.pad}>
            {screen === 'overview' && <OverviewScreen onSelect={setSel} live={live?.overview ?? null} />}
            {screen === 'workspaces' && <WorkspacesScreen onSelect={setSel} />}
            {screen === 'users' && <UsersScreen onSelect={setSel} />}
            {screen === 'tokens' && <TokensScreen onSelect={setSel} />}
            {screen === 'billing' && <BillingScreen onSelect={setSel} />}
            {screen === 'invoices' && <InvoicesScreen onSelect={setSel} />}
            {screen === 'domains' && <DomainsScreen onSelect={setSel} />}
            {screen === 'campaigns' && <CampaignsScreen onSelect={setSel} live={live?.campaigns ?? null} />}
            {screen === 'deliver' && <DeliverScreen onSelect={setSel} live={live?.deliver ?? null} />}
            {screen === 'events' && <EventsScreen onSelect={setSel} />}
            {screen === 'queues' && <QueuesScreen onSelect={setSel} live={live?.queues ?? null} />}
            {screen === 'cache' && <CacheScreen onSelect={setSel} />}
            {screen === 'logs' && <LogsScreen onSelect={setSel} />}
            {screen === 'audit' && <AuditScreen onSelect={setSel} />}
            {screen === 'flags' && <FlagsScreen />}
            {screen === 'support' && <SupportScreen onSelect={setSel} />}
            {screen === 'blogCms' && <BlogScreen onSelect={setSel} rows={live?.blog ?? null} />}
            {screen === 'guidesCms' && <GuidesScreen onSelect={setSel} rows={live?.guides ?? null} />}
            {screen === 'pricingCms' && <PricingScreen />}
            {screen === 'legalCms' && <LegalScreen docs={live?.legal ?? null} />}
            {screen === 'seoCms' && <SeoScreen />}
            {screen === 'faqCms' && <FaqScreen onSelect={setSel} />}
            {screen === 'llm' && <LlmScreen onSelect={setSel} />}
            {screen === 'skills' && <SkillsScreen onSelect={setSel} />}
            {screen === 'mcp' && <McpScreen onSelect={setSel} />}
          </div>
        </main>
      </div>

      {sel && <AdminDrawer selection={sel} onClose={() => setSel(null)} />}
    </div>
  );
}
