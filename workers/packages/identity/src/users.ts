import { eq } from 'drizzle-orm';
import { db, users, type User } from '@maildrill/database';

export async function findOrCreateUser(
  email: string,
  name?: string | null,
  phone?: string | null,
): Promise<{ user: User; created: boolean }> {
  const normalized = email.trim().toLowerCase();
  const inserted = await db
    .insert(users)
    .values({ email: normalized, name: name ?? null, phone: phone ?? null })
    .onConflictDoNothing({ target: users.email })
    .returning();
  if (inserted[0]) return { user: inserted[0], created: true };
  const existing = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
  return { user: existing[0]!, created: false };
}

export async function getUser(id: string): Promise<User | null> {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}
