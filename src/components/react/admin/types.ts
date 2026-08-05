import type { ReactNode } from 'react';
import type {
  AdminCampaign,
  AdminToken,
  AdminUser,
  AdminWorkspace,
  AuditEvent,
  BlogPost,
  CacheKey,
  Domain,
  Faq,
  Guide,
  Invoice,
  LlmProvider,
  LogLine,
  McpServer,
  Queue,
  Skill,
  Ticket,
  WebhookEvent,
} from '@/lib/app/admin-data';

/** A row that can be opened in the detail drawer, tagged by entity kind. */
export type Selection =
  | { kind: 'workspace'; data: AdminWorkspace }
  | { kind: 'user'; data: AdminUser }
  | { kind: 'invoice'; data: Invoice }
  | { kind: 'domain'; data: Domain }
  | { kind: 'token'; data: AdminToken }
  | { kind: 'campaign'; data: AdminCampaign }
  | { kind: 'ticket'; data: Ticket }
  | { kind: 'audit'; data: AuditEvent }
  | { kind: 'event'; data: WebhookEvent }
  | { kind: 'queue'; data: Queue }
  | { kind: 'cache'; data: CacheKey }
  | { kind: 'log'; data: LogLine }
  | { kind: 'llm'; data: LlmProvider }
  | { kind: 'skill'; data: Skill }
  | { kind: 'mcp'; data: McpServer }
  | { kind: 'post'; data: BlogPost }
  | { kind: 'guide'; data: Guide }
  | { kind: 'faq'; data: Faq };

/** Callback a screen uses to open the shared detail drawer. */
export type SelectFn = (selection: Selection) => void;

/** Props shared by every screen that can open a drawer. */
export interface ScreenProps {
  onSelect: SelectFn;
}

export interface ChipOption {
  id: string;
  label: string;
}

export interface Column<T> {
  key: string;
  header: ReactNode;
  align?: 'right';
  minWidth?: number;
  sortValue?: (row: T) => number | string;
  render: (row: T) => ReactNode;
}
