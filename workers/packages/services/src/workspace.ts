import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { config } from '@maildrill/config';
import { db, magicLinkTokens, memberships, tenants, users, type Tenant } from '@maildrill/database';
import { ConflictError, NotFoundError, ValidationError } from '@maildrill/domain';
import { findOrCreateUser } from '@maildrill/identity';
import { sendTransactionalEmail } from '@maildrill/providers';

/**
 * Workspace (tenant) settings + team membership, backing the Settings screen.
 * Settings live in the tenants.settings jsonb bag (branding, ai) the same way
 * profile extras live in users.preferences.
 */

export type MembershipRole = 'owner' | 'admin' | 'editor' | 'viewer';
export const MEMBERSHIP_ROLES: readonly MembershipRole[] = ['owner', 'admin', 'editor', 'viewer'];

export interface WorkspaceInfo {
  id: string;
  name: string;
  settings: Record<string, unknown>;
  createdAt: Date;
}

function toInfo(t: Tenant): WorkspaceInfo {
  return { id: t.id, name: t.name, settings: t.settings ?? {}, createdAt: t.createdAt };
}

export async function getWorkspace(tenantId: string): Promise<WorkspaceInfo | null> {
  const rows = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  return rows[0] ? toInfo(rows[0]) : null;
}

/**
 * Shallow settings merge: top-level keys replace, except plain-object values
 * (branding, ai) which merge one level so a partial patch keeps siblings —
 * mirroring mergePreferences on the user side. Exported for tests.
 */
export function mergeSettings(
  current: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    const prev = out[key];
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      prev &&
      typeof prev === 'object' &&
      !Array.isArray(prev)
    ) {
      out[key] = { ...(prev as Record<string, unknown>), ...(value as Record<string, unknown>) };
    } else {
      out[key] = value;
    }
  }
  return out;
}

export async function updateWorkspace(
  tenantId: string,
  input: { name?: string; settings?: Record<string, unknown> },
): Promise<WorkspaceInfo | null> {
  const rows = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  const current = rows[0];
  if (!current) return null;

  const set: { name?: string; settings?: Record<string, unknown>; updatedAt: Date } = {
    updatedAt: new Date(),
  };
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new ValidationError('workspace name cannot be empty');
    set.name = name;
  }
  if (input.settings) {
    set.settings = mergeSettings(current.settings ?? {}, input.settings);
  }

  const updated = await db.update(tenants).set(set).where(eq(tenants.id, tenantId)).returning();
  return updated[0] ? toInfo(updated[0]) : null;
}

/* ------------------------------- members -------------------------------- */

export interface WorkspaceMember {
  userId: string;
  email: string;
  name: string | null;
  role: MembershipRole;
  joinedAt: Date;
  /**
   * Last successful sign-in, derived from consumed login codes — the only
   * activity signal the system records per user today. Null when the account
   * exists but has never signed in (e.g. just added to the workspace).
   */
  lastSignInAt: Date | null;
}

export async function listMembers(tenantId: string): Promise<WorkspaceMember[]> {
  const rows = await db
    .select({
      userId: memberships.userId,
      email: users.email,
      name: users.name,
      role: memberships.role,
      joinedAt: memberships.createdAt,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.tenantId, tenantId))
    .orderBy(memberships.createdAt);
  if (rows.length === 0) return [];

  // One grouped pass over this workspace's addresses rather than a query per
  // member. Tokens are pruned over time, so a long-dormant member reads as
  // null rather than a stale timestamp.
  const lastByEmail = new Map<string, Date>();
  const signIns = await db
    .select({
      email: magicLinkTokens.email,
      at: sql<Date>`max(${magicLinkTokens.consumedAt})`,
    })
    .from(magicLinkTokens)
    .where(
      and(
        isNotNull(magicLinkTokens.consumedAt),
        inArray(
          magicLinkTokens.email,
          rows.map((r) => r.email),
        ),
      ),
    )
    .groupBy(magicLinkTokens.email);
  for (const s of signIns) {
    if (s.at) lastByEmail.set(s.email, new Date(s.at));
  }

  return rows.map((r) => ({
    ...r,
    role: r.role as MembershipRole,
    lastSignInAt: lastByEmail.get(r.email) ?? null,
  }));
}

async function ownerCount(tenantId: string): Promise<number> {
  const rows = await db
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(and(eq(memberships.tenantId, tenantId), eq(memberships.role, 'owner')));
  return rows.length;
}

/**
 * Add a member by email. Sign-in is passwordless and open, so the account is
 * created on the spot when it doesn't exist; a heads-up email goes out
 * best-effort over the transactional relay.
 */
export async function addMember(
  tenantId: string,
  input: { email: string; role: MembershipRole },
): Promise<WorkspaceMember> {
  const email = input.email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new ValidationError('enter a valid email address');
  if (!MEMBERSHIP_ROLES.includes(input.role)) throw new ValidationError('unknown role');

  const workspace = await getWorkspace(tenantId);
  if (!workspace) throw new NotFoundError('workspace not found');

  const { user } = await findOrCreateUser(email);
  const inserted = await db
    .insert(memberships)
    .values({ userId: user.id, tenantId, role: input.role })
    .onConflictDoNothing()
    .returning();
  if (inserted.length === 0) {
    throw new ConflictError(`${email} is already a member of this workspace`);
  }

  // Best-effort invite note — membership stands even if the email no-ops.
  void sendTransactionalEmail({
    to: email,
    subject: `You've been added to ${workspace.name} on Maildrill`,
    text:
      `You now have access to the "${workspace.name}" workspace on Maildrill.\n\n` +
      `Sign in with this email address — no password needed:\n${config.app.url}/login\n`,
    html:
      `<p>You now have access to the <strong>${workspace.name}</strong> workspace on Maildrill.</p>` +
      `<p>Sign in with this email address — no password needed.</p>` +
      `<p><a href="${config.app.url}/login">Sign in to Maildrill</a></p>`,
  }).catch(() => undefined);

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: input.role,
    joinedAt: inserted[0]!.createdAt,
    // A member added just now has, by definition, not signed in since.
    lastSignInAt: null,
  };
}

export async function updateMemberRole(
  tenantId: string,
  userId: string,
  role: MembershipRole,
): Promise<WorkspaceMember> {
  if (!MEMBERSHIP_ROLES.includes(role)) throw new ValidationError('unknown role');
  const existing = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.tenantId, tenantId), eq(memberships.userId, userId)))
    .limit(1);
  const membership = existing[0];
  if (!membership) throw new NotFoundError('member not found');

  // A workspace must always keep at least one owner.
  if (membership.role === 'owner' && role !== 'owner' && (await ownerCount(tenantId)) <= 1) {
    throw new ConflictError('cannot demote the only owner of the workspace');
  }

  await db
    .update(memberships)
    .set({ role })
    .where(and(eq(memberships.tenantId, tenantId), eq(memberships.userId, userId)));

  const members = await listMembers(tenantId);
  const updated = members.find((m) => m.userId === userId);
  if (!updated) throw new NotFoundError('member not found');
  return updated;
}

export async function removeMember(tenantId: string, userId: string): Promise<void> {
  const existing = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.tenantId, tenantId), eq(memberships.userId, userId)))
    .limit(1);
  const membership = existing[0];
  if (!membership) throw new NotFoundError('member not found');

  if (membership.role === 'owner' && (await ownerCount(tenantId)) <= 1) {
    throw new ConflictError('cannot remove the only owner of the workspace');
  }

  await db
    .delete(memberships)
    .where(and(eq(memberships.tenantId, tenantId), eq(memberships.userId, userId)));
}
