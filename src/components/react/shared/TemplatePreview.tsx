import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { ChannelType } from '@/types/app';
import { api } from '@/lib/app/api';
import type { ApiTemplate } from '@/lib/app/template-map';
import styles from './TemplatePreview.module.css';

/**
 * Real template preview: fetches the saved template by id and renders its actual
 * content — the exported HTML for email (in a sandboxed iframe), the message body
 * for SMS/WhatsApp/Voice. Shared by the templates gallery drawer and the campaign
 * drawer. `fallback` is shown in fixture mode (no backend to read from).
 */
export default function TemplatePreview({
  id,
  channel,
  live,
  fallback = null,
}: {
  id: string;
  channel: ChannelType;
  live: boolean;
  fallback?: ReactNode;
}) {
  const [state, setState] = useState<'loading' | 'ready' | 'empty' | 'error'>(
    live ? 'loading' : 'ready',
  );
  const [html, setHtml] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    if (!live) return;
    let alive = true;
    void (async () => {
      try {
        const full = await api.get<ApiTemplate>(`templates/${id}`);
        if (!alive) return;
        if (full.html && full.html.trim()) {
          setHtml(full.html);
          setState('ready');
        } else if (full.text && full.text.trim()) {
          setText(full.text);
          setState('ready');
        } else {
          setState('empty');
        }
      } catch {
        if (alive) setState('error');
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, live]);

  // No workspace to read from — render the caller's stand-in.
  if (!live) return <>{fallback}</>;
  if (state === 'loading') return <div className={styles.pvMsg}>Loading preview…</div>;
  if (state === 'error') return <div className={styles.pvMsg}>Couldn’t load the preview.</div>;
  if (state === 'empty')
    return <div className={styles.pvMsg}>This template has no saved content yet.</div>;
  if (html) return <HtmlPreview html={html} />;
  return <TextPreview text={text ?? ''} channel={channel} />;
}

/**
 * Renders exported email HTML in a sandboxed iframe scaled to fit the drawer.
 * The frame allows same-origin (so the rendered height can be measured) but not
 * scripts, so any JS embedded in a template can't run.
 */
const EMAIL_LOGICAL_WIDTH = 600;
const PREVIEW_MAX_HEIGHT = 520;

function HtmlPreview({ html }: { html: string }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(0.55);
  const [docHeight, setDocHeight] = useState(EMAIL_LOGICAL_WIDTH);

  useLayoutEffect(() => {
    const measure = () => {
      const w = viewportRef.current?.clientWidth ?? EMAIL_LOGICAL_WIDTH;
      setScale(Math.min(1, w / EMAIL_LOGICAL_WIDTH));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (viewportRef.current) ro.observe(viewportRef.current);
    return () => ro.disconnect();
  }, []);

  const onLoad = () => {
    const doc = frameRef.current?.contentDocument;
    if (!doc) return;
    // Measure before hiding overflow so the full content height is captured.
    const h = Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight ?? 0);
    if (h > 0) setDocHeight(h);
    // Hide the framed document's own scrollbars (the outer viewport scrolls).
    const s = doc.createElement('style');
    s.textContent =
      'html,body{scrollbar-width:none;-ms-overflow-style:none;overflow:hidden}' +
      'html::-webkit-scrollbar,body::-webkit-scrollbar{width:0;height:0;display:none}';
    doc.head?.appendChild(s);
  };

  return (
    <div
      ref={viewportRef}
      className={styles.pvViewport}
      style={{ height: Math.min(docHeight * scale, PREVIEW_MAX_HEIGHT) }}
    >
      {/* reserves the scaled height so the viewport can scroll the whole email */}
      <div style={{ height: docHeight * scale, position: 'relative' }}>
        <iframe
          ref={frameRef}
          title="Template preview"
          srcDoc={html}
          sandbox="allow-same-origin"
          onLoad={onLoad}
          className={styles.pvFrame}
          style={{
            width: EMAIL_LOGICAL_WIDTH,
            height: docHeight,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        />
      </div>
    </div>
  );
}

/** Message-body preview for the text channels. */
function TextPreview({ text, channel }: { text: string; channel: ChannelType }) {
  return (
    <div className={styles.pvText}>
      <div className={`${styles.pvBubble} ${channel === 'whatsapp' ? styles.pvBubbleWa : ''}`}>
        {text}
      </div>
    </div>
  );
}
