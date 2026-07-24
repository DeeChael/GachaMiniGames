// 验证脚本：内置关卡合法性与可解性 + 分享码往返
// 运行：node_modules/.bin/tsx scripts/verify.ts
import { validateLevel } from '../src/games/puzzle/types';
import { encodeLevel, decodeLevel } from '../src/games/puzzle/shareCode';
import { BUILTIN_LEVELS } from '../src/games/puzzle/levels';
import { solvable } from '../src/games/puzzle/solver';
import { BUILTIN_LEVELS as BALLOON_LEVELS } from '../src/games/balloon/levels';
import { decodeBalloonLevel, encodeBalloonLevel } from '../src/games/balloon/shareCode';
import { BUILTIN_LEVELS as PLAT_LEVELS } from '../src/games/platjump/levels';
import { decodePlatLevel, encodePlatLevel } from '../src/games/platjump/shareCode';
import { validatePlatLevel } from '../src/games/platjump/types';
import { buildCtx, createGame, stepGame } from '../src/games/platjump/engine';
import { BUILTIN_LEVELS as FILL_LEVELS } from '../src/games/colorfill/levels';
import { decodeFillLevel, encodeFillLevel } from '../src/games/colorfill/shareCode';
import { validateFillLevel } from '../src/games/colorfill/types';
import { solvableWithinSteps } from '../src/games/colorfill/solver';
import { BUILTIN_LEVELS as SR_LEVELS } from '../src/games/sr_puzzle/levels';
import { decodeSrLevel, encodeSrLevel } from '../src/games/sr_puzzle/shareCode';
import { validateSrLevel } from '../src/games/sr_puzzle/types';
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

let fail = 0;

// 1. 内置关卡：合法 + 可解
for (const lv of BUILTIN_LEVELS) {
  const errs = validateLevel(lv);
  const ok = solvable(lv);
  console.log(`内置「${lv.name}」: ${errs.length ? 'INVALID ' + errs.join(',') : 'valid'} solvable=${ok}`);
  if (errs.length || !ok) fail++;
}

// 2. 分享码往返（键序无关的规范化比较）
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

// 5b. 替罪羊传送门：校验规则 + 分享码往返 + 传送/关闭/循环死亡行为
{
  const lv: (typeof PLAT_LEVELS)[number] = {
    name: '传送门回归', cols: 12, rows: 4, steps: 4,
    spawn: [0, 2], altar: [11, 2],
    platforms: [[0,3],[1,3],[2,3],[3,3],[4,3],[5,3],[6,3],[7,3],[8,3],[9,3],[10,3],[11,3]],
    toggles: [], buttons: [], ladders: [],
    portals: { pos: [[3, 2], [10, 2]], open: true },
    orangeButton: [8, 2],
  };
  const errs = validatePlatLevel(lv);
  const roundtrip = canonical(decodePlatLevel(encodePlatLevel(lv))) === canonical(lv);
  console.log(`替罪羊传送门: ${errs.length ? 'INVALID ' + errs.join(',') : 'valid'} 分享码往返=${roundtrip ? 'OK' : 'MISMATCH'}`);
  if (errs.length || !roundtrip) fail++;
  // 只放一个传送门必须报错
  if (!validatePlatLevel({ ...lv, portals: { pos: [[3, 2]], open: true } }).some((e) => e.includes('两个'))) {
    console.log('替罪羊传送门: 单个传送门未被拒绝 ✗');
    fail++;
  }
  // 传送门必须放在平台之上
  if (!validatePlatLevel({ ...lv, portals: { pos: [[3, 1], [10, 2]], open: true } }).some((e) => e.includes('平台之上'))) {
    console.log('替罪羊传送门: 悬空的传送门未被拒绝 ✗');
    fail++;
  }
  // 没有传送门时不能放橙色按钮
  if (!validatePlatLevel({ ...lv, portals: null }).some((e) => e.includes('传送门'))) {
    console.log('替罪羊传送门: 无传送门时的橙色按钮未被拒绝 ✗');
    fail++;
  }
  // NPC 进传送门时玩家踩住橙色按钮 -> NPC 循环死亡（再见了所有的替罪羊）
  let s = createGame(lv);
  const ctx = buildCtx(lv);
  for (const d of ['D','D','D','A','A','D','A'] as const) s = stepGame(lv, ctx, s, d);
  const npcOk = s.npcPortalDeath && s.npc === null && s.status === 'playing';
  console.log(`替罪羊传送门: NPC 循环死亡=${npcOk ? 'OK' : 'FAIL'}`);
  if (!npcOk) fail++;
}

// 6. 溢彩画内置关卡：结构合法 + 步数限制内可解 + 分享码往返
for (const lv of FILL_LEVELS) {
  const errs = validateFillLevel(lv);
  const t0 = Date.now();
  const ok = solvableWithinSteps(lv);
  const code = encodeFillLevel(lv);
  const back = decodeFillLevel(code);
  const roundtrip = canonical(back) === canonical(lv);
  console.log(`溢彩画「${lv.name}」: ${errs.length ? 'INVALID ' + errs.join(',') : 'valid'} solvable=${ok} (${Date.now() - t0}ms) 分享码往返=${roundtrip ? 'OK' : 'MISMATCH'}`);
  if (errs.length || !ok || !roundtrip) fail++;
}

// 7. 预言算碑内置关卡：结构合法 + 目标图案非空 + 打散后不同 + 分享码往返
for (const lv of SR_LEVELS) {
  const errs = validateSrLevel(lv);
  const code = encodeSrLevel(lv);
  const back = decodeSrLevel(code);
  const roundtrip = canonical(back) === canonical(lv);
  console.log(`预言算碑「${lv.name}」: ${errs.length ? 'INVALID ' + errs.join(',') : 'valid'} 分享码长度=${code.length} 往返=${roundtrip ? 'OK' : 'MISMATCH'}`);
  if (errs.length || !roundtrip) fail++;
}

console.log(fail === 0 ? '\n全部通过 ✓' : `\n失败 ${fail} 项 ✗`);
process.exit(fail === 0 ? 0 : 1);
