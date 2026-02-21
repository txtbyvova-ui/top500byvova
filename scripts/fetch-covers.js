#!/usr/bin/env node

/**
 * Fetches album cover art URLs from MusicBrainz / Cover Art Archive.
 *
 * Usage: node scripts/fetch-covers.js
 *
 * - Queries MusicBrainz release-group search API for MBID
 * - Trusts that cover exists if MBID is found (no cover check request)
 * - Constructs URL: https://coverartarchive.org/release-group/{mbid}/front-250
 * - Saves progress every 20 albums
 * - Skips albums that already have a NON-EMPTY cover URL
 * - Retries empty-cover albums (previous failed cover checks)
 * - 2s delay between requests (MusicBrainz rate-limit)
 * - Retry once on failure with 5s backoff
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

// ── Config ──────────────────────────────────────────────────
const ALBUMS_PATH = path.join(__dirname, "..", "src", "data", "albums.ts");
const USER_AGENT = "DJVCRTop500/1.0 (contact@example.com)";
const DELAY_MS = 2000;
const RETRY_DELAY_MS = 5000;
const SAVE_EVERY = 20;

// ── Helpers ─────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Simple promisified GET request. Follows up to 5 redirects.
 * Returns { statusCode, headers, body }.
 */
function httpGet(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, { headers: { "User-Agent": USER_AGENT } }, (res) => {
      // Follow redirects
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && maxRedirects > 0) {
        let next = res.headers.location;
        if (next.startsWith("/")) {
          const parsed = new URL(url);
          next = `${parsed.protocol}//${parsed.host}${next}`;
        }
        res.resume(); // drain
        return resolve(httpGet(next, maxRedirects - 1));
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () =>
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString("utf-8"),
        })
      );
    });
    req.on("error", reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
  });
}

// ── Parse albums.ts ─────────────────────────────────────────

function readAlbumsFile() {
  return fs.readFileSync(ALBUMS_PATH, "utf-8");
}

/**
 * Parses the albums array from the .ts source text.
 * Returns an array of { id, artist, title, cover? } objects.
 */
function parseAlbums(src) {
  const albums = [];
  // Match each object literal inside the array
  const objectRegex = /\{([^}]+)\}/g;
  let match;
  while ((match = objectRegex.exec(src)) !== null) {
    const block = match[1];
    const id = extractField(block, "id");
    const artist = extractField(block, "artist");
    const title = extractField(block, "title");
    const cover = extractField(block, "cover");
    const genre = extractField(block, "genre");
    if (id && artist && title) {
      const album = { id, artist, title };
      if (cover !== null) album.cover = cover;
      if (genre !== null) album.genre = genre;
      albums.push(album);
    }
  }
  return albums;
}

function extractField(block, name) {
  // Matches: field: `value` or field: "value" or field: 'value'
  const re = new RegExp(`${name}:\\s*[\`"']([^"\`']*)[\`"']`);
  const m = block.match(re);
  return m ? m[1] : null;
}

// ── Write albums.ts ─────────────────────────────────────────

function writeAlbumsFile(albums) {
  const lines = albums.map((a) => {
    let fields = `id: "${a.id}", artist: \`${a.artist}\`, title: \`${a.title}\``;
    if (a.cover !== undefined) {
      fields += `, cover: \`${a.cover}\``;
    }
    if (a.genre !== undefined) {
      fields += `, genre: \`${a.genre}\``;
    }
    return `  { ${fields} },`;
  });

  const src = `export type Album = {
  id: string;
  artist: string;
  title: string;
  cover?: string;
  genre?: string;
};

export const albums: Album[] = [
${lines.join("\n")}
];
`;
  fs.writeFileSync(ALBUMS_PATH, src, "utf-8");
}

// ── MusicBrainz lookup (with retry) ─────────────────────────

async function searchMusicBrainz(artist, title) {
  // Clean up the query – remove special chars that break Lucene
  const cleanArtist = artist.replace(/[+\-!(){}[\]^"~*?:\\/&|]/g, " ").trim();
  const cleanTitle = title.replace(/[+\-!(){}[\]^"~*?:\\/&|]/g, " ").trim();

  const query = encodeURIComponent(`artist:${cleanArtist} AND release:${cleanTitle}`);
  const url = `https://musicbrainz.org/ws/2/release-group/?query=${query}&fmt=json&limit=1`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await httpGet(url);
      if (res.statusCode === 503 || res.statusCode === 429) {
        console.log(`    MusicBrainz returned ${res.statusCode}, ${attempt === 0 ? "retrying in 5s..." : "giving up"}`);
        if (attempt === 0) {
          await sleep(RETRY_DELAY_MS);
          continue;
        }
        return null;
      }
      if (res.statusCode !== 200) {
        console.log(`    MusicBrainz returned ${res.statusCode}`);
        return null;
      }
      const data = JSON.parse(res.body);
      if (data["release-groups"] && data["release-groups"].length > 0) {
        return data["release-groups"][0].id; // mbid
      }
      return null;
    } catch (err) {
      console.log(`    MusicBrainz error: ${err.message}${attempt === 0 ? ", retrying in 5s..." : ""}`);
      if (attempt === 0) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      return null;
    }
  }
  return null;
}

// ── Main ────────────────────────────────────────────────────

async function main() {
  console.log("Reading albums.ts...");
  const src = readAlbumsFile();
  const albums = parseAlbums(src);
  console.log(`Found ${albums.length} albums.`);

  // Count how many need processing
  const toProcess = albums.filter((a) => !a.cover).length;
  console.log(`${toProcess} albums need cover lookup (skipping ${albums.length - toProcess} with existing covers).\n`);

  let updated = 0;
  let skipped = 0;
  let notFound = 0;
  let processed = 0;

  for (let i = 0; i < albums.length; i++) {
    const album = albums[i];

    // Skip only albums that have a NON-EMPTY cover URL
    if (album.cover) {
      skipped++;
      continue;
    }

    processed++;
    const num = `[${processed}/${toProcess}]`;
    console.log(`${num} ${album.artist} — ${album.title}`);

    // Search MusicBrainz
    const mbid = await searchMusicBrainz(album.artist, album.title);

    if (!mbid) {
      console.log(`    ✗ No MusicBrainz match`);
      album.cover = "";
      notFound++;
    } else {
      // Trust the MBID — construct cover URL without checking
      const coverUrl = `https://coverartarchive.org/release-group/${mbid}/front-250`;
      console.log(`    ✓ MBID: ${mbid}`);
      album.cover = coverUrl;
      updated++;
    }

    // Save progress periodically
    if (processed % SAVE_EVERY === 0) {
      console.log(`\n  💾 Saving progress (${processed}/${toProcess} processed)...\n`);
      writeAlbumsFile(albums);
    }

    // Rate limit
    await sleep(DELAY_MS);
  }

  // Final save
  console.log(`\nSaving final results...`);
  writeAlbumsFile(albums);

  console.log(`\nDone!`);
  console.log(`  ✓ Covers found: ${updated}`);
  console.log(`  ✗ Not found:    ${notFound}`);
  console.log(`  ⏭ Skipped:      ${skipped}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
