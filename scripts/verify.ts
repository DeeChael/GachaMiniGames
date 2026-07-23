// 验证脚本：随机关卡可解性（见证校验）+ 分享码往返 + 内置关卡合法性
// 运行：node_modules/.bin/tsx scripts/verify.ts
import { generateRandomLevel, generateRandomLevelWithSolution, type RandomDifficulty } from '../src/games/puzzle/random';
import { validateLevel, rotateCells, cellKey, cellsSignature, computeColorReq, type Cell, type Level, type PieceColor } from '../src/games/puzzle/types';
import { encodeLevel, decodeLevel } from '../src/games/puzzle/shareCode';
import { BUILTIN_LEVELS } from '../src/games/puzzle/levels';
import { PRESET_SHAPES } from '../src/games/puzzle/presetShapes';
import { solvable } from '../src/games/puzzle/solver';
import { BUILTIN_LEVELS as BALLOON_LEVELS } from '../src/games/balloon/levels';
import { decodeBalloonLevel, encodeBalloonLevel } from '../src/games/balloon/shareCode';
import { BUILTIN_LEVELS as PLAT_LEVELS } from '../src/games/platjump/levels';
import { decodePlatLevel, encodePlatLevel } from '../src/games/platjump/shareCode';
import { validatePlatLevel } from '../src/games/platjump/types';
import {
  cellKey as bCellKey,
  netLift,
  validateBalloonLevel,
  type Placed as BalloonPlaced,
} from '../src/games/balloon/types';

// btoa/atob polyfill for node
(globalThis as any).btoa = (s: string) => Buffer.from(s, 'binary').toString('base64');
(globalThis as any).atob = (s: string) => Buffer.from(s, 'base64').toString('binary');

// 键序无关的规范化序列化
const canonical = (o: unknown): string => {
  if (Array.isArray(o)) return `[${o.map(canonical).join(',')}]`;
  if (o && typeof o === 'object') {
    return `{${Object.keys(o as object).sort().map((k) => `${k}:${canonical((o as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return JSON.stringify(o);
};

// 见证校验：生成器给出的「解」必须合法且与关卡完全对应（从而证明关卡可解）
function witnessOk(level: Level, solution: { cells: Cell[]; color: PieceColor; x: number; y: number }[]): boolean {
  const { rows, cols, blocked } = level;
  const blockedSet = new Set(blocked.map(([x, y]) => cellKey(x, y)));
  const occ = new Set<string>();
  for (const s of solution) {
    for (const [cx, cy] of s.cells) {
      const gx = s.x + cx, gy = s.y + cy;
      const k = cellKey(gx, gy);
      if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) return false;
      if (blockedSet.has(k) || occ.has(k)) return false;
      occ.add(k);
    }
  }
  // 行列需求必须等于由解计算出的需求
  const req = computeColorReq(rows, cols, solution);
  if (canonical(req.rowReq) !== canonical(level.rowReq) || canonical(req.colReq) !== canonical(level.colReq)) return false;
  // 拼图（形状+颜色，锁定拼图含位置）与解一一对应
  const pool = solution.map((s) => ({ sig: cellsSignature(s.cells), color: s.color, x: s.x, y: s.y, used: false }));
  for (const p of level.pieces) {
    const sig = cellsSignature(p.cells);
    const found = pool.find((q) => !q.used && q.sig === sig && q.color === p.color && (!p.locked || (q.x === p.x && q.y === p.y)));
    if (!found) return false;
    found.used = true;
  }
  return !pool.some((q) => !q.used);
}

let fail = 0;

// 1. 内置关卡：合法 + 可解
for (const lv of BUILTIN_LEVELS) {
  const errs = validateLevel(lv);
  const ok = solvable(lv);
  console.log(`内置「${lv.name}」: ${errs.length ? 'INVALID ' + errs.join(',') : 'valid'} solvable=${ok}`);
  if (errs.length || !ok) fail++;
}

// 2. 随机关卡：300 个种子 × 3 难度，合法 + 见证可解
const presetIds = new Set(PRESET_SHAPES.map((s) => s.id));
console.log(`预制形状数量: ${presetIds.size}`);
for (const diff of ['easy', 'normal', 'hard'] as RandomDifficulty[]) {
  let bad = 0;
  const t0 = Date.now();
  for (let seed = 1; seed <= 100; seed++) {
    const { level: lv, solution } = generateRandomLevelWithSolution(diff, seed * 7919);
    const errs = validateLevel(lv);
    if (errs.length) { console.log(`  [${diff} seed=${seed}] INVALID:`, errs); bad++; continue; }
    if (!witnessOk(lv, solution)) { console.log(`  [${diff} seed=${seed}] WITNESS FAIL`); bad++; }
  }
  console.log(`随机[${diff}]: 100 个中 ${bad} 个有问题, 耗时 ${Date.now() - t0}ms`);
  fail += bad;
}

// 3. 分享码往返（键序无关的规范化比较）
for (const diff of ['normal', 'hard'] as RandomDifficulty[]) {
  const lv = generateRandomLevel(diff, 12345);
  const code = encodeLevel(lv);
  const back = decodeLevel(code);
  const same = canonical(back) === canonical(lv);
  const errs = validateLevel(back);
  console.log(`分享码[${diff}]: 长度=${code.length} 往返=${same ? 'OK' : 'MISMATCH'} 合法=${errs.length === 0}`);
  if (!same || errs.length) fail++;
}
const builtinCode = encodeLevel(BUILTIN_LEVELS[2]);
const builtinBack = decodeLevel(builtinCode);
console.log(`内置关卡3 分享码长度=${builtinCode.length} 往返=${canonical(builtinBack) === canonical(BUILTIN_LEVELS[2]) ? 'OK' : 'MISMATCH'}`);
if (canonical(builtinBack) !== canonical(BUILTIN_LEVELS[2])) fail++;

// 4. 气球内置关卡：结构合法 + 暴力搜索存在升力平衡的放法
function balloonSolvable(level: (typeof BALLOON_LEVELS)[number]): boolean {
  const cells = level.placeable;
  const balloons = level.balloons;
  const chosen: BalloonPlaced[] = [];
  const used = new Set<string>();
  const dfs = (i: number): boolean => {
    if (i === balloons.length) {
      const net = netLift(chosen);
      return net.x === 0 && net.y === 0;
    }
    for (const [x, y] of cells) {
      const k = bCellKey(x, y);
      if (used.has(k)) continue;
      used.add(k);
      chosen.push({ x, y, value: balloons[i] });
      if (dfs(i + 1)) return true;
      chosen.pop();
      used.delete(k);
    }
    return false;
  };
  return dfs(0);
}
for (const lv of BALLOON_LEVELS) {
  // 校验时假设一种合法摆放存在即可，这里先查结构错误（不依赖具体摆放）
  const structural = validateBalloonLevel(lv, []).filter(
    (e) => !e.includes('已放置') && !e.includes('升力不平衡'),
  );
  const ok = balloonSolvable(lv);
  const code = encodeBalloonLevel(lv);
  const back = decodeBalloonLevel(code);
  const roundtrip = canonical(back) === canonical(lv);
  console.log(`气球「${lv.name}」: ${structural.length ? 'INVALID ' + structural.join(',') : 'valid'} solvable=${ok} 分享码往返=${roundtrip ? 'OK' : 'MISMATCH'}`);
  if (structural.length || !ok || !roundtrip) fail++;
}

// 5. 黄金替罪羊预设关卡（presets.md 分享码）：结构合法 + 分享码往返
for (const lv of PLAT_LEVELS) {
  const errs = validatePlatLevel(lv);
  const code = encodePlatLevel(lv);
  const back = decodePlatLevel(code);
  const roundtrip = canonical(back) === canonical(lv);
  console.log(`替罪羊「${lv.name}」: ${errs.length ? 'INVALID ' + errs.join(',') : 'valid'} 分享码往返=${roundtrip ? 'OK' : 'MISMATCH'}`);
  if (errs.length || !roundtrip) fail++;
}

console.log(fail === 0 ? '\n全部通过 ✓' : `\n失败 ${fail} 项 ✗`);
process.exit(fail === 0 ? 0 : 1);
