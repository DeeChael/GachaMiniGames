// ============================================================
// 内置关卡 —— 以「解」的形式书写，行列颜色需求自动计算
// 关卡刻意留有空格：颜色需求才是真正的约束
// ============================================================

import type { Cell, Level, LevelPiece, PieceColor } from './types';
import { computeColorReq } from './types';

interface SolutionPiece {
  cells: Cell[];
  color: PieceColor;
  x: number;
  y: number;
  /** 是否预放置（锁定，不可移动） */
  locked?: boolean;
}

function makeLevel(
  name: string,
  rows: number,
  cols: number,
  blocked: Cell[],
  solution: SolutionPiece[],
): Level {
  const { rowReq, colReq } = computeColorReq(rows, cols, solution);
  const pieces: LevelPiece[] = solution.map((p) => {
    const out: LevelPiece = { cells: p.cells, color: p.color };
    if (p.locked) {
      out.locked = true;
      out.x = p.x;
      out.y = p.y;
    }
    return out;
  });
  return { name, rows, cols, blocked, pieces, rowReq, colReq };
}

const I4H: Cell[] = [[0, 0], [1, 0], [2, 0], [3, 0]]; // 横向四连条
const I4V: Cell[] = [[0, 0], [0, 1], [0, 2], [0, 3]]; // 纵向四连条
const T4: Cell[] = [[0, 0], [1, 0], [2, 0], [1, 1]]; // T 形
const L4: Cell[] = [[0, 0], [0, 1], [0, 2], [1, 2]]; // L 形
const CORNER3: Cell[] = [[0, 0], [0, 1], [1, 1]]; // 小拐角
const SQ22: Cell[] = [[0, 0], [1, 0], [0, 1], [1, 1]]; // 方块 2×2
const DOMINO: Cell[] = [[0, 0], [1, 0]]; // 二连条

export const BUILTIN_LEVELS: Level[] = [
  // 教学：7 / 12 格，学习「空格也是被允许的」
  makeLevel('教学 · 初次修复', 3, 4, [], [
    { cells: T4, color: 'green', x: 0, y: 0 },
    { cells: CORNER3, color: 'cyan', x: 2, y: 1 },
  ]),
  // 双色：14 / 24 格，行列同时有两种颜色的需求
  makeLevel('双色回路', 5, 5, [[2, 2]], [
    { cells: SQ22, color: 'green', x: 0, y: 0 },
    { cells: L4, color: 'cyan', x: 3, y: 0 },
    { cells: T4, color: 'green', x: 0, y: 3 },
    { cells: DOMINO, color: 'cyan', x: 3, y: 4 },
  ]),
  // 封锁区域：16 / 24 格，含预放置锁定拼图与整列的空缺
  makeLevel('封锁区域', 5, 5, [[0, 0]], [
    { cells: I4H, color: 'orange', x: 1, y: 0, locked: true },
    { cells: I4V, color: 'green', x: 0, y: 1 },
    { cells: I4V, color: 'orange', x: 2, y: 1 },
    { cells: I4V, color: 'green', x: 4, y: 1 },
  ]),
];
