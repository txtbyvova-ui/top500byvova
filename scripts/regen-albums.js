#!/usr/bin/env node

/**
 * Regenerates src/data/albums.ts FROM SCRATCH based on list_clean.txt.
 * Preserves cover URLs from the old albums.ts where possible.
 * Final output: exactly 490 albums matching list_clean.txt.
 */

const fs = require("fs");
const path = require("path");

const LIST_PATH = path.join(__dirname, "..", "list_clean.txt");
const ALBUMS_PATH = path.join(__dirname, "..", "src", "data", "albums.ts");

// ── Normalize for fuzzy matching ────────────────────────────

function normalize(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/ue/g, "u")
    .replace(/oe/g, "o")
    .replace(/ae/g, "a")
    .replace(/[^a-zа-яё0-9]/gi, "")
    .trim();
}

// ── Parse old albums.ts to extract covers ───────────────────

function extractOldCovers() {
  const src = fs.readFileSync(ALBUMS_PATH, "utf-8");
  const covers = []; // array of { normArtist, normTitle, artist, title, cover }
  const objectRegex = /\{([^}]+)\}/g;
  let match;
  while ((match = objectRegex.exec(src)) !== null) {
    const block = match[1];
    const artist = extractField(block, "artist");
    const title = extractField(block, "title");
    const cover = extractField(block, "cover");
    if (artist && title && cover) {
      covers.push({
        normArtist: normalize(artist),
        normTitle: normalize(title),
        artist,
        title,
        cover,
      });
    }
  }
  return covers;
}

function extractField(block, name) {
  const re = new RegExp(`${name}:\\s*[\`"']([^"\`']*)[\`"']`);
  const m = block.match(re);
  return m ? m[1] : null;
}

// ── Find cover from old data ────────────────────────────────

function findCover(artist, title, oldCovers) {
  const na = normalize(artist);
  const nt = normalize(title);

  // Pass 1: exact artist + title starts-with (either direction)
  for (const c of oldCovers) {
    if (c.normArtist === na && nt && c.normTitle &&
        (c.normTitle.startsWith(nt) || nt.startsWith(c.normTitle))) {
      return c.cover;
    }
  }

  // Pass 2: artist match only
  for (const c of oldCovers) {
    if (c.normArtist === na) {
      return c.cover;
    }
  }

  // Pass 3: artist substring (for "The Chameleons" vs "Chameleons", etc.)
  for (const c of oldCovers) {
    if (
      (na.length > 2 && c.normArtist.includes(na)) ||
      (c.normArtist.length > 2 && na.includes(c.normArtist))
    ) {
      // Also check title has some overlap
      if (nt && c.normTitle && (c.normTitle.startsWith(nt) || nt.startsWith(c.normTitle))) {
        return c.cover;
      }
    }
  }

  return "";
}

// ── Parse list_clean.txt ────────────────────────────────────

function parseListClean() {
  const raw = fs.readFileSync(LIST_PATH, "utf-8");
  const lines = raw.split("\n").filter((l) => l.trim());
  const entries = [];

  for (const line of lines) {
    const dotMatch = line.match(/^\d+\.\s+(.+)$/);
    if (!dotMatch) continue;

    const rest = dotMatch[1].trim();
    const eqIdx = rest.lastIndexOf(" = ");
    if (eqIdx === -1) continue;

    const genre = rest.slice(eqIdx + 3).trim();
    const artistTitle = rest.slice(0, eqIdx).trim();

    const dashIdx = artistTitle.indexOf(" - ");
    let artist, title;
    if (dashIdx !== -1) {
      artist = artistTitle.slice(0, dashIdx).trim();
      title = artistTitle.slice(dashIdx + 3).trim();
    } else {
      artist = artistTitle;
      title = "";
    }

    entries.push({ artist, title, genre });
  }

  return entries;
}

// ── Write albums.ts ─────────────────────────────────────────

function writeAlbumsFile(albums) {
  const lines = albums.map((a) => {
    // Escape backticks in values
    const artist = a.artist.replace(/`/g, "'");
    const title = a.title.replace(/`/g, "'");
    const cover = (a.cover || "").replace(/`/g, "'");
    const genre = (a.genre || "").replace(/`/g, "'");
    return `  { id: "${a.id}", artist: \`${artist}\`, title: \`${title}\`, cover: \`${cover}\`, genre: \`${genre}\` },`;
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

// ── Main ────────────────────────────────────────────────────

function main() {
  console.log("Reading old albums.ts for cover URLs...");
  const oldCovers = extractOldCovers();
  console.log(`  Found ${oldCovers.length} entries with covers in old albums.ts`);

  console.log("Reading list_clean.txt...");
  const listEntries = parseListClean();
  console.log(`  Parsed ${listEntries.length} entries from list_clean.txt`);

  if (listEntries.length !== 490) {
    console.error(`ERROR: Expected 490 entries but got ${listEntries.length}. Aborting.`);
    process.exit(1);
  }

  // Build new albums array
  const albums = [];
  let withCover = 0;
  let withoutCover = 0;

  for (let i = 0; i < listEntries.length; i++) {
    const entry = listEntries[i];
    const id = `a${String(i + 1).padStart(3, "0")}`;
    const cover = findCover(entry.artist, entry.title, oldCovers);

    if (cover) withCover++;
    else withoutCover++;

    albums.push({
      id,
      artist: entry.artist,
      title: entry.title,
      cover,
      genre: entry.genre,
    });
  }

  console.log(`\nWriting new albums.ts...`);
  writeAlbumsFile(albums);

  console.log(`\n${"═".repeat(50)}`);
  console.log(`  Total albums:    ${albums.length}`);
  console.log(`  With cover:      ${withCover}`);
  console.log(`  Without cover:   ${withoutCover}`);
  console.log(`${"═".repeat(50)}`);

  // Final verification
  const verify = fs.readFileSync(ALBUMS_PATH, "utf-8");
  const count = (verify.match(/\{ id: "/g) || []).length;
  console.log(`\n  ✓ Verified: ${count} albums in albums.ts`);

  if (count !== 490) {
    console.error(`  ✗ ERROR: Expected 490, got ${count}!`);
    process.exit(1);
  }
}

main();
