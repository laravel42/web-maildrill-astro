import { and, asc, eq } from 'drizzle-orm';
import { customFieldDefs, db, type CustomFieldDefRow } from '@maildrill/database';

type FieldType = CustomFieldDefRow['type'];

/**
 * Result of an upsert. `created` distinguishes a new definition from one that
 * already existed, so an interactive caller can report the clash while an
 * importer can keep treating the call as idempotent.
 */
export interface CreateCustomFieldResult {
  field: CustomFieldDefRow;
  created: boolean;
}

export async function createCustomField(
  tenantId: string,
  key: string,
  label: string,
  type: FieldType = 'text',
): Promise<CreateCustomFieldResult> {
  const rows = await db
    .insert(customFieldDefs)
    .values({ tenantId, key, label, type })
    .onConflictDoNothing({ target: [customFieldDefs.tenantId, customFieldDefs.key] })
    .returning();
  if (rows[0]) return { field: rows[0], created: true };
  // Lost the race, or the key was already taken: return what is there now.
  const existing = await db
    .select()
    .from(customFieldDefs)
    .where(and(eq(customFieldDefs.tenantId, tenantId), eq(customFieldDefs.key, key)))
    .limit(1);
  return { field: existing[0]!, created: false };
}

export async function listCustomFields(tenantId: string): Promise<CustomFieldDefRow[]> {
  return db
    .select()
    .from(customFieldDefs)
    .where(eq(customFieldDefs.tenantId, tenantId))
    .orderBy(asc(customFieldDefs.key));
}

export async function deleteCustomField(tenantId: string, id: string): Promise<boolean> {
  const rows = await db
    .delete(customFieldDefs)
    .where(and(eq(customFieldDefs.id, id), eq(customFieldDefs.tenantId, tenantId)))
    .returning({ id: customFieldDefs.id });
  return rows.length > 0;
}
