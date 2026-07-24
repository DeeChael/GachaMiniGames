// ============================================================
// 溢彩画 —— 关卡编辑器
// 所有可填色区域必须填色，且四种颜色至少三种各存在一格；
// 创建完关卡后必须先「试玩」并通关，才能生成分享码
// ============================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { CellKind, FillColor, FillLevel } from './types';
import {
  ALL_COLORS,
  FILL_COLORS,
  MAX_COLS,
  MAX_ROWS,
  MAX_STEPS,
  MIN_GRID,
  MIN_STEPS,
  cellKey,
  isFillColor,
  validateFillLevel,
} from './types';
import { encodeFillLevel } from './shareCode';

type Tool = FillColor | 'blocked' | 'erase';

const TOOLS: [Tool, string][] = [
  ['blue', '蓝色'],
  ['red', '红色'],
  ['yellow', '黄色'],
  ['green', '绿色'],
  ['blocked', '⊘ 不可填色'],
  ['erase', '⌫ 擦除'],
];

const emptyCells = (rows: number, cols: number): CellKind[][] =>
  Array.from({ length: rows }, () => Array.from({ length: cols }, () => null));

export default function ColorfillEditorPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // 试玩通关返回时：还原关卡并解锁分享码
  const init = useMemo(() => {
    const st = location.state as { level?: FillLevel; passed?: boolean } | null;
    if (!st?.level) return null;
    return { level: st.level, passed: !!st.passed };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [name, setName] = useState(init?.level.name ?? '我的关卡');
  const [cols, setCols] = useState(init?.level.cols ?? 8);
  const [rows, setRows] = useState(init?.level.rows ?? 6);
  const [target, setTarget] = useState<FillColor>(init?.level.target ?? 'blue');
  const [steps, setSteps] = useState(init?.level.steps ?? 5);
  const [cells, setCells] = useState<CellKind[][]>(() =>
    init?.level.cells ? init.level.cells.map((r) => [...r]) : emptyCells(6, 8),
  );

  const [tool, setTool] = useState<Tool>('blue');
  const [testPassed, setTestPassed] = useState(init?.passed ?? false);
  const [shareCode, setShareCode] = useState('');
  const [copied, setCopied] = useState(false);
  const painting = useRef(false);

  // 数字键 1~6 快速选择工具
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const n = Number(e.key);
      if (n >= 1 && n <= TOOLS.length) setTool(TOOLS[n - 1][0]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // 按住左键拖动连续填色
  useEffect(() => {
    const onUp = () => (painting.current = false);
    window.addEventListener('pointerup', onUp);
    return () => window.removeEventListener('pointerup', onUp);
  }, []);

  // 任何影响玩法的修改都需要重新试玩
  const dirty = () => setTestPassed(false);

  const level: FillLevel = useMemo(
    () => ({
      name: name.trim() || '自定义关卡',
      rows,
      cols,
      target,
      steps,
      cells,
    }),
    [name, rows, cols, target, steps, cells],
  );

  const errors = validateFillLevel(level);

  const paintAt = (x: number, y: number, t: Tool = tool) => {
    const next: CellKind = t === 'erase' ? null : t;
    if (cells[y][x] === next) return;
    dirty();
    setCells((cs) => {
      const out = cs.map((r) => [...r]);
      out[y][x] = next;
      return out;
    });
  };

  const resize = (newCols: number, newRows: number) => {
    dirty();
    setCols(newCols);
    setRows(newRows);
    setCells((cs) =>
      Array.from({ length: newRows }, (_, y) =>
        Array.from({ length: newCols }, (_, x) => cs[y]?.[x] ?? null),
      ),
    );
  };

  const play = () => navigate('/colorfill', { state: { level, test: true } });

  const generate = () => {
    setShareCode(encodeFillLevel(level));
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

  const cs = Math.max(30, Math.min(56, Math.floor(Math.min(680 / cols, 440 / rows))));
  const gap = Math.max(2, Math.round(cs * 0.08));
  const clampSize = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  return (
    <div className="min-h-[calc(100vh-65px)] bg-[#0b0d10] px-4 py-10 text-neutral-300 select-none">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-start justify-between gap-3">
          <div>
            <div className="text-xs tracking-[0.3em] text-neutral-500">// 溢彩画 · 关卡编辑器</div>
            <h1 className="mt-2 text-2xl font-medium text-neutral-100">制作我的关卡</h1>
          </div>
          <button onClick={() => navigate('/colorfill')} className="border border-neutral-700 px-4 py-2 text-sm text-neutral-400 hover:border-neutral-500">
            ✕ 返回
          </button>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
          {/* 左：网格 */}
          <div>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {TOOLS.map(([t, label], i) => {
                const isColor = isFillColor(t);
                return (
                  <button
                    key={t}
                    onClick={() => setTool(t)}
                    className={`flex items-center gap-1.5 border px-3 py-1.5 text-xs ${
                      tool === t
                        ? 'border-[#e8c268]/70 bg-[#e8c268]/10 text-[#f0d896]'
                        : 'border-neutral-700 text-neutral-400 hover:border-neutral-500'
                    }`}
                  >
                    <span className="text-neutral-500">{i + 1}</span>
                    {isColor && (
                      <span className="inline-block h-3 w-3 rounded-sm" style={{ background: FILL_COLORS[t].main }} />
                    )}
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="mb-4 text-xs text-neutral-600">
              点击或按住左键拖动连续填色，右键擦除
            </div>

            <div className="inline-block rounded-lg border border-neutral-800 bg-[#101318] p-3">
              <div
                className="grid"
                style={{ gridTemplateColumns: `repeat(${cols}, ${cs}px)`, gap }}
                onPointerLeave={() => (painting.current = false)}
              >
                {Array.from({ length: rows }, (_, y) =>
                  Array.from({ length: cols }, (_, x) => {
                    const k = cells[y][x];
                    const fillable = isFillColor(k);
                    return (
                      <div
                        key={cellKey(x, y)}
                        onPointerDown={(e) => {
                          if (e.button === 2) return;
                          painting.current = true;
                          paintAt(x, y);
                        }}
                        onPointerEnter={() => {
                          if (painting.current) paintAt(x, y);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          paintAt(x, y, 'erase');
                        }}
                        className="cursor-pointer"
                        style={{
                          width: cs,
                          height: cs,
                          borderRadius: Math.round(cs * 0.2),
                          background: fillable
                            ? FILL_COLORS[k].main
                            : k === 'blocked'
                              ? 'repeating-linear-gradient(45deg, #1d2126 0 5px, #14171b 5px 10px)'
                              : '#14181d',
                          boxShadow: fillable
                            ? `inset 0 0 ${cs / 3}px rgba(255,255,255,0.14), inset 0 -3px 0 rgba(0,0,0,0.25)`
                            : k === 'blocked'
                              ? 'inset 0 0 0 1px #262b31'
                              : 'inset 0 0 0 1px dashed #2c333b',
                        }}
                      />
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
                className="w-full border border-neutral-800 bg-[#14181d] px-4 py-2.5 text-base outline-none focus:border-[#e8c268]/50"
              />
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="mb-1.5 block text-xs tracking-widest text-neutral-500">长 (列) {cols}</label>
                <input
                  type="range" min={MIN_GRID} max={MAX_COLS} value={cols}
                  onChange={(e) => resize(clampSize(Number(e.target.value), MIN_GRID, MAX_COLS), rows)}
                  className="w-full accent-[#e8c268]"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1.5 block text-xs tracking-widest text-neutral-500">高 (行) {rows}</label>
                <input
                  type="range" min={MIN_GRID} max={MAX_ROWS} value={rows}
                  onChange={(e) => resize(cols, clampSize(Number(e.target.value), MIN_GRID, MAX_ROWS))}
                  className="w-full accent-[#e8c268]"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs tracking-widest text-neutral-500">目标颜色</label>
              <div className="flex gap-2">
                {ALL_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      dirty();
                      setTarget(c);
                    }}
                    className={`flex items-center gap-2 border px-3 py-2 text-sm ${
                      target === c
                        ? 'border-[#e8c268]/70 bg-[#e8c268]/10 text-[#f0d896]'
                        : 'border-neutral-700 text-neutral-300 hover:border-neutral-500'
                    }`}
                  >
                    <span className="inline-block h-3.5 w-3.5 rounded-sm" style={{ background: FILL_COLORS[c].main }} />
                    {FILL_COLORS[c].name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs tracking-widest text-neutral-500">
                步数（{MIN_STEPS}~{MAX_STEPS}）
              </label>
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
                    setSteps((s) => Math.min(MAX_STEPS, s + 1));
                  }}
                  disabled={steps >= MAX_STEPS}
                  className="flex h-9 w-9 items-center justify-center border border-neutral-700 text-lg text-neutral-300 hover:border-neutral-500 disabled:opacity-30"
                >
                  ＋
                </button>
              </div>
            </div>

            {/* 校验 + 试玩 + 生成 */}
            <div className="border-t border-neutral-800 pt-5">
              {errors.length > 0 ? (
                <ul className="mb-3 space-y-1">
                  {errors.map((e, i) => (
                    <li key={i} className="text-xs text-red-400">· {e}</li>
                  ))}
                </ul>
              ) : (
                <div className="mb-3 text-xs text-[#e8c268]">✓ 关卡结构合法</div>
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
                className="mt-2 w-full border border-[#e8c268]/60 bg-[#e8c268]/10 px-4 py-3 text-base text-[#f0d896] hover:bg-[#e8c268]/20 disabled:cursor-not-allowed disabled:opacity-30"
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
                    className="w-full resize-none border border-neutral-800 bg-[#14181d] p-3 font-mono text-xs break-all text-neutral-400 outline-none"
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
