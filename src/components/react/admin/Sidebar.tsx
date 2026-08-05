import Icon from '../Icon';
import { NAV_SECTIONS, initials, type ScreenId } from '@/lib/app/admin-data';
import styles from './AppAdmin.module.css';

export function Sidebar({
  screen,
  openSections,
  onToggleSection,
  onNavigate,
  admin,
  mobileOpen,
}: {
  screen: ScreenId;
  openSections: Record<string, boolean>;
  onToggleSection: (id: string) => void;
  onNavigate: (id: ScreenId) => void;
  admin: string;
  mobileOpen: boolean;
}) {
  return (
    <aside className={`${styles.sidebar}${mobileOpen ? ` ${styles.sidebarOpen}` : ''}`}>
      <div className={styles.brand}>
        <svg viewBox="0 0 30 26.76" width="21" height="19" aria-hidden="true">
          <path fill="#ff441f" d="M13.39,0c-2.86,2.06-5.61,4-8.47,6.06C3.89,4,2.86,2.06,1.95,0h11.44Z" />
          <path fill="#ff441f" d="M19.57,17.49c-1.49,3.09-3.09,6.17-4.58,9.26-.69-1.49-1.49-2.97-2.17-4.34l6.75-4.92Z" />
          <path fill="#ff441f" d="M26.32,0c-6.07,4.23-12.02,8.58-18.08,12.81-.8-1.6-1.6-3.2-2.4-4.92,3.66-2.63,7.44-5.26,11.1-7.89h9.38Z" />
          <path fill="#ff441f" d="M27.12,2.17c-1.83,3.66-3.66,7.32-5.49,10.98-3.2,2.29-6.52,4.57-9.73,6.86l-2.63-5.15c5.95-4.23,11.9-8.46,17.85-12.69Z" />
        </svg>
        <span className={styles.brandWord}>Maildrill</span>
        <span className={styles.brandTag}>ADMIN</span>
      </div>

      <div className={styles.navGroups}>
        {NAV_SECTIONS.map((section) => {
          const open = openSections[section.id];
          return (
            <div key={section.id} className={styles.navSection}>
              <button
                type="button"
                className={styles.navSectionHead}
                onClick={() => onToggleSection(section.id)}
                aria-expanded={open}
              >
                <span className={`${styles.navChevron}${open ? ` ${styles.navChevronOpen}` : ''}`}>
                  <Icon name="chevron-right" size={9} stroke={3} />
                </span>
                {section.label}
                <span className={`tnum ${styles.navCount}`}>{section.items.length}</span>
              </button>
              {open && (
                <nav className={styles.navList}>
                  {section.items.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className={`${styles.navItem}${screen === item.id ? ` ${styles.navItemActive}` : ''}`}
                      onClick={() => onNavigate(item.id)}
                      aria-current={screen === item.id ? 'page' : undefined}
                    >
                      <span className={styles.navIc}>
                        <Icon name={item.icon} size={16} stroke={1.9} />
                      </span>
                      {item.label}
                      {item.badge && <span className={styles.navBadge}>{item.badge}</span>}
                    </button>
                  ))}
                </nav>
              )}
            </div>
          );
        })}
      </div>

      <div className={styles.sidebarUser}>
        <span
          className={styles.avatar}
          style={{ width: 30, height: 30, borderRadius: 9, fontSize: 12, background: 'linear-gradient(135deg,#818cf8,#4f46e5)' }}
          aria-hidden="true"
        >
          {initials(admin)}
        </span>
        <div style={{ lineHeight: 1.25, flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 12.5 }}>{admin}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Superadmin</div>
        </div>
      </div>
    </aside>
  );
}
