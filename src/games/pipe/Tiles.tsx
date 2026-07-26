// ============================================================
// 邦布维修 —— 元件 SVG 渲染（游戏页与编辑器共用）
// 所有元件按圆形计算：源/获电处半径 R1，中继器/钥匙点半径 R2，
// 触点外沿 = R2 + 触点长（用于连接线端点计算）
// ============================================================

import type { BarRelayEl, Dir, KeyEl, PipeColor, QuadRelayEl, ReceiverEl, SourceEl } from './types';
import { CONTACT_LEN_RATIO, CORE_OFF, CORE_ON, LINE_OFF, LOCK_OFF, LOCK_ON, PIPE_COLORS, R1, R2, annularSector } from './types';

/** 环形扇区路径（rOut 外半径，rIn 内半径，a0→a1 顺时针） */
const sector = annularSector;

/** 触点路径（朝上，cy 处环外沿 r0，长 len，宽 w，收尾半圆直径 w） */
function contactUp(cx: number, cy: number, r0: number, len: number, w: number): string {
  const top = cy - r0 - len;
  return `M${cx - w / 2},${cy - r0 + w / 4} V${top} A${w / 2},${w / 2} 0 0 1 ${cx + w / 2},${top} V${cy - r0 + w / 4} Z`;
}

const GAP = 4; // 分块之间的角度间隔（度）

// ---------------- 图标 ----------------

export function LightningIcon({ x, y, size, color }: { x: number; y: number; size: number; color: string }) {
  const s = size / 24;
  return (
    <path
      d={`M${x - 2 * s},${y - 11 * s} L${x + 6 * s},${y - 11 * s} L${x + 1 * s},${y - 1 * s} L${x + 8 * s},${y - 1 * s} L${x - 5 * s},${y + 11 * s} L${x - 1 * s},${y + 2 * s} L${x - 8 * s},${y + 2 * s} Z`}
      fill={color}
    />
  );
}

export function KeyIcon({ x, y, size, color }: { x: number; y: number; size: number; color: string }) {
  const s = size / 24;
  return (
    <g stroke={color} strokeWidth={3 * s} fill="none" strokeLinecap="round">
      <circle cx={x - 4 * s} cy={y - 4 * s} r={5 * s} />
      <path d={`M${x},${y} L${x + 8 * s},${y + 8 * s} M${x + 4 * s},${y + 4 * s} L${x + 8 * s},${y + 2 * s} M${x + 6 * s},${y + 6 * s} L${x + 9 * s},${y + 4 * s}`} />
    </g>
  );
}

export function LockIcon({ x, y, size, color }: { x: number; y: number; size: number; color: string }) {
  const s = size / 24;
  return (
    <g>
      <rect x={x - 8 * s} y={y - 2 * s} width={16 * s} height={11 * s} rx={2 * s} fill={color} />
      <path
        d={`M${x - 5 * s},${y - 2 * s} V${y - 6 * s} A${5 * s},${5 * s} 0 0 1 ${x + 5 * s},${y - 6 * s} V${y - 2 * s}`}
        stroke={color}
        strokeWidth={3 * s}
        fill="none"
      />
    </g>
  );
}

// ---------------- 电力源 ----------------

export function SourceTile({ s, el, powered }: { s: number; el: SourceEl; powered: boolean }) {
  const c = s / 2;
  const col = PIPE_COLORS[el.color][powered ? 'on' : 'off'];
  const w = s * 0.055;
  return (
    <g style={{ transition: 'opacity 0.2s' }}>
      <circle cx={c} cy={c} r={R1 * s} fill="none" stroke={col} strokeWidth={w} style={{ transition: 'stroke 0.25s' }} />
      <LightningIcon x={c} y={c} size={R1 * s * 1.1} color={col} />
    </g>
  );
}

// ---------------- 获电处 ----------------

export function ReceiverTile({
  s,
  el,
  lit,
  progress,
  anyPower,
  delay = 0,
}: {
  s: number;
  el: ReceiverEl;
  lit: Set<Dir>;
  progress: number; // 0~1：已通电线数 / 总线数（中环顺时针进度）
  anyPower: boolean; // 任意线已通电（中心圆点变色）
  delay?: number;
}) {
  const c = s / 2;
  const rOut = R1 * s;
  const w = rOut / 3;
  const rMid = rOut - w - s * 0.012;
  const dl = `${delay}ms`;
  return (
    <g>
      {/* 外圈四等分块 */}
      {([0, 1, 2, 3] as Dir[]).map((d) => {
        const on = lit.has(d);
        const col = PIPE_COLORS[el.blocks[d]][on ? 'on' : 'off'];
        return (
          <path
            key={d}
            d={sector(c, c, rOut, rOut - w, d * 90 - 45 + GAP / 2, d * 90 + 45 - GAP / 2)}
            fill={col}
            style={{ transition: `fill 0.25s ${dl}` }}
          />
        );
      })}
      {/* 中环：进度（顺时针，从顶部开始） */}
      <circle cx={c} cy={c} r={rMid - w / 2} fill="none" stroke={CORE_OFF} strokeWidth={w * 0.55} opacity={0.45} />
      <circle
        cx={c}
        cy={c}
        r={rMid - w / 2}
        fill="none"
        stroke={CORE_ON}
        strokeWidth={w * 0.55}
        strokeLinecap="round"
        strokeDasharray={`${progress * 2 * Math.PI * (rMid - w / 2)} ${2 * Math.PI * (rMid - w / 2)}`}
        transform={`rotate(-90 ${c} ${c})`}
        style={{ transition: `stroke-dasharray 0.35s ${dl}` }}
      />
      {/* 中心圆点 */}
      <circle cx={c} cy={c} r={w / 2} fill={anyPower ? CORE_ON : CORE_OFF} style={{ transition: `fill 0.25s ${dl}` }} />
    </g>
  );
}

// ---------------- 条形中继器 ----------------

export function BarTile({
  s,
  el,
  rot,
  on,
  unlocking = false,
  unlocked = false,
  delay = 0,
}: {
  s: number;
  el: BarRelayEl;
  rot: number; // 当前显示朝向（累计值，驱动连续旋转动画）
  on: boolean; // 已通电
  unlocking?: boolean; // 解锁动画中
  unlocked?: boolean; // 已解锁（锁消失，恢复正常大小）
  delay?: number;
}) {
  const c = s / 2;
  const r = R2 * s;
  const locked = el.locked && !unlocked;
  const w = locked ? r / 3 : r / 2; // 上锁时环宽变为半径的三分之一
  const dl = `${delay}ms`;
  return (
    <g
      style={{
        transform: `rotate(${rot * 90}deg)`,
        transformOrigin: `${c}px ${c}px`,
        transition: 'transform 0.22s ease-in-out',
      }}
    >
      {/* 两个半边（触点 0 = 右半边，触点 1 = 左半边），断开处垂直于触点 */}
      {[0, 1].map((i) => (
        <path
          key={i}
          d={sector(c, c, r, r - w, i * 180 + GAP / 2, (i + 1) * 180 - GAP / 2)}
          fill={PIPE_COLORS[el.colors[i as 0 | 1]][on ? 'on' : 'off']}
          style={{ transition: `fill 0.25s ${dl}, d 0.2s` }}
        />
      ))}
      {/* 两个对向触点（局部右、局部左） */}
      {[1, 3].map((d, i) => (
        <path
          key={d}
          d={contactUp(c, c, r, CONTACT_LEN_RATIO * s, w)}
          fill={PIPE_COLORS[el.colors[i as 0 | 1]][on ? 'on' : 'off']}
          transform={`rotate(${d * 90} ${c} ${c})`}
          style={{ transition: `fill 0.25s ${dl}` }}
        />
      ))}
      {/* 锁图标与解锁动画 */}
      {locked && (
        <g
          style={{
            transition: 'transform 0.4s, opacity 0.4s',
            transformOrigin: `${c}px ${c}px`,
            transform: unlocking ? 'scale(1.8)' : 'scale(1)',
            opacity: unlocking ? 0 : 1,
          }}
        >
          <LockIcon x={c} y={c} size={r * 1.1} color={unlocking ? LOCK_ON : LOCK_OFF} />
        </g>
      )}
    </g>
  );
}

// ---------------- 四向形中继器 ----------------

export function QuadTile({
  s,
  el,
  rot,
  on,
  unlocking = false,
  unlocked = false,
  delay = 0,
}: {
  s: number;
  el: QuadRelayEl;
  rot: number;
  on: boolean;
  unlocking?: boolean;
  unlocked?: boolean;
  delay?: number;
}) {
  const c = s / 2;
  const r = R2 * s;
  const locked = el.locked && !unlocked;
  const w = locked ? r / 3 : r / 2;
  const dl = `${delay}ms`;
  return (
    <g
      style={{
        transform: `rotate(${rot * 90}deg)`,
        transformOrigin: `${c}px ${c}px`,
        transition: 'transform 0.22s ease-in-out',
      }}
    >      {/* 四象限块 */}
      {([0, 1, 2, 3] as Dir[]).map((d) => (
        <path
          key={d}
          d={sector(c, c, r, r - w, d * 90 - 45 + GAP / 2, d * 90 + 45 - GAP / 2)}
          fill={PIPE_COLORS[el.blocks[d]][on ? 'on' : 'off']}
          style={{ transition: `fill 0.25s ${dl}` }}
        />
      ))}
      {/* 触点（局部方向） */}
      {el.contacts.map((has, d) =>
        has ? (
          <path
            key={d}
            d={contactUp(c, c, r, CONTACT_LEN_RATIO * s, w)}
            fill={PIPE_COLORS[el.blocks[d]][on ? 'on' : 'off']}
            transform={`rotate(${d * 90} ${c} ${c})`}
            style={{ transition: `fill 0.25s ${dl}` }}
          />
        ) : null,
      )}
      {locked && (
        <g
          style={{
            transition: 'transform 0.4s, opacity 0.4s',
            transformOrigin: `${c}px ${c}px`,
            transform: unlocking ? 'scale(1.8)' : 'scale(1)',
            opacity: unlocking ? 0 : 1,
          }}
        >
          <LockIcon x={c} y={c} size={r * 1.1} color={unlocking ? LOCK_ON : LOCK_OFF} />
        </g>
      )}
    </g>
  );
}

// ---------------- 钥匙点 ----------------

export function KeyTile({ s, el, on, delay = 0 }: { s: number; el: KeyEl; on: boolean; delay?: number }) {
  const c = s / 2;
  const r = R2 * s;
  const w = r / 3;
  const col = PIPE_COLORS[el.color][on ? 'on' : 'off'];
  const dl = `${delay}ms`;
  return (
    <g>
      <circle cx={c} cy={c} r={r - w / 2} fill="none" stroke={col} strokeWidth={w} style={{ transition: `stroke 0.25s ${dl}` }} />
      <path
        d={contactUp(c, c, r, CONTACT_LEN_RATIO * s, w)}
        fill={col}
        transform={`rotate(${el.dir * 90} ${c} ${c})`}
        style={{ transition: `fill 0.25s ${dl}` }}
      />
      <g style={{ transition: `opacity 0.25s ${dl}` }}>
        <KeyIcon x={c} y={c} size={r * 1.1} color={on ? LOCK_ON : LOCK_OFF} />
      </g>
    </g>
  );
}

// ---------------- 连接线 ----------------

export function LineTile({
  x1,
  y1,
  x2,
  y2,
  w,
  colors,
  delay = 0,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  w: number;
  colors: Set<PipeColor>;
  delay?: number;
}) {
  const style = { transition: `stroke 0.3s ${delay}ms` };
  if (colors.size === 0) {
    return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={LINE_OFF} strokeWidth={w} strokeLinecap="round" style={style} />;
  }
  if (colors.size === 1) {
    const col = PIPE_COLORS[[...colors][0]].on;
    return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={col} strokeWidth={w} strokeLinecap="round" style={style} />;
  }
  // 两种颜色：平行双线
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ox = (-dy / len) * (w / 3);
  const oy = (dx / len) * (w / 3);
  return (
    <g>
      {[...colors].map((c, i) => (
        <line
          key={c}
          x1={x1 + (i ? ox : -ox)}
          y1={y1 + (i ? oy : -oy)}
          x2={x2 + (i ? ox : -ox)}
          y2={y2 + (i ? oy : -oy)}
          stroke={PIPE_COLORS[c].on}
          strokeWidth={w / 2}
          strokeLinecap="round"
          style={style}
        />
      ))}
    </g>
  );
}

export { LINE_OFF };
