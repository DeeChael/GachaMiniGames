// ============================================================
// 黄金替罪羊 —— 瓦片渲染（游戏页与编辑器共用）
// ============================================================

import type { ToggleColor } from './types';
import { TOGGLE_COLORS } from './types';

const abs: React.CSSProperties = { position: 'absolute', inset: 0 };

/** 普通平台：方格顶部五分之一的棕色条 */
export function PlatformTile({ cs }: { cs: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        height: cs / 5,
        background: '#7a5a34',
        borderTop: '2px solid #a8834f',
        boxShadow: '0 2px 6px rgba(0,0,0,0.45)',
      }}
    />
  );
}

/** 可开关平台：与普通平台一样是顶部五分之一填充；开 = 实色，关 = 暗色 */
export function ToggleTile({ cs, color, on }: { cs: number; color: ToggleColor; on: boolean }) {
  const c = TOGGLE_COLORS[color];
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        height: cs / 5,
        background: on ? c.main : c.dim,
        borderTop: `2px solid ${on ? c.light : `${c.main}55`}`,
        boxShadow: on ? `0 0 ${cs / 4}px ${c.main}88` : '0 2px 6px rgba(0,0,0,0.45)',
      }}
    />
  );
}

/** 按钮：半圆的上半，贴紧格子底边 */
export function ButtonTile({ cs, color }: { cs: number; color: ToggleColor }) {
  const c = TOGGLE_COLORS[color];
  const w = cs * 0.56;
  const h = w / 2;
  return (
    <div style={abs}>
      <div
        style={{
          position: 'absolute',
          left: (cs - w) / 2,
          bottom: 0,
          width: w,
          height: h,
          background: `radial-gradient(circle at 50% 120%, ${c.main}, #6b5a12)`,
          border: `2px solid ${c.main}`,
          borderBottom: 'none',
          borderTopLeftRadius: w / 2,
          borderTopRightRadius: w / 2,
          boxShadow: `0 0 ${cs / 5}px ${c.main}66`,
        }}
      />
    </div>
  );
}

/** 梯子格（两侧竖杆 + 中间横档，连续排列即成形；top 段在顶缘再画一条线） */
export function LadderTile({ cs, top = false }: { cs: number; top?: boolean }) {
  const rail: React.CSSProperties = { position: 'absolute', top: 0, bottom: 0, width: cs * 0.09, background: '#b08a4a' };
  return (
    <div style={abs}>
      <div style={{ ...rail, left: cs * 0.14 }} />
      <div style={{ ...rail, right: cs * 0.14 }} />
      <div
        style={{
          position: 'absolute',
          left: cs * 0.14,
          right: cs * 0.14,
          top: cs * 0.42,
          height: cs * 0.14,
          background: '#d8b44a',
        }}
      />
      {top && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: 3,
            background: '#d8b44a',
            boxShadow: '0 0 6px rgba(216,180,74,0.8)',
          }}
        />
      )}
    </div>
  );
}

/** 祭坛 */
export function AltarTile({ cs }: { cs: number }) {
  return (
    <div className="flex h-full w-full items-center justify-center" style={abs}>
      <span style={{ fontSize: cs * 0.62, filter: 'drop-shadow(0 0 8px rgba(255,140,40,0.9))' }}>🔥</span>
    </div>
  );
}

/** 出生点标记 */
export function SpawnTile({ cs }: { cs: number }) {
  return (
    <div className="flex h-full w-full items-center justify-center" style={abs}>
      <span style={{ fontSize: cs * 0.6, filter: 'drop-shadow(0 0 6px rgba(216,180,74,0.8))' }}>🏠</span>
    </div>
  );
}

/** 主控角色（金色羊） */
export function PlayerIcon({ cs }: { cs: number }) {
  return (
    <span style={{ fontSize: cs * 0.72, lineHeight: 1, filter: 'drop-shadow(0 0 8px rgba(232,196,64,0.9))' }}>🐑</span>
  );
}

/** 「过去的自己」（蓝黑色 NPC） */
export function NpcIcon({ cs }: { cs: number }) {
  return (
    <span
      style={{
        fontSize: cs * 0.72,
        lineHeight: 1,
        filter: 'brightness(0.45) sepia(1) hue-rotate(185deg) saturate(4) drop-shadow(0 0 6px rgba(60,120,255,0.8))',
      }}
    >
      🐑
    </span>
  );
}
