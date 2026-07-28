// ============================================================
// 邦布维修（绝区零）— 核心类型、电力模拟与关卡校验
// 电力只沿连接线直线传导；触点只接收同色电；中继器任一触点
// 收到同色电后整体通电，所有触点释放各自颜色的电
// ============================================================

/** 格子坐标：[x, y]，x 向右，y 向下 */
export type Cell = [number, number];

export type PipeColor = 'yellow' | 'blue';

/** 方向：0 上 1 右 2 下 3 左 */
export type Dir = 0 | 1 | 2 | 3;

export const MIN_GRID = 3;
export const MAX_GRID = 10;
export const MAX_KEYS = 6;

export const DIRS: Cell[] = [[0, -1], [1, 0], [0, 1], [-1, 0]];
export const opposite = (d: Dir): Dir => ((d + 2) % 4) as Dir;
export const cellKey = (x: number, y: number) => `${x},${y}`;

export const PIPE_COLORS: Record<PipeColor, { name: string; off: string; on: string }> = {
  yellow: { name: '黄色', off: '#98a877', on: '#f0f195' },
  blue: { name: '蓝色', off: '#4d96a2', on: '#92f1ef' },
};
export const LINE_OFF = '#47696c';
export const CORE_OFF = '#5f927f';
export const CORE_ON = '#7cee94';
export const LOCK_OFF = '#398b73';
export const LOCK_ON = '#62bb6d';

// ---------------- 渲染几何（格） ----------------

export const R1 = 0.3; // 源 / 获电处外圈半径
export const R2 = 0.22; // 中继器 / 钥匙点外圈半径
export const CONTACT_LEN_RATIO = 0.11; // 触点长（= 圆环宽度 R2/2）

/** 元件在某方向上的最外圈半径（含触点），连接线端点用 */
export function extentOf(kind: PipeElement['kind'], hasContact: boolean): number {
  if (kind === 'source' || kind === 'receiver') return R1;
  // 触点尖端 = 环半径 + 触点长 + 收尾半圆半径（环宽的一半）
  return hasContact ? R2 + CONTACT_LEN_RATIO + R2 / 4 : R2;
}

/** 角度（度，0=上，顺时针）→ 坐标 */
export const anglePt = (cx: number, cy: number, r: number, a: number): [number, number] => [
  cx + r * Math.sin((a * Math.PI) / 180),
  cy - r * Math.cos((a * Math.PI) / 180),
];

/** 环形扇区路径（rOut 外半径，rIn 内半径，a0→a1 顺时针） */
export function annularSector(cx: number, cy: number, rOut: number, rIn: number, a0: number, a1: number): string {
  const [x0, y0] = anglePt(cx, cy, rOut, a0);
  const [x1, y1] = anglePt(cx, cy, rOut, a1);
  const [x2, y2] = anglePt(cx, cy, rIn, a1);
  const [x3, y3] = anglePt(cx, cy, rIn, a0);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${x0},${y0} A${rOut},${rOut} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${rIn},${rIn} 0 ${large} 0 ${x3},${y3} Z`;
}

export interface SourceEl {
  kind: 'source';
  color: PipeColor;
}
export interface ReceiverEl {
  kind: 'receiver';
  blocks: PipeColor[]; // 按 Dir 的上右下左四块
}
export interface BarRelayEl {
  kind: 'bar';
  locked: boolean;
  colors: [PipeColor, PipeColor]; // colors[i] = 触点 i 所在半边的颜色（触点 0 = 局部右，触点 1 = 局部左）
  rot: number; // 解的朝向（90° 步进，局部触点右/左 = 0）
  startRot: number; // 打乱后的开局朝向
}
export interface QuadRelayEl {
  kind: 'quad';
  locked: boolean;
  contacts: boolean[]; // 局部四方向是否有触点
  blocks: PipeColor[]; // 局部四象限颜色
  rot: number;
  startRot: number;
}
export interface KeyEl {
  kind: 'key';
  color: PipeColor;
  dir: Dir; // 触点朝向（只有一个触点）
}
export type PipeElement = SourceEl | ReceiverEl | BarRelayEl | QuadRelayEl | KeyEl;

export interface PipeLine {
  a: Cell;
  b: Cell;
}

export interface PipeLevel {
  name: string;
  rows: number; // 3 ~ 10
  cols: number; // 3 ~ 10
  elements: Record<string, PipeElement>; // cellKey -> 控件
  lines: PipeLine[];
}

// ---------------- 方向与触点几何 ----------------

/** from 指向 to 的方向（要求同行或同列） */
export function dirToward(from: Cell, to: Cell): Dir {
  if (to[0] > from[0]) return 1;
  if (to[0] < from[0]) return 3;
  if (to[1] > from[1]) return 2;
  return 0;
}

/** 线的中间格（不含两端） */
export function lineMidCells(l: PipeLine): Cell[] {
  const out: Cell[] = [];
  const dx = Math.sign(l.b[0] - l.a[0]);
  const dy = Math.sign(l.b[1] - l.a[1]);
  let [x, y] = l.a;
  while (x !== l.b[0] || y !== l.b[1]) {
    x += dx;
    y += dy;
    if (x !== l.b[0] || y !== l.b[1]) out.push([x, y]);
  }
  return out;
}

export interface Contact {
  dir: Dir;
  color: PipeColor;
}

/** bar：局部触点为右(1)、左(3)，触点 0 = 右半边，触点 1 = 左半边 */
export function barContacts(el: BarRelayEl, rot: number): Contact[] {
  return [
    { dir: ((1 + rot) % 4) as Dir, color: el.colors[0] },
    { dir: ((3 + rot) % 4) as Dir, color: el.colors[1] },
  ];
}

export function quadContacts(el: QuadRelayEl, rot: number): Contact[] {
  const out: Contact[] = [];
  for (let d = 0; d < 4; d++) {
    if (el.contacts[d]) out.push({ dir: ((d + rot) % 4) as Dir, color: el.blocks[d] });
  }
  return out;
}

/** 某继电器在某旋转状态下的世界触点 */
export const relayContacts = (el: PipeElement, rot: number): Contact[] =>
  el.kind === 'bar' ? barContacts(el, rot) : el.kind === 'quad' ? quadContacts(el, rot) : [];

/** 继电器当前朝向（游玩/打乱时用 startRot，校验解时用 rot） */
export const isRelay = (el: PipeElement): el is BarRelayEl | QuadRelayEl => el.kind === 'bar' || el.kind === 'quad';

// ---------------- 颜色分布预设 ----------------

/** 四块颜色分布：1 全同色 2 两色对向 3 3+1 4 两色相邻 */
export type BlockPattern = 1 | 2 | 3 | 4;

export function blockPattern(blocks: PipeColor[]): BlockPattern | null {
  const ys = blocks.map((b, i) => (b === 'yellow' ? i : -1)).filter((i) => i >= 0);
  if (ys.length === 0 || ys.length === 4) return 1;
  if (ys.length === 1 || ys.length === 3) return 3;
  const [a, b] = ys;
  return (a - b + 4) % 4 === 2 ? 2 : 4;
}

/** 四向中继器的触点配置是否满足预设要求 */
export function validateQuad(el: QuadRelayEl): string[] {
  const p = blockPattern(el.blocks);
  if (!p) return ['颜色分布非法'];
  const errors: string[] = [];
  const n = el.contacts.filter(Boolean).length;
  const hasOpposite = el.contacts.some((c, d) => c && el.contacts[(d + 2) % 4]);
  if (p === 1) {
    if (n < 1) errors.push('整体同色的四向中继器至少要有 1 个触点');
  } else if (p === 2) {
    if (n !== 4) errors.push('两色相对的四向中继器必须有 4 个触点');
  } else if (p === 3) {
    if (n !== 3 && n !== 4) errors.push('3+1 式的四向中继器触点数量必须为 3 或 4');
    // 少数色（只有 1 块的颜色）所在方向必须有触点
    const counts = el.blocks.filter((b) => b === 'yellow').length;
    const minority: PipeColor = counts === 1 ? 'yellow' : 'blue';
    const minorityDir = el.blocks.findIndex((b) => b === minority);
    if (!el.contacts[minorityDir]) errors.push('3+1 式只有一块的颜色必须有触点');
  } else {
    if (n <= 2) errors.push('两色相邻的四向中继器触点数量必须大于 2');
    if (hasOpposite) errors.push('两色相邻的四向中继器触点不能相对');
    const colors = new Set(el.contacts.map((c, d) => (c ? el.blocks[d] : null)).filter(Boolean));
    if (colors.size < 2) errors.push('两色相邻的四向中继器触点不能只放在同一种颜色上');
  }
  return errors;
}

// ---------------- 电力模拟 ----------------

export interface SimResult {
  lineColors: Set<PipeColor>[]; // 每条线承载的颜色
  lineHop: number[]; // 每条线通电的层级（过电动画延迟用），未通电为 -1
  lit: Record<string, Set<Dir>>; // 获电处 cellKey -> 已亮块方向
  relayOn: Set<string>; // 已通电的中继器
  keyOn: Set<string>; // 已通电的钥匙点
  done: boolean; // 所有获电处全亮
}

/** 获电处四块的点亮情况 */
export function litReceiverBlocks(
  el: ReceiverEl,
  received: (dir: Dir) => Set<PipeColor>,
  hasLine: (dir: Dir) => boolean,
): Set<Dir> {
  const lit = new Set<Dir>();
  const groups = new Map<PipeColor, Dir[]>();
  el.blocks.forEach((b, d) => groups.set(b, [...(groups.get(b) ?? []), d as Dir]));
  for (const [color, dirs] of groups) {
    const lineDirs = dirs.filter(hasLine);
    const powered = lineDirs.filter((d) => received(d).has(color));
    if (lineDirs.length > 0 && powered.length === lineDirs.length) {
      // 同色所有连接线都点亮：该颜色没连接线的块也点亮
      dirs.forEach((d) => lit.add(d));
    } else {
      // 否则只有通上电的方向亮
      powered.forEach((d) => lit.add(d));
    }
  }
  return lit;
}

export function simulate(level: PipeLevel, rots: Record<string, number>): SimResult {
  const { elements, lines } = level;
  const kOf = (c: Cell) => cellKey(c[0], c[1]);

  // 每条线两端的方向
  const ends = lines.map((l) => ({
    ka: kOf(l.a),
    kb: kOf(l.b),
    dirA: dirToward(l.a, l.b), // 从 a 指向 b
    dirB: dirToward(l.b, l.a),
  }));
  // 每个格子各方向上的线索引
  const lineAt = new Map<string, Map<Dir, number>>();
  ends.forEach((e, i) => {
    for (const [k, dir] of [
      [e.ka, e.dirA],
      [e.kb, e.dirB],
    ] as [string, Dir][]) {
      if (!lineAt.has(k)) lineAt.set(k, new Map());
      lineAt.get(k)!.set(dir, i);
    }
  });

  // 电力源：向所有连接线释放自己的颜色（hop 0）
  const lineColors: Set<PipeColor>[] = lines.map(() => new Set());
  const lineHop: number[] = lines.map(() => -1);
  const relayOn = new Set<string>();
  const keyOn = new Set<string>();

  for (const [k, el] of Object.entries(elements)) {
    if (el.kind !== 'source') continue;
    const la = lineAt.get(k);
    if (!la) continue;
    for (const [, idx] of la) {
      if (!lineColors[idx].has(el.color)) {
        lineColors[idx].add(el.color);
        lineHop[idx] = 0;
      }
    }
  }

  // 迭代到稳定：线把电传到对端 → 中继器被点亮 → 中继器各触点放电 → 下一跳
  // 空格里两条同向（共线）断线会接续导通
  const cellEnds = new Map<string, { idx: number; dir: Dir }[]>();
  ends.forEach((e, i) => {
    cellEnds.set(e.ka, [...(cellEnds.get(e.ka) ?? []), { idx: i, dir: e.dirA }]);
    cellEnds.set(e.kb, [...(cellEnds.get(e.kb) ?? []), { idx: i, dir: e.dirB }]);
  });
  const junctions: { a: number; b: number }[] = [];
  for (const [k, list] of cellEnds) {
    if (elements[k]) continue; // 只在空格
    if (list.length !== 2) continue; // 恰好两条断线
    if ((list[0].dir + 2) % 4 !== list[1].dir) continue; // 必须共线（方向相反）
    junctions.push({ a: list[0].idx, b: list[1].idx });
  }

  let hop = 0;
  let changed = true;
  while (changed && hop < 64) {
    changed = false;
    hop++;
    // 空格接续：一条线通电，同向的另一条也通电
    for (const j of junctions) {
      for (const [from, to] of [
        [j.a, j.b],
        [j.b, j.a],
      ] as const) {
        for (const color of lineColors[from]) {
          if (!lineColors[to].has(color)) {
            lineColors[to].add(color);
            if (lineHop[to] < 0) lineHop[to] = lineHop[from] >= 0 ? lineHop[from] : hop;
            changed = true;
          }
        }
      }
    }
    // 中继器：任一触点收到同色电 → 整体通电，所有触点释放各自颜色的电
    for (const [k, el] of Object.entries(elements)) {
      if (!isRelay(el) || relayOn.has(k)) continue;
      const rot = rots[k] ?? 0;
      const contacts = relayContacts(el, rot);
      const la = lineAt.get(k);
      const on = contacts.some((c) => {
        const idx = la?.get(c.dir);
        return idx !== undefined && lineColors[idx].has(c.color);
      });
      if (!on) continue;
      relayOn.add(k);
      changed = true;
      // 输出线的 hop = 触发它的输入线 hop + 1（保证动画按图深度逐级推进）
      const inHop = Math.min(
        ...contacts
          .filter((c) => {
            const idx = la?.get(c.dir);
            return idx !== undefined && lineColors[idx].has(c.color) && lineHop[idx] >= 0;
          })
          .map((c) => lineHop[la!.get(c.dir)!]),
      );
      for (const c of contacts) {
        const idx = la?.get(c.dir);
        if (idx === undefined) continue;
        if (!lineColors[idx].has(c.color)) {
          lineColors[idx].add(c.color);
          if (lineHop[idx] < 0) lineHop[idx] = inHop + 1;
        }
      }
    }
    // 钥匙点：触点方向收到同色电 → 通电（解锁上锁的中继器）
    for (const [k, el] of Object.entries(elements)) {
      if (el.kind !== 'key' || keyOn.has(k)) continue;
      const idx = lineAt.get(k)?.get(el.dir);
      if (idx !== undefined && lineColors[idx].has(el.color)) keyOn.add(k);
    }
  }

  // 获电处点亮（块亮灯仅作视觉反馈）
  const lit: Record<string, Set<Dir>> = {};
  for (const [k, el] of Object.entries(elements)) {
    if (el.kind !== 'receiver') continue;
    const la = lineAt.get(k);
    const received = (dir: Dir): Set<PipeColor> => {
      const idx = la?.get(dir);
      return idx !== undefined ? lineColors[idx] : new Set<PipeColor>();
    };
    const hasLine = (dir: Dir) => la?.has(dir) ?? false;
    lit[k] = litReceiverBlocks(el, received, hasLine);
  }
  // 完成判定：每个获电处至少接一条线，且每条连接线都传来对应块颜色的电（中环进度 100%）
  const receiverKeys = Object.keys(lit);
  const done =
    receiverKeys.length > 0 &&
    receiverKeys.every((k) => {
      const el = elements[k];
      if (el.kind !== 'receiver') return false;
      const la = lineAt.get(k);
      if (!la || la.size === 0) return false;
      return [...la.keys()].every((d) => lineColors[la.get(d)!].has(el.blocks[d]));
    });

  return { lineColors, lineHop, lit, relayOn, keyOn, done };
}

// ---------------- 关卡校验 ----------------

export function validatePipeLevel(level: PipeLevel): string[] {
  const errors: string[] = [];
  const { rows, cols, elements, lines } = level;
  const inBounds = ([x, y]: Cell) => x >= 0 && y >= 0 && x < cols && y < rows;
  if (rows < MIN_GRID || rows > MAX_GRID || cols < MIN_GRID || cols > MAX_GRID) {
    errors.push(`棋盘大小必须在 ${MIN_GRID}×${MIN_GRID} ~ ${MAX_GRID}×${MAX_GRID} 之间`);
  }

  const entries = Object.entries(elements);
  const sources = entries.filter(([, el]) => el.kind === 'source');
  const receivers = entries.filter(([, el]) => el.kind === 'receiver');
  const keys = entries.filter(([, el]) => el.kind === 'key');
  if (sources.length === 0) errors.push('至少需要一个电力源');
  if (receivers.length === 0) errors.push('至少需要一个获电处');
  if (keys.length > MAX_KEYS) errors.push(`钥匙点最多 ${MAX_KEYS} 个`);
  for (const [k, el] of entries) {
    const [x, y] = k.split(',').map(Number);
    if (!inBounds([x, y])) errors.push('有控件越界');
    if (el.kind === 'receiver' && !blockPattern(el.blocks)) errors.push('获电处颜色分布非法');
    if (el.kind === 'quad') errors.push(...validateQuad(el));
  }

  // 连接线：同行/列、端点有控件（或恰好两条共线断线接续的空格）、中间无控件、不重复
  const endCount = new Map<string, number[]>();
  lines.forEach((l, i) => {
    const ka = cellKey(l.a[0], l.a[1]);
    const kb = cellKey(l.b[0], l.b[1]);
    endCount.set(ka, [...(endCount.get(ka) ?? []), i]);
    endCount.set(kb, [...(endCount.get(kb) ?? []), i]);
  });
  const seen = new Set<string>();
  lines.forEach((l, i) => {
    if (l.a[0] !== l.b[0] && l.a[1] !== l.b[1]) errors.push(`第 ${i + 1} 条连接线必须水平或竖直`);
    if (l.a[0] === l.b[0] && l.a[1] === l.b[1]) errors.push(`第 ${i + 1} 条连接线两端相同`);
    // 端点是空格时，必须恰好是两条共线断线的接续格
    for (const [c, from] of [
      [l.a, l.b],
      [l.b, l.a],
    ] as [Cell, Cell][]) {
      const k = cellKey(c[0], c[1]);
      if (elements[k]) continue;
      const others = (endCount.get(k) ?? []).filter((j) => j !== i);
      let ok = false;
      if (others.length === 1) {
        const ol = lines[others[0]];
        const od = cellKey(ol.a[0], ol.a[1]) === k ? dirToward(ol.a, ol.b) : dirToward(ol.b, ol.a);
        ok = (od + 2) % 4 === dirToward(c, from);
      }
      if (!ok) errors.push(`第 ${i + 1} 条连接线的端点上没有控件`);
    }
    for (const [x, y] of lineMidCells(l)) {
      if (elements[cellKey(x, y)]) errors.push(`第 ${i + 1} 条连接线中间有控件阻挡`);
    }
    const sig = [l.a, l.b].map((c) => cellKey(c[0], c[1])).sort().join('|');
    if (seen.has(sig)) errors.push('存在重复的连接线');
    seen.add(sig);
  });

  // 同方向重叠（覆盖 ≥2 格）的连接线不合法（仅端点相接的接续除外）
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const a = lines[i];
      const b = lines[j];
      if (a.a[1] === a.b[1] && b.a[1] === b.b[1] && a.a[1] === b.a[1]) {
        const [s1, e1] = [Math.min(a.a[0], a.b[0]), Math.max(a.a[0], a.b[0])];
        const [s2, e2] = [Math.min(b.a[0], b.b[0]), Math.max(b.a[0], b.b[0])];
        if (Math.min(e1, e2) - Math.max(s1, s2) >= 1) errors.push('存在相互重叠的连接线');
      }
      if (a.a[0] === a.b[0] && b.a[0] === b.b[0] && a.a[0] === b.a[0]) {
        const [s1, e1] = [Math.min(a.a[1], a.b[1]), Math.max(a.a[1], a.b[1])];
        const [s2, e2] = [Math.min(b.a[1], b.b[1]), Math.max(b.a[1], b.b[1])];
        if (Math.min(e1, e2) - Math.max(s1, s2) >= 1) errors.push('存在相互重叠的连接线');
      }
    }
  }

  // 获电处接线数量与预设匹配
  const lineCountAt = (k: string, dir: Dir) =>
    lines.some((l) => cellKey(l.a[0], l.a[1]) === k && dirToward(l.a, l.b) === dir) ||
    lines.some((l) => cellKey(l.b[0], l.b[1]) === k && dirToward(l.b, l.a) === dir);
  for (const [k, el] of receivers) {
    if (el.kind !== 'receiver') continue;
    const p = blockPattern(el.blocks);
    const dirs = ([0, 1, 2, 3] as Dir[]).filter((d) => lineCountAt(k, d));
    const n = dirs.length;
    if (p === 1) {
      if (n < 1) errors.push('获电处至少需要 1 条连接线');
    } else if (p === 2) {
      if (n !== 4) errors.push('两色对向的获电处必须连接 4 条连接线');
    } else if (p === 3) {
      if (n !== 3 && n !== 4) errors.push('3+1 式的获电处必须连接 3 或 4 条连接线');
      const counts = el.blocks.filter((b) => b === 'yellow').length;
      const minority: PipeColor = counts === 1 ? 'yellow' : 'blue';
      const minorityDir = el.blocks.findIndex((b) => b === minority) as Dir;
      if (!lineCountAt(k, minorityDir)) errors.push('3+1 式的获电处：单块颜色必须有一条连接线');
      if (n === 3) {
        const trio = ([0, 1, 2, 3] as Dir[]).filter((d) => el.blocks[d] !== minority);
        const trioLines = trio.filter((d) => lineCountAt(k, d)).length;
        if (trioLines !== 2) errors.push('3+1 式的获电处：三块的颜色只能分 2 条连接线');
      }
    } else if (p === 4) {
      if (n !== 2) errors.push('两色相邻的获电处必须连接 2 条连接线');
      const colors = new Set(dirs.map((d) => el.blocks[d]));
      if (colors.size < 2) errors.push('两色相邻的获电处必须两种颜色各连接一条');
    }
    void k;
  }

  // 钥匙点与上锁中继器必须同时存在
  const hasLocked = entries.some(([, el]) => isRelay(el) && el.locked);
  if (keys.length > 0 && !hasLocked) errors.push('有钥匙点时必须给一个中继器上锁');
  if (hasLocked && keys.length === 0) errors.push('有上锁的中继器时必须放置钥匙点');

  // 必须为通路：按解的朝向模拟，所有获电处全亮
  if (errors.length === 0) {
    const solRots: Record<string, number> = {};
    for (const [k, el] of entries) if (isRelay(el)) solRots[k] = el.rot;
    if (!simulate(level, solRots).done) errors.push('当前电路不是通路，存在无法点亮的获电处');
  }

  return [...new Set(errors)];
}

/** 打乱后的开局朝向不是已通关状态，且钥匙点不能已经通电（否则玩家进入直接通关/直接解锁） */
export function scrambledOk(level: PipeLevel, startRots: Record<string, number>): boolean {
  const sim = simulate(level, startRots);
  return !sim.done && sim.keyOn.size === 0;
}

/** 一键随机打乱：随机所有未上锁中继器的朝向（上锁的只能手动调整），直到不是通关状态 */
export function randomScramble(level: PipeLevel): Record<string, number> {
  const rots: Record<string, number> = {};
  for (const [k, el] of Object.entries(level.elements)) if (isRelay(el)) rots[k] = el.rot;
  const relayKeys = Object.keys(rots).filter((k) => {
    const el = level.elements[k];
    return isRelay(el) && !el.locked;
  });
  if (relayKeys.length === 0) return rots;
  for (let i = 0; i < 200; i++) {
    const k = relayKeys[Math.floor(Math.random() * relayKeys.length)];
    rots[k] = (rots[k] + 1 + Math.floor(Math.random() * 3)) % 4;
    if (scrambledOk(level, rots)) return rots;
  }
  return rots;
}
