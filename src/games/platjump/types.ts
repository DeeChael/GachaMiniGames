// ============================================================
// 黄金替罪羊（崩坏：星穹铁道）— 核心类型与关卡校验
// 格子坐标：[x, y]，x 向右，y 向下；角色站在「可站立格」内
// ============================================================

/** 格子坐标：[x, y] */
export type Cell = [number, number];

/** 操作方向（WASD） */
export type Dir = 'W' | 'A' | 'S' | 'D';

/** 可开关平台颜色 */
export type ToggleColor = 'yellow' | 'blue';

export const MIN_COLS = 6;
export const MAX_COLS = 20;
export const MIN_ROWS = 4;
export const MAX_ROWS = 15;
/** 步数下限：NPC 复现玩家前 N 步的 N */
export const MIN_STEPS = 2;

/** 可开关平台：每个格子单独设置默认开关状态（按钮控制同色全部平台） */
export interface ToggleTileDef {
  pos: Cell;
  color: ToggleColor;
  /** 默认开关状态：true = 开（可站立） */
  on: boolean;
}

export interface ButtonTile {
  pos: Cell;
  color: ToggleColor;
}

/** 传送门：必须且仅能放置两个，且必须放在平台之上；使用后关闭，踩住橙色按钮可再次激活 */
export interface PortalDef {
  pos: Cell[]; // 恰好 2 个格子
  /** 默认开关状态：true = 开 */
  open: boolean;
}

/** 关卡定义 */
export interface PlatLevel {
  name: string;
  cols: number; // 6 ~ 20
  rows: number; // 4 ~ 15
  steps: number; // >= 4
  spawn: Cell; // 出生点（必放，必须在平台或梯子之上）
  altar: Cell; // 祭坛（必放，必须在平台或梯子顶部之上）
  platforms: Cell[]; // 普通平台
  toggles: ToggleTileDef[]; // 可开关平台（逐格默认状态）
  buttons: ButtonTile[];
  ladders: Cell[]; // 梯子格（竖向连续），梯子底部必须放置平台
  portals: PortalDef | null; // 传送门（可选；放置时必须恰好两个）
  orangeButton: Cell | null; // 橙色按钮（可选）：显示传送门状态，踩住时传送门（重新）激活
}

export const cellKey = (x: number, y: number) => `${x},${y}`;

/** 可开关平台 / 按钮的配色 */
export const TOGGLE_COLORS: Record<ToggleColor, { main: string; light: string; dim: string; name: string }> = {
  yellow: { main: '#e8c840', light: '#f5e08a', dim: 'rgba(232,200,64,0.16)', name: '黄色' },
  blue: { main: '#4a9ae0', light: '#8ac2f0', dim: 'rgba(74,154,224,0.16)', name: '蓝色' },
};

/** 梯子分段：把梯子格按列分组为竖向连续段，每段从上到下排列 */
export function ladderRuns(ladders: Cell[]): Cell[][] {
  const byCol = new Map<number, number[]>();
  for (const [x, y] of ladders) {
    const arr = byCol.get(x) ?? [];
    arr.push(y);
    byCol.set(x, arr);
  }
  const runs: Cell[][] = [];
  for (const [x, ys] of byCol) {
    ys.sort((a, b) => a - b);
    let run: Cell[] = [];
    for (const y of ys) {
      if (run.length > 0 && run[run.length - 1][1] !== y - 1) {
        runs.push(run);
        run = [];
      }
      run.push([x, y]);
    }
    if (run.length > 0) runs.push(run);
  }
  return runs;
}

/** 校验关卡结构是否合法，返回错误信息列表（空数组 = 合法） */
export function validatePlatLevel(level: PlatLevel): string[] {
  const errors: string[] = [];
  const { cols, rows, steps, spawn, altar, platforms, toggles, buttons, ladders, portals, orangeButton } = level;
  const inBounds = ([x, y]: Cell) => x >= 0 && y >= 0 && x < cols && y < rows;

  if (cols < MIN_COLS || cols > MAX_COLS || rows < MIN_ROWS || rows > MAX_ROWS) {
    errors.push(`场景尺寸必须在 ${MIN_COLS}x${MIN_ROWS} ~ ${MAX_COLS}x${MAX_ROWS} 之间`);
  }
  if (steps < MIN_STEPS) errors.push(`步数最小为 ${MIN_STEPS}`);
  const spawnOk = inBounds(spawn);
  const altarOk = inBounds(altar);
  if (!spawnOk) errors.push('出生点越界或未放置');
  if (!altarOk) errors.push('祭坛越界或未放置');

  // 瓦片（平台 / 可开关平台 / 按钮 / 梯子）不允许互相重叠
  // 例外：按钮可以与平台、可开关平台、梯子同格（按钮贴格底，可共存）
  const seen = new Map<string, string>();
  const claim = (cells: Cell[], label: string) => {
    for (const c of cells) {
      if (!inBounds(c)) errors.push(`${label}越界`);
      const k = cellKey(c[0], c[1]);
      const prev = seen.get(k);
      if (prev) errors.push(`${label}与${prev}重叠`);
      else seen.set(k, label);
    }
  };
  claim(platforms, '平台');
  claim(toggles.map((t) => t.pos), '可开关平台');
  claim(ladders, '梯子');
  const buttonSeen = new Set<string>();
  for (const b of buttons) {
    if (!inBounds(b.pos)) errors.push('按钮越界');
    const k = cellKey(b.pos[0], b.pos[1]);
    const prev = seen.get(k);
    if (prev && prev !== '平台' && prev !== '可开关平台' && prev !== '梯子') errors.push(`按钮与${prev}重叠`);
    if (buttonSeen.has(k)) errors.push('按钮与按钮重叠');
    buttonSeen.add(k);
  }

  // 传送门：放置时必须恰好两个；可与平台、可开关平台、黄蓝按钮同格；
  // 不能与梯子、橙色按钮同格，两个传送门也不能同格
  if (portals) {
    if (portals.pos.length !== 2) errors.push('传送门必须且仅能放置两个');
    const ladderSet = new Set(ladders.map(([x, y]) => cellKey(x, y)));
    const portalSeen = new Set<string>();
    for (const c of portals.pos) {
      if (!inBounds(c)) errors.push('传送门越界');
      const k = cellKey(c[0], c[1]);
      if (portalSeen.has(k)) errors.push('两个传送门不能放在同一格');
      portalSeen.add(k);
      if (ladderSet.has(k)) errors.push('传送门不能与梯子同格');
      if (orangeButton && cellKey(orangeButton[0], orangeButton[1]) === k) errors.push('传送门不能与橙色按钮同格');
    }
  }

  // 橙色按钮：最多一个；不能与其他按钮同格（与传送门的互斥在上面检查）；必须先有传送门
  if (orangeButton) {
    if (!portals) errors.push('必须先放置传送门才能放置橙色按钮');
    if (!inBounds(orangeButton)) errors.push('橙色按钮越界');
    if (buttonSeen.has(cellKey(orangeButton[0], orangeButton[1]))) errors.push('橙色按钮不能与其他按钮同格');
  }

  // 存在某种颜色的可开关平台时，必须放置对应颜色的按钮
  const colors = new Set(toggles.map((t) => t.color));
  for (const c of colors) {
    if (!buttons.some((b) => b.color === c)) {
      errors.push(`存在${c === 'yellow' ? '黄色' : '蓝色'}可开关平台，必须放置对应颜色的控制按钮`);
    }
  }

  // 梯子：底部必须放置平台（梯子最底格正下方一格是平台）
  const platformSet = new Set(platforms.map(([x, y]) => cellKey(x, y)));
  for (const run of ladderRuns(ladders)) {
    const [bx, by] = run[run.length - 1];
    if (!platformSet.has(cellKey(bx, by + 1))) errors.push('梯子底部必须放置平台');
  }

  // 落地校验：出生点 / 按钮的正下方必须是平台；
  // 祭坛的正下方可以是平台或梯子顶部横档（引擎里梯子顶部相当于平台，角色站在其上方一格）
  const topRungs = new Set(ladderRuns(ladders).map((run) => cellKey(run[0][0], run[0][1])));
  const supported = (c: Cell) => platformSet.has(cellKey(c[0], c[1] + 1));
  const altarSupported = (c: Cell) => supported(c) || topRungs.has(cellKey(c[0], c[1] + 1));
  if (spawnOk && !supported(spawn)) errors.push('出生点必须放在平台之上');
  if (altarOk && !altarSupported(altar)) errors.push('祭坛必须放在平台或梯子顶部之上');
  for (const b of buttons) {
    if (inBounds(b.pos) && !supported(b.pos)) errors.push('按钮必须放在平台之上');
  }
  if (orangeButton && inBounds(orangeButton) && !supported(orangeButton)) errors.push('橙色按钮必须放在平台之上');
  if (portals) {
    for (const c of portals.pos) {
      if (inBounds(c) && !supported(c)) errors.push('传送门必须放在平台之上');
    }
  }

  return [...new Set(errors)];
}
