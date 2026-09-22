-- Reverting removes competition prizes' provenance link but NOT the prizes:
-- the collectibles stay in their owners' collections.
DROP TABLE IF EXISTS competition_results;
DROP FUNCTION IF EXISTS protect_competition_result();

DROP INDEX IF EXISTS uq_collectibles_competition_earner;
ALTER TABLE collectibles DROP CONSTRAINT IF EXISTS ck_collectibles_single_source;
ALTER TABLE collectibles DROP COLUMN IF EXISTS source_competition_id;

DROP TABLE IF EXISTS competition_participants;
DROP FUNCTION IF EXISTS enforce_competition_participant_limit();

DROP TABLE IF EXISTS competitions;
DROP FUNCTION IF EXISTS protect_finalized_competition();
