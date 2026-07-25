// ============================================================
// 浮空回收（明日方舟：终末地 · 气球）— 核心类型与升力计算
// 棋盘为奇数边长方阵：5×5（外圈倍率 ×2，默认）/ 7×7（×3）/ 9×9（×4），
// 越往外气球升力倍率越高（倍率 = 与中心格的环距）
// ============================================================

/** 格子坐标：[x, y]，x 为列（向右），y 为行（向下），范围 0 ~ grid-1 */
export type Cell = [number, number];

/** 棋盘边长：5（默认）/ 7 / 9 */
export const GRID_SIZES = [5, 7, 9] as const;
export type GridSize = (typeof GRID_SIZES)[number];
export const DEFAULT_GRID: GridSize = 5;

/** 棋盘中心格坐标 */
export const centerOf = (grid: number) => (grid - 1) / 2;

/** 每种棋盘的最大升力倍率（最外圈） */
export const maxLiftOf = (grid: number) => centerOf(grid);

/** 七种气球的升力值 */
export type BalloonValue = 1 | 2 | 3 | 6 | 9 | 12 | 18;

export const BALLOON_VALUES: BalloonValue[] = [1, 2, 3, 6, 9, 12, 18];

export const BALLOON_INFO: Record<
  BalloonValue,
  { name: string; color: string; rim: string; text: string }
> = {
  1: { name: '1级回收气球', color: '#dfe3e6', rim: '#9aa2a8', text: '#3a3f43' }, // 白色
  2: { name: '2级回收气球', color: '#e5d96b', rim: '#a89e3f', text: '#4a4416' }, // 淡黄
  3: { name: '3级回收气球', color: '#f2b90d', rim: '#b07f08', text: '#4d3405' }, // 黄色
  6: { name: '4级回收气球', color: '#f0a35c', rim: '#b26a2e', text: '#4d2a05' }, // 淡橙
  9: { name: '5级回收气球', color: '#ef7d1a', rim: '#a85410', text: '#fff2e0' }, // 橙色
  12: { name: '6级回收气球', color: '#ef9a94', rim: '#b25a52', text: '#4d1512' }, // 淡红
  18: { name: '7级回收气球', color: '#e04030', rim: '#962219', text: '#ffe8e0' }, // 红色
};

/** 关卡定义：棋盘边长 + 可放置格 + 提供的气球（所有气球数值之和即目标 Y） */
export interface BalloonLevel {
  name: string;
  grid: GridSize; // 旧分享码没有此字段，按 5 处理
  placeable: Cell[];
  balloons: BalloonValue[];
}

/** 一个已放置的气球 */
export interface Placed {
  x: number;
  y: number;
  value: BalloonValue;
}

export const cellKey = (x: number, y: number) => `${x},${y}`;

/** 区域灰度：中心格最浅，越往外越深（按环距 0~4 共五种灰度） */
export const CELL_SHADES = ['#5a6268', '#454b50', '#33383c', '#232729', '#171a1d'];

/** 格子所在区域的灰度色（按与中心格的环距） */
export const cellShade = (x: number, y: number, grid: number) => {
  const c = centerOf(grid);
  return CELL_SHADES[Math.max(Math.abs(x - c), Math.abs(y - c))];
};

/**
 * 单个气球对 x / y 两个轴的升力贡献（右 / 下为正方向）。
 * 倍率 = 该轴上与中心格的距离：中心格所在行/列为 0，逐圈 +1，
 * 最外圈即棋盘的最大倍率（5×5 为 2，7×7 为 3，9×9 为 4）
 */
export function cellLift(x: number, y: number, value: number, grid: number): { x: number; y: number } {
  const c = centerOf(grid);
  return { x: value * (x - c), y: value * (y - c) };
}

/** 所有已放置气球的净升力（0 / 0 = 平衡） */
export function netLift(placed: Placed[], grid: number): { x: number; y: number } {
  let nx = 0;
  let ny = 0;
  for (const p of placed) {
    const l = cellLift(p.x, p.y, p.value, grid);
    nx += l.x;
    ny += l.y;
  }
  return { x: nx, y: ny };
}

/** 每个轴正 / 负两侧的升力之和与气球数值之和（用于按比值计算棋盘倾斜角度） */
export function sideLift(
  placed: Placed[],
  grid: number,
): { xPos: number; xNeg: number; yPos: number; yNeg: number; xPosV: number; xNegV: number; yPosV: number; yNegV: number } {
  let xPos = 0, xNeg = 0, yPos = 0, yNeg = 0;
  let xPosV = 0, xNegV = 0, yPosV = 0, yNegV = 0;
  for (const p of placed) {
    const l = cellLift(p.x, p.y, p.value, grid);
    if (l.x > 0) { xPos += l.x; xPosV += p.value; }
    else if (l.x < 0) { xNeg -= l.x; xNegV += p.value; }
    if (l.y > 0) { yPos += l.y; yPosV += p.value; }
    else if (l.y < 0) { yNeg -= l.y; yNegV += p.value; }
  }
  return { xPos, xNeg, yPos, yNeg, xPosV, xNegV, yPosV, yNegV };
}

/**
 * 倾斜角度（沿一个轴）：
 * - 两侧都有力：按（大 − 小）/ 大 的比值决定，两侧越接近角度越小
 * - 只有一侧有力：按该侧气球的升力加权平均环距 / 最大环距决定，
 *   气球离中心越近角度越小，全放在最外圈时角度最大
 */
export function axisTilt(
  posForce: number,
  negForce: number,
  posValue: number,
  negValue: number,
  maxLift: number,
  maxDeg: number,
): number {
  const big = Math.max(posForce, negForce);
  if (big === 0) return 0;
  const sign = Math.sign(posForce - negForce);
  if (posForce === 0 || negForce === 0) {
    const v = posForce > 0 ? posValue : negValue;
    // force / value = 该侧气球的升力加权平均环距
    return maxDeg * (big / v / maxLift) * sign;
  }
  return maxDeg * ((big - Math.min(posForce, negForce)) / big) * sign;
}

/** 校验关卡是否合法（编辑器用），返回错误信息列表（空数组 = 合法） */
export function validateBalloonLevel(
  level: BalloonLevel,
  placed: Placed[],
): string[] {
  const errors: string[] = [];
  const { grid } = level;
  const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < grid && y < grid;
  const total = level.balloons.length;
  if (total === 0) errors.push('至少需要在网格上放置一个气球');
  if (level.placeable.length < total) {
    errors.push(`可放置格数量（${level.placeable.length}）小于气球数量（${total}）`);
  }
  const placeableSet = new Set(level.placeable.map(([x, y]) => cellKey(x, y)));
  for (const [x, y] of level.placeable) {
    if (!inBounds(x, y)) errors.push('可放置格越界');
  }
  const seen = new Set<string>();
  for (const p of placed) {
    if (!inBounds(p.x, p.y)) errors.push('有气球放在棋盘外');
    if (!placeableSet.has(cellKey(p.x, p.y))) errors.push('有气球放在不可放置的格子上');
    const k = cellKey(p.x, p.y);
    if (seen.has(k)) errors.push('同一格子上放了多个气球');
    seen.add(k);
  }
  // 所有添加的气球都必须放置在网格上（按种类数量一致）
  for (const v of BALLOON_VALUES) {
    const want = level.balloons.filter((b) => b === v).length;
    const got = placed.filter((p) => p.value === v).length;
    if (want !== got) {
      errors.push(`${BALLOON_INFO[v].name}：已放置 ${got}/${want}，所有添加的气球都必须放上网格`);
    }
  }
  if (placed.length > 0) {
    const net = netLift(placed, grid);
    if (net.x !== 0 || net.y !== 0) errors.push('放置的气球升力不平衡，需要左右、上下的升力都相互抵消');
  }
  return [...new Set(errors)];
}
