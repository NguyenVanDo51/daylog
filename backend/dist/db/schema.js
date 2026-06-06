"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.presignTokens = exports.invites = exports.dayLabels = exports.reactions = exports.photos = exports.albumMembers = exports.albums = exports.users = exports.memberRole = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
exports.memberRole = (0, pg_core_1.pgEnum)('member_role', ['admin', 'member']);
exports.users = (0, pg_core_1.pgTable)('users', {
    id: (0, pg_core_1.uuid)('id').primaryKey().default((0, drizzle_orm_1.sql) `uuid_generate_v4()`),
    appleSub: (0, pg_core_1.varchar)('apple_sub').unique(),
    googleSub: (0, pg_core_1.varchar)('google_sub').unique(),
    displayName: (0, pg_core_1.varchar)('display_name').notNull(),
    avatarUrl: (0, pg_core_1.text)('avatar_url'),
    apnsToken: (0, pg_core_1.text)('apns_token'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow(),
});
// NOTE: albums.cover_photo_id references photos.id, creating a circular dependency
// (photos.album_id references albums.id). Drizzle-kit can't emit this FK declaratively
// across the cycle, so we add it via a raw ALTER TABLE in the generated migration.
exports.albums = (0, pg_core_1.pgTable)('albums', {
    id: (0, pg_core_1.uuid)('id').primaryKey().default((0, drizzle_orm_1.sql) `uuid_generate_v4()`),
    name: (0, pg_core_1.varchar)('name').notNull(),
    childBirthdate: (0, pg_core_1.date)('child_birthdate'),
    coverPhotoId: (0, pg_core_1.uuid)('cover_photo_id'),
    createdBy: (0, pg_core_1.uuid)('created_by')
        .notNull()
        .references(() => exports.users.id),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow(),
    isPrivate: (0, pg_core_1.boolean)('is_private').notNull().default(false),
});
exports.albumMembers = (0, pg_core_1.pgTable)('album_members', {
    id: (0, pg_core_1.uuid)('id').primaryKey().default((0, drizzle_orm_1.sql) `uuid_generate_v4()`),
    albumId: (0, pg_core_1.uuid)('album_id')
        .notNull()
        .references(() => exports.albums.id, { onDelete: 'cascade' }),
    userId: (0, pg_core_1.uuid)('user_id')
        .notNull()
        .references(() => exports.users.id),
    role: (0, exports.memberRole)('role').notNull().default('member'),
    joinedAt: (0, pg_core_1.timestamp)('joined_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
    uniqAlbumUser: (0, pg_core_1.uniqueIndex)('album_members_album_user_uniq').on(t.albumId, t.userId),
}));
exports.photos = (0, pg_core_1.pgTable)('photos', {
    id: (0, pg_core_1.uuid)('id').primaryKey().default((0, drizzle_orm_1.sql) `uuid_generate_v4()`),
    albumId: (0, pg_core_1.uuid)('album_id')
        .notNull()
        .references(() => exports.albums.id, { onDelete: 'cascade' }),
    uploadedBy: (0, pg_core_1.uuid)('uploaded_by')
        .notNull()
        .references(() => exports.users.id),
    r2Key: (0, pg_core_1.text)('r2_key').notNull(),
    thumbnailKey: (0, pg_core_1.text)('thumbnail_key'),
    takenAt: (0, pg_core_1.timestamp)('taken_at', { withTimezone: true }).notNull(),
    caption: (0, pg_core_1.text)('caption'),
    localAssetId: (0, pg_core_1.varchar)('local_asset_id'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow(),
    mediaType: (0, pg_core_1.varchar)('media_type', { length: 8 }).notNull().default('photo'),
    source: (0, pg_core_1.varchar)('source', { length: 8 }).notNull().default('upload'),
    durationMs: (0, pg_core_1.integer)('duration_ms'),
    width: (0, pg_core_1.integer)('width'),
    height: (0, pg_core_1.integer)('height'),
}, (t) => ({
    byAlbumTakenAt: (0, pg_core_1.index)('idx_photos_album_taken_at').on(t.albumId, t.takenAt.desc()),
    byAlbumLocalAsset: (0, pg_core_1.index)('idx_photos_local_asset')
        .on(t.albumId, t.localAssetId)
        .where((0, drizzle_orm_1.sql) `${t.localAssetId} IS NOT NULL`),
    captureRateLimit: (0, pg_core_1.index)('idx_photos_capture_rate_limit')
        .on(t.uploadedBy, t.createdAt.desc())
        .where((0, drizzle_orm_1.sql) `${t.source} = 'capture'`),
}));
exports.reactions = (0, pg_core_1.pgTable)('reactions', {
    id: (0, pg_core_1.uuid)('id').primaryKey().default((0, drizzle_orm_1.sql) `uuid_generate_v4()`),
    photoId: (0, pg_core_1.uuid)('photo_id').notNull().references(() => exports.photos.id, { onDelete: 'cascade' }),
    userId: (0, pg_core_1.uuid)('user_id').notNull().references(() => exports.users.id),
    emoji: (0, pg_core_1.varchar)('emoji', { length: 8 }).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
    uniqPhotoUser: (0, pg_core_1.uniqueIndex)('reactions_photo_user_uniq').on(t.photoId, t.userId),
    byPhoto: (0, pg_core_1.index)('idx_reactions_photo').on(t.photoId),
}));
exports.dayLabels = (0, pg_core_1.pgTable)('day_labels', {
    id: (0, pg_core_1.uuid)('id').primaryKey().default((0, drizzle_orm_1.sql) `uuid_generate_v4()`),
    albumId: (0, pg_core_1.uuid)('album_id')
        .notNull()
        .references(() => exports.albums.id, { onDelete: 'cascade' }),
    date: (0, pg_core_1.date)('date').notNull(),
    label: (0, pg_core_1.text)('label').notNull(),
    updatedBy: (0, pg_core_1.uuid)('updated_by')
        .notNull()
        .references(() => exports.users.id),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
    uniqAlbumDate: (0, pg_core_1.uniqueIndex)('day_labels_album_date_uniq').on(t.albumId, t.date),
}));
exports.invites = (0, pg_core_1.pgTable)('invites', {
    id: (0, pg_core_1.uuid)('id').primaryKey().default((0, drizzle_orm_1.sql) `uuid_generate_v4()`),
    albumId: (0, pg_core_1.uuid)('album_id')
        .notNull()
        .references(() => exports.albums.id, { onDelete: 'cascade' }),
    token: (0, pg_core_1.varchar)('token').notNull().unique(),
    createdBy: (0, pg_core_1.uuid)('created_by')
        .notNull()
        .references(() => exports.users.id),
    expiresAt: (0, pg_core_1.timestamp)('expires_at', { withTimezone: true }),
    maxUses: (0, pg_core_1.integer)('max_uses'),
    useCount: (0, pg_core_1.integer)('use_count').notNull().default(0),
});
exports.presignTokens = (0, pg_core_1.pgTable)('presign_tokens', {
    key: (0, pg_core_1.text)('key').primaryKey(),
    userId: (0, pg_core_1.uuid)('user_id')
        .notNull()
        .references(() => exports.users.id, { onDelete: 'cascade' }),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow(),
});
//# sourceMappingURL=schema.js.map