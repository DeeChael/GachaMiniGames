// ============================================================
// 溢彩画 —— 可解性搜索（迭代加深 DFS + 换位表剪枝）
// 用于验证关卡在步数限制内能否全部染成目标颜色
// ============================================================

import type { Cell, CellKind, FillColor, FillLevel } from './types';
import { cellKey, connectedRegion, isComplete, isFillColor } from './types';

const keyOf = (cells: CellKind[][]): string =>
  cells.map((row) => row.map((k) => (k === 'blocked' ? '#' : k === null ? '.' : k[0])).join('')).join('');

/** 找出所有同色连通区域（每个区域返回其格子与颜色） */
function findRegions(cells: CellKind[][]): { color: FillColor; cells: Cell[] }[] {
  const rows = cells.length;
  const cols = cells[0].length;
  const seen = new Set<string>();
  const regions: { color: FillColor; cells: Cell[] }[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const k = cellKey(x, y);
      if (seen.has(k) || !isFillColor(cells[y][x])) continue;
      const region = connectedRegion(cells, x, y);
      for (const [rx, ry] of region) seen.add(cellKey(rx, ry));
      regions.push({ color: cells[y][x] as FillColor, cells: region });
    }
  }
  return regions;
}

/** 与区域四邻接的其它区域的颜色集合 */
function neighborColors(cells: CellKind[][], region: Cell[], selfColor: FillColor): Set<FillColor> {
  const rows = cells.length;
  const cols = cells[0].length;
  const inRegion = new Set(region.map(([x, y]) => cellKey(x, y)));
  const out = new Set<FillColor>();
  for (const [x, y] of region) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as Cell[]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      if (inRegion.has(cellKey(nx, ny))) continue;
      const k = cells[ny][nx];
      if (isFillColor(k) && k !== selfColor) out.add(k);
    }
  }
  return out;
}

/**
 * 判断关卡能否在步数限制内染成目标颜色。
 * 剪枝：
 * - 染某区域时只考虑「相邻区域的颜色 ∪ 目标颜色」，染成无关颜色不可能带来合并收益
 * - 剩余步数少于非目标颜色的种数时不可能完成（一步最多消灭一种颜色）
 * - 换位表记录到达各状态时的最多剩余步数，重复到达直接剪掉
 * 超出节点预算时保守返回 false。
 */
export function solvableWithinSteps(level: FillLevel, maxNodes = 2_000_000): boolean {
  const { steps, target } = level;
  if (isComplete(level.cells, target)) return true;

  const badCells = (cells: CellKind[][]): number => {
    let n = 0;
    for (const row of cells) for (const k of row) if (isFillColor(k) && k !== target) n++;
    return n;
  };
  const badColorCount = (cells: CellKind[][]): number => {
    const s = new Set<FillColor>();
    for (const row of cells) for (const k of row) if (isFillColor(k) && k !== target) s.add(k);
    return s.size;
  };

  const seen = new Map<string, number>(); // state -> 到达时的剩余步数
  let nodes = 0;

  const dfs = (cells: CellKind[][], left: number): boolean => {
    if (badCells(cells) === 0) return true;
    if (left === 0 || badColorCount(cells) > left) return false;
    if (++nodes > maxNodes) return false;
    const k = keyOf(cells);
    if ((seen.get(k) ?? -1) >= left) return false;
    seen.set(k, left);
    // 生成着法并按染色后的非目标格数升序（好着法优先）
    const moves: { cells: CellKind[][]; sc: number }[] = [];
    for (const region of findRegions(cells)) {
      const candidates = neighborColors(cells, region.cells, region.color);
      candidates.add(target);
      for (const color of candidates) {
        if (color === region.color) continue;
        const dyed = cells.map((r) => [...r]);
        for (const [x, y] of region.cells) dyed[y][x] = color;
        moves.push({ cells: dyed, sc: badCells(dyed) });
      }
    }
    moves.sort((a, b) => a.sc - b.sc);
    for (const m of moves) {
      if (dfs(m.cells, left - 1)) return true;
    }
    return false;
  };

  return dfs(level.cells, steps);
}
