import type { Tone } from './shared/tones';

/* ------------------------------ nav model ------------------------------- */
export type SectionKey =
  'usage' | 'branding' | 'domains' | 'billing' | 'api' | 'users' | 'integrations' | 'ai';

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
export type Role = 'Owner' | 'Editor' | 'Viewer';
export type Member = {
  email: string;
  name: string;
  role: Role;
  title: string;
  avBg: string;
  avColor: string;
  init: string;
  joined: string;
  lastActive: string;
  campaigns: number;
};
