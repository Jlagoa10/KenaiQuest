import { useEffect, useId, useMemo, useState } from 'react';
import type { PieceStateDto } from '@kenai/shared';
import { computePieceGrid } from '@kenai/shared';
import { cn } from '../../utils/cn';
import { useAuthenticatedImage } from '../../hooks/useAuthenticatedImage';

interface KenaiPuzzleProps {
  /** Server-composited PNG containing ONLY the revealed regions. */
  imageUrl: string;
  totalPieces: number;
  aspectRatio: number;
  pieces: PieceStateDto[];
  /** Piece to animate in, set right after the user completes a day. */
  highlightPieceIndex?: number | null;
  className?: string;
  /** Accessible summary, e.g. "Imagem misteriosa, 12 de 30 peças reveladas". */
  label: string;
}

/**
 * Renders the partially revealed artwork.
 *
 * The <img> is the server's composite: it contains the unlocked regions on a
 * transparent background, so no locked pixel is ever delivered to the browser.
 * Everything else here is an overlay drawn from the SHARED grid algorithm,
 * which guarantees the outlines line up exactly with the regions the server
 * rendered.
 *
 * Drawing the placeholders client-side (rather than baking them into the PNG)
 * is what lets a locked cell follow the active theme and lets a newly revealed
 * piece animate in.
 */
export function KenaiPuzzle({
  imageUrl,
  totalPieces,
  aspectRatio,
  pieces,
  highlightPieceIndex = null,
  className,
  label,
}: KenaiPuzzleProps) {
  // The endpoint is Bearer-authenticated, so the bytes have to be fetched and
  // handed to the <img> as an object URL — a plain src cannot carry the header.
  const { src, isLoading } = useAuthenticatedImage(imageUrl);
  const [isDecoded, setIsDecoded] = useState(false);
  const [animatingPiece, setAnimatingPiece] = useState<number | null>(null);

  const grid = useMemo(
    () => computePieceGrid(totalPieces, aspectRatio),
    [totalPieces, aspectRatio],
  );

  const stateByIndex = useMemo(() => {
    const map = new Map<number, PieceStateDto['state']>();
    for (const piece of pieces) map.set(piece.pieceIndex, piece.state);
    return map;
  }, [pieces]);

  // Re-show the loading state only when the composite actually changes.
  useEffect(() => {
    setIsDecoded(false);
  }, [src]);

  useEffect(() => {
    if (highlightPieceIndex === null) return undefined;
    setAnimatingPiece(highlightPieceIndex);
    const timer = setTimeout(() => setAnimatingPiece(null), 900);
    return () => clearTimeout(timer);
  }, [highlightPieceIndex]);

  // Thin strokes would disappear on a 365-piece grid, so the outline weight
  // scales down as the cells get smaller.
  const strokeWidth = totalPieces > 200 ? 0.1 : totalPieces > 80 ? 0.15 : 0.25;

  // Several puzzles can share a page, and an SVG pattern id must be unique
  // across the document or they would all resolve to the first one.
  const patternId = `kq-missed-${useId().replace(/:/g, '')}`;

  return (
    <div
      className={cn('relative w-full overflow-hidden rounded-xl', className)}
      style={{
        aspectRatio: `${aspectRatio}`,
        backgroundColor: 'var(--bg-inset)',
      }}
      role="img"
      aria-label={label}
    >
      {(isLoading || (src !== null && !isDecoded)) && (
        <div className="kq-skeleton absolute inset-0" aria-hidden="true" />
      )}

      {src && (
        <img
          src={src}
          alt=""
          aria-hidden="true"
          onLoad={() => setIsDecoded(true)}
          className={cn(
            'absolute inset-0 h-full w-full object-fill transition-opacity duration-300',
            isDecoded ? 'opacity-100' : 'opacity-0',
          )}
          draggable={false}
        />
      )}

      {/* Overlay in a 0..100 user space so it scales with the container. */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          {/*
            Permanently missing pieces get a diagonal hatch. Colour alone was not
            enough to separate them from pieces that are merely still locked, and
            on a finished copy that distinction is the whole point. The pattern
            also reads as "intentionally empty" rather than as a failed image.
            patternTransform keeps the stripes at a true 45 degrees despite the
            non-uniform viewBox scaling.
          */}
          <pattern
            id={patternId}
            width="2.4"
            height="2.4"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="2.4" height="2.4" fill="var(--piece-missed)" />
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="2.4"
              stroke="var(--piece-missed-line)"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        {grid.cells.map((cell) => {
          const state = stateByIndex.get(cell.index) ?? 'LOCKED';
          if (state === 'REVEALED') return null;

          const isMissed = state === 'MISSED';
          return (
            <rect
              key={cell.index}
              x={cell.x * 100}
              y={cell.y * 100}
              width={cell.width * 100}
              height={cell.height * 100}
              fill={isMissed ? `url(#${patternId})` : 'var(--piece-locked)'}
              stroke={isMissed ? 'var(--piece-missed-line)' : 'var(--piece-locked-line)'}
              strokeWidth={strokeWidth}
              // A missed piece is a permanent hole, not a pending one: the
              // dashed outline distinguishes the two without relying on colour.
              strokeDasharray={isMissed ? '1.5 1.2' : undefined}
            />
          );
        })}

        {/* The freshly revealed cell flashes once, then settles. */}
        {animatingPiece !== null &&
          (() => {
            const cell = grid.cells[animatingPiece];
            if (!cell) return null;
            return (
              <rect
                className="kq-piece-reveal"
                x={cell.x * 100}
                y={cell.y * 100}
                width={cell.width * 100}
                height={cell.height * 100}
                fill="none"
                stroke="var(--brand-accent)"
                strokeWidth={Math.max(strokeWidth * 3, 0.5)}
              />
            );
          })()}
      </svg>
    </div>
  );
}
