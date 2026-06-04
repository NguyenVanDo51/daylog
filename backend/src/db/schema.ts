import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  date,
  integer,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const memberRole = pgEnum('member_role', ['admin', 'member']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
  appleSub: varchar('apple_sub').unique(),
  googleSub: varchar('google_sub').unique(),
  displayName: varchar('display_name').notNull(),
  avatarUrl: text('avatar_url'),
  apnsToken: text('apns_token'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// NOTE: albums.cover_photo_id references photos.id, creating a circular dependency
// (photos.album_id references albums.id). Drizzle-kit can't emit this FK declaratively
// across the cycle, so we add it via a raw ALTER TABLE in the generated migration.
export const albums = pgTable('albums', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
  name: varchar('name').notNull(),
  childBirthdate: date('child_birthdate'),
  coverPhotoId: uuid('cover_photo_id'),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const albumMembers = pgTable(
  'album_members',
  {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
    albumId: uuid('album_id')
      .notNull()
      .references(() => albums.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    role: memberRole('role').notNull().default('member'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    uniqAlbumUser: uniqueIndex('album_members_album_user_uniq').on(t.albumId, t.userId),
  })
);

export const photos = pgTable(
  'photos',
  {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
    albumId: uuid('album_id')
      .notNull()
      .references(() => albums.id, { onDelete: 'cascade' }),
    uploadedBy: uuid('uploaded_by')
      .notNull()
      .references(() => users.id),
    r2Key: text('r2_key').notNull(),
    thumbnailKey: text('thumbnail_key'),
    takenAt: timestamp('taken_at', { withTimezone: true }).notNull(),
    caption: text('caption'),
    localAssetId: varchar('local_asset_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    byAlbumTakenAt: index('idx_photos_album_taken_at').on(t.albumId, t.takenAt.desc()),
    byAlbumLocalAsset: index('idx_photos_local_asset')
      .on(t.albumId, t.localAssetId)
      .where(sql`${t.localAssetId} IS NOT NULL`),
  })
);

export const reactions = pgTable('reactions', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
  photoId: uuid('photo_id').notNull().references(() => photos.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id),
  emoji: varchar('emoji', { length: 8 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  uniqPhotoUser: uniqueIndex('reactions_photo_user_uniq').on(t.photoId, t.userId),
  byPhoto: index('idx_reactions_photo').on(t.photoId),
}));

export const milestones = pgTable(
  'milestones',
  {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
    albumId: uuid('album_id')
      .notNull()
      .references(() => albums.id, { onDelete: 'cascade' }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    title: varchar('title').notNull(),
    note: text('note'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    coverPhotoId: uuid('cover_photo_id').references(() => photos.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    byAlbumOccurredAt: index('idx_milestones_album_occurred_at').on(
      t.albumId,
      t.occurredAt.desc()
    ),
  })
);

export const invites = pgTable('invites', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
  albumId: uuid('album_id')
    .notNull()
    .references(() => albums.id, { onDelete: 'cascade' }),
  token: varchar('token').notNull().unique(),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  maxUses: integer('max_uses'),
  useCount: integer('use_count').notNull().default(0),
});

export const presignTokens = pgTable('presign_tokens', {
  key: text('key').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
