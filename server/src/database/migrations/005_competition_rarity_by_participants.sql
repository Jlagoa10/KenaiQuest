-- ============================================================================
-- Competition prize rarity depends on the number of participants.
--
-- Last place always earns Comum and each position above it one rarity more,
-- so only a full competition (5) reaches Lendária:
--
--   2 participants  Incomum, Comum
--   3 participants  Rara, Incomum, Comum
--   4 participants  Épica, Rara, Incomum, Comum
--   5 participants  Lendária, Épica, Rara, Incomum, Comum
--
-- The rule lives in @kenai/shared (competitionRewardRarities). The old check
-- pinned the rarity to the position alone (1 Lendária … 5 Comum), which the
-- new rule breaks. A row check cannot see how many participants there were,
-- so the backstop keeps what still holds for every size: a position never
-- earns more than its rarity in a full competition.
-- ============================================================================

ALTER TABLE competition_results DROP CONSTRAINT ck_competition_results_rarity;

ALTER TABLE competition_results
  ADD CONSTRAINT ck_competition_results_rarity CHECK (
    reward_rarity IS NULL OR
    array_position(
      ARRAY['LEGENDARY', 'EPIC', 'RARE', 'UNCOMMON', 'COMMON']::rarity[],
      reward_rarity
    ) >= position
  );
