#!/usr/bin/env node

/**
 * Fetches covers for the last 5 missing albums using multiple search strategies.
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

const ALBUMS_PATH = path.join(__dirname, "..", "src", "data", "albums.ts");
const USER_AGENT = "DJVCRTop500/1.0 (contact@example.com)";
const DELAY_MS = 2000;

// Each album has multiple search attempts
const MISSING = [
  {
    matchArtist: "Run DMC",
    searches: [
      { type: "itunes", q: "run dmc raising hell" },
      { type: "itunes", q: "Run-D.M.C. Raising Hell" },
      { type: "mb", artist: "Run-D.M.C.", title: "Raising Hell" },
      { type: "mb", artist: "Run DMC", title: "Raising Hell" },
    ],
  },
  {
    matchArtist: "Гражданская Оборона",
    searches: [
      { type: "mb", artist: "Гражданская Оборона", title: "Сто лет одиночества" },
      { type: "mb", artist: "Grazhdanskaya Oborona", title: "Sto let odinochestva" },
      { type: "itunes", q: "Grazhdanskaya Oborona" },
      { type: "itunes", q: "Гражданская Оборона" },
    ],
  },
  {
    matchArtist: "АК-47",
    searches: [
      { type: "mb", artist: "АК-47", title: "Мегаполис" },
      { type: "mb", artist: "AK-47", title: "Megapolis" },
      { type: "itunes", q: "AK-47 Megapolis" },
      { type: "itunes", q: "АК-47 Мегаполис" },
    ],
  },
  {
    matchArtist: "Доброе Чувство",
    searches: [
      { type: "itunes", q: "Dobroe Chuvstvo" },
      { type: "itunes", q: "Доброе Чувство" },
      { type: "mb", artist: "Доброе Чувство", title: "Птицу ЕМЪ" },
    ],
  },
  {
    matchArtist: "Полумягкие",
    searches: [
      { type: "itunes", q: "Polumyagkie" },
      { type: "itunes", q: "Полумягкие" },
      { type: "mb", artist: "Полумягкие", title: "Акустические морали овердрафта" },
    ],
  },
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

async function searchMusicBrainz(artist, title) {
  const cleanArtist = artist.replace(/[+!(){}[\]^"~*?:\\/&|]/g, " ").trim();
  const cleanTitle = title.replace(/[+!(){}[\]^"~*?:\\/&|]/g, " ").trim();
  const query = encodeURIComponent(`artist:${cleanArtist} AND release:${cleanTitle}`);
  const url = `https://musicbrainz.org/ws/2/release-group/?query=${query}&fmt=json&limit=3`;

  try {
    const res = await httpGet(url);
    if (res.statusCode === 503 || res.statusCode === 429) {
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
    return null;
  }
}

async function searchItunes(q) {
  const term = encodeURIComponent(q);
  const url = `https://itunes.apple.com/search?term=${term}&media=music&entity=album&limit=3`;

  try {
    const res = await httpGet(url);
    if (res.statusCode !== 200) return null;
    const data = JSON.parse(res.body);
    if (data.resultCount > 0 && data.results[0].artworkUrl100) {
      return data.results[0].artworkUrl100.replace("100x100", "600x600");
    }
    return null;
  } catch (err) {
    return null;
  }
}

async function main() {
  console.log("Reading albums.ts...");
  const src = fs.readFileSync(ALBUMS_PATH, "utf-8");
  const albums = parseAlbums(src);
  console.log(`Found ${albums.length} albums.\n`);

  let found = 0;
  let notFound = 0;
  const still = [];

  for (const entry of MISSING) {
    console.log(`\n━━ ${entry.matchArtist} ━━`);
    const album = albums.find((a) => a.artist === entry.matchArtist);
    if (!album) {
      console.log(`  ⚠ Not found in albums.ts`);
      still.push(entry.matchArtist);
      notFound++;
      continue;
    }
    if (album.cover) {
      console.log(`  ⏭ Already has cover`);
      found++;
      continue;
    }

    let coverUrl = null;

    for (const s of entry.searches) {
      if (s.type === "mb") {
        console.log(`  Trying MusicBrainz: "${s.artist}" + "${s.title}"`);
        const mbid = await searchMusicBrainz(s.artist, s.title);
        if (mbid) {
          coverUrl = `https://coverartarchive.org/release-group/${mbid}/front-250`;
          console.log(`  ✓ MusicBrainz MBID: ${mbid}`);
          break;
        }
        console.log(`  ✗ No match`);
      } else if (s.type === "itunes") {
        console.log(`  Trying iTunes: "${s.q}"`);
        const url = await searchItunes(s.q);
        if (url) {
          coverUrl = url;
          console.log(`  ✓ iTunes: ${url.substring(0, 70)}...`);
          break;
        }
        console.log(`  ✗ No match`);
      }
      await sleep(DELAY_MS);
    }

    if (coverUrl) {
      album.cover = coverUrl;
      found++;
    } else {
      console.log(`  ✗✗ ALL SEARCHES FAILED`);
      still.push(entry.matchArtist);
      notFound++;
    }
  }

  console.log(`\n\nSaving albums.ts...`);
  writeAlbumsFile(albums);

  console.log(`\n${"═".repeat(50)}`);
  console.log(`  ✓ Found:     ${found}`);
  console.log(`  ✗ Not found: ${notFound}`);
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
