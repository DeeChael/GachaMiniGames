// ============================================================
// 浮空回收 —— 3D 倾斜棋盘的坐标换算
// 棋盘以 rotateX/rotateY 绕中心倾斜并带 perspective 透视，
// 指针命中最准的做法是把屏幕坐标逆投影回棋盘平面（z=0）。
// 变换链（CSS 语义）：T(c) · P(d) · RX(tiltX) · RY(tiltY) · T(−c)
//   c = 棋盘中心（transform-origin / perspective-origin 均为 50%）
// ============================================================

type Mat4 = number[][];

const mul = (a: Mat4, b: Mat4): Mat4 =>
  a.map((row, i) => row.map((_, j) => a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j] + a[i][3] * b[3][j]));

const translate = (x: number, y: number, z: number): Mat4 => [
  [1, 0, 0, x],
  [0, 1, 0, y],
  [0, 0, 1, z],
  [0, 0, 0, 1],
];

// CSS 坐标系：x 向右，y 向下，z 朝向屏幕外（靠近观察者）
const rotX = (deg: number): Mat4 => {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [
    [1, 0, 0, 0],
    [0, c, -s, 0],
    [0, s, c, 0],
    [0, 0, 0, 1],
  ];
};

const rotY = (deg: number): Mat4 => {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [
    [c, 0, s, 0],
    [0, 1, 0, 0],
    [-s, 0, c, 0],
    [0, 0, 0, 1],
  ];
};

const perspective = (d: number): Mat4 => [
  [1, 0, 0, 0],
  [0, 1, 0, 0],
  [0, 0, 1, 0],
  [0, 0, -1 / d, 1],
];

/** 棋盘平面上的点 (x, y, 0) 投影到屏幕（棋盘容器左上角为原点） */
export function boardPointToScreen(
  x: number,
  y: number,
  tiltX: number,
  tiltY: number,
  board: number,
  persp: number,
): { x: number; y: number } {
  const c = board / 2;
  const M = mul(translate(c, c, 0), mul(perspective(persp), mul(rotX(tiltX), mul(rotY(tiltY), translate(-c, -c, 0)))));
  const w = M[3][0] * x + M[3][1] * y + M[3][3];
  return {
    x: (M[0][0] * x + M[0][1] * y + M[0][3]) / w,
    y: (M[1][0] * x + M[1][1] * y + M[1][3]) / w,
  };
}

/** 屏幕坐标（棋盘容器左上角为原点）逆投影回棋盘平面；无解时返回 null */
export function boardPointFromScreen(
  sx: number,
  sy: number,
  tiltX: number,
  tiltY: number,
  board: number,
  persp: number,
): { x: number; y: number } | null {
  const c = board / 2;
  const M = mul(translate(c, c, 0), mul(perspective(persp), mul(rotX(tiltX), mul(rotY(tiltY), translate(-c, -c, 0)))));
  // sx = (m00·x + m01·y + m03) / (m30·x + m31·y + m33)，sy 同理 → 2×2 线性方程组
  const a = M[0][0] - sx * M[3][0];
  const b = M[0][1] - sx * M[3][1];
  const e1 = sx * M[3][3] - M[0][3];
  const c2 = M[1][0] - sy * M[3][0];
  const d = M[1][1] - sy * M[3][1];
  const e2 = sy * M[3][3] - M[1][3];
  const det = a * d - b * c2;
  if (Math.abs(det) < 1e-9) return null;
  return { x: (e1 * d - b * e2) / det, y: (a * e2 - e1 * c2) / det };
}
