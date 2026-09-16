import type {
  ArtworkRecord,
  CollectibleRecord,
  CollectibleWithRelations,
  GoalDayRecord,
  GoalRecord,
  RewardRuleRecord,
  TradeOfferRecord,
  UserRecord,
} from '../types/models.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

export function mapUser(row: Row): UserRecord {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    timezone: row.timezone,
    themePreference: row.theme_preference,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapArtwork(row: Row): ArtworkRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    rarity: row.rarity,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    width: row.width,
    height: row.height,
    mimeType: row.mime_type,
    byteSize: row.byte_size,
    isActive: row.is_active,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapGoal(row: Row): GoalRecord {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    status: row.status,
    durationDays: row.duration_days,
    startDate: row.start_date,
    endDate: row.end_date,
    artworkId: row.artwork_id,
    totalPieces: row.total_pieces,
    finalizedAt: row.finalized_at,
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapGoalDay(row: Row): GoalDayRecord {
  return {
    id: row.id,
    goalId: row.goal_id,
    dayNumber: row.day_number,
    dayDate: row.day_date,
    pieceIndex: row.piece_index,
    status: row.status,
    completedAt: row.completed_at,
  };
}

export function mapCollectible(row: Row): CollectibleRecord {
  return {
    id: row.id,
    ownerId: row.owner_id,
    earnedByUserId: row.earned_by_user_id,
    artworkId: row.artwork_id,
    sourceGoalId: row.source_goal_id,
    goalTitle: row.goal_title,
    totalPieces: row.total_pieces,
    piecesObtained: row.pieces_obtained,
    ownedPieceIndexes: row.owned_piece_indexes ?? [],
    completionPercent: Number(row.completion_percent),
    isPerfect: row.is_perfect,
    isListedForTrade: row.is_listed_for_trade,
    obtainedAt: row.obtained_at,
  };
}

export function mapCollectibleWithRelations(row: Row): CollectibleWithRelations {
  return {
    ...mapCollectible(row),
    artworkName: row.artwork_name,
    artworkDescription: row.artwork_description,
    artworkRarity: row.artwork_rarity,
    artworkWidth: row.artwork_width,
    artworkHeight: row.artwork_height,
    ownerName: row.owner_name,
    earnedByName: row.earned_by_name ?? null,
    pendingTradeCount: Number(row.pending_trade_count ?? 0),
  };
}

export function mapRewardRule(row: Row): RewardRuleRecord {
  return {
    id: row.id,
    name: row.name,
    minDays: row.min_days,
    maxDays: row.max_days,
    priority: row.priority,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapTradeOffer(row: Row): TradeOfferRecord {
  return {
    id: row.id,
    offererId: row.offerer_id,
    receiverId: row.receiver_id,
    offeredCollectibleId: row.offered_collectible_id,
    requestedCollectibleId: row.requested_collectible_id,
    status: row.status,
    message: row.message,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}
