-- ============================================================================
-- Default reward configuration.
--
-- This is system configuration, not development fixture data, so it ships as a
-- migration: a fresh production database is able to award rewards immediately.
-- Every value here is editable from the admin panel afterwards without a
-- deployment (spec sections 28 and 45).
--
-- Weights are RELATIVE, not percentages. The engine normalises them against
-- their own total, and drops any rarity whose active artwork pool is empty
-- before drawing, so a partially stocked catalogue still works.
-- ============================================================================

WITH new_rules AS (
  INSERT INTO reward_rules (name, min_days, max_days, priority, is_active)
  VALUES
    ('Metas curtas',        7,   14,  10, true),
    ('Metas de duas a quatro semanas', 15,  30,  10, true),
    ('Metas de um a dois meses',       31,  60,  10, true),
    ('Metas de dois a quatro meses',   61, 120,  10, true),
    ('Metas longas',        121, 364,  10, true),
    ('Desafio de um ano',   365, 365, 100, true)
  RETURNING id, min_days
)
INSERT INTO reward_rule_weights (rule_id, rarity, weight)
SELECT new_rules.id, weights.rarity::rarity, weights.weight
FROM new_rules
JOIN (
  VALUES
    -- 7-14 days: mostly Comum, with a small chance of Incomum.
    (7,   'COMMON',    85.0),
    (7,   'UNCOMMON',  15.0),
    -- 15-30 days: Comum / Incomum.
    (15,  'COMMON',    55.0),
    (15,  'UNCOMMON',  40.0),
    (15,  'RARE',       5.0),
    -- 31-60 days: Incomum / Rara.
    (31,  'UNCOMMON',  65.0),
    (31,  'RARE',      30.0),
    (31,  'EPIC',       5.0),
    -- 61-120 days: Rara / Épica.
    (61,  'UNCOMMON',  15.0),
    (61,  'RARE',      60.0),
    (61,  'EPIC',      25.0),
    -- 121-364 days: primarily Épica, with a real shot at Lendária.
    (121, 'RARE',      20.0),
    (121, 'EPIC',      70.0),
    (121, 'LEGENDARY', 10.0),
    -- 365 days: Lendária guaranteed (spec section 29).
    (365, 'LEGENDARY', 100.0)
) AS weights (min_days, rarity, weight)
  ON weights.min_days = new_rules.min_days;
