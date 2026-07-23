// ============================================================
// 溢彩画游戏页面 —— 鸣潮「溢彩画」复刻
// 数字键 1~4 切换颜色，点击异色格子消耗一步，把它所在的同色
// 连通区域从点击位置向外逐层蔓延染成选中颜色（仅限四边相邻）
// ============================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import type { Cell, CellKind, FillColor, FillLevel } from './types';
import {
  ALL_COLORS,
  FILL_COLORS,
  cloneCells,
  connectedRegion,
  dyeCells,
  isComplete,
  isFillColor,
  regionLayers,
} from './types';
import { BUILTIN_LEVELS } from './levels';
import { decodeFillLevel, encodeFillLevel } from './shareCode';

// ---------------- 游戏主组件 ----------------

export function ColorfillGame({
  level,
  test = false,
  onExit,
  onRestart,
}: {
  level: FillLevel;
  test?: boolean; // 编辑器试玩模式：通关后返回编辑器解锁分享码
  onExit: () => void;
  onRestart: () => void;
}) {
  const navigate = useNavigate();
  const { rows, cols, target } = level;

  const [grid, setGrid] = useState<CellKind[][]>(() => cloneCells(level.cells));
  const [selected, setSelected] = useState<FillColor>(
    () => ALL_COLORS.find((c) => c !== target) ?? 'blue',
  );
  const [stepsLeft, setStepsLeft] = useState(level.steps);
  const [status, setStatus] = useState<'playing' | 'won' | 'lost'>('playing');
  const [animating, setAnimating] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    for (const t of timers.current) clearTimeout(t);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const reset = () => {
    clearTimers();
    setGrid(cloneCells(level.cells));
    setStepsLeft(level.steps);
    setStatus('playing');
    setAnimating(false);
  };

  // 数字键 1~4 切换颜色，R 重置
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const n = Number(e.key);
      if (n >= 1 && n <= ALL_COLORS.length) setSelected(ALL_COLORS[n - 1]);
      else if (e.key === 'r' || e.key === 'R') reset();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, status, animating]);

  // 点击格子：异色才消耗步数，从点击位置逐层向外蔓延染色
  const paint = (x: number, y: number) => {
    if (status !== 'playing' || animating) return;
    const color = grid[y]?.[x];
    if (!isFillColor(color) || color === selected) return;
    const region = connectedRegion(grid, x, y);
    const layers = regionLayers(region, [x, y] as Cell);
    const finalGrid = dyeCells(grid, region, selected);
    const left = stepsLeft - 1;
    setAnimating(true);
    layers.forEach((layer, i) => {
      timers.current.push(
        setTimeout(() => {
          setGrid((g) => dyeCells(g, layer, selected));
          if (i === layers.length - 1) {
            setGrid(finalGrid);
            setStepsLeft(left);
            if (isComplete(finalGrid, target)) setStatus('won');
            else if (left <= 0) setStatus('lost');
            setAnimating(false);
          }
        }, 70 * (i + 1)),
      );
    });
  };

  const cs = Math.max(30, Math.min(64, Math.floor(Math.min(760 / cols, 500 / rows))));
  const gap = Math.max(3, Math.round(cs * 0.1));
  const targetColor = FILL_COLORS[target];

  return (
    <div className="flex min-h-[calc(100vh-61px)] flex-col items-center bg-[#0b0d10] px-4 py-8 text-neutral-300 select-none">
      {/* 顶部信息栏 */}
      <div className="mb-6 flex w-full max-w-6xl items-center justify-between gap-3">
        <div>
          <div className="text-xs tracking-[0.3em] text-neutral-500">// 溢彩画{test && ' · 试玩'}</div>
          <h2 className="mt-1 text-2xl font-medium text-neutral-100">{level.name}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={reset} className="border border-neutral-700 px-4 py-2 text-sm text-neutral-400 hover:border-neutral-500 hover:text-neutral-200">
            ↺ 重置 (R)
          </button>
          {test ? (
            <button
              onClick={() => navigate('/colorfill/editor', { state: { level, passed: false } })}
              className="border border-neutral-700 px-4 py-2 text-sm text-neutral-400 hover:border-neutral-500 hover:text-neutral-200"
            >
              ← 返回编辑器
            </button>
          ) : (
            <button onClick={onRestart} className="border border-neutral-700 px-4 py-2 text-sm text-neutral-400 hover:border-neutral-500 hover:text-neutral-200">
              换一关
            </button>
          )}
          <button onClick={onExit} className="border border-neutral-700 px-4 py-2 text-sm text-neutral-400 hover:border-neutral-500 hover:text-neutral-200">
            ✕ 退出
          </button>
        </div>
      </div>

      <div className="flex items-start gap-6">
        {/* 棋盘 */}
        <div>
          <div className="mb-3 text-lg text-neutral-200">
            剩余步数: <span className="font-bold text-[#e8c268]">{stepsLeft}</span>
          </div>
          <div
            className="grid rounded-lg border border-neutral-800 bg-[#101318] p-3"
            style={{
              gridTemplateColumns: `repeat(${cols}, ${cs}px)`,
              gap,
              boxShadow: '0 0 40px rgba(0,0,0,0.6), inset 0 0 30px rgba(0,0,0,0.5)',
            }}
          >
            {grid.map((row, y) =>
              row.map((k, x) => {
                const fillable = isFillColor(k);
                return (
                  <div
                    key={`${x},${y}`}
                    onClick={() => paint(x, y)}
                    className={fillable ? 'cursor-pointer' : ''}
                    style={{
                      width: cs,
                      height: cs,
                      borderRadius: Math.round(cs * 0.2),
                      background: fillable
                        ? FILL_COLORS[k].main
                        : 'repeating-linear-gradient(45deg, #1d2126 0 5px, #14171b 5px 10px)',
                      boxShadow: fillable
                        ? `inset 0 0 ${cs / 3}px rgba(255,255,255,0.14), inset 0 -3px 0 rgba(0,0,0,0.25)`
                        : 'inset 0 0 0 1px #262b31',
                      transition: 'background-color 0.16s',
                    }}
                  />
                );
              }),
            )}
          </div>
          <div className="mt-3 text-base text-neutral-400">
            ▼▼ 将色块全部染成【
            <span className="font-medium" style={{ color: targetColor.main }}>
              {targetColor.name}
            </span>
            】
          </div>
        </div>

        {/* 颜色选择 */}
        <div className="flex flex-col gap-4 pt-12">
          {ALL_COLORS.map((c, i) => {
            const col = FILL_COLORS[c];
            const active = selected === c;
            return (
              <button
                key={c}
                onClick={() => setSelected(c)}
                title={`${col.name} (${i + 1})`}
                className="relative flex items-center justify-center rounded-full transition-transform"
                style={{
                  width: 56,
                  height: 56,
                  background: col.main,
                  boxShadow: active
                    ? `0 0 0 3px #0b0d10, 0 0 0 5px ${col.main}, 0 0 18px ${col.main}`
                    : 'inset 0 -4px 0 rgba(0,0,0,0.25)',
                  transform: active ? 'scale(1.08)' : undefined,
                }}
              >
                <span
                  className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-sm text-[11px] font-bold"
                  style={{ background: '#0b0d10', color: col.main, border: `1px solid ${col.dim}` }}
                >
                  {i + 1}
                </span>
                {active && (
                  <span className="absolute -right-6 text-sm" style={{ color: col.main }}>◀</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 失败遮罩 */}
      {status === 'lost' && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70">
          <div className="border border-red-900/60 bg-[#141011] px-12 py-10 text-center" style={{ boxShadow: '0 0 60px rgba(210,74,69,0.2)' }}>
            <div className="mb-2 text-xs tracking-[0.4em] text-red-400/70">// OUT OF STEPS</div>
            <div className="mb-8 text-3xl font-medium text-red-300">步数用完</div>
            <div className="flex justify-center gap-3">
              <button onClick={reset} className="border border-neutral-600 px-5 py-2.5 text-sm text-neutral-300 hover:border-neutral-400">
                ↺ 重试
              </button>
              {test ? (
                <button
                  onClick={() => navigate('/colorfill/editor', { state: { level, passed: false } })}
                  className="border border-neutral-600 px-5 py-2.5 text-sm text-neutral-300 hover:border-neutral-400"
                >
                  ← 返回编辑器
                </button>
              ) : (
                <button onClick={onRestart} className="border border-neutral-600 px-5 py-2.5 text-sm text-neutral-300 hover:border-neutral-400">
                  换一关
                </button>
              )}
              <button onClick={onExit} className="border border-neutral-600 px-5 py-2.5 text-sm text-neutral-300 hover:border-neutral-400">
                返回菜单
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 胜利遮罩 */}
      {status === 'won' && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70">
          <div className="border border-[#e8c268]/50 bg-[#12100a] px-12 py-10 text-center" style={{ boxShadow: '0 0 60px rgba(232,194,104,0.25)' }}>
            <div className="mb-2 text-xs tracking-[0.4em] text-[#e8c268]/70">// PAINTING COMPLETE</div>
            <div className="mb-8 text-3xl font-medium text-[#f0d896]">溢彩完成</div>
            <div className="flex justify-center gap-3">
              {test ? (
                <button
                  onClick={() => navigate('/colorfill/editor', { state: { level, passed: true } })}
                  className="border border-[#e8c268]/60 bg-[#e8c268]/10 px-5 py-2.5 text-sm text-[#e8c268] hover:bg-[#e8c268]/20"
                >
                  ✓ 试玩通过，返回编辑器
                </button>
              ) : (
                <>
                  <button onClick={reset} className="border border-neutral-600 px-5 py-2.5 text-sm text-neutral-300 hover:border-neutral-400">
                    再玩一次
                  </button>
                  <button onClick={onRestart} className="border border-neutral-600 px-5 py-2.5 text-sm text-neutral-300 hover:border-neutral-400">
                    换一关
                  </button>
                </>
              )}
              <button onClick={onExit} className="border border-neutral-600 px-5 py-2.5 text-sm text-neutral-300 hover:border-neutral-400">
                返回菜单
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- 溢彩画模块入口（菜单 + 游戏） ----------------

export default function ColorfillPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  // 初始关卡：编辑器试玩（state）或分享码链接（?code=）
  const initial = useMemo(() => {
    const st = location.state as { level?: FillLevel; test?: boolean } | null;
    if (st?.level) return { level: st.level, test: !!st.test, error: '' };
    const code = searchParams.get('code');
    if (!code) return { level: null as FillLevel | null, test: false, error: '' };
    try {
      return { level: decodeFillLevel(code), test: false, error: '' };
    } catch (e) {
      return { level: null as FillLevel | null, test: false, error: (e as Error).message };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [level, setLevel] = useState<FillLevel | null>(initial.level);
  const [test] = useState(initial.test);
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState(initial.error);

  const startWithCode = () => {
    try {
      setLevel(decodeFillLevel(codeInput));
      setCodeError('');
    } catch (e) {
      setCodeError((e as Error).message);
    }
  };

  if (level) {
    return (
      <ColorfillGame
        key={`${encodeFillLevel(level)}-${test}`}
        level={level}
        test={test}
        onExit={() => setLevel(null)}
        onRestart={() => setLevel(null)}
      />
    );
  }

  return (
    <div className="min-h-[calc(100vh-61px)] bg-[#0b0d10] px-4 py-12 text-neutral-300">
      <div className="mx-auto max-w-4xl">
        <div className="mb-10">
          <div className="text-xs tracking-[0.3em] text-neutral-500">// 鸣潮</div>
          <h1 className="mt-2 text-3xl font-medium text-neutral-100">溢彩画</h1>
          <p className="mt-3 text-base text-neutral-500">
            用数字键 1~4 切换颜色，点击异色格子让它所在的同色区域蔓延染色，在限定步数内把所有色块染成目标颜色
          </p>
        </div>

        <section className="mb-10">
          <h3 className="mb-4 text-sm tracking-[0.25em] text-neutral-500">游玩分享关卡</h3>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="粘贴分享码（WCF1_ 开头）"
              className="flex-1 border border-neutral-800 bg-[#14181d] px-4 py-3 text-base text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-[#e8c268]/50"
            />
            <button
              onClick={startWithCode}
              className="border border-[#e8c268]/60 bg-[#e8c268]/10 px-7 py-3 text-base text-[#e8c268] hover:bg-[#e8c268]/20"
            >
              开始
            </button>
            <button
              onClick={() => navigate('/colorfill/editor')}
              className="border border-neutral-700 px-7 py-3 text-base text-neutral-300 hover:border-neutral-500"
            >
              ✚ 创建关卡
            </button>
          </div>
          {codeError && <div className="mt-2 text-sm text-red-400">{codeError}</div>}
        </section>

        <section className="mb-10">
          <h3 className="mb-4 text-sm tracking-[0.25em] text-neutral-500">内置关卡</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {BUILTIN_LEVELS.map((lv, i) => (
              <button
                key={i}
                onClick={() => setLevel(lv)}
                className="border border-neutral-800 bg-[#14181d] px-5 py-5 text-left hover:border-[#e8c268]/50"
              >
                <div className="text-base text-neutral-200">{lv.name}</div>
                <div className="mt-2 text-xs text-neutral-600">
                  {lv.cols}×{lv.rows} · {lv.steps} 步 · 目标{FILL_COLORS[lv.target].name}
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
