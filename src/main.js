import { cloneBinds, mapGamepad, mapKeyboard, resolvePlayerAction } from "./core/input.js";
import { assignBind, createGame, step, TICK } from "./core/sim.js";
import { loadImages } from "./ui/assets.js";
import { createAudio } from "./ui/audio.js";
import { render } from "./ui/render.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const VIEW_W = 1280;
const VIEW_H = 720;

const held = new Set();
const pulsed = new Set();
const images = loadImages();
const audio = createAudio();
const pops = [];

const state = createGame({
  seed: (Date.now() ^ ((Math.random() * 0x100000000) >>> 0)) >>> 0,
});
loadSaved(state);

const padOn = [false, false, false, false];
let lastPersist = "";

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(VIEW_W * dpr);
  canvas.height = Math.round(VIEW_H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function loadSaved(game) {
  try {
    const rawBinds = localStorage.getItem("pumpkinPanic.binds");
    if (rawBinds) {
      const binds = JSON.parse(rawBinds);
      const ok =
        Array.isArray(binds) &&
        binds.length === 4 &&
        binds.every(
          (b) => b && b.up && b.down && b.left && b.right && b.action && b.secondary,
        );
      if (ok) game.binds = cloneBinds(binds);
    }
    const rawSettings = localStorage.getItem("pumpkinPanic.settings");
    if (rawSettings) {
      const settings = JSON.parse(rawSettings);
      if (settings && typeof settings.volume === "number") {
        game.volume = Math.max(0, Math.min(1, settings.volume));
      }
      if (settings && typeof settings.roundsToWin === "number") {
        game.roundsToWin = Math.max(1, Math.min(9, Math.round(settings.roundsToWin)));
      }
      if (settings && typeof settings.muted === "boolean") game.muted = settings.muted;
    }
  } catch {
    /* ignore private-mode and corrupt saves */
  }
}

function persist() {
  const blob = JSON.stringify({
    binds: state.binds,
    volume: state.volume,
    roundsToWin: state.roundsToWin,
    muted: state.muted,
  });
  if (blob === lastPersist) return;
  lastPersist = blob;
  try {
    localStorage.setItem("pumpkinPanic.binds", JSON.stringify(state.binds));
    localStorage.setItem(
      "pumpkinPanic.settings",
      JSON.stringify({
        volume: state.volume,
        roundsToWin: state.roundsToWin,
        muted: state.muted,
      }),
    );
  } catch {
    /* ignore quota / private mode */
  }
}

function readPads() {
  const pads = typeof navigator.getGamepads === "function" ? navigator.getGamepads() : [];
  const out = [null, null, null, null];
  if (!pads) return out;
  for (const pad of pads) {
    if (!pad || !pad.connected) continue;
    if (pad.index >= 0 && pad.index < 4) out[pad.index] = pad;
  }
  return out;
}

function readInputs() {
  const pads = readPads();
  const codes = {
    has(code) {
      return held.has(code) || pulsed.has(code);
    },
  };
  const players = [0, 1, 2, 3].map((i) => {
    const kb = mapKeyboard(codes, state.binds[i]);
    const connected = !!(pads[i] && pads[i].connected);
    padOn[i] = connected;
    const gp = connected ? mapGamepad(pads[i]) : null;
    return resolvePlayerAction(kb, gp, connected);
  });
  const menuUp = codes.has("ArrowUp") || players.some((p) => p.moveY < -0.5);
  const menuDown = codes.has("ArrowDown") || players.some((p) => p.moveY > 0.5);
  const menuLeft = codes.has("ArrowLeft") || players.some((p) => p.moveX < -0.5);
  const menuRight = codes.has("ArrowRight") || players.some((p) => p.moveX > 0.5);
  const confirm = codes.has("Enter");
  const cancel = codes.has("Escape");
  pulsed.clear();
  return {
    players,
    confirm,
    cancel,
    menuUp,
    menuDown,
    menuLeft,
    menuRight,
  };
}

function absorbEvents(events) {
  for (const e of events) {
    if (e.type === "pickup") {
      const p = state.players[e.player];
      pops.push({ x: p.x, y: p.y - 36, text: `+${e.amount}`, life: 0.7, color: "#fff6e0" });
    } else if (e.type === "ko") {
      const p = state.players[e.target];
      pops.push({ x: p.x, y: p.y - 40, text: "KO", life: 0.9, color: "#ffb4a2" });
    } else if (e.type === "power") {
      const p = state.players[e.player];
      const label = { speed: "RUSH", armor: "COAT", magnet: "PULL", mega: "BLAST" }[e.power] || "POWER";
      pops.push({ x: p.x, y: p.y - 48, text: label, life: 0.8, color: "#ffe082" });
    }
  }
}

window.addEventListener("keydown", (event) => {
  if (event.code !== "F5" && event.code !== "F11" && event.code !== "F12") {
    event.preventDefault();
  }
  audio.gesture();
  if (state.capture) {
    if (event.code === "Escape") state.capture = null;
    else assignBind(state, event.code);
    return;
  }
  if (event.code === "KeyM" && !event.repeat) {
    state.muted = !state.muted;
    state.notice = state.muted ? "Muted" : "Sound on";
    state.noticeTimer = 1.2;
  }
  held.add(event.code);
  if (!event.repeat) pulsed.add(event.code);
});

window.addEventListener("keyup", (event) => {
  held.delete(event.code);
});

window.addEventListener("blur", () => {
  held.clear();
});

window.addEventListener("gamepadconnected", (event) => {
  const index = event.gamepad.index;
  if (index >= 0 && index < 4) {
    state.notice = `Gamepad ${index + 1} connected`;
    state.noticeTimer = 2;
  }
});

window.addEventListener("gamepaddisconnected", (event) => {
  const index = event.gamepad.index;
  if (index >= 0 && index < 4) {
    state.notice = `Gamepad ${index + 1} unplugged`;
    state.noticeTimer = 2;
  }
});

canvas.addEventListener("pointerdown", () => {
  canvas.focus();
  audio.gesture();
});

resize();
canvas.focus();
window.addEventListener("resize", resize);

let last = performance.now();
let acc = 0;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  acc += dt;
  if (acc > TICK * 5) acc = TICK * 5;
  const inputs = readInputs();
  const events = [];
  let guard = 0;
  while (acc >= TICK && guard < 5) {
    step(state, inputs);
    if (state.events.length) events.push(...state.events);
    acc -= TICK;
    guard += 1;
  }
  for (const pop of pops) pop.life -= dt;
  while (pops.length && pops[0].life <= 0) pops.shift();
  absorbEvents(events);
  audio.setMuted(state.muted);
  audio.setVolume(state.volume);
  audio.pump();
  audio.handle(events);
  persist();
  render(ctx, state, { pads: padOn, images, pops });
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
