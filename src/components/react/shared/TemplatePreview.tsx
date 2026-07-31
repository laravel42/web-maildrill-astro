import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { ChannelType } from '@/types/app';
import { api } from '@/lib/app/api';
import type { ApiTemplate } from '@/lib/app/template-map';
import Icon from '../Icon';
import type { IconName } from '@/lib/icons';
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
  const [components, setComponents] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!live) return;
    let alive = true;
    void (async () => {
      try {
        const full = await api.get<ApiTemplate>(`templates/${id}`);
        if (!alive) return;
        setComponents(full.components ?? null);
        if (full.html && full.html.trim()) {
          setHtml(full.html);
          setState('ready');
        } else if (full.text && full.text.trim()) {
          setText(full.text);
          setState('ready');
        } else if (hasWaStructure(full.components)) {
          // WhatsApp template with structured parts but no flat body text.
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
  return <MessagePreview html={html} text={text} channel={channel} components={components} />;
}

/**
 * Render primitive: given a message body, show the HTML in a sandboxed iframe
 * (email) or the text as a bubble (SMS/WhatsApp/Voice). Used directly by callers
 * that already hold the content — e.g. a campaign's saved body — without a fetch.
 * `components` is the WhatsApp template structure (header/footer/buttons) stored
 * alongside the body; when present the bubble renders the full message shape.
 */
export function MessagePreview({
  html,
  text,
  channel,
  components,
}: {
  html?: string | null;
  text?: string | null;
  channel: ChannelType;
  components?: Record<string, unknown> | null;
}) {
  if (html && html.trim()) return <HtmlPreview html={html} />;
  if (channel === 'whatsapp' && hasWaStructure(components)) {
    return <WaPreview components={components} bodyText={text} />;
  }
  if (text && text.trim()) return <TextPreview text={text} channel={channel} />;
  return <div className={styles.pvMsg}>Nothing to preview yet.</div>;
}

/**
 * Renders exported email HTML in a sandboxed iframe scaled to fit the drawer.
 * The frame allows same-origin (so the rendered height can be measured) but not
 * scripts, so any JS embedded in a template can't run.
 */
const EMAIL_LOGICAL_WIDTH = 600;
const PREVIEW_MAX_HEIGHT = 400;

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

/**
 * WhatsApp template structure as stored in `templates.components` (the flat
 * blob built by `metaToStoredComponents`). All parts are optional.
 */
interface WaStoredComponents {
  header?: { format?: string; text?: string };
  body?: { text?: string };
  footer?: { text?: string; code_expiration_minutes?: number };
  buttons?: Array<{ type?: string; text?: string }>;
}

/** True when the blob carries anything worth rendering as a WhatsApp message. */
export function hasWaStructure(
  components?: Record<string, unknown> | null,
): components is Record<string, unknown> {
  if (!components || typeof components !== 'object') return false;
  const c = components as WaStoredComponents;
  return Boolean(
    c.header ||
      c.footer ||
      (Array.isArray(c.buttons) && c.buttons.length > 0) ||
      (typeof c.body?.text === 'string' && c.body.text.trim()),
  );
}

const WA_MEDIA_LABEL: Record<string, string> = {
  IMAGE: 'Image',
  VIDEO: 'Video',
  DOCUMENT: 'Document',
  LOCATION: 'Location',
};

function waButtonIcon(type?: string): IconName | null {
  switch (String(type ?? '').toUpperCase()) {
    case 'URL':
      return 'globe';
    case 'PHONE_NUMBER':
      return 'voice';
    case 'COPY_CODE':
    case 'OTP':
      return 'copy';
    default:
      return null;
  }
}

/**
 * Full WhatsApp message bubble: header (text or media placeholder), body,
 * footer, and button rows — mirroring how the sent template actually looks.
 * `bodyText` overrides the stored body (campaign drawers pass the campaign's
 * merge-rendered body while header/footer/buttons come from the template).
 */
function WaPreview({
  components,
  bodyText,
}: {
  components: Record<string, unknown>;
  bodyText?: string | null;
}) {
  const c = components as WaStoredComponents;
  const headerFormat = String(c.header?.format ?? '').toUpperCase();
  const headerText = headerFormat === 'TEXT' ? (c.header?.text ?? '').trim() : '';
  const mediaLabel = WA_MEDIA_LABEL[headerFormat];
  const body = (bodyText ?? '').trim() || (c.body?.text ?? '').trim();
  const footer =
    (c.footer?.text ?? '').trim() ||
    (typeof c.footer?.code_expiration_minutes === 'number'
      ? `This code expires in ${c.footer.code_expiration_minutes} minutes.`
      : '');
  const buttons = Array.isArray(c.buttons) ? c.buttons : [];

  return (
    <div className={styles.pvText}>
      <div className={`${styles.pvBubble} ${styles.pvBubbleWa} ${styles.pvBubbleWaTpl}`}>
        {headerText ? <div className={styles.pvWaHeader}>{headerText}</div> : null}
        {mediaLabel ? (
          <div className={styles.pvWaMedia}>
            <Icon name="media" size={20} stroke={1.7} />
            <span>{mediaLabel}</span>
          </div>
        ) : null}
        {body ? <div>{body}</div> : null}
        {footer ? <div className={styles.pvWaFooter}>{footer}</div> : null}
        {buttons.length > 0 ? (
          <div className={styles.pvWaBtns}>
            {buttons.map((b, i) => {
              const icon = waButtonIcon(b.type);
              return (
                <div key={i} className={styles.pvWaBtn}>
                  {icon ? <Icon name={icon} size={14} stroke={2.2} /> : null}
                  <span>{b.text || 'Button'}</span>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
