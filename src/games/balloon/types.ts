// ============================================================
// 浮空回收（明日方舟：终末地 · 气球）— 核心类型与升力计算
// 5x5 网格：中心格 / 中圈 3x3 / 外圈，越往外气球升力倍率越高
// ============================================================

/** 格子坐标：[x, y]，x 为列（向右），y 为行（向下），范围 0~4 */
export type Cell = [number, number];

export const GRID = 5;
export const CENTER = 2;

/** 四种气球的升力值 */
export type BalloonValue = 1 | 2 | 3 | 6;

export const BALLOON_VALUES: BalloonValue[] = [1, 2, 3, 6];

export const BALLOON_INFO: Record<
  BalloonValue,
  { name: string; color: string; rim: string; text: string }
> = {
  1: { name: '1级回收气球', color: '#dfe3e6', rim: '#9aa2a8', text: '#3a3f43' },
  2: { name: '2级回收气球', color: '#e5d96b', rim: '#a89e3f', text: '#4a4416' },
  3: { name: '3级回收气球', color: '#f2b90d', rim: '#b07f08', text: '#4d3405' },
  6: { name: '4级回收气球', color: '#a34d16', rim: '#6e3210', text: '#f5d9b8' },
};

/** 关卡定义：可放置格 + 提供的气球（所有气球数值之和即目标 Y） */
export interface BalloonLevel {
  name: string;
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

/** 区域灰度：中心格最浅，越往外越深（三种灰度，0=中心 1=中圈 2=外圈） */
export const CELL_SHADES = ['#5a6268', '#33383c', '#171a1d'];

/** 格子所在区域的灰度色（中心 / 中圈 3x3 / 外圈） */
export const cellShade = (x: number, y: number) =>
  CELL_SHADES[Math.max(Math.abs(x - CENTER), Math.abs(y - CENTER))];

/**
 * 单个气球对 x / y 两个轴的升力贡献（右 / 下为正方向）。
 * - 中心格：不提供升力
 * - 中圈 3x3：与中心格相交的轴 0 倍，不相交的轴 1 倍
 * - 外圈：与中心格相交的轴 0 倍，与中圈相交的轴 1 倍，都不相交的轴 2 倍
 */
export function cellLift(x: number, y: number, value: number): { x: number; y: number } {
  let mx = 0;
  if (x !== CENTER) mx = x >= 1 && x <= 3 ? 1 : 2;
  let my = 0;
  if (y !== CENTER) my = y >= 1 && y <= 3 ? 1 : 2;
  return { x: value * mx * Math.sign(x - CENTER), y: value * my * Math.sign(y - CENTER) };
}

/** 所有已放置气球的净升力（0 / 0 = 平衡） */
export function netLift(placed: Placed[]): { x: number; y: number } {
  let nx = 0;
  let ny = 0;
  for (const p of placed) {
    const l = cellLift(p.x, p.y, p.value);
    nx += l.x;
    ny += l.y;
  }
  return { x: nx, y: ny };
}

/** 校验关卡是否合法（编辑器用），返回错误信息列表（空数组 = 合法） */
export function validateBalloonLevel(
  level: BalloonLevel,
  placed: Placed[],
): string[] {
  const errors: string[] = [];
  const total = level.balloons.length;
  if (total === 0) errors.push('至少需要添加一个气球');
  if (level.placeable.length < total) {
    errors.push(`可放置格数量（${level.placeable.length}）小于气球数量（${total}）`);
  }
  const placeableSet = new Set(level.placeable.map(([x, y]) => cellKey(x, y)));
  const seen = new Set<string>();
  for (const p of placed) {
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
    const net = netLift(placed);
    if (net.x !== 0 || net.y !== 0) errors.push('放置的气球升力不平衡，需要左右、上下的升力都相互抵消');
  }
  return [...new Set(errors)];
}
