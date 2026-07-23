// ============================================================
// 浮空回收（明日方舟：终末地 · 气球）—— 菜单 + 游戏
// 把所有气球放上网格并保持升力平衡；哪边升力大，网格就向哪边翘起
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import type { BalloonLevel, BalloonValue, Placed } from './types';
import {
  BALLOON_INFO,
  BALLOON_VALUES,
  CELL_SHADES,
  GRID,
  cellKey,
  cellShade,
  netLift,
} from './types';
import { BUILTIN_LEVELS } from './levels';
import { decodeBalloonLevel } from './shareCode';
import { useBalloonDrag } from './useBalloonDrag';

// ---------------- 气球图标 ----------------

export function BalloonIcon({ value, size = 40 }: { value: BalloonValue; size?: number }) {
  const info = BALLOON_INFO[value];
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-bold"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 35% 30%, ${info.color}, ${info.rim})`,
        border: `2px solid ${info.rim}`,
        boxShadow: `inset 0 0 ${size / 4}px rgba(0,0,0,0.25), 0 2px 6px rgba(0,0,0,0.5)`,
        color: info.text,
        fontSize: size * 0.42,
        lineHeight: 1,
      }}
    >
      {value}
      <span style={{ fontSize: size * 0.22, marginTop: size * 0.16 }}>⬆</span>
    </div>
  );
}

// ---------------- 升力平衡指示条 ----------------
// 竖直条（网格左侧）表示上下升力，水平条（网格下侧）表示左右升力
// 配平时整条绿色；不配平时从中心向升力更大的一侧黄色填充，末端显示方向 + 数值

const BAR_GREEN = '#1fe0b0';
const BAR_YELLOW = '#f0a832';

export function LiftBar({
  net,
  vertical,
  length,
}: {
  net: number;
  vertical: boolean;
  length: number;
}) {
  const balanced = net === 0;
  const p = Math.min(1, Math.abs(net) / 8);
  const half = length / 2;
  const fillLen = p * (half - 6);
  // net<0 = 上/左侧升力大，填充朝条的起点方向
  const towardStart = net < 0;
  const arrow = vertical ? (net < 0 ? '↑' : '↓') : net < 0 ? '←' : '→';
  const bar = 8;
  // 配平时：整条绿色，从中间向两侧逐渐透明
  const balancedBg = `linear-gradient(${vertical ? 'to bottom' : 'to right'}, transparent, ${BAR_GREEN}, transparent)`;
  return (
    <div
      className="relative"
      style={{
        width: vertical ? bar : length,
        height: vertical ? length : bar,
        background: balanced ? balancedBg : '#1a1e15',
        border: `1px solid ${balanced ? `${BAR_GREEN}44` : '#2c3324'}`,
        boxShadow: balanced ? `0 0 10px ${BAR_GREEN}66` : undefined,
      }}
    >
      {/* 中心刻度 */}
      {!balanced && (
        <div
          className="absolute"
          style={
            vertical
              ? { left: -2, right: -2, top: half - 1, height: 2, background: '#4a5440' }
              : { top: -2, bottom: -2, left: half - 1, width: 2, background: '#4a5440' }
          }
        />
      )}
      {!balanced && (
        <>
          <div
            className="absolute"
            style={{
              ...(vertical
                ? {
                    left: 0,
                    width: bar,
                    top: towardStart ? half - fillLen : half,
                    height: fillLen,
                  }
                : {
                    top: 0,
                    height: bar,
                    left: towardStart ? half - fillLen : half,
                    width: fillLen,
                  }),
              background: `linear-gradient(${vertical ? (towardStart ? 'to top' : 'to bottom') : towardStart ? 'to left' : 'to right'}, ${BAR_YELLOW}, ${BAR_YELLOW}66)`,
              boxShadow: `0 0 8px ${BAR_YELLOW}88`,
            }}
          />
          <div
            className="absolute font-bold whitespace-nowrap"
            style={{
              color: BAR_YELLOW,
              fontSize: 13,
              ...(vertical
                ? {
                    left: bar + 6,
                    top: towardStart ? half - fillLen - 16 : half + fillLen + 4,
                  }
                : {
                    top: bar + 6,
                    left: towardStart ? half - fillLen - 30 : half + fillLen + 6,
                  }),
            }}
          >
            {arrow}{Math.abs(net)}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------- 网格内的不平衡提示 ----------------
// 只画两条交界线（中心格 ↔ 3x3、3x3 ↔ 5x5）：
// 偏向一个角时该角点不透明度最大，向相邻两角渐变为 0；
// 偏向一边时靠近该边的两个角点最大，向相反角渐变为 0

export function ImbalanceGlow({
  net,
  cell,
  gap,
}: {
  net: { x: number; y: number };
  cell: number;
  gap: number;
}) {
  if (net.x === 0 && net.y === 0) return null;
  const step = cell + gap;
  const board = GRID * cell + (GRID - 1) * gap;
  const dx = Math.sign(net.x);
  const dy = Math.sign(net.y);
  // 角点不透明度权重：sx/sy ∈ {-1, 1}
  const corner = (sx: number, sy: number) => {
    if (dx !== 0 && dy !== 0) return sx === dx && sy === dy ? 1 : 0;
    if (dx !== 0) return sx === dx ? 1 : 0;
    return sy === dy ? 1 : 0;
  };
  const intensity = Math.min(0.9, 0.12 * (Math.abs(net.x) + Math.abs(net.y)));
  // 两条交界线（正方形），画在缝隙中心，与格子边缘留距：
  // 中心格 ↔ 3x3 的缝隙、3x3 ↔ 5x5 的缝隙
  const squares = [
    { o: 2 * step - gap / 2, s: cell + gap },
    { o: step - gap / 2, s: 3 * cell + 3 * gap },
  ];
  const defs: React.ReactNode[] = [];
  const lines: React.ReactNode[] = [];
  squares.forEach(({ o, s }, si) => {
    // 四角：(-1,-1) 左上 → (1,-1) 右上 → (1,1) 右下 → (-1,1) 左下
    const corners = [
      { sx: -1, sy: -1, px: o, py: o },
      { sx: 1, sy: -1, px: o + s, py: o },
      { sx: 1, sy: 1, px: o + s, py: o + s },
      { sx: -1, sy: 1, px: o, py: o + s },
    ];
    for (let e = 0; e < 4; e++) {
      const a = corners[e];
      const b = corners[(e + 1) % 4];
      const a1 = corner(a.sx, a.sy) * intensity;
      const a2 = corner(b.sx, b.sy) * intensity;
      if (a1 === 0 && a2 === 0) continue;
      const gid = `glow${si}${e}`;
      defs.push(
        <linearGradient key={gid} id={gid} gradientUnits="userSpaceOnUse" x1={a.px} y1={a.py} x2={b.px} y2={b.py}>
          <stop offset="0" stopColor="#f0c020" stopOpacity={a1} />
          <stop offset="1" stopColor="#f0c020" stopOpacity={a2} />
        </linearGradient>,
      );
      lines.push(
        <line key={gid} x1={a.px} y1={a.py} x2={b.px} y2={b.py} stroke={`url(#${gid})`} strokeWidth={4} strokeLinecap="round" />,
      );
    }
  });
  return (
    <svg
      className="pointer-events-none absolute inset-0"
      width={board}
      height={board}
      style={{ zIndex: 5, filter: 'drop-shadow(0 0 6px rgba(240,192,32,0.55))' }}
    >
      <defs>{defs}</defs>
      {lines}
    </svg>
  );
}

// ---------------- 游戏主组件 ----------------

const CELL = 64;
const GAP = 8;
const STEP = CELL + GAP;
const BOARD = GRID * CELL + (GRID - 1) * GAP;

export function BalloonGame({
  level,
  onExit,
  onRestart,
}: {
  level: BalloonLevel;
  onExit: () => void;
  onRestart: () => void;
}) {
  const [placed, setPlaced] = useState<Record<string, BalloonValue>>({});
  const [won, setWon] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);

  const placeableSet = useMemo(() => new Set(level.placeable.map(([x, y]) => cellKey(x, y))), [level]);
  const total = useMemo(() => level.balloons.reduce((s, b) => s + b, 0), [level]);

  const remaining = useMemo(() => {
    const rem: Record<BalloonValue, number> = { 1: 0, 2: 0, 3: 0, 6: 0 };
    for (const b of level.balloons) rem[b]++;
    for (const v of Object.values(placed)) rem[v]--;
    return rem;
  }, [level, placed]);

  // ---------------- 拖拽放置 ----------------

  const canDrop = useCallback(
    (x: number, y: number, from: string | null) => {
      const k = cellKey(x, y);
      if (!placeableSet.has(k)) return false;
      if (!placed[k]) return true;
      // 目标格已有气球：仅允许拖动的已放置气球与其交换位置
      return from !== null;
    },
    [placeableSet, placed],
  );
  const onDrop = useCallback((value: BalloonValue, from: string | null, x: number, y: number) => {
    const k = cellKey(x, y);
    if (from === k) return; // 拖回原位
    setPlaced((p) => {
      const np = { ...p };
      const target = np[k];
      if (from) delete np[from];
      np[k] = value;
      if (from && target) np[from] = target; // 与目标格的气球交换位置
      return np;
    });
  }, []);
  const onRemove = useCallback((from: string) => {
    setPlaced((p) => {
      const np = { ...p };
      delete np[from];
      return np;
    });
  }, []);
  const { drag, startDrag } = useBalloonDrag({ boardRef, step: STEP, cell: CELL, canDrop, onDrop, onRemove });

  const placedList: Placed[] = useMemo(
    () =>
      Object.entries(placed).map(([k, value]) => {
        const [x, y] = k.split(',').map(Number);
        return { x, y, value };
      }),
    [placed],
  );
  const net = useMemo(() => netLift(placedList), [placedList]);
  const placedSum = placedList.reduce((s, p) => s + p.value, 0);
  const balanced = net.x === 0 && net.y === 0;

  // 胜利：气球全部放完（X=Y）且升力平衡
  useEffect(() => {
    if (placedList.length === level.balloons.length && level.balloons.length > 0 && balanced) {
      const t = setTimeout(() => setWon(true), 300);
      return () => clearTimeout(t);
    }
  }, [placedList, balanced, level]);

  const reset = () => {
    setPlaced({});
    setWon(false);
  };

  // 3D 倾斜：哪边升力大哪边翘起（更靠近屏幕）
  const tiltX = Math.max(-20, Math.min(20, net.y * 3.2));
  const tiltY = Math.max(-20, Math.min(20, -net.x * 3.2));

  const BAR_DIST = 44; // 指示条与网格的间距

  return (
    <div className="flex min-h-[calc(100vh-65px)] flex-col items-center bg-[#0b0e09] px-4 py-8 text-neutral-300 select-none">
      {/* 顶部信息栏 */}
      <div className="mb-6 flex w-full max-w-6xl items-center justify-between gap-3">
        <div>
          <div className="text-xs tracking-[0.3em] text-neutral-500">// 浮空回收</div>
          <h2 className="mt-1 text-2xl font-medium text-neutral-100">{level.name}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={reset} className="border border-neutral-700 px-4 py-2 text-sm text-neutral-400 hover:border-neutral-500 hover:text-neutral-200">
            ↺ 重置
          </button>
          <button onClick={onRestart} className="border border-neutral-700 px-4 py-2 text-sm text-neutral-400 hover:border-neutral-500 hover:text-neutral-200">
            换一关
          </button>
          <button onClick={onExit} className="border border-neutral-700 px-4 py-2 text-sm text-neutral-400 hover:border-neutral-500 hover:text-neutral-200">
            ✕ 退出
          </button>
        </div>
      </div>

      <div className="flex w-full max-w-6xl flex-col items-center gap-10 lg:flex-row lg:items-start lg:justify-center">
        {/* 网格区 */}
        <div className="relative" style={{ paddingTop: 64, paddingLeft: BAR_DIST + 24, paddingBottom: BAR_DIST + 96 }}>
          {/* 顶部 X/Y：已放置气球数值之和 / 总数值 */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2">
            <div
              className="flex items-center gap-2 border px-4 py-1.5 text-base font-bold tracking-widest"
              style={
                placedSum === total
                  ? { borderColor: '#a6e22e88', background: '#a6e22e18', color: '#d6f28a' }
                  : { borderColor: '#e04b3a88', background: '#e04b3a18', color: '#f08a7d' }
              }
            >
              🎈 {placedSum}/{total}
            </div>
          </div>

          {/* 左侧升力条（上下） */}
          <div className="absolute" style={{ left: 0, top: 64 }}>
            <LiftBar net={net.y} vertical length={BOARD} />
          </div>
          {/* 下侧升力条（左右） */}
          <div className="absolute" style={{ top: 64 + BOARD + BAR_DIST, left: BAR_DIST + 24 }}>
            <LiftBar net={net.x} vertical={false} length={BOARD} />
          </div>
          {/* 升力倍率提示（平衡提示条下方） */}
          <div className="absolute space-y-1 text-xs text-neutral-500" style={{ top: 64 + BOARD + BAR_DIST + 44, left: BAR_DIST + 24 }}>
            {[2, 1, 0].map((ring) => (
              <div key={ring} className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 border border-white/15" style={{ background: CELL_SHADES[ring] }} />
                方格上的气球升力倍率 ×{ring}
              </div>
            ))}
          </div>

          {/* 3D 倾斜容器（boardRef 挂在未变形的包裹层上，保证拖拽命中不受倾斜影响） */}
          <div ref={boardRef} style={{ perspective: 900, width: BOARD, height: BOARD }}>
            <div
              className="relative"
              style={{
                width: BOARD,
                height: BOARD,
                transform: `rotateX(${tiltX}deg) rotateY(${tiltY}deg)`,
                transformStyle: 'preserve-3d',
                transition: 'transform 0.45s ease-out',
                boxShadow: '0 0 50px rgba(0,0,0,0.6)',
              }}
            >
              {/* 格子 */}
              {Array.from({ length: GRID }, (_, y) =>
                Array.from({ length: GRID }, (_, x) => {
                  const k = cellKey(x, y);
                  const canPlace = placeableSet.has(k);
                  const b = placed[k];
                  return (
                    <div
                      key={k}
                      onPointerDown={(e) => {
                        if (b && !won) {
                          e.preventDefault();
                          startDrag(b, k, e.clientX, e.clientY);
                        }
                      }}
                      className="absolute flex items-center justify-center"
                      style={{
                        left: x * STEP,
                        top: y * STEP,
                        width: CELL,
                        height: CELL,
                        background: cellShade(x, y),
                        border: canPlace ? '2px solid rgba(255,255,255,0.8)' : '1px solid rgba(255,255,255,0.06)',
                        boxShadow: 'inset 0 0 12px rgba(0,0,0,0.45)',
                        cursor: b && !won ? 'grab' : 'default',
                        touchAction: 'none',
                      }}
                    >
                      {canPlace && !b && (
                        <span className="rounded-full" style={{ width: 8, height: 8, background: '#e8d44d', boxShadow: '0 0 6px #e8d44d' }} />
                      )}
                      {b && drag?.from !== k && <BalloonIcon value={b} size={CELL * 0.78} />}
                    </div>
                  );
                }),
              )}
              {/* 拖拽悬停高亮 */}
              {drag && drag.hover && (
                <div
                  className="pointer-events-none absolute"
                  style={{
                    left: drag.hover.x * STEP,
                    top: drag.hover.y * STEP,
                    width: CELL,
                    height: CELL,
                    border: `3px solid ${drag.valid ? '#a6e22e' : '#e04b3a'}`,
                    background: drag.valid ? 'rgba(166,226,46,0.15)' : 'rgba(224,75,58,0.15)',
                    zIndex: 6,
                  }}
                />
              )}
              {/* 网格内的不平衡提示（两条交界线渐变） */}
              <ImbalanceGlow net={net} cell={CELL} gap={GAP} />
            </div>
          </div>
        </div>

        {/* 气球库存 */}
        <div className="w-full max-w-md lg:w-80">
          <div className="border border-neutral-800 bg-[#14170f]/80">
            <div className="border-b border-neutral-800 px-4 py-3 text-xs tracking-[0.25em] text-neutral-500">
              回收需使用全部气球
            </div>
            <div className="space-y-2 p-4">
              {[...BALLOON_VALUES].reverse().map((v) => {
                const totalV = level.balloons.filter((b) => b === v).length;
                if (totalV === 0) return null;
                const rem = remaining[v];
                return (
                  <div
                    key={v}
                    onPointerDown={(e) => {
                      if (rem > 0 && !won) {
                        e.preventDefault();
                        startDrag(v, null, e.clientX, e.clientY);
                      }
                    }}
                    className={`flex w-full items-center gap-4 border px-4 py-3 text-left transition-colors ${
                      rem > 0 ? 'cursor-grab border-neutral-800 hover:border-neutral-600' : 'border-neutral-800 opacity-35'
                    }`}
                    style={{ touchAction: 'none' }}
                  >
                    <BalloonIcon value={v} size={42} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-neutral-200">{BALLOON_INFO[v].name}</div>
                      <div className="mt-0.5 text-xs text-neutral-500">[升力...{v}⬆]</div>
                    </div>
                    <div className="text-lg font-bold text-neutral-300">×{rem}</div>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-neutral-800 px-4 py-3 text-xs leading-5 text-neutral-600">
              拖动气球到网格放置 · 拖动已放置的气球可移动 · 拖出网格取下
            </div>
          </div>
        </div>
      </div>

      {/* 拖拽跟随幽灵 */}
      {drag && (
        <div
          className="pointer-events-none fixed z-50"
          style={{ left: drag.pointer.x - (CELL * 0.78) / 2, top: drag.pointer.y - (CELL * 0.78) / 2, opacity: 0.85 }}
        >
          <BalloonIcon value={drag.value} size={CELL * 0.78} />
        </div>
      )}

      {/* 胜利遮罩 */}
      {won && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70">
          <div className="border border-[#a6e22e]/50 bg-[#101408] px-12 py-10 text-center" style={{ boxShadow: '0 0 60px rgba(166,226,46,0.25)' }}>
            <div className="mb-2 text-xs tracking-[0.4em] text-[#a6e22e]/70">// RECOVERY COMPLETE</div>
            <div className="mb-8 text-3xl font-medium text-[#d6f28a]">回收完成</div>
            <div className="flex justify-center gap-3">
              <button onClick={reset} className="border border-neutral-600 px-5 py-2.5 text-sm text-neutral-300 hover:border-neutral-400">
                再玩一次
              </button>
              <button onClick={onRestart} className="border border-neutral-600 px-5 py-2.5 text-sm text-neutral-300 hover:border-neutral-400">
                换一关
              </button>
              <button onClick={onExit} className="border border-[#a6e22e]/60 bg-[#a6e22e]/10 px-5 py-2.5 text-sm text-[#a6e22e] hover:bg-[#a6e22e]/20">
                返回菜单
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- 模块入口（菜单 + 游戏） ----------------

export default function BalloonPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // 初始关卡：编辑器试玩（state）或分享码链接（?code=）
  const initial = useMemo(() => {
    const fromState = (location.state as { level?: BalloonLevel } | null)?.level;
    if (fromState) return { level: fromState, error: '' };
    const code = searchParams.get('code');
    if (!code) return { level: null as BalloonLevel | null, error: '' };
    try {
      return { level: decodeBalloonLevel(code), error: '' };
    } catch (e) {
      return { level: null as BalloonLevel | null, error: (e as Error).message };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [level, setLevel] = useState<BalloonLevel | null>(initial.level);
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState(initial.error);

  const startWithCode = () => {
    try {
      setLevel(decodeBalloonLevel(codeInput));
      setCodeError('');
    } catch (e) {
      setCodeError((e as Error).message);
    }
  };

  if (level) {
    return (
      <BalloonGame
        key={level.name + level.balloons.join(',')}
        level={level}
        onExit={() => setLevel(null)}
        onRestart={() => setLevel(null)}
      />
    );
  }

  return (
    <div className="min-h-[calc(100vh-65px)] bg-[#0b0e09] px-4 py-12 text-neutral-300">
      <div className="mx-auto max-w-4xl">
        <div className="mb-10">
          <div className="text-xs tracking-[0.3em] text-neutral-500">// 明日方舟：终末地</div>
          <h1 className="mt-2 text-3xl font-medium text-neutral-100">气球 · 浮空回收</h1>
          <p className="mt-3 text-base text-neutral-500">
            把全部气球挂上网格并保持升力平衡
          </p>
        </div>

        <section className="mb-10">
          <h3 className="mb-4 text-sm tracking-[0.25em] text-neutral-500">游玩分享关卡</h3>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="粘贴分享码（EBL1_ 开头）"
              className="flex-1 border border-neutral-800 bg-[#14170f] px-4 py-3 text-base text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-[#a6e22e]/50"
            />
            <button
              onClick={startWithCode}
              className="border border-[#a6e22e]/60 bg-[#a6e22e]/10 px-7 py-3 text-base text-[#a6e22e] hover:bg-[#a6e22e]/20"
            >
              开始
            </button>
            <button
              onClick={() => navigate('/balloon/editor')}
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
                className="border border-neutral-800 bg-[#14170f] px-5 py-5 text-left hover:border-[#a6e22e]/50"
              >
                <div className="text-base text-neutral-200">{lv.name}</div>
                <div className="mt-2 text-xs text-neutral-600">
                  {lv.balloons.length} 个气球 · 总升力 {lv.balloons.reduce((s, b) => s + b, 0)} · {lv.placeable.length} 可放置格
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
