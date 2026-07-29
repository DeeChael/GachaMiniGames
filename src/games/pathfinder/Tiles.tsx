// ============================================================
// 邦布维修 2.0 —— 方块渲染（游戏页与编辑器共用）
// 底板：深色圆角方块，普通格四角有 L 型装饰；经过的格子亮蓝；
// 当前格有从边缘朝内的白色辉光（GlowOverlay 覆盖渲染）
// 检查点 / 禁止方块 / L 管使用 src/games/pathfinder/assets 下的
// SVG 图标（?raw 内联，按需替换填充色）
// ============================================================

import { useMemo, type CSSProperties } from 'react';
import { useId } from 'react';
import { C } from './types';
import checkpointRaw from './assets/checkpoint.svg?raw';
import denyRaw from './assets/deny.svg?raw';
import lTubeRaw from './assets/l_tube.svg?raw';
import normalRaw from './assets/normal.svg?raw';
import passedRaw from './assets/passed.svg?raw';
import rotateRaw from './assets/rotate.svg?raw';
import tubeRaw from './assets/tube.svg?raw';

const abs: CSSProperties = { position: 'absolute', inset: 0 };

/** 替换 SVG 里的颜色，并给 mask id 加实例前缀（同一页面多个实例避免 id 冲突）；尺寸限制在容器内 */
function useSvg(raw: string, from: string, to: string): string {
  const uid = useId().replace(/:/g, '');
  return useMemo(
    () =>
      raw
        .replace(/width="\d+" height="\d+"/, 'width="100%" height="100%"')
        .split(from).join(to)
        .replaceAll('id="cut"', `id="cut${uid}"`)
        .replaceAll('url(#cut)', `url(#cut${uid})`)
        .replaceAll('id="detail"', `id="detail${uid}"`)
        .replaceAll('url(#detail)', `url(#detail${uid})`),
    [raw, from, to, uid],
  );
}

/** 底板：深色圆角方块；passed = 经过（亮蓝）；corners = 四角 L 装饰（普通格，assets/normal.svg / passed.svg） */
export function CellBase({ s, passed, corners }: { s: number; passed: boolean; corners?: boolean }) {
  const cornerHtml = useSvg(passed ? passedRaw : normalRaw, '#0D4A64', passed ? '#1b6d96' : '#1e4a5c');
  return (
    <div
      style={{
        ...abs,
        borderRadius: Math.max(4, s * 0.1),
        background: passed ? C.passed : C.base,
        border: `2px solid ${passed ? C.passed : C.baseBorder}`,
        transition: 'background 0.2s',
      }}
    >
      {corners && <div style={abs} dangerouslySetInnerHTML={{ __html: cornerHtml }} />}
    </div>
  );
}

/** 当前所在格的白色辉光（从边缘朝内，覆盖在最上层） */
export function GlowOverlay({ s }: { s: number }) {
  return (
    <div
      style={{
        ...abs,
        borderRadius: Math.max(4, s * 0.1),
        boxShadow: `inset 0 0 ${s / 2.2}px rgba(255,255,255,0.75), inset 0 0 ${s / 7}px rgba(255,255,255,0.85)`,
        pointerEvents: 'none',
      }}
    />
  );
}

const PNG_BASE = `${import.meta.env.BASE_URL}pathfinder`;

/** 起点：start.png 填充方格 */
export function StartTile({ s }: { s: number }) {
  return (
    <img
      src={`${PNG_BASE}/start.png`}
      alt="START"
      style={{ ...abs, width: '100%', height: '100%', borderRadius: Math.max(4, s * 0.1), objectFit: 'cover' }}
      draggable={false}
    />
  );
}

/** 终点：destination.png 填充方格；arrived = 到达（destination_arrived.png） */
export function DestTile({ s, arrived }: { s: number; arrived: boolean }) {
  return (
    <img
      src={`${PNG_BASE}/${arrived ? 'destination_arrived.png' : 'destination.png'}`}
      alt="DEST"
      style={{ ...abs, width: '100%', height: '100%', borderRadius: Math.max(4, s * 0.1), objectFit: 'cover', transition: 'opacity 0.3s' }}
      draggable={false}
    />
  );
}

/** 检查点：深色底方格 + 0.8 倍 assets/checkpoint.svg；经过后底格变橙、图标变深色 */
export function CheckpointTile({ s, passed }: { s: number; passed: boolean }) {
  const html = useSvg(checkpointRaw, '#B97823', passed ? '#101113' : '#B97823');
  const size = s * 0.65;
  return (
    <div
      style={{
        ...abs,
        background: passed ? '#bd8723' : '#3d241f',
        borderRadius: Math.max(4, s * 0.1),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background 0.2s',
      }}
    >
      <div style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

/** 禁止方块：assets/deny.svg（内圈边线 + 四个粗箭头） */
export function DenyTile() {
  const html = useSvg(denyRaw, '#263036', C.deny);
  return <div style={abs} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** 检查点小图标（HUD 计数用），自带颜色 */
export function CheckpointIcon({ size }: { size: number }) {
  const html = useSvg(checkpointRaw, '#B97823', C.orange);
  return (
    <div
      style={{ width: size, height: size, borderRadius: size * 0.15, overflow: 'hidden', flexShrink: 0 }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/** 旋转按钮：assets/rotate.svg；passed = 已踩过（深色） */
export function RotateTile({ passed }: { passed: boolean }) {
  const html = useSvg(rotateRaw, '#136282', passed ? C.tubePassed : C.tube);
  return <div style={abs} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** 管道方块：直管（assets/tube.svg）/ L 管（assets/l_tube.svg）；可旋转，带旋转动画 */
export function TubeTile({ kind, rot, passed }: { s?: number; kind: 'tube' | 'ltube'; rot: number; passed: boolean }) {
  const col = passed ? C.tubePassed : C.tube;
  const html = useSvg(lTubeRaw, '#1A6884', col);
  const tubeHtml = useSvg(tubeRaw, '#1A6584', col);
  return (
    <div
      style={{
        ...abs,
        transform: `rotate(${rot * 90}deg)`,
        transition: 'transform 0.25s ease-in-out',
      }}
    >
      {kind === 'tube' ? (
        // 直管：左右贯通（rot 0）
        <div style={abs} dangerouslySetInnerHTML={{ __html: tubeHtml }} />
      ) : (
        // L 管：上 + 右（rot 0），转角为圆弧
        <div style={abs} dangerouslySetInnerHTML={{ __html: html }} />
      )}
    </div>
  );
}

/** 路径箭头：两个格子之间的白色圆角等腰三角，指向行走方向（图形在格内居中） */
export function PathArrow({ s, dir }: { s: number; dir: 0 | 1 | 2 | 3 }) {
  // dir: 0 上 1 右 2 下 3 左；三角默认朝下，按方向旋转
  const deg = [180, -90, 0, 90][dir];
  return (
    <div
      style={{
        position: 'absolute',
        width: s,
        height: s,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `rotate(${deg}deg)`,
        pointerEvents: 'none',
      }}
    >
      <svg viewBox="0 0 24 24" style={{ width: '72%', height: '72%', filter: 'drop-shadow(0 0 3px rgba(255,255,255,0.7))' }}>
        <path d="M12 19 L4 7 L20 7 Z" fill="#ffffff" stroke="#ffffff" strokeWidth={3.5} strokeLinejoin="round" />
      </svg>
    </div>
  );
}
