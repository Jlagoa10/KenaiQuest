DELETE FROM reward_rule_weights
WHERE rule_id IN (
  SELECT id FROM reward_rules
  WHERE name IN (
    'Metas curtas',
    'Metas de duas a quatro semanas',
    'Metas de um a dois meses',
    'Metas de dois a quatro meses',
    'Metas longas',
    'Desafio de um ano'
  )
);

DELETE FROM reward_rules
WHERE name IN (
  'Metas curtas',
  'Metas de duas a quatro semanas',
  'Metas de um a dois meses',
  'Metas de dois a quatro meses',
  'Metas longas',
  'Desafio de um ano'
);
