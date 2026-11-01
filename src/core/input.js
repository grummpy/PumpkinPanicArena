/** KeyboardEvent.code bindings. Index 0 is P1. */
export const BIND_ACTIONS = Object.freeze([
  "up",
  "down",
  "left",
  "right",
  "action",
  "secondary",
]);

export const DEFAULT_BINDS = Object.freeze([
  Object.freeze({
    up: "KeyW",
    down: "KeyS",
    left: "KeyA",
    right: "KeyD",
    action: "KeyF",
    secondary: "KeyG",
  }),
  Object.freeze({
    up: "ArrowUp",
    down: "ArrowDown",
    left: "ArrowLeft",
    right: "ArrowRight",
    action: "Slash",
    secondary: "Period",
  }),
  Object.freeze({
    up: "KeyI",
    down: "KeyK",
    left: "KeyJ",
    right: "KeyL",
    action: "Semicolon",
    secondary: "Quote",
  }),
  Object.freeze({
    up: "Numpad8",
    down: "Numpad5",
    left: "Numpad4",
    right: "Numpad6",
    action: "Numpad0",
    secondary: "NumpadEnter",
  }),
]);

export const STICK_DEADZONE = 0.22;

const LABELS = {
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  Slash: "/",
  Period: ".",
  Semicolon: ";",
  Quote: "'",
  Space: "Space",
  Enter: "Enter",
  Escape: "Esc",
  ShiftLeft: "LShift",
  ShiftRight: "RShift",
  ControlLeft: "LCtrl",
  ControlRight: "RCtrl",
  AltLeft: "LAlt",
  AltRight: "RAlt",
  NumpadEnter: "NEnt",
  NumpadAdd: "Num+",
  NumpadSubtract: "Num-",
  NumpadMultiply: "Num*",
  NumpadDivide: "Num/",
  NumpadDecimal: "Num.",
};

/** Human label for a KeyboardEvent.code. */
export function keyLabel(code) {
  if (!code) return "?";
  if (LABELS[code]) return LABELS[code];
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return "N" + code.slice(6);
  return code;
}

function held(codes, code) {
  if (!codes || !code) return false;
  if (typeof codes.has === "function") return codes.has(code);
  return !!codes[code];
}

/**
 * Map a set/map of pressed KeyboardEvent.code values through one player's binds.
 * moveY is negative for up (canvas Y grows downward).
 * action/secondary/pause are level signals, not edges.
 */
export function mapKeyboard(codes, bind) {
  const left = held(codes, bind.left);
  const right = held(codes, bind.right);
  const up = held(codes, bind.up);
  const down = held(codes, bind.down);
  return {
    moveX: (right ? 1 : 0) - (left ? 1 : 0),
    moveY: (down ? 1 : 0) - (up ? 1 : 0),
    action: held(codes, bind.action),
    secondary: held(codes, bind.secondary),
    pause: false,
  };
}

function buttonPressed(buttons, index) {
  const b = buttons && buttons[index];
  if (!b) return false;
  if (typeof b === "object") return !!b.pressed || b.value > 0.5;
  return !!b;
}

/**
 * Standard Gamepad mapping.
 * Left stick and D-pad move, button 0 (A) action, button 1 (B) secondary,
 * button 9 (Start) pause.
 */
export function mapGamepad(pad) {
  const axes = (pad && pad.axes) || [];
  const buttons = (pad && pad.buttons) || [];
  let x = Number(axes[0]) || 0;
  let y = Number(axes[1]) || 0;
  if (Math.abs(x) < STICK_DEADZONE) x = 0;
  if (Math.abs(y) < STICK_DEADZONE) y = 0;
  if (buttonPressed(buttons, 14)) x -= 1;
  if (buttonPressed(buttons, 15)) x += 1;
  if (buttonPressed(buttons, 12)) y -= 1;
  if (buttonPressed(buttons, 13)) y += 1;
  const mag = Math.hypot(x, y);
  if (mag > 1) {
    x /= mag;
    y /= mag;
  }
  return {
    moveX: x,
    moveY: y,
    action: buttonPressed(buttons, 0),
    secondary: buttonPressed(buttons, 1),
    pause: buttonPressed(buttons, 9),
  };
}

/**
 * A connected pad replaces that player's keyboard entirely,
 * even when the stick is sitting in the deadzone.
 */
export function resolvePlayerAction(keyboardAction, gamepadAction, padConnected) {
  if (padConnected && gamepadAction) return gamepadAction;
  return (
    keyboardAction || {
      moveX: 0,
      moveY: 0,
      action: false,
      secondary: false,
      pause: false,
    }
  );
}

export function cloneBinds(binds = DEFAULT_BINDS) {
  return binds.map((b) => ({
    up: b.up,
    down: b.down,
    left: b.left,
    right: b.right,
    action: b.action,
    secondary: b.secondary,
  }));
}
