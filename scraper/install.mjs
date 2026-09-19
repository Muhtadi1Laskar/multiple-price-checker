#!/usr/bin/env node
// One-time setup: registers the native messaging host with Chrome.
//   node install.mjs                  install
//   node install.mjs --uninstall      remove
//   node install.mjs <extension-id>   install for a different extension ID
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HOST_NAME = "com.bookpricecompare.host";
// Derived from the "key" in extension/manifest.json, so it stays the same
// wherever the extension folder lives.
const DEFAULT_EXTENSION_ID = "hffffjpgopjidfoabagfhjmejgeiafpd";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const uninstall = args.includes("--uninstall");
const extensionId = args.find((a) => /^[a-p]{32}$/.test(a)) || DEFAULT_EXTENSION_ID;

const platform = process.platform;
const hostScript = path.join(here, "host.mjs");
const launcher = path.join(here, platform === "win32" ? "host-launcher.bat" : "host-launcher.sh");
const manifestPath = path.join(here, `${HOST_NAME}.json`);

const registryKey = `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${HOST_NAME}`;
const nmDir =
  platform === "darwin"
    ? path.join(os.homedir(), "Library", "Application Support", "Google", "Chrome", "NativeMessagingHosts")
    : path.join(os.homedir(), ".config", "google-chrome", "NativeMessagingHosts");
const registeredManifest = path.join(nmDir, `${HOST_NAME}.json`);

/* ---------- Uninstall ---------- */
if (uninstall) {
  if (platform === "win32") {
    try { execFileSync("reg", ["delete", registryKey, "/f"], { stdio: "ignore" }); } catch { /* not registered */ }
  } else {
    fs.rmSync(registeredManifest, { force: true });
  }
  fs.rmSync(launcher, { force: true });
  fs.rmSync(manifestPath, { force: true });
  console.log("Uninstalled.");
  process.exit(0);
}

/* ---------- Install ---------- */
if (!fs.existsSync(hostScript)) {
  console.error("host.mjs not found next to install.mjs.");
  process.exit(1);
}

// Chrome launches GUI-style without your shell's PATH (nvm etc.), so the
// launcher pins the exact Node binary that is running this installer.
if (platform === "win32") {
  fs.writeFileSync(launcher, `@echo off\r\n"${process.execPath}" "${hostScript}" %*\r\n`);
} else {
  fs.writeFileSync(launcher, `#!/bin/sh\nexec "${process.execPath}" "${hostScript}" "$@"\n`);
  fs.chmodSync(launcher, 0o755);
}

const hostManifest = {
  name: HOST_NAME,
  description: "Book Price Compare scraper",
  path: launcher,
  type: "stdio",
  allowed_origins: [`chrome-extension://${extensionId}/`],
};
fs.writeFileSync(manifestPath, JSON.stringify(hostManifest, null, 2) + "\n");

if (platform === "win32") {
  execFileSync("reg", ["add", registryKey, "/ve", "/t", "REG_SZ", "/d", manifestPath, "/f"], { stdio: "ignore" });
} else {
  fs.mkdirSync(nmDir, { recursive: true });
  fs.copyFileSync(manifestPath, registeredManifest);
}

console.log("Registered native host for Chrome.");
console.log("  Extension ID:", extensionId);
console.log("  Node:        ", process.execPath);

/* ---------- Smoke test ---------- */
function frame(obj) {
  const body = Buffer.from(JSON.stringify(obj), "utf8");
  const header = Buffer.alloc(4);
  os.endianness() === "LE" ? header.writeUInt32LE(body.length, 0) : header.writeUInt32BE(body.length, 0);
  return Buffer.concat([header, body]);
}

function smokeTest() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [hostScript], { stdio: ["pipe", "pipe", "pipe"] });
    let out = Buffer.alloc(0);
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      resolve({ ok: false, error: "Timed out waiting for the helper to answer." });
    }, 15000);

    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (e) => { clearTimeout(timer); resolve({ ok: false, error: e.message }); });
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolve({ ok: false, error: `Helper exited early (code ${code}). ${stderr}`.trim() });
    });
    child.stdout.on("data", (d) => {
      out = Buffer.concat([out, d]);
      if (out.length < 4) return;
      const len = os.endianness() === "LE" ? out.readUInt32LE(0) : out.readUInt32BE(0);
      if (out.length < 4 + len) return;
      clearTimeout(timer);
      child.kill();
      try {
        resolve({ ok: true, reply: JSON.parse(out.subarray(4, 4 + len).toString("utf8")) });
      } catch {
        resolve({ ok: false, error: "Unreadable reply from the helper." });
      }
    });
    child.stdin.write(frame({ id: 1, type: "ping" }));
  });
}

const result = await smokeTest();
if (!result.ok) {
  console.error("\nSelf-test failed:", result.error);
  process.exit(1);
}
const scraper = result.reply && result.reply.data;
if (scraper && scraper.scraper === "ready") {
  console.log("  Scraper:      loaded OK");
  console.log("\nDone. Load (or reload) the extension in chrome://extensions and click its icon.");
} else {
  console.error("\nThe helper runs, but your scraper couldn't be loaded:");
  console.error("  " + (scraper && scraper.error));
  console.error("Fix SCRAPER_MODULE at the top of host.mjs (it must point to the file that exports");
  console.error("scrapeMultipleData), make sure these files sit in your scraper project, then run this again.");
  process.exit(1);
}
