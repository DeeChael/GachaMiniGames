// ============================================================
// 邦布维修 —— 关卡编辑器
// 第一步「摆放」：用数字键 1~6 切换控件，搭出通路；
// 第二步「打乱」：旋转中继器打乱开局（可一键随机），
// 没有钥匙点可直接分享，有钥匙点需先试玩通关
// ============================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { Cell, Dir, PipeColor, PipeElement, PipeLevel, PipeLine } from './types';
import {
  DIRS,
  LINE_OFF,
  MAX_GRID,
  MAX_KEYS,
  MIN_GRID,
  R1,
  R2,
  annularSector,
  cellKey,
  dirToward,
  isRelay,
  lineMidCells,
  randomScramble,
  scrambledOk,
  validatePipeLevel,
} from './types';
import { BarTile, KeyTile, LineTile, QuadTile, ReceiverTile, SourceTile } from './Tiles';
import { extentOf } from './types';
import { encodePipeLevel } from './shareCode';

type Tool = 'source' | 'receiver' | 'bar' | 'quad' | 'line' | 'key';

const TOOLS: [Tool, string][] = [
  ['source', '⚡ 电力源'],
  ['receiver', '◎ 获电处'],
  ['bar', '— 条形中继器'],
  ['quad', '✚ 四向中继器'],
  ['line', '╱ 连接线'],
  ['key', '🔑 钥匙点'],
];

/** 悬停区域：元素 / 元素的分块（象限或半边）/ 连接线 */
type Region =
  | { kind: 'element'; k: string }
  | { kind: 'block'; k: string; dir: Dir }
  | { kind: 'line'; index: number }
  | null;

interface EditorState {
  name: string;
  rows: number;
  cols: number;
  elements: Record<string, PipeElement>;
  lines: PipeLine[];
  step: 'arrange' | 'scramble';
  solRots: Record<string, number>;
  scrambleRots: Record<string, number>;
  testPassed: boolean;
}

const newRelayRot = (elements: Record<string, PipeElement>): Record<string, number> => {
  const rots: Record<string, number> = {};
  for (const [k, el] of Object.entries(elements)) if (isRelay(el)) rots[k] = el.rot;
  return rots;
};

export default function PipeEditorPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // 试玩返回时：还原编辑器状态
  const init = useMemo(() => {
    const st = location.state as { editor?: EditorState; passed?: boolean } | null;
    if (!st?.editor) return null;
    return { editor: st.editor, passed: !!st.passed };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [name, setName] = useState(init?.editor.name ?? '我的关卡');
  const [rows, setRows] = useState(init?.editor.rows ?? 5);
  const [cols, setCols] = useState(init?.editor.cols ?? 5);
  const [elements, setElements] = useState<Record<string, PipeElement>>(init?.editor.elements ?? {});
  const [lines, setLines] = useState<PipeLine[]>(init?.editor.lines ?? []);
  const [step, setStep] = useState<'arrange' | 'scramble'>(init?.editor.step ?? 'arrange');
  const [solRots, setSolRots] = useState<Record<string, number>>(init?.editor.solRots ?? {});
  const [scrambleRots, setScrambleRots] = useState<Record<string, number>>(init?.editor.scrambleRots ?? {});
  const [testPassed, setTestPassed] = useState(init?.editor.testPassed ?? init?.passed ?? false);
  // 显示用的累计旋转角（驱动连续向前的旋转动画；逻辑朝向另存为 0~3）
  const [animRots, setAnimRots] = useState<Record<string, number>>(init?.editor.scrambleRots ?? {});

  const [tool, setTool] = useState<Tool>('source');
  const [hover, setHover] = useState<Region>(null);
  const [dragFrom, setDragFrom] = useState<Cell | null>(null);
  const [dragTo, setDragTo] = useState<Cell | null>(null);
  const [shareCode, setShareCode] = useState('');
  const [copied, setCopied] = useState(false);
  const boardRef = useRef<SVGSVGElement>(null);

  // 数字键 1~6 切换控件；悬停中继器时按 R 旋转（摆放步）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'r' || e.key === 'R') {
        if (step !== 'arrange' || !hover || hover.kind === 'line') return;
        const el = elements[hover.k];
        if (el && isRelay(el)) {
          dirty();
          setElements((prev) => ({
            ...prev,
            [hover.k]: { ...el, rot: (el.rot + 1) % 4, startRot: (el.rot + 1) % 4 },
          }));
          setAnimRots((prev) => ({ ...prev, [hover.k]: (prev[hover.k] ?? el.rot) + 1 }));
        }
        return;
      }
      const n = Number(e.key);
      if (n >= 1 && n <= TOOLS.length) setTool(TOOLS[n - 1][0]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, hover, elements]);

  const dirty = () => {
    setTestPassed(false);
    setShareCode('');
  };

  // 每格从各方向伸出的连接线（区域判定用）；线的中间格也算（两个对向都登记）
  const linesInCell = useMemo(() => {
    const map = new Map<string, { index: number; dir: Dir }[]>();
    const add = (k: string, index: number, dir: Dir) => map.set(k, [...(map.get(k) ?? []), { index, dir }]);
    lines.forEach((l, i) => {
      const ka = cellKey(l.a[0], l.a[1]);
      const kb = cellKey(l.b[0], l.b[1]);
      const dirA = dirToward(l.a, l.b);
      const dirB = dirToward(l.b, l.a);
      add(ka, i, dirA);
      add(kb, i, dirB);
      // 中间格：线从两个对向穿过，两边都算
      for (const [x, y] of lineMidCells(l)) {
        const k = cellKey(x, y);
        add(k, i, dirA);
        add(k, i, dirB);
      }
    });
    return map;
  }, [lines]);

  // 当前关卡的「解」（摆放步的朝向即解）
  const level: PipeLevel = useMemo(
    () => ({ name: name.trim() || '自定义关卡', rows, cols, elements, lines }),
    [name, rows, cols, elements, lines],
  );
  const errors = useMemo(() => (step === 'arrange' ? validatePipeLevel(level) : []), [step, level]);

  const cs = Math.max(40, Math.min(64, Math.floor(Math.min(680 / cols, 480 / rows))));
  const LINE_W = Math.max(5, cs * 0.07);

  // ---------------- 区域判定 ----------------

  const dirFromAngle = (dx: number, dy: number): Dir => {
    const ang = (Math.atan2(dy, dx) * 180) / Math.PI; // 0=右，90=下
    if (ang >= -45 && ang < 45) return 1;
    if (ang >= 45 && ang < 135) return 2;
    if (ang >= -135 && ang < -45) return 0;
    return 3;
  };

  const regionAt = (cx: number, cy: number, px: number, py: number): Region => {
    const k = cellKey(cx, cy);
    const el = elements[k];
    const cellLines = linesInCell.get(k) ?? [];
    const dir = dirFromAngle(px - 0.5, py - 0.5);
    if (cellLines.length > 0 && !el) {
      // 只有连接线的格子：按角度扇区分配最近的有线方向（交叉时看偏向哪一边）
      let best = cellLines[0];
      let bestDiff = 999;
      for (const cl of cellLines) {
        let diff = Math.abs(cl.dir - dir);
        if (diff > 2) diff = 4 - diff;
        if (diff < bestDiff) {
          bestDiff = diff;
          best = cl;
        }
      }
      return { kind: 'line', index: best.index };
    }
    if (cellLines.length > 0 && el) {
      // 有控件又有连接线：方向 1/4 扇区且超出控件最大半径（线实际伸出的位置）才属于连接线，
      // 否则算控件区域（不影响编辑控件颜色）
      const lined = cellLines.find((cl) => cl.dir === dir);
      if (lined) {
        const dist = Math.hypot(px - 0.5, py - 0.5);
        const maxExtent =
          el.kind === 'key' ? extentOf('key', el.dir === dir) : extentOf(el.kind, isRelay(el));
        if (dist > maxExtent) return { kind: 'line', index: lined.index };
      }
    }
    if (!el) return null;
    if (el.kind === 'source' || el.kind === 'key') return { kind: 'element', k };
    if (el.kind === 'receiver') return { kind: 'block', k, dir };
    if (el.kind === 'quad') return { kind: 'block', k, dir: ((dir - el.rot + 4) % 4) as Dir }; // 世界方向 → 局部象限
    if (el.kind === 'bar') {
      // 世界方向 → 局部方向 → 半边（触点 0 = 右半边，触点 1 = 左半边）
      const local = ((dir - el.rot + 4) % 4) as Dir;
      return { kind: 'block', k, dir: local === 3 ? 3 : 1 };
    }
    return { kind: 'element', k };
  };

  // ---------------- 放置与切换 ----------------

  const setEl = (k: string, el: PipeElement | null) => {
    dirty();
    setElements((prev) => {
      const next = { ...prev };
      if (el) next[k] = el;
      else delete next[k];
      return next;
    });
    if (!el) {
      // 删除控件时同时删掉与它相连的线
      setLines((prev) => prev.filter((l) => cellKey(l.a[0], l.a[1]) !== k && cellKey(l.b[0], l.b[1]) !== k));
    }
  };

  const cycleColor = (c: PipeColor): PipeColor => (c === 'yellow' ? 'blue' : 'yellow');

  const applyTool = (x: number, y: number) => {
    const k = cellKey(x, y);
    if (elements[k] || x >= cols || y >= rows) return;
    // 空格放置
    switch (tool) {
      case 'source':
        setEl(k, { kind: 'source', color: 'yellow' });
        return;
      case 'receiver':
        setEl(k, { kind: 'receiver', blocks: ['yellow', 'yellow', 'yellow', 'yellow'] });
        return;
      case 'bar':
        setEl(k, { kind: 'bar', locked: false, colors: ['yellow', 'yellow'], rot: 0, startRot: 0 });
        return;
      case 'quad':
        setEl(k, {
          kind: 'quad',
          locked: false,
          contacts: [true, true, true, true],
          blocks: ['yellow', 'yellow', 'yellow', 'yellow'],
          rot: 0,
          startRot: 0,
        });
        return;
      case 'key': {
        const keyCount = Object.values(elements).filter((e) => e.kind === 'key').length;
        if (keyCount >= MAX_KEYS) return;
        setEl(k, { kind: 'key', color: 'yellow', dir: 0 });
        return;
      }
      default:
        return;
    }
  };

  const clickCell = (x: number, y: number, region: Region, ctrl: boolean) => {
    const k = cellKey(x, y);
    const el = elements[k];
    if (tool === 'line') return;
    if (!el) return applyTool(x, y);
    if (tool === 'key' && isRelay(el)) {
      dirty();
      setEl(k, { ...el, locked: !el.locked });
      return;
    }
    // 切换颜色 / 触点
    if (tool === 'source' && el.kind === 'source') {
      dirty();
      setEl(k, { ...el, color: cycleColor(el.color) });
    } else if (tool === 'receiver' && el.kind === 'receiver' && region?.kind === 'block') {
      dirty();
      const blocks = el.blocks.map((b, d) => (d === region.dir ? cycleColor(b) : b));
      setEl(k, { ...el, blocks });
    } else if (tool === 'bar' && el.kind === 'bar' && region?.kind === 'block') {
      dirty();
      const idx = region.dir === 1 ? 0 : 1;
      const colors = el.colors.map((c, i) => (i === idx ? cycleColor(c) : c)) as [PipeColor, PipeColor];
      setEl(k, { ...el, colors });
    } else if (tool === 'quad' && el.kind === 'quad' && region?.kind === 'block') {
      dirty();
      if (ctrl) {
        const contacts = el.contacts.map((c, d) => (d === region.dir ? !c : c));
        setEl(k, { ...el, contacts });
      } else {
        const blocks = el.blocks.map((b, d) => (d === region.dir ? cycleColor(b) : b));
        setEl(k, { ...el, blocks });
      }
    } else if (tool === 'key' && el.kind === 'key') {
      dirty();
      setEl(k, { ...el, color: cycleColor(el.color) });
    }
  };

  // ---------------- 删除（右键，含区域判定） ----------------

  const deleteRegion = (region: Region) => {
    if (!region) return;
    dirty();
    if (region.kind === 'line') {
      setLines((prev) => prev.filter((_, i) => i !== region.index));
    } else if (region.kind === 'element' || region.kind === 'block') {
      const el = elements[region.k];
      if (el?.kind === 'key') {
        // 删除钥匙点时自动取消所有上锁状态
        setElements((prev) => {
          const next: Record<string, PipeElement> = {};
          for (const [k, e] of Object.entries(prev)) {
            if (k === region.k) continue;
            next[k] = isRelay(e) && e.locked ? { ...e, locked: false } : e;
          }
          return next;
        });
        setLines((prev) => prev.filter((l) => cellKey(l.a[0], l.a[1]) !== region.k && cellKey(l.b[0], l.b[1]) !== region.k));
      } else if (el && isRelay(el)) {
        // 删除中继器不影响连接线（留下悬空端点，由校验提示）
        dirty();
        setElements((prev) => {
          const next = { ...prev };
          delete next[region.k];
          return next;
        });
      } else {
        setEl(region.k, null);
      }
    }
  };

  // ---------------- 连接线拖拽创建 ----------------

  const tryCreateLine = (a: Cell, b: Cell) => {
    if (a[0] === b[0] && a[1] === b[1]) return;
    if (a[0] !== b[0] && a[1] !== b[1]) return; // 只能直线
    // 中间不能有控件
    for (const [x, y] of lineMidCells({ a, b })) {
      if (elements[cellKey(x, y)]) return;
    }
    // 不能与已有线重复
    const sig = [cellKey(a[0], a[1]), cellKey(b[0], b[1])].sort().join('|');
    if (lines.some((l) => [cellKey(l.a[0], l.a[1]), cellKey(l.b[0], l.b[1])].sort().join('|') === sig)) return;
    dirty();
    setLines((prev) => [...prev, { a, b }]);
  };

  // ---------------- 步骤流转 ----------------

  const goScramble = () => {
    const sol = newRelayRot(elements);
    setSolRots(sol);
    setScrambleRots({ ...sol });
    setAnimRots({ ...sol });
    setStep('scramble');
    setShareCode('');
  };

  const goArrange = () => {
    // 还原解的朝向
    setElements((prev) => {
      const next = { ...prev };
      for (const [k, el] of Object.entries(next)) {
        if (isRelay(el) && solRots[k] !== undefined) next[k] = { ...el, rot: solRots[k], startRot: solRots[k] };
      }
      return next;
    });
    setAnimRots({ ...solRots });
    setStep('arrange');
    setShareCode('');
  };

  const doRandomScramble = () => {
    const lv: PipeLevel = { ...level, elements: elementsWithRot(solRots) };
    setScrambleRots(randomScramble(lv));
    setTestPassed(false);
    setShareCode('');
  };

  const elementsWithRot = (rots: Record<string, number>): Record<string, PipeElement> => {
    const next: Record<string, PipeElement> = {};
    for (const [k, el] of Object.entries(elements)) {
      next[k] = isRelay(el) && rots[k] !== undefined ? { ...el, rot: rots[k], startRot: rots[k] } : el;
    }
    return next;
  };

  // 打散步的中继器点击旋转（上锁的也能手动调整，随机打乱才跳过它们）
  const rotateAt = (k: string) => {
    const el = elements[k];
    if (!el || !isRelay(el)) return;
    dirty();
    setScrambleRots((r) => ({ ...r, [k]: ((r[k] ?? solRots[k] ?? 0) + 1) % 4 }));
    setAnimRots((r) => ({ ...r, [k]: (r[k] ?? solRots[k] ?? 0) + 1 }));
  };

  const scrambled = useMemo(() => {
    const lv: PipeLevel = { ...level, elements: elementsWithRot(scrambleRots) };
    return scrambledOk(lv, scrambleRots);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, scrambleRots]);

  const hasKey = Object.values(elements).some((e) => e.kind === 'key');

  const finalLevel: PipeLevel = useMemo(
    () => ({ ...level, elements: elementsWithRot(scrambleRots) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [level, scrambleRots],
  );

  const editorState = (): EditorState => ({
    name, rows, cols, elements, lines, step, solRots, scrambleRots, testPassed,
  });

  const play = () => navigate('/pipe', { state: { level: finalLevel, test: true, editor: editorState() } });

  const generate = () => {
    setShareCode(encodePipeLevel(finalLevel));
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

  const resize = (newCols: number, newRows: number) => {
    dirty();
    setCols(newCols);
    setRows(newRows);
    setElements((prev) => {
      const next: Record<string, PipeElement> = {};
      for (const [k, el] of Object.entries(prev)) {
        const [x, y] = k.split(',').map(Number);
        if (x < newCols && y < newRows) next[k] = el;
      }
      return next;
    });
    setLines((prev) =>
      prev.filter(
        (l) =>
          l.a[0] < newCols && l.a[1] < newRows && l.b[0] < newCols && l.b[1] < newRows,
      ),
    );
  };

  // ---------------- 渲染 ----------------

  const toGrid = (clientX: number, clientY: number): [number, number] => {
    const rect = boardRef.current!.getBoundingClientRect();
    return [(clientX - rect.left) / cs, (clientY - rect.top) / cs];
  };

  const hoverRegion = hover;

  return (
    <div className="min-h-[calc(100vh-65px)] bg-[#0a0f0d] px-4 py-10 text-neutral-300 select-none">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-start justify-between gap-3">
          <div>
            <div className="text-xs tracking-[0.3em] text-neutral-500">// 邦布维修 · 关卡编辑器</div>
            <h1 className="mt-2 text-2xl font-medium text-neutral-100">
              {step === 'arrange' ? '第一步：摆放通路' : '第二步：打乱朝向'}
            </h1>
          </div>
          <button onClick={() => navigate('/pipe')} className="border border-neutral-700 px-4 py-2 text-sm text-neutral-400 hover:border-neutral-500">
            ✕ 返回
          </button>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
          {/* 左：棋盘 */}
          <div>
            {step === 'arrange' && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {TOOLS.map(([t, label], i) => (
                  <button
                    key={t}
                    onClick={() => setTool(t)}
                    className={`border px-3 py-1.5 text-xs ${
                      tool === t
                        ? 'border-[#7cee94]/70 bg-[#7cee94]/10 text-[#7cee94]'
                        : 'border-neutral-700 text-neutral-400 hover:border-neutral-500'
                    }`}
                  >
                    <span className="mr-1 text-neutral-500">{i + 1}</span>
                    {label}
                  </button>
                ))}
              </div>
            )}
            <div className="mb-4 text-xs text-neutral-600">
              {step === 'arrange'
                ? tool === 'source' && '点击放置电力源，点击已放置的切换颜色，右键删除'
                || tool === 'receiver' && '点击放置获电处；悬停小块出现描边，点击切换该块颜色，右键删除'
                || tool === 'bar' && '点击放置条形中继器（默认横向两触点）；点击半边切换颜色，右键删除'
                || tool === 'quad' && '点击放置四向中继器；点击象限切换颜色，Ctrl+点击切换触点，右键删除'
                || tool === 'line' && '按住一格拖到同行的另一格创建连接线（可跨空格），右键删除'
                || '点击放置钥匙点，点击切换颜色；选中钥匙工具时点击中继器切换上锁'
              : '点击中继器旋转打乱（上锁的不能手动旋转，用随机打乱）；必须打乱到不是通路才能分享'}
            </div>

            <div className="inline-block rounded-lg border border-[#1e3a3a] bg-[#0d2424] p-3">
              <svg
                ref={boardRef}
                width={cols * cs}
                height={rows * cs}
                onPointerMove={(e) => {
                  const [gx, gy] = toGrid(e.clientX, e.clientY);
                  const cx = Math.floor(gx);
                  const cy = Math.floor(gy);
                  if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return setHover(null);
                  setHover(regionAt(cx, cy, gx - cx, gy - cy));
                  if (dragFrom) setDragTo([cx, cy]);
                }}
                onPointerLeave={() => {
                  setHover(null);
                  setDragFrom(null);
                  setDragTo(null);
                }}
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  const [gx, gy] = toGrid(e.clientX, e.clientY);
                  const cx = Math.floor(gx);
                  const cy = Math.floor(gy);
                  if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return;
                  if (step === 'scramble') {
                    rotateAt(cellKey(cx, cy));
                    return;
                  }
                  if (tool === 'line') {
                    setDragFrom([cx, cy]);
                    setDragTo([cx, cy]);
                  }
                }}
                onPointerUp={(e) => {
                  if (e.button !== 0) return;
                  if (step === 'arrange' && tool === 'line' && dragFrom && dragTo) {
                    tryCreateLine(dragFrom, dragTo);
                  } else if (step === 'arrange') {
                    const [gx, gy] = toGrid(e.clientX, e.clientY);
                    const cx = Math.floor(gx);
                    const cy = Math.floor(gy);
                    if (cx >= 0 && cy >= 0 && cx < cols && cy < rows) {
                      clickCell(cx, cy, regionAt(cx, cy, gx - cx, gy - cy), e.ctrlKey || e.metaKey);
                    }
                  }
                  setDragFrom(null);
                  setDragTo(null);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (step === 'arrange') deleteRegion(hover);
                }}
              >
                {/* 格子线（仅编辑器显示） */}
                {Array.from({ length: rows }, (_, y) =>
                  Array.from({ length: cols }, (_, x) => (
                    <rect
                      key={`${x},${y}`}
                      x={x * cs}
                      y={y * cs}
                      width={cs}
                      height={cs}
                      fill="none"
                      stroke="rgba(90,140,140,0.18)"
                      strokeWidth={1}
                    />
                  )),
                )}

                {/* 连接线 */}
                {lines.map((l, i) => {
                  const ka = cellKey(l.a[0], l.a[1]);
                  const kb = cellKey(l.b[0], l.b[1]);
                  const elA = elements[ka];
                  const elB = elements[kb];
                  const dirA = dirToward(l.a, l.b);
                  const dirB = dirToward(l.b, l.a);
                  // 编辑器里不做精确触点判定：中继器端点统一按带触点缩进，空格端点延伸到格中心
                  const extentOfEl = (el: PipeElement | undefined, dir: Dir) =>
                    !el ? 0.12 : el.kind === 'key' ? extentOf('key', el.dir === dir) : extentOf(el.kind, isRelay(el));
                  const ea = extentOfEl(elA, dirA) * cs + LINE_W;
                  const eb = extentOfEl(elB, dirB) * cs + LINE_W;
                  const [ax, ay] = [(l.a[0] + 0.5) * cs, (l.a[1] + 0.5) * cs];
                  const [bx, by] = [(l.b[0] + 0.5) * cs, (l.b[1] + 0.5) * cs];
                  const hovered = hoverRegion?.kind === 'line' && hoverRegion.index === i;
                  return (
                    <g key={i}>
                      <LineTile
                        x1={ax + DIRS[dirA][0] * ea}
                        y1={ay + DIRS[dirA][1] * ea}
                        x2={bx + DIRS[dirB][0] * eb}
                        y2={by + DIRS[dirB][1] * eb}
                        w={LINE_W}
                        colors={new Set()}
                      />
                      {hovered && (
                        <line
                          x1={ax + DIRS[dirA][0] * ea}
                          y1={ay + DIRS[dirA][1] * ea}
                          x2={bx + DIRS[dirB][0] * eb}
                          y2={by + DIRS[dirB][1] * eb}
                          stroke="#ffffff"
                          strokeWidth={LINE_W / 2}
                          strokeOpacity={0.85}
                          strokeLinecap="round"
                        />
                      )}
                    </g>
                  );
                })}

                {/* 拖拽创建连接线的预览 */}
                {dragFrom && dragTo && tool === 'line' && step === 'arrange' && (
                  <line
                    x1={(dragFrom[0] + 0.5) * cs}
                    y1={(dragFrom[1] + 0.5) * cs}
                    x2={(dragTo[0] + 0.5) * cs}
                    y2={(dragTo[1] + 0.5) * cs}
                    stroke={LINE_OFF}
                    strokeWidth={LINE_W}
                    strokeLinecap="round"
                    strokeDasharray="6 5"
                    opacity={0.7}
                  />
                )}

                {/* 控件 */}
                {Object.entries(elements).map(([k, el]) => {
                  const [x, y] = k.split(',').map(Number);
                  const rot = isRelay(el) ? (animRots[k] ?? el.rot) : 0;
                  const hovered =
                    (hoverRegion?.kind === 'element' && hoverRegion.k === k) || (hoverRegion?.kind === 'block' && hoverRegion.k === k);
                  return (
                    <g key={k} transform={`translate(${x * cs}, ${y * cs})`}>
                      {hovered && step === 'arrange' && (
                        <rect x={2} y={2} width={cs - 4} height={cs - 4} fill="none" stroke="#ffffff" strokeOpacity={0.7} strokeWidth={1.5} strokeDasharray="4 3" />
                      )}
                      {el.kind === 'source' && <SourceTile s={cs} el={el} powered={false} />}
                      {el.kind === 'receiver' && <ReceiverTile s={cs} el={el} lit={new Set()} progress={0} anyPower={false} />}
                      {el.kind === 'bar' && <BarTile s={cs} el={el} rot={rot} on={false} />}
                      {el.kind === 'quad' && <QuadTile s={cs} el={el} rot={rot} on={false} />}
                      {el.kind === 'key' && <KeyTile s={cs} el={el} on={false} />}
                    </g>
                  );
                })}

                {/* 悬停分块的高亮描边（获电处/中继器的象限或半边） */}
                {step === 'arrange' && hoverRegion?.kind === 'block' && elements[hoverRegion.k] && (
                  <g transform={`translate(${hoverRegion.k.split(',').map(Number)[0] * cs}, ${hoverRegion.k.split(',').map(Number)[1] * cs})`}>
                    {(() => {
                      const el = elements[hoverRegion.k];
                      const c = cs / 2;
                      const d = hoverRegion.dir;
                      const rotDeg = ((animRots[hoverRegion.k] ?? (isRelay(el) ? el.rot : 0)) % 4) * 90;
                      let path = '';
                      if (el.kind === 'receiver') {
                        const r = R1 * cs;
                        path = annularSector(c, c, r, r - r / 3, d * 90 - 45 + 2, d * 90 + 45 - 2);
                      } else if (el.kind === 'quad') {
                        const r = R2 * cs;
                        const w = el.locked ? r / 3 : r / 2;
                        path = annularSector(c, c, r, r - w, rotDeg + d * 90 - 45 + 2, rotDeg + d * 90 + 45 - 2);
                      } else if (el.kind === 'bar') {
                        const r = R2 * cs;
                        const w = el.locked ? r / 3 : r / 2;
                        const a0 = d === 1 ? 0 : 180;
                        path = annularSector(c, c, r, r - w, rotDeg + a0 + 2, rotDeg + a0 + 180 - 2);
                      }
                      return path ? (
                        <path d={path} fill="none" stroke="#ffffff" strokeOpacity={0.9} strokeWidth={1.5} />
                      ) : null;
                    })()}
                  </g>
                )}
              </svg>
            </div>
          </div>

          {/* 右：配置 */}
          <div className="space-y-6">
            <div>
              <label className="mb-1.5 block text-xs tracking-widest text-neutral-500">关卡名称</label>
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value.slice(0, 24));
                  dirty();
                }}
                className="w-full border border-neutral-800 bg-[#121917] px-4 py-2.5 text-base outline-none focus:border-[#7cee94]/50"
              />
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="mb-1.5 block text-xs tracking-widest text-neutral-500">长 (列) {cols}</label>
                <input
                  type="range" min={MIN_GRID} max={MAX_GRID} value={cols}
                  onChange={(e) => resize(Number(e.target.value), rows)}
                  className="w-full accent-[#7cee94]"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1.5 block text-xs tracking-widest text-neutral-500">高 (行) {rows}</label>
                <input
                  type="range" min={MIN_GRID} max={MAX_GRID} value={rows}
                  onChange={(e) => resize(cols, Number(e.target.value))}
                  className="w-full accent-[#7cee94]"
                />
              </div>
            </div>

            <div className="border-t border-neutral-800 pt-5">
              {step === 'arrange' ? (
                <>
                  {errors.length > 0 ? (
                    <ul className="mb-3 space-y-1">
                      {errors.map((e, i) => (
                        <li key={i} className="text-xs text-red-400">· {e}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mb-3 text-xs text-[#7cee94]">✓ 通路合法</div>
                  )}
                  <button
                    onClick={goScramble}
                    disabled={errors.length > 0}
                    className="w-full border border-[#7cee94]/60 bg-[#7cee94]/10 px-4 py-3 text-base text-[#7cee94] hover:bg-[#7cee94]/20 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    下一步：打乱朝向 →
                  </button>
                </>
              ) : (
                <>
                  {!scrambled && (
                    <div className="mb-3 text-xs text-red-400">· 还没有打乱：当前仍是通路，玩家进入会直接通关</div>
                  )}
                  {scrambled && <div className="mb-3 text-xs text-[#7cee94]">✓ 已打乱</div>}
                  <button
                    onClick={doRandomScramble}
                    className="w-full border border-neutral-700 px-4 py-3 text-base text-neutral-300 hover:border-neutral-500"
                  >
                    🎲 一键随机打乱
                  </button>
                  <button
                    onClick={goArrange}
                    className="mt-2 w-full border border-neutral-700 px-4 py-3 text-base text-neutral-300 hover:border-neutral-500"
                  >
                    ← 上一步：回到摆放
                  </button>
                  <button
                    onClick={play}
                    disabled={!scrambled}
                    className="mt-2 w-full border border-neutral-700 px-4 py-3 text-base text-neutral-300 hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    ▶ 试玩{hasKey && !testPassed && '（有钥匙点，需通关后才能分享）'}
                  </button>
                  <button
                    onClick={generate}
                    disabled={!scrambled || (hasKey && !testPassed)}
                    className="mt-2 w-full border border-[#7cee94]/60 bg-[#7cee94]/10 px-4 py-3 text-base text-[#7cee94] hover:bg-[#7cee94]/20 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    生成分享码
                  </button>
                  {hasKey && !testPassed && scrambled && (
                    <div className="mt-2 text-xs text-neutral-600">添加了钥匙点，需要先「试玩」并通关一次</div>
                  )}
                  {shareCode && (
                    <div className="mt-4">
                      <textarea
                        readOnly
                        value={shareCode}
                        rows={3}
                        onFocus={(e) => e.target.select()}
                        className="w-full resize-none border border-neutral-800 bg-[#121917] p-3 font-mono text-xs break-all text-neutral-400 outline-none"
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
