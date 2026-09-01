import { and, asc, desc, eq, ilike, isNotNull, isNull, sql, type SQL } from 'drizzle-orm';
import { db, landings, type LandingRow, type NewLanding } from '@maildrill/database';

/**
 * Landing pages (Builder42 sites). One row = one whole site document.
 *
 * Two invariants worth keeping in mind when touching this file:
 *
 *  1. **`document` never appears in a list query.** It carries images inline as
 *     data URLs, so a row can be megabytes; `pageCount` and `documentBytes` are
 *     recomputed on every write precisely so the list can answer "how big is
 *     this and will it publish?" without loading it.
 *  2. **Status is derived, not stored.** `draft` = never published,
 *     `published` = `updatedAt <= publishedAt`, `stale` = edited since. A stored
 *     copy would have to be rewritten on every save and would drift the first
 *     time it wasn't.
 */

/** Columns the list endpoint returns — everything except the document itself. */
const summaryColumns = {
  id: landings.id,
  tenantId: landings.tenantId,
  name: landings.name,
  siteId: landings.siteId,
  publishedUrl: landings.publishedUrl,
  publishedAt: landings.publishedAt,
  pageCount: landings.pageCount,
  documentBytes: landings.documentBytes,
  createdAt: landings.createdAt,
  updatedAt: landings.updatedAt,
} as const;

export type LandingSummaryRow = {
  [K in keyof typeof summaryColumns]: LandingRow[K & keyof LandingRow];
};

export type LandingStatusFilter = 'draft' | 'published' | 'stale';
export type LandingSortKey = 'name' | 'updatedAt' | 'createdAt' | 'publishedAt';

export interface ListLandingsParams {
  q?: string;
  status?: LandingStatusFilter;
  sort?: LandingSortKey;
  dir?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface UpsertLandingInput {
  tenantId: string;
  name: string;
  document?: Record<string, unknown> | null;
  schemaVersion?: number | null;
}

/** `pageOrder.length`, falling back to counting `pages` — 1 for an empty document. */
function pageCountOf(document: Record<string, unknown> | null | undefined): number {
  if (!document) return 1;
  const order = (document as { pageOrder?: unknown }).pageOrder;
  if (Array.isArray(order) && order.length > 0) return order.length;
  const pages = (document as { pages?: unknown }).pages;
  if (pages && typeof pages === 'object') {
    const count = Object.keys(pages as Record<string, unknown>).length;
    if (count > 0) return count;
  }
  return 1;
}

/** Serialised size in bytes — the same measure Builder42's publish preflight uses. */
function documentBytesOf(document: Record<string, unknown> | null | undefined): number {
  if (!document) return 0;
  try {
    return Buffer.byteLength(JSON.stringify(document), 'utf8');
  } catch {
    // A document that cannot be serialised cannot be stored either; the insert
    // below will fail on its own. Report 0 rather than throwing from a getter.
    return 0;
  }
}

/** `document.meta.siteId` if the editor has set one (only after a publish). */
function siteIdOf(document: Record<string, unknown> | null | undefined): string | null {
  const meta = (document as { meta?: { siteId?: unknown } } | null | undefined)?.meta;
  return typeof meta?.siteId === 'string' && meta.siteId ? meta.siteId : null;
}

/** `document.meta.version`, the editor's own schema version. */
function schemaVersionOf(document: Record<string, unknown> | null | undefined): number | null {
  const meta = (document as { meta?: { version?: unknown } } | null | undefined)?.meta;
  return typeof meta?.version === 'number' ? meta.version : null;
}

function statusWhere(status: LandingStatusFilter): SQL | undefined {
  switch (status) {
    case 'draft':
      return isNull(landings.publishedAt);
    case 'published':
      return and(
        isNotNull(landings.publishedAt),
        sql`${landings.updatedAt} <= ${landings.publishedAt}`,
      );
    case 'stale':
      return and(
        isNotNull(landings.publishedAt),
        sql`${landings.updatedAt} > ${landings.publishedAt}`,
      );
  }
}

const SORT_COLUMNS = {
  name: landings.name,
  updatedAt: landings.updatedAt,
  createdAt: landings.createdAt,
  publishedAt: landings.publishedAt,
} as const;

export async function listLandings(
  tenantId: string,
  params: ListLandingsParams = {},
): Promise<{ items: LandingSummaryRow[]; total: number }> {
  const limit = Math.min(Math.max(params.limit ?? 25, 1), 100);
  const offset = Math.max(params.offset ?? 0, 0);
  const filters: (SQL | undefined)[] = [eq(landings.tenantId, tenantId)];
  if (params.q) filters.push(ilike(landings.name, `%${params.q}%`));
  if (params.status) filters.push(statusWhere(params.status));
  const where = and(...filters.filter((f): f is SQL => f !== undefined));

  const column = SORT_COLUMNS[params.sort ?? 'updatedAt'];
  const order = (params.dir ?? 'desc') === 'asc' ? asc(column) : desc(column);

  const items = await db
    .select(summaryColumns)
    .from(landings)
    .where(where)
    .orderBy(order)
    .limit(limit)
    .offset(offset);

  const counted = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(landings)
    .where(where);

  return { items, total: counted[0]?.total ?? 0 };
}

export async function getLanding(tenantId: string, id: string): Promise<LandingRow | null> {
  const rows = await db
    .select()
    .from(landings)
    .where(and(eq(landings.id, id), eq(landings.tenantId, tenantId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createLanding(input: UpsertLandingInput): Promise<LandingRow> {
  const document = input.document ?? null;
  const rows = await db
    .insert(landings)
    .values({
      tenantId: input.tenantId,
      name: input.name,
      document,
      schemaVersion: input.schemaVersion ?? schemaVersionOf(document),
      siteId: siteIdOf(document),
      pageCount: pageCountOf(document),
      documentBytes: documentBytesOf(document),
    })
    .returning();
  return rows[0]!;
}

export async function updateLanding(
  tenantId: string,
  id: string,
  patch: {
    name?: string;
    document?: Record<string, unknown> | null;
    schemaVersion?: number | null;
    siteId?: string | null;
  },
): Promise<LandingRow | null> {
  const set: Partial<NewLanding> = { updatedAt: new Date() };
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.document !== undefined) {
    set.document = patch.document;
    set.pageCount = pageCountOf(patch.document);
    set.documentBytes = documentBytesOf(patch.document);
    // The editor writes its publish slug and schema version INTO the document,
    // so a save is the only chance to mirror them onto queryable columns.
    const fromDoc = siteIdOf(patch.document);
    if (fromDoc) set.siteId = fromDoc;
    const version = schemaVersionOf(patch.document);
    if (version !== null) set.schemaVersion = version;
  }
  if (patch.schemaVersion !== undefined) set.schemaVersion = patch.schemaVersion;
  if (patch.siteId !== undefined) set.siteId = patch.siteId;

  const rows = await db
    .update(landings)
    .set(set)
    .where(and(eq(landings.id, id), eq(landings.tenantId, tenantId)))
    .returning();
  return rows[0] ?? null;
}

export async function deleteLanding(tenantId: string, id: string): Promise<boolean> {
  const rows = await db
    .delete(landings)
    .where(and(eq(landings.id, id), eq(landings.tenantId, tenantId)))
    .returning({ id: landings.id });
  return rows.length > 0;
}

/**
 * Copy a landing, document included. The copy is always a draft: the publish
 * identity (`siteId`, `publishedUrl`, `publishedAt`) belongs to the original's
 * live URL and must not be cloned onto a second row — the unique index on
 * `site_id` would reject it anyway, which is the point.
 */
export async function duplicateLanding(tenantId: string, id: string): Promise<LandingRow | null> {
  const source = await getLanding(tenantId, id);
  if (!source) return null;
  const document = source.document ?? null;
  // Strip the publish slug from the copied document for the same reason.
  const cleaned =
    document && siteIdOf(document)
      ? {
          ...document,
          meta: Object.fromEntries(
            Object.entries((document as { meta?: Record<string, unknown> }).meta ?? {}).filter(
              ([key]) => key !== 'siteId',
            ),
          ),
        }
      : document;
  const rows = await db
    .insert(landings)
    .values({
      tenantId,
      name: `${source.name} (copy)`,
      document: cleaned,
      schemaVersion: source.schemaVersion,
      pageCount: source.pageCount,
      documentBytes: documentBytesOf(cleaned),
    })
    .returning();
  return rows[0]!;
}
