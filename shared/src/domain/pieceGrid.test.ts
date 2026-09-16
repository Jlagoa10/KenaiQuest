import { describe, expect, it } from 'vitest';
import { MAX_GOAL_DURATION_DAYS, MIN_GOAL_DURATION_DAYS } from '../constants/goals.js';
import { cellToPixelRect, computePieceGrid } from './pieceGrid.js';

const ALL_DURATIONS = Array.from(
  { length: MAX_GOAL_DURATION_DAYS - MIN_GOAL_DURATION_DAYS + 1 },
  (_, i) => MIN_GOAL_DURATION_DAYS + i,
);

describe('computePieceGrid', () => {
  it('produces exactly one piece per goal day for every supported duration', () => {
    for (const duration of ALL_DURATIONS) {
      const grid = computePieceGrid(duration, 1);
      expect(grid.cells).toHaveLength(duration);
      expect(grid.totalPieces).toBe(duration);
    }
  });

  it('assigns unique sequential indexes', () => {
    for (const duration of [7, 30, 31, 100, 365]) {
      const grid = computePieceGrid(duration);
      const indexes = grid.cells.map((cell) => cell.index);
      expect(new Set(indexes).size).toBe(duration);
      expect(indexes).toEqual(indexes.slice().sort((a, b) => a - b));
    }
  });

  it('covers the whole image: cell areas always sum to 1', () => {
    for (const duration of ALL_DURATIONS) {
      for (const aspect of [0.5, 1, 1.5, 2]) {
        const grid = computePieceGrid(duration, aspect);
        const area = grid.cells.reduce((sum, cell) => sum + cell.width * cell.height, 0);
        expect(area).toBeCloseTo(1, 8);
      }
    }
  });

  it('keeps every cell inside the image bounds', () => {
    for (const duration of ALL_DURATIONS) {
      for (const cell of computePieceGrid(duration, 1.4).cells) {
        expect(cell.x).toBeGreaterThanOrEqual(0);
        expect(cell.y).toBeGreaterThanOrEqual(0);
        expect(cell.x + cell.width).toBeLessThanOrEqual(1 + 1e-9);
        expect(cell.y + cell.height).toBeLessThanOrEqual(1 + 1e-9);
        expect(cell.width).toBeGreaterThan(0);
        expect(cell.height).toBeGreaterThan(0);
      }
    }
  });

  it('never overlaps cells within a row and tiles rows contiguously', () => {
    for (const duration of ALL_DURATIONS) {
      const grid = computePieceGrid(duration, 1);
      for (let row = 0; row < grid.rows; row += 1) {
        const rowCells = grid.cells.filter((cell) => cell.row === row);
        expect(rowCells).toHaveLength(grid.cellsPerRow[row]);
        let cursor = 0;
        for (const cell of rowCells) {
          expect(cell.x).toBeCloseTo(cursor, 8);
          cursor += cell.width;
        }
        expect(cursor).toBeCloseTo(1, 8);
      }
      expect(grid.cellsPerRow.reduce((sum, count) => sum + count, 0)).toBe(duration);
    }
  });

  it('lays a 30 day goal out as 5 rows of 6, as described in the spec', () => {
    const grid = computePieceGrid(30, 1);
    expect(grid.rows).toBe(5);
    expect(grid.cellsPerRow).toEqual([6, 6, 6, 6, 6]);
  });

  it('keeps exactly 31 pieces when the count is not a perfect rectangle', () => {
    const grid = computePieceGrid(31, 1);
    expect(grid.cells).toHaveLength(31);
    expect(grid.cellsPerRow.reduce((sum, count) => sum + count, 0)).toBe(31);
    // Uneven rows are expected: some rows carry one extra cell.
    expect(new Set(grid.cellsPerRow).size).toBeGreaterThan(1);
  });

  it('adapts the row count to the image aspect ratio', () => {
    const wide = computePieceGrid(24, 2);
    const tall = computePieceGrid(24, 0.5);
    expect(wide.rows).toBeLessThan(tall.rows);
    expect(wide.cells).toHaveLength(24);
    expect(tall.cells).toHaveLength(24);
  });

  it('rejects durations below one piece', () => {
    expect(() => computePieceGrid(0)).toThrow();
    expect(() => computePieceGrid(2.5)).toThrow();
  });
});

describe('cellToPixelRect', () => {
  it('produces non-empty rects that stay inside the source image', () => {
    const width = 1024;
    const height = 768;
    for (const cell of computePieceGrid(365, width / height).cells) {
      const rect = cellToPixelRect(cell, width, height);
      expect(rect.width).toBeGreaterThan(0);
      expect(rect.height).toBeGreaterThan(0);
      expect(rect.left + rect.width).toBeLessThanOrEqual(width);
      expect(rect.top + rect.height).toBeLessThanOrEqual(height);
    }
  });
});
