import {
  ARENA,
  BANNER_TIME,
  BASH_COOLDOWN,
  BASH_RADIUS,
  BASH_REACH,
  CANDY_GRACE,
  CANDY_RADIUS,
  CHARGE_COOLDOWN,
  CHARGE_SPEED,
  CHARGE_TIME,
  COLORS,
  COUNTDOWN_TIME,
  CRATE_HP,
  CRATE_SIZE,
  CRATE_SPAWN_INTERVAL,
  DEFAULT_ROUNDS,
  HIT_IMMUNE,
  KNOCK_SPEED,
  MAGNET_RANGE,
  MAX_CANDIES,
  MAX_CRATES,
  MAX_ROUNDS,
  MEGA_RADIUS,
  MEGA_REACH,
  MIN_ROUNDS,
  NAMES,
  PLAYER_RADIUS,
  POWER_DURATION,
  POWER_RADIUS,
  POWER_SPAWN_INTERVAL,
  POWER_TYPES,
  ROUND_TIME,
  SPAWNS,
  SPEED,
  SPEED_MULT,
  STUN_TIME,
  TICK,
} from "./constants.js";
import { decideBot } from "./bots.js";
import { cloneBinds, DEFAULT_BINDS } from "./input.js";
import { clamp, pushCircleFromRect, separateCircles } from "./math.js";
import { createRng, rngInt } from "./rng.js";

export {
  TICK,
  ROUND_TIME,
  ARENA,
  PLAYER_RADIUS,
  SPEED,
  SPEED_MULT,
  DEFAULT_ROUNDS,
  COLORS,
  SPAWNS,
};

const ZERO_INPUT = Object.freeze({
  moveX: 0,
  moveY: 0,
  action: false,
  secondary: false,
  pause: false,
});

function blankEffects() {
  return { speed: 0, armor: 0, magnet: 0, mega: 0 };
}

function makePlayer(id) {
  return {
    id,
    kind: "bot",
    name: NAMES[id],
    color: COLORS[id],
    x: SPAWNS[id].x,
    y: SPAWNS[id].y,
    vx: 0,
    vy: 0,
    r: PLAYER_RADIUS,
    facing: 0,
    candy: 0,
    rounds: 0,
    alive: true,
    bashCd: 0,
    chargeCd: 0,
    charging: 0,
    chargeHit: false,
    stun: 0,
    bashFlash: 0,
    hitImmune: 0,
    effects: blankEffects(),
  };
}

export function createGame(options = {}) {
  const seed = options.seed ?? 1;
  return {
    seed: seed >>> 0,
    rng: createRng(seed),
    phase: "title",
    roundsToWin: clamp(options.roundsToWin ?? DEFAULT_ROUNDS, MIN_ROUNDS, MAX_ROUNDS),
    round: 1,
    timeLeft: ROUND_TIME,
    countdown: 0,
    bannerTimer: 0,
    players: [0, 1, 2, 3].map(makePlayer),
    crates: [],
    candies: [],
    powerups: [],
    spawnTimer: CRATE_SPAWN_INTERVAL,
    powerTimer: 8,
    events: [],
    roundWinner: null,
    matchWinner: null,
    pendingMatch: false,
    volume: clamp(options.volume ?? 0.7, 0, 1),
    muted: !!options.muted,
    binds: cloneBinds(options.binds || DEFAULT_BINDS),
    pausedFrom: "playing",
    settingsReturn: "title",
    menuIndex: 0,
    menuCd: 0,
    capture: null,
    notice: "",
    noticeTimer: 0,
    nextId: 1,
    frame: 0,
    latch: {},
  };
}

function normalize(raw) {
  const src = raw || {};
  const players = [0, 1, 2, 3].map((i) => {
    const p = (src.players && src.players[i]) || {};
    return {
      moveX: Number.isFinite(p.moveX) ? p.moveX : 0,
      moveY: Number.isFinite(p.moveY) ? p.moveY : 0,
      action: !!p.action,
      secondary: !!p.secondary,
      pause: !!p.pause,
    };
  });
  return {
    players,
    confirm: !!src.confirm,
    cancel: !!src.cancel,
    menuUp: !!src.menuUp,
    menuDown: !!src.menuDown,
    menuLeft: !!src.menuLeft,
    menuRight: !!src.menuRight,
  };
}

function rising(state, key, down) {
  const prev = !!state.latch[key];
  state.latch[key] = !!down;
  return !!down && !prev;
}

function notify(state, text, time = 2) {
  state.notice = text;
  state.noticeTimer = time;
}

function participants(state) {
  return state.players.filter((p) => p.kind !== "off");
}

function living(state) {
  return participants(state).filter((p) => p.alive);
}

function arenaCenter() {
  return { x: ARENA.x + ARENA.w / 2, y: ARENA.y + ARENA.h / 2 };
}

function clampToArena(p) {
  const minX = ARENA.x + p.r;
  const maxX = ARENA.x + ARENA.w - p.r;
  const minY = ARENA.y + p.r;
  const maxY = ARENA.y + ARENA.h - p.r;
  if (p.x < minX) {
    p.x = minX;
    p.vx = 0;
  } else if (p.x > maxX) {
    p.x = maxX;
    p.vx = 0;
  }
  if (p.y < minY) {
    p.y = minY;
    p.vy = 0;
  } else if (p.y > maxY) {
    p.y = maxY;
    p.vy = 0;
  }
}

function overlapsSolid(state, x, y, pad) {
  for (const p of state.players) {
    if (p.kind === "off" || !p.alive) continue;
    if (Math.hypot(p.x - x, p.y - y) < p.r + pad) return true;
  }
  for (const c of state.crates) {
    if (Math.hypot(c.x - x, c.y - y) < CRATE_SIZE / 2 + pad) return true;
  }
  for (const u of state.powerups) {
    if (Math.hypot(u.x - x, u.y - y) < POWER_RADIUS + pad) return true;
  }
  return false;
}

function scatter(state, x, y, n) {
  for (let i = 0; i < n; i++) {
    if (state.candies.length >= MAX_CANDIES) return;
    const ang = state.rng() * Math.PI * 2;
    const dist = 22 + state.rng() * 36;
    const speed = 80 + state.rng() * 120;
    state.candies.push({
      x: clamp(x + Math.cos(ang) * dist, ARENA.x + 12, ARENA.x + ARENA.w - 12),
      y: clamp(y + Math.sin(ang) * dist, ARENA.y + 12, ARENA.y + ARENA.h - 12),
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      r: CANDY_RADIUS,
      value: 1,
      grace: CANDY_GRACE,
      tint: i % 5,
    });
  }
}

function spawnCrate(state) {
  for (let attempt = 0; attempt < 16; attempt++) {
    const x = ARENA.x + 90 + state.rng() * (ARENA.w - 180);
    const y = ARENA.y + 90 + state.rng() * (ARENA.h - 180);
    if (overlapsSolid(state, x, y, 36)) continue;
    state.crates.push({
      id: state.nextId++,
      x,
      y,
      size: CRATE_SIZE,
      hp: CRATE_HP,
      tint: rngInt(state.rng, 4),
      flash: 0,
    });
    return true;
  }
  return false;
}

function spawnPowerup(state) {
  if (state.powerups.length >= 2) return false;
  for (let attempt = 0; attempt < 12; attempt++) {
    const x = ARENA.x + 80 + state.rng() * (ARENA.w - 160);
    const y = ARENA.y + 80 + state.rng() * (ARENA.h - 160);
    if (overlapsSolid(state, x, y, 30)) continue;
    state.powerups.push({
      id: state.nextId++,
      type: POWER_TYPES[rngInt(state.rng, POWER_TYPES.length)],
      x,
      y,
      r: POWER_RADIUS,
    });
    return true;
  }
  return false;
}

function setupRound(state) {
  const center = arenaCenter();
  state.crates = [];
  state.candies = [];
  state.powerups = [];
  state.timeLeft = ROUND_TIME;
  state.countdown = COUNTDOWN_TIME;
  state.spawnTimer = 1.2;
  state.powerTimer = 7;
  state.roundWinner = null;
  for (const p of state.players) {
    const spot = SPAWNS[p.id];
    p.x = spot.x;
    p.y = spot.y;
    p.vx = 0;
    p.vy = 0;
    p.candy = 0;
    p.alive = p.kind !== "off";
    p.stun = 0;
    p.bashCd = 0;
    p.chargeCd = 0;
    p.charging = 0;
    p.chargeHit = false;
    p.bashFlash = 0;
    p.hitImmune = 0;
    p.effects = blankEffects();
    p.facing = Math.atan2(center.y - p.y, center.x - p.x);
  }
  const starters = 4 + rngInt(state.rng, 2);
  for (let i = 0; i < starters; i++) spawnCrate(state);
  state.phase = "countdown";
  state.events.push({ type: "countdown", n: 3 });
}

export function beginMatch(state) {
  for (const p of state.players) {
    p.rounds = 0;
    p.candy = 0;
  }
  state.round = 1;
  state.matchWinner = null;
  state.pendingMatch = false;
  setupRound(state);
}

export function resetToTitle(state) {
  state.phase = "title";
  state.round = 1;
  state.matchWinner = null;
  state.pendingMatch = false;
  state.roundWinner = null;
  state.crates = [];
  state.candies = [];
  state.powerups = [];
  state.capture = null;
  state.menuIndex = 0;
  for (const p of state.players) {
    p.kind = "bot";
    p.rounds = 0;
    p.candy = 0;
    p.alive = true;
    p.effects = blankEffects();
    p.charging = 0;
    p.stun = 0;
  }
}

function endRound(state) {
  const alive = living(state);
  let winner = null;
  if (alive.length === 1) {
    winner = alive[0];
  } else if (alive.length > 1) {
    let best = -1;
    const tied = [];
    for (const p of alive) {
      if (p.candy > best) {
        best = p.candy;
        tied.length = 0;
        tied.push(p);
      } else if (p.candy === best) {
        tied.push(p);
      }
    }
    if (tied.length === 1) winner = tied[0];
  }
  if (winner) {
    winner.rounds += 1;
    if (winner.rounds >= state.roundsToWin) state.pendingMatch = true;
  }
  state.roundWinner = winner ? winner.id : null;
  state.phase = "roundEnd";
  state.bannerTimer = BANNER_TIME;
  state.events.push({
    type: winner ? "round" : "draw",
    winner: state.roundWinner,
  });
}

function applyHit(state, attacker, other, mega) {
  if (!other.alive || other.kind === "off" || other.hitImmune > 0) return false;
  other.hitImmune = HIT_IMMUNE;
  const ang = Math.atan2(other.y - attacker.y, other.x - attacker.x);
  const knock = other.effects.armor > 0 ? KNOCK_SPEED * 0.45 : KNOCK_SPEED;
  other.vx = Math.cos(ang) * knock;
  other.vy = Math.sin(ang) * knock;
  other.stun = STUN_TIME;
  if (other.effects.armor > 0) {
    state.events.push({ type: "armor", attacker: attacker.id, target: other.id });
    return true;
  }
  if (other.candy > 0) {
    const dropN = Math.min(other.candy, mega ? 4 : 2);
    other.candy -= dropN;
    scatter(state, other.x, other.y, dropN);
    state.events.push({
      type: "hit",
      attacker: attacker.id,
      target: other.id,
      dropped: dropN,
    });
  } else {
    other.alive = false;
    other.candy = 0;
    other.charging = 0;
    state.events.push({ type: "ko", attacker: attacker.id, target: other.id });
  }
  return true;
}

function hitCircle(state, attacker, x, y, radius, mega) {
  let any = false;
  for (let i = state.crates.length - 1; i >= 0; i--) {
    const crate = state.crates[i];
    const rx = crate.x - crate.size / 2;
    const ry = crate.y - crate.size / 2;
    const closestX = clamp(x, rx, rx + crate.size);
    const closestY = clamp(y, ry, ry + crate.size);
    const dx = x - closestX;
    const dy = y - closestY;
    if (dx * dx + dy * dy > radius * radius) continue;
    crate.hp -= mega ? 2 : 1;
    crate.flash = 0.12;
    any = true;
    if (crate.hp <= 0) {
      const n = 3 + rngInt(state.rng, 3);
      scatter(state, crate.x, crate.y, n);
      state.events.push({ type: "crate", player: attacker.id, x: crate.x, y: crate.y, n });
      state.crates.splice(i, 1);
    }
  }
  for (const other of state.players) {
    if (other === attacker) continue;
    if (Math.hypot(other.x - x, other.y - y) > radius + other.r) continue;
    if (applyHit(state, attacker, other, mega)) any = true;
  }
  return any;
}

function performBash(state, p) {
  const mega = p.effects.mega > 0;
  if (mega) p.effects.mega -= 1;
  p.bashCd = BASH_COOLDOWN;
  p.bashFlash = 0.14;
  const reach = mega ? MEGA_REACH : BASH_REACH;
  const radius = mega ? MEGA_RADIUS : BASH_RADIUS;
  const x = p.x + Math.cos(p.facing) * reach;
  const y = p.y + Math.sin(p.facing) * reach;
  state.events.push({ type: "bash", player: p.id, mega });
  hitCircle(state, p, x, y, radius, mega);
}

function resolveWorld(state) {
  const solids = state.players.filter((p) => p.kind !== "off" && p.alive);
  for (let iter = 0; iter < 2; iter++) {
    for (const p of solids) {
      for (const crate of state.crates) {
        const pushed = pushCircleFromRect(
          p.x,
          p.y,
          p.r,
          crate.x - crate.size / 2,
          crate.y - crate.size / 2,
          crate.size,
          crate.size,
        );
        p.x = pushed.x;
        p.y = pushed.y;
      }
    }
    for (let i = 0; i < solids.length; i++) {
      for (let j = i + 1; j < solids.length; j++) {
        separateCircles(solids[i], solids[j]);
      }
    }
    for (const p of solids) clampToArena(p);
  }
}

function updateKnight(state, p, input) {
  p.bashCd = Math.max(0, p.bashCd - TICK);
  p.chargeCd = Math.max(0, p.chargeCd - TICK);
  p.hitImmune = Math.max(0, p.hitImmune - TICK);
  p.bashFlash = Math.max(0, p.bashFlash - TICK);
  if (p.effects.speed > 0) p.effects.speed = Math.max(0, p.effects.speed - TICK);
  if (p.effects.armor > 0) p.effects.armor = Math.max(0, p.effects.armor - TICK);
  if (p.effects.magnet > 0) p.effects.magnet = Math.max(0, p.effects.magnet - TICK);

  if (p.kind === "off" || !p.alive) {
    p.charging = 0;
    p.vx = 0;
    p.vy = 0;
    return;
  }

  const intent = p.kind === "bot" ? decideBot(state, p) : input || ZERO_INPUT;
  let mx = intent.moveX || 0;
  let my = intent.moveY || 0;
  const mag = Math.hypot(mx, my);
  if (mag > 1) {
    mx /= mag;
    my /= mag;
  }
  if (mag > 0.2) p.facing = Math.atan2(my, mx);

  if (p.stun > 0) {
    p.stun -= TICK;
  } else if (intent.secondary && p.chargeCd <= 0 && p.charging <= 0) {
    p.charging = CHARGE_TIME;
    p.chargeCd = CHARGE_COOLDOWN;
    p.chargeHit = false;
    state.events.push({ type: "charge", player: p.id });
  }

  if (p.stun > 0) {
    p.vx *= 0.82;
    p.vy *= 0.82;
  } else if (p.charging > 0) {
    p.vx = Math.cos(p.facing) * CHARGE_SPEED;
    p.vy = Math.sin(p.facing) * CHARGE_SPEED;
    p.charging -= TICK;
    if (p.charging < 0) p.charging = 0;
  } else {
    const speed = SPEED * (p.effects.speed > 0 ? SPEED_MULT : 1);
    p.vx = mx * speed;
    p.vy = my * speed;
  }

  p.x += p.vx * TICK;
  p.y += p.vy * TICK;

  if (p.charging > 0 && !p.chargeHit) {
    if (hitCircle(state, p, p.x, p.y, p.r + 14, false)) p.chargeHit = true;
  }

  if (intent.action && p.bashCd <= 0 && p.stun <= 0) {
    performBash(state, p);
  }
}

function updateCandies(state) {
  const minX = ARENA.x + CANDY_RADIUS;
  const maxX = ARENA.x + ARENA.w - CANDY_RADIUS;
  const minY = ARENA.y + CANDY_RADIUS;
  const maxY = ARENA.y + ARENA.h - CANDY_RADIUS;
  const next = [];
  for (const candy of state.candies) {
    if (candy.grace > 0) candy.grace -= TICK;
    let pull = null;
    let pullD = MAGNET_RANGE;
    if (candy.grace <= 0) {
      for (const p of state.players) {
        if (!p.alive || p.kind === "off" || p.effects.magnet <= 0) continue;
        const d = Math.hypot(p.x - candy.x, p.y - candy.y);
        if (d < pullD) {
          pull = p;
          pullD = d;
        }
      }
    }
    if (pull && pullD > 1) {
      candy.vx += ((pull.x - candy.x) / pullD) * 920 * TICK;
      candy.vy += ((pull.y - candy.y) / pullD) * 920 * TICK;
    }
    candy.x += candy.vx * TICK;
    candy.y += candy.vy * TICK;
    candy.vx *= 0.96;
    candy.vy *= 0.96;
    if (candy.x < minX) {
      candy.x = minX;
      candy.vx = Math.abs(candy.vx);
    } else if (candy.x > maxX) {
      candy.x = maxX;
      candy.vx = -Math.abs(candy.vx);
    }
    if (candy.y < minY) {
      candy.y = minY;
      candy.vy = Math.abs(candy.vy);
    } else if (candy.y > maxY) {
      candy.y = maxY;
      candy.vy = -Math.abs(candy.vy);
    }
    if (candy.grace > 0) {
      next.push(candy);
      continue;
    }
    let owner = null;
    for (const p of state.players) {
      if (!p.alive || p.kind === "off") continue;
      if (Math.hypot(p.x - candy.x, p.y - candy.y) <= p.r + candy.r) {
        owner = p;
        break;
      }
    }
    if (owner) {
      owner.candy += candy.value;
      state.events.push({ type: "pickup", player: owner.id, amount: candy.value });
    } else {
      next.push(candy);
    }
  }
  state.candies = next;
}

function updatePowerups(state) {
  const next = [];
  for (const item of state.powerups) {
    let owner = null;
    for (const p of state.players) {
      if (!p.alive || p.kind === "off") continue;
      if (Math.hypot(p.x - item.x, p.y - item.y) <= p.r + item.r) {
        owner = p;
        break;
      }
    }
    if (!owner) {
      next.push(item);
      continue;
    }
    if (item.type === "mega") owner.effects.mega += 1;
    else owner.effects[item.type] = Math.max(owner.effects[item.type], POWER_DURATION[item.type]);
    state.events.push({ type: "power", player: owner.id, power: item.type });
  }
  state.powerups = next;
}

function playStep(state, input) {
  for (const crate of state.crates) {
    if (crate.flash > 0) crate.flash = Math.max(0, crate.flash - TICK);
  }
  for (let i = 0; i < state.players.length; i++) {
    updateKnight(state, state.players[i], input.players[i]);
  }
  resolveWorld(state);
  updateCandies(state);
  updatePowerups(state);

  state.spawnTimer -= TICK;
  if (state.spawnTimer <= 0) {
    state.spawnTimer = CRATE_SPAWN_INTERVAL;
    if (state.crates.length < MAX_CRATES) spawnCrate(state);
  }
  state.powerTimer -= TICK;
  if (state.powerTimer <= 0) {
    state.powerTimer = POWER_SPAWN_INTERVAL;
    spawnPowerup(state);
  }

  state.timeLeft -= TICK;
  const group = participants(state);
  const alive = group.filter((p) => p.alive);
  const lastStanding = group.length >= 2 && alive.length <= 1;
  if (state.timeLeft <= 0 || lastStanding) endRound(state);
}

function menuNav(state, input) {
  state.menuCd -= TICK;
  if (state.menuCd > 0) return { x: 0, y: 0 };
  let x = 0;
  let y = 0;
  const stickX = input.players[0].moveX;
  const stickY = input.players[0].moveY;
  if (input.menuRight || stickX > 0.5) x = 1;
  else if (input.menuLeft || stickX < -0.5) x = -1;
  if (input.menuDown || stickY > 0.5) y = 1;
  else if (input.menuUp || stickY < -0.5) y = -1;
  if (x || y) state.menuCd = 0.16;
  return { x, y };
}

function joinStep(state, input, actionEdge, secondaryEdge, confirmEdge, pauseEdge) {
  for (let i = 0; i < 4; i++) {
    const p = state.players[i];
    if (secondaryEdge[i]) {
      if (p.kind === "human") p.kind = "bot";
      else if (p.kind === "bot") p.kind = "off";
      else p.kind = "bot";
    }
    if (actionEdge[i]) p.kind = "human";
  }
  if (confirmEdge || pauseEdge) {
    if (participants(state).length < 1) {
      notify(state, "Turn at least one knight on");
      return;
    }
    beginMatch(state);
  }
}

function countdownStep(state) {
  const before = Math.ceil(state.countdown);
  state.countdown -= TICK;
  if (state.countdown <= 0) {
    state.countdown = 0;
    state.phase = "playing";
    state.events.push({ type: "countdown", n: 0 });
    return;
  }
  const after = Math.ceil(state.countdown);
  if (after !== before) state.events.push({ type: "countdown", n: after });
}

function bannerStep(state, skip) {
  state.bannerTimer -= TICK;
  if (state.bannerTimer > 0 && !skip) return;
  if (state.pendingMatch) {
    state.phase = "matchEnd";
    state.matchWinner = state.roundWinner;
    state.pendingMatch = false;
    state.events.push({ type: "match", winner: state.matchWinner });
    return;
  }
  state.round += 1;
  setupRound(state);
}

function pausedStep(state, input, confirmEdge, cancelEdge, pauseEdge) {
  const nav = menuNav(state, input);
  state.menuIndex = clamp(state.menuIndex + nav.y, 0, 2);
  if (confirmEdge) {
    if (state.menuIndex === 0) state.phase = state.pausedFrom;
    else if (state.menuIndex === 1) openSettings(state, "paused");
    else resetToTitle(state);
    return;
  }
  if (cancelEdge || pauseEdge) state.phase = state.pausedFrom;
}

function openSettings(state, ret) {
  state.settingsReturn = ret;
  state.phase = "settings";
  state.menuIndex = 0;
  state.menuCd = 0.18;
}

function settingsStep(state, input, confirmEdge, cancelEdge) {
  const nav = menuNav(state, input);
  state.menuIndex = clamp(state.menuIndex + nav.y, 0, 3);
  if (state.menuIndex === 0 && nav.x) {
    state.volume = Math.round(clamp(state.volume + nav.x * 0.1, 0, 1) * 10) / 10;
    state.events.push({ type: "ui" });
  }
  if (state.menuIndex === 1 && nav.x) {
    state.roundsToWin = clamp(state.roundsToWin + nav.x, MIN_ROUNDS, MAX_ROUNDS);
    state.events.push({ type: "ui" });
  }
  if (confirmEdge) {
    if (state.menuIndex === 2) {
      state.phase = "controls";
      state.menuIndex = 0;
      state.menuCd = 0.18;
      state.capture = null;
    } else if (state.menuIndex === 3) {
      state.phase = state.settingsReturn;
      state.menuIndex = 0;
    }
  }
  if (cancelEdge) {
    state.phase = state.settingsReturn;
    state.menuIndex = 0;
    state.capture = null;
  }
}

const BIND_ACTIONS = ["up", "down", "left", "right", "action", "secondary"];

function controlsStep(state, input, confirmEdge, cancelEdge) {
  if (state.capture) {
    if (cancelEdge) state.capture = null;
    return;
  }
  const nav = menuNav(state, input);
  const count = BIND_ACTIONS.length * 4;
  state.menuIndex = (state.menuIndex + nav.y + count) % count;
  if (nav.x) {
    state.menuIndex = (state.menuIndex + nav.x * BIND_ACTIONS.length + count) % count;
  }
  if (confirmEdge) {
    const player = Math.floor(state.menuIndex / BIND_ACTIONS.length);
    const action = BIND_ACTIONS[state.menuIndex % BIND_ACTIONS.length];
    state.capture = { player, action };
  }
  if (cancelEdge) {
    state.phase = "settings";
    state.menuIndex = 2;
  }
}

function pauseFrom(state) {
  state.pausedFrom = state.phase;
  state.phase = "paused";
  state.menuIndex = 0;
  state.menuCd = 0.18;
}

/**
 * Advance the simulation by one 60 Hz tick.
 * `inputs.players[i]` is a level state: { moveX, moveY, action, secondary, pause }.
 * confirm / cancel / menu* drive menus. Edges are tracked on the state.
 */
export function step(state, raw) {
  const input = normalize(raw);
  state.events = [];
  state.frame += 1;
  if (state.noticeTimer > 0) {
    state.noticeTimer -= TICK;
    if (state.noticeTimer <= 0) state.notice = "";
  }

  const confirmEdge = rising(state, "confirm", input.confirm);
  const cancelEdge = rising(state, "cancel", input.cancel);
  const pauseEdge = rising(
    state,
    "pause",
    input.players.some((p) => p.pause),
  );
  const actionEdge = [0, 1, 2, 3].map((i) =>
    rising(state, "action" + i, input.players[i].action),
  );
  const secondaryEdge = [0, 1, 2, 3].map((i) =>
    rising(state, "secondary" + i, input.players[i].secondary),
  );

  switch (state.phase) {
    case "title":
      if (confirmEdge || pauseEdge) state.phase = "join";
      else if (cancelEdge) openSettings(state, "title");
      return;
    case "join":
      joinStep(state, input, actionEdge, secondaryEdge, confirmEdge, pauseEdge);
      return;
    case "countdown":
      if (pauseEdge || cancelEdge) {
        pauseFrom(state);
        return;
      }
      countdownStep(state);
      return;
    case "playing":
      if (pauseEdge || cancelEdge) {
        pauseFrom(state);
        return;
      }
      playStep(state, input);
      return;
    case "roundEnd":
      bannerStep(state, confirmEdge || pauseEdge);
      return;
    case "matchEnd":
      if (confirmEdge || pauseEdge) beginMatch(state);
      else if (cancelEdge) resetToTitle(state);
      return;
    case "paused":
      pausedStep(state, input, confirmEdge, cancelEdge, pauseEdge);
      return;
    case "settings":
      settingsStep(state, input, confirmEdge, cancelEdge);
      return;
    case "controls":
      controlsStep(state, input, confirmEdge, cancelEdge);
      return;
    default:
      return;
  }
}

/** While the controls screen is listening, store the next key code. */
export function assignBind(state, code) {
  if (!state.capture || !code) return false;
  const { player, action } = state.capture;
  if (!state.binds[player] || !BIND_ACTIONS.includes(action)) return false;
  state.binds[player][action] = code;
  state.capture = null;
  state.events.push({ type: "ui" });
  return true;
}

export function standings(state) {
  return state.players
    .filter((p) => p.kind !== "off")
    .slice()
    .sort((a, b) => b.rounds - a.rounds || b.candy - a.candy || a.id - b.id);
}
