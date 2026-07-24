// ============================================================
// 黄金替罪羊 —— 关卡编辑器
// 必放：出生点、祭坛；步数最小 4；存在可开关平台时必须放对应颜色按钮
// 创建完关卡后必须先「试玩」并通关，才能生成分享码
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { Cell, PlatLevel } from './types';
import {
  MAX_COLS,
  MAX_ROWS,
  MIN_COLS,
  MIN_ROWS,
  MIN_STEPS,
  TOGGLE_COLORS,
  cellKey,
  validatePlatLevel,
} from './types';
import { encodePlatLevel } from './shareCode';
import {
  AltarTile,
  ButtonTile,
  LadderTile,
  PlatformTile,
  PortalTile,
  SpawnTile,
  ToggleTile,
} from './Tiles';

type Tool = 'spawn' | 'altar' | 'platform' | 'ty' | 'tb' | 'by' | 'bb' | 'ladder' | 'portal' | 'ob';

// 前 5 个用数字键 1~5，后面的用 Ctrl+数字（Ctrl+1 = 第 6 个）；擦除用右键
const TOOLS: [Tool, string][] = [
  ['spawn', '⚑ 出生点'],
  ['altar', '🔥 祭坛'],
  ['platform', '▬ 平台'],
  ['ty', '🟡 黄色平台'],
  ['tb', '🔵 蓝色平台'],
  ['by', '🟡 黄色按钮'],
  ['bb', '🔵 蓝色按钮'],
  ['ladder', '🪜 梯子'],
  ['portal', '🌀 传送门'],
  ['ob', '🟠 橙色按钮'],
];

type CellSet = Set<string>;

export default function PlatjumpEditorPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // 试玩通关返回时：还原关卡并解锁分享码
  const init = useMemo(() => {
    const st = location.state as { level?: PlatLevel; passed?: boolean } | null;
    if (!st?.level) return null;
    return { level: st.level, passed: !!st.passed };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toSet = (cells: Cell[]): CellSet => new Set(cells.map(([x, y]) => cellKey(x, y)));
  const toMap = (defs: { pos: Cell; on: boolean }[]): Map<string, boolean> =>
    new Map(defs.map((t) => [cellKey(t.pos[0], t.pos[1]), t.on]));

  const [name, setName] = useState(init?.level.name ?? '我的关卡');
  const [cols, setCols] = useState(init?.level.cols ?? 10);
  const [rows, setRows] = useState(init?.level.rows ?? 8);
  const [steps, setSteps] = useState(init?.level.steps ?? 4);
  const [spawn, setSpawn] = useState<Cell | null>(init?.level.spawn ?? null);
  const [altar, setAltar] = useState<Cell | null>(init?.level.altar ?? null);
  const [platforms, setPlatforms] = useState<CellSet>(() => toSet(init?.level.platforms ?? []));
  // 可开关平台：每格独立默认开关状态（key → 默认开）
  const [ty, setTy] = useState<Map<string, boolean>>(() => toMap((init?.level.toggles ?? []).filter((t) => t.color === 'yellow')));
  const [tb, setTb] = useState<Map<string, boolean>>(() => toMap((init?.level.toggles ?? []).filter((t) => t.color === 'blue')));
  const [by, setBy] = useState<CellSet>(() => toSet((init?.level.buttons ?? []).filter((b) => b.color === 'yellow').map((b) => b.pos)));
  const [bb, setBb] = useState<CellSet>(() => toSet((init?.level.buttons ?? []).filter((b) => b.color === 'blue').map((b) => b.pos)));
  const [ladders, setLadders] = useState<CellSet>(() => toSet(init?.level.ladders ?? []));
  const [portalCells, setPortalCells] = useState<Cell[]>(init?.level.portals?.pos ?? []);
  const [portalOpenDef, setPortalOpenDef] = useState(init?.level.portals?.open ?? true);
  const [orangeBtn, setOrangeBtn] = useState<Cell | null>(init?.level.orangeButton ?? null);
  // 新放置的可开关平台使用的默认状态（放置后可逐格切换）
  const [tyOn, setTyOn] = useState(false);
  const [tbOn, setTbOn] = useState(false);

  const [tool, setTool] = useState<Tool>('platform');
  const [testPassed, setTestPassed] = useState(init?.passed ?? false);
  const [shareCode, setShareCode] = useState('');
  const [copied, setCopied] = useState(false);

  // 数字键 1~5 选前 5 个摆件，Ctrl+数字选第 6 个及以后（Ctrl+1 = 第 6 个）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const n = Number(e.key);
      if (!n) return;
      if (e.ctrlKey || e.metaKey) {
        const idx = 5 + n - 1;
        if (idx < TOOLS.length) {
          e.preventDefault();
          setTool(TOOLS[idx][0]);
        }
      } else if (n <= 5) {
        setTool(TOOLS[n - 1][0]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // 任何影响玩法的修改都需要重新试玩
  const dirty = () => setTestPassed(false);

  const level: PlatLevel = useMemo(
    () => ({
      name: name.trim() || '自定义关卡',
      cols,
      rows,
      steps,
      spawn: spawn ?? [-1, -1],
      altar: altar ?? [-1, -1],
      platforms: [...platforms].map((k) => k.split(',').map(Number) as Cell),
      toggles: [
        ...[...ty].map(([k, on]) => ({ pos: k.split(',').map(Number) as Cell, color: 'yellow' as const, on })),
        ...[...tb].map(([k, on]) => ({ pos: k.split(',').map(Number) as Cell, color: 'blue' as const, on })),
      ],
      buttons: [
        ...[...by].map((k) => ({ pos: k.split(',').map(Number) as Cell, color: 'yellow' as const })),
        ...[...bb].map((k) => ({ pos: k.split(',').map(Number) as Cell, color: 'blue' as const })),
      ],
      ladders: [...ladders].map((k) => k.split(',').map(Number) as Cell),
      portals: portalCells.length > 0 ? { pos: portalCells.map((c) => [...c] as Cell), open: portalOpenDef } : null,
      orangeButton: orangeBtn,
    }),
    [name, cols, rows, steps, spawn, altar, platforms, ty, tb, by, bb, ladders, portalCells, portalOpenDef, orangeBtn],
  );

  const errors = validatePlatLevel(level);

  // 清除某格的瓦片；按钮与平台 / 可开关平台 / 梯子可同格，可按需保留
  const clearTile = (k: string, keep: { platform?: boolean; toggle?: boolean; button?: boolean; ladder?: boolean } = {}) => {
    if (!keep.platform) {
      setPlatforms((s) => {
        if (!s.has(k)) return s;
        const ns = new Set(s);
        ns.delete(k);
        return ns;
      });
    }
    const setSets: React.Dispatch<React.SetStateAction<CellSet>>[] = [
      ...(keep.button ? [] : [setBy, setBb]),
      ...(keep.ladder ? [] : [setLadders]),
    ];
    for (const setter of setSets) {
      setter((s) => {
        if (!s.has(k)) return s;
        const ns = new Set(s);
        ns.delete(k);
        return ns;
      });
    }
    if (!keep.toggle) {
      for (const setter of [setTy, setTb] as React.Dispatch<React.SetStateAction<Map<string, boolean>>>[]) {
        setter((m) => {
          if (!m.has(k)) return m;
          const nm = new Map(m);
          nm.delete(k);
          return nm;
        });
      }
    }
  };

  // 删除某格控件：同格时优先删除当前选中的控件；都没被选中时优先删除平台类控件
  const eraseAt = (x: number, y: number) => {
    dirty();
    const k = cellKey(x, y);
    const delSet = (setter: React.Dispatch<React.SetStateAction<CellSet>>) =>
      setter((s) => {
        const ns = new Set(s);
        ns.delete(k);
        return ns;
      });
    const delMap = (setter: React.Dispatch<React.SetStateAction<Map<string, boolean>>>) =>
      setter((m) => {
        const nm = new Map(m);
        nm.delete(k);
        return nm;
      });
    // 1. 优先删除当前选中的控件
    if (tool === 'platform' && platforms.has(k)) return delSet(setPlatforms);
    if (tool === 'ty' && ty.has(k)) return delMap(setTy);
    if (tool === 'tb' && tb.has(k)) return delMap(setTb);
    if (tool === 'by' && by.has(k)) return delSet(setBy);
    if (tool === 'bb' && bb.has(k)) return delSet(setBb);
    if (tool === 'ladder' && ladders.has(k)) return delSet(setLadders);
    if (tool === 'portal' && portalCells.some((c) => cellKey(c[0], c[1]) === k)) {
      return setPortalCells((cs) => cs.filter((c) => cellKey(c[0], c[1]) !== k));
    }
    if (tool === 'ob' && orangeBtn && cellKey(orangeBtn[0], orangeBtn[1]) === k) return setOrangeBtn(null);
    // 2. 都没被选中：平台类优先
    if (platforms.has(k)) return delSet(setPlatforms);
    if (ty.has(k)) return delMap(setTy);
    if (tb.has(k)) return delMap(setTb);
    if (ladders.has(k)) return delSet(setLadders);
    if (by.has(k)) return delSet(setBy);
    if (bb.has(k)) return delSet(setBb);
    if (portalCells.some((c) => cellKey(c[0], c[1]) === k)) {
      return setPortalCells((cs) => cs.filter((c) => cellKey(c[0], c[1]) !== k));
    }
    if (orangeBtn && cellKey(orangeBtn[0], orangeBtn[1]) === k) return setOrangeBtn(null);
  };

  const applyTool = (x: number, y: number) => {
    const k = cellKey(x, y);
    dirty();
    if (tool === 'spawn') return setSpawn([x, y]);
    if (tool === 'altar') return setAltar([x, y]);
    // 点击已放置的可开关平台：单独切换该格的默认状态
    if (tool === 'ty' && ty.has(k)) {
      return setTy((m) => new Map(m).set(k, !m.get(k)));
    }
    if (tool === 'tb' && tb.has(k)) {
      return setTb((m) => new Map(m).set(k, !m.get(k)));
    }
    if (tool === 'ty' || tool === 'tb') {
      // 可开关平台与按钮可同格：放置时保留按钮
      clearTile(k, { button: true });
      const on = tool === 'ty' ? tyOn : tbOn;
      return (tool === 'ty' ? setTy : setTb)((m) => new Map(m).set(k, on));
    }
    // 按钮与平台 / 可开关平台 / 梯子可同格：放按钮保留它们，放它们时保留按钮
    // 两个按钮不能同格：放黄蓝按钮时清掉橙色按钮
    if (tool === 'by' || tool === 'bb') {
      clearTile(k, { platform: true, toggle: true, ladder: true });
      if (orangeBtn && cellKey(orangeBtn[0], orangeBtn[1]) === k) setOrangeBtn(null);
      return (tool === 'by' ? setBy : setBb)((s) => new Set(s).add(k));
    }
    if (tool === 'platform') {
      clearTile(k, { button: true });
      return setPlatforms((s) => new Set(s).add(k));
    }
    // 传送门：再点已放置的传送门取消；最多两个（可与平台、可开关平台、黄蓝按钮同格）
    if (tool === 'portal') {
      if (portalCells.some((c) => cellKey(c[0], c[1]) === k)) {
        return setPortalCells((cs) => cs.filter((c) => cellKey(c[0], c[1]) !== k));
      }
      if (portalCells.length >= 2) return;
      // 传送门不能与梯子、橙色按钮同格：放置时清掉它们
      setLadders((s) => {
        const ns = new Set(s);
        ns.delete(k);
        return ns;
      });
      if (orangeBtn && cellKey(orangeBtn[0], orangeBtn[1]) === k) setOrangeBtn(null);
      return setPortalCells((cs) => [...cs, [x, y]]);
    }
    // 橙色按钮：再点取消；与平台、可开关平台、梯子可同格；不能与其他按钮、传送门同格
    if (tool === 'ob') {
      if (orangeBtn && cellKey(orangeBtn[0], orangeBtn[1]) === k) return setOrangeBtn(null);
      setBy((s) => {
        const ns = new Set(s);
        ns.delete(k);
        return ns;
      });
      setBb((s) => {
        const ns = new Set(s);
        ns.delete(k);
        return ns;
      });
      setPortalCells((cs) => cs.filter((c) => cellKey(c[0], c[1]) !== k));
      return setOrangeBtn([x, y]);
    }
    // ladder：传送门不能与梯子同格，放梯子时清掉传送门
    clearTile(k, { button: true });
    setPortalCells((cs) => cs.filter((c) => cellKey(c[0], c[1]) !== k));
    setLadders((s) => new Set(s).add(k));
  };

  const resize = (newCols: number, newRows: number) => {
    dirty();
    setCols(newCols);
    setRows(newRows);
    const inRange = (k: string) => {
      const [x, y] = k.split(',').map(Number);
      return x < newCols && y < newRows;
    };
    const keepSet = (s: CellSet) => new Set([...s].filter(inRange));
    for (const setter of [setPlatforms, setBy, setBb, setLadders] as React.Dispatch<React.SetStateAction<CellSet>>[]) {
      setter(keepSet);
    }
    for (const setter of [setTy, setTb] as React.Dispatch<React.SetStateAction<Map<string, boolean>>>[]) {
      setter((m) => new Map([...m].filter(([k]) => inRange(k))));
    }
    if (spawn && (spawn[0] >= newCols || spawn[1] >= newRows)) setSpawn(null);
    if (altar && (altar[0] >= newCols || altar[1] >= newRows)) setAltar(null);
    setPortalCells((cs) => cs.filter(([x, y]) => x < newCols && y < newRows));
    if (orangeBtn && (orangeBtn[0] >= newCols || orangeBtn[1] >= newRows)) setOrangeBtn(null);
  };

  const play = () => navigate('/platjump', { state: { level, test: true } });

  const generate = () => {
    setShareCode(encodePlatLevel(level));
    setCopied(false);
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(shareCode);
      setCopied(true);
    } catch {
      // 剪贴板不可用时让用户手动复制
    }
  };

  const cs = Math.max(26, Math.min(52, Math.floor(Math.min(680 / cols, 460 / rows))));
  const clampSize = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  const tileAt = (x: number, y: number) => {
    const k = cellKey(x, y);
    return (
      <>
        {platforms.has(k) && <PlatformTile cs={cs} />}
        {ty.has(k) && <ToggleTile cs={cs} color="yellow" on={ty.get(k)!} />}
        {tb.has(k) && <ToggleTile cs={cs} color="blue" on={tb.get(k)!} />}
        {ladders.has(k) && <LadderTile cs={cs} top={!ladders.has(cellKey(x, y - 1))} />}
        {by.has(k) && <ButtonTile cs={cs} color="yellow" />}
        {bb.has(k) && <ButtonTile cs={cs} color="blue" />}
        {orangeBtn && orangeBtn[0] === x && orangeBtn[1] === y && (
          <ButtonTile cs={cs} color="orange" pressed={portalOpenDef} />
        )}
        {portalCells.some((c) => c[0] === x && c[1] === y) && <PortalTile cs={cs} open={portalOpenDef} />}
      </>
    );
  };

  return (
    <div className="min-h-[calc(100vh-65px)] bg-[#0a0f1a] px-4 py-10 text-neutral-300 select-none">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-start justify-between gap-3">
          <div>
            <div className="text-xs tracking-[0.3em] text-neutral-500">// 黄金替罪羊 · 关卡编辑器</div>
            <h1 className="mt-2 text-2xl font-medium text-neutral-100">制作我的关卡</h1>
          </div>
          <button onClick={() => navigate('/platjump')} className="border border-neutral-700 px-4 py-2 text-sm text-neutral-400 hover:border-neutral-500">
            ✕ 返回
          </button>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
          {/* 左：场景 */}
          <div>
            {/* 工具栏：5 列网格，第二行（Ctrl+数字）与第一行上下对齐 */}
            <div className="mb-3 grid grid-cols-5 gap-1.5">
              {TOOLS.map(([t, label], i) => (
                <button
                  key={t}
                  onClick={() => setTool(t)}
                  className={`border px-1 py-1.5 text-xs ${
                    tool === t
                      ? 'border-[#d8b44a]/70 bg-[#d8b44a]/10 text-[#e8d48a]'
                      : 'border-neutral-700 text-neutral-400 hover:border-neutral-500'
                  }`}
                >
                  <span className="mr-0.5 text-neutral-500">{i < 5 ? i + 1 : `^${i - 4}`}</span>
                  {label}
                </button>
              ))}
            </div>
            <div className="mb-4 text-xs text-neutral-600">
              数字键 1~5 选前 5 个，Ctrl+1~{TOOLS.length - 5} 选其余的；点击格子放置，右键擦除；传送门必须放两个且放在平台之上，可与平台、黄蓝按钮同格；橙色按钮需要先放传送门
            </div>

            <div className="inline-block border border-[#2a3a58] bg-gradient-to-b from-[#101a30] to-[#0a1120] p-4">
              <div className="relative" style={{ width: cols * cs, height: rows * cs }}>
                {Array.from({ length: rows }, (_, y) =>
                  Array.from({ length: cols }, (_, x) => {
                    const k = cellKey(x, y);
                    return (
                      <div
                        key={k}
                        onClick={() => applyTool(x, y)}
                        onContextMenu={(e) => {
                          // 右键擦除（同格时优先删除当前选中的控件）
                          e.preventDefault();
                          eraseAt(x, y);
                        }}
                        className="absolute cursor-pointer"
                        style={{
                          left: x * cs,
                          top: y * cs,
                          width: cs,
                          height: cs,
                          border: '1px solid rgba(90,120,180,0.14)',
                        }}
                      >
                        {tileAt(x, y)}
                        {spawn && spawn[0] === x && spawn[1] === y && <SpawnTile cs={cs} />}
                        {altar && altar[0] === x && altar[1] === y && <AltarTile cs={cs} />}
                      </div>
                    );
                  }),
                )}
              </div>
            </div>
          </div>

          {/* 右：配置 */}
          <div className="space-y-6">
            <div>
              <label className="mb-1.5 block text-xs tracking-widest text-neutral-500">关卡名称</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 24))}
                className="w-full border border-neutral-800 bg-[#141a28] px-4 py-2.5 text-base outline-none focus:border-[#d8b44a]/50"
              />
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="mb-1.5 block text-xs tracking-widest text-neutral-500">长 (列) {cols}</label>
                <input
                  type="range" min={MIN_COLS} max={MAX_COLS} value={cols}
                  onChange={(e) => resize(clampSize(Number(e.target.value), MIN_COLS, MAX_COLS), rows)}
                  className="w-full accent-[#d8b44a]"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1.5 block text-xs tracking-widest text-neutral-500">高 (行) {rows}</label>
                <input
                  type="range" min={MIN_ROWS} max={MAX_ROWS} value={rows}
                  onChange={(e) => resize(cols, clampSize(Number(e.target.value), MIN_ROWS, MAX_ROWS))}
                  className="w-full accent-[#d8b44a]"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs tracking-widest text-neutral-500">步数（最小 {MIN_STEPS}）</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    dirty();
                    setSteps((s) => Math.max(MIN_STEPS, s - 1));
                  }}
                  disabled={steps <= MIN_STEPS}
                  className="flex h-9 w-9 items-center justify-center border border-neutral-700 text-lg text-neutral-300 hover:border-neutral-500 disabled:opacity-30"
                >
                  −
                </button>
                <span className="w-12 text-center text-lg font-bold text-neutral-100">{steps}</span>
                <button
                  onClick={() => {
                    dirty();
                    setSteps((s) => Math.min(99, s + 1));
                  }}
                  disabled={steps >= 99}
                  className="flex h-9 w-9 items-center justify-center border border-neutral-700 text-lg text-neutral-300 hover:border-neutral-500 disabled:opacity-30"
                >
                  ＋
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs tracking-widest text-neutral-500">可开关平台默认状态（新放置的平台生效）</label>
              <div className="flex gap-2">
                {(['yellow', 'blue'] as const).map((c) => {
                  const on = c === 'yellow' ? tyOn : tbOn;
                  const set = c === 'yellow' ? setTyOn : setTbOn;
                  return (
                    <button
                      key={c}
                      onClick={() => set(!on)}
                      className="flex items-center gap-2 border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:border-neutral-500"
                    >
                      <span className="inline-block h-3.5 w-3.5" style={{ background: TOGGLE_COLORS[c].main }} />
                      {TOGGLE_COLORS[c].name}平台：{on ? '开' : '关'}
                    </button>
                  );
                })}
              </div>
              <div className="mt-1.5 text-xs text-neutral-600">用对应工具点击已放置的平台，可单独切换该格的默认状态</div>
            </div>

            {portalCells.length > 0 && (
              <div>
                <label className="mb-1.5 block text-xs tracking-widest text-neutral-500">传送门默认状态</label>
                <button
                  onClick={() => {
                    dirty();
                    setPortalOpenDef((o) => !o);
                  }}
                  className="flex items-center gap-2 border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:border-neutral-500"
                >
                  <span className="inline-block h-3.5 w-3.5" style={{ background: '#f08c3c' }} />
                  传送门：{portalOpenDef ? '开' : '关'}
                </button>
                <div className="mt-1.5 text-xs text-neutral-600">
                  已放置 {portalCells.length}/2 个传送门；{orangeBtn ? '有橙色按钮：传送门可再次激活' : '无橙色按钮：传送门为一次性'}
                </div>
              </div>
            )}

            {/* 校验 + 试玩 + 生成 */}
            <div className="border-t border-neutral-800 pt-5">
              {errors.length > 0 ? (
                <ul className="mb-3 space-y-1">
                  {errors.map((e, i) => (
                    <li key={i} className="text-xs text-red-400">· {e}</li>
                  ))}
                </ul>
              ) : (
                <div className="mb-3 text-xs text-[#d8b44a]">✓ 关卡结构合法</div>
              )}
              <button
                onClick={play}
                disabled={errors.length > 0}
                className="w-full border border-neutral-700 px-4 py-3 text-base text-neutral-300 hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-30"
              >
                ▶ 试玩
              </button>
              <button
                onClick={generate}
                disabled={errors.length > 0 || !testPassed}
                className="mt-2 w-full border border-[#d8b44a]/60 bg-[#d8b44a]/10 px-4 py-3 text-base text-[#e8d48a] hover:bg-[#d8b44a]/20 disabled:cursor-not-allowed disabled:opacity-30"
              >
                生成分享码
              </button>
              {!testPassed && errors.length === 0 && (
                <div className="mt-2 text-xs text-neutral-600">需要先「试玩」并通关一次，才能生成分享码</div>
              )}
              {shareCode && (
                <div className="mt-4">
                  <textarea
                    readOnly
                    value={shareCode}
                    rows={3}
                    onFocus={(e) => e.target.select()}
                    className="w-full resize-none border border-neutral-800 bg-[#141a28] p-3 font-mono text-xs break-all text-neutral-400 outline-none"
                  />
                  <button
                    onClick={copyCode}
                    className="mt-2 w-full border border-neutral-700 px-4 py-2.5 text-sm text-neutral-300 hover:border-neutral-500"
                  >
                    {copied ? '✓ 已复制' : '复制分享码'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
