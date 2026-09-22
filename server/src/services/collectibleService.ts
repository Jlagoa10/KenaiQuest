import type { CollectibleDetailDto, CollectibleDto } from '@kenai/shared';
import { isTradeEligible } from '@kenai/shared';
import { AppError, ErrorCodes, forbidden, notFound } from '../utils/errors.js';
import { shortHash } from '../utils/crypto.js';
import * as collectibleRepository from '../repositories/collectibleRepository.js';
import * as artworkRepository from '../repositories/artworkRepository.js';
import type { CollectibleFilters } from '../repositories/collectibleRepository.js';
import type { CollectibleWithRelations, UserRecord } from '../types/models.js';

/**
 * A collectible's image never changes after it is minted, so its version is a
 * pure function of the frozen piece snapshot.
 */
function buildImageVersion(collectible: CollectibleWithRelations): string {
  return shortHash(`${collectible.id}:${collectible.ownedPieceIndexes.join(',')}`);
}

export function toCollectibleDto(collectible: CollectibleWithRelations): CollectibleDto {
  return {
    id: collectible.id,
    artwork: {
      id: collectible.artworkId,
      name: collectible.artworkName,
      description: collectible.artworkDescription,
      rarity: collectible.artworkRarity,
    },
    owner: { id: collectible.ownerId, name: collectible.ownerName },
    goalTitle: collectible.goalTitle,
    totalPieces: collectible.totalPieces,
    piecesObtained: collectible.piecesObtained,
    piecesMissed: collectible.totalPieces - collectible.piecesObtained,
    completionPercent: collectible.completionPercent,
    isPerfect: collectible.isPerfect,
    isTradeEligible: isTradeEligible(collectible.piecesObtained, collectible.totalPieces),
    isListedForTrade: collectible.isListedForTrade,
    hasPendingTrade: collectible.pendingTradeCount > 0,
    obtainedAt: collectible.obtainedAt.toISOString(),
    imageAspectRatio: collectible.artworkWidth / collectible.artworkHeight,
    imageVersion: buildImageVersion(collectible),
    ownedPieceIndexes: collectible.ownedPieceIndexes,
    sourceCompetitionId: collectible.sourceCompetitionId,
  };
}

function toCollectibleDetailDto(collectible: CollectibleWithRelations): CollectibleDetailDto {
  return {
    ...toCollectibleDto(collectible),
    sourceGoalId: collectible.sourceGoalId,
    earnedByName: collectible.earnedByName ?? collectible.ownerName,
  };
}

export async function listMyCollection(params: {
  user: UserRecord;
  filters: CollectibleFilters;
}): Promise<CollectibleDto[]> {
  const items = await collectibleRepository.listCollectiblesByOwner(
    params.user.id,
    params.filters,
  );
  return items.map(toCollectibleDto);
}

export async function getCollectibleDetail(params: {
  user: UserRecord;
  collectibleId: string;
}): Promise<CollectibleDetailDto> {
  const collectible = await collectibleRepository.findCollectibleById(params.collectibleId);
  if (!collectible) throw notFound('Colecionável não encontrado.');

  // Someone else's copy is visible only while it is listed for trade.
  if (collectible.ownerId !== params.user.id && !collectible.isListedForTrade) {
    throw forbidden('Este colecionável não está disponível para visualização.');
  }

  return toCollectibleDetailDto(collectible);
}

/** Ownership/visibility gate for the composited collectible image endpoint. */
export async function getCollectibleForImage(params: {
  user: UserRecord;
  collectibleId: string;
}): Promise<{
  collectible: CollectibleWithRelations;
  artwork: NonNullable<Awaited<ReturnType<typeof artworkRepository.findArtworkById>>>;
  imageVersion: string;
}> {
  const collectible = await collectibleRepository.findCollectibleById(params.collectibleId);
  if (!collectible) throw notFound('Colecionável não encontrado.');

  if (collectible.ownerId !== params.user.id && !collectible.isListedForTrade) {
    throw forbidden('Este colecionável não está disponível para visualização.');
  }

  const artwork = await artworkRepository.findArtworkById(collectible.artworkId);
  if (!artwork) throw notFound('Arte não encontrada.');

  return { collectible, artwork, imageVersion: buildImageVersion(collectible) };
}

export async function setListing(params: {
  user: UserRecord;
  collectibleId: string;
  listed: boolean;
}): Promise<CollectibleDto> {
  const existing = await collectibleRepository.findCollectibleById(params.collectibleId);
  if (!existing) throw notFound('Colecionável não encontrado.');
  if (existing.ownerId !== params.user.id) {
    throw new AppError(
      403,
      ErrorCodes.NOT_COLLECTIBLE_OWNER,
      'Este colecionável não pertence a você.',
    );
  }

  if (params.listed && !isTradeEligible(existing.piecesObtained, existing.totalPieces)) {
    throw new AppError(
      422,
      ErrorCodes.COLLECTIBLE_NOT_TRADABLE,
      'Apenas cópias com 90% ou mais podem ser trocadas.',
    );
  }

  const updated = await collectibleRepository.setCollectibleListing({
    id: params.collectibleId,
    ownerId: params.user.id,
    listed: params.listed,
  });

  if (!updated) {
    throw new AppError(
      422,
      ErrorCodes.COLLECTIBLE_NOT_TRADABLE,
      'Não foi possível atualizar a disponibilidade para troca.',
    );
  }

  const refreshed = await collectibleRepository.findCollectibleById(params.collectibleId);
  if (!refreshed) throw notFound('Colecionável não encontrado.');
  return toCollectibleDto(refreshed);
}

export async function listAvailableForTrade(params: {
  user: UserRecord;
  filters: CollectibleFilters;
}): Promise<CollectibleDto[]> {
  const items = await collectibleRepository.listAvailableForTrade(params.user.id, params.filters);
  return items.map(toCollectibleDto);
}
