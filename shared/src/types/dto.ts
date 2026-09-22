import type { CompetitionStatus } from '../constants/competitions.js';
import type { GoalDayStatus, GoalStatus } from '../constants/goals.js';
import type { Rarity } from '../constants/rarity.js';
import type { TradeOfferStatus } from '../constants/trades.js';
import type { ThemePreference, UserRole } from '../constants/users.js';
import type { IsoDate } from '../domain/dates.js';
import type { PieceState } from '../domain/goalProgress.js';

export interface UserDto {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  timezone: string;
  themePreference: ThemePreference;
  createdAt: string;
}

export interface AuthResponseDto {
  user: UserDto;
  accessToken: string;
  /** Seconds until the access token expires; the client refreshes ahead of this. */
  expiresIn: number;
}

export interface GoalDayDto {
  id: string;
  dayNumber: number;
  date: IsoDate;
  status: GoalDayStatus;
  completedAt: string | null;
  /**
   * Which region of the artwork this day unlocks.
   * Exposing it is safe: the geometry is public, the PIXELS are not — locked
   * regions are never rendered into the image the server streams.
   */
  pieceIndex: number;
  /** True only while the day sits inside its Hoje/Ontem completion window. */
  claimable: boolean;
}

export interface GoalProgressDto {
  totalDays: number;
  completedDays: number;
  missedDays: number;
  pendingDays: number;
  currentDay: number;
  remainingDays: number;
  progressPercent: number;
}

export interface PieceStateDto {
  pieceIndex: number;
  state: PieceState;
}

/**
 * The artwork identity, revealed ONLY once a goal reaches a terminal state.
 * While a goal is ACTIVE the API omits this object entirely — it is not merely
 * blanked out, it never leaves the server (spec sections 14 and 15).
 */
export interface RevealedArtworkDto {
  id: string;
  name: string;
  description: string | null;
  rarity: Rarity;
}

export interface GoalSummaryDto {
  id: string;
  title: string;
  description: string | null;
  status: GoalStatus;
  durationDays: number;
  totalPieces: number;
  startDate: IsoDate;
  endDate: IsoDate;
  createdAt: string;
  finalizedAt: string | null;
  progress: GoalProgressDto;
  /** Aspect ratio (width / height) of the secret artwork — needed to draw the grid. */
  imageAspectRatio: number;
  /** Cache-busting token for the composited image endpoint. */
  imageVersion: string;
  /**
   * Which pieces are already unlocked, and which are permanently lost.
   * Safe to expose: the user knows which days they completed, and the PIXELS
   * of a locked region are never sent regardless.
   */
  revealedPieceIndexes: number[];
  missedPieceIndexes: number[];
  /** Present only for COMPLETED goals. */
  artwork?: RevealedArtworkDto;
  collectibleId?: string;
  /** Whether the user may still mark Hoje or Ontem right now. */
  canCompleteToday: boolean;
  canCompleteYesterday: boolean;
}

export interface GoalDetailDto extends GoalSummaryDto {
  days: GoalDayDto[];
}

export interface CollectibleOwnerDto {
  id: string;
  name: string;
}

export interface CollectibleDto {
  id: string;
  artwork: RevealedArtworkDto;
  owner: CollectibleOwnerDto;
  goalTitle: string;
  totalPieces: number;
  piecesObtained: number;
  piecesMissed: number;
  completionPercent: number;
  isPerfect: boolean;
  isTradeEligible: boolean;
  isListedForTrade: boolean;
  hasPendingTrade: boolean;
  obtainedAt: string;
  imageAspectRatio: number;
  imageVersion: string;
  /** Frozen at minting. Anything not listed here is a permanent hole. */
  ownedPieceIndexes: number[];
  /** Set when the copy was a competition prize rather than a goal's artwork. */
  sourceCompetitionId: string | null;
}

export interface CollectibleDetailDto extends CollectibleDto {
  sourceGoalId: string | null;
  earnedByName: string;
}

export interface TradeOfferCollectibleDto {
  id: string;
  artworkName: string;
  rarity: Rarity;
  completionPercent: number;
  isPerfect: boolean;
  totalPieces: number;
  piecesObtained: number;
  ownerName: string;
  imageVersion: string;
  imageAspectRatio: number;
}

export interface TradeOfferDto {
  id: string;
  status: TradeOfferStatus;
  message: string | null;
  createdAt: string;
  resolvedAt: string | null;
  offerer: CollectibleOwnerDto;
  receiver: CollectibleOwnerDto;
  offeredCollectible: TradeOfferCollectibleDto;
  requestedCollectible: TradeOfferCollectibleDto;
  /** Perspective flags so the UI knows which actions to render. */
  isOutgoing: boolean;
  canAccept: boolean;
  canReject: boolean;
  canCancel: boolean;
}

export interface ArtworkDto {
  id: string;
  name: string;
  description: string | null;
  rarity: Rarity;
  isActive: boolean;
  width: number;
  height: number;
  mimeType: string;
  byteSize: number;
  collectiblesAwarded: number;
  createdAt: string;
  updatedAt: string;
  /** Admin-only preview URL served through the backend, never a raw bucket URL. */
  previewUrl: string;
}

export interface RewardRuleWeightDto {
  rarity: Rarity;
  weight: number;
  /** Normalised share of the draw, already accounting for empty artwork pools. */
  normalisedPercent: number;
  activeArtworks: number;
}

export interface RewardRuleDto {
  id: string;
  name: string;
  minDays: number;
  maxDays: number;
  priority: number;
  isActive: boolean;
  weights: RewardRuleWeightDto[];
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserDto {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  timezone: string;
  goalsCount: number;
  collectiblesCount: number;
  createdAt: string;
}

export interface AdminStatsDto {
  users: number;
  admins: number;
  activeGoals: number;
  completedGoals: number;
  artworks: number;
  activeArtworks: number;
  collectibles: number;
  pendingTrades: number;
  completedTrades: number;
}

export interface CompetitionParticipantDto {
  userId: string;
  name: string;
  joinedAt: string;
  isCreator: boolean;
  isMe: boolean;
}

/**
 * One row of the ranking. Every number here is computed on the server from
 * `goal_days` (live) or read from the stored final result (finished). Nothing
 * the client sends ever feeds into it.
 */
export interface CompetitionRankingEntryDto {
  userId: string;
  name: string;
  isMe: boolean;
  /** Shared by tied participants. */
  position: number;
  /** Completion with two decimals — exactly the value the ranking compares. */
  scorePercent: number;
  completedDays: number;
  scheduledDays: number;
  /** The rarity this position stands for. */
  positionRarity: Rarity | null;
  /** What is (live: would be) awarded; null when the participant earns nothing. */
  rewardRarity: Rarity | null;
  /** Finished competitions only: the minted Kenai. Present for your own row. */
  rewardStatus: 'NONE' | 'PENDING' | 'AWARDED';
  collectibleId?: string;
}

export interface CompetitionSummaryDto {
  id: string;
  name: string;
  startDate: IsoDate;
  endDate: IsoDate;
  durationDays: number;
  status: CompetitionStatus;
  participantCount: number;
  maxParticipants: number;
  isCreator: boolean;
  /** Your current (or final) position, and the rarity it stands for. */
  myPosition: number | null;
  myScorePercent: number | null;
  myRewardRarity: Rarity | null;
  createdAt: string;
  finalizedAt: string | null;
}

export interface CompetitionDetailDto extends CompetitionSummaryDto {
  inviteCode: string;
  creatorName: string | null;
  participants: CompetitionParticipantDto[];
  ranking: CompetitionRankingEntryDto[];
  /** True once the result is stored and can no longer change. */
  rankingIsFinal: boolean;
  /** False while fewer than the minimum number of participants take part. */
  rewardsEnabled: boolean;
  /** First date on which the final result is locked (after the Ontem window). */
  resultsDate: IsoDate;
  /** Whether the invitation still works: upcoming and not full. */
  acceptingParticipants: boolean;
}

/** What someone holding an invitation sees before joining. */
export interface CompetitionInvitePreviewDto {
  id: string;
  name: string;
  startDate: IsoDate;
  endDate: IsoDate;
  durationDays: number;
  status: CompetitionStatus;
  creatorName: string | null;
  participantNames: string[];
  participantCount: number;
  maxParticipants: number;
  isParticipant: boolean;
  canJoin: boolean;
  /** Why joining is not possible, in Portuguese, when canJoin is false. */
  joinBlockedReason: string | null;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
