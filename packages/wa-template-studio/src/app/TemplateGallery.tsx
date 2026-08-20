import * as React from 'react';
import { ChevronRight, Search } from 'lucide-react';

import { Input } from '@/ui/input';
import { applyGalleryTemplate, useStudio } from '@/core/store';
import { pickGalleryText, type GalleryTemplate } from '@/presets/gallery';
import { renderWaText } from '@/preview/renderWaText';

/** Show variables as {{n}} chips, matching the canvas authoring preview. */
const showVariableTokens = () => '';

/**
 * The inspector's default state: a browsable gallery of ready-made
 * WhatsApp templates rendered as faithful received-message bubbles (same
 * look as the live canvas). Picking one rebuilds the document (undoable)
 * so the preview updates immediately; the user then tweaks it in place.
 */

interface BubbleTheme {
  chat: string;
  bubble: string;
  text: string;
  time: string;
  name: string;
  dot: string;
}

function bubbleTheme(dark: boolean): BubbleTheme {
  return dark
    ? {
        chat: 'var(--wa-chat-dark)',
        bubble: 'var(--wa-bubble-dark)',
        text: '#e9edef',
        time: '#8696a0',
        name: '#06cf9c',
        dot: 'rgba(255,255,255,0.035)',
      }
    : {
        chat: 'var(--wa-chat-light)',
        bubble: 'var(--wa-bubble-light)',
        text: '#111b21',
        time: '#667781',
        name: '#008069',
        dot: 'rgba(0,0,0,0.045)',
      };
}

function TemplateBubble({
  template,
  language,
  theme,
}: {
  template: GalleryTemplate;
  language: string;
  theme: BubbleTheme;
}) {
  return (
    <button
      type="button"
      onClick={() => applyGalleryTemplate(template)}
      className="relative block w-fit max-w-[92%] rounded-lg rounded-tl-none p-[3px] pb-1 text-left shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] transition hover:-translate-y-px hover:shadow-[0_3px_10px_rgba(11,20,26,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{ backgroundColor: theme.bubble }}
    >
      {/* bubble tail (top-left, received style) */}
      <span
        aria-hidden
        className="absolute -left-2 top-0 h-[13px] w-2"
        style={{ backgroundColor: theme.bubble, clipPath: 'polygon(100% 0, 100% 100%, 0 0)' }}
      />
      <span
        className="block px-[9px] pt-[5px] text-[12.5px] font-semibold leading-[16px]"
        style={{ color: theme.name }}
      >
        {template.name}
      </span>
      <span
        className="block whitespace-pre-wrap break-words px-[9px] pt-[1px] text-[13.5px] leading-[18px] line-clamp-3"
        style={{ color: theme.text }}
      >
        {renderWaText(pickGalleryText(template, language), showVariableTokens)}
      </span>
      <span
        className="block px-[9px] pb-[1px] pt-[3px] text-right text-[10.5px] leading-none"
        style={{ color: theme.time }}
      >
        10:24
      </span>
    </button>
  );
}

export function TemplateGallery() {
  const groups = useStudio((s) => s.galleryTemplates);
  const language = useStudio((s) => s.doc.language);
  const docCategory = useStudio((s) => s.doc.category);
  const dark = useStudio((s) => s.previewDark);
  const [query, setQuery] = React.useState('');
  // Accordion: at most one category open at a time (null = all collapsed).
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const theme = bubbleTheme(dark);

  // Open the group matching the current template category once the catalog
  // lands (falls back to the first group); runs only until the first open.
  const didInit = React.useRef(false);
  React.useEffect(() => {
    if (didInit.current || groups.length === 0) return;
    didInit.current = true;
    const match = groups.find((g) => g.category === docCategory) ?? groups[0];
    setExpandedId(match ? match.id : null);
  }, [groups, docCategory]);

  const needle = query.trim().toLowerCase();
  const filtered = React.useMemo(() => {
    if (!needle) return groups;
    return groups
      .map((group) => ({
        ...group,
        templates: group.templates.filter(
          (t) =>
            t.name.toLowerCase().includes(needle) ||
            pickGalleryText(t, language).toLowerCase().includes(needle),
        ),
      }))
      .filter((group) => group.templates.length > 0);
  }, [groups, needle, language]);

  const total = React.useMemo(() => groups.reduce((n, g) => n + g.templates.length, 0), [groups]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Start from a ready-made template, then edit it right in the preview.
      </p>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${total} templates…`}
          aria-label="Search templates"
          className="h-8 pl-8 text-xs"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="px-0.5 text-xs text-muted-foreground">No templates match “{query.trim()}”.</p>
      ) : (
        filtered.map((group) => {
          // A search auto-expands every matching group; otherwise accordion.
          const open = needle ? true : expandedId === group.id;
          const panelId = `wts-gallery-${group.id}`;
          return (
            <section key={group.id} aria-label={group.name} className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => setExpandedId((cur) => (cur === group.id ? null : group.id))}
                aria-expanded={open}
                aria-controls={panelId}
                className="flex items-center justify-between gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <ChevronRight
                    className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`}
                    aria-hidden
                  />
                  <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.name}
                  </span>
                </span>
                <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/70">
                  {group.templates.length}
                </span>
              </button>
              {open && (
                <div
                  id={panelId}
                  className="flex flex-col items-start gap-2.5 rounded-lg border border-border p-3"
                  style={{
                    backgroundColor: theme.chat,
                    backgroundImage: `radial-gradient(${theme.dot} 1.2px, transparent 1.2px)`,
                    backgroundSize: '18px 18px',
                  }}
                >
                  {group.templates.map((template) => (
                    <TemplateBubble
                      key={template.id}
                      template={template}
                      language={language}
                      theme={theme}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
