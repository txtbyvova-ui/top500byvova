#!/usr/bin/env node

/**
 * Fetches covers for the 24 albums that MusicBrainz couldn't find.
 * Uses MusicBrainz with CORRECTED search terms, then iTunes as fallback.
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

const ALBUMS_PATH = path.join(__dirname, "..", "src", "data", "albums.ts");
const USER_AGENT = "DJVCRTop500/1.0 (contact@example.com)";
const DELAY_MS = 2000;

// Corrected search terms mapped to the artist name in albums.ts
const MISSING = [
  { searchArtist: "Доброе Чувство", searchTitle: "Птицу ЕМЪ", matchArtist: "Доброе Чувство" },
  { searchArtist: "Run-D.M.C.", searchTitle: "Raising Hell", matchArtist: "Run DMC" },
  { searchArtist: "Hiroshi Yoshimura", searchTitle: "Music for Nine Post Cards", matchArtist: "Hiroshi Yoshimura" },
  { searchArtist: "Regina Spektor", searchTitle: "Begin to Hope", matchArtist: "Regina Spektor" },
  { searchArtist: "Cap'n Jazz", searchTitle: "Analphabetapolothology", matchArtist: "Cap" },
  { searchArtist: "Forseti", searchTitle: "Erde", matchArtist: "Forseti" },
  { searchArtist: "Buckethead", searchTitle: "Colma", matchArtist: "Buckethead" },
  { searchArtist: "Интурист", searchTitle: "Экономика", matchArtist: "Интурист" },
  { searchArtist: "Yasuaki Shimizu", searchTitle: "Kakashi", matchArtist: "Yasuaki Shimizu" },
  { searchArtist: "Strapping Young Lad", searchTitle: "Alien", matchArtist: "Strapping Young Lad" },
  { searchArtist: "Megadeth", searchTitle: "Rust in Peace", matchArtist: "Megadeth" },
  { searchArtist: "Coldworld", searchTitle: "Melancholie²", matchArtist: "Coldworld" },
  { searchArtist: "Entschuldigung", searchTitle: "EP", matchArtist: "Entschuldigung" },
  { searchArtist: "D'Angelo", searchTitle: "Voodoo", matchArtist: "D" },
  { searchArtist: "Scientist", searchTitle: "Rids the World of the Evil Curse of the Vampires", matchArtist: "Scientist" },
  { searchArtist: "Владимир Кузьмин", searchTitle: "Ромео и Джульетта", matchArtist: "Владимир Кузьмин" },
  { searchArtist: "АК-47", searchTitle: "МегаPolice", matchArtist: "АК-47" },
  { searchArtist: "Гражданская Оборона", searchTitle: "Сто лет одиночества", matchArtist: "Гражданская Оборона" },
  { searchArtist: "Тимур Муцураев", searchTitle: "Муцураев", matchArtist: "Муцураев" },
  { searchArtist: "The Pains of Being Pure at Heart", searchTitle: "The Pains of Being Pure at Heart", matchArtist: "The Pains of Being Pure at Heart" },
  { searchArtist: "Parannoul", searchTitle: "To See the Next Part of the Dream", matchArtist: "Parannoul" },
  { searchArtist: "Полумягкие", searchTitle: "Акустические морали овердрафта", matchArtist: "Полумягкие" },
  { searchArtist: "Global Communication", searchTitle: "76:14", matchArtist: "Global Communication" },
  { searchArtist: "Speedy G", searchTitle: "Ginger", matchArtist: "Speedy G" },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function httpGet(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, { headers: { "User-Agent": USER_AGENT } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && maxRedirects > 0) {
        let next = res.headers.location;
        if (next.startsWith("/")) {
          const parsed = new URL(url);
          next = `${parsed.protocol}//${parsed.host}${next}`;
        }
        res.resume();
        return resolve(httpGet(next, maxRedirects - 1));
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () =>
        resolve({ statusCode: res.statusCode, body: Buffer.concat(chunks).toString("utf-8") })
      );
    });
    req.on("error", reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

// ── Parse & write albums.ts (preserving genre) ──────────────

function extractField(block, name) {
  const re = new RegExp(`${name}:\\s*[\`"']([^"\`']*)[\`"']`);
  const m = block.match(re);
  return m ? m[1] : null;
}

function parseAlbums(src) {
  const albums = [];
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

function writeAlbumsFile(albums) {
  const lines = albums.map((a) => {
    let fields = `id: "${a.id}", artist: \`${a.artist}\`, title: \`${a.title}\``;
    if (a.cover !== undefined) fields += `, cover: \`${a.cover}\``;
    if (a.genre !== undefined) fields += `, genre: \`${a.genre}\``;
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

// ── MusicBrainz search (corrected names) ────────────────────

async function searchMusicBrainz(artist, title) {
  const cleanArtist = artist.replace(/[+\-!(){}[\]^"~*?:\\/&|]/g, " ").trim();
  const cleanTitle = title.replace(/[+\-!(){}[\]^"~*?:\\/&|]/g, " ").trim();
  const query = encodeURIComponent(`artist:${cleanArtist} AND release:${cleanTitle}`);
  const url = `https://musicbrainz.org/ws/2/release-group/?query=${query}&fmt=json&limit=1`;

  try {
    const res = await httpGet(url);
    if (res.statusCode === 503 || res.statusCode === 429) {
      console.log(`    MusicBrainz ${res.statusCode}, retrying...`);
      await sleep(5000);
      const res2 = await httpGet(url);
      if (res2.statusCode !== 200) return null;
      const data = JSON.parse(res2.body);
      return data["release-groups"]?.[0]?.id || null;
    }
    if (res.statusCode !== 200) return null;
    const data = JSON.parse(res.body);
    return data["release-groups"]?.[0]?.id || null;
  } catch (err) {
    console.log(`    MB error: ${err.message}`);
    return null;
  }
}

// ── iTunes fallback search ──────────────────────────────────

async function searchItunes(artist, title) {
  const term = encodeURIComponent(`${artist} ${title}`);
  const url = `https://itunes.apple.com/search?term=${term}&media=music&entity=album&limit=1`;

  try {
    const res = await httpGet(url);
    if (res.statusCode !== 200) return null;
    const data = JSON.parse(res.body);
    if (data.resultCount > 0 && data.results[0].artworkUrl100) {
      // Get 600x600 version
      return data.results[0].artworkUrl100.replace("100x100", "600x600");
    }
    return null;
  } catch (err) {
    console.log(`    iTunes error: ${err.message}`);
    return null;
  }
}

// ── Main ────────────────────────────────────────────────────

async function main() {
  console.log("Reading albums.ts...");
  const src = fs.readFileSync(ALBUMS_PATH, "utf-8");
  const albums = parseAlbums(src);
  console.log(`Found ${albums.length} albums.\n`);

  let foundMB = 0;
  let foundIT = 0;
  let notFound = 0;
  let still = [];

  for (let i = 0; i < MISSING.length; i++) {
    const m = MISSING[i];
    const num = `[${i + 1}/${MISSING.length}]`;
    console.log(`${num} ${m.searchArtist} — ${m.searchTitle || "(self-titled)"}`);

    const album = albums.find((a) => a.artist === m.matchArtist);
    if (!album) {
      console.log(`    ⚠ Not found in albums.ts (matchArtist: "${m.matchArtist}")`);
      still.push(`${m.searchArtist} — ${m.searchTitle}`);
      notFound++;
      await sleep(DELAY_MS);
      continue;
    }

    if (album.cover) {
      console.log(`    ⏭ Already has cover, skipping`);
      foundMB++;
      continue;
    }

    // Try MusicBrainz first
    const mbid = await searchMusicBrainz(m.searchArtist, m.searchTitle);
    if (mbid) {
      const coverUrl = `https://coverartarchive.org/release-group/${mbid}/front-250`;
      console.log(`    ✓ MusicBrainz: ${mbid}`);
      album.cover = coverUrl;
      foundMB++;
      await sleep(DELAY_MS);
      continue;
    }

    console.log(`    … MusicBrainz miss, trying iTunes...`);
    await sleep(DELAY_MS);

    // Fallback to iTunes
    const itunesCover = await searchItunes(m.searchArtist, m.searchTitle);
    if (itunesCover) {
      console.log(`    ✓ iTunes: ${itunesCover.substring(0, 70)}...`);
      album.cover = itunesCover;
      foundIT++;
      await sleep(DELAY_MS);
      continue;
    }

    console.log(`    ✗ Not found anywhere`);
    still.push(`${m.searchArtist} — ${m.searchTitle}`);
    notFound++;
    await sleep(DELAY_MS);
  }

  console.log(`\nSaving albums.ts...`);
  writeAlbumsFile(albums);

  console.log(`\n${"═".repeat(50)}`);
  console.log(`  ✓ MusicBrainz:   ${foundMB}`);
  console.log(`  ✓ iTunes:        ${foundIT}`);
  console.log(`  ✗ Not found:     ${notFound}`);
  console.log(`${"═".repeat(50)}`);

  if (still.length > 0) {
    console.log(`\nStill missing:`);
    still.forEach((s) => console.log(`  - ${s}`));
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
