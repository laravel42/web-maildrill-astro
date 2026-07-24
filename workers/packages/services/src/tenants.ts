import { eq } from "drizzle-orm";
import { db, tenants, type Tenant } from "@maildrill/database";

/** Dev/bootstrap helper: find-or-create a tenant by name. */
export async function ensureTenantByName(name: string): Promise<Tenant> {
  const existing = await db.select().from(tenants).where(eq(tenants.name, name)).limit(1);
  if (existing[0]) return existing[0];
  const inserted = await db.insert(tenants).values({ name }).returning();
  return inserted[0]!;
}

export async function getTenant(id: string): Promise<Tenant | null> {
  const rows = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
  return rows[0] ?? null;
}
