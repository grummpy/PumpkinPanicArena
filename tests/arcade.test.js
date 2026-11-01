import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

const root = path.resolve(import.meta.dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

test("arcade.json matches the manifest and points at real files", () => {
  const manifest = JSON.parse(read("arcade.json"));
  assert.equal(manifest.name, "Pumpkin Panic Arena");
  assert.equal(manifest.id, "pumpkinpanicarena");
  assert.equal(manifest.players, 4);
  assert.equal(manifest.minPlayers, 1);
  assert.equal(manifest.port, 8801);
  assert.equal(manifest.version, "1.0.0");
  assert.deepEqual(manifest.input, ["keyboard", "gamepad"]);
  assert.equal(manifest.icon, "assets/icon.jpg");
  assert.equal(manifest.cover, "assets/cover.jpg");
  assert.equal(manifest.launch.mac, "./launch-mac.command");
  assert.equal(manifest.launch.windows, "launch-windows.bat");
  assert.equal(manifest.launch.linux, "./launch-linux.sh");
  assert.equal(manifest.launch.web, "index.html");

  for (const rel of [
    manifest.icon,
    manifest.cover,
    manifest.launch.web,
    "launch-mac.command",
    "launch-windows.bat",
    "launch-linux.sh",
    "server.py",
    "src/main.js",
    "docs/BUILD.md",
  ]) {
    assert.equal(fs.existsSync(path.join(root, rel)), true, rel);
  }

  if (process.platform !== "win32") {
    for (const rel of ["launch-mac.command", "launch-linux.sh", "server.py"]) {
      const mode = fs.statSync(path.join(root, rel)).mode;
      assert.ok(mode & 0o111, `${rel} should be executable`);
    }
  }
});

test("launchers detect Python 3 and start the local server", () => {
  for (const rel of ["launch-mac.command", "launch-linux.sh"]) {
    const text = read(rel);
    assert.match(text, /python3/);
    assert.match(text, /server\.py/);
    assert.match(text, /Python 3/);
  }
  const bat = read("launch-windows.bat");
  assert.match(bat, /server\.py/);
  assert.match(bat, /Python 3/);
  assert.match(bat, /py -3/);
  const server = read("server.py");
  assert.match(server, /8801/);
  assert.match(server, /127\.0\.0\.1/);
  assert.match(server, /no-browser|no_browser/);
});

test("the page is a self-contained canvas module with no CDN", () => {
  const html = read("index.html");
  assert.match(html, /Pumpkin Panic Arena/);
  assert.match(html, /<canvas/);
  assert.match(html, /src\/main\.js/);
  assert.doesNotMatch(html, /https?:\/\//);
  const main = read("src/main.js");
  assert.match(main, /requestAnimationFrame/);
  assert.match(main, /TICK/);
  assert.doesNotMatch(main, /https?:\/\//);
  assert.match(read("README.md"), /assets\/cover\.jpg/);
  assert.match(read("README.md"), /MIT/);
});
