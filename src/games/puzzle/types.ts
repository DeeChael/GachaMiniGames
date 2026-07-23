// ============================================================
// 拼图（明日方舟：终末地 · 源石电路模块）— 核心类型定义
// ============================================================

/** 格子坐标：[x, y]，x 为列（向右），y 为行（向下） */
export type Cell = [number, number];

/** 拼图颜色。整套游戏共三种颜色，单个关卡最多使用其中两种 */
export type PieceColor = 'green' | 'cyan' | 'orange';

export const PIECE_COLORS: Record<
  PieceColor,
  { name: string; main: string; light: string; dim: string; glow: string }
> = {
  green: { name: '荧绿', main: '#a6e22e', light: '#d6f28a', dim: '#3d4d14', glow: 'rgba(166,226,46,0.35)' },
  cyan: { name: '青色', main: '#1fe0b0', light: '#7ff0d2', dim: '#0d4a3b', glow: 'rgba(31,224,176,0.35)' },
  orange: { name: '橙黄', main: '#f0a832', light: '#ffd07d', dim: '#54401a', glow: 'rgba(240,168,50,0.35)' },
};

export const ALL_COLORS: PieceColor[] = ['green', 'cyan', 'orange'];

/** 预制 / 自定义形状 */
export interface Shape {
  id: string;
  name: string;
  /** 归一化后的格子集合（左上角对齐到 0,0） */
  cells: Cell[];
}

/** 关卡中的一块拼图 */
export interface LevelPiece {
  /** 形状格子（已归一化；预放置拼图保存的是旋转后的最终形状） */
  cells: Cell[];
  color: PieceColor;
  /** 是否预放置（锁定，不可移动） */
  locked?: boolean;
  /** 预放置时的左上角坐标 */
  x?: number;
  y?: number;
}

/** 关卡定义 */
export interface Level {
  name: string;
  rows: number; // 3 - 15
  cols: number; // 3 - 15
  /** 禁止放置的格子 */
  blocked: Cell[];
  pieces: LevelPiece[];
  /** 每行的颜色数量要求，长度为 rows，例如 { green: 4, cyan: 2 } */
  rowReq: ColorCount[];
  /** 每列的颜色数量要求，长度为 cols */
  colReq: ColorCount[];
}

/** 按颜色计数 */
export type ColorCount = Partial<Record<PieceColor, number>>;

export const MIN_GRID = 3;
export const MAX_GRID = 15;

/** 根据一组已放置的拼图（即关卡解）计算行列颜色需求 */
export function computeColorReq(
  rows: number,
  cols: number,
  placed: { cells: Cell[]; color: PieceColor; x: number; y: number }[],
): { rowReq: ColorCount[]; colReq: ColorCount[] } {
  const rowReq: ColorCount[] = Array.from({ length: rows }, () => ({}));
  const colReq: ColorCount[] = Array.from({ length: cols }, () => ({}));
  for (const p of placed) {
    for (const [cx, cy] of p.cells) {
      const gx = p.x + cx;
      const gy = p.y + cy;
      if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) continue;
      rowReq[gy][p.color] = (rowReq[gy][p.color] ?? 0) + 1;
      colReq[gx][p.color] = (colReq[gx][p.color] ?? 0) + 1;
    }
  }
  return { rowReq, colReq };
}

export const sumColorCount = (cc: ColorCount): number =>
  ALL_COLORS.reduce((s, c) => s + (cc[c] ?? 0), 0);

// ---------------- 工具函数 ----------------

export const cellKey = (x: number, y: number) => `${x},${y}`;

/** 归一化：把形状平移到最小 x/y 为 0 */
export function normalizeCells(cells: Cell[]): Cell[] {
  const minX = Math.min(...cells.map((c) => c[0]));
  const minY = Math.min(...cells.map((c) => c[1]));
  return cells.map(([x, y]) => [x - minX, y - minY] as Cell);
}

/** 顺时针旋转 90°，重复 rotation 次，并归一化 */
export function rotateCells(cells: Cell[], rotation: number): Cell[] {
  let out = cells.map((c) => [...c] as Cell);
  const r = ((rotation % 4) + 4) % 4;
  for (let i = 0; i < r; i++) {
    out = out.map(([x, y]) => [-y, x] as Cell);
    out = normalizeCells(out);
  }
  return out;
}

/** 形状去重用的签名 */
export function cellsSignature(cells: Cell[]): string {
  return normalizeCells(cells)
    .map(([x, y]) => `${x},${y}`)
    .sort()
    .join(';');
}

/** 形状的宽高 */
export function shapeBounds(cells: Cell[]): { w: number; h: number } {
  return {
    w: Math.max(...cells.map((c) => c[0])) + 1,
    h: Math.max(...cells.map((c) => c[1])) + 1,
  };
}

/** 判断一组格子是否四连通（自定义形状要求所有方块相连） */
export function isConnectedCells(cells: Cell[]): boolean {
  if (cells.length <= 1) return true;
  const set = new Set(cells.map(([x, y]) => cellKey(x, y)));
  const seen = new Set<string>([cellKey(cells[0][0], cells[0][1])]);
  const queue: Cell[] = [cells[0]];
  while (queue.length > 0) {
    const [x, y] = queue.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as Cell[]) {
      const k = cellKey(x + dx, y + dy);
      if (set.has(k) && !seen.has(k)) {
        seen.add(k);
        queue.push([x + dx, y + dy]);
      }
    }
  }
  return seen.size === cells.length;
}

/** 找到最靠近形状重心的格子（用于锁定图标的显示位置） */
export function centroidCell(cells: Cell[]): Cell {
  const cx = cells.reduce((s, c) => s + c[0], 0) / cells.length;
  const cy = cells.reduce((s, c) => s + c[1], 0) / cells.length;
  let best = cells[0];
  let bd = Infinity;
  for (const c of cells) {
    const d = (c[0] - cx) ** 2 + (c[1] - cy) ** 2;
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return best;
}

/** 校验关卡结构是否合法，返回错误信息列表（空数组 = 合法） */
export function validateLevel(level: Level): string[] {
  const errors: string[] = [];
  const { rows, cols, blocked, pieces } = level;
  if (rows < MIN_GRID || rows > MAX_GRID || cols < MIN_GRID || cols > MAX_GRID) {
    errors.push(`网格尺寸必须在 ${MIN_GRID}~${MAX_GRID} 之间`);
  }
  const blockedSet = new Set(blocked.map(([x, y]) => cellKey(x, y)));
  for (const [x, y] of blocked) {
    if (x < 0 || y < 0 || x >= cols || y >= rows) errors.push('存在越界的禁用格');
  }
  const colors = new Set<PieceColor>();
  let pieceCells = 0;
  const occupied = new Set<string>();
  for (const p of pieces) {
    colors.add(p.color);
    pieceCells += p.cells.length;
    if (p.cells.length === 0) errors.push('存在没有格子的拼图');
    if (p.locked) {
      if (p.x === undefined || p.y === undefined) {
        errors.push('预放置拼图缺少坐标');
      } else {
        for (const [cx, cy] of p.cells) {
          const gx = p.x + cx;
          const gy = p.y + cy;
          const k = cellKey(gx, gy);
          if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) errors.push('预放置拼图越界');
          if (blockedSet.has(k)) errors.push('预放置拼图压在禁用格上');
          if (occupied.has(k)) errors.push('预放置拼图互相重叠');
          occupied.add(k);
        }
      }
    }
  }
  if (colors.size > 2) errors.push('一个关卡最多使用 2 种颜色');
  if (pieces.length === 0) errors.push('至少需要一块拼图');
  if (pieces.length > 0 && pieces.every((p) => p.locked)) {
    errors.push('至少需要一块玩家可拖动的拼图（不能全部是预放置锁定）');
  }
  const fillable = rows * cols - blocked.length;
  if (pieceCells > fillable) {
    errors.push(`拼图总格子数（${pieceCells}）超过了可放置格子数（${fillable}）`);
  }
  // 行列颜色需求校验（关卡允许留空格，因此需求数量只需不超过可放置格数）
  if (level.rowReq.length !== rows || level.colReq.length !== cols) {
    errors.push('行列颜色需求的长度与网格尺寸不符');
  } else {
    for (let y = 0; y < rows; y++) {
      const rowFillable = Array.from({ length: cols }, (_, x) => x).filter((x) => !blockedSet.has(cellKey(x, y))).length;
      if (sumColorCount(level.rowReq[y]) > rowFillable) errors.push(`第 ${y + 1} 行的颜色数量要求超过了可放置格数`);
    }
    for (let x = 0; x < cols; x++) {
      const colFillable = Array.from({ length: rows }, (_, y) => y).filter((y) => !blockedSet.has(cellKey(x, y))).length;
      if (sumColorCount(level.colReq[x]) > colFillable) errors.push(`第 ${x + 1} 列的颜色数量要求超过了可放置格数`);
    }
    // 每种颜色的需求总数必须等于该颜色拼图的格子总数
    for (const c of colors) {
      const inPieces = pieces.filter((p) => p.color === c).reduce((s, p) => s + p.cells.length, 0);
      const inRows = level.rowReq.reduce((s, r) => s + (r[c] ?? 0), 0);
      const inCols = level.colReq.reduce((s, r) => s + (r[c] ?? 0), 0);
      if (inPieces !== inRows || inPieces !== inCols) {
        errors.push(`颜色「${PIECE_COLORS[c].name}」的需求总数与拼图格子数不一致`);
      }
    }
  }
  return [...new Set(errors)];
}
