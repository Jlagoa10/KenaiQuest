-- Restores the position-only check. Fails if a result stored under the
-- participant-count rule (e.g. a 2-participant winner with Incomum) exists.
ALTER TABLE competition_results DROP CONSTRAINT IF EXISTS ck_competition_results_rarity;

ALTER TABLE competition_results
  ADD CONSTRAINT ck_competition_results_rarity CHECK (
    reward_rarity IS NULL OR
    reward_rarity = (ARRAY['LEGENDARY', 'EPIC', 'RARE', 'UNCOMMON', 'COMMON']::rarity[])[position]
  );
