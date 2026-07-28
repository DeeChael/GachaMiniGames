// ============================================================
// 邦布维修 2.0（绝区零 · 寻路）— 核心类型与规则
// 玩家从起点走到终点（需经过所有检查点）；走过的格子不能重走，
// 可以倒序回退；管道只能从开口进出；踩上旋转按钮后，
// 所有未经过的管道顺时针旋转 90°
// ============================================================

/** 格子坐标：[x, y]，x 向右，y 向下 */
export type Cell = [number, number];

/** 方向：0 上 1 右 2 下 3 左 */
export type Dir = 0 | 1 | 2 | 3;

export const MIN_GRID = 4;
export const MAX_GRID = 10;

export const DIRS: Cell[] = [[0, -1], [1, 0], [0, 1], [-1, 0]];
export const cellKey = (x: number, y: number) => `${x},${y}`;

export type CellKind = 'normal' | 'start' | 'dest' | 'deny' | 'checkpoint' | 'rotate' | 'tube' | 'ltube';

/** 配色（Tiles 与页面共用） */
export const C = {
  base: '#122d38',
  baseBorder: '#1d4454',
  passed: '#4db9e8',
  tube: '#2e9bb8',
  tubePassed: '#0e4a66',
  green: '#19d8a0',
  orange: '#f5a623',
  deny: '#5a6a72',
};

export interface TubeDef {
  pos: Cell;
  kind: 'tube' | 'ltube';
  rot: number; // 默认朝向 0~3
}

export interface PathLevel {
  name: string;
  rows: number; // 4 ~ 10
  cols: number; // 4 ~ 10
  start: Cell;
  dest: Cell;
  denies: Cell[];
  checkpoints: Cell[];
  rotates: Cell[]; // 旋转按钮
  tubes: TubeDef[];
}

/** 管道开口方向：直管 rot 偶数 = 左右，奇数 = 上下；L 管 = rot 与 rot+1 两个方向 */
export function tubeOpenings(kind: 'tube' | 'ltube', rot: number): Dir[] {
  if (kind === 'tube') return rot % 2 === 0 ? [1, 3] : [0, 2];
  return [(rot % 4) as Dir, ((rot + 1) % 4) as Dir];
}

const kOf = (c: Cell) => cellKey(c[0], c[1]);

export function kindAt(level: PathLevel, x: number, y: number): CellKind {
  if (level.start[0] === x && level.start[1] === y) return 'start';
  if (level.dest[0] === x && level.dest[1] === y) return 'dest';
  if (level.denies.some(([dx, dy]) => dx === x && dy === y)) return 'deny';
  if (level.checkpoints.some(([cx, cy]) => cx === x && cy === y)) return 'checkpoint';
  if (level.rotates.some(([cx, cy]) => cx === x && cy === y)) return 'rotate';
  const tube = level.tubes.find((t) => t.pos[0] === x && t.pos[1] === y);
  if (tube) return tube.kind;
  return 'normal';
}

export const tubeAt = (level: PathLevel, x: number, y: number): TubeDef | undefined =>
  level.tubes.find((t) => t.pos[0] === x && t.pos[1] === y);

/**
 * 能否从 from 朝 dir 走到 to：
 * 离开管道时出口方向（dir）必须开口；进入管道时入口方向（dir 的反方向）必须开口
 */
export function canPass(
  level: PathLevel,
  rots: Record<string, number>,
  from: Cell,
  dir: Dir,
): boolean {
  const to: Cell = [from[0] + DIRS[dir][0], from[1] + DIRS[dir][1]];
  if (to[0] < 0 || to[1] < 0 || to[0] >= level.cols || to[1] >= level.rows) return false;
  if (kindAt(level, to[0], to[1]) === 'deny') return false;
  const fromTube = tubeAt(level, from[0], from[1]);
  if (fromTube && !tubeOpenings(fromTube.kind, rots[kOf(fromTube.pos)] ?? fromTube.rot).includes(dir)) return false;
  const toTube = tubeAt(level, to[0], to[1]);
  if (toTube && !tubeOpenings(toTube.kind, rots[kOf(toTube.pos)] ?? toTube.rot).includes(((dir + 2) % 4) as Dir)) {
    return false;
  }
  return true;
}

/** 校验关卡结构，返回错误信息列表（空数组 = 合法） */
export function validatePathLevel(level: PathLevel): string[] {
  const errors: string[] = [];
  const { rows, cols } = level;
  if (rows < MIN_GRID || rows > MAX_GRID || cols < MIN_GRID || cols > MAX_GRID) {
    errors.push(`棋盘大小必须在 ${MIN_GRID}×${MIN_GRID} ~ ${MAX_GRID}×${MAX_GRID} 之间`);
  }
  const inBounds = ([x, y]: Cell) => x >= 0 && y >= 0 && x < cols && y < rows;
  if (!inBounds(level.start)) errors.push('起点越界或未放置');
  if (!inBounds(level.dest)) errors.push('终点越界或未放置');
  if (level.start[0] === level.dest[0] && level.start[1] === level.dest[1]) errors.push('起点和终点不能在同一格');

  // 控件不能重叠
  const seen = new Map<string, string>();
  const claim = (cells: Cell[], label: string) => {
    for (const c of cells) {
      if (!inBounds(c)) errors.push(`${label}越界`);
      const k = kOf(c);
      if (seen.has(k)) errors.push(`${label}与${seen.get(k)}重叠`);
      else seen.set(k, label);
    }
  };
  claim([level.start], '起点');
  claim([level.dest], '终点');
  claim(level.denies, '禁止方块');
  claim(level.checkpoints, '检查点');
  claim(level.rotates, '旋转按钮');
  claim(level.tubes.map((t) => t.pos), '管道');

  // 必须可解
  if (errors.length === 0 && !solvable(level)) errors.push('关卡无解，无法从起点经过所有检查点到达终点');
  return [...new Set(errors)];
}

/** 深度优先搜索是否存在从起点经过所有检查点到终点的走法（考虑旋转按钮效果） */
export function solvable(level: PathLevel, maxStates = 300000): boolean {
  const rots0: Record<string, number> = {};
  for (const t of level.tubes) rots0[kOf(t.pos)] = t.rot;
  const checkpointKeys = level.checkpoints.map(kOf);
  const seen = new Set<string>();
  let states = 0;

  const key = (pos: Cell, visited: Set<string>, rots: Record<string, number>) =>
    `${kOf(pos)}|${[...visited].sort().join(';')}|${Object.keys(rots).sort().map((k) => rots[k]).join(',')}`;

  const dfs = (pos: Cell, visited: Set<string>, rots: Record<string, number>): boolean => {
    if (kOf(pos) === kOf(level.dest) && checkpointKeys.every((k) => visited.has(k))) return true;
    if (++states > maxStates) return false;
    const sk = key(pos, visited, rots);
    if (seen.has(sk)) return false;
    seen.add(sk);
    for (const dir of [0, 1, 2, 3] as Dir[]) {
      const to: Cell = [pos[0] + DIRS[dir][0], pos[1] + DIRS[dir][1]];
      const tk = kOf(to);
      if (visited.has(tk)) continue;
      // 没有踩完所有检查点不能进入终点
      if (kindAt(level, to[0], to[1]) === 'dest' && !checkpointKeys.every((k) => visited.has(k))) continue;
      if (!canPass(level, rots, pos, dir)) continue;
      let nRots = rots;
      if (kindAt(level, to[0], to[1]) === 'rotate') {
        // 踩上旋转按钮：所有未经过的管道顺时针旋转
        nRots = { ...rots };
        for (const t of level.tubes) {
          if (!visited.has(kOf(t.pos))) nRots[kOf(t.pos)] = (nRots[kOf(t.pos)] + 1) % 4;
        }
      }
      if (dfs(to, new Set([...visited, tk]), nRots)) return true;
      if (states > maxStates) return false;
    }
    return false;
  };

  return dfs(level.start, new Set([kOf(level.start)]), rots0);
}
