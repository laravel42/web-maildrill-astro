import { useEffect, useId, useState } from 'react';
import type { NavGroup } from '@/config/navigation';

type Cta = { label: string; href: string };

type Props = {
  items: NavGroup[];
  primaryCta: Cta;
  secondaryCta: Cta;
};

export default function MobileNav({ items, primaryCta, secondaryCta }: Props) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="mnav">
      <button
        type="button"
        className="mnav__toggle"
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

      {open && (
        <div className="mnav__panel" id={panelId}>
          <nav aria-label="Mobile">
            {items.map((item) =>
              item.children ? (
                <div className="mnav__group" key={item.label}>
                  <p className="mnav__grouplabel">{item.label}</p>
                  {item.children.map((child) => (
                    <a
                      key={child.href}
                      className="mnav__sublink"
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
                  className="mnav__link"
                  href={item.href}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </a>
              ),
            )}
            <a className="mnav__link" href={secondaryCta.href} onClick={() => setOpen(false)}>
              {secondaryCta.label}
            </a>
            <a
              className="btn btn--primary btn--pill mnav__cta"
              href={primaryCta.href}
              onClick={() => setOpen(false)}
            >
              {primaryCta.label}
            </a>
          </nav>
        </div>
      )}

      <style>{`
        .mnav { display: flex; align-items: center; }
        .mnav__toggle {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: 10px;
          border: 1px solid var(--border2);
          background: transparent;
          color: var(--text);
        }
        .mnav__panel {
          position: fixed;
          left: 0;
          right: 0;
          top: var(--nav-height);
          bottom: 0;
          background: var(--bg);
          padding: 8px 20px 24px;
          overflow-y: auto;
          animation: fade var(--duration) var(--ease-out);
        }
        .mnav__panel nav { display: flex; flex-direction: column; gap: 2px; }
        .mnav__link {
          padding: 12px;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 500;
          color: var(--text);
        }
        .mnav__link:hover { background: var(--surface2); }
        .mnav__group { display: flex; flex-direction: column; }
        .mnav__grouplabel {
          margin: 0;
          padding: 12px 12px 4px;
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .mnav__sublink {
          padding: 10px 12px 10px 20px;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 500;
          color: var(--text);
        }
        .mnav__sublink:hover { background: var(--surface2); }
        .mnav__cta { margin-top: 10px; width: 100%; }
        @media (min-width: 960px) {
          .mnav { display: none; }
        }
      `}</style>
    </div>
  );
}
