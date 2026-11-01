export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function hypot(x, y) {
  return Math.hypot(x, y);
}

export function circlesOverlap(ax, ay, ar, bx, by, br) {
  const dx = ax - bx;
  const dy = ay - by;
  const r = ar + br;
  return dx * dx + dy * dy < r * r;
}

export function circleRectOverlap(cx, cy, cr, rx, ry, rw, rh) {
  const nx = clamp(cx, rx, rx + rw);
  const ny = clamp(cy, ry, ry + rh);
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < cr * cr;
}

/**
 * Push a circle out of an AABB. Returns the resolved center and whether it hit.
 * Pure: does not mutate.
 */
export function pushCircleFromRect(cx, cy, cr, rx, ry, rw, rh) {
  const closestX = clamp(cx, rx, rx + rw);
  const closestY = clamp(cy, ry, ry + rh);
  let dx = cx - closestX;
  let dy = cy - closestY;
  const d2 = dx * dx + dy * dy;
  if (d2 >= cr * cr) return { x: cx, y: cy, hit: false };
  if (d2 === 0) {
    const left = cx - rx;
    const right = rx + rw - cx;
    const top = cy - ry;
    const bottom = ry + rh - cy;
    const min = Math.min(left, right, top, bottom);
    if (min === left) return { x: rx - cr, y: cy, hit: true };
    if (min === right) return { x: rx + rw + cr, y: cy, hit: true };
    if (min === top) return { x: cx, y: ry - cr, hit: true };
    return { x: cx, y: ry + rh + cr, hit: true };
  }
  const d = Math.sqrt(d2);
  const push = (cr - d) / d;
  return { x: cx + dx * push, y: cy + dy * push, hit: true };
}

/** Separate two circle bodies stored as {x, y, r}. Equal push. */
export function separateCircles(a, b) {
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  const min = a.r + b.r;
  let dist = Math.hypot(dx, dy);
  if (dist >= min) return false;
  if (dist < 1e-6) {
    dx = 1;
    dy = 0;
    dist = 1;
  }
  const push = (min - dist) / 2;
  const nx = dx / dist;
  const ny = dy / dist;
  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;
  return true;
}
