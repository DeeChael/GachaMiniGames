// ============================================================
// 关卡求解器 —— 独立于生成算法的可解性确认
// 策略：锚定「需求未满的最上一行中最左的可用格」，分支 = 用拼图覆盖 / 留空。
// 放置时按颜色计数不得超过行列需求；留空时做容量剪枝。
// 每种颜色的需求总数 == 该颜色拼图格数时，「全程不超标 + 全部放下」==「完全匹配」。
// ============================================================

import type { Cell, Level } from './types';
import { cellKey, rotateCells } from './types';

export function solvable(level: Level, maxNodes = 200000): boolean {
  const { rows, cols, blocked, pieces, rowReq, colReq } = level;
  const blockedSet = new Set(blocked.map(([x, y]) => cellKey(x, y)));
  const filled = new Set<string>();
  const skipped = new Set<string>();
  const rowCnt: Record<string, number>[] = Array.from({ length: rows }, () => ({}));
  const colCnt: Record<string, number>[] = Array.from({ length: cols }, () => ({}));
  const rowNeed = rowReq.map((r) => Object.values(r).reduce((a, b) => a + (b ?? 0), 0));
  const colNeed = colReq.map((r) => Object.values(r).reduce((a, b) => a + (b ?? 0), 0));
  const reqOf = (cc: unknown, c: string) => ((cc as Record<string, number>)[c] ?? 0);

  for (const p of pieces) {
    if (!p.locked) continue;
    for (const [cx, cy] of p.cells) {
      const gx = (p.x ?? 0) + cx, gy = (p.y ?? 0) + cy;
      filled.add(cellKey(gx, gy));
      rowCnt[gy][p.color] = (rowCnt[gy][p.color] ?? 0) + 1;
      colCnt[gx][p.color] = (colCnt[gx][p.color] ?? 0) + 1;
    }
  }
  for (let y = 0; y < rows; y++)
    for (const c of Object.keys(rowCnt[y]))
      if ((rowCnt[y][c] ?? 0) > reqOf(rowReq[y], c)) return false;
  for (let x = 0; x < cols; x++)
    for (const c of Object.keys(colCnt[x]))
      if ((colCnt[x][c] ?? 0) > reqOf(colReq[x], c)) return false;

  const tray = pieces
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => !p.locked)
    .sort((a, b) => b.p.cells.length - a.p.cells.length);

  const orientations = tray.map(({ p }) => {
    const set = new Set<string>();
    const out: Cell[][] = [];
    for (let r = 0; r < 4; r++) {
      const rot = rotateCells(p.cells, r);
      const sig = rot.map(([x, y]) => `${x},${y}`).sort().join(';');
      if (!set.has(sig)) { set.add(sig); out.push(rot); }
    }
    return out;
  });

  const rowFilledSum = (y: number) => Object.values(rowCnt[y]).reduce((a, b) => a + b, 0);
  const colFilledSum = (x: number) => Object.values(colCnt[x]).reduce((a, b) => a + b, 0);
  const rowAvail = (y: number) => {
    let n = 0;
    for (let x = 0; x < cols; x++) {
      const k = cellKey(x, y);
      if (!blockedSet.has(k) && !filled.has(k) && !skipped.has(k)) n++;
    }
    return n;
  };
  const colAvail = (x: number) => {
    let n = 0;
    for (let y = 0; y < rows; y++) {
      const k = cellKey(x, y);
      if (!blockedSet.has(k) && !filled.has(k) && !skipped.has(k)) n++;
    }
    return n;
  };

  let nodes = 0;
  function dfs(idx: number): boolean {
    if (++nodes > maxNodes) return false;
    if (idx === tray.length) return true;

    // MRV 锚点：需求未满且可用格最少的行
    let ay = -1;
    let bestAvail = Infinity;
    for (let y = 0; y < rows; y++) {
      if (rowFilledSum(y) < rowNeed[y]) {
        const a = rowAvail(y);
        if (a < bestAvail) { bestAvail = a; ay = y; }
      }
    }
    if (ay === -1) return false;
    let ax = -1;
    for (let x = 0; x < cols; x++) {
      const k = cellKey(x, ay);
      if (!blockedSet.has(k) && !filled.has(k) && !skipped.has(k)) { ax = x; break; }
    }
    if (ax === -1) return false;

    // 相同拼图（形状+颜色一致）在同一层只尝试一次，消除对称子树
    const seenSigs = new Set<string>();
    for (let pi = idx; pi < tray.length; pi++) {
      const { p } = tray[pi];
      const sig = p.color + '|' + p.cells.map(([x, y]) => `${x},${y}`).sort().join(';');
      if (seenSigs.has(sig)) continue;
      seenSigs.add(sig);
      for (const cells of orientations[pi]) {
        for (const [axc, ayc] of cells) {
          const ox = ax - axc, oy = ay - ayc;
          let ok = true;
          for (const [cx, cy] of cells) {
            const gx = ox + cx, gy = oy + cy;
            const k = cellKey(gx, gy);
            if (gx < 0 || gy < 0 || gx >= cols || gy >= rows || blockedSet.has(k) || filled.has(k) || skipped.has(k)) { ok = false; break; }
            if ((rowCnt[gy][p.color] ?? 0) + 1 > reqOf(rowReq[gy], p.color)) { ok = false; break; }
            if ((colCnt[gx][p.color] ?? 0) + 1 > reqOf(colReq[gx], p.color)) { ok = false; break; }
          }
          if (!ok) continue;
          // 容量剪枝：放置后受影响的行/列，剩余可用格必须仍能满足剩余需求
          const touchedRows = new Set<number>();
          const touchedCols = new Set<number>();
          for (const [cx, cy] of cells) { touchedRows.add(oy + cy); touchedCols.add(ox + cx); }
          for (const [cx, cy] of cells) {
            const gx = ox + cx, gy = oy + cy;
            filled.add(cellKey(gx, gy));
            rowCnt[gy][p.color] = (rowCnt[gy][p.color] ?? 0) + 1;
            colCnt[gx][p.color] = (colCnt[gx][p.color] ?? 0) + 1;
          }
          let capOk = true;
          for (const y of touchedRows) if (rowNeed[y] - rowFilledSum(y) > rowAvail(y)) { capOk = false; break; }
          if (capOk) for (const x of touchedCols) if (colNeed[x] - colFilledSum(x) > colAvail(x)) { capOk = false; break; }
          if (capOk) {
            [tray[idx], tray[pi]] = [tray[pi], tray[idx]];
            [orientations[idx], orientations[pi]] = [orientations[pi], orientations[idx]];
            if (dfs(idx + 1)) return true;
            [tray[idx], tray[pi]] = [tray[pi], tray[idx]];
            [orientations[idx], orientations[pi]] = [orientations[pi], orientations[idx]];
          }
          for (const [cx, cy] of cells) {
            const gx = ox + cx, gy = oy + cy;
            filled.delete(cellKey(gx, gy));
            rowCnt[gy][p.color]--;
            colCnt[gx][p.color]--;
          }
        }
      }
    }

    if (rowAvail(ay) - 1 >= rowNeed[ay] - rowFilledSum(ay) && colAvail(ax) - 1 >= colNeed[ax] - colFilledSum(ax)) {
      skipped.add(cellKey(ax, ay));
      if (dfs(idx)) return true;
      skipped.delete(cellKey(ax, ay));
    }
    return false;
  }
  return dfs(0);
}
