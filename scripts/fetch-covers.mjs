#!/usr/bin/env node
/**
 * fetch-covers.mjs
 * Finds, validates, downloads and patches album cover art.
 *
 * Usage:
 *   node scripts/fetch-covers.mjs                  # fix empty/broken covers
 *   node scripts/fetch-covers.mjs --validate-only  # check only, no downloads
 *   node scripts/fetch-covers.mjs --revalidate-all # HEAD-check ALL external URLs, replace broken
 *
 * Fallback chain: Deezer → iTunes → Last.fm
 * Last.fm API key: set LASTFM_API_KEY in .env.local
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import https from "node:https";
import http from "node:http";

// ── CONFIG ──────────────────────────────────────────────────

const HEAD_CONCURRENCY = 5;
const DL_CONCURRENCY = 3;
const DELAY_MS = 200;
const HEAD_TIMEOUT = 5000;
const MIN_CONTENT_LENGTH = 1000; // bytes — anything smaller is a placeholder/error page
const ALBUMS_PATH = "src/data/albums.ts";
const COVERS_DIR = "public/covers";
const REPORT_PATH = "covers-report.json";
const MISSING_PATH = "covers-missing.txt";

const __filename = fileURLToPath(import.meta.url);
const ROOT = join(dirname(__filename), "..");

const albumsFile = join(ROOT, ALBUMS_PATH);
const coversDir = join(ROOT, COVERS_DIR);
const reportFile = join(ROOT, REPORT_PATH);
const missingFile = join(ROOT, MISSING_PATH);

const VALIDATE_ONLY = process.argv.includes("--validate-only");
const REVALIDATE_ALL = process.argv.includes("--revalidate-all");

// ── .env.local loader ───────────────────────────────────────

function loadEnv() {
  try {
    const envPath = join(ROOT, ".env.local");
    const src = readFileSync(envPath, "utf-8");
    for (const line of src.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {}
}
loadEnv();

const LASTFM_KEY = process.env.LASTFM_API_KEY || "";

// ── HELPERS ─────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isLocalPath(url) {
  return !url || url.startsWith("/");
}

/** Simple GET/HEAD with follow-redirects (up to 5). Returns { status, headers, body? } */
function request(url, method = "GET", { timeout = 15000, maxRedirects = 5 } = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.request(url, { method, timeout }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && maxRedirects > 0) {
        let next = res.headers.location;
        if (next.startsWith("/")) {
          const u = new URL(url);
          next = `${u.protocol}//${u.host}${next}`;
        }
        res.resume();
        return resolve(request(next, method, { timeout, maxRedirects: maxRedirects - 1 }));
      }
      if (method === "HEAD") {
        res.resume();
        return resolve({ status: res.statusCode, headers: res.headers });
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
    req.end();
  });
}

/** Download a URL to a file path. */
async function download(url, dest) {
  return new Promise((resolve, reject) => {
    const follow = (u, redirects = 5) => {
      const lib = u.startsWith("https") ? https : http;
      lib.get(u, { timeout: 30000 }, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects > 0) {
          let next = res.headers.location;
          if (next.startsWith("/")) { const p = new URL(u); next = `${p.protocol}//${p.host}${next}`; }
          res.resume();
          return follow(next, redirects - 1);
        }
        if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
        const ws = createWriteStream(dest);
        pipeline(res, ws).then(() => resolve(true)).catch(reject);
      }).on("error", reject);
    };
    follow(url);
  });
}

/** JSON GET helper */
async function fetchJson(url) {
  const res = await request(url, "GET");
  if (res.status !== 200) return null;
  try { return JSON.parse(res.body.toString("utf-8")); } catch { return null; }
}

// ── PARSE ALBUMS.TS ─────────────────────────────────────────

function parseAlbums() {
  const src = readFileSync(albumsFile, "utf-8");
  const re = /\{\s*id:\s*["`]([^"`]+)["`],\s*artist:\s*["`]([^"`]*)["`],\s*title:\s*["`]([^"`]*)["`],\s*cover:\s*["`]([^"`]*)["`](?:,\s*genre:\s*["`]([^"`]*)["`])?\s*\}/g;
  const albums = [];
  let m;
  while ((m = re.exec(src)) !== null) {
    albums.push({ id: m[1], artist: m[2], title: m[3], cover: m[4], genre: m[5] || "" });
  }
  return albums;
}

// ── COVER SEARCH STRATEGIES ─────────────────────────────────

async function searchDeezer(artist, title) {
  const q = encodeURIComponent(`artist:"${artist}" album:"${title}"`);
  const url = `https://api.deezer.com/search/album?q=${q}&limit=1`;
  try {
    const data = await fetchJson(url);
    const cover = data?.data?.[0]?.cover_xl;
    if (cover && typeof cover === "string") return { url: cover, source: "deezer" };
  } catch {}
  return null;
}

async function searchItunes(artist, title) {
  const term = encodeURIComponent(`${artist} ${title}`);
  const url = `https://itunes.apple.com/search?entity=album&term=${term}&limit=1`;
  try {
    const data = await fetchJson(url);
    const art = data?.results?.[0]?.artworkUrl100;
    if (art && typeof art === "string") {
      return { url: art.replace("100x100", "1000x1000"), source: "itunes" };
    }
  } catch {}
  return null;
}

async function searchLastfm(artist, title) {
  if (!LASTFM_KEY) return null;
  const params = new URLSearchParams({
    method: "album.getinfo",
    api_key: LASTFM_KEY,
    artist,
    album: title,
    format: "json",
  });
  const url = `https://ws.audioscrobbler.com/2.0/?${params}`;
  try {
    const data = await fetchJson(url);
    const images = data?.album?.image;
    if (!Array.isArray(images)) return null;
    // prefer mega > extralarge > large
    for (const size of ["mega", "extralarge", "large"]) {
      const img = images.find((i) => i.size === size);
      if (img?.["#text"] && !img["#text"].includes("2a96cbd8b46e442fc41c2b86b821562f")) {
        return { url: img["#text"], source: "lastfm" };
      }
    }
  } catch {}
  return null;
}

/** Run the full fallback chain. Returns { url, source } | null */
async function searchCover(artist, title) {
  let result = await searchDeezer(artist, title);
  if (result) return result;
  await sleep(DELAY_MS);

  result = await searchItunes(artist, title);
  if (result) return result;
  await sleep(DELAY_MS);

  result = await searchLastfm(artist, title);
  return result;
}

// ── VALIDATE EXISTING COVER (HEAD) ──────────────────────────

async function validateCover(url) {
  if (!url || url.trim() === "") return { valid: false, reason: "empty" };
  if (isLocalPath(url)) return { valid: true, reason: "local" };
  try {
    const res = await request(url, "HEAD", { timeout: HEAD_TIMEOUT });
    if (res.status !== 200) return { valid: false, reason: `HTTP ${res.status}` };
    const cl = parseInt(res.headers["content-length"] || "0", 10);
    if (cl > 0 && cl < MIN_CONTENT_LENGTH) return { valid: false, reason: `too small (${cl}B)` };
    return { valid: true, reason: "ok" };
  } catch (err) {
    return { valid: false, reason: err.message || "error" };
  }
}

// ── PROGRESS BAR ────────────────────────────────────────────

function progressBar(prefix, current, total, label) {
  const pct = Math.round((current / total) * 100);
  const barLen = 25;
  const filled = Math.round((current / total) * barLen);
  const bar = "█".repeat(filled) + "░".repeat(barLen - filled);
  const tag = label.length > 42 ? label.slice(0, 42) + "…" : label;
  process.stdout.write(`\r  ${prefix} ${bar} ${pct}% (${current}/${total}) ${tag.padEnd(44)}`);
  if (current === total) process.stdout.write("\n");
}

// ── PARALLEL RUNNER ─────────────────────────────────────────

async function runParallel(items, fn, concurrency, progressPrefix = "") {
  const results = [];
  let idx = 0;
  let done = 0;

  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      const item = items[i];
      try {
        results[i] = await fn(item);
      } catch (err) {
        results[i] = { status: "error", album: item, error: err.message };
      }
      done++;
      const a = item.artist ? item : item.album || item;
      const label = a.artist ? `${a.artist} — ${a.title}` : String(item);
      progressBar(progressPrefix, done, items.length, label);
      await sleep(DELAY_MS);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// ── PATCH ALBUMS.TS ─────────────────────────────────────────

function patchAlbumsFile(fixes) {
  if (fixes.length === 0) return;
  let src = readFileSync(albumsFile, "utf-8");
  for (const { album, localPath } of fixes) {
    const idEscaped = album.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(
      `(\\{\\s*id:\\s*[\`"]${idEscaped}[\`"].*?cover:\\s*[\`"])([^"\`]*)([\`"])`,
      "s"
    );
    src = src.replace(re, `$1${localPath}$3`);
  }
  writeFileSync(albumsFile, src, "utf-8");
}

// ── MAIN ────────────────────────────────────────────────────

async function main() {
  const mode = VALIDATE_ONLY ? "validate-only" : REVALIDATE_ALL ? "revalidate-all" : "default";
  console.log(`\n🎵 fetch-covers.mjs  [mode: ${mode}]`);
  if (LASTFM_KEY) console.log(`  🔑 Last.fm API key loaded`);
  else console.log(`  ⚠  No LASTFM_API_KEY — Last.fm fallback disabled`);
  console.log("");

  const albums = parseAlbums();
  console.log(`  Found ${albums.length} albums in ${ALBUMS_PATH}\n`);
  if (albums.length === 0) { console.log("  ⚠  No albums parsed."); process.exit(1); }

  // ── PHASE 1: Validation ──────────────────────────────────
  console.log("  ▸ Phase 1: Validating covers…\n");

  const validationResults = await runParallel(albums, async (album) => {
    const v = await validateCover(album.cover);
    return { album, ...v };
  }, HEAD_CONCURRENCY, "🔍");

  const valid = [];       // covers that are fine
  const broken = [];      // external URLs that failed HEAD
  const empty = [];       // cover field is empty
  const local = [];       // local paths — skip

  for (const r of validationResults) {
    if (r.reason === "local") { local.push(r); continue; }
    if (r.reason === "empty") { empty.push(r); continue; }
    if (r.valid) { valid.push(r); continue; }
    broken.push(r);
  }

  // In default mode, only process empty covers
  // In revalidate-all mode, also process broken external covers
  const needsFix = REVALIDATE_ALL ? [...empty, ...broken] : empty;

  console.log(`\n  📊 Validation summary:`);
  console.log(`     ✅ Valid:   ${valid.length}`);
  console.log(`     📂 Local:  ${local.length}`);
  console.log(`     💀 Broken: ${broken.length}`);
  console.log(`     ⬜ Empty:  ${empty.length}`);
  console.log(`     🔧 To fix: ${needsFix.length}\n`);

  if (VALIDATE_ONLY) {
    // Write report and exit
    const report = {
      date: new Date().toISOString(),
      mode,
      valid: valid.length,
      local: local.length,
      broken: broken.map((r) => ({ id: r.album.id, artist: r.album.artist, title: r.album.title, oldUrl: r.album.cover, reason: r.reason })),
      empty: empty.map((r) => ({ id: r.album.id, artist: r.album.artist, title: r.album.title })),
    };
    writeFileSync(reportFile, JSON.stringify(report, null, 2), "utf-8");
    console.log(`  📊 Report saved to ${REPORT_PATH}\n`);
    return;
  }

  if (needsFix.length === 0) {
    console.log("  ✨ All covers are valid — nothing to do.\n");
    const report = { date: new Date().toISOString(), mode, fixed: [], revalidated: [], missing: [], unchanged: valid.length + local.length };
    writeFileSync(reportFile, JSON.stringify(report, null, 2), "utf-8");
    return;
  }

  // ── PHASE 2: Search & Download ───────────────────────────
  console.log("  ▸ Phase 2: Searching & downloading covers…\n");
  mkdirSync(coversDir, { recursive: true });

  const fixResults = await runParallel(needsFix, async ({ album }) => {
    const found = await searchCover(album.artist, album.title);
    if (!found) return { status: "missing", album };

    try {
      const dest = join(coversDir, `${album.id}.jpg`);
      await download(found.url, dest);
      const localPath = `/covers/${album.id}.jpg`;
      const wasEmpty = !album.cover || album.cover.trim() === "";
      return {
        status: wasEmpty ? "fixed" : "revalidated",
        album,
        localPath,
        source: found.source,
        oldUrl: album.cover || "",
      };
    } catch (err) {
      return { status: "missing", album, error: err.message };
    }
  }, DL_CONCURRENCY, "⬇️");

  const fixed = fixResults.filter((r) => r.status === "fixed");
  const revalidated = fixResults.filter((r) => r.status === "revalidated");
  const missing = fixResults.filter((r) => r.status === "missing");
  const allPatches = [...fixed, ...revalidated];

  console.log(`\n  📊 Download summary:`);
  console.log(`     🆕 Fixed (was empty):    ${fixed.length}`);
  console.log(`     � Revalidated (was broken): ${revalidated.length}`);
  console.log(`     ❌ Still missing:        ${missing.length}\n`);

  // Patch albums.ts
  if (allPatches.length > 0) {
    patchAlbumsFile(allPatches);
    console.log(`  📝 Patched ${ALBUMS_PATH} with ${allPatches.length} covers`);
  }

  // Write report
  const report = {
    date: new Date().toISOString(),
    mode,
    unchanged: valid.length + local.length,
    fixed: fixed.map((r) => ({ id: r.album.id, artist: r.album.artist, title: r.album.title, cover: r.localPath, source: r.source })),
    revalidated: revalidated.map((r) => ({ id: r.album.id, artist: r.album.artist, title: r.album.title, oldUrl: r.oldUrl, newUrl: r.localPath, source: r.source })),
    missing: missing.map((r) => ({ id: r.album.id, artist: r.album.artist, title: r.album.title, error: r.error || "no source found" })),
  };
  writeFileSync(reportFile, JSON.stringify(report, null, 2), "utf-8");
  console.log(`  📊 Report saved to ${REPORT_PATH}`);

  // Write missing list
  if (missing.length > 0) {
    const lines = missing.map((r) => `${r.album.id}\t${r.album.artist}\t${r.album.title}`).join("\n");
    writeFileSync(missingFile, lines + "\n", "utf-8");
    console.log(`  📋 Missing list saved to ${MISSING_PATH}`);
  }

  console.log("");
}

main().catch((err) => {
  console.error("\n  💥 Fatal error:", err);
  process.exit(1);
});
