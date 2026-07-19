import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEscapeClose } from './shared/useEscapeClose';
import type { Props } from './MobileNav.types';
import styles from './MobileNav.module.css';

export type { Cta, Props } from './MobileNav.types';

export default function MobileNav({ items, primaryCta, secondaryCta }: Props) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEscapeClose(() => setOpen(false));

  return (
    <div className={styles.mnav}>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? 'Close menu' : 'Open menu'}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className={styles.panel} id={panelId} style={{ animation: 'fade var(--duration) var(--ease-out)' }}>
            <nav aria-label="Mobile">
              {items.map((item) =>
                item.children ? (
                  <div className={styles.group} key={item.label}>
                    <p className={styles.grouplabel}>{item.label}</p>
                    {item.children.map((child) => (
                      <a
                        key={child.href}
                        className={styles.sublink}
                        href={child.href}
                        onClick={() => setOpen(false)}
                      >
                        {child.label}
                      </a>
                    ))}
                  </div>
                ) : (
                  <a
                    key={item.label}
                    className={styles.link}
                    href={item.href}
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </a>
                ),
              )}
              <a className={styles.link} href={secondaryCta.href} onClick={() => setOpen(false)}>
                {secondaryCta.label}
              </a>
              <a
                className={`btn btn--primary btn--pill ${styles.cta}`}
                href={primaryCta.href}
                onClick={() => setOpen(false)}
              >
                {primaryCta.label}
              </a>
            </nav>
          </div>,
          document.body,
        )}
    </div>
  );
}
