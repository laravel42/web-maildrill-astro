import Icon from '../../Icon';
import {
  AUDIT_CAT,
  CAMP_STATUS,
  CHANNEL_META,
  DNS,
  DOMAIN_STATUS,
  EVENT_STATUS,
  INV_STATUS,
  LLM_STATUS,
  LOG_LEVEL,
  MCP_STATUS,
  MCP_TRANSPORT,
  PLAN,
  PRIORITY,
  PUBLISH,
  QUEUE_STATUS,
  ROLE,
  SKILL_STATUS,
  TICKET_STATUS,
  TOKEN_SCOPE,
  TOKEN_STATUS,
  fmtCompact,
  fmtInt,
  fmtUsd,
} from '@/lib/app/admin-data';
import type { Selection } from '../types';
import { Pill, Tag } from '../components';
import { DrawerShell, Rows } from './DrawerShell';
import styles from '../AppAdmin.module.css';

export function GenericDrawer({
  s,
  onClose,
}: {
  s: Exclude<Selection, { kind: 'workspace' }>;
  onClose: () => void;
}) {
  switch (s.kind) {
    case 'user': {
      const u = s.data;
      return (
        <DrawerShell onClose={onClose} avatar={{ name: u.name }} name={u.name} badges={<Tag {...ROLE[u.role]} />} subtitle={<span className="mono">{u.email}</span>}>
          <Rows
            rows={[
              ['Workspace', u.ws],
              ['Plan', PLAN[u.plan].label],
              ['Role', ROLE[u.role].label],
              ['2FA', u.mfa ? 'Enabled' : 'Disabled'],
              ['Status', u.active ? 'Active' : 'Dormant'],
              ['Last sign-in', u.last],
            ]}
          />
        </DrawerShell>
      );
    }
    case 'invoice': {
      const v = s.data;
      return (
        <DrawerShell onClose={onClose} avatar={{ name: v.ws }} name={v.num} badges={<Pill p={INV_STATUS[v.status]} />} subtitle={`${v.ws} · ${v.period}`}>
          <div className={styles.detailGrid}>
            <div className={styles.miniCard}>
              <div className={styles.miniLabel}>Amount</div>
              <div className={`tnum ${styles.miniValue}`}>{fmtUsd(v.amount)}</div>
            </div>
            <div className={styles.miniCard}>
              <div className={styles.miniLabel}>Plan</div>
              <div className={styles.miniValue} style={{ fontSize: 16 }}>{PLAN[v.plan].label}</div>
            </div>
          </div>
          <Rows rows={[['Workspace', v.ws], ['Period', v.period], ['Due', v.due], ['Status', INV_STATUS[v.status].label]]} />
        </DrawerShell>
      );
    }
    case 'domain': {
      const d = s.data;
      return (
        <DrawerShell onClose={onClose} avatar={{ name: d.ws }} name={d.domain} badges={<Pill p={DOMAIN_STATUS[d.status]} />} subtitle={d.ws}>
          <div className={styles.eyebrow}>Authentication</div>
          <Rows
            rows={[
              ['SPF', <Pill p={DNS[d.spf] ?? DNS.warn} />],
              ['DKIM', <Pill p={DNS[d.dkim] ?? DNS.warn} />],
              ['DMARC', <Pill p={DNS[d.dmarc] ?? DNS.warn} />],
            ]}
          />
          <div className={styles.eyebrow}>Reputation</div>
          <Rows rows={[['Bounce rate', `${d.bounce}%`], ['Complaint rate', `${d.complaint}%`]]} />
        </DrawerShell>
      );
    }
    case 'token': {
      const t = s.data;
      return (
        <DrawerShell onClose={onClose} name={t.name} badges={<Pill p={TOKEN_STATUS[t.status]} />} subtitle={<span className="mono">{t.prefix}···</span>}>
          <Rows
            rows={[
              ['Workspace', t.ws],
              ['Scope', TOKEN_SCOPE[t.scope].label],
              ['Last used', t.used],
              ['Expires', t.expires],
            ]}
          />
          <button type="button" className="sbtn" style={{ color: '#dc2626', width: '100%' }}>
            <Icon name="trash" size={14} />
            Revoke token
          </button>
        </DrawerShell>
      );
    }
    case 'campaign': {
      const c = s.data;
      return (
        <DrawerShell onClose={onClose} avatar={{ name: c.ws }} name={c.name} badges={<Pill p={CAMP_STATUS[c.status]} />} subtitle={c.ws}>
          <div className={styles.detailGrid}>
            <div className={styles.miniCard}>
              <div className={styles.miniLabel}>Recipients</div>
              <div className={`tnum ${styles.miniValue}`}>{fmtCompact(c.recipients)}</div>
            </div>
            <div className={styles.miniCard}>
              <div className={styles.miniLabel}>Progress</div>
              <div className={`tnum ${styles.miniValue}`}>{c.progress}%</div>
            </div>
          </div>
          <Rows
            rows={[
              ['Channel', CHANNEL_META[c.channel].label],
              ['Open rate', c.openRate ? `${c.openRate}%` : '—'],
              ['Status', CAMP_STATUS[c.status].label],
              ['When', c.when],
            ]}
          />
        </DrawerShell>
      );
    }
    case 'ticket': {
      const t = s.data;
      return (
        <DrawerShell
          onClose={onClose}
          name={t.subject}
          badges={
            <>
              <Tag {...PRIORITY[t.priority]} />
              <Pill p={TICKET_STATUS[t.status]} />
            </>
          }
          subtitle={<span className="mono">#{t.id}</span>}
          actions={
            <>
              <button type="button" className="pbtn" style={{ padding: '8px 13px' }}>Reply</button>
              <button type="button" className="sbtn" style={{ padding: '8px 13px' }}>Assign</button>
              <button type="button" className="sbtn" style={{ marginLeft: 'auto', padding: '8px 13px', color: '#16a34a' }}>Resolve</button>
            </>
          }
        >
          <Rows
            rows={[
              ['Workspace', t.ws],
              ['Category', t.category],
              ['Priority', PRIORITY[t.priority].label],
              ['Agent', t.agent ?? 'Unassigned'],
              ['Status', TICKET_STATUS[t.status].label],
              ['Updated', t.updated],
            ]}
          />
        </DrawerShell>
      );
    }
    case 'audit': {
      const e = s.data;
      return (
        <DrawerShell onClose={onClose} avatar={{ name: e.actor }} name={e.action} badges={<Tag label={AUDIT_CAT[e.cat].label} fg={AUDIT_CAT[e.cat].fg} bg={AUDIT_CAT[e.cat].bg} />} subtitle={e.actor}>
          <Rows
            rows={[
              ['Target', <span className="mono" style={{ fontSize: 12 }}>{e.target}</span>],
              ['Category', AUDIT_CAT[e.cat].label],
              ['IP address', <span className="mono" style={{ fontSize: 12 }}>{e.ip}</span>],
              ['When', e.when],
            ]}
          />
        </DrawerShell>
      );
    }
    case 'event': {
      const e = s.data;
      return (
        <DrawerShell onClose={onClose} name={e.type} badges={<Pill p={EVENT_STATUS[e.status]} />} subtitle={<span className="mono">{e.msgId}</span>}>
          <Rows
            rows={[
              ['Channel', CHANNEL_META[e.channel].label],
              ['Endpoint', <span className="mono" style={{ fontSize: 12 }}>{e.endpoint}</span>],
              ['Status', EVENT_STATUS[e.status].label],
              ['Received', e.when],
            ]}
          />
        </DrawerShell>
      );
    }
    case 'queue': {
      const q = s.data;
      return (
        <DrawerShell onClose={onClose} name={q.name} badges={<Pill p={QUEUE_STATUS[q.status]} />} subtitle="BullMQ queue">
          <div className={styles.detailGrid}>
            <div className={styles.miniCard}>
              <div className={styles.miniLabel}>Active</div>
              <div className={`tnum ${styles.miniValue}`}>{q.active}</div>
            </div>
            <div className={styles.miniCard}>
              <div className={styles.miniLabel}>Waiting</div>
              <div className={`tnum ${styles.miniValue}`}>{fmtInt(q.waiting)}</div>
            </div>
          </div>
          <Rows rows={[['Completed', fmtInt(q.completed)], ['Failed', `${q.failed}`], ['Rate', q.rate], ['Status', QUEUE_STATUS[q.status].label]]} />
        </DrawerShell>
      );
    }
    case 'cache': {
      const c = s.data;
      return (
        <DrawerShell onClose={onClose} name={c.key} subtitle={`${c.type} · ${c.size}`}>
          <Rows rows={[['Type', c.type], ['TTL', c.ttl], ['Size', c.size]]} />
        </DrawerShell>
      );
    }
    case 'log': {
      const l = s.data;
      return (
        <DrawerShell onClose={onClose} name={l.svc} badges={<Pill p={LOG_LEVEL[l.level]} />} subtitle={<span className="mono">{l.time}</span>}>
          <div className={styles.eyebrow}>Message</div>
          <div className="mono" style={{ fontSize: 12.5, color: 'var(--text2)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, lineHeight: 1.5 }}>
            {l.msg}
          </div>
        </DrawerShell>
      );
    }
    case 'llm': {
      const p = s.data;
      return (
        <DrawerShell onClose={onClose} avatar={{ name: p.name, color: p.color }} name={p.name} badges={<Pill p={LLM_STATUS[p.status]} />} subtitle={<span className="mono">{p.vendor}</span>}>
          <Rows
            rows={[
              ['Models', `${p.modelCount}`],
              ['Default model', <span className="mono" style={{ fontSize: 12 }}>{p.defaultModel}</span>],
              ['Avg. latency', `${p.latency}ms`],
              ['Status', LLM_STATUS[p.status].label],
            ]}
          />
        </DrawerShell>
      );
    }
    case 'skill': {
      const k = s.data;
      return (
        <DrawerShell onClose={onClose} name={k.name} badges={<Pill p={SKILL_STATUS[k.status]} />} subtitle={k.desc}>
          <Rows
            rows={[
              ['Category', k.category],
              ['Trigger', k.trigger],
              ['Model', <span className="mono" style={{ fontSize: 12 }}>{k.model}</span>],
              ['Status', SKILL_STATUS[k.status].label],
            ]}
          />
        </DrawerShell>
      );
    }
    case 'mcp': {
      const m = s.data;
      return (
        <DrawerShell onClose={onClose} name={m.name} badges={<Pill p={MCP_STATUS[m.status]} />} subtitle={<span className="mono">{m.endpoint}</span>}>
          <Rows
            rows={[
              ['Transport', MCP_TRANSPORT[m.transport].label],
              ['Tools', `${m.toolCount}`],
              ['Scope', m.scope],
              ['Status', MCP_STATUS[m.status].label],
            ]}
          />
        </DrawerShell>
      );
    }
    case 'post':
    case 'guide':
    case 'faq': {
      const title = s.kind === 'faq' ? s.data.q : s.data.title;
      const status = s.data.status;
      return (
        <DrawerShell onClose={onClose} name={title} badges={<Pill p={PUBLISH[status]} />} subtitle={`Content editor · updated ${s.data.updated}`}>
          <span className={styles.label}>{s.kind === 'faq' ? 'Question' : 'Title'}</span>
          <input className={styles.input} defaultValue={title} style={{ marginBottom: 16 }} />
          <span className={styles.label}>{s.kind === 'faq' ? 'Answer' : 'Body'}</span>
          <textarea className={styles.input} rows={8} defaultValue="Edit the published content here…" style={{ resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button type="button" className="pbtn" style={{ flex: 1 }}>
              <Icon name="save" size={14} />
              Save changes
            </button>
            <button type="button" className="sbtn" onClick={onClose}>Cancel</button>
          </div>
        </DrawerShell>
      );
    }
    default:
      return null;
  }
}
