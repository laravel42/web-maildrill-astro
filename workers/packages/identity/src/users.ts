import { eq } from 'drizzle-orm';
import { db, users, type User } from '@maildrill/database';

export async function findOrCreateUser(email: string, name?: string | null): Promise<User> {
  const normalized = email.trim().toLowerCase();
  const inserted = await db
    .insert(users)
    .values({ email: normalized, name: name ?? null })
    .onConflictDoNothing({ target: users.email })
    .returning();
  if (inserted[0]) return inserted[0];
  const existing = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
  return existing[0]!;
}

export async function getUser(id: string): Promise<User | null> {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}
