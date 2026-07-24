// ============================================================
// 预言算碑游戏页面 —— 崩坏：星穹铁道「预言算碑」复刻
// 左侧小一号棋盘展示目标图案；拖动棋盘上的拼图（不可旋转），
// 重叠部分相互抵消显示为空，拼出目标图案即通关
// ============================================================

import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import type { PlacedPiece, SrLevel } from './types';
import { compositeKey, compositePolys } from './types';
import SrBoard from './Board';
import { BUILTIN_LEVELS } from './levels';
import { decodeSrLevel, encodeSrLevel } from './shareCode';

const toPlaced = (level: SrLevel): PlacedPiece[] =>
  level.pieces.map((p, i) => ({ id: `p${i}`, shape: p.shape, rot: p.rot, x: p.x, y: p.y }));

const targetOf = (level: SrLevel) =>
  level.pieces.map((p) => ({ shape: p.shape, rot: p.rot, x: p.tx, y: p.ty }));

// ---------------- 游戏主组件 ----------------

export function SrPuzzleGame({
  level,
  onExit,
  onRestart,
}: {
  level: SrLevel;
  onExit: () => void;
  onRestart: () => void;
}) {
  const [pieces, setPieces] = useState<PlacedPiece[]>(() => toPlaced(level));
  const [won, setWon] = useState(false);

  const target = useMemo(() => targetOf(level), [level]);
  const targetKey = useMemo(() => compositeKey(compositePolys(target)), [target]);

  const reset = () => {
    setPieces(toPlaced(level));
    setWon(false);
  };

  const onDrop = (id: string, x: number, y: number, inside: boolean) => {
    if (won || !inside) return;
    const next = pieces.map((p) => (p.id === id ? { ...p, x, y } : p));
    setPieces(next);
    if (compositeKey(compositePolys(next)) === targetKey) setWon(true);
  };

  return (
    <div className="flex min-h-[calc(100vh-61px)] flex-col items-center bg-[#0a0f1a] px-4 py-8 text-neutral-300 select-none">
      {/* 顶部信息栏 */}
      <div className="mb-6 flex w-full max-w-6xl items-center justify-between gap-3">
        <div>
          <div className="text-xs tracking-[0.3em] text-neutral-500">// 预言算碑</div>
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

      <div className="flex flex-wrap items-center justify-center gap-10">
        {/* 左：小一号棋盘展示目标图案 */}
        <div className="flex flex-col items-center gap-4">
          <div className="text-lg tracking-[0.2em] text-[#e8c268]">{level.name}</div>
          <SrBoard size={250} pieces={target.map((p, i) => ({ ...p, id: `t${i}` }))} showOutlines={false} />
          <div className="text-xs text-neutral-500">目标图案</div>
        </div>

        {/* 右：主棋盘（目标图案以 30% 黄色垫在拼图下方） */}
        <SrBoard size={560} pieces={pieces} target={target} interactive={!won} onDrop={onDrop} />
      </div>

      {/* 胜利遮罩 */}
      {won && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70">
          <div className="border border-[#e8c268]/50 bg-[#12100a] px-12 py-10 text-center" style={{ boxShadow: '0 0 60px rgba(232,194,104,0.25)' }}>
            <div className="mb-2 text-xs tracking-[0.4em] text-[#e8c268]/70">// PROPHECY REVEALED</div>
            <div className="mb-8 text-3xl font-medium text-[#f0d896]">预言显现</div>
            <div className="flex justify-center gap-3">
              <button onClick={reset} className="border border-neutral-600 px-5 py-2.5 text-sm text-neutral-300 hover:border-neutral-400">
                再玩一次
              </button>
              <button onClick={onRestart} className="border border-neutral-600 px-5 py-2.5 text-sm text-neutral-300 hover:border-neutral-400">
                换一关
              </button>
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

// ---------------- 预言算碑模块入口（菜单 + 游戏） ----------------

export default function SrPuzzlePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  // 初始关卡：分享码链接（?code=）
  const initial = useMemo(() => {
    const code = searchParams.get('code');
    if (!code) return { level: null as SrLevel | null, error: '' };
    try {
      return { level: decodeSrLevel(code), error: '' };
    } catch (e) {
      return { level: null as SrLevel | null, error: (e as Error).message };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [level, setLevel] = useState<SrLevel | null>(initial.level);
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState(initial.error);

  const startWithCode = () => {
    try {
      setLevel(decodeSrLevel(codeInput));
      setCodeError('');
    } catch (e) {
      setCodeError((e as Error).message);
    }
  };

  if (level) {
    return (
      <SrPuzzleGame
        key={encodeSrLevel(level)}
        level={level}
        onExit={() => setLevel(null)}
        onRestart={() => setLevel(null)}
      />
    );
  }

  return (
    <div className="min-h-[calc(100vh-61px)] bg-[#0a0f1a] px-4 py-12 text-neutral-300">
      <div className="mx-auto max-w-4xl">
        <div className="mb-10">
          <div className="text-xs tracking-[0.3em] text-neutral-500">// 崩坏：星穹铁道</div>
          <h1 className="mt-2 text-3xl font-medium text-neutral-100">预言算碑</h1>
          <p className="mt-3 text-base text-neutral-500">
            拖动棋盘上的拼图碎片，拼出左侧的目标图案。拼图之间可以重叠：重叠部分会相互抵消显示为空，再压上一块又会重新显现
          </p>
        </div>

        <section className="mb-10">
          <h3 className="mb-4 text-sm tracking-[0.25em] text-neutral-500">游玩分享关卡</h3>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="粘贴分享码（SPZ1_ 开头）"
              className="flex-1 border border-neutral-800 bg-[#141a28] px-4 py-3 text-base text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-[#e8c268]/50"
            />
            <button
              onClick={startWithCode}
              className="border border-[#e8c268]/60 bg-[#e8c268]/10 px-7 py-3 text-base text-[#e8c268] hover:bg-[#e8c268]/20"
            >
              开始
            </button>
            <button
              onClick={() => navigate('/sr_puzzle/editor')}
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
                className="border border-neutral-800 bg-[#141a28] px-5 py-5 text-left hover:border-[#e8c268]/50"
              >
                <div className="text-base text-neutral-200">{lv.name}</div>
                <div className="mt-2 text-xs text-neutral-600">{lv.pieces.length} 块拼图</div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
