import type { TradeOfferDto } from '@kenai/shared';
import { isTradeEligible } from '@kenai/shared';
import { withTransaction } from '../database/transaction.js';
import { AppError, ErrorCodes, forbidden, notFound } from '../utils/errors.js';
import { shortHash } from '../utils/crypto.js';
import * as collectibleRepository from '../repositories/collectibleRepository.js';
import * as tradeRepository from '../repositories/tradeRepository.js';
import type { TradeCollectibleSummary, TradeOfferDetailRow } from '../repositories/tradeRepository.js';
import type { Rarity } from '@kenai/shared';
import type { UserRecord } from '../types/models.js';

function toTradeCollectibleDto(summary: TradeCollectibleSummary) {
  return {
    id: summary.id,
    artworkName: summary.artworkName,
    rarity: summary.rarity as Rarity,
    completionPercent: summary.completionPercent,
    isPerfect: summary.isPerfect,
    totalPieces: summary.totalPieces,
    piecesObtained: summary.piecesObtained,
    ownerName: summary.ownerName,
    imageVersion: shortHash(`${summary.id}:${summary.piecesObtained}/${summary.totalPieces}`),
    imageAspectRatio: summary.artworkWidth / summary.artworkHeight,
  };
}

function toTradeOfferDto(offer: TradeOfferDetailRow, viewerId: string): TradeOfferDto {
  const isOutgoing = offer.offererId === viewerId;
  const isPending = offer.status === 'PENDING';

  return {
    id: offer.id,
    status: offer.status,
    message: offer.message,
    createdAt: offer.createdAt.toISOString(),
    resolvedAt: offer.resolvedAt ? offer.resolvedAt.toISOString() : null,
    offerer: { id: offer.offererId, name: offer.offererName },
    receiver: { id: offer.receiverId, name: offer.receiverName },
    offeredCollectible: toTradeCollectibleDto(offer.offered),
    requestedCollectible: toTradeCollectibleDto(offer.requested),
    isOutgoing,
    canAccept: isPending && !isOutgoing,
    canReject: isPending && !isOutgoing,
    canCancel: isPending && isOutgoing,
  };
}

export async function createOffer(params: {
  user: UserRecord;
  offeredCollectibleId: string;
  requestedCollectibleId: string;
  message?: string;
}): Promise<TradeOfferDto> {
  if (params.offeredCollectibleId === params.requestedCollectibleId) {
    throw new AppError(422, ErrorCodes.TRADE_SELF, 'Escolha dois colecionáveis diferentes.');
  }

  const offered = await collectibleRepository.findCollectibleById(params.offeredCollectibleId);
  const requested = await collectibleRepository.findCollectibleById(
    params.requestedCollectibleId,
  );

  if (!offered || !requested) throw notFound('Colecionável não encontrado.');

  if (offered.ownerId !== params.user.id) {
    throw new AppError(
      403,
      ErrorCodes.NOT_COLLECTIBLE_OWNER,
      'Você só pode oferecer colecionáveis que possui.',
    );
  }
  if (requested.ownerId === params.user.id) {
    throw new AppError(
      422,
      ErrorCodes.TRADE_SELF,
      'Você não pode propor uma troca consigo mesmo.',
    );
  }
  if (!requested.isListedForTrade) {
    throw new AppError(
      422,
      ErrorCodes.COLLECTIBLE_NOT_LISTED,
      'Este colecionável não está disponível para troca.',
    );
  }
  if (!isTradeEligible(offered.piecesObtained, offered.totalPieces)) {
    throw new AppError(
      422,
      ErrorCodes.COLLECTIBLE_NOT_TRADABLE,
      'Apenas cópias com 90% ou mais podem ser trocadas.',
    );
  }
  if (!isTradeEligible(requested.piecesObtained, requested.totalPieces)) {
    throw new AppError(
      422,
      ErrorCodes.COLLECTIBLE_NOT_TRADABLE,
      'Esta cópia não atende ao mínimo de 90% para troca.',
    );
  }

  try {
    const offer = await tradeRepository.createTradeOffer({
      offererId: params.user.id,
      receiverId: requested.ownerId,
      offeredCollectibleId: params.offeredCollectibleId,
      requestedCollectibleId: params.requestedCollectibleId,
      message: params.message ?? null,
    });

    const detail = await tradeRepository.findTradeOfferDetail(offer.id);
    if (!detail) throw notFound('Proposta não encontrada.');
    return toTradeOfferDto(detail, params.user.id);
  } catch (error) {
    // Partial unique index on pending offers.
    if (isUniqueViolation(error)) {
      throw new AppError(
        409,
        ErrorCodes.DUPLICATE_TRADE_OFFER,
        'Você já enviou esta proposta. Aguarde a resposta.',
      );
    }
    throw error;
  }
}

/**
 * Accepts a proposal, swapping both owners atomically.
 *
 * Everything below happens in ONE transaction:
 *   1. lock the offer row, then both collectibles in a deterministic id order
 *      (two simultaneous accepts touching the same pair therefore queue instead
 *      of deadlocking);
 *   2. revalidate from the LOCKED rows — the offer is still pending, both
 *      collectibles still exist, each side still owns what it is trading, and
 *      both still meet the 90% rule. Nothing here trusts the request or any
 *      value read before the lock;
 *   3. swap the owners and record the trade;
 *   4. supersede every other pending offer touching either copy, because those
 *      now reference stale ownership.
 *
 * A failure at any point rolls the whole thing back, so a half-completed trade
 * — one collectible moved, the other not — cannot exist.
 */
export async function acceptOffer(params: {
  user: UserRecord;
  offerId: string;
}): Promise<TradeOfferDto> {
  return withTransaction(async (client) => {
    const offer = await tradeRepository.findTradeOfferByIdForUpdate(params.offerId, client);
    if (!offer) throw notFound('Proposta não encontrada.');

    if (offer.receiverId !== params.user.id) {
      throw forbidden('Apenas quem recebeu a proposta pode aceitá-la.');
    }
    if (offer.status !== 'PENDING') {
      throw new AppError(
        409,
        ErrorCodes.TRADE_OFFER_NOT_PENDING,
        'Esta proposta não está mais disponível.',
      );
    }

    // Locked in a deterministic order to keep concurrent accepts deadlock free.
    const locked = await collectibleRepository.lockCollectiblesForUpdate(
      [offer.offeredCollectibleId, offer.requestedCollectibleId],
      client,
    );

    const offered = locked.find((item) => item.id === offer.offeredCollectibleId);
    const requested = locked.find((item) => item.id === offer.requestedCollectibleId);

    if (!offered || !requested) {
      throw new AppError(
        409,
        ErrorCodes.TRADE_OFFER_NOT_PENDING,
        'Um dos colecionáveis não está mais disponível.',
      );
    }

    // Revalidated against the locked rows, not against what the proposal said
    // when it was created: ownership may have changed in the meantime.
    if (offered.ownerId !== offer.offererId || requested.ownerId !== offer.receiverId) {
      throw new AppError(
        409,
        ErrorCodes.TRADE_OFFER_NOT_PENDING,
        'Os colecionáveis mudaram de dono. A proposta não é mais válida.',
      );
    }

    if (
      !isTradeEligible(offered.piecesObtained, offered.totalPieces) ||
      !isTradeEligible(requested.piecesObtained, requested.totalPieces)
    ) {
      throw new AppError(
        422,
        ErrorCodes.COLLECTIBLE_NOT_TRADABLE,
        'Apenas cópias com 90% ou mais podem ser trocadas.',
      );
    }

    const resolved = await tradeRepository.resolveTradeOffer(
      { id: offer.id, status: 'ACCEPTED' },
      client,
    );
    if (!resolved) {
      throw new AppError(
        409,
        ErrorCodes.TRADE_OFFER_NOT_PENDING,
        'Esta proposta não está mais disponível.',
      );
    }

    await collectibleRepository.transferCollectible(
      { id: offered.id, newOwnerId: offer.receiverId },
      client,
    );
    await collectibleRepository.transferCollectible(
      { id: requested.id, newOwnerId: offer.offererId },
      client,
    );

    await tradeRepository.recordTrade(
      {
        offerId: offer.id,
        userAId: offer.offererId,
        userBId: offer.receiverId,
        collectibleAId: offered.id,
        collectibleBId: requested.id,
      },
      client,
    );

    // Any other open proposal involving either copy is now stale.
    await tradeRepository.supersedeOffersForCollectibles(
      { collectibleIds: [offered.id, requested.id], exceptOfferId: offer.id },
      client,
    );

    const detail = await tradeRepository.findTradeOfferDetail(offer.id, client);
    if (!detail) throw notFound('Proposta não encontrada.');
    return toTradeOfferDto(detail, params.user.id);
  });
}

export async function rejectOffer(params: {
  user: UserRecord;
  offerId: string;
}): Promise<TradeOfferDto> {
  return resolveOffer({ ...params, status: 'REJECTED' });
}

export async function cancelOffer(params: {
  user: UserRecord;
  offerId: string;
}): Promise<TradeOfferDto> {
  return resolveOffer({ ...params, status: 'CANCELLED' });
}

async function resolveOffer(params: {
  user: UserRecord;
  offerId: string;
  status: 'REJECTED' | 'CANCELLED';
}): Promise<TradeOfferDto> {
  return withTransaction(async (client) => {
    const offer = await tradeRepository.findTradeOfferByIdForUpdate(params.offerId, client);
    if (!offer) throw notFound('Proposta não encontrada.');

    // Only the receiver may reject; only the sender may cancel.
    const allowedUserId = params.status === 'REJECTED' ? offer.receiverId : offer.offererId;
    if (allowedUserId !== params.user.id) {
      throw forbidden('Você não pode alterar esta proposta.');
    }
    if (offer.status !== 'PENDING') {
      throw new AppError(
        409,
        ErrorCodes.TRADE_OFFER_NOT_PENDING,
        'Esta proposta não está mais disponível.',
      );
    }

    await tradeRepository.resolveTradeOffer({ id: offer.id, status: params.status }, client);

    const detail = await tradeRepository.findTradeOfferDetail(offer.id, client);
    if (!detail) throw notFound('Proposta não encontrada.');
    return toTradeOfferDto(detail, params.user.id);
  });
}

export async function listOffers(params: {
  user: UserRecord;
  direction: 'sent' | 'received' | 'history';
}): Promise<TradeOfferDto[]> {
  const offers = await tradeRepository.listTradeOffers({
    userId: params.user.id,
    direction: params.direction,
  });
  return offers.map((offer) => toTradeOfferDto(offer, params.user.id));
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  );
}
