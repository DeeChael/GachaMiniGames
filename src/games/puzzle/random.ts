// ============================================================
// 随机关卡生成器 —— 只使用 presetShapes.ts 中的预制形状
// 原理：随机选择禁用格后，用回溯算法把剩余区域完全铺满，
//       铺满的方案本身就是关卡的解，因此生成的关卡必然可解。
// ============================================================

import type { Cell, Level, LevelPiece, PieceColor } from './types';
import { cellKey, normalizeCells, rotateCells, cellsSignature, computeColorReq } from './types';
import { solvable } from './solver';
import { PRESET_SHAPES } from './presetShapes';

export type RandomDifficulty = 'easy' | 'normal' | 'hard';

interface Placement {
  cells: Cell[]; // 旋转归一化后
  color: PieceColor;
  x: number;
  y: number;
}

/** 可复现的随机数（LCG） */
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 形状的所有去重旋转形态 */
function orientations(cells: Cell[]): Cell[][] {
  const seen = new Set<string>();
  const out: Cell[][] = [];
  for (let r = 0; r < 4; r++) {
    const rotated = rotateCells(cells, r);
    const sig = cellsSignature(rotated);
    if (!seen.has(sig)) {
      seen.add(sig);
      out.push(rotated);
    }
  }
  return out;
}

/** 回溯铺满 fillable 区域；返回放置方案或 null */
function tileRegion(
  cols: number,
  rows: number,
  blockedSet: Set<string>,
  shapePool: Cell[][][],
  rng: () => number,
  maxNodes = 40000,
): Placement[] | null {
  const fillable: Cell[] = [];
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++)
      if (!blockedSet.has(cellKey(x, y))) fillable.push([x, y]);

  const filled = new Set<string>();
  const placements: Placement[] = [];
  let nodes = 0;

  // 每次随机化形状顺序，增加多样性
  const pool = shapePool.map((oris) => shuffle(oris, rng));

  function firstEmpty(): Cell | null {
    for (const [x, y] of fillable) if (!filled.has(cellKey(x, y))) return [x, y];
    return null;
  }

  function dfs(): boolean {
    if (++nodes > maxNodes) return false;
    const target = firstEmpty();
    if (!target) return true;
    const [tx, ty] = target;

    const shapeOrder = shuffle(pool.map((_, i) => i), rng);
    for (const si of shapeOrder) {
      {
        for (const cells of pool[si]) {
          // 形状中的任意一格都可以对齐到 target
          for (const [ax, ay] of cells) {
            const ox = tx - ax;
            const oy = ty - ay;
            let ok = true;
            for (const [cx, cy] of cells) {
              const gx = ox + cx;
              const gy = oy + cy;
              if (
                gx < 0 || gy < 0 || gx >= cols || gy >= rows ||
                blockedSet.has(cellKey(gx, gy)) || filled.has(cellKey(gx, gy))
              ) {
                ok = false;
                break;
              }
            }
            if (!ok) continue;
            for (const [cx, cy] of cells) filled.add(cellKey(ox + cx, oy + cy));
            placements.push({ cells, color: 'green', x: ox, y: oy });
            if (dfs()) return true;
            placements.pop();
            for (const [cx, cy] of cells) filled.delete(cellKey(ox + cx, oy + cy));
          }
        }
      }
    }
    return false;
  }

  return dfs() ? placements : null;
}

/** 生成随机关卡（同时返回解，供测试 / 调试核对可解性） */
export function generateRandomLevelWithSolution(
  difficulty: RandomDifficulty = 'normal',
  seed: number = Math.floor(Math.random() * 2 ** 31),
): { level: Level; solution: { cells: Cell[]; color: PieceColor; x: number; y: number }[] } {
  const rng = makeRng(seed);

  const sizeRange =
    difficulty === 'easy' ? [3, 5] : difficulty === 'normal' ? [4, 7] : [6, 10];
  // 各难度的拼图块数上限与挖空数量（挖空 = 留空格，让颜色需求成为约束）
  const maxPieces = difficulty === 'easy' ? 6 : difficulty === 'normal' ? 8 : 12;
  const maxDrop = difficulty === 'easy' ? 2 : difficulty === 'normal' ? 3 : 4;

  for (let attempt = 0; attempt < 60; attempt++) {
    const cols = sizeRange[0] + Math.floor(rng() * (sizeRange[1] - sizeRange[0] + 1));
    const rows = sizeRange[0] + Math.floor(rng() * (sizeRange[1] - sizeRange[0] + 1));

    // 随机禁用格（困难模式更多）
    const blockedSet = new Set<string>();
    const blocked: Cell[] = [];
    const blockedCount =
      rng() < 0.65
        ? Math.floor(rng() * (difficulty === 'hard' ? 5 : 3)) + (difficulty === 'easy' ? 0 : 1)
        : 0;
    for (let i = 0; i < blockedCount; i++) {
      const x = Math.floor(rng() * cols);
      const y = Math.floor(rng() * rows);
      const k = cellKey(x, y);
      if (!blockedSet.has(k)) {
        blockedSet.add(k);
        blocked.push([x, y]);
      }
    }
    if (cols * rows - blocked.length < 6) continue;

    // 从预制形状中随机挑一批（排除单格，避免全是碎块）
    // 固定带上二连条和一个三格形状，保证任何区域都有机会铺满
    const candidates = PRESET_SHAPES.filter((s) => s.cells.length >= 4);
    const small = PRESET_SHAPES.filter((s) => s.cells.length === 2 || s.cells.length === 3);
    const poolSize = 2 + Math.floor(rng() * 4);
    const chosen = [
      ...shuffle(small, rng).slice(0, 2),
      ...shuffle(candidates, rng).slice(0, poolSize),
    ];
    const pool = chosen.map((s) => orientations(normalizeCells(s.cells)));

    const placements = tileRegion(cols, rows, blockedSet, pool, rng, 3000);
    if (!placements || placements.length < 4) continue;
    if (placements.length > maxPieces) continue;

    // 挖掉若干拼图作为「空格」：不要求全填满，让颜色需求成为真正的约束
    const dropCount = Math.min(1 + Math.floor(rng() * maxDrop), placements.length - 3);
    {
      const dropIdxs = new Set(shuffle(placements.map((_, i) => i), rng).slice(0, dropCount));
      for (let i = placements.length - 1; i >= 0; i--) {
        if (dropIdxs.has(i)) placements.splice(i, 1);
      }
    }

    // 1~2 种颜色
    const colorPairs: PieceColor[][] = [
      ['green'], ['cyan'], ['orange'],
      ['green', 'cyan'], ['green', 'orange'], ['cyan', 'orange'],
    ];
    const palette = colorPairs[Math.floor(rng() * colorPairs.length)];

    const pieces: LevelPiece[] = placements.map((p) => ({
      cells: p.cells,
      color: palette[Math.floor(rng() * palette.length)],
    }));

    // 普通/困难：把 1~2 块拼图设为预放置
    if (difficulty !== 'easy' && pieces.length >= 4 && rng() < 0.7) {
      const lockCount = 1 + Math.floor(rng() * 2);
      const idxs = shuffle(pieces.map((_, i) => i), rng).slice(0, lockCount);
      for (const i of idxs) {
        pieces[i].locked = true;
        pieces[i].x = placements[i].x;
        pieces[i].y = placements[i].y;
      }
    }

    // 根据解计算行列颜色需求（颜色是解谜条件，不只是外观）
    const solution = placements.map((p, i) => ({
      cells: p.cells,
      color: pieces[i].color,
      x: p.x,
      y: p.y,
    }));
    const { rowReq, colReq } = computeColorReq(rows, cols, solution);

    const level: Level = {
      name: `随机关卡 #${(seed % 9000 + 1000).toString()}`,
      rows,
      cols,
      blocked,
      pieces,
      rowReq,
      colReq,
    };

    // 独立求解器二次确认可解（与生成算法不同的搜索路径，双保险）
    if (!solvable(level, 150000)) continue;

    return { level, solution };
  }

  // 兜底：几乎不可能走到这里
  const fallbackPieces: LevelPiece[] = [0, 1, 2].map(() => ({
    cells: [[0, 0], [1, 0], [2, 0]] as Cell[],
    color: 'green' as PieceColor,
  }));
  const fbSolution = fallbackPieces.map((p, i) => ({ cells: p.cells, color: p.color, x: 0, y: i }));
  const fb = computeColorReq(3, 3, fbSolution);
  return {
    level: { name: '随机关卡', rows: 3, cols: 3, blocked: [], pieces: fallbackPieces, rowReq: fb.rowReq, colReq: fb.colReq },
    solution: fbSolution,
  };
}

/** 生成随机关卡 */
export function generateRandomLevel(
  difficulty: RandomDifficulty = 'normal',
  seed: number = Math.floor(Math.random() * 2 ** 31),
): Level {
  return generateRandomLevelWithSolution(difficulty, seed).level;
}
