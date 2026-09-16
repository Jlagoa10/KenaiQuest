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
