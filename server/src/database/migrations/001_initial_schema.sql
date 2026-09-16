-- ============================================================================
-- Kenai Quest — initial schema
--
-- Written in portable PostgreSQL so the same file runs against a local
-- PostgreSQL 14+ instance and against Supabase's hosted PostgreSQL without
-- modification. No Supabase-specific extensions, schemas or auth hooks are
-- used: the application owns its `users` table and its own authentication.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ---------------------------------------------------------------------------
-- Enumerated domains. Keeping these as real enums means the database rejects
-- an invalid value even if application code is bypassed.
-- Mirrored in shared/src/constants/*.ts — change both together.
-- ---------------------------------------------------------------------------
CREATE TYPE user_role AS ENUM ('USER', 'ADMIN');
CREATE TYPE theme_preference AS ENUM ('light', 'dark', 'system');
CREATE TYPE rarity AS ENUM ('COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY');
CREATE TYPE goal_status AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE goal_day_status AS ENUM ('PENDING', 'COMPLETED', 'MISSED');
CREATE TYPE trade_offer_status AS ENUM (
  'PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'SUPERSEDED'
);

-- ---------------------------------------------------------------------------
-- Shared trigger: keeps updated_at honest without relying on the application.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 60),
  email            citext NOT NULL UNIQUE CHECK (char_length(email) <= 254),
  password_hash    text NOT NULL,
  role             user_role NOT NULL DEFAULT 'USER',
  -- IANA timezone name. Daily completion windows are evaluated against this.
  timezone         text NOT NULL DEFAULT 'America/Sao_Paulo'
                     CHECK (char_length(timezone) BETWEEN 1 AND 64),
  theme_preference theme_preference NOT NULL DEFAULT 'system',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_role ON users (role);
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- refresh_tokens
-- Only the SHA-256 hash is stored, so a database leak cannot be replayed.
-- `family_id` groups a rotation chain: reusing a rotated token revokes the
-- whole family, which is the standard detection for a stolen refresh token.
-- ---------------------------------------------------------------------------
CREATE TABLE refresh_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,
  family_id   uuid NOT NULL,
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id);
CREATE INDEX idx_refresh_tokens_family ON refresh_tokens (family_id);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens (expires_at);

-- ---------------------------------------------------------------------------
-- artworks
-- The binary lives in object storage (Supabase Storage in production, local
-- disk in development). Only the bucket + path are persisted here, which is
-- what keeps the storage backend swappable by configuration.
-- ---------------------------------------------------------------------------
CREATE TABLE artworks (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 80),
  description    text CHECK (description IS NULL OR char_length(description) <= 500),
  rarity         rarity NOT NULL,
  storage_bucket text NOT NULL,
  storage_path   text NOT NULL,
  width          integer NOT NULL CHECK (width > 0),
  height         integer NOT NULL CHECK (height > 0),
  mime_type      text NOT NULL,
  byte_size      integer NOT NULL CHECK (byte_size > 0),
  is_active      boolean NOT NULL DEFAULT true,
  created_by     uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_artworks_storage UNIQUE (storage_bucket, storage_path)
);

-- The reward engine's hot path: active artworks of a given rarity.
CREATE INDEX idx_artworks_rarity_active ON artworks (rarity) WHERE is_active;
CREATE TRIGGER trg_artworks_updated_at
  BEFORE UPDATE ON artworks FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- reward_rules / reward_rule_weights
-- Duration-to-rarity configuration lives in data, never in code, so an admin
-- can retune drop rates without a deployment.
-- ---------------------------------------------------------------------------
CREATE TABLE reward_rules (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 80),
  min_days   integer NOT NULL CHECK (min_days BETWEEN 7 AND 365),
  max_days   integer NOT NULL CHECK (max_days BETWEEN 7 AND 365),
  -- Overlapping ranges are allowed on purpose; the highest priority wins, which
  -- lets an admin layer a narrow override (365-365) over a broad rule.
  priority   integer NOT NULL DEFAULT 0 CHECK (priority BETWEEN 0 AND 1000),
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_reward_rules_range CHECK (min_days <= max_days)
);

CREATE INDEX idx_reward_rules_lookup ON reward_rules (min_days, max_days, priority DESC)
  WHERE is_active;
CREATE TRIGGER trg_reward_rules_updated_at
  BEFORE UPDATE ON reward_rules FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE reward_rule_weights (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES reward_rules (id) ON DELETE CASCADE,
  rarity  rarity NOT NULL,
  -- Relative weight, normalised at draw time. Not a percentage.
  weight  numeric(10, 2) NOT NULL CHECK (weight >= 0),
  CONSTRAINT uq_reward_rule_weights UNIQUE (rule_id, rarity)
);

CREATE INDEX idx_reward_rule_weights_rule ON reward_rule_weights (rule_id);

-- ---------------------------------------------------------------------------
-- goals
-- artwork_id is ON DELETE RESTRICT: an artwork that has been assigned can never
-- be hard-deleted out from under a user's goal or collectible.
-- ---------------------------------------------------------------------------
CREATE TABLE goals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title         text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 80),
  description   text CHECK (description IS NULL OR char_length(description) <= 500),
  status        goal_status NOT NULL DEFAULT 'ACTIVE',
  duration_days integer NOT NULL CHECK (duration_days BETWEEN 7 AND 365),
  start_date    date NOT NULL,
  end_date      date NOT NULL,
  artwork_id    uuid NOT NULL REFERENCES artworks (id) ON DELETE RESTRICT,
  total_pieces  integer NOT NULL CHECK (total_pieces > 0),
  finalized_at  timestamptz,
  cancelled_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_goals_dates CHECK (end_date >= start_date),
  -- One piece per goal day, always.
  CONSTRAINT ck_goals_pieces CHECK (total_pieces = duration_days)
);

CREATE INDEX idx_goals_user_status ON goals (user_id, status);
CREATE INDEX idx_goals_artwork ON goals (artwork_id);
-- Supports the background sweep that resolves stale days.
CREATE INDEX idx_goals_active_end_date ON goals (end_date) WHERE status = 'ACTIVE';
CREATE TRIGGER trg_goals_updated_at
  BEFORE UPDATE ON goals FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Backstop for the "max 3 active goals" rule. The service layer already
-- serialises creation with an advisory lock; this trigger guarantees the
-- invariant even for direct SQL access or a future code path that forgets.
CREATE OR REPLACE FUNCTION enforce_active_goal_limit()
RETURNS TRIGGER AS $$
DECLARE
  active_count integer;
BEGIN
  IF NEW.status <> 'ACTIVE' THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO active_count
  FROM goals
  WHERE user_id = NEW.user_id
    AND status = 'ACTIVE'
    AND id <> NEW.id;

  IF active_count >= 3 THEN
    RAISE EXCEPTION 'ACTIVE_GOAL_LIMIT_REACHED'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_goals_active_limit
  BEFORE INSERT OR UPDATE OF status, user_id ON goals
  FOR EACH ROW EXECUTE FUNCTION enforce_active_goal_limit();

-- ---------------------------------------------------------------------------
-- goal_days
-- The authoritative history. There is deliberately no editable "progress"
-- counter anywhere: every number the product shows is derived from these rows.
-- ---------------------------------------------------------------------------
CREATE TABLE goal_days (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id      uuid NOT NULL REFERENCES goals (id) ON DELETE CASCADE,
  day_number   integer NOT NULL CHECK (day_number >= 1),
  day_date     date NOT NULL,
  -- Which region of the artwork this day reveals. The permutation is generated
  -- once at goal creation and never regenerated.
  piece_index  integer NOT NULL CHECK (piece_index >= 0),
  status       goal_day_status NOT NULL DEFAULT 'PENDING',
  completed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_goal_days_number UNIQUE (goal_id, day_number),
  CONSTRAINT uq_goal_days_date UNIQUE (goal_id, day_date),
  CONSTRAINT uq_goal_days_piece UNIQUE (goal_id, piece_index),
  CONSTRAINT ck_goal_days_completed_at
    CHECK ((status = 'COMPLETED') = (completed_at IS NOT NULL))
);

CREATE INDEX idx_goal_days_goal_status ON goal_days (goal_id, status);
CREATE INDEX idx_goal_days_pending ON goal_days (day_date) WHERE status = 'PENDING';
CREATE TRIGGER trg_goal_days_updated_at
  BEFORE UPDATE ON goal_days FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- collectibles
-- One row per earned copy. Duplicates are never merged: two copies of the same
-- artwork are two independent rows with their own completion and trade state.
--
-- source_goal_id is UNIQUE, which is what makes goal finalisation idempotent —
-- two concurrent requests cannot mint the same reward twice.
--
-- owned_piece_indexes is a frozen snapshot taken at finalisation. goal_days
-- remains the authoritative history, but a finished goal's days are immutable,
-- so the snapshot cannot drift, and it lets the image compositor and the
-- gallery filters run without joining back to the goal.
-- ---------------------------------------------------------------------------
CREATE TABLE collectibles (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id            uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  earned_by_user_id   uuid REFERENCES users (id) ON DELETE SET NULL,
  artwork_id          uuid NOT NULL REFERENCES artworks (id) ON DELETE RESTRICT,
  source_goal_id      uuid UNIQUE REFERENCES goals (id) ON DELETE SET NULL,
  -- Snapshot: the goal title at the moment the copy was earned.
  goal_title          text NOT NULL,
  total_pieces        integer NOT NULL CHECK (total_pieces > 0),
  pieces_obtained     integer NOT NULL CHECK (pieces_obtained >= 0),
  owned_piece_indexes integer[] NOT NULL DEFAULT '{}',
  completion_percent  numeric(5, 2) NOT NULL
    GENERATED ALWAYS AS (round(pieces_obtained::numeric * 100 / total_pieces, 2)) STORED,
  is_perfect          boolean NOT NULL
    GENERATED ALWAYS AS (pieces_obtained >= total_pieces) STORED,
  is_listed_for_trade boolean NOT NULL DEFAULT false,
  obtained_at         timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_collectibles_pieces CHECK (pieces_obtained <= total_pieces),
  CONSTRAINT ck_collectibles_snapshot
    CHECK (array_length(owned_piece_indexes, 1) IS NOT DISTINCT FROM
           NULLIF(pieces_obtained, 0))
);

CREATE INDEX idx_collectibles_owner ON collectibles (owner_id, obtained_at DESC);
CREATE INDEX idx_collectibles_artwork ON collectibles (artwork_id);
CREATE INDEX idx_collectibles_listed ON collectibles (owner_id) WHERE is_listed_for_trade;
-- Trade browsing: tradable copies currently on offer. The predicate is the same
-- integer comparison the application uses, so the two can never disagree.
CREATE INDEX idx_collectibles_tradable ON collectibles (obtained_at DESC)
  WHERE is_listed_for_trade AND pieces_obtained * 100 >= 90 * total_pieces;
CREATE TRIGGER trg_collectibles_updated_at
  BEFORE UPDATE ON collectibles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- trade_offers
-- A collectible-for-collectible proposal. No currency of any kind exists in
-- this schema by design.
-- ---------------------------------------------------------------------------
CREATE TABLE trade_offers (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offerer_id               uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  receiver_id              uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  offered_collectible_id   uuid NOT NULL REFERENCES collectibles (id) ON DELETE CASCADE,
  requested_collectible_id uuid NOT NULL REFERENCES collectibles (id) ON DELETE CASCADE,
  status                   trade_offer_status NOT NULL DEFAULT 'PENDING',
  message                  text CHECK (message IS NULL OR char_length(message) <= 280),
  created_at               timestamptz NOT NULL DEFAULT now(),
  resolved_at              timestamptz,
  CONSTRAINT ck_trade_offers_distinct_items
    CHECK (offered_collectible_id <> requested_collectible_id),
  CONSTRAINT ck_trade_offers_distinct_users CHECK (offerer_id <> receiver_id),
  CONSTRAINT ck_trade_offers_resolved
    CHECK ((status = 'PENDING') = (resolved_at IS NULL))
);

-- A user cannot spam the same proposal twice while one is still open.
CREATE UNIQUE INDEX uq_trade_offers_pending
  ON trade_offers (offerer_id, offered_collectible_id, requested_collectible_id)
  WHERE status = 'PENDING';
CREATE INDEX idx_trade_offers_receiver ON trade_offers (receiver_id, status, created_at DESC);
CREATE INDEX idx_trade_offers_offerer ON trade_offers (offerer_id, status, created_at DESC);
CREATE INDEX idx_trade_offers_offered ON trade_offers (offered_collectible_id)
  WHERE status = 'PENDING';
CREATE INDEX idx_trade_offers_requested ON trade_offers (requested_collectible_id)
  WHERE status = 'PENDING';

-- ---------------------------------------------------------------------------
-- trades — immutable record of an executed swap.
-- ---------------------------------------------------------------------------
CREATE TABLE trades (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id       uuid NOT NULL UNIQUE REFERENCES trade_offers (id) ON DELETE RESTRICT,
  user_a_id      uuid REFERENCES users (id) ON DELETE SET NULL,
  user_b_id      uuid REFERENCES users (id) ON DELETE SET NULL,
  collectible_a_id uuid REFERENCES collectibles (id) ON DELETE SET NULL,
  collectible_b_id uuid REFERENCES collectibles (id) ON DELETE SET NULL,
  executed_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_trades_user_a ON trades (user_a_id, executed_at DESC);
CREATE INDEX idx_trades_user_b ON trades (user_b_id, executed_at DESC);
