// ============================================================
// 溢彩画（鸣潮）— 核心类型定义
// 四种颜色，点击与选中颜色不同的格子，把它所在的同色连通区域
// 染成选中颜色；在限定步数内让所有可填色区域变成目标颜色
// ============================================================

/** 格子坐标：[x, y]，x 为列（向右），y 为行（向下） */
export type Cell = [number, number];

/** 四种可填颜色 */
export type FillColor = 'blue' | 'red' | 'yellow' | 'green';

export const FILL_COLORS: Record<
  FillColor,
  { name: string; main: string; light: string; dim: string }
> = {
  blue: { name: '蓝色', main: '#4a80c8', light: '#8ab4e8', dim: '#1d3050' },
  red: { name: '红色', main: '#d24a45', light: '#f08a80', dim: '#571f1c' },
  yellow: { name: '黄色', main: '#e3c45f', light: '#f6e3a5', dim: '#5c4c1f' },
  green: { name: '绿色', main: '#45b08a', light: '#86d9bc', dim: '#1c4a3a' },
};

export const ALL_COLORS: FillColor[] = ['blue', 'red', 'yellow', 'green'];

/** 格子内容：颜色 / 不可填色区域 / null（未填色，仅编辑器中间态，不合法） */
export type CellKind = FillColor | 'blocked' | null;

/** 关卡定义 */
export interface FillLevel {
  name: string;
  rows: number; // 3 - 10
  cols: number; // 3 - 12
  /** 目标颜色：所有可填色区域都要变成它 */
  target: FillColor;
  /** 步数限制 */
  steps: number;
  /** 格子内容，cells[y][x] */
  cells: CellKind[][];
}

export const MIN_GRID = 3;
export const MAX_COLS = 12;
export const MAX_ROWS = 10;
export const MIN_STEPS = 1;
export const MAX_STEPS = 20;

export const cellKey = (x: number, y: number) => `${x},${y}`;

const DIRS: Cell[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export const isFillColor = (k: unknown): k is FillColor =>
  k === 'blue' || k === 'red' || k === 'yellow' || k === 'green';

/** 深拷贝格子 */
export const cloneCells = (cells: CellKind[][]): CellKind[][] => cells.map((row) => [...row]);

/** 从 (x, y) 出发的同色四连通区域（不可填色 / 未填色不算区域） */
export function connectedRegion(cells: CellKind[][], x: number, y: number): Cell[] {
  const color = cells[y]?.[x];
  if (!isFillColor(color)) return [];
  const rows = cells.length;
  const cols = cells[0].length;
  const seen = new Set<string>([cellKey(x, y)]);
  const region: Cell[] = [[x, y]];
  const queue: Cell[] = [[x, y]];
  while (queue.length > 0) {
    const [cx, cy] = queue.pop()!;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const k = cellKey(nx, ny);
      if (seen.has(k) || cells[ny][nx] !== color) continue;
      seen.add(k);
      region.push([nx, ny]);
      queue.push([nx, ny]);
    }
  }
  return region;
}

/** 区域内按到起点的 BFS 距离分层（用于蔓延动画） */
export function regionLayers(region: Cell[], origin: Cell): Cell[][] {
  const set = new Set(region.map(([x, y]) => cellKey(x, y)));
  const dist = new Map<string, number>([[cellKey(origin[0], origin[1]), 0]]);
  let maxDist = 0;
  const queue: Cell[] = [origin];
  while (queue.length > 0) {
    const [cx, cy] = queue.shift()!;
    const d = dist.get(cellKey(cx, cy))!;
    for (const [dx, dy] of DIRS) {
      const k = cellKey(cx + dx, cy + dy);
      if (!set.has(k) || dist.has(k)) continue;
      dist.set(k, d + 1);
      maxDist = Math.max(maxDist, d + 1);
      queue.push([cx + dx, cy + dy]);
    }
  }
  const layers: Cell[][] = Array.from({ length: maxDist + 1 }, () => []);
  for (const c of region) layers[dist.get(cellKey(c[0], c[1]))!].push(c);
  return layers;
}

/** 把一组格子染成指定颜色，返回新格子 */
export function dyeCells(cells: CellKind[][], dye: Cell[], color: FillColor): CellKind[][] {
  const out = cloneCells(cells);
  for (const [x, y] of dye) out[y][x] = color;
  return out;
}

/** 胜利判定：所有可填色区域都是目标颜色 */
export function isComplete(cells: CellKind[][], target: FillColor): boolean {
  let any = false;
  for (const row of cells) {
    for (const k of row) {
      if (k === 'blocked' || k === null) continue;
      any = true;
      if (k !== target) return false;
    }
  }
  return any;
}

/** 校验关卡结构是否合法，返回错误信息列表（空数组 = 合法） */
export function validateFillLevel(level: FillLevel): string[] {
  const errors: string[] = [];
  const { rows, cols, cells } = level;
  if (cols < MIN_GRID || cols > MAX_COLS || rows < MIN_GRID || rows > MAX_ROWS) {
    errors.push(`网格尺寸必须在 ${MIN_GRID}~${MAX_COLS} 列 × ${MIN_GRID}~${MAX_ROWS} 行 之间`);
  }
  if (level.steps < MIN_STEPS || level.steps > MAX_STEPS) {
    errors.push(`步数必须在 ${MIN_STEPS}~${MAX_STEPS} 之间`);
  }
  if (!Array.isArray(cells) || cells.length !== rows || cells.some((r) => !Array.isArray(r) || r.length !== cols)) {
    errors.push('格子数据与网格尺寸不符');
    return [...new Set(errors)];
  }
  let fillable = 0;
  let uncolored = 0;
  const colors = new Set<FillColor>();
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const k = cells[y][x];
      if (k === 'blocked') continue;
      fillable++;
      if (k === null) uncolored++;
      else if (isFillColor(k)) colors.add(k);
      else errors.push('存在无法识别的格子内容');
    }
  }
  if (fillable === 0) errors.push('至少需要一格可填色区域');
  if (uncolored > 0) errors.push(`还有 ${uncolored} 格可填色区域没有填色`);
  if (colors.size < 3) errors.push('四种颜色中至少要有三种各存在一格');
  if (uncolored === 0 && fillable > 0 && isComplete(cells, level.target)) {
    errors.push('所有可填色区域已经是目标颜色，无需游玩');
  }
  return [...new Set(errors)];
}
