CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE member_role AS ENUM ('admin', 'member');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  apple_sub VARCHAR UNIQUE,
  google_sub VARCHAR UNIQUE,
  display_name VARCHAR NOT NULL,
  avatar_url TEXT,
  apns_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE albums (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR NOT NULL,
  child_birthdate DATE,
  cover_photo_id UUID,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE album_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  role member_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(album_id, user_id)
);

CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  r2_key TEXT NOT NULL,
  thumbnail_key TEXT,
  taken_at TIMESTAMPTZ NOT NULL,
  caption TEXT,
  local_asset_id VARCHAR,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id),
  title VARCHAR NOT NULL,
  note TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  cover_photo_id UUID REFERENCES photos(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  token VARCHAR NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES users(id),
  expires_at TIMESTAMPTZ,
  max_uses INT,
  use_count INT NOT NULL DEFAULT 0
);

ALTER TABLE albums
  ADD CONSTRAINT fk_cover_photo FOREIGN KEY (cover_photo_id) REFERENCES photos(id) ON DELETE SET NULL;

CREATE INDEX idx_photos_album_taken_at ON photos(album_id, taken_at DESC);
CREATE INDEX idx_milestones_album_occurred_at ON milestones(album_id, occurred_at DESC);
CREATE INDEX idx_photos_local_asset ON photos(album_id, local_asset_id) WHERE local_asset_id IS NOT NULL;
