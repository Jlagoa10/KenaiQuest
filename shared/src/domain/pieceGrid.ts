/**
 * Image piece geometry.
 *
 * A goal of N days divides its artwork into EXACTLY N regions that together cover
 * 100% of the image. The layout is deterministic: the server and the client both
 * derive it from (totalPieces, aspectRatio) and always agree, so no geometry ever
 * travels over the wire.
 *
 * Strategy (spec section 19):
 *   - pick a row count that makes cells as close to square as the image allows;
 *   - distribute N cells across those rows, letting the first `remainder` rows
 *     carry one extra cell, so the count is exact for every N (no square-grid
 *     assumption — 31 pieces works exactly like 30);
 *   - each row spans a full 1/rows slice of the height, and its cells split that
 *     row's width evenly, which guarantees full coverage with no gaps or overlaps.
 *
 * All values are fractions of the image (0..1), so the same grid scales to any
 * rendered size and to the original pixel dimensions during server compositing.
 */

export interface PieceCell {
  /** Row-major index, 0-based. This is the value stored in `goal_days.piece_index`. */
  index: number;
  row: number;
  column: number;
  /** Left edge as a fraction of image width. */
  x: number;
  /** Top edge as a fraction of image height. */
  y: number;
  /** Width as a fraction of image width. */
  width: number;
  /** Height as a fraction of image height. */
  height: number;
}

export interface PieceGrid {
  totalPieces: number;
  rows: number;
  /** Number of cells in each row, top to bottom. */
  cellsPerRow: number[];
  cells: PieceCell[];
}

export const MIN_PIECES = 1;

/**
 * Number of rows that best approximates square cells.
 * Derived from rows x cols ~= N and cellWidth == cellHeight, which gives
 * rows = sqrt(N / aspectRatio) where aspectRatio = width / height.
 */
export function computeRowCount(totalPieces: number, aspectRatio: number): number {
  const safeAspect = Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 1;
  const ideal = Math.sqrt(totalPieces / safeAspect);
  const rounded = Math.round(ideal);
  return Math.min(Math.max(rounded, 1), totalPieces);
}

export function computePieceGrid(totalPieces: number, aspectRatio = 1): PieceGrid {
  if (!Number.isInteger(totalPieces) || totalPieces < MIN_PIECES) {
    throw new Error(`totalPieces must be an integer >= ${MIN_PIECES}, received ${totalPieces}`);
  }

  const rows = computeRowCount(totalPieces, aspectRatio);
  const baseCells = Math.floor(totalPieces / rows);
  const remainder = totalPieces % rows;

  const cellsPerRow: number[] = [];
  for (let row = 0; row < rows; row += 1) {
    cellsPerRow.push(row < remainder ? baseCells + 1 : baseCells);
  }

  const cells: PieceCell[] = [];
  const rowHeight = 1 / rows;
  let index = 0;

  for (let row = 0; row < rows; row += 1) {
    const cellsInRow = cellsPerRow[row] ?? 0;
    const cellWidth = 1 / cellsInRow;
    // The final cell of a row and the final row absorb floating point drift so the
    // grid always ends exactly on the image edge.
    const y = row === rows - 1 ? 1 - rowHeight : row * rowHeight;
    const height = row === rows - 1 ? 1 - row * rowHeight : rowHeight;

    for (let column = 0; column < cellsInRow; column += 1) {
      const x = column === cellsInRow - 1 ? 1 - cellWidth : column * cellWidth;
      const width = column === cellsInRow - 1 ? 1 - column * cellWidth : cellWidth;
      cells.push({ index, row, column, x, y, width, height });
      index += 1;
    }
  }

  return { totalPieces, rows, cellsPerRow, cells };
}

/** Convert a fractional cell to integer pixel bounds, clamped inside the image. */
export function cellToPixelRect(
  cell: PieceCell,
  imageWidth: number,
  imageHeight: number,
): { left: number; top: number; width: number; height: number } {
  const left = Math.round(cell.x * imageWidth);
  const top = Math.round(cell.y * imageHeight);
  const right = Math.round((cell.x + cell.width) * imageWidth);
  const bottom = Math.round((cell.y + cell.height) * imageHeight);

  const clampedLeft = Math.min(Math.max(left, 0), Math.max(imageWidth - 1, 0));
  const clampedTop = Math.min(Math.max(top, 0), Math.max(imageHeight - 1, 0));

  return {
    left: clampedLeft,
    top: clampedTop,
    width: Math.max(1, Math.min(right, imageWidth) - clampedLeft),
    height: Math.max(1, Math.min(bottom, imageHeight) - clampedTop),
  };
}
