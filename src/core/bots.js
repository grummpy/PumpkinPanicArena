import { ARENA } from "./constants.js";

const ZERO = Object.freeze({
  moveX: 0,
  moveY: 0,
  action: false,
  secondary: false,
  pause: false,
});

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function toward(player, x, y) {
  const dx = x - player.x;
  const dy = y - player.y;
  const d = Math.hypot(dx, dy) || 1;
  return { moveX: dx / d, moveY: dy / d, d };
}

/**
 * Simple deterministic knight. No RNG — decisions follow from positions.
 * Empty knights prefer crates and loose candy. They only swing at a foe
 * once they are holding candy (so the opening isn't a KO pileup).
 */
export function decideBot(state, player) {
  if (!player.alive || player.kind !== "bot") return ZERO;

  const foes = state.players.filter(
    (p) => p !== player && p.kind !== "off" && p.alive,
  );

  let threat = null;
  let threatD = Infinity;
  let prey = null;
  let preyD = Infinity;
  let rival = null;
  let rivalD = Infinity;
  for (const foe of foes) {
    const d = dist(player.x, player.y, foe.x, foe.y);
    if (player.candy === 0 && foe.candy > 0 && d < threatD) {
      threat = foe;
      threatD = d;
    }
    if (player.candy > 0 && foe.candy === 0 && d < preyD) {
      prey = foe;
      preyD = d;
    }
    if (player.candy > 0 && foe.candy > 0 && d < rivalD) {
      rival = foe;
      rivalD = d;
    }
  }

  if (threat && threatD < 150) {
    const away = toward(player, threat.x, threat.y);
    return {
      moveX: -away.moveX,
      moveY: -away.moveY,
      action: false,
      secondary: false,
      pause: false,
    };
  }

  if (prey && preyD < 230) {
    const aim = toward(player, prey.x, prey.y);
    const close = aim.d < 72;
    return {
      moveX: aim.moveX,
      moveY: aim.moveY,
      action: close,
      secondary: !close && aim.d < 190 && player.chargeCd <= 0 && player.charging <= 0,
      pause: false,
    };
  }

  let candy = null;
  let candyD = Infinity;
  for (let i = 0; i < state.candies.length; i++) {
    const c = state.candies[i];
    if (c.grace > 0.05) continue;
    const d = dist(player.x, player.y, c.x, c.y);
    const bias = ((i + player.id * 3) % 5) * 8;
    if (d + bias < candyD) {
      candy = c;
      candyD = d + bias;
    }
  }
  if (candy && candyD < 300) {
    const aim = toward(player, candy.x, candy.y);
    return { moveX: aim.moveX, moveY: aim.moveY, action: false, secondary: false, pause: false };
  }

  let crate = null;
  let crateD = Infinity;
  for (let i = 0; i < state.crates.length; i++) {
    const c = state.crates[i];
    const d = dist(player.x, player.y, c.x, c.y);
    const bias = ((i + player.id) % Math.max(1, state.crates.length)) * 36;
    if (d + bias < crateD) {
      crate = c;
      crateD = d + bias;
    }
  }
  if (crate) {
    const aim = toward(player, crate.x, crate.y);
    return {
      moveX: aim.moveX,
      moveY: aim.moveY,
      action: aim.d < 74,
      secondary: false,
      pause: false,
    };
  }

  if (rival && rivalD < 260) {
    const aim = toward(player, rival.x, rival.y);
    return {
      moveX: aim.moveX,
      moveY: aim.moveY,
      action: aim.d < 72,
      secondary: aim.d > 90 && aim.d < 200 && player.chargeCd <= 0,
      pause: false,
    };
  }

  const cx = ARENA.x + ARENA.w / 2;
  const cy = ARENA.y + ARENA.h / 2;
  const ang = state.frame * 0.008 + player.id * (Math.PI / 2);
  const aim = toward(player, cx + Math.cos(ang) * 180, cy + Math.sin(ang) * 120);
  return { moveX: aim.moveX, moveY: aim.moveY, action: false, secondary: false, pause: false };
}
