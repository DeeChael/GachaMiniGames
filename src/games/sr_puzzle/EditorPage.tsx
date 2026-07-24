// ============================================================
// 预言算碑 —— 关卡编辑器
// 第一步「摆放」：从右侧形状库把拼图拖入棋盘，可旋转、移动、
// 删除，摆出目标图案；第二步「打散」：移动拼图打乱开局位置
// （不可旋转），此时棋盘以 30% 黄色显示目标图案，打散后
// 图案必须与目标不同才能生成分享码，否则玩家进入直接通关
// ============================================================

import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import type { PlacedPiece, Rot, SrLevel } from './types';
import {
  BOARD,
  MAX_PIECES,
  SHAPES,
  compositeKey,
  compositePolys,
  rotatedShape,
  shapeById,
  validatePlacements,
  validateSrLevel,
} from './types';
import SrBoard, { type BoardHandle } from './Board';
import { encodeSrLevel } from './shareCode';

type Step = 'arrange' | 'scatter';

const clampPos = (shape: string, rot: Rot, x: number, y: number) => {
  const { w, h } = rotatedShape(shapeById(shape)!, rot);
  return {
    x: Math.max(0, Math.min(BOARD - w, x)),
    y: Math.max(0, Math.min(BOARD - h, y)),
  };
};

export default function SrPuzzleEditorPage() {
  const navigate = useNavigate();
  const boardRef = useRef<BoardHandle>(null);
  const nextId = useRef(1);

  const [step, setStep] = useState<Step>('arrange');
  const [name, setName] = useState('我的关卡');
  const [pieces, setPieces] = useState<PlacedPiece[]>([]);
  const [snapshot, setSnapshot] = useState<PlacedPiece[] | null>(null); // 摆放好的目标位置
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [shareCode, setShareCode] = useState('');
  const [copied, setCopied] = useState(false);

  const selected = pieces.find((p) => p.id === selectedId) ?? null;

  // 从形状库拖入：新建拼图并立刻进入拖拽
  const addFromLibrary = (shapeId: string, e: React.PointerEvent) => {
    if (pieces.length >= MAX_PIECES) return;
    const s = shapeById(shapeId)!;
    const id = `n${nextId.current++}`;
    const x = Math.round((BOARD - s.w) / 2);
    const y = Math.round((BOARD - s.h) / 2);
    const piece: PlacedPiece = { id, shape: shapeId, rot: 0, x, y };
    setPieces((ps) => [...ps, piece]);
    setSelectedId(id);
    setShareCode('');
    // 等棋盘重渲染出新拼图后再接管拖拽
    requestAnimationFrame(() => boardRef.current?.beginDrag(id, e.clientX, e.clientY));
  };

  const onDrop = (id: string, x: number, y: number, inside: boolean) => {
    if (!inside) {
      // 摆放步：拖出棋盘即删除；打散步：拖出则回到原位
      if (step === 'arrange') {
        setPieces((ps) => ps.filter((p) => p.id !== id));
        setSelectedId((sel) => (sel === id ? null : sel));
        setShareCode('');
      }
      return;
    }
    setPieces((ps) => ps.map((p) => (p.id === id ? { ...p, x, y } : p)));
    setShareCode('');
  };

  const rotateSelected = () => {
    if (!selected) return;
    const rot = ((selected.rot + 1) % 4) as Rot;
    const { x, y } = clampPos(selected.shape, rot, selected.x, selected.y);
    setPieces((ps) => ps.map((p) => (p.id === selected.id ? { ...p, rot, x, y } : p)));
    setShareCode('');
  };

  const deleteSelected = () => {
    if (!selected) return;
    setPieces((ps) => ps.filter((p) => p.id !== selected.id));
    setSelectedId(null);
    setShareCode('');
  };

  // 第一步校验：结构合法 + 目标图案非空
  const arrangeErrors = useMemo(() => {
    const errs = validatePlacements(pieces);
    if (errs.length === 0 && !compositeKey(compositePolys(pieces)).includes('1')) {
      errs.push('目标图案为空，至少让拼图覆盖一格');
    }
    return errs;
  }, [pieces]);

  // 第二步校验：打散后的图案必须与目标不同（含「至少一块不在目标位置」）
  const scattered = useMemo(() => {
    if (!snapshot) return false;
    return compositeKey(compositePolys(pieces)) !== compositeKey(compositePolys(snapshot));
  }, [pieces, snapshot]);

  const goScatter = () => {
    setSnapshot(pieces.map((p) => ({ ...p })));
    setSelectedId(null);
    setStep('scatter');
    setShareCode('');
  };

  const goArrange = () => {
    if (snapshot) setPieces(snapshot.map((p) => ({ ...p })));
    setSelectedId(null);
    setStep('arrange');
    setShareCode('');
  };

  const level: SrLevel | null = useMemo(() => {
    if (!snapshot) return null;
    return {
      name: name.trim() || '自定义关卡',
      pieces: pieces.map((p) => {
        const s = snapshot.find((q) => q.id === p.id)!;
        return { shape: p.shape, rot: p.rot, tx: s.x, ty: s.y, x: p.x, y: p.y };
      }),
    };
  }, [pieces, snapshot, name]);

  const generate = () => {
    if (!level) return;
    if (validateSrLevel(level).length > 0) return;
    setShareCode(encodeSrLevel(level));
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

  return (
    <div className="min-h-[calc(100vh-65px)] bg-[#0a0f1a] px-4 py-10 text-neutral-300 select-none">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-start justify-between gap-3">
          <div>
            <div className="text-xs tracking-[0.3em] text-neutral-500">// 预言算碑 · 关卡编辑器</div>
            <h1 className="mt-2 text-2xl font-medium text-neutral-100">
              {step === 'arrange' ? '第一步：摆放目标图案' : '第二步：打散拼图'}
            </h1>
          </div>
          <button onClick={() => navigate('/sr_puzzle')} className="border border-neutral-700 px-4 py-2 text-sm text-neutral-400 hover:border-neutral-500">
            ✕ 返回
          </button>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          {/* 左：棋盘 */}
          <div>
            <div className="mb-3 text-sm text-neutral-500">
              {step === 'arrange'
                ? '从右侧形状库把拼图拖入棋盘；点击拼图选中后可旋转 / 删除；重叠部分会抵消为空'
                : '拖动拼图打散开局位置（不可旋转）；棋盘上 30% 的黄色是玩家要拼出的目标图案'}
            </div>
            <SrBoard
              ref={boardRef}
              size={560}
              pieces={pieces}
              target={step === 'scatter' && snapshot ? snapshot : undefined}
              interactive
              selectedId={selectedId}
              onSelect={step === 'arrange' ? setSelectedId : undefined}
              onDrop={onDrop}
            />
            {step === 'arrange' && selected && (
              <div className="mt-4 flex items-center gap-3">
                <span className="text-sm text-neutral-400">
                  已选中：{shapeById(selected.shape)?.name}
                </span>
                <button onClick={rotateSelected} className="border border-neutral-600 px-4 py-2 text-sm text-neutral-200 hover:border-neutral-400">
                  ⟳ 旋转 90°
                </button>
                <button onClick={deleteSelected} className="border border-red-900/70 px-4 py-2 text-sm text-red-300 hover:border-red-600">
                  ✕ 删除
                </button>
              </div>
            )}
          </div>

          {/* 右：形状库 / 步骤与分享 */}
          <div className="space-y-6">
            {step === 'arrange' && (
              <div>
                <label className="mb-1.5 block text-xs tracking-widest text-neutral-500">
                  形状库（拖入棋盘，{pieces.length}/{MAX_PIECES}）
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {SHAPES.map((s) => (
                    <button
                      key={s.id}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        addFromLibrary(s.id, e);
                      }}
                      className="flex flex-col items-center gap-1 border border-neutral-800 bg-[#141a28] p-2 hover:border-[#e8c268]/50"
                      title={s.name}
                    >
                      <svg viewBox={`-0.4 -0.4 ${s.w + 0.8} ${s.h + 0.8}`} className="h-14 w-full">
                        <path
                          d={`M${s.points.map(([x, y]) => `${x},${y}`).join('L')}Z`}
                          fill="#e0b04a"
                          stroke="#ffe9b0"
                          strokeWidth={0.12}
                        />
                      </svg>
                      <span className="text-[11px] text-neutral-500">{s.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs tracking-widest text-neutral-500">关卡名称</label>
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value.slice(0, 24));
                  setShareCode('');
                }}
                className="w-full border border-neutral-800 bg-[#141a28] px-4 py-2.5 text-base outline-none focus:border-[#e8c268]/50"
              />
            </div>

            <div className="border-t border-neutral-800 pt-5">
              {step === 'arrange' ? (
                <>
                  {arrangeErrors.length > 0 ? (
                    <ul className="mb-3 space-y-1">
                      {arrangeErrors.map((e, i) => (
                        <li key={i} className="text-xs text-red-400">· {e}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mb-3 text-xs text-[#e8c268]">✓ 目标图案合法</div>
                  )}
                  <button
                    onClick={goScatter}
                    disabled={arrangeErrors.length > 0}
                    className="w-full border border-[#e8c268]/60 bg-[#e8c268]/10 px-4 py-3 text-base text-[#f0d896] hover:bg-[#e8c268]/20 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    下一步：打散拼图 →
                  </button>
                </>
              ) : (
                <>
                  {!scattered && (
                    <div className="mb-3 text-xs text-red-400">
                      · 还没有打散：必须有图案不在目标位置，否则玩家进入会直接通关
                    </div>
                  )}
                  {scattered && <div className="mb-3 text-xs text-[#e8c268]">✓ 已打散，可以分享</div>}
                  <button
                    onClick={generate}
                    disabled={!scattered}
                    className="w-full border border-[#e8c268]/60 bg-[#e8c268]/10 px-4 py-3 text-base text-[#f0d896] hover:bg-[#e8c268]/20 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    生成分享码
                  </button>
                  <button
                    onClick={goArrange}
                    className="mt-2 w-full border border-neutral-700 px-4 py-3 text-base text-neutral-300 hover:border-neutral-500"
                  >
                    ← 上一步：回到摆放
                  </button>
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
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
