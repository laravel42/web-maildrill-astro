import type { Tone } from './shared/tones';

/* ------------------------------ nav model ------------------------------- */
export type SectionKey =
  'usage' | 'branding' | 'domains' | 'billing' | 'api' | 'users' | 'integrations' | 'ai' | 'emails';

/* ------------------------------- panels --------------------------------- */
export type ToggleKey = 'summaries' | 'subject' | 'sendtime';

export type FieldDef = {
  key: string;
  label: string;
  value: string;
  type?: string;
  swatch?: boolean;
  /** Placeholder hinting the expected content while the field is empty. */
  ph?: string;
};
export type TableRow = { title: string; sub: string; badge: string; tone: Tone };
export type ToggleDef = { key: ToggleKey; title: string; desc: string };

export type FormPanel = { kind: 'form'; title: string; desc: string; fields: FieldDef[] };
export type UsagePanel = { kind: 'usage'; title: string; desc: string };
export type TablePanel = {
  kind: 'table';
  title: string;
  desc: string;
  cta: string;
  /** Blank-slate message shown while the section has no rows yet. */
  empty: string;
  rows?: TableRow[];
  roster?: boolean;
};
export type TogglePanel = { kind: 'toggles'; title: string; desc: string; toggles: ToggleDef[] };
export type Panel = FormPanel | UsagePanel | TablePanel | TogglePanel;

/* ----------------------------- team roster ------------------------------ */
export type Role = 'Owner' | 'Admin' | 'Editor' | 'Viewer';
export type MemberStatus = 'Active' | 'Pending';
export type Member = {
  /** Service user id — required for role/remove calls; absent in demo mode. */
  userId?: string;
  email: string;
  name: string;
  role: Role;
  /** Derived: a member who has never signed in is Pending, not Active. */
  status: MemberStatus;
  avBg: string;
  avColor: string;
  init: string;
  joined: string;
  lastActive: string;
};

/* --------------------------- service payloads --------------------------- */
export type ApiWorkspace = {
  id: string;
  name: string;
  settings: Record<string, unknown>;
  createdAt: string;
};
export type ApiMember = {
  userId: string;
  email: string;
  name: string | null;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  joinedAt: string;
  /** ISO timestamp of the member's last sign-in; null when never signed in. */
  lastSignInAt: string | null;
};
export type ApiDnsRecord = {
  recordType: string;
  name: string;
  expectedValue: string;
  verified: boolean;
};
export type ApiDomain = { domainName: string; active: boolean; dnsRecords: ApiDnsRecord[] };
export type ApiWorkspaceKey = {
  id: string;
  name: string;
  keyId: string;
  scope: string;
  createdAt: string;
  revokedAt: string | null;
};
