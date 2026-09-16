import type {
  GoalDayStatus,
  GoalStatus,
  Rarity,
  ThemePreference,
  TradeOfferStatus,
  UserRole,
} from '@kenai/shared';

/** Row shapes as returned by the repositories, already camelCased. */

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  timezone: string;
  themePreference: ThemePreference;
  createdAt: Date;
  updatedAt: Date;
}

export interface ArtworkRecord {
  id: string;
  name: string;
  description: string | null;
  rarity: Rarity;
  storageBucket: string;
  storagePath: string;
  width: number;
  height: number;
  mimeType: string;
  byteSize: number;
  isActive: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GoalRecord {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  status: GoalStatus;
  durationDays: number;
  startDate: string;
  endDate: string;
  artworkId: string;
  totalPieces: number;
  finalizedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GoalDayRecord {
  id: string;
  goalId: string;
  dayNumber: number;
  dayDate: string;
  pieceIndex: number;
  status: GoalDayStatus;
  completedAt: Date | null;
}

export interface GoalDayCounts {
  completed: number;
  missed: number;
  pending: number;
}

export interface CollectibleRecord {
  id: string;
  ownerId: string;
  earnedByUserId: string | null;
  artworkId: string;
  sourceGoalId: string | null;
  goalTitle: string;
  totalPieces: number;
  piecesObtained: number;
  ownedPieceIndexes: number[];
  completionPercent: number;
  isPerfect: boolean;
  isListedForTrade: boolean;
  obtainedAt: Date;
}

export interface CollectibleWithRelations extends CollectibleRecord {
  artworkName: string;
  artworkDescription: string | null;
  artworkRarity: Rarity;
  artworkWidth: number;
  artworkHeight: number;
  ownerName: string;
  earnedByName: string | null;
  pendingTradeCount: number;
}

export interface RewardRuleRecord {
  id: string;
  name: string;
  minDays: number;
  maxDays: number;
  priority: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RewardRuleWeightRecord {
  rarity: Rarity;
  weight: number;
}

export interface TradeOfferRecord {
  id: string;
  offererId: string;
  receiverId: string;
  offeredCollectibleId: string;
  requestedCollectibleId: string;
  status: TradeOfferStatus;
  message: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
}
