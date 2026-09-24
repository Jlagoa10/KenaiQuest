import type pg from 'pg';
import type {
  CompetitionDetailDto,
  CompetitionInvitePreviewDto,
  CompetitionRankingEntryDto,
  CompetitionStatus,
  CompetitionSummaryDto,
  IsoDate,
  RandomSource,
  Rarity,
} from '@kenai/shared';
import {
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  MAX_COMPETITION_DURATION_DAYS,
  MAX_COMPETITION_PARTICIPANTS,
  MIN_COMPETITION_DURATION_DAYS,
  MIN_PARTICIPANTS_FOR_REWARDS,
  basisPointsToPercent,
  compareIsoDates,
  competitionDurationDays,
  competitionResultsDate,
  deriveCompetitionStatus,
  isCompetitionReadyToFinalize,
  rankCompetition,
  range,
  rarityForPosition,
  tallyCompetitionDays,
} from '@kenai/shared';
import { withTransaction } from '../database/transaction.js';
import type { Queryable } from '../database/types.js';
import { AppError, ErrorCodes, forbidden, notFound } from '../utils/errors.js';
import { randomCode } from '../utils/crypto.js';
import { logger } from '../utils/logger.js';
import { currentDateInTimezone } from '../utils/timezone.js';
import * as competitionRepository from '../repositories/competitionRepository.js';
import * as collectibleRepository from '../repositories/collectibleRepository.js';
import { selectArtworkForRarity } from './rewardEngine.js';
import type {
  CompetitionParticipantRecord,
  CompetitionRecord,
  CompetitionResultRecord,
  UserRecord,
} from '../types/models.js';

/* -------------------------------------------------------------------------
 * Competições
 *
 * The score is never stored while a competition runs and never accepted from
 * a request: it is derived on every read from the participants' own
 * `goal_days` — the same rows the goal screens use — through the pure
 * functions in @kenai/shared. The ranking therefore moves the instant a day
 * is completed, and there is nothing a client could send to change it.
 *
 * The final result is locked LAZILY, like missed goal days: any read that
 * finds a competition whose last claimable day has passed locks it inside a
 * transaction holding the competition's row lock, stores the ranking and mints
 * the prizes. jobs/resolveStaleGoals.ts does the same across all competitions
 * for freshness, never as a correctness dependency.
 * ------------------------------------------------------------------------- */

export interface CompetitionStanding {
  userId: string;
  name: string;
  completedDays: number;
  scheduledDays: number;
  scoreBasisPoints: number;
  position: number;
  positionRarity: Rarity | null;
  rewardEligible: boolean;
  rewardRarity: Rarity | null;
}

/** Test seam: lets integration tests pick a deterministic artwork. */
export interface CompetitionOptions {
  now?: Date;
  random?: RandomSource;
}

/* -------------------------------------------------------------------------
 * Scoring
 * ------------------------------------------------------------------------- */

/**
 * Live standings, computed from the participants' goal days. Each participant
 * is judged in their own timezone, exactly as their goals are.
 */
export async function computeStandings(
  params: {
    competition: CompetitionRecord;
    participants: CompetitionParticipantRecord[];
    now?: Date;
  },
  db?: Queryable,
): Promise<CompetitionStanding[]> {
  const { competition, participants, now } = params;
  const days = await competitionRepository.listScoringDays(
    {
      userIds: participants.map((participant) => participant.userId),
      startDate: competition.startDate,
      endDate: competition.endDate,
    },
    db,
  );

  const tallies = participants
    .map((participant) => {
      const own = days
        .filter((day) => day.userId === participant.userId)
        .map((day) => ({
          date: day.dayDate,
          status: day.status,
          goalCancelledOn:
            day.goalStatus === 'CANCELLED' && day.goalCancelledAt
              ? currentDateInTimezone(participant.userTimezone, day.goalCancelledAt)
              : null,
        }));

      const tally = tallyCompetitionDays({
        days: own,
        startDate: competition.startDate,
        endDate: competition.endDate,
        todayInUserTz: currentDateInTimezone(participant.userTimezone, now),
      });
      return { userId: participant.userId, name: participant.userName, ...tally };
    })
    // Display order among ties only; ties share position and rarity regardless.
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR') || a.userId.localeCompare(b.userId));

  return rankCompetition(tallies);
}

/* -------------------------------------------------------------------------
 * Lifecycle: locking the result and minting prizes
 * ------------------------------------------------------------------------- */

function todayFor(competition: CompetitionRecord, now?: Date): IsoDate {
  return currentDateInTimezone(competition.timezone, now);
}

function statusOf(competition: CompetitionRecord, now?: Date): CompetitionStatus {
  return deriveCompetitionStatus({
    startDate: competition.startDate,
    todayInCompetitionTz: todayFor(competition, now),
    isFinalized: competition.finalizedAt !== null,
  });
}

function readyToFinalize(
  competition: CompetitionRecord,
  participants: CompetitionParticipantRecord[],
  now?: Date,
): boolean {
  return isCompetitionReadyToFinalize({
    endDate: competition.endDate,
    todaysInParticipantTz: [
      todayFor(competition, now),
      ...participants.map((participant) => currentDateInTimezone(participant.userTimezone, now)),
    ],
  });
}

/**
 * Mints every prize that has been assigned but not yet delivered.
 *
 * MUST run while holding the competition's row lock. Idempotent three times
 * over: only rows with `rewarded_at IS NULL` are considered, marking one is a
 * conditional update, and a unique index forbids a second collectible for the
 * same person and competition.
 *
 * The prize is a complete copy of an artwork of exactly the assigned rarity,
 * drawn from the same pool the goals use. If that pool is empty the prize stays
 * pending — never downgraded — and is delivered on a later access.
 */
async function mintPendingRewards(
  competition: CompetitionRecord,
  client: pg.PoolClient,
  random?: RandomSource,
): Promise<number> {
  const results = await competitionRepository.listResults(competition.id, client);
  const totalPieces = competitionDurationDays(competition.startDate, competition.endDate);
  let minted = 0;

  for (const result of results) {
    if (!result.rewardRarity || result.rewardedAt) continue;

    const artwork = await selectArtworkForRarity({ rarity: result.rewardRarity, random }, client);
    if (!artwork) {
      logger.warn(
        { competitionId: competition.id, rarity: result.rewardRarity },
        'Nenhuma arte ativa desta raridade; prêmio da competição fica pendente.',
      );
      continue;
    }

    const collectible = await collectibleRepository.createCollectible(
      {
        ownerId: result.userId,
        earnedByUserId: result.userId,
        artworkId: artwork.id,
        sourceGoalId: null,
        sourceCompetitionId: competition.id,
        // Snapshot, like a goal title: the collection keeps showing where the
        // prize came from even if the competition is ever renamed or removed.
        goalTitle: competition.name,
        totalPieces,
        piecesObtained: totalPieces,
        ownedPieceIndexes: range(totalPieces),
      },
      client,
    );

    const marked = await competitionRepository.markResultRewarded(
      { competitionId: competition.id, userId: result.userId, collectibleId: collectible.id },
      client,
    );
    if (!marked) {
      // Unreachable under the row lock; roll the whole thing back rather than
      // leave an orphan prize behind.
      throw new Error('Prêmio da competição já havia sido entregue.');
    }
    minted += 1;
  }

  return minted;
}

/**
 * Brings a competition up to date: locks the final ranking once nobody can
 * claim a day inside the window any more, and delivers any pending prize.
 * Safe to call any number of times, concurrently.
 */
export async function resolveCompetition(
  competitionId: string,
  options: CompetitionOptions = {},
): Promise<{ finalized: boolean; minted: number }> {
  const { now, random } = options;

  // Cheap unlocked pre-check, so ordinary reads do not queue on the row lock.
  const snapshot = await competitionRepository.findCompetitionById(competitionId);
  if (!snapshot) return { finalized: false, minted: 0 };

  if (snapshot.finalizedAt) {
    if (!(await competitionRepository.hasPendingRewards(competitionId))) {
      return { finalized: false, minted: 0 };
    }
  } else {
    const participants = await competitionRepository.listParticipants(competitionId);
    if (!readyToFinalize(snapshot, participants, now)) return { finalized: false, minted: 0 };
  }

  return withTransaction(async (client) => {
    const competition = await competitionRepository.findCompetitionByIdForUpdate(
      competitionId,
      client,
    );
    if (!competition) return { finalized: false, minted: 0 };

    let finalized = false;
    if (!competition.finalizedAt) {
      const participants = await competitionRepository.listParticipants(competitionId, client);
      if (!readyToFinalize(competition, participants, now)) return { finalized: false, minted: 0 };

      const standings = await computeStandings({ competition, participants, now }, client);
      await competitionRepository.insertResults(
        {
          competitionId,
          rows: standings.map((standing) => ({
            userId: standing.userId,
            position: standing.position,
            completedDays: standing.completedDays,
            scheduledDays: standing.scheduledDays,
            scoreBasisPoints: standing.scoreBasisPoints,
            rewardRarity: standing.rewardRarity,
          })),
        },
        client,
      );
      finalized = await competitionRepository.markCompetitionFinalized(competitionId, client);
    }

    const minted = await mintPendingRewards(competition, client, random);
    return { finalized, minted };
  });
}

/** Used by the background sweep. */
export async function resolveAllCompetitions(options: CompetitionOptions = {}): Promise<number> {
  // A competition is only ready once its end date is behind every participant,
  // so its end date is certainly behind the latest calendar date on Earth
  // (UTC+14). That gives a superset; readiness is decided per participant inside.
  const latestToday = currentDateInTimezone('Etc/GMT-14', options.now);
  const ids = await competitionRepository.listCompetitionIdsNeedingResolution(latestToday);
  let finalizedCount = 0;
  for (const id of ids) {
    const result = await resolveCompetition(id, options);
    if (result.finalized) finalizedCount += 1;
  }
  return finalizedCount;
}

/* -------------------------------------------------------------------------
 * Creation and joining
 * ------------------------------------------------------------------------- */

async function generateUniqueInviteCode(db: Queryable): Promise<string> {
  // 32^8 codes: a collision is astronomically unlikely, but it is cheap to be sure.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = randomCode(INVITE_CODE_ALPHABET, INVITE_CODE_LENGTH);
    if (!(await competitionRepository.inviteCodeExists(code, db))) return code;
  }
  throw new Error('Não foi possível gerar um código de convite único.');
}

export async function createCompetition(params: {
  user: UserRecord;
  name: string;
  startDate: IsoDate;
  endDate: IsoDate;
  now?: Date;
}): Promise<CompetitionDetailDto> {
  const today = currentDateInTimezone(params.user.timezone, params.now);

  // Joining closes when the competition starts, so a competition starting
  // today could never have anyone but its creator.
  if (compareIsoDates(params.startDate, today) <= 0) {
    throw new AppError(
      400,
      ErrorCodes.INVALID_COMPETITION_DATES,
      'A competição precisa começar a partir de amanhã, para que outras pessoas possam entrar.',
    );
  }

  // Re-checked here even though the schema validates it: the service is the
  // boundary, whatever route calls it.
  const duration = competitionDurationDays(params.startDate, params.endDate);
  if (duration < MIN_COMPETITION_DURATION_DAYS || duration > MAX_COMPETITION_DURATION_DAYS) {
    throw new AppError(
      400,
      ErrorCodes.INVALID_COMPETITION_DATES,
      `A competição deve durar entre ${MIN_COMPETITION_DURATION_DAYS} e ${MAX_COMPETITION_DURATION_DAYS} dias.`,
    );
  }

  const competitionId = await withTransaction(async (client) => {
    const inviteCode = await generateUniqueInviteCode(client);
    const competition = await competitionRepository.createCompetition(
      {
        name: params.name,
        creatorId: params.user.id,
        startDate: params.startDate,
        endDate: params.endDate,
        timezone: params.user.timezone,
        inviteCode,
      },
      client,
    );
    // The creator is always the first participant.
    await competitionRepository.addParticipant(
      { competitionId: competition.id, userId: params.user.id },
      client,
    );
    return competition.id;
  });

  return getCompetitionDetail({ user: params.user, competitionId, now: params.now });
}

/** Why a user cannot join, or null when they can. */
function joinBlockedReason(params: {
  competition: CompetitionRecord;
  participantCount: number;
  isParticipant: boolean;
  now?: Date;
}): { code: string; message: string } | null {
  if (params.isParticipant) {
    return {
      code: ErrorCodes.COMPETITION_ALREADY_JOINED,
      message: 'Você já participa desta competição.',
    };
  }
  if (statusOf(params.competition, params.now) !== 'UPCOMING') {
    return {
      code: ErrorCodes.COMPETITION_NOT_JOINABLE,
      message: 'Esta competição já começou. Só é possível entrar antes do início.',
    };
  }
  if (params.participantCount >= MAX_COMPETITION_PARTICIPANTS) {
    return {
      code: ErrorCodes.COMPETITION_FULL,
      message: `Esta competição já tem ${MAX_COMPETITION_PARTICIPANTS} participantes.`,
    };
  }
  return null;
}

function triggerErrorName(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null;
  const { code, message } = error as { code?: string; message?: string };
  return code === '23514' && typeof message === 'string' ? message : null;
}

export async function joinCompetition(params: {
  user: UserRecord;
  code: string;
  now?: Date;
}): Promise<CompetitionDetailDto> {
  const existing = await competitionRepository.findCompetitionByInviteCode(params.code);
  if (!existing) throw notFound('Convite não encontrado. Confira o código.');

  try {
    await withTransaction(async (client) => {
      // Serialises joins on this competition: the count below cannot go stale.
      const competition = await competitionRepository.findCompetitionByIdForUpdate(
        existing.id,
        client,
      );
      if (!competition) throw notFound('Convite não encontrado. Confira o código.');

      const participants = await competitionRepository.listParticipants(competition.id, client);
      const blocked = joinBlockedReason({
        competition,
        participantCount: participants.length,
        isParticipant: participants.some((participant) => participant.userId === params.user.id),
        now: params.now,
      });
      if (blocked) throw new AppError(409, blocked.code, blocked.message);

      const inserted = await competitionRepository.addParticipant(
        { competitionId: competition.id, userId: params.user.id },
        client,
      );
      if (!inserted) {
        throw new AppError(
          409,
          ErrorCodes.COMPETITION_ALREADY_JOINED,
          'Você já participa desta competição.',
        );
      }
    });
  } catch (error) {
    // The database backstops (trigger) are reported like the service checks.
    const name = triggerErrorName(error);
    if (name === 'COMPETITION_FULL') {
      throw new AppError(
        409,
        ErrorCodes.COMPETITION_FULL,
        `Esta competição já tem ${MAX_COMPETITION_PARTICIPANTS} participantes.`,
      );
    }
    if (name === 'COMPETITION_FINALIZED') {
      throw new AppError(409, ErrorCodes.COMPETITION_NOT_JOINABLE, 'Esta competição já terminou.');
    }
    throw error;
  }

  return getCompetitionDetail({ user: params.user, competitionId: existing.id, now: params.now });
}

export async function previewInvite(params: {
  user: UserRecord;
  code: string;
  now?: Date;
}): Promise<CompetitionInvitePreviewDto> {
  const competition = await competitionRepository.findCompetitionByInviteCode(params.code);
  if (!competition) throw notFound('Convite não encontrado. Confira o código.');

  await resolveCompetition(competition.id, { now: params.now });
  const current = (await competitionRepository.findCompetitionById(competition.id)) ?? competition;
  const participants = await competitionRepository.listParticipants(current.id);
  const isParticipant = participants.some((participant) => participant.userId === params.user.id);
  const blocked = joinBlockedReason({
    competition: current,
    participantCount: participants.length,
    isParticipant,
    now: params.now,
  });

  return {
    id: current.id,
    name: current.name,
    startDate: current.startDate,
    endDate: current.endDate,
    durationDays: competitionDurationDays(current.startDate, current.endDate),
    status: statusOf(current, params.now),
    creatorName:
      participants.find((participant) => participant.userId === current.creatorId)?.userName ??
      null,
    participantNames: participants.map((participant) => participant.userName),
    participantCount: participants.length,
    maxParticipants: MAX_COMPETITION_PARTICIPANTS,
    isParticipant,
    canJoin: blocked === null,
    joinBlockedReason: blocked && !isParticipant ? blocked.message : null,
  };
}

/* -------------------------------------------------------------------------
 * Reads
 * ------------------------------------------------------------------------- */

function toRankingEntryFromStanding(
  standing: CompetitionStanding,
  viewerId: string,
): CompetitionRankingEntryDto {
  return {
    userId: standing.userId,
    name: standing.name,
    isMe: standing.userId === viewerId,
    position: standing.position,
    scorePercent: basisPointsToPercent(standing.scoreBasisPoints),
    completedDays: standing.completedDays,
    scheduledDays: standing.scheduledDays,
    positionRarity: standing.positionRarity,
    rewardRarity: standing.rewardRarity,
    rewardStatus: 'NONE',
  };
}

/** `rankedCount`: how many were ranked when the result was locked. */
function toRankingEntryFromResult(
  result: CompetitionResultRecord,
  viewerId: string,
  rankedCount: number,
): CompetitionRankingEntryDto {
  const entry: CompetitionRankingEntryDto = {
    userId: result.userId,
    name: result.userName,
    isMe: result.userId === viewerId,
    position: result.position,
    scorePercent: basisPointsToPercent(result.scoreBasisPoints),
    completedDays: result.completedDays,
    scheduledDays: result.scheduledDays,
    positionRarity: rarityForPosition(result.position, rankedCount),
    rewardRarity: result.rewardRarity,
    rewardStatus: !result.rewardRarity ? 'NONE' : result.rewardedAt ? 'AWARDED' : 'PENDING',
  };
  // Other people's copies are private, so only your own prize is linked.
  if (entry.isMe && result.collectibleId) entry.collectibleId = result.collectibleId;
  return entry;
}

async function buildRanking(params: {
  competition: CompetitionRecord;
  participants: CompetitionParticipantRecord[];
  status: CompetitionStatus;
  viewerId: string;
  now?: Date;
}): Promise<CompetitionRankingEntryDto[]> {
  const { competition, participants, status, viewerId, now } = params;
  if (status === 'FINISHED') {
    const results = await competitionRepository.listResults(competition.id);
    return results.map((result) => toRankingEntryFromResult(result, viewerId, results.length));
  }
  // Before the start there is nothing to rank: everyone would sit tied at 0%.
  if (status === 'UPCOMING') return [];
  const standings = await computeStandings({ competition, participants, now });
  return standings.map((standing) => toRankingEntryFromStanding(standing, viewerId));
}

function buildSummary(params: {
  competition: CompetitionRecord;
  participants: CompetitionParticipantRecord[];
  status: CompetitionStatus;
  viewerId: string;
  mine: CompetitionRankingEntryDto | undefined;
}): CompetitionSummaryDto {
  const { competition, participants, status, viewerId, mine } = params;
  return {
    id: competition.id,
    name: competition.name,
    startDate: competition.startDate,
    endDate: competition.endDate,
    durationDays: competitionDurationDays(competition.startDate, competition.endDate),
    status,
    participantCount: participants.length,
    maxParticipants: MAX_COMPETITION_PARTICIPANTS,
    isCreator: competition.creatorId === viewerId,
    myPosition: mine?.position ?? null,
    myScorePercent: mine?.scorePercent ?? null,
    myRewardRarity: mine?.rewardRarity ?? null,
    createdAt: competition.createdAt.toISOString(),
    finalizedAt: competition.finalizedAt ? competition.finalizedAt.toISOString() : null,
  };
}

export async function listCompetitions(params: {
  user: UserRecord;
  now?: Date;
}): Promise<CompetitionSummaryDto[]> {
  const initial = await competitionRepository.listCompetitionsForUser(params.user.id);
  for (const competition of initial) {
    await resolveCompetition(competition.id, { now: params.now });
  }

  const competitions = await competitionRepository.listCompetitionsForUser(params.user.id);
  const participantsById = await competitionRepository.listParticipantsForCompetitions(
    competitions.map((competition) => competition.id),
  );
  const myResults = await competitionRepository.listResultsForUser({
    userId: params.user.id,
    competitionIds: competitions
      .filter((competition) => competition.finalizedAt)
      .map((competition) => competition.id),
  });

  const summaries: CompetitionSummaryDto[] = [];
  for (const competition of competitions) {
    const participants = participantsById.get(competition.id) ?? [];
    const status = statusOf(competition, params.now);

    let mine: CompetitionRankingEntryDto | undefined;
    if (status === 'FINISHED') {
      const result = myResults.get(competition.id);
      mine = result
        ? toRankingEntryFromResult(result, params.user.id, participants.length)
        : undefined;
    } else if (status === 'ACTIVE') {
      const standings = await computeStandings({ competition, participants, now: params.now });
      const standing = standings.find((entry) => entry.userId === params.user.id);
      mine = standing ? toRankingEntryFromStanding(standing, params.user.id) : undefined;
    }

    summaries.push(
      buildSummary({ competition, participants, status, viewerId: params.user.id, mine }),
    );
  }
  return summaries;
}

export async function getCompetitionDetail(params: {
  user: UserRecord;
  competitionId: string;
  now?: Date;
}): Promise<CompetitionDetailDto> {
  const existing = await competitionRepository.findCompetitionById(params.competitionId);
  if (!existing) throw notFound('Competição não encontrada.');
  if (!(await competitionRepository.isParticipant(existing.id, params.user.id))) {
    throw forbidden('Você não participa desta competição.');
  }

  await resolveCompetition(existing.id, { now: params.now });

  const competition = (await competitionRepository.findCompetitionById(existing.id)) ?? existing;
  const participants = await competitionRepository.listParticipants(competition.id);
  const status = statusOf(competition, params.now);
  const ranking = await buildRanking({
    competition,
    participants,
    status,
    viewerId: params.user.id,
    now: params.now,
  });
  const mine = ranking.find((entry) => entry.isMe);
  const creator = participants.find((participant) => participant.userId === competition.creatorId);

  return {
    ...buildSummary({ competition, participants, status, viewerId: params.user.id, mine }),
    inviteCode: competition.inviteCode,
    creatorName: creator?.userName ?? null,
    participants: participants.map((participant) => ({
      userId: participant.userId,
      name: participant.userName,
      joinedAt: participant.joinedAt.toISOString(),
      isCreator: participant.userId === competition.creatorId,
      isMe: participant.userId === params.user.id,
    })),
    ranking,
    rankingIsFinal: status === 'FINISHED',
    // A finished competition is judged on who took part when it was locked.
    rewardsEnabled:
      (status === 'FINISHED' ? ranking.length : participants.length) >=
      MIN_PARTICIPANTS_FOR_REWARDS,
    resultsDate: competitionResultsDate(competition.endDate),
    acceptingParticipants:
      status === 'UPCOMING' && participants.length < MAX_COMPETITION_PARTICIPANTS,
  };
}
