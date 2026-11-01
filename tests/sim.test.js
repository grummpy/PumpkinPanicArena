import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { ARENA, PLAYER_RADIUS, SPEED, SPEED_MULT } from "../src/core/constants.js";
import { mapKeyboard } from "../src/core/input.js";
import { assignBind, createGame, standings, step } from "../src/core/sim.js";

function freshPlaying(seed = 1) {
  const g = createGame({ seed, roundsToWin: 3 });
  g.phase = "playing";
  g.timeLeft = 90;
  g.countdown = 0;
  g.crates = [];
  g.candies = [];
  g.powerups = [];
  g.spawnTimer = 100;
  g.powerTimer = 100;
  for (const p of g.players) {
    p.kind = "human";
    p.alive = true;
    p.candy = 0;
    p.rounds = 0;
    p.x = 220 + p.id * 200;
    p.y = 360;
    p.vx = 0;
    p.vy = 0;
    p.facing = 0;
    p.stun = 0;
    p.bashCd = 0;
    p.chargeCd = 0;
    p.charging = 0;
    p.hitImmune = 0;
    p.effects = { speed: 0, armor: 0, magnet: 0, mega: 0 };
  }
  return g;
}

function hold(player, fields, frames, game) {
  const players = [{}, {}, {}, {}];
  players[player] = fields;
  for (let i = 0; i < frames; i++) step(game, { players });
}

test("movement stays at the arena edge and diagonal speed is normalized", () => {
  const g = freshPlaying();
  const p = g.players[0];
  p.x = ARENA.x + PLAYER_RADIUS;
  p.y = ARENA.y + 200;
  hold(0, { moveX: -1, moveY: 0 }, 20, g);
  assert.equal(p.x, ARENA.x + PLAYER_RADIUS);

  p.x = ARENA.x + 400;
  p.y = ARENA.y + ARENA.h - PLAYER_RADIUS;
  hold(0, { moveX: 0, moveY: 1 }, 20, g);
  assert.equal(p.y, ARENA.y + ARENA.h - PLAYER_RADIUS);

  const run = freshPlaying();
  const knight = run.players[0];
  const x0 = knight.x;
  const y0 = knight.y;
  hold(0, { moveX: 1, moveY: 1 }, 60, run);
  const traveled = Math.hypot(knight.x - x0, knight.y - y0);
  assert.ok(Math.abs(traveled - SPEED) < 1, `traveled ${traveled}`);
});

test("knights and crates block movement", () => {
  const g = freshPlaying();
  g.players[0].x = 400;
  g.players[0].y = 400;
  g.players[1].x = 420;
  g.players[1].y = 400;
  step(g, {});
  const gap = Math.hypot(g.players[1].x - g.players[0].x, g.players[1].y - g.players[0].y);
  assert.ok(gap >= PLAYER_RADIUS * 2 - 0.01);

  const blocked = freshPlaying();
  for (const other of blocked.players.slice(1)) {
    other.kind = "off";
    other.alive = false;
  }
  const p = blocked.players[0];
  blocked.crates.push({ id: 1, x: 600, y: 360, size: 40, hp: 3, tint: 0, flash: 0 });
  p.x = 600 - 20 - PLAYER_RADIUS - 4;
  p.y = 360;
  hold(0, { moveX: 1, moveY: 0 }, 30, blocked);
  assert.ok(p.x + p.r <= 600 - 20 + 0.2);
});

test("bashing a crate spills candy and bashing a knight knocks candy loose", () => {
  const g = freshPlaying(5);
  const p = g.players[0];
  p.x = 450;
  p.y = 360;
  p.facing = 0;
  g.crates.push({ id: 2, x: 520, y: 360, size: 40, hp: 3, tint: 1, flash: 0 });
  hold(0, { action: true }, 90, g);
  assert.equal(g.crates.length, 0);
  assert.ok(g.candies.length >= 3);

  const fight = freshPlaying(8);
  fight.players[0].x = 400;
  fight.players[0].y = 400;
  fight.players[0].facing = 0;
  fight.players[1].x = 470;
  fight.players[1].y = 400;
  fight.players[1].candy = 5;
  step(fight, { players: [{ action: true }] });
  assert.equal(fight.players[1].candy, 3);
  assert.equal(fight.players[1].alive, true);
  assert.equal(fight.candies.length, 2);

  fight.players[1].candy = 2;
  fight.players[1].hitImmune = 0;
  fight.players[0].bashCd = 0;
  fight.players[0].x = 400;
  fight.players[1].x = 470;
  step(fight, { players: [{ action: true }] });
  assert.equal(fight.players[1].candy, 0);
  assert.equal(fight.players[1].alive, true);
});

test("a knight hit with zero candy is knocked out", () => {
  const g = freshPlaying(4);
  g.players[0].x = 400;
  g.players[0].y = 400;
  g.players[0].facing = 0;
  g.players[0].candy = 1;
  g.players[1].x = 470;
  g.players[1].y = 400;
  g.players[1].candy = 0;
  for (const p of g.players.slice(2)) {
    p.kind = "off";
    p.alive = false;
  }
  step(g, { players: [{ action: true }] });
  assert.equal(g.players[1].alive, false);
  assert.equal(g.phase, "roundEnd");
  assert.equal(g.roundWinner, 0);
  assert.equal(g.players[0].rounds, 1);
});

test("picking up candy increases the score", () => {
  const g = freshPlaying();
  const p = g.players[0];
  g.candies.push({
    x: p.x,
    y: p.y,
    vx: 0,
    vy: 0,
    r: 8,
    value: 1,
    grace: 0,
    tint: 0,
  });
  step(g, {});
  assert.equal(p.candy, 1);
  assert.equal(g.candies.length, 0);
});

test("power-ups: speed, armor, magnet, mega bash, and charge", () => {
  const plain = freshPlaying(2);
  const boosted = freshPlaying(2);
  boosted.players[0].effects.speed = 5;
  hold(0, { moveX: 1 }, 20, plain);
  hold(0, { moveX: 1 }, 20, boosted);
  const plainDx = plain.players[0].x - (220);
  const boostDx = boosted.players[0].x - (220);
  assert.ok(boostDx > plainDx * (SPEED_MULT - 0.15));

  const armored = freshPlaying(6);
  armored.players[0].x = 400;
  armored.players[0].y = 400;
  armored.players[0].facing = 0;
  armored.players[1].x = 470;
  armored.players[1].y = 400;
  armored.players[1].candy = 4;
  armored.players[1].effects.armor = 4;
  step(armored, { players: [{ action: true }] });
  assert.equal(armored.players[1].candy, 4);
  assert.equal(armored.players[1].alive, true);
  assert.equal(armored.candies.length, 0);

  armored.players[1].candy = 0;
  armored.players[1].effects.armor = 4;
  armored.players[1].hitImmune = 0;
  armored.players[0].bashCd = 0;
  armored.players[0].x = 400;
  armored.players[1].x = 470;
  step(armored, { players: [{ action: true }] });
  assert.equal(armored.players[1].alive, true);

  const magnet = freshPlaying(9);
  for (const p of magnet.players) {
    if (p.id !== 0) {
      p.kind = "off";
      p.alive = false;
    }
  }
  magnet.players[0].x = 400;
  magnet.players[0].y = 400;
  magnet.players[0].effects.magnet = 5;
  magnet.candies.push({
    x: 400,
    y: 250,
    vx: 0,
    vy: 0,
    r: 8,
    value: 1,
    grace: 0,
    tint: 2,
  });
  const before = magnet.candies[0].y;
  for (let i = 0; i < 40; i++) step(magnet, {});
  const pulled = magnet.players[0].candy > 0 || magnet.candies.length === 0 || magnet.candies[0].y > before + 8;
  assert.equal(pulled, true);

  const mega = freshPlaying(11);
  mega.players[0].x = 400;
  mega.players[0].y = 400;
  mega.players[0].facing = 0;
  mega.players[0].effects.mega = 1;
  mega.players[1].x = 500;
  mega.players[1].y = 400;
  mega.players[1].candy = 3;
  step(mega, { players: [{ action: true }] });
  assert.ok(mega.players[1].candy < 3);
  assert.equal(mega.players[0].effects.mega, 0);

  const far = freshPlaying(11);
  far.players[0].x = 400;
  far.players[0].y = 400;
  far.players[0].facing = 0;
  far.players[1].x = 500;
  far.players[1].y = 400;
  far.players[1].candy = 3;
  step(far, { players: [{ action: true }] });
  assert.equal(far.players[1].candy, 3);

  const dash = freshPlaying();
  for (const other of dash.players.slice(1)) {
    other.kind = "off";
    other.alive = false;
  }
  const d = dash.players[0];
  d.x = 300;
  d.y = 400;
  d.facing = 0;
  const x0 = d.x;
  step(dash, { players: [{ secondary: true }] });
  for (let i = 0; i < 20; i++) step(dash, {});
  assert.ok(d.x - x0 > 70, `dashed ${d.x - x0}`);

  for (const type of ["speed", "armor", "magnet", "mega"]) {
    const g = freshPlaying(15);
    const p = g.players[0];
    g.powerups.push({ id: 50, type, x: p.x, y: p.y, r: 16 });
    step(g, {});
    assert.equal(g.powerups.length, 0);
    if (type === "mega") assert.ok(p.effects.mega >= 1);
    else assert.ok(p.effects[type] > 1);
  }
});

test("timer awards the round to the knight with the most candy, ties draw", () => {
  const g = freshPlaying();
  g.players[0].candy = 6;
  g.players[1].candy = 2;
  g.players[2].candy = 4;
  g.players[3].candy = 1;
  g.timeLeft = 0.001;
  step(g, {});
  assert.equal(g.phase, "roundEnd");
  assert.equal(g.roundWinner, 0);
  assert.equal(g.players[0].rounds, 1);

  const draw = freshPlaying();
  draw.players[0].candy = 4;
  draw.players[1].candy = 4;
  draw.players[2].kind = "off";
  draw.players[3].kind = "off";
  draw.timeLeft = 0.001;
  step(draw, {});
  assert.equal(draw.phase, "roundEnd");
  assert.equal(draw.roundWinner, null);
  assert.equal(draw.players[0].rounds, 0);
  assert.equal(draw.players[1].rounds, 0);
});

test("one knight left standing ends the round, and first to N rounds wins the match", () => {
  const g = freshPlaying();
  g.players[1].alive = false;
  g.players[2].alive = false;
  g.players[3].alive = false;
  g.players[0].candy = 0;
  step(g, {});
  assert.equal(g.phase, "roundEnd");
  assert.equal(g.roundWinner, 0);

  const solo = freshPlaying();
  for (const p of solo.players.slice(1)) {
    p.kind = "off";
    p.alive = false;
  }
  solo.timeLeft = 20;
  step(solo, {});
  assert.equal(solo.phase, "playing");

  const match = freshPlaying();
  match.roundsToWin = 3;
  for (let round = 0; round < 3; round++) {
    match.phase = "playing";
    match.timeLeft = 0.001;
    match.pendingMatch = false;
    for (const p of match.players) {
      p.kind = "human";
      p.alive = true;
      p.candy = p.id === 1 ? 7 : 1;
    }
    step(match, {});
    assert.equal(match.phase, "roundEnd");
    assert.equal(match.roundWinner, 1);
    match.bannerTimer = 0.001;
    step(match, {});
  }
  assert.equal(match.phase, "matchEnd");
  assert.equal(match.matchWinner, 1);
  assert.equal(match.players[1].rounds, 3);
  const rows = standings(match);
  assert.equal(rows[0].id, 1);
});

test("join flow, bots, settings, and rebinding", () => {
  const g = createGame({ seed: 3 });
  assert.equal(g.phase, "title");
  step(g, { confirm: true });
  assert.equal(g.phase, "join");
  assert.equal(g.players.every((p) => p.kind === "bot"), true);

  step(g, { players: [{ action: true }] });
  assert.equal(g.players[0].kind, "human");
  step(g, { players: [{ secondary: true }] });
  assert.equal(g.players[0].kind, "bot");
  step(g, {});
  step(g, { players: [{ secondary: true }] });
  assert.equal(g.players[0].kind, "off");

  const blocked = createGame({ seed: 4 });
  blocked.phase = "join";
  for (const p of blocked.players) p.kind = "off";
  step(blocked, { confirm: true });
  assert.equal(blocked.phase, "join");
  assert.ok(blocked.notice.length > 0);

  const bots = createGame({ seed: 21 });
  step(bots, { confirm: true });
  step(bots, {});
  step(bots, { confirm: true });
  let guard = 0;
  while (bots.phase !== "playing" && guard++ < 400) step(bots, {});
  assert.equal(bots.phase, "playing");
  const start = bots.players.map((p) => ({ x: p.x, y: p.y }));
  for (let i = 0; i < 90; i++) step(bots, {});
  const moved = bots.players.some(
    (p, i) => Math.abs(p.x - start[i].x) > 5 || Math.abs(p.y - start[i].y) > 5,
  );
  assert.equal(moved, true);

  const settings = createGame({ seed: 1 });
  settings.phase = "settings";
  settings.menuIndex = 0;
  settings.volume = 0.7;
  step(settings, { menuRight: true });
  assert.equal(settings.volume, 0.8);
  settings.menuIndex = 1;
  settings.menuCd = 0;
  const rounds = settings.roundsToWin;
  step(settings, { menuRight: true });
  assert.equal(settings.roundsToWin, rounds + 1);

  const controls = createGame({ seed: 1 });
  controls.phase = "controls";
  controls.menuIndex = 4;
  step(controls, { confirm: true });
  assert.deepEqual(controls.capture, { player: 0, action: "action" });
  assert.equal(assignBind(controls, "KeyZ"), true);
  assert.equal(controls.binds[0].action, "KeyZ");
  assert.equal(controls.capture, null);
  assert.equal(mapKeyboard(new Set(["KeyZ"]), controls.binds[0]).action, true);
});

test("seeded matches with the same inputs stay in lockstep", () => {
  function play(seed) {
    const g = createGame({ seed });
    step(g, { confirm: true });
    step(g, {});
    step(g, { confirm: true });
    for (let i = 0; i < 360; i++) step(g, {});
    return {
      phase: g.phase,
      round: g.round,
      time: Math.round(g.timeLeft * 1000),
      players: g.players.map((p) => ({
        x: Math.round(p.x * 100),
        y: Math.round(p.y * 100),
        candy: p.candy,
        alive: p.alive,
        rounds: p.rounds,
      })),
      crates: g.crates.map((c) => [Math.round(c.x), Math.round(c.y), c.hp]),
      candies: g.candies.map((c) => [Math.round(c.x), Math.round(c.y)]),
      powers: g.powerups.map((c) => [c.type, Math.round(c.x), Math.round(c.y)]),
    };
  }
  const a = play(42);
  const b = play(42);
  assert.deepEqual(a, b);
  const c = play(99);
  assert.notDeepEqual(a, c);
});

test("core modules stay free of DOM, canvas, and audio", () => {
  const dir = path.join(import.meta.dirname, "../src/core");
  const banned = /\b(document|window|localStorage|HTMLCanvasElement|AudioContext|navigator)\b/;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".js")) continue;
    const text = fs.readFileSync(path.join(dir, file), "utf8");
    assert.equal(banned.test(text), false, file);
  }
});
