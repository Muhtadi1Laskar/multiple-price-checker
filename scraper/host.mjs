// Native messaging host: Chrome starts this process when the side panel opens
// a port, and stops it when the port closes. No server needed.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
process.chdir(here); // so relative paths in your scraper behave like they do from the CLI

// >>> EDIT THIS if needed: the file (relative to this folder) that exports
// >>> scrapeMultipleData. Copy this native-host folder's files into your
// >>> scraper project's root so its node_modules (puppeteer etc.) resolve.
const SCRAPER_MODULE = "./main.js";

/* ---------- Logging ---------- */
// stdout belongs to Chrome's message protocol, so anything a scraper prints
// there would corrupt it. All console output goes to host.log instead.
const LOG_FILE = path.join(here, "host.log");
try { if (fs.statSync(LOG_FILE).size > 512 * 1024) fs.truncateSync(LOG_FILE, 0); } catch { /* no log yet */ }

function log(...args) {
  try {
    const text = args
      .map((a) => (a instanceof Error ? a.stack : typeof a === "string" ? a : JSON.stringify(a)))
      .join(" ");
    fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${text}\n`);
  } catch { /* logging must never crash the host */ }
}

const writeStdout = process.stdout.write.bind(process.stdout);
console.log = console.info = console.debug = console.warn = console.error = (...a) => log(...a);
process.stdout.write = (chunk) => { log(String(chunk).trimEnd()); return true; };

/* ---------- Chrome native messaging framing ---------- */
// Each message: 4-byte length (native byte order) followed by UTF-8 JSON.
const LITTLE = os.endianness() === "LE";
const MAX_REPLY_BYTES = 1024 * 1024 - 1024; // Chrome rejects host messages over 1 MB

function send(obj) {
  const body = Buffer.from(JSON.stringify(obj), "utf8");
  if (body.length > MAX_REPLY_BYTES) {
    return send({ id: obj.id, ok: false, error: "The result was too large to send to Chrome." });
  }
  const header = Buffer.alloc(4);
  LITTLE ? header.writeUInt32LE(body.length, 0) : header.writeUInt32BE(body.length, 0);
  writeStdout(Buffer.concat([header, body]));
}

/* ---------- Scraper ---------- */
let scrapeFn = null;

async function loadScraper() {
  if (scrapeFn) return scrapeFn;
  const mod = await import(pathToFileURL(path.resolve(here, SCRAPER_MODULE)).href);
  if (typeof mod.scrapeMultipleData !== "function") {
    throw new Error(`${SCRAPER_MODULE} doesn't export scrapeMultipleData`);
  }
  scrapeFn = mod.scrapeMultipleData;
  return scrapeFn;
}

async function handle(msg) {
  const id = msg && msg.id;

  if (msg && msg.type === "ping") {
    // Used by install.mjs to check that the scraper module can be loaded.
    try {
      await loadScraper();
      send({ id, ok: true, data: { scraper: "ready" } });
    } catch (err) {
      send({ id, ok: true, data: { scraper: "error", error: err.message } });
    }
    return;
  }

  if (!msg || msg.type !== "compare" || typeof msg.url !== "string") {
    send({ id, ok: false, error: "Unrecognised request." });
    return;
  }

  try {
    const scrape = await loadScraper();
    log("compare:", msg.url);
    const result = await scrape(msg.url);
    // scrapeMultipleData catches errors and returns them instead of throwing
    if (result instanceof Error) throw result;
    send({ id, ok: true, data: result });
  } catch (err) {
    log("compare failed:", err);
    send({ id, ok: false, error: (err && err.message) || String(err) });
  }
}

/* ---------- Read messages from Chrome ---------- */
let buffer = Buffer.alloc(0);

process.stdin.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  while (buffer.length >= 4) {
    const length = LITTLE ? buffer.readUInt32LE(0) : buffer.readUInt32BE(0);
    if (buffer.length < 4 + length) break;
    const body = buffer.subarray(4, 4 + length);
    buffer = buffer.subarray(4 + length);
    let msg;
    try { msg = JSON.parse(body.toString("utf8")); } catch { continue; }
    handle(msg);
  }
});

// Chrome closed the port (panel closed, refresh, or timeout): stop working.
process.stdin.on("end", () => process.exit(0));
process.on("uncaughtException", (err) => { log("uncaughtException:", err); process.exit(1); });
process.on("unhandledRejection", (err) => { log("unhandledRejection:", err); process.exit(1); });
