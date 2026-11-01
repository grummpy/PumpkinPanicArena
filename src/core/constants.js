/** Fixed simulation tick. The UI loop may render faster or slower. */
export const TICK = 1 / 60;

export const ROUND_TIME = 90;
export const DEFAULT_ROUNDS = 3;
export const MIN_ROUNDS = 1;
export const MAX_ROUNDS = 9;

/** Playfield inside the 1280×720 canvas, below the HUD. */
export const ARENA = Object.freeze({ x: 64, y: 96, w: 1152, h: 560 });

export const PLAYER_RADIUS = 22;
export const SPEED = 240;
export const SPEED_MULT = 1.6;
export const CHARGE_SPEED = 560;
export const CHARGE_TIME = 0.18;
export const CHARGE_COOLDOWN = 1.35;
export const BASH_COOLDOWN = 0.4;
export const BASH_REACH = 36;
export const BASH_RADIUS = 26;
export const MEGA_REACH = 52;
export const MEGA_RADIUS = 44;
export const CRATE_SIZE = 40;
export const CRATE_HP = 3;
export const CANDY_RADIUS = 8;
export const CANDY_GRACE = 0.45;
export const POWER_RADIUS = 16;
export const MAGNET_RANGE = 180;
export const MAX_CRATES = 6;
export const MAX_CANDIES = 120;
export const KNOCK_SPEED = 340;
export const STUN_TIME = 0.16;
export const HIT_IMMUNE = 0.28;
export const COUNTDOWN_TIME = 3;
export const BANNER_TIME = 3.2;
export const CRATE_SPAWN_INTERVAL = 2.4;
export const POWER_SPAWN_INTERVAL = 10;

export const COLORS = Object.freeze(["#e23d3d", "#3aa0ff", "#3dce6e", "#ffc83d"]);
export const NAMES = Object.freeze(["P1", "P2", "P3", "P4"]);

export const POWER_TYPES = Object.freeze(["speed", "armor", "magnet", "mega"]);
export const POWER_DURATION = Object.freeze({ speed: 5, armor: 4.5, magnet: 5 });

export const SPAWNS = Object.freeze([
  Object.freeze({ x: ARENA.x + 110, y: ARENA.y + 110 }),
  Object.freeze({ x: ARENA.x + ARENA.w - 110, y: ARENA.y + 110 }),
  Object.freeze({ x: ARENA.x + 110, y: ARENA.y + ARENA.h - 110 }),
  Object.freeze({ x: ARENA.x + ARENA.w - 110, y: ARENA.y + ARENA.h - 110 }),
]);
