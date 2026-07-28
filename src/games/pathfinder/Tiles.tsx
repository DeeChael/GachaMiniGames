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

const abs: CSSProperties = { position: 'absolute', inset: 0 };

/** 替换 SVG 里的颜色，并给 mask id 加实例前缀（同一页面多个实例避免 id 冲突）；尺寸限制在容器内 */
function useSvg(raw: string, from: string, to: string): string {
  const uid = useId().replace(/:/g, '');
  return useMemo(
    () =>
      raw
        .replace('width="256" height="256"', 'width="100%" height="100%"')
        .split(from).join(to)
        .replaceAll('id="cut"', `id="cut${uid}"`)
        .replaceAll('url(#cut)', `url(#cut${uid})`)
        .replaceAll('id="detail"', `id="detail${uid}"`)
        .replaceAll('url(#detail)', `url(#detail${uid})`),
    [raw, from, to, uid],
  );
}

/** 四角 L 型装饰（普通方格用；right/bottom 定位保证四边边距一致） */
function CornerBrackets({ s, color }: { s: number; color: string }) {
  const m = s * 0.09; // 边距
  const l = s * 0.17; // 臂长
  const w = s * 0.045; // 线宽
  const bar = (style: CSSProperties): CSSProperties => ({ position: 'absolute', background: color, ...style });
  return (
    <>
      {/* 左上 */}
      <div style={bar({ left: m, top: m, width: l, height: w })} />
      <div style={bar({ left: m, top: m, width: w, height: l })} />
      {/* 右上 */}
      <div style={bar({ right: m, top: m, width: l, height: w })} />
      <div style={bar({ right: m, top: m, width: w, height: l })} />
      {/* 左下 */}
      <div style={bar({ left: m, bottom: m, width: l, height: w })} />
      <div style={bar({ left: m, bottom: m, width: w, height: l })} />
      {/* 右下 */}
      <div style={bar({ right: m, bottom: m, width: l, height: w })} />
      <div style={bar({ right: m, bottom: m, width: w, height: l })} />
    </>
  );
}

/** 底板：深色圆角方块；passed = 经过（亮蓝）；corners = 四角 L 装饰（普通格） */
export function CellBase({ s, passed, corners }: { s: number; passed: boolean; corners?: boolean }) {
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
      {corners && <CornerBrackets s={s} color={passed ? '#1b6d96' : '#1e4a5c'} />}
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

/** 起点：绿色方块 + 加粗 START 字样 + 圆角等腰三角 */
export function StartTile({ s }: { s: number }) {
  return (
    <div style={{ ...abs, background: C.green, borderRadius: Math.max(4, s * 0.1), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: s * 0.03 }}>
      <svg viewBox="0 0 24 24" style={{ width: s * 0.36, height: s * 0.3 }}>
        <path d="M12 20 L4 7 L20 7 Z" fill="#0a3a2c" stroke="#0a3a2c" strokeWidth={3.5} strokeLinejoin="round" />
      </svg>
      <div style={{ color: '#0a3a2c', fontWeight: 900, fontSize: s * 0.2, letterSpacing: 0.5 }}>START</div>
    </div>
  );
}

/** 终点：深绿底 + 邦布兔子；arrived = 到达（绿底） */
export function DestTile({ s, arrived }: { s: number; arrived: boolean }) {
  return (
    <div style={{ ...abs, background: arrived ? C.green : '#0d4a3a', borderRadius: Math.max(4, s * 0.1), transition: 'background 0.3s' }}>
      <svg viewBox="0 0 24 24" style={{ ...abs, width: '100%', height: '100%', padding: '12%' }}>
        <g fill={arrived ? '#0a3a2c' : C.green} style={{ transition: 'fill 0.3s' }}>
          <rect x="7" y="1.5" width="3.4" height="8" rx="1.7" />
          <rect x="13.6" y="1.5" width="3.4" height="8" rx="1.7" />
          <rect x="3" y="8" width="18" height="13" rx="6" />
        </g>
        <rect x="6.5" y="12" width="3.6" height="2.4" rx="1.2" fill={arrived ? C.green : '#0a3a2c'} />
        <rect x="13.9" y="12" width="3.6" height="2.4" rx="1.2" fill={arrived ? C.green : '#0a3a2c'} />
        <rect x="9" y="16.5" width="6" height="2.2" rx="1.1" fill={arrived ? C.green : '#0a3a2c'} />
      </svg>
    </div>
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

/** 旋转按钮：蓝色圆形箭头；passed = 已踩过（深色） */
export function RotateTile({ passed }: { passed: boolean }) {
  const col = passed ? C.tubePassed : C.tube;
  return (
    <svg viewBox="0 0 24 24" style={{ ...abs, width: '100%', height: '100%', padding: '13%' }}>
      <path
        d="M12 3.5 A8.5 8.5 0 1 1 3.5 12"
        fill="none"
        stroke={col}
        strokeWidth={3.4}
        strokeLinecap="round"
      />
      <path d="M3.5 12 L1 6.5 L7.5 6 Z" fill={col} transform="rotate(-12 4 8)" />
    </svg>
  );
}

/** 管道方块：直管 / L 管（assets/l_tube.svg）；宽度 = 方格的 1/3；可旋转，带旋转动画 */
export function TubeTile({ s, kind, rot, passed }: { s: number; kind: 'tube' | 'ltube'; rot: number; passed: boolean }) {
  const col = passed ? C.tubePassed : C.tube;
  const w = s / 3;
  const html = useSvg(lTubeRaw, '#1A6884', col);
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
        <div style={{ position: 'absolute', background: col, left: 0, right: 0, top: (s - w) / 2, height: w, transition: 'background 0.2s' }} />
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
