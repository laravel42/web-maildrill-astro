import { and, desc, eq } from "drizzle-orm";
import {
  db,
  suppressions,
  type SuppressionRow,
} from "@maildrill/database";
import type { Channel } from "@maildrill/domain";

export async function addSuppression(
  tenantId: string,
  address: string,
  channel: Channel,
  reason?: string,
): Promise<SuppressionRow> {
  const rows = await db
    .insert(suppressions)
    .values({ tenantId, address: address.toLowerCase(), channel, reason: reason ?? null })
    .onConflictDoNothing({
      target: [suppressions.tenantId, suppressions.address, suppressions.channel],
    })
    .returning();
  if (rows[0]) return rows[0];
  const existing = await db
    .select()
    .from(suppressions)
    .where(
      and(
        eq(suppressions.tenantId, tenantId),
        eq(suppressions.address, address.toLowerCase()),
        eq(suppressions.channel, channel),
      ),
    )
    .limit(1);
  return existing[0]!;
}

export async function listSuppressions(
  tenantId: string,
  channel?: Channel,
): Promise<SuppressionRow[]> {
  const conds = [eq(suppressions.tenantId, tenantId)];
  if (channel) conds.push(eq(suppressions.channel, channel));
  return db
    .select()
    .from(suppressions)
    .where(and(...conds))
    .orderBy(desc(suppressions.createdAt));
}

export async function isSuppressed(
  tenantId: string,
  address: string,
  channel: Channel,
): Promise<boolean> {
  const rows = await db
    .select({ id: suppressions.id })
    .from(suppressions)
    .where(
      and(
        eq(suppressions.tenantId, tenantId),
        eq(suppressions.address, address.toLowerCase()),
        eq(suppressions.channel, channel),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function removeSuppression(tenantId: string, id: string): Promise<boolean> {
  const rows = await db
    .delete(suppressions)
    .where(and(eq(suppressions.id, id), eq(suppressions.tenantId, tenantId)))
    .returning({ id: suppressions.id });
  return rows.length > 0;
}
