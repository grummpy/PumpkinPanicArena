import { ARENA } from "../core/constants.js";
import { keyLabel } from "../core/input.js";
import { standings } from "../core/sim.js";

const CANDY_COLORS = ["#ff4d6d", "#4cc9f0", "#80ed99", "#ffd60a", "#c77dff"];
const CRATE_CANDY = ["#ff4d6d", "#4cc9f0", "#80ed99", "#ffd60a"];
const POWER_LABEL = {
  speed: "Sugar Rush",
  armor: "Caramel Coat",
  magnet: "Taffy Pull",
  mega: "Gummy Blast",
};

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function coverBackdrop(ctx, image, w, h, alpha) {
  if (image && image.complete && image.naturalWidth) {
    const iw = image.naturalWidth;
    const ih = image.naturalHeight;
    const scale = Math.max(w / iw, h / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    ctx.drawImage(image, (w - dw) / 2, (h - dh) / 2, dw, dh);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#2a1040");
    g.addColorStop(1, "#140810");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.fillStyle = `rgba(10, 4, 16, ${alpha})`;
  ctx.fillRect(0, 0, w, h);
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = "rgba(18, 8, 28, 0.82)";
  roundRect(ctx, x, y, w, h, 18);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 196, 92, 0.45)";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawArena(ctx) {
  const { x, y, w, h } = ARENA;
  ctx.fillStyle = "#241433";
  ctx.fillRect(x - 18, y - 18, w + 36, h + 36);

  const tile = 48;
  for (let ty = 0; ty < h; ty += tile) {
    for (let tx = 0; tx < w; tx += tile) {
      const alt = ((tx / tile) + (ty / tile)) % 2 === 0;
      ctx.fillStyle = alt ? "#2c1844" : "#341e50";
      ctx.fillRect(x + tx, y + ty, Math.min(tile, w - tx), Math.min(tile, h - ty));
    }
  }

  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = "rgba(209, 107, 255, 0.55)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 92, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const px = Math.cos(a) * 78;
    const py = Math.sin(a) * 78;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = "#ff8c42";
  ctx.lineWidth = 6;
  ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
  ctx.strokeStyle = "rgba(255, 220, 140, 0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 10, y + 10, w - 20, h - 20);

  const posts = [
    [x, y],
    [x + w, y],
    [x, y + h],
    [x + w, y + h],
  ];
  for (const [px, py] of posts) {
    ctx.fillStyle = "#5a3a28";
    ctx.fillRect(px - 8, py - 18, 16, 28);
    ctx.fillStyle = "#ffb703";
    ctx.beginPath();
    ctx.arc(px, py - 22, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 180, 40, 0.18)";
    ctx.beginPath();
    ctx.arc(px, py - 22, 22, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCrate(ctx, crate) {
  const s = crate.size;
  const x = crate.x - s / 2;
  const y = crate.y - s / 2;
  ctx.save();
  if (crate.flash > 0) {
    ctx.shadowColor = "#fff";
    ctx.shadowBlur = 12;
  }
  ctx.fillStyle = "#8d5a32";
  ctx.fillRect(x, y, s, s);
  ctx.strokeStyle = "#4e2e16";
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 1.5, y + 1.5, s - 3, s - 3);
  ctx.strokeStyle = "#c48a52";
  ctx.beginPath();
  ctx.moveTo(x + 6, y + s / 2);
  ctx.lineTo(x + s - 6, y + s / 2);
  ctx.moveTo(x + s / 2, y + 6);
  ctx.lineTo(x + s / 2, y + s - 6);
  ctx.stroke();
  ctx.fillStyle = CRATE_CANDY[crate.tint % 4];
  ctx.fillRect(x + 8, y + 8, 8, 8);
  ctx.fillRect(x + s - 16, y + s - 16, 8, 8);
  if (crate.hp < 3) {
    ctx.strokeStyle = "#2a1208";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 10, y + 12);
    ctx.lineTo(x + s - 8, y + s - 10);
    if (crate.hp < 2) {
      ctx.moveTo(x + s - 12, y + 10);
      ctx.lineTo(x + 12, y + s - 8);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawCandy(ctx, candy) {
  ctx.save();
  ctx.translate(candy.x, candy.y);
  ctx.fillStyle = CANDY_COLORS[candy.tint % CANDY_COLORS.length];
  ctx.beginPath();
  ctx.ellipse(0, 0, 9, 6, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillRect(-2, -5, 3, 10);
  ctx.restore();
}

function drawPowerup(ctx, item, frame) {
  const bob = Math.sin(frame * 0.08 + item.x) * 3;
  ctx.save();
  ctx.translate(item.x, item.y + bob);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(0, 14, 12, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  const colors = {
    speed: "#ffe066",
    armor: "#7ad0ff",
    magnet: "#ff7ad9",
    mega: "#ff9f1c",
  };
  ctx.fillStyle = colors[item.type] || "#fff";
  ctx.beginPath();
  ctx.arc(0, 0, item.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#fff6e0";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#2a1238";
  ctx.font = "700 11px Trebuchet MS, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const mark = { speed: "»", armor: "◆", magnet: "◎", mega: "★" }[item.type] || "?";
  ctx.fillText(mark, 0, 1);
  ctx.restore();
}

function drawKnight(ctx, p) {
  if (p.kind === "off") return;
  const { x, y } = p;
  ctx.save();
  ctx.translate(x, y);
  if (!p.alive) ctx.globalAlpha = 0.45;

  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(0, 16, p.alive ? 16 : 20, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  const fx = Math.cos(p.facing);
  const fy = Math.sin(p.facing);
  const swing = p.bashFlash > 0 ? 0.95 : 0.35;
  const sx = Math.cos(p.facing + swing);
  const sy = Math.sin(p.facing + swing);

  ctx.strokeStyle = p.color;
  ctx.globalAlpha *= 0.85;
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-fx * 6, -fy * 6);
  ctx.lineTo(-fx * 22 - fy * 8, -fy * 22 + fx * 8);
  ctx.stroke();
  ctx.globalAlpha = p.alive ? 1 : 0.45;

  ctx.strokeStyle = "#e7ebf4";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(sx * 12, sy * 12);
  ctx.lineTo(sx * 32, sy * 32);
  ctx.stroke();
  ctx.strokeStyle = "#8d6a33";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(sx * 10, sy * 10);
  ctx.lineTo(sx * 16, sy * 16);
  ctx.stroke();

  if (p.charging > 0) {
    ctx.strokeStyle = "rgba(255, 230, 160, 0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-fx * 10, -fy * 10);
    ctx.lineTo(-fx * 28, -fy * 28);
    ctx.moveTo(-fx * 8 + fy * 6, -fy * 8 - fx * 6);
    ctx.lineTo(-fx * 24 + fy * 6, -fy * 24 - fx * 6);
    ctx.stroke();
  }

  if (p.bashFlash > 0) {
    ctx.strokeStyle = "rgba(255, 236, 170, 0.9)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, p.r + 16, p.facing - 0.9, p.facing + 0.9);
    ctx.stroke();
  }

  const squash = p.alive ? 1 : 0.72;
  ctx.scale(1, squash);
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.arc(0, 0, p.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(-6, 0, p.r - 2, 1.2, 2.2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(6, 0, p.r - 2, 1.0, 2.0);
  ctx.stroke();

  if (p.effects.armor > 0) {
    ctx.strokeStyle = "rgba(140, 220, 255, 0.9)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, p.r + 5, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = "#5b3a8c";
  roundRect(ctx, -14, -p.r - 2, 28, 10, 3);
  ctx.fill();
  ctx.fillStyle = "#3a8f4a";
  ctx.fillRect(-3, -p.r - 10, 6, 8);

  ctx.fillStyle = p.alive ? "#1a0c08" : "#666";
  if (p.alive) {
    ctx.beginPath();
    ctx.moveTo(-9, -4);
    ctx.lineTo(-3, -1);
    ctx.lineTo(-9, 3);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(9, -4);
    ctx.lineTo(3, -1);
    ctx.lineTo(9, 3);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-5, 7);
    ctx.lineTo(0, 10);
    ctx.lineTo(5, 7);
    ctx.lineTo(3, 9);
    ctx.lineTo(0, 8);
    ctx.lineTo(-3, 9);
    ctx.fill();
  } else {
    ctx.strokeStyle = "#1a0c08";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, -4);
    ctx.lineTo(-2, 2);
    ctx.moveTo(-2, -4);
    ctx.lineTo(-8, 2);
    ctx.moveTo(2, -4);
    ctx.lineTo(8, 2);
    ctx.moveTo(8, -4);
    ctx.lineTo(2, 2);
    ctx.stroke();
  }
  ctx.restore();

  ctx.fillStyle = "#fff6e0";
  ctx.font = "700 13px Trebuchet MS, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  const tag = p.alive ? `${p.name}  ${p.candy}` : `${p.name}  KO`;
  ctx.fillText(tag, x, y - p.r - 14);

  const icons = [];
  if (p.effects.speed > 0) icons.push("»");
  if (p.effects.armor > 0) icons.push("◆");
  if (p.effects.magnet > 0) icons.push("◎");
  if (p.effects.mega > 0) icons.push("★");
  if (icons.length) {
    ctx.font = "12px Trebuchet MS, sans-serif";
    ctx.fillStyle = "#ffe082";
    ctx.textBaseline = "top";
    ctx.fillText(icons.join(" "), x, y + p.r + 4);
  }
}

function drawHud(ctx, state, extras) {
  const w = 1280;
  ctx.fillStyle = "rgba(12, 6, 18, 0.88)";
  ctx.fillRect(0, 0, w, 86);

  state.players.forEach((p, i) => {
    const x = 16 + i * 230;
    ctx.fillStyle = p.kind === "off" ? "#3a3148" : p.color;
    roundRect(ctx, x, 12, 214, 62, 10);
    ctx.fill();
    ctx.fillStyle = "#1a0c14";
    ctx.font = "700 16px Trebuchet MS, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const role = p.kind === "human" ? "YOU" : p.kind === "bot" ? "BOT" : "OFF";
    ctx.fillText(`${p.name}  ${role}`, x + 12, 18);
    ctx.font = "700 22px Trebuchet MS, sans-serif";
    ctx.fillText(p.kind === "off" ? "—" : String(p.candy), x + 12, 40);
    ctx.font = "12px Trebuchet MS, sans-serif";
    ctx.fillText("candy", x + 48, 48);
    for (let r = 0; r < state.roundsToWin; r++) {
      ctx.beginPath();
      ctx.arc(x + 150 + r * 14, 32, 5, 0, Math.PI * 2);
      ctx.fillStyle = r < p.rounds ? "#1a0c14" : "rgba(0,0,0,0.25)";
      ctx.fill();
    }
    if (extras.pads && extras.pads[i]) {
      drawPadIcon(ctx, x + 188, 48);
    }
  });

  if (state.muted) {
    ctx.fillStyle = "#ffb4a2";
    ctx.font = "700 14px Trebuchet MS, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText("MUTE", 1088, 32);
  }

  const secs = Math.max(0, Math.ceil(state.timeLeft));
  const mm = String(Math.floor(secs / 60));
  const ss = String(secs % 60).padStart(2, "0");
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillStyle = secs <= 10 && state.phase === "playing" ? "#ffb4a2" : "#fff6e0";
  ctx.font = "700 26px Trebuchet MS, sans-serif";
  ctx.fillText(`${mm}:${ss}`, 1264, 32);
  ctx.fillStyle = "#ffd56a";
  ctx.font = "700 14px Trebuchet MS, sans-serif";
  ctx.fillText(`ROUND ${state.round}`, 1264, 58);
}

function drawPadIcon(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#1a0c14";
  roundRect(ctx, -11, -7, 22, 14, 4);
  ctx.fill();
  ctx.fillStyle = "#fff6e0";
  ctx.fillRect(-7, -2, 2, 2);
  ctx.fillRect(-5, -4, 2, 6);
  ctx.beginPath();
  ctx.arc(4, -2, 1.4, 0, Math.PI * 2);
  ctx.arc(7, 1, 1.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawNotice(ctx, state) {
  if (!state.notice) return;
  ctx.fillStyle = "rgba(12, 6, 18, 0.85)";
  ctx.font = "700 20px Trebuchet MS, sans-serif";
  const width = ctx.measureText(state.notice).width + 36;
  roundRect(ctx, 640 - width / 2, 670, width, 36, 10);
  ctx.fill();
  ctx.fillStyle = "#fff6e0";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(state.notice, 640, 688);
}

function drawPops(ctx, pops) {
  if (!pops) return;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 16px Trebuchet MS, sans-serif";
  for (const pop of pops) {
    ctx.globalAlpha = Math.max(0, pop.life);
    ctx.fillStyle = pop.color;
    ctx.fillText(pop.text, pop.x, pop.y);
  }
  ctx.globalAlpha = 1;
  ctx.textBaseline = "alphabetic";
}

function drawTitle(ctx, state, extras) {
  const w = 1280;
  const h = 720;
  coverBackdrop(ctx, extras.images && extras.images.cover, w, h, 0.28);
  panel(ctx, 250, 430, 780, 230);
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffb703";
  ctx.font = "800 72px Trebuchet MS, sans-serif";
  ctx.fillText("PUMPKIN PANIC", 640, 510);
  ctx.fillStyle = "#fff6e0";
  ctx.font = "700 36px Trebuchet MS, sans-serif";
  ctx.fillText("ARENA", 640, 558);
  ctx.font = "20px Trebuchet MS, sans-serif";
  ctx.fillStyle = "#f0d8b0";
  ctx.fillText("Four knights. One pile of candy. Don't get caught empty.", 640, 598);
  const blink = Math.floor(state.frame / 30) % 2 === 0;
  ctx.fillStyle = blink ? "#ffe082" : "#c98b3c";
  ctx.font = "700 24px Trebuchet MS, sans-serif";
  ctx.fillText("Press Enter  or  Start", 640, 638);
  ctx.font = "16px Trebuchet MS, sans-serif";
  ctx.fillStyle = "#d7c4a4";
  ctx.fillText("Esc  settings", 640, 668);
}

function controlHint(bind) {
  return `${keyLabel(bind.up)} ${keyLabel(bind.left)} ${keyLabel(bind.down)} ${keyLabel(bind.right)}    ${keyLabel(bind.action)} bash    ${keyLabel(bind.secondary)} charge`;
}

function drawJoin(ctx, state, extras) {
  coverBackdrop(ctx, extras.images && extras.images.cover, 1280, 720, 0.62);
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffd56a";
  ctx.font = "800 48px Trebuchet MS, sans-serif";
  ctx.fillText("Choose your knights", 640, 78);
  ctx.font = "18px Trebuchet MS, sans-serif";
  ctx.fillStyle = "#fff6e0";
  ctx.fillText("Action joins  ·  Secondary cycles Bot / Off  ·  Enter or Start begins", 640, 114);

  state.players.forEach((p, i) => {
    const x = 70 + i * 300;
    const y = 170;
    panel(ctx, x, y, 270, 380);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(x + 135, y + 110, 48, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2a1208";
    ctx.beginPath();
    ctx.ellipse(x + 118, y + 104, 7, 9, -0.2, 0, Math.PI * 2);
    ctx.ellipse(x + 152, y + 104, 7, 9, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#2a1208";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x + 135, y + 118, 12, 0.2, Math.PI - 0.2);
    ctx.stroke();
    ctx.fillStyle = "#fff6e0";
    ctx.font = "800 28px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(p.name, x + 135, y + 200);
    const status = p.kind === "human" ? "HUMAN" : p.kind === "bot" ? "BOT" : "OFF";
    ctx.fillStyle = p.kind === "off" ? "#b9a89a" : "#ffd56a";
    ctx.font = "700 22px Trebuchet MS, sans-serif";
    ctx.fillText(status, x + 135, y + 240);
    ctx.fillStyle = "#f0e0cc";
    ctx.font = "16px Trebuchet MS, sans-serif";
    const lines = wrap(ctx, controlHint(state.binds[i]), 230);
    lines.forEach((line, li) => ctx.fillText(line, x + 135, y + 290 + li * 22));
    if (extras.pads && extras.pads[i]) {
      ctx.fillStyle = "#9be7ff";
      ctx.fillText("Gamepad connected", x + 135, y + 350);
    }
  });
  drawNotice(ctx, state);
}

function wrap(ctx, text, max) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = trial;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawBanner(ctx, state) {
  ctx.fillStyle = "rgba(8, 2, 14, 0.55)";
  ctx.fillRect(0, 0, 1280, 720);
  panel(ctx, 280, 230, 720, 240);
  ctx.textAlign = "center";
  const winner = state.roundWinner == null ? null : state.players[state.roundWinner];
  ctx.fillStyle = winner ? winner.color : "#fff6e0";
  ctx.font = "800 54px Trebuchet MS, sans-serif";
  ctx.fillText(winner ? `${winner.name} TAKES THE ROUND` : "DRAW", 640, 330);
  ctx.fillStyle = "#fff6e0";
  ctx.font = "22px Trebuchet MS, sans-serif";
  if (winner) {
    ctx.fillText(`${winner.rounds}  /  ${state.roundsToWin} rounds`, 640, 380);
  } else {
    ctx.fillText("Most candy was tied. Nobody scores the round.", 640, 380);
  }
  ctx.fillStyle = "#ffd56a";
  ctx.font = "18px Trebuchet MS, sans-serif";
  ctx.fillText(state.pendingMatch ? "Match point…" : "Enter to continue", 640, 430);
}

function drawMatch(ctx, state) {
  ctx.fillStyle = "#140810";
  ctx.fillRect(0, 0, 1280, 720);
  const winner = state.matchWinner == null ? null : state.players[state.matchWinner];
  ctx.textAlign = "center";
  ctx.fillStyle = winner ? winner.color : "#fff6e0";
  ctx.font = "800 64px Trebuchet MS, sans-serif";
  ctx.fillText(winner ? `${winner.name} WINS THE MATCH` : "MATCH OVER", 640, 120);
  ctx.font = "22px Trebuchet MS, sans-serif";
  ctx.fillStyle = "#f0d8b0";
  ctx.fillText("Standings", 640, 170);

  const rows = standings(state);
  rows.forEach((p, i) => {
    const y = 220 + i * 78;
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    roundRect(ctx, 340, y, 600, 64, 12);
    ctx.fill();
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(390, y + 32, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff6e0";
    ctx.textAlign = "left";
    ctx.font = "700 28px Trebuchet MS, sans-serif";
    ctx.fillText(`${i + 1}.  ${p.name}`, 430, y + 42);
    ctx.textAlign = "right";
    ctx.fillText(`${p.rounds} rounds`, 910, y + 42);
  });

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffd56a";
  ctx.font = "20px Trebuchet MS, sans-serif";
  ctx.fillText("Enter or Start  rematch     Esc  title", 640, 660);
}

function menuList(ctx, title, items, index, x, y, w) {
  panel(ctx, x, y, w, 86 + items.length * 54);
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffd56a";
  ctx.font = "800 32px Trebuchet MS, sans-serif";
  ctx.fillText(title, x + w / 2, y + 48);
  items.forEach((item, i) => {
    const iy = y + 78 + i * 54;
    if (i === index) {
      ctx.fillStyle = "rgba(255, 183, 3, 0.18)";
      roundRect(ctx, x + 24, iy, w - 48, 44, 10);
      ctx.fill();
    }
    ctx.fillStyle = i === index ? "#fff6e0" : "#d9cbb8";
    ctx.font = "700 22px Trebuchet MS, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(item.label, x + 48, iy + 30);
    if (item.value != null) {
      ctx.textAlign = "right";
      ctx.fillText(String(item.value), x + w - 48, iy + 30);
    }
  });
}

function drawPause(ctx, state) {
  ctx.fillStyle = "rgba(8, 2, 14, 0.55)";
  ctx.fillRect(0, 0, 1280, 720);
  menuList(
    ctx,
    "Paused",
    [
      { label: "Resume" },
      { label: "Settings" },
      { label: "Quit to title" },
    ],
    state.menuIndex,
    390,
    180,
    500,
  );
  ctx.textAlign = "center";
  ctx.fillStyle = "#f0d8b0";
  ctx.font = "16px Trebuchet MS, sans-serif";
  ctx.fillText("Enter selects   ·   Esc or Start resumes   ·   M mutes", 640, 560);
  ctx.fillText(`Seed ${state.seed}`, 640, 588);
}

function drawSettings(ctx, state) {
  const dim = state.settingsReturn === "title";
  if (dim) coverBackdrop(ctx, null, 1280, 720, 0.2);
  else {
    ctx.fillStyle = "rgba(8, 2, 14, 0.55)";
    ctx.fillRect(0, 0, 1280, 720);
  }
  menuList(
    ctx,
    "Settings",
    [
      { label: "Volume", value: state.muted ? "muted" : `${Math.round(state.volume * 100)}%` },
      { label: "Rounds to win", value: state.roundsToWin },
      { label: "Controls" },
      { label: "Back" },
    ],
    state.menuIndex,
    360,
    150,
    560,
  );
  ctx.textAlign = "center";
  ctx.fillStyle = "#f0d8b0";
  ctx.font = "16px Trebuchet MS, sans-serif";
  ctx.fillText("Left / Right adjust   ·   Enter opens   ·   Esc back   ·   M mutes", 640, 600);
}

function drawControls(ctx, state) {
  ctx.fillStyle = "rgba(8, 2, 14, 0.72)";
  ctx.fillRect(0, 0, 1280, 720);
  panel(ctx, 80, 40, 1120, 640);
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffd56a";
  ctx.font = "800 32px Trebuchet MS, sans-serif";
  ctx.fillText("Keyboard controls", 640, 86);
  ctx.font = "16px Trebuchet MS, sans-serif";
  ctx.fillStyle = "#f0d8b0";
  ctx.fillText("Enter to rebind the highlighted key. Gamepads stay on stick, A, B, and Start.", 640, 118);

  const actions = ["up", "down", "left", "right", "action", "secondary"];
  const headers = ["Up", "Down", "Left", "Right", "Bash", "Charge"];
  actions.forEach((action, col) => {
    ctx.fillStyle = "#ffd56a";
    ctx.font = "700 16px Trebuchet MS, sans-serif";
    ctx.fillText(headers[col], 360 + col * 140, 170);
  });

  state.players.forEach((p, row) => {
    const y = 200 + row * 100;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(140, y + 24, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff6e0";
    ctx.font = "700 20px Trebuchet MS, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(p.name, 168, y + 30);
    actions.forEach((action, col) => {
      const index = row * actions.length + col;
      const selected = state.menuIndex === index;
      const listening = state.capture && state.capture.player === row && state.capture.action === action;
      const x = 300 + col * 140;
      ctx.fillStyle = listening ? "rgba(255, 80, 80, 0.35)" : selected ? "rgba(255, 183, 3, 0.2)" : "rgba(255,255,255,0.05)";
      roundRect(ctx, x, y, 120, 48, 8);
      ctx.fill();
      ctx.fillStyle = "#fff6e0";
      ctx.font = "700 18px Trebuchet MS, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(listening ? "Press key" : keyLabel(state.binds[row][action]), x + 60, y + 31);
    });
  });

  ctx.textAlign = "center";
  ctx.fillStyle = "#f0d8b0";
  ctx.font = "16px Trebuchet MS, sans-serif";
  ctx.fillText("Saved in this browser. Esc steps back.", 640, 650);
}

function drawPlayfield(ctx, state, extras) {
  ctx.fillStyle = "#140810";
  ctx.fillRect(0, 0, 1280, 720);
  drawArena(ctx);
  for (const crate of state.crates) drawCrate(ctx, crate);
  for (const candy of state.candies) drawCandy(ctx, candy);
  for (const item of state.powerups) drawPowerup(ctx, item, state.frame);
  for (const p of state.players) drawKnight(ctx, p);
  drawHud(ctx, state, extras);
  drawPops(ctx, extras.pops);
  if (state.phase === "countdown") {
    const n = Math.ceil(state.countdown);
    ctx.fillStyle = "rgba(8, 2, 14, 0.35)";
    ctx.fillRect(0, 160, 1280, 400);
    ctx.fillStyle = "#fff6e0";
    ctx.font = "800 140px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(n > 0 ? String(n) : "GO", 640, 380);
    ctx.textBaseline = "alphabetic";
  }
  drawNotice(ctx, state);
}

export function render(ctx, state, extras = {}) {
  const phase = state.phase;
  if (phase === "title") {
    drawTitle(ctx, state, extras);
    return;
  }
  if (phase === "join") {
    drawJoin(ctx, state, extras);
    return;
  }
  if (phase === "settings" && state.settingsReturn === "title") {
    drawSettings(ctx, state);
    drawNotice(ctx, state);
    return;
  }
  if (phase === "controls" && state.settingsReturn === "title") {
    drawControls(ctx, state);
    return;
  }

  const showField = phase === "countdown" || phase === "playing" || phase === "paused" || phase === "roundEnd" || phase === "settings" || phase === "controls" || phase === "matchEnd";
  if (showField && phase !== "matchEnd") drawPlayfield(ctx, state, extras);

  if (phase === "roundEnd") drawBanner(ctx, state);
  else if (phase === "matchEnd") drawMatch(ctx, state);
  else if (phase === "paused") drawPause(ctx, state);
  else if (phase === "settings") drawSettings(ctx, state);
  else if (phase === "controls") drawControls(ctx, state);
}
