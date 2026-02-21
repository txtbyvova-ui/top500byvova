"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { albums, Album } from "../data/albums";

// Generate a deterministic color from a string
function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 45%, 35%)`;
}

// Get initials from artist name (max 2 chars)
function getInitials(name: string): string {
  return name
    .split(/[\s&]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

// SVG icons for streaming services
const StreamingIcons: Record<string, React.ReactNode> = {
  Spotify: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
  ),
  "Apple Music": (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043A5.022 5.022 0 0019.7.28C18.96.12 18.21.06 17.46.024 16.5 0 15.54 0 14.58 0H9.42C8.46 0 7.5 0 6.54.024 5.79.06 5.04.12 4.3.28a5.022 5.022 0 00-1.874.611C1.308 1.624.563 2.624.246 3.934a9.23 9.23 0 00-.24 2.19C0 7.5 0 8.88 0 10.26v3.48c0 1.38 0 2.76.006 4.14a9.23 9.23 0 00.24 2.19c.317 1.31 1.062 2.31 2.18 3.043a5.022 5.022 0 001.874.611c.74.16 1.49.22 2.24.256.96.024 1.92.024 2.88.024h5.16c.96 0 1.92 0 2.88-.024.75-.036 1.5-.096 2.24-.256a5.022 5.022 0 001.874-.611c1.118-.733 1.863-1.733 2.18-3.043a9.23 9.23 0 00.24-2.19c.006-1.38.006-2.76.006-4.14v-3.48c0-1.38 0-2.76-.006-4.136zM17.46 17.206c0 .36-.18.6-.48.72-.12.06-.24.06-.36.06-.18 0-.36-.06-.54-.18l-2.16-1.26V18c0 1.74-1.38 3.18-3.12 3.3h-.24c-1.8-.06-3.24-1.56-3.24-3.36 0-1.8 1.44-3.3 3.24-3.36h.24c.36.024.72.12 1.08.24V7.56c0-.48.36-.84.78-.9l4.2-.78c.06 0 .12-.024.18-.024.3 0 .54.24.54.54l.06 10.81z"/>
    </svg>
  ),
  "YouTube Music": (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm0 19.104c-3.924 0-7.104-3.18-7.104-7.104S8.076 4.896 12 4.896s7.104 3.18 7.104 7.104-3.18 7.104-7.104 7.104zm0-13.332c-3.432 0-6.228 2.796-6.228 6.228S8.568 18.228 12 18.228 18.228 15.432 18.228 12 15.432 5.772 12 5.772zM9.684 15.54V8.46L15.816 12l-6.132 3.54z"/>
    </svg>
  ),
  Bandcamp: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M0 18.75l7.437-13.5H24l-7.438 13.5z"/>
    </svg>
  ),
  "Яндекс Музыка": (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M12 24c6.627 0 12-5.373 12-12S18.627 0 12 0 0 5.373 0 12s5.373 12 12 12zm1.385-18.52v4.477l2.6-4.478h2.345L15.2 11.192l3.538 5.328h-2.566l-2.787-4.477v4.477h-1.97V5.48z"/>
    </svg>
  ),
  "VK Music": (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.391 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.864-.525-2.05-1.727-1.033-1-1.49-1.135-1.744-1.135-.356 0-.458.102-.458.593v1.575c0 .424-.135.678-1.253.678-1.846 0-3.896-1.118-5.335-3.202C4.624 10.857 4 8.57 4 8.096c0-.254.102-.491.593-.491h1.744c.44 0 .61.203.78.678.847 2.457 2.27 4.607 2.862 4.607.22 0 .322-.102.322-.66V9.793c-.068-1.186-.695-1.287-.695-1.71 0-.203.17-.407.44-.407h2.744c.373 0 .508.203.508.643v3.473c0 .372.17.508.271.508.22 0 .407-.136.813-.542 1.254-1.406 2.151-3.574 2.151-3.574.119-.254.322-.491.763-.491h1.744c.525 0 .644.27.525.643-.22 1.017-2.354 4.031-2.354 4.031-.186.305-.254.44 0 .78.186.254.796.779 1.203 1.253.745.847 1.32 1.558 1.473 2.05.17.49-.085.744-.576.744z"/>
    </svg>
  ),
};

// Build streaming search URLs
function getStreamingLinks(artist: string, title: string) {
  const q = encodeURIComponent(`${artist} ${title}`);
  return [
    { name: "Spotify", url: `https://open.spotify.com/search/${q}`, color: "#1DB954" },
    { name: "Apple Music", url: `https://music.apple.com/search?term=${q}`, color: "#FC3C44" },
    { name: "YouTube Music", url: `https://music.youtube.com/search?q=${q}`, color: "#FF0000" },
    { name: "Bandcamp", url: `https://bandcamp.com/search?q=${q}`, color: "#1DA0C3" },
    { name: "Яндекс Музыка", url: `https://music.yandex.ru/search?text=${q}`, color: "#FFDB4D" },
    { name: "VK Music", url: `https://vk.com/audio?q=${q}`, color: "#0077FF" },
  ];
}

// ── Album Card ──────────────────────────────────────────────
function AlbumCard({
  album,
  index,
  onClick,
}: {
  album: Album;
  index: number;
  onClick: () => void;
}) {
  const bg = stringToColor(album.artist + album.title);
  const initials = getInitials(album.artist);
  const [imgError, setImgError] = useState(false);
  const hasCover = !!album.cover && !imgError;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.02, 0.5) }}
      onClick={onClick}
      className="group cursor-pointer"
    >
      <div className="relative aspect-square rounded-lg overflow-hidden mb-2">
        {hasCover ? (
          <img
            src={album.cover}
            alt={`${album.artist} — ${album.title}`}
            onError={() => setImgError(true)}
            loading="lazy"
            decoding="async"
            width={250}
            height={250}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center transition-transform duration-300 group-hover:scale-105"
            style={{ background: bg }}
          >
            <span className="text-white/60 font-bold text-3xl sm:text-4xl select-none tracking-wider">
              {initials}
            </span>
          </div>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center">
          <span className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-sm font-medium tracking-wide">
            View
          </span>
        </div>
      </div>
      <div className="px-1">
        <p className="text-white text-sm font-semibold truncate leading-tight">
          {album.artist}
        </p>
        <p className="text-neutral-500 text-xs truncate mt-0.5">
          {album.title}
        </p>
      </div>
    </motion.div>
  );
}

// ── Album Modal ─────────────────────────────────────────────
function AlbumModal({
  album,
  onClose,
}: {
  album: Album;
  onClose: () => void;
}) {
  const bg = stringToColor(album.artist + album.title);
  const initials = getInitials(album.artist);
  const links = getStreamingLinks(album.artist, album.title);
  const [imgError, setImgError] = useState(false);
  const hasCover = !!album.cover && !imgError;

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    document.body.classList.add("modal-open");
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.classList.remove("modal-open");
    };
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-lg w-full overflow-hidden"
      >
        {/* Cover */}
        {hasCover ? (
          <img
            src={album.cover}
            alt={`${album.artist} — ${album.title}`}
            onError={() => setImgError(true)}
            loading="lazy"
            decoding="async"
            width={250}
            height={250}
            className="w-full aspect-square object-cover"
          />
        ) : (
          <div
            className="w-full aspect-square flex items-center justify-center"
            style={{ background: bg }}
          >
            <span className="text-white/50 font-bold text-7xl select-none tracking-widest">
              {initials}
            </span>
          </div>
        )}

        {/* Info */}
        <div className="p-6">
          <h2 className="text-white text-2xl font-bold leading-tight">
            {album.artist}
          </h2>
          <h3 className="text-neutral-400 text-lg mt-1">{album.title}</h3>

          {/* Streaming Links */}
          <div className="flex items-center gap-2 mt-5">
            {links.map((link) => (
              <a
                key={link.name}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                title={link.name}
                className="flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200 hover:scale-110 hover:brightness-125"
                style={{
                  background: `${link.color}18`,
                  color: link.color,
                  border: `1px solid ${link.color}25`,
                }}
              >
                {StreamingIcons[link.name]}
              </a>
            ))}
          </div>

          {/* Review placeholder */}
          <div className="mt-6 pt-5 border-t border-neutral-800">
            <p className="text-neutral-600 text-sm italic">
              No review yet.
            </p>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="mt-4 w-full py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-sm font-medium transition-colors duration-200"
          >
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Genre order ─────────────────────────────────────────────
const GENRE_ORDER = [
  "Hip-Hop",
  "Electronic",
  "Post-Punk / New Wave / Goth / Coldwave",
  "Metal / Extreme / Hardcore",
  "Indie / Alternative",
  "Classic Rock / Funk / Soul / R&B",
  "Shoegaze / Dream Pop / Post-Rock",
  "Experimental / Art Rock / Krautrock",
  "Russian",
  "Dub / Reggae / World / Global",
  "Ambient / Drone / Modern Classical",
  "Pop / Mainstream / OST",
  "Japanese",
  "Jazz",
  "Other",
];

// ── Main Page ───────────────────────────────────────────────
export default function Home() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Album | null>(null);

  const filtered = albums.filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.artist.toLowerCase().includes(q) ||
      a.title.toLowerCase().includes(q)
    );
  });

  // Group filtered albums by genre in defined order
  const grouped = useMemo(() => {
    const map = new Map<string, Album[]>();
    for (const genre of GENRE_ORDER) {
      map.set(genre, []);
    }
    for (const album of filtered) {
      const g = album.genre || "Other";
      const list = map.get(g);
      if (list) {
        list.push(album);
      } else {
        const other = map.get("Other")!;
        other.push(album);
      }
    }
    // Return only non-empty groups
    return GENRE_ORDER
      .filter((g) => (map.get(g)?.length ?? 0) > 0)
      .map((g) => ({ genre: g, albums: map.get(g)! }));
  }, [filtered]);

  const handleSelect = useCallback((album: Album) => {
    setSelected(album);
  }, []);

  const handleClose = useCallback(() => {
    setSelected(null);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-neutral-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-shrink-0">
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-wider">
                DJ VCR TOP 500
              </h1>
              <p className="text-neutral-600 text-xs mt-0.5">
                {filtered.length} of {albums.length} albums
              </p>
            </div>
            <div className="flex-1 sm:max-w-md sm:ml-auto">
              <input
                type="text"
                placeholder="Search artist or album..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-4 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-white text-sm placeholder-neutral-600 outline-none focus:border-neutral-600 transition-colors duration-200"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Album Grid — grouped by genre */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {grouped.length > 0 ? (
          grouped.map(({ genre, albums: genreAlbums }) => (
            <section key={genre} className="mb-10">
              <h2 className="text-white text-xl sm:text-2xl font-bold mt-6 mb-4">
                {genre}
              </h2>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 sm:gap-4">
                {genreAlbums.map((album, i) => (
                  <AlbumCard
                    key={album.id}
                    album={album}
                    index={i}
                    onClick={() => handleSelect(album)}
                  />
                ))}
              </div>
            </section>
          ))
        ) : (
          <div className="text-center py-20">
            <p className="text-neutral-600 text-lg">
              No albums found for &ldquo;{search}&rdquo;
            </p>
          </div>
        )}
      </main>

      {/* Modal */}
      <AnimatePresence>
        {selected && (
          <AlbumModal album={selected} onClose={handleClose} />
        )}
      </AnimatePresence>
    </div>
  );
}
