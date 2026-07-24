import { and, eq } from "drizzle-orm";
import { db, memberships, tenants, type Membership, type User } from "@maildrill/database";

export interface WorkspaceMembership {
  tenantId: string;
  role: Membership["role"];
  workspaceName: string;
}

export async function listMembershipsForUser(
  userId: string,
): Promise<WorkspaceMembership[]> {
  return db
    .select({
      tenantId: memberships.tenantId,
      role: memberships.role,
      workspaceName: tenants.name,
    })
    .from(memberships)
    .innerJoin(tenants, eq(memberships.tenantId, tenants.id))
    .where(eq(memberships.userId, userId));
}

/** Give a brand-new user a personal workspace (tenant) with an owner role. */
export async function ensurePersonalWorkspace(user: User): Promise<void> {
  const existing = await db
    .select({ tenantId: memberships.tenantId })
    .from(memberships)
    .where(eq(memberships.userId, user.id))
    .limit(1);
  if (existing[0]) return;

  const tenant = (await db.insert(tenants).values({ name: user.email }).returning())[0]!;
  await db
    .insert(memberships)
    .values({ userId: user.id, tenantId: tenant.id, role: "owner" });
}

export async function isMember(userId: string, tenantId: string): Promise<boolean> {
  const rows = await db
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(and(eq(memberships.userId, userId), eq(memberships.tenantId, tenantId)))
    .limit(1);
  return rows.length > 0;
}
