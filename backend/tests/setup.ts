import 'dotenv/config';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { sql } from 'drizzle-orm';
import { db, pool } from '../src/db';
import { users, albums, albumMembers, presignTokens } from '../src/db/schema';

export interface TestUser {
  id: string;
  apple_sub: string | null;
  google_sub: string | null;
  display_name: string;
  avatar_url: string | null;
  push_token: string | null;
  created_at: Date | null;
}

export interface TestAlbum {
  id: string;
  name: string;
  child_birthdate: string | null;
  cover_photo_id: string | null;
  created_by: string;
  created_at: Date | null;
  is_private: boolean;
  archived_at: Date | null;
}

function toSnakeUser(u: typeof users.$inferSelect): TestUser {
  return {
    id: u.id,
    apple_sub: u.appleSub,
    google_sub: u.googleSub,
    display_name: u.displayName,
    avatar_url: u.avatarUrl,
    push_token: u.pushToken,
    created_at: u.createdAt,
  };
}

function toSnakeAlbum(a: typeof albums.$inferSelect): TestAlbum {
  return {
    id: a.id,
    name: a.name,
    child_birthdate: a.childBirthdate,
    cover_photo_id: a.coverPhotoId,
    created_by: a.createdBy,
    created_at: a.createdAt,
    is_private: a.isPrivate,
    archived_at: a.archivedAt ?? null,
  };
}

// Truncate all tables before each test. Single TRUNCATE statement is faster than 6 queries.
beforeEach(async () => {
  await db.execute(sql`TRUNCATE day_soundtracks, soundtracks, presign_tokens, invites, day_labels, photos, album_members, albums, users CASCADE`);
});

afterAll(async () => {
  await pool.end();
});

export async function createTestUser(
  overrides: Partial<{ apple_sub: string; display_name: string; avatar_url: string | null }> = {}
): Promise<TestUser> {
  const [u] = await db
    .insert(users)
    .values({
      appleSub: overrides.apple_sub ?? randomUUID(),
      displayName: overrides.display_name ?? 'Test User',
      avatarUrl: overrides.avatar_url ?? null,
    })
    .returning();
  return toSnakeUser(u);
}

export function authHeader(user: { id: string }): { Authorization: string } {
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'test-secret');
  return { Authorization: `Bearer ${token}` };
}

export async function createTestAlbum(
  userId: string,
  overrides: Partial<{
    name: string;
    child_birthdate: string | null;
    archived: boolean;
  }> = {}
): Promise<TestAlbum> {
  const [album] = await db
    .insert(albums)
    .values({
      name: overrides.name ?? 'Test Album',
      createdBy: userId,
      childBirthdate:
        overrides.child_birthdate !== undefined ? overrides.child_birthdate : '2024-01-15',
      archivedAt: overrides.archived ? new Date() : null,
    })
    .returning();
  await db.insert(albumMembers).values({
    albumId: album.id,
    userId,
    role: 'admin',
  });
  return toSnakeAlbum(album);
}

export async function createTestAlbumMember(
  albumId: string,
  userId: string,
  role: 'admin' | 'member' = 'member'
): Promise<void> {
  await db.insert(albumMembers).values({ albumId, userId, role });
}

export async function createPresignToken(userId: string, key: string): Promise<void> {
  await db.insert(presignTokens).values({ key, userId });
}
