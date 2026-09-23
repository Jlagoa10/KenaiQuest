-- ============================================================================
-- Competições.
--
-- Up to five people compete on their REAL goal progress over a date window.
-- There is deliberately no progress or score column that a request could
-- write: the live ranking is derived from `goal_days` on every read, exactly
-- like goal progress. Only the FINAL result is stored, once, when the
-- competition is locked — and from then on the database refuses to change it.
--
-- Rewards are ordinary rows in `collectibles` (the same table, artwork pool and
-- rarity enum the goals use), so a prize lives in the winner's collection
-- independently of the competition that produced it.
--
-- Rules mirrored in shared/src/constants/competitions.ts — change both together.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- competitions
-- `timezone` is the creator's timezone at creation. It decides when the
-- competition starts (and therefore when joining closes), so the start does
-- not wander if the creator later changes their profile.
-- ---------------------------------------------------------------------------
CREATE TABLE competitions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 3 AND 60),
  -- SET NULL: the creator leaving the product must not erase everyone else's result.
  creator_id   uuid REFERENCES users (id) ON DELETE SET NULL,
  start_date   date NOT NULL,
  end_date     date NOT NULL,
  timezone     text NOT NULL CHECK (char_length(timezone) BETWEEN 1 AND 64),
  invite_code  text NOT NULL UNIQUE
                 CHECK (invite_code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$'),
  finalized_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  -- Same bounds as a goal: 7 to 365 days, inclusive.
  CONSTRAINT ck_competitions_duration CHECK (end_date - start_date + 1 BETWEEN 7 AND 365)
);

CREATE INDEX idx_competitions_creator ON competitions (creator_id);
-- The sweep that locks finished competitions only looks at unlocked ones.
CREATE INDEX idx_competitions_open_end_date ON competitions (end_date) WHERE finalized_at IS NULL;
CREATE TRIGGER trg_competitions_updated_at
  BEFORE UPDATE ON competitions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Once locked, a competition's window and lock time can never move again.
CREATE OR REPLACE FUNCTION protect_finalized_competition()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.finalized_at IS NOT NULL AND (
       NEW.finalized_at IS DISTINCT FROM OLD.finalized_at
    OR NEW.start_date <> OLD.start_date
    OR NEW.end_date <> OLD.end_date
  ) THEN
    RAISE EXCEPTION 'COMPETITION_FINALIZED' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_competitions_protect_finalized
  BEFORE UPDATE ON competitions
  FOR EACH ROW EXECUTE FUNCTION protect_finalized_competition();

-- ---------------------------------------------------------------------------
-- competition_participants
-- The primary key is what makes joining twice impossible.
-- ---------------------------------------------------------------------------
CREATE TABLE competition_participants (
  competition_id uuid NOT NULL REFERENCES competitions (id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  joined_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (competition_id, user_id)
);

CREATE INDEX idx_competition_participants_user ON competition_participants (user_id, joined_at DESC);

-- Backstop for the five-participant cap. The service already serialises joins
-- by locking the competition row; this trigger takes the same lock, so the cap
-- holds even for direct SQL access or two concurrent joins.
CREATE OR REPLACE FUNCTION enforce_competition_participant_limit()
RETURNS TRIGGER AS $$
DECLARE
  locked_finalized_at timestamptz;
  participant_count   integer;
BEGIN
  SELECT finalized_at INTO locked_finalized_at
  FROM competitions WHERE id = NEW.competition_id
  FOR UPDATE;

  IF locked_finalized_at IS NOT NULL THEN
    RAISE EXCEPTION 'COMPETITION_FINALIZED' USING ERRCODE = 'check_violation';
  END IF;

  SELECT count(*) INTO participant_count
  FROM competition_participants
  WHERE competition_id = NEW.competition_id;

  IF participant_count >= 5 THEN
    RAISE EXCEPTION 'COMPETITION_FULL' USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_competition_participants_limit
  BEFORE INSERT OR UPDATE OF competition_id ON competition_participants
  FOR EACH ROW EXECUTE FUNCTION enforce_competition_participant_limit();

-- ---------------------------------------------------------------------------
-- collectibles: a copy can now come from a competition instead of a goal.
--
-- The partial unique index is the database-level guarantee that one person
-- never receives two prizes from the same competition, whatever the code does.
-- ---------------------------------------------------------------------------
ALTER TABLE collectibles
  ADD COLUMN source_competition_id uuid REFERENCES competitions (id) ON DELETE SET NULL;

ALTER TABLE collectibles
  ADD CONSTRAINT ck_collectibles_single_source
    CHECK (source_goal_id IS NULL OR source_competition_id IS NULL);

CREATE UNIQUE INDEX uq_collectibles_competition_earner
  ON collectibles (source_competition_id, earned_by_user_id)
  WHERE source_competition_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- competition_results — the permanent final ranking and reward assignment.
--
-- Written once, in the transaction that locks the competition. `reward_rarity`
-- is fixed at that moment; the Kenai itself is minted in the same transaction,
-- or on a later access if that rarity had no active artwork yet (rewarded_at
-- stays NULL until then). `rewarded_at` is the idempotency marker: once set it
-- can never be cleared, so a prize is minted at most once even if the
-- collectible is later removed (e.g. its new owner deletes their account).
--
-- ON DELETE RESTRICT on the competition: a finished competition's result cannot
-- be hard-deleted. The prizes would survive anyway — they are collectibles.
-- ---------------------------------------------------------------------------
CREATE TABLE competition_results (
  competition_id     uuid NOT NULL REFERENCES competitions (id) ON DELETE RESTRICT,
  user_id            uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  position           integer NOT NULL CHECK (position BETWEEN 1 AND 5),
  completed_days     integer NOT NULL CHECK (completed_days >= 0),
  scheduled_days     integer NOT NULL,
  score_basis_points integer NOT NULL CHECK (score_basis_points BETWEEN 0 AND 10000),
  -- NULL: this participant earns no Kenai (solo competition or 0% completion).
  reward_rarity      rarity,
  collectible_id     uuid UNIQUE REFERENCES collectibles (id) ON DELETE SET NULL,
  rewarded_at        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (competition_id, user_id),
  CONSTRAINT ck_competition_results_days CHECK (scheduled_days >= completed_days),
  -- The rarity always matches the position: 1 Lendária … 5 Comum.
  CONSTRAINT ck_competition_results_rarity CHECK (
    reward_rarity IS NULL OR
    reward_rarity = (ARRAY['LEGENDARY', 'EPIC', 'RARE', 'UNCOMMON', 'COMMON']::rarity[])[position]
  ),
  CONSTRAINT ck_competition_results_rewarded CHECK (reward_rarity IS NOT NULL OR rewarded_at IS NULL),
  CONSTRAINT ck_competition_results_collectible CHECK (collectible_id IS NULL OR rewarded_at IS NOT NULL)
);

CREATE INDEX idx_competition_results_user ON competition_results (user_id);
-- Prizes still waiting for an artwork of their rarity.
CREATE INDEX idx_competition_results_pending_reward ON competition_results (competition_id)
  WHERE reward_rarity IS NOT NULL AND rewarded_at IS NULL;

-- The final ranking is immutable. The only permitted changes are recording the
-- minted prize once, and the FK clearing collectible_id if that row is removed.
CREATE OR REPLACE FUNCTION protect_competition_result()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.competition_id <> OLD.competition_id
     OR NEW.user_id <> OLD.user_id
     OR NEW.position <> OLD.position
     OR NEW.completed_days <> OLD.completed_days
     OR NEW.scheduled_days <> OLD.scheduled_days
     OR NEW.score_basis_points <> OLD.score_basis_points
     OR NEW.reward_rarity IS DISTINCT FROM OLD.reward_rarity
     OR (OLD.rewarded_at IS NOT NULL AND NEW.rewarded_at IS DISTINCT FROM OLD.rewarded_at)
     OR (OLD.collectible_id IS NOT NULL AND NEW.collectible_id IS NOT NULL
         AND NEW.collectible_id <> OLD.collectible_id)
  THEN
    RAISE EXCEPTION 'COMPETITION_RESULT_IMMUTABLE' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_competition_results_immutable
  BEFORE UPDATE ON competition_results
  FOR EACH ROW EXECUTE FUNCTION protect_competition_result();
