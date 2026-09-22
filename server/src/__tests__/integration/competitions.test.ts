import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { CompetitionDetailDto, Rarity } from '@kenai/shared';
import { MAX_COMPETITION_PARTICIPANTS } from '@kenai/shared';
import {
  authedUser,
  closeTestPool,
  forceCompleteDays,
  getApp,
  hasTestDatabase,
  migrateTestDatabase,
  resetDatabase,
  seedArtwork,
  seedArtworkForEveryRarity,
  shiftGoalBackByDays,
} from '../helpers.js';
import { pool } from '../../database/pool.js';
import { resolveAllCompetitions } from '../../services/competitionService.js';

const suite = hasTestDatabase ? describe : describe.skip;

function todayInSaoPaulo(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

type Player = Awaited<ReturnType<typeof authedUser>>;

const auth = (player: Player) => ({ Authorization: `Bearer ${player.token}` });

async function createCompetition(
  creator: Player,
  overrides: Partial<{ name: string; startDate: string; endDate: string }> = {},
): Promise<CompetitionDetailDto> {
  const today = todayInSaoPaulo();
  const response = await request(getApp())
    .post('/api/competitions')
    .set(auth(creator))
    .send({
      name: overrides.name ?? 'Desafio da equipe',
      startDate: overrides.startDate ?? addDays(today, 1),
      endDate: overrides.endDate ?? addDays(today, 7),
    })
    .expect(201);
  return response.body.competition as CompetitionDetailDto;
}

function join(player: Player, code: string) {
  return request(getApp()).post('/api/competitions/join').set(auth(player)).send({ code });
}

async function getDetail(player: Player, id: string): Promise<CompetitionDetailDto> {
  const response = await request(getApp())
    .get(`/api/competitions/${id}`)
    .set(auth(player))
    .expect(200);
  return response.body.competition as CompetitionDetailDto;
}

/** Moves a competition's window, simulating the passage of time (only before it is locked). */
async function setWindow(competitionId: string, startDate: string, endDate: string): Promise<void> {
  await pool.query('UPDATE competitions SET start_date = $2, end_date = $3 WHERE id = $1', [
    competitionId,
    startDate,
    endDate,
  ]);
}

/**
 * Gives `player` a 7-day goal whose days are [today - shift, today - shift + 6],
 * with the listed day numbers (1-based) completed.
 */
async function goalWithCompletedDays(
  player: Player,
  shift: number,
  completedDayNumbers: number[],
): Promise<string> {
  const response = await request(getApp())
    .post('/api/goals')
    .set(auth(player))
    .send({ title: 'Meta da competição', durationDays: 7, startDate: todayInSaoPaulo() })
    .expect(201);
  const goalId = response.body.goal.id as string;
  if (shift > 0) await shiftGoalBackByDays(goalId, shift);
  if (completedDayNumbers.length > 0) await forceCompleteDays(goalId, completedDayNumbers);
  return goalId;
}

/**
 * A finished 7-day competition whose window is [today-10, today-4]: every day
 * is past its grace window, so the next read locks the result.
 */
async function finishedCompetitionWith(
  completedPerPlayer: number[],
): Promise<{ players: Player[]; competition: CompetitionDetailDto }> {
  const players: Player[] = [];
  for (let index = 0; index < completedPerPlayer.length; index += 1) {
    players.push(await authedUser({ name: `Jogador ${index + 1}` }));
  }
  const [creator] = players as [Player, ...Player[]];
  const competition = await createCompetition(creator);
  for (const player of players.slice(1)) {
    await join(player, competition.inviteCode).expect(201);
  }

  const today = todayInSaoPaulo();
  await setWindow(competition.id, addDays(today, -10), addDays(today, -4));
  for (let index = 0; index < players.length; index += 1) {
    const completed = completedPerPlayer[index] ?? 0;
    await goalWithCompletedDays(
      players[index] as Player,
      10,
      Array.from({ length: completed }, (_, day) => day + 1),
    );
  }
  return { players, competition };
}

function rewardsByName(detail: CompetitionDetailDto): Record<string, [number, Rarity | null]> {
  return Object.fromEntries(
    detail.ranking.map((entry) => [entry.name, [entry.position, entry.rewardRarity]]),
  );
}

suite('Competições', () => {
  beforeAll(async () => {
    await migrateTestDatabase();
  });

  afterAll(async () => {
    await closeTestPool();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  describe('autenticação e validação', () => {
    it('exige autenticação em todas as rotas', async () => {
      await request(getApp()).get('/api/competitions').expect(401);
      await request(getApp()).post('/api/competitions').send({}).expect(401);
      await request(getApp()).post('/api/competitions/join').send({ code: 'ABCDEFGH' }).expect(401);
      await request(getApp()).get('/api/competitions/invite/ABCDEFGH').expect(401);
    });

    it('valida nome, datas e duração no backend', async () => {
      const creator = await authedUser();
      const today = todayInSaoPaulo();
      const post = (body: object) =>
        request(getApp()).post('/api/competitions').set(auth(creator)).send(body);

      await post({ name: 'x', startDate: addDays(today, 1), endDate: addDays(today, 8) }).expect(400);
      // Starting today would close joining immediately.
      const startsToday = await post({ name: 'Desafio', startDate: today, endDate: addDays(today, 7) });
      expect(startsToday.status).toBe(400);
      expect(startsToday.body.error.code).toBe('INVALID_COMPETITION_DATES');
      await post({ name: 'Desafio', startDate: addDays(today, 5), endDate: addDays(today, 1) }).expect(400);
      await post({ name: 'Desafio', startDate: addDays(today, 1), endDate: addDays(today, 6) }).expect(400);
      await post({ name: 'Desafio', startDate: addDays(today, 1), endDate: addDays(today, 366) }).expect(400);
      await post({ name: 'Desafio', startDate: 'amanhã', endDate: addDays(today, 8) }).expect(400);
    });
  });

  describe('criação', () => {
    it('cria a competição com o criador como primeiro participante e um código de convite', async () => {
      const creator = await authedUser({ name: 'Joana Criadora' });
      const competition = await createCompetition(creator);

      expect(competition.status).toBe('UPCOMING');
      expect(competition.isCreator).toBe(true);
      expect(competition.participantCount).toBe(1);
      expect(competition.maxParticipants).toBe(MAX_COMPETITION_PARTICIPANTS);
      expect(competition.participants).toEqual([
        expect.objectContaining({ userId: creator.user.id, isCreator: true, isMe: true }),
      ]);
      expect(competition.inviteCode).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
      expect(competition.acceptingParticipants).toBe(true);
      expect(competition.durationDays).toBe(7);
      // Nothing to rank before the start.
      expect(competition.ranking).toEqual([]);
    });

    it('ignora campos que o cliente não pode definir', async () => {
      const creator = await authedUser();
      const today = todayInSaoPaulo();
      const response = await request(getApp())
        .post('/api/competitions')
        .set(auth(creator))
        .send({
          name: 'Desafio',
          startDate: addDays(today, 1),
          endDate: addDays(today, 7),
          inviteCode: 'AAAAAAAA',
          finalizedAt: new Date().toISOString(),
          ranking: [{ userId: creator.user.id, position: 1, scorePercent: 100 }],
        })
        .expect(201);

      expect(response.body.competition.inviteCode).not.toBe('AAAAAAAA');
      expect(response.body.competition.finalizedAt).toBeNull();
      expect(response.body.competition.status).toBe('UPCOMING');
    });

    it('gera códigos de convite únicos', async () => {
      const creator = await authedUser();
      const codes = new Set<string>();
      for (let index = 0; index < 10; index += 1) {
        codes.add((await createCompetition(creator)).inviteCode);
      }
      expect(codes.size).toBe(10);
    });

    it('lista apenas as competições de que o usuário participa', async () => {
      const alice = await authedUser();
      const bruno = await authedUser();
      const mine = await createCompetition(alice, { name: 'Da Alice' });
      await createCompetition(bruno, { name: 'Do Bruno' });

      const response = await request(getApp()).get('/api/competitions').set(auth(alice)).expect(200);
      expect(response.body.competitions.map((item: { id: string }) => item.id)).toEqual([mine.id]);
    });
  });

  describe('convites e entrada', () => {
    it('mostra o convite e permite entrar pelo código, inclusive digitado em minúsculas', async () => {
      const creator = await authedUser({ name: 'Criadora' });
      const guest = await authedUser({ name: 'Convidado' });
      const competition = await createCompetition(creator);

      const preview = await request(getApp())
        .get(`/api/competitions/invite/${competition.inviteCode}`)
        .set(auth(guest))
        .expect(200);
      expect(preview.body.invite).toMatchObject({
        id: competition.id,
        status: 'UPCOMING',
        canJoin: true,
        isParticipant: false,
        participantCount: 1,
        creatorName: 'Criadora',
      });
      // The preview never exposes the code holders' private details or a ranking.
      expect(preview.body.invite).not.toHaveProperty('ranking');

      const joined = await join(guest, ` ${competition.inviteCode.toLowerCase()} `).expect(201);
      expect(joined.body.competition.participantCount).toBe(2);
      expect(
        joined.body.competition.participants.map((participant: { name: string }) => participant.name),
      ).toEqual(['Criadora', 'Convidado']);
    });

    it('recusa códigos desconhecidos ou malformados', async () => {
      const guest = await authedUser();
      await join(guest, 'ZZZZZZZZ').expect(404);
      await join(guest, '0000').expect(400);
      await request(getApp()).get('/api/competitions/invite/nao-existe').set(auth(guest)).expect(404);
    });

    it('impede participar duas vezes, inclusive o próprio criador', async () => {
      const creator = await authedUser();
      const guest = await authedUser();
      const competition = await createCompetition(creator);

      await join(guest, competition.inviteCode).expect(201);
      const again = await join(guest, competition.inviteCode).expect(409);
      expect(again.body.error.code).toBe('COMPETITION_ALREADY_JOINED');
      const creatorAgain = await join(creator, competition.inviteCode).expect(409);
      expect(creatorAgain.body.error.code).toBe('COMPETITION_ALREADY_JOINED');

      const rows = await pool.query(
        'SELECT count(*)::int AS total FROM competition_participants WHERE competition_id = $1',
        [competition.id],
      );
      expect(rows.rows[0].total).toBe(2);
    });

    it('limita a competição a 5 participantes', async () => {
      const creator = await authedUser();
      const competition = await createCompetition(creator);
      for (let index = 0; index < 4; index += 1) {
        await join(await authedUser(), competition.inviteCode).expect(201);
      }

      const sixth = await join(await authedUser(), competition.inviteCode).expect(409);
      expect(sixth.body.error.code).toBe('COMPETITION_FULL');

      const detail = await getDetail(creator, competition.id);
      expect(detail.participantCount).toBe(5);
      expect(detail.acceptingParticipants).toBe(false);
    });

    it('mantém o limite de 5 mesmo com entradas simultâneas', async () => {
      const creator = await authedUser();
      const competition = await createCompetition(creator);
      const guests = await Promise.all(Array.from({ length: 8 }, () => authedUser()));

      const responses = await Promise.all(guests.map((guest) => join(guest, competition.inviteCode)));
      expect(responses.filter((response) => response.status === 201)).toHaveLength(4);
      expect(responses.filter((response) => response.status === 409)).toHaveLength(4);

      const rows = await pool.query(
        'SELECT count(*)::int AS total FROM competition_participants WHERE competition_id = $1',
        [competition.id],
      );
      expect(rows.rows[0].total).toBe(5);
    });

    it('o banco recusa um sexto participante mesmo por SQL direto', async () => {
      const creator = await authedUser();
      const competition = await createCompetition(creator);
      const guests = await Promise.all(Array.from({ length: 5 }, () => authedUser()));
      for (const guest of guests.slice(0, 4)) await join(guest, competition.inviteCode).expect(201);

      await expect(
        pool.query('INSERT INTO competition_participants (competition_id, user_id) VALUES ($1, $2)', [
          competition.id,
          guests[4]?.user.id,
        ]),
      ).rejects.toThrow(/COMPETITION_FULL/);
    });

    it('só permite entrar antes do início', async () => {
      const creator = await authedUser();
      const late = await authedUser();
      const competition = await createCompetition(creator);
      const today = todayInSaoPaulo();
      await setWindow(competition.id, today, addDays(today, 6));

      const response = await join(late, competition.inviteCode).expect(409);
      expect(response.body.error.code).toBe('COMPETITION_NOT_JOINABLE');

      const preview = await request(getApp())
        .get(`/api/competitions/invite/${competition.inviteCode}`)
        .set(auth(late))
        .expect(200);
      expect(preview.body.invite.canJoin).toBe(false);
      expect(preview.body.invite.status).toBe('ACTIVE');
      expect(preview.body.invite.joinBlockedReason).toMatch(/já começou/);
    });

    it('esconde os detalhes de quem não participa', async () => {
      const creator = await authedUser();
      const outsider = await authedUser();
      const competition = await createCompetition(creator);
      await request(getApp())
        .get(`/api/competitions/${competition.id}`)
        .set(auth(outsider))
        .expect(403);
      await request(getApp()).get('/api/competitions/nao-e-uuid').set(auth(outsider)).expect(400);
    });
  });

  describe('ranking ao vivo', () => {
    it('calcula a pontuação a partir dos dias reais das metas, com empates', async () => {
      await seedArtworkForEveryRarity();
      const joao = await authedUser({ name: 'João' });
      const lucas = await authedUser({ name: 'Lucas' });
      const maria = await authedUser({ name: 'Maria' });
      const pedro = await authedUser({ name: 'Pedro' });

      const competition = await createCompetition(joao);
      for (const player of [lucas, maria, pedro]) await join(player, competition.inviteCode).expect(201);

      // Window [today-5, today+1]: days 1–4 of each goal are decided, day 5 is
      // "Ontem", day 6 is "Hoje", day 7 is tomorrow.
      const today = todayInSaoPaulo();
      await setWindow(competition.id, addDays(today, -5), addDays(today, 1));
      await goalWithCompletedDays(joao, 5, [1, 2, 3, 4]);
      await goalWithCompletedDays(lucas, 5, [1, 2, 3]);
      await goalWithCompletedDays(maria, 5, [2, 3, 4]);
      const pedroGoal = await goalWithCompletedDays(pedro, 5, []);

      const detail = await getDetail(pedro, competition.id);
      expect(detail.status).toBe('ACTIVE');
      expect(detail.rankingIsFinal).toBe(false);
      expect(detail.ranking.map((entry) => [entry.name, entry.position, entry.scorePercent])).toEqual([
        ['João', 1, 100],
        ['Lucas', 2, 75],
        ['Maria', 2, 75],
        ['Pedro', 4, 0],
      ]);
      expect(rewardsByName(detail)).toEqual({
        João: [1, 'LEGENDARY'],
        Lucas: [2, 'EPIC'],
        Maria: [2, 'EPIC'],
        // 0%: the position stands for Incomum, but nothing would be awarded.
        Pedro: [4, null],
      });
      expect(detail.ranking.find((entry) => entry.name === 'Pedro')?.positionRarity).toBe('UNCOMMON');
      expect(detail.myPosition).toBe(4);

      // Pedro marks today through the real goal endpoint: the ranking moves.
      await request(getApp())
        .post(`/api/goals/${pedroGoal}/complete`)
        .set(auth(pedro))
        .send({ target: 'today' })
        .expect(200);

      const updated = await getDetail(pedro, competition.id);
      const pedroRow = updated.ranking.find((entry) => entry.name === 'Pedro');
      expect(pedroRow).toMatchObject({ position: 4, completedDays: 1, scheduledDays: 5, scorePercent: 20 });
      expect(pedroRow?.rewardRarity).toBe('UNCOMMON');

      // Nothing was stored while the competition runs.
      const stored = await pool.query('SELECT count(*)::int AS total FROM competition_results');
      expect(stored.rows[0].total).toBe(0);
    });

    it('não aceita pontuação enviada pelo cliente', async () => {
      const creator = await authedUser();
      const competition = await createCompetition(creator);
      await request(getApp())
        .post(`/api/competitions/${competition.id}/score`)
        .set(auth(creator))
        .send({ scorePercent: 100 })
        .expect(404);
      await request(getApp())
        .patch(`/api/competitions/${competition.id}`)
        .set(auth(creator))
        .send({ ranking: [] })
        .expect(404);
    });

    it('um cancelamento não apaga os dias perdidos antes dele', async () => {
      await seedArtworkForEveryRarity();
      const alice = await authedUser({ name: 'Alice' });
      const bruno = await authedUser({ name: 'Bruno' });
      const competition = await createCompetition(alice);
      await join(bruno, competition.inviteCode).expect(201);

      const today = todayInSaoPaulo();
      await setWindow(competition.id, addDays(today, -5), addDays(today, 1));
      await goalWithCompletedDays(alice, 5, [1, 2]);
      const brunoGoal = await goalWithCompletedDays(bruno, 5, [1, 2]);
      await request(getApp()).delete(`/api/goals/${brunoGoal}`).set(auth(bruno)).expect(204);

      const detail = await getDetail(alice, competition.id);
      // Alice: 2 of the 4 decided days (her "Ontem" can still be claimed).
      // Bruno: his misses stay, and by cancelling he gave up "Ontem" too — 2 of 5.
      expect(detail.ranking.map((entry) => [entry.name, entry.scorePercent, entry.position])).toEqual([
        ['Alice', 50, 1],
        ['Bruno', 40, 2],
      ]);
    });

    it('continua ativa durante a janela de "Ontem" após o término', async () => {
      await seedArtworkForEveryRarity();
      const alice = await authedUser({ name: 'Alice' });
      const bruno = await authedUser({ name: 'Bruno' });
      const competition = await createCompetition(alice);
      await join(bruno, competition.inviteCode).expect(201);

      // The last day was yesterday: it can still be claimed, so nothing is locked yet.
      const today = todayInSaoPaulo();
      await setWindow(competition.id, addDays(today, -7), addDays(today, -1));
      const aliceGoal = await goalWithCompletedDays(alice, 7, [1, 2, 3, 4, 5, 6]);
      // Bruno missed day 6 and has not marked day 7 ("Ontem") — which does not count against him yet.
      await goalWithCompletedDays(bruno, 7, [1, 2, 3, 4, 5]);

      await request(getApp())
        .post(`/api/goals/${aliceGoal}/complete`)
        .set(auth(alice))
        .send({ target: 'yesterday' })
        .expect(200);

      const detail = await getDetail(alice, competition.id);
      expect(detail.status).toBe('ACTIVE');
      expect(detail.finalizedAt).toBeNull();
      expect(detail.resultsDate).toBe(addDays(today, 1));
      expect(detail.ranking.map((entry) => [entry.name, entry.position, entry.scorePercent])).toEqual([
        ['Alice', 1, 100],
        ['Bruno', 2, 83.33],
      ]);
    });
  });

  describe('resultado final e recompensas', () => {
    it('trava o ranking, atribui raridades e entrega as artes na coleção', async () => {
      const artworks = await seedArtworkForEveryRarity();
      // Scores: 7/7, 6/7, 6/7, 4/7, 2/7 → positions 1, 2, 2, 4, 5.
      const { players, competition } = await finishedCompetitionWith([7, 6, 6, 4, 2]);

      const detail = await getDetail(players[0] as Player, competition.id);
      expect(detail.status).toBe('FINISHED');
      expect(detail.rankingIsFinal).toBe(true);
      expect(detail.finalizedAt).not.toBeNull();
      expect(rewardsByName(detail)).toEqual({
        'Jogador 1': [1, 'LEGENDARY'],
        'Jogador 2': [2, 'EPIC'],
        'Jogador 3': [2, 'EPIC'],
        'Jogador 4': [4, 'UNCOMMON'],
        'Jogador 5': [5, 'COMMON'],
      });
      expect(detail.ranking.every((entry) => entry.rewardStatus === 'AWARDED')).toBe(true);

      // Stored permanently, one row per participant.
      const stored = await pool.query(
        'SELECT user_id, position, reward_rarity FROM competition_results WHERE competition_id = $1',
        [competition.id],
      );
      expect(stored.rowCount).toBe(5);

      // Each prize is a complete copy of an artwork of exactly that rarity.
      for (const [index, player] of players.entries()) {
        const collection = await request(getApp())
          .get('/api/collectibles')
          .set(auth(player))
          .expect(200);
        const prizes = collection.body.collectibles.filter(
          (item: { sourceCompetitionId: string | null }) => item.sourceCompetitionId === competition.id,
        );
        expect(prizes).toHaveLength(1);
        const expected = (['LEGENDARY', 'EPIC', 'EPIC', 'UNCOMMON', 'COMMON'] as Rarity[])[index] as Rarity;
        expect(prizes[0].artwork.rarity).toBe(expected);
        expect(prizes[0].artwork.id).toBe(artworks[expected].id);
        expect(prizes[0].isPerfect).toBe(true);
        expect(prizes[0].completionPercent).toBe(100);
        expect(prizes[0].totalPieces).toBe(7);
        expect(prizes[0].goalTitle).toBe(competition.name);
      }

      // Your own row links to your prize; other people's copies stay private.
      const mine = detail.ranking.find((entry) => entry.isMe);
      expect(mine?.collectibleId).toBeDefined();
      expect(detail.ranking.filter((entry) => entry.collectibleId !== undefined)).toHaveLength(1);
    });

    it.each([
      [2, [5, 3], ['LEGENDARY', 'EPIC']],
      [3, [5, 4, 3], ['LEGENDARY', 'EPIC', 'RARE']],
      [4, [7, 5, 3, 1], ['LEGENDARY', 'EPIC', 'RARE', 'UNCOMMON']],
      [5, [7, 6, 5, 4, 3], ['LEGENDARY', 'EPIC', 'RARE', 'UNCOMMON', 'COMMON']],
    ] as Array<[number, number[], Rarity[]]>)(
      'usa apenas as posições disponíveis com %i participantes',
      async (_count, completed, expected) => {
        await seedArtworkForEveryRarity();
        const { players, competition } = await finishedCompetitionWith(completed);
        const detail = await getDetail(players[0] as Player, competition.id);
        expect(detail.ranking.map((entry) => entry.rewardRarity)).toEqual(expected);
        expect(detail.ranking.map((entry) => entry.position)).toEqual(expected.map((_, index) => index + 1));

        const minted = await pool.query(
          `SELECT a.rarity FROM collectibles c JOIN artworks a ON a.id = c.artwork_id
           WHERE c.source_competition_id = $1`,
          [competition.id],
        );
        expect(minted.rows.map((row) => row.rarity).sort()).toEqual([...expected].sort());
      },
    );

    it('participantes empatados recebem a mesma raridade', async () => {
      await seedArtworkForEveryRarity();
      const { players, competition } = await finishedCompetitionWith([5, 5, 3]);
      const detail = await getDetail(players[2] as Player, competition.id);
      expect(rewardsByName(detail)).toEqual({
        'Jogador 1': [1, 'LEGENDARY'],
        'Jogador 2': [1, 'LEGENDARY'],
        'Jogador 3': [3, 'RARE'],
      });

      const minted = await pool.query(
        `SELECT a.rarity, count(*)::int AS total FROM collectibles c
         JOIN artworks a ON a.id = c.artwork_id
         WHERE c.source_competition_id = $1 GROUP BY a.rarity ORDER BY a.rarity`,
        [competition.id],
      );
      expect(minted.rows).toEqual([
        { rarity: 'RARE', total: 1 },
        { rarity: 'LEGENDARY', total: 2 },
      ]);
    });

    it('não recompensa quem ficou com 0% nem uma competição individual', async () => {
      await seedArtworkForEveryRarity();
      const { players, competition } = await finishedCompetitionWith([4, 0]);
      const detail = await getDetail(players[1] as Player, competition.id);
      expect(rewardsByName(detail)).toEqual({ 'Jogador 1': [1, 'LEGENDARY'], 'Jogador 2': [2, null] });
      expect(detail.ranking.find((entry) => entry.isMe)?.rewardStatus).toBe('NONE');

      const solo = await finishedCompetitionWith([7]);
      const soloDetail = await getDetail(solo.players[0] as Player, solo.competition.id);
      expect(soloDetail.status).toBe('FINISHED');
      expect(soloDetail.rewardsEnabled).toBe(false);
      expect(soloDetail.ranking[0]).toMatchObject({ position: 1, rewardRarity: null, rewardStatus: 'NONE' });
      const soloPrizes = await pool.query(
        'SELECT count(*)::int AS total FROM collectibles WHERE source_competition_id = $1',
        [solo.competition.id],
      );
      expect(soloPrizes.rows[0].total).toBe(0);
    });

    it('nunca gera a recompensa duas vezes, mesmo com leituras simultâneas', async () => {
      await seedArtworkForEveryRarity();
      const { players, competition } = await finishedCompetitionWith([6, 4, 2]);

      await Promise.all(
        [...players, ...players].map((player) =>
          request(getApp()).get(`/api/competitions/${competition.id}`).set(auth(player)).expect(200),
        ),
      );
      await request(getApp()).get('/api/competitions').set(auth(players[0] as Player)).expect(200);
      await resolveAllCompetitions();

      const minted = await pool.query(
        'SELECT count(*)::int AS total FROM collectibles WHERE source_competition_id = $1',
        [competition.id],
      );
      expect(minted.rows[0].total).toBe(3);
      const results = await pool.query(
        'SELECT count(*)::int AS total FROM competition_results WHERE competition_id = $1',
        [competition.id],
      );
      expect(results.rows[0].total).toBe(3);

      // The unique index is the last line of defence against a second prize.
      const first = await pool.query(
        'SELECT artwork_id FROM collectibles WHERE source_competition_id = $1 AND earned_by_user_id = $2',
        [competition.id, players[0]?.user.id],
      );
      await expect(
        pool.query(
          `INSERT INTO collectibles (owner_id, earned_by_user_id, artwork_id, source_competition_id,
             goal_title, total_pieces, pieces_obtained, owned_piece_indexes)
           VALUES ($1, $1, $2, $3, 'x', 1, 1, '{0}')`,
          [players[0]?.user.id, first.rows[0].artwork_id, competition.id],
        ),
      ).rejects.toThrow(/uq_collectibles_competition_earner/);
    });

    it('o resultado final não muda depois de travado', async () => {
      await seedArtworkForEveryRarity();
      const { players, competition } = await finishedCompetitionWith([3, 5]);
      const before = await getDetail(players[0] as Player, competition.id);
      expect(rewardsByName(before)).toEqual({ 'Jogador 2': [1, 'LEGENDARY'], 'Jogador 1': [2, 'EPIC'] });

      // Later goal activity inside the old window cannot move the stored result.
      await pool.query(
        `UPDATE goal_days SET status = 'COMPLETED', completed_at = now()
         WHERE goal_id IN (SELECT id FROM goals WHERE user_id = $1)`,
        [players[0]?.user.id],
      );
      const after = await getDetail(players[0] as Player, competition.id);
      expect(rewardsByName(after)).toEqual(rewardsByName(before));

      // And the database itself refuses to rewrite it.
      await expect(
        pool.query('UPDATE competition_results SET position = 1 WHERE competition_id = $1', [competition.id]),
      ).rejects.toThrow(/COMPETITION_RESULT_IMMUTABLE/);
      await expect(
        pool.query("UPDATE competition_results SET reward_rarity = 'LEGENDARY' WHERE competition_id = $1", [
          competition.id,
        ]),
      ).rejects.toThrow();
      await expect(
        pool.query('UPDATE competitions SET finalized_at = NULL WHERE id = $1', [competition.id]),
      ).rejects.toThrow(/COMPETITION_FINALIZED/);
    });

    it('a recompensa permanece na coleção mesmo se a competição for removida', async () => {
      await seedArtworkForEveryRarity();
      const { players, competition } = await finishedCompetitionWith([5, 2]);
      await getDetail(players[0] as Player, competition.id);

      // A finished competition cannot be deleted while its result exists…
      await expect(pool.query('DELETE FROM competitions WHERE id = $1', [competition.id])).rejects.toThrow();

      // …and even if an operator removes it entirely, the prizes stay.
      await pool.query('DELETE FROM competition_results WHERE competition_id = $1', [competition.id]);
      await pool.query('DELETE FROM competitions WHERE id = $1', [competition.id]);

      for (const player of players) {
        const collection = await request(getApp()).get('/api/collectibles').set(auth(player)).expect(200);
        expect(collection.body.collectibles).toHaveLength(1);
        expect(collection.body.collectibles[0].goalTitle).toBe(competition.name);
      }
    });

    it('mantém o prêmio pendente sem arte da raridade e o entrega depois, sem rebaixar', async () => {
      // Only EPIC is stocked: first place (Lendária) has nothing to draw from.
      await seedArtwork({ name: 'Kenai Épico', rarity: 'EPIC' });
      const { players, competition } = await finishedCompetitionWith([6, 3]);

      const first = await getDetail(players[0] as Player, competition.id);
      expect(first.ranking.map((entry) => [entry.rewardRarity, entry.rewardStatus])).toEqual([
        ['LEGENDARY', 'PENDING'],
        ['EPIC', 'AWARDED'],
      ]);

      const legendary = await seedArtwork({ name: 'Kenai Lendário', rarity: 'LEGENDARY' });
      const second = await getDetail(players[0] as Player, competition.id);
      expect(second.ranking.map((entry) => entry.rewardStatus)).toEqual(['AWARDED', 'AWARDED']);

      const prize = await pool.query(
        'SELECT artwork_id FROM collectibles WHERE source_competition_id = $1 AND owner_id = $2',
        [competition.id, players[0]?.user.id],
      );
      expect(prize.rows).toEqual([{ artwork_id: legendary.id }]);
    });

    it('a varredura agendada trava competições que ninguém abriu', async () => {
      await seedArtworkForEveryRarity();
      const { competition } = await finishedCompetitionWith([4, 2]);
      const finalized = await resolveAllCompetitions();
      expect(finalized).toBe(1);
      const row = await pool.query('SELECT finalized_at FROM competitions WHERE id = $1', [competition.id]);
      expect(row.rows[0].finalized_at).not.toBeNull();
    });

    it('o resumo da lista mostra posição, pontuação e raridade de quem consulta', async () => {
      await seedArtworkForEveryRarity();
      const { players, competition } = await finishedCompetitionWith([2, 6]);
      const response = await request(getApp())
        .get('/api/competitions')
        .set(auth(players[0] as Player))
        .expect(200);
      expect(response.body.competitions).toEqual([
        expect.objectContaining({
          id: competition.id,
          status: 'FINISHED',
          myPosition: 2,
          myScorePercent: 28.57,
          myRewardRarity: 'EPIC',
        }),
      ]);
    });
  });
});
