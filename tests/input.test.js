import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_BINDS,
  keyLabel,
  mapGamepad,
  mapKeyboard,
  resolvePlayerAction,
  STICK_DEADZONE,
} from "../src/core/input.js";

function buttons(pressed = {}) {
  return Array.from({ length: 16 }, (_, i) => ({ pressed: !!pressed[i], value: pressed[i] ? 1 : 0 }));
}

test("default keyboard map covers all four players", () => {
  const cases = [
    [0, ["KeyW"], { moveX: 0, moveY: -1 }],
    [0, ["KeyS"], { moveX: 0, moveY: 1 }],
    [0, ["KeyA"], { moveX: -1, moveY: 0 }],
    [0, ["KeyD"], { moveX: 1, moveY: 0 }],
    [0, ["KeyF"], { action: true }],
    [0, ["KeyG"], { secondary: true }],
    [1, ["ArrowUp"], { moveX: 0, moveY: -1 }],
    [1, ["ArrowDown"], { moveX: 0, moveY: 1 }],
    [1, ["ArrowLeft"], { moveX: -1, moveY: 0 }],
    [1, ["ArrowRight"], { moveX: 1, moveY: 0 }],
    [1, ["Slash"], { action: true }],
    [1, ["Period"], { secondary: true }],
    [2, ["KeyI"], { moveX: 0, moveY: -1 }],
    [2, ["KeyK"], { moveX: 0, moveY: 1 }],
    [2, ["KeyJ"], { moveX: -1, moveY: 0 }],
    [2, ["KeyL"], { moveX: 1, moveY: 0 }],
    [2, ["Semicolon"], { action: true }],
    [2, ["Quote"], { secondary: true }],
    [3, ["Numpad8"], { moveX: 0, moveY: -1 }],
    [3, ["Numpad5"], { moveX: 0, moveY: 1 }],
    [3, ["Numpad4"], { moveX: -1, moveY: 0 }],
    [3, ["Numpad6"], { moveX: 1, moveY: 0 }],
    [3, ["Numpad0"], { action: true }],
    [3, ["NumpadEnter"], { secondary: true }],
  ];
  for (const [player, codes, expect] of cases) {
    const action = mapKeyboard(new Set(codes), DEFAULT_BINDS[player]);
    for (const [key, value] of Object.entries(expect)) {
      assert.equal(action[key], value, `P${player + 1} ${codes.join("+")} ${key}`);
    }
  }
});

test("diagonal keyboard input reports both axes", () => {
  const action = mapKeyboard(new Set(["KeyW", "KeyD"]), DEFAULT_BINDS[0]);
  assert.equal(action.moveX, 1);
  assert.equal(action.moveY, -1);
});

test("custom binds replace the defaults", () => {
  const bind = { ...DEFAULT_BINDS[0], up: "KeyZ", action: "KeyX" };
  const action = mapKeyboard(new Set(["KeyZ", "KeyX"]), bind);
  assert.equal(action.moveY, -1);
  assert.equal(action.action, true);
  assert.equal(mapKeyboard(new Set(["KeyW"]), bind).moveY, 0);
});

test("key labels are readable", () => {
  assert.equal(keyLabel("KeyF"), "F");
  assert.equal(keyLabel("Slash"), "/");
  assert.equal(keyLabel("Period"), ".");
  assert.equal(keyLabel("Semicolon"), ";");
  assert.equal(keyLabel("Quote"), "'");
  assert.equal(keyLabel("Numpad8"), "N8");
  assert.equal(keyLabel("NumpadEnter"), "NEnt");
  assert.equal(keyLabel("ArrowLeft"), "Left");
});

test("gamepad stick, deadzone, d-pad, and face buttons", () => {
  const neutral = mapGamepad({ axes: [STICK_DEADZONE / 2, -STICK_DEADZONE / 2], buttons: buttons() });
  assert.equal(neutral.moveX, 0);
  assert.equal(neutral.moveY, 0);
  assert.equal(neutral.action, false);

  const stick = mapGamepad({ axes: [0.9, -0.8], buttons: buttons() });
  assert.ok(stick.moveX > 0.5);
  assert.ok(stick.moveY < -0.5);

  const dpad = mapGamepad({
    axes: [0, 0],
    buttons: buttons({ 12: true, 15: true }),
  });
  assert.ok(dpad.moveY < 0);
  assert.ok(dpad.moveX > 0);

  const faces = mapGamepad({
    axes: [0, 0],
    buttons: buttons({ 0: true, 1: true, 9: true }),
  });
  assert.equal(faces.action, true);
  assert.equal(faces.secondary, true);
  assert.equal(faces.pause, true);
});

test("a connected gamepad overrides that player's keyboard", () => {
  const kb = mapKeyboard(new Set(["KeyW", "KeyF"]), DEFAULT_BINDS[0]);
  const gp = mapGamepad({ axes: [1, 0], buttons: buttons() });
  const overridden = resolvePlayerAction(kb, gp, true);
  assert.ok(overridden.moveX > 0.5);
  assert.equal(overridden.moveY, 0);
  assert.equal(overridden.action, false);

  const idlePad = mapGamepad({ axes: [0, 0], buttons: buttons() });
  const blocked = resolvePlayerAction(kb, idlePad, true);
  assert.equal(blocked.moveY, 0);
  assert.equal(blocked.action, false);

  const keyboard = resolvePlayerAction(kb, gp, false);
  assert.equal(keyboard.moveY, -1);
  assert.equal(keyboard.action, true);
});
