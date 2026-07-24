// ============================================================
// 黄金替罪羊 —— 游戏引擎（纯函数，便于测试）
// 角色站在平台「上方」：脚下（正下方一格）不是可站立物时自由落体。
// 一步 = 一次真实移动（无法移动的操作不计步）：
//   1. 玩家行动（A/D 横移；W 在梯子底部直达顶部；S 在梯子顶部直达底部）
//   2. 超过关卡步数后，出生点出现「过去的自己」，复现玩家前 N 步动作
//   3. 双方自由落体结算
// 按钮是「踩住生效」：踩上切换平台状态，离开恢复原状态（不做持久切换）。
// 传送门：走进开启的一端会传送到另一端并关闭；橙色按钮被踩住时传送门
// 持续激活——此时另一端进人会在门里无限来回传送，NPC 直接死亡
// （再见了所有的替罪羊），玩家直接失败。
// 玩家与 NPC 接触直接判负。
// ============================================================

import type { Cell, Dir, PlatLevel, ToggleColor } from './types';
import { cellKey, ladderRuns } from './types';

export interface PlatState {
  player: Cell;
  npc: Cell | null; // 「过去的自己」，未出现 / 坠底消失 / 传送门中死亡时为 null
  npcSpawned: boolean;
  history: Dir[]; // 玩家的真实移动记录（无效操作不计入）
  status: 'playing' | 'won' | 'lost';
  portalOpen: boolean; // 传送门当前状态
  npcPortalDeath: boolean; // NPC 在传送门里无限来回传送而死（提示「再见了所有的替罪羊」）
  playerPortalDeath: boolean; // 玩家在传送门里无限来回传送 → 直接失败
}

/** 由关卡预计算的查询上下文 */
export interface PlatCtx {
  platforms: Set<string>;
  toggleAt: Map<string, { color: ToggleColor; on: boolean }>; // 每格独立默认状态
  buttonAt: Map<string, ToggleColor>;
  topRungs: Set<string>; // 梯子顶部格（相当于平台）
  baseToTop: Map<string, Cell>; // 梯子底部格（最底横档，站在下方平台上）→ 梯子顶部上方一格
  topToBase: Map<string, Cell>; // 梯子顶部上方一格 → 梯子底部格
  altarK: string;
  portalAt: Map<string, Cell>; // 传送门格 → 另一端格
  orangeButtonK: string | null; // 橙色按钮格
}

export function buildCtx(level: PlatLevel): PlatCtx {
  const topRungs = new Set<string>();
  const baseToTop = new Map<string, Cell>();
  const topToBase = new Map<string, Cell>();
  for (const run of ladderRuns(level.ladders)) {
    const top = run[0];
    const bottom = run[run.length - 1];
    const above: Cell = [top[0], top[1] - 1]; // 梯子顶部相当于平台，角色站在其上方一格
    topRungs.add(cellKey(top[0], top[1]));
    baseToTop.set(cellKey(bottom[0], bottom[1]), above);
    topToBase.set(cellKey(above[0], above[1]), bottom);
  }
  const portalAt = new Map<string, Cell>();
  if (level.portals && level.portals.pos.length === 2) {
    const [a, b] = level.portals.pos;
    portalAt.set(cellKey(a[0], a[1]), b);
    portalAt.set(cellKey(b[0], b[1]), a);
  }
  return {
    platforms: new Set(level.platforms.map(([x, y]) => cellKey(x, y))),
    toggleAt: new Map(
      level.toggles.map((t) => [cellKey(t.pos[0], t.pos[1]), { color: t.color, on: t.on }] as [string, { color: ToggleColor; on: boolean }]),
    ),
    buttonAt: new Map(level.buttons.map((b) => [cellKey(b.pos[0], b.pos[1]), b.color] as [string, ToggleColor])),
    topRungs,
    baseToTop,
    topToBase,
    altarK: cellKey(level.altar[0], level.altar[1]),
    portalAt,
    orangeButtonK: level.orangeButton ? cellKey(level.orangeButton[0], level.orangeButton[1]) : null,
  };
}

/** 各色按钮当前是否被踩住（玩家或 NPC 与按钮在同一格） */
export function heldButtons(ctx: PlatCtx, player: Cell, npc: Cell | null): Record<ToggleColor, boolean> {
  const heldBy = (a: Cell | null, color: ToggleColor) =>
    a !== null && ctx.buttonAt.get(cellKey(a[0], a[1])) === color;
  return {
    yellow: heldBy(player, 'yellow') || heldBy(npc, 'yellow'),
    blue: heldBy(player, 'blue') || heldBy(npc, 'blue'),
  };
}

/** 某格可开关平台的当前有效状态：该格的默认状态被「踩住」翻转 */
export function toggleCellOn(
  ctx: PlatCtx,
  held: Record<ToggleColor, boolean>,
  x: number,
  y: number,
): boolean {
  const t = ctx.toggleAt.get(cellKey(x, y));
  return t ? t.on !== held[t.color] : false;
}

/** 某格是否为可站立的支撑物（平台 / 开启的可开关平台 / 梯子顶部） */
function solid(ctx: PlatCtx, held: Record<ToggleColor, boolean>, x: number, y: number): boolean {
  const k = cellKey(x, y);
  if (ctx.platforms.has(k)) return true;
  if (ctx.toggleAt.has(k)) return toggleCellOn(ctx, held, x, y);
  if (ctx.topRungs.has(k)) return true;
  return false;
}

/** 橙色按钮当前是否被踩住（玩家或 NPC 与按钮在同一格） */
function orangeHeld(ctx: PlatCtx, s: PlatState): boolean {
  if (!ctx.orangeButtonK) return false;
  if (cellKey(s.player[0], s.player[1]) === ctx.orangeButtonK) return true;
  return s.npc !== null && cellKey(s.npc[0], s.npc[1]) === ctx.orangeButtonK;
}

/** 踩住橙色按钮：传送门（重新）激活 */
function applyOrangeButton(ctx: PlatCtx, s: PlatState): void {
  if (orangeHeld(ctx, s)) s.portalOpen = true;
}

/**
 * 传送门触发：actor 位于开启的传送门格时传送到另一端，随后传送门关闭。
 * 若此时橙色按钮被踩住（传送门一直为开启状态），actor 会在两端无限来回
 * 传送：NPC 直接死亡（再见了所有的替罪羊），玩家直接失败
 */
function applyPortal(ctx: PlatCtx, s: PlatState, actor: 'player' | 'npc'): void {
  const a = s[actor];
  if (!a || !s.portalOpen) return;
  const dest = ctx.portalAt.get(cellKey(a[0], a[1]));
  if (!dest) return;
  a[0] = dest[0];
  a[1] = dest[1];
  if (orangeHeld(ctx, s)) {
    if (actor === 'player') {
      s.status = 'lost';
      s.playerPortalDeath = true;
    } else {
      s.npc = null;
      s.npcPortalDeath = true;
    }
  } else {
    s.portalOpen = false;
  }
}

/** 计算一次操作的目标位置；无法真实移动时返回 null（不计步） */
function moveTarget(ctx: PlatCtx, level: PlatLevel, actor: Cell, dir: Dir): Cell | null {
  const [x, y] = actor;
  if (dir === 'A') return x > 0 ? [x - 1, y] : null;
  if (dir === 'D') return x < level.cols - 1 ? [x + 1, y] : null;
  if (dir === 'W') {
    // 梯子底部按 W：直达梯子顶部（顶部横档上方一格）；不能上梯时无效
    return ctx.baseToTop.get(cellKey(x, y)) ?? null;
  }
  // S：梯子顶部按 S：直达梯子最底部；不能下梯时无效
  return ctx.topToBase.get(cellKey(x, y)) ?? null;
}

/** 初始状态（含出生点落地结算） */
export function createGame(level: PlatLevel): PlatState {
  const ctx = buildCtx(level);
  const s: PlatState = {
    player: [...level.spawn],
    // 步数为 0：NPC 立刻出现在出生点（复现池为空，不会移动）
    npc: level.steps === 0 ? [...level.spawn] : null,
    npcSpawned: level.steps === 0,
    history: [],
    status: 'playing',
    portalOpen: level.portals?.open ?? false,
    npcPortalDeath: false,
    playerPortalDeath: false,
  };
  while (s.player[1] + 1 < level.rows && !solid(ctx, heldButtons(ctx, s.player, null), s.player[0], s.player[1] + 1)) {
    s.player[1]++;
    applyPortal(ctx, s, 'player');
    if (s.status !== 'playing') return s;
    if (cellKey(s.player[0], s.player[1]) === ctx.altarK) {
      s.status = 'won';
      return s;
    }
  }
  applyOrangeButton(ctx, s);
  if (!solid(ctx, heldButtons(ctx, s.player, null), s.player[0], s.player[1] + 1) && s.player[1] + 1 >= level.rows) {
    s.status = 'lost';
  }
  return s;
}

/** 推进一步；无效操作（不能移动）时不改变状态、不计步 */
export function stepGame(level: PlatLevel, ctx: PlatCtx, prev: PlatState, dir: Dir): PlatState {
  if (prev.status !== 'playing') return prev;

  // 1. 玩家行动（必须真实移动才计步）
  const target = moveTarget(ctx, level, prev.player, dir);
  if (!target) return prev;
  const s: PlatState = {
    player: target,
    npc: prev.npc ? [...prev.npc] : null,
    npcSpawned: prev.npcSpawned,
    history: [...prev.history, dir],
    status: 'playing',
    portalOpen: prev.portalOpen,
    npcPortalDeath: prev.npcPortalDeath,
    playerPortalDeath: false,
  };

  const touching = () => s.npc !== null && s.npc[0] === s.player[0] && s.npc[1] === s.player[1];
  const onAltar = () => cellKey(s.player[0], s.player[1]) === ctx.altarK;

  // 玩家落入开启的传送门：传送（橙色按钮被踩住时在门里无限往返，直接失败）
  applyPortal(ctx, s, 'player');
  if (s.status !== 'playing') return s;
  applyOrangeButton(ctx, s);

  if (onAltar()) {
    s.status = 'won';
    return s;
  }

  // 2.「过去的自己」：剩余步数归 0 时立刻在出生点出现，从下一步起复现前 steps 步
  if (s.history.length >= level.steps) {
    if (!s.npcSpawned) {
      s.npc = [...level.spawn];
      s.npcSpawned = true;
    }
    const idx = s.history.length - level.steps - 1;
    if (s.npc && idx >= 0 && idx < level.steps) {
      const nt = moveTarget(ctx, level, s.npc, s.history[idx]);
      if (nt) s.npc = nt;
    }
    // NPC 落入开启的传送门：传送（橙色按钮被踩住时在门里无限往返，直接死亡）
    applyPortal(ctx, s, 'npc');
    applyOrangeButton(ctx, s);
  }

  // 双方移动完成后再判定接触（可能是前后跟随的关系：玩家跨入 NPC 刚离开的位置不算接触）
  if (touching()) {
    s.status = 'lost';
    return s;
  }

  // 3. 自由落体（按钮在落体前已按当前位置生效，不会先掉下去才开平台）
  const fall = (actor: 'player' | 'npc'): 'ok' | 'out' => {
    const a = s[actor];
    if (!a) return 'ok';
    while (a[1] + 1 < level.rows && !solid(ctx, heldButtons(ctx, s.player, s.npc), a[0], a[1] + 1)) {
      a[1]++;
      applyPortal(ctx, s, actor);
      if (s.status !== 'playing') return 'ok';
      if (actor === 'npc' && !s.npc) return 'ok'; // NPC 在传送门里死亡
      if (actor === 'player' && onAltar()) return 'ok';
      if (touching()) return 'ok';
    }
    return solid(ctx, heldButtons(ctx, s.player, s.npc), a[0], a[1] + 1) ? 'ok' : 'out';
  };

  if (fall('player') === 'out') {
    s.status = 'lost';
    return s;
  }
  if (s.status !== 'playing') return s;
  applyOrangeButton(ctx, s);
  if (onAltar()) {
    s.status = 'won';
    return s;
  }
  if (touching()) {
    s.status = 'lost';
    return s;
  }
  if (s.npc && fall('npc') === 'out') s.npc = null; // NPC 坠底消失
  applyOrangeButton(ctx, s);
  if (touching()) s.status = 'lost';
  return s;
}
