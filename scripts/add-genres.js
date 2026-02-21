#!/usr/bin/env node

/**
 * Reads list_clean.txt, parses Artist - Title = Genre,
 * then updates src/data/albums.ts with genre fields.
 *
 * - Fuzzy-matches by normalized artist name
 * - Adds new albums from the list that don't exist in albums.ts
 * - Preserves all existing data (covers, etc.)
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
    .replace(/&/g, "and")             // & → and
    .replace(/ue/g, "u")              // German umlaut equiv: ue→u
    .replace(/oe/g, "o")              // oe→o
    .replace(/ae/g, "a")              // ae→a
    .replace(/[^a-zа-яё0-9]/gi, "")  // keep only alphanumeric (latin + cyrillic)
    .trim();
}

// ── Parse list_clean.txt ────────────────────────────────────

function parseListClean() {
  const raw = fs.readFileSync(LIST_PATH, "utf-8");
  const lines = raw.split("\n").filter((l) => l.trim());
  const entries = [];

  for (const line of lines) {
    // Strip line number: everything before first ". "
    const dotMatch = line.match(/^\d+\.\s+(.+)$/);
    if (!dotMatch) continue; // skip non-entry lines (comments, etc.)

    const rest = dotMatch[1].trim();

    // Parse: Artist - Title = Genre
    // Some entries have no " - " (e.g. "The Velvet Underground & Nico = Classic Rock...")
    const eqIdx = rest.lastIndexOf(" = ");
    if (eqIdx === -1) continue; // no genre found

    const genre = rest.slice(eqIdx + 3).trim();
    const artistTitle = rest.slice(0, eqIdx).trim();

    // Split artist and title by " - "
    const dashIdx = artistTitle.indexOf(" - ");
    let artist, title;
    if (dashIdx !== -1) {
      artist = artistTitle.slice(0, dashIdx).trim();
      title = artistTitle.slice(dashIdx + 3).trim();
    } else {
      // No dash — treat the whole thing as artist, title empty
      artist = artistTitle;
      title = "";
    }

    entries.push({ artist, title, genre });
  }

  return entries;
}

// ── Parse albums.ts ─────────────────────────────────────────

function readAlbumsFile() {
  return fs.readFileSync(ALBUMS_PATH, "utf-8");
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

function extractField(block, name) {
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

// ── Matching logic ──────────────────────────────────────────

function findBestMatch(album, listEntries) {
  const normArtist = normalize(album.artist);
  const normTitle = normalize(album.title);

  // Pass 1: exact normalized artist + title starts-with match
  // (titles in albums.ts may be truncated)
  for (const entry of listEntries) {
    const eArtist = normalize(entry.artist);
    const eTitle = normalize(entry.title);
    if (normArtist === eArtist && eTitle && normTitle && eTitle.startsWith(normTitle)) {
      return entry;
    }
  }

  // Pass 2: exact normalized artist + title match (albums.ts title may be longer or equal)
  for (const entry of listEntries) {
    const eArtist = normalize(entry.artist);
    const eTitle = normalize(entry.title);
    if (normArtist === eArtist && normTitle && eTitle && normTitle.startsWith(eTitle)) {
      return entry;
    }
  }

  // Pass 3: exact normalized artist match (any title)
  for (const entry of listEntries) {
    const eArtist = normalize(entry.artist);
    if (normArtist === eArtist) {
      return entry;
    }
  }

  // Pass 4: artist contains or is contained (for edge cases like "The Chameleons" vs "Chameleons")
  for (const entry of listEntries) {
    const eArtist = normalize(entry.artist);
    if (
      (normArtist.length > 2 && eArtist.includes(normArtist)) ||
      (eArtist.length > 2 && normArtist.includes(eArtist))
    ) {
      return entry;
    }
  }

  // Pass 5: for entries with no title (artist-only lines), match by artist substring
  for (const entry of listEntries) {
    if (!entry.title) {
      const eArtist = normalize(entry.artist);
      if (normArtist.includes(eArtist) || eArtist.includes(normArtist)) {
        return entry;
      }
    }
  }

  return null;
}

// ── Main ────────────────────────────────────────────────────

function main() {
  console.log("Reading list_clean.txt...");
  const listEntries = parseListClean();
  console.log(`  Parsed ${listEntries.length} entries from list_clean.txt`);

  console.log("Reading albums.ts...");
  const src = readAlbumsFile();
  const albums = parseAlbums(src);
  console.log(`  Found ${albums.length} albums in albums.ts\n`);

  // Track which list entries were matched
  const matchedListIndices = new Set();
  let matched = 0;
  let unmatched = 0;
  const unmatchedAlbums = [];

  // Match existing albums to list entries
  for (const album of albums) {
    const entry = findBestMatch(album, listEntries);
    if (entry) {
      album.genre = entry.genre;
      matched++;
      // Mark this entry as used
      const idx = listEntries.indexOf(entry);
      matchedListIndices.add(idx);
    } else {
      album.genre = "Other";
      unmatched++;
      unmatchedAlbums.push(`${album.artist} — ${album.title}`);
    }
  }

  // Find NEW albums from list_clean.txt not in albums.ts
  const newAlbums = [];
  for (let i = 0; i < listEntries.length; i++) {
    if (matchedListIndices.has(i)) continue;
    const entry = listEntries[i];
    if (!entry.title) continue; // skip artist-only entries for new albums

    // Check it's not a duplicate entry (same artist matched elsewhere)
    const normArtist = normalize(entry.artist);
    const normTitle = normalize(entry.title);
    const alreadyExists = albums.some((a) => {
      const na = normalize(a.artist);
      const nt = normalize(a.title);
      return na === normArtist && (nt.startsWith(normTitle) || normTitle.startsWith(nt));
    });
    if (alreadyExists) continue;

    const nextId = `a${String(albums.length + newAlbums.length + 1).padStart(3, "0")}`;
    newAlbums.push({
      id: nextId,
      artist: entry.artist,
      title: entry.title,
      cover: "",
      genre: entry.genre,
    });
  }

  // Append new albums
  const allAlbums = [...albums, ...newAlbums];

  // Write
  console.log("Writing updated albums.ts...");
  writeAlbumsFile(allAlbums);

  // Summary
  console.log(`\n${"═".repeat(50)}`);
  console.log(`  ✓ Matched:       ${matched}`);
  console.log(`  ✗ Unmatched:     ${unmatched} (set to "Other")`);
  console.log(`  ★ New albums:    ${newAlbums.length}`);
  console.log(`  Total albums:    ${allAlbums.length}`);
  console.log(`${"═".repeat(50)}`);

  if (unmatchedAlbums.length > 0) {
    console.log(`\nUnmatched albums (set to "Other"):`);
    unmatchedAlbums.forEach((a) => console.log(`  - ${a}`));
  }

  if (newAlbums.length > 0) {
    console.log(`\nNew albums added:`);
    newAlbums.forEach((a) => console.log(`  + ${a.artist} — ${a.title} [${a.genre}]`));
  }
}

main();
