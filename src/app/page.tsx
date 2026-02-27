"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { albums, Album } from "../data/albums";
import { albumTags } from "../data/albumTags";

// ── CONSTANTS ───────────────────────────────────────────────

const MOODS = [
  { label: "Sad", emoji: "😢" },
  { label: "Euphoric", emoji: "🤩" },
  { label: "Melancholic", emoji: "💜" },
  { label: "Angry", emoji: "😤" },
  { label: "Deep", emoji: "🧠" },
  { label: "Trippy", emoji: "🍄" },
  { label: "Nostalgic", emoji: "📼" },
  { label: "Eerie", emoji: "👻" },
];

const TIMES = [
  { label: "Night", emoji: "🌙" },
  { label: "Morning", emoji: "🌅" },
  { label: "Day", emoji: "☀️" },
  { label: "Sunset", emoji: "🌇" },
  { label: "Late Night", emoji: "🦉" },
];

const ENERGIES = [
  { label: "Calm", emoji: "🧘" },
  { label: "Cozy", emoji: "🏠" },
  { label: "Groovy", emoji: "🕺" },
  { label: "Energetic", emoji: "⚡" },
  { label: "Aggressive", emoji: "💥" },
  { label: "Dark", emoji: "🖤" },
  { label: "Dreamy", emoji: "💭" },
  { label: "Weird", emoji: "🎭" },
];

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

const GENRE_LABELS: Record<string, string> = {
  "Hip-Hop": "Hip-Hop",
  Electronic: "Electronic",
  "Post-Punk / New Wave / Goth / Coldwave": "Post-Punk",
  "Metal / Extreme / Hardcore": "Metal",
  "Indie / Alternative": "Indie",
  "Classic Rock / Funk / Soul / R&B": "Classic Rock",
  "Shoegaze / Dream Pop / Post-Rock": "Shoegaze",
  "Experimental / Art Rock / Krautrock": "Experimental",
  Russian: "Russian",
  "Dub / Reggae / World / Global": "Dub/Reggae/World",
  "Ambient / Drone / Modern Classical": "Ambient",
  "Pop / Mainstream / OST": "Pop/OST",
  Japanese: "Japanese",
  Jazz: "Jazz",
  Other: "Other",
};

// ── UTILS ───────────────────────────────────────────────────

function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 45%, 35%)`;
}

function getInitials(name: string): string {
  return name
    .split(/[\s&]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

// ── ICONS & LINKS ───────────────────────────────────────────

const StreamingIcons: Record<string, React.ReactNode> = {
  Spotify: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
  ),
  "Apple Music": (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043A5.022 5.022 0 0019.7.28C18.96.12 18.21.06 17.46.024 16.5 0 15.54 0 14.58 0H9.42C8.46 0 7.5 0 6.54.024 5.79.06 5.04.12 4.3.28a5.022 5.022 0 00-1.874.611C1.308 1.624.563 2.624.246 3.934a9.23 9.23 0 00-.24 2.19C0 7.5 0 8.88 0 10.26v3.48c0 1.38 0 2.76.006 4.14a9.23 9.23 0 00.24 2.19c.317 1.31 1.062 2.31 2.18 3.043a5.022 5.022 0 001.874.611c.74.16 1.49.22 2.24.256.96.024 1.92.024 2.88.024h5.16c.96 0 1.92 0 2.88-.024.75-.036 1.5-.096 2.24-.256a5.022 5.022 0 001.874-.611c1.118-.733 1.863-1.733 2.18-3.043a9.23 9.23 0 00.24-2.19c.006-1.38.006-2.76.006-4.14v-3.48c0-1.38 0-2.76-.006-4.136zM17.46 17.206c0 .36-.18.6-.48.72-.12.06-.24.06-.36.06-.18 0-.36-.06-.54-.18l-2.16-1.26V18c0 1.74-1.38 3.18-3.12 3.3h-.24c-1.8-.06-3.24-1.56-3.24-3.36 0-1.8 1.44-3.3 3.24-3.36h.24c.36.024.72.12 1.08.24V7.56c0-.48.36-.84.78-.9l4.2-.78c.06 0 .12-.024.18-.024.3 0 .54.24.54.54l.06 10.81z"/>
    </svg>
  ),
  "YouTube Music": (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm0 19.104c-3.924 0-7.104-3.18-7.104-7.104S8.076 4.896 12 4.896s7.104 3.18 7.104 7.104-3.18 7.104-7.104 7.104zm0-13.332c-3.432 0-6.228 2.796-6.228 6.228S8.568 18.228 12 18.228 18.228 15.432 18.228 12 15.432 5.772 12 5.772zM9.684 15.54V8.46L15.816 12l-6.132 3.54z"/>
    </svg>
  ),
  Bandcamp: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M0 18.75l7.437-13.5H24l-7.438 13.5z"/>
    </svg>
  ),
  "Яндекс Музыка": (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M12 24c6.627 0 12-5.373 12-12S18.627 0 12 0 0 5.373 0 12s5.373 12 12 12zm1.385-18.52v4.477l2.6-4.478h2.345L15.2 11.192l3.538 5.328h-2.566l-2.787-4.477v4.477h-1.97V5.48z"/>
    </svg>
  ),
  "VK Music": (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.391 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.864-.525-2.05-1.727-1.033-1-1.49-1.135-1.744-1.135-.356 0-.458.102-.458.593v1.575c0 .424-.135.678-1.253.678-1.846 0-3.896-1.118-5.335-3.202C4.624 10.857 4 8.57 4 8.096c0-.254.102-.491.593-.491h1.744c.44 0 .61.203.78.678.847 2.457 2.27 4.607 2.862 4.607.22 0 .322-.102.322-.66V9.793c-.068-1.186-.695-1.287-.695-1.71 0-.203.17-.407.44-.407h2.744c.373 0 .508.203.508.643v3.473c0 .372.17.508.271.508.22 0 .407-.136.813-.542 1.254-1.406 2.151-3.574 2.151-3.574.119-.254.322-.491.763-.491h1.744c.525 0 .644.27.525.643-.22 1.017-2.354 4.031-2.354 4.031-.186.305-.254.44 0 .78.186.254.796.779 1.203 1.253.745.847 1.32 1.558 1.473 2.05.17.49-.085.744-.576.744z"/>
    </svg>
  ),
};

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

// ── COMPONENTS ──────────────────────────────────────────────

function AlbumCard({
  album,
  onClick,
}: {
  album: Album;
  index: number;
  onClick: () => void;
}) {
  const bg = stringToColor(album.artist + album.title);
  const initials = getInitials(album.artist);
  const [imgError, setImgError] = useState(false);
  const [showStreaming, setShowStreaming] = useState(false);
  const hasCover = !!album.cover && !imgError;
  const links = getStreamingLinks(album.artist, album.title);
  const cardRef = useRef<HTMLDivElement>(null);

  // Close streaming overlay when clicking outside
  useEffect(() => {
    if (!showStreaming) return;
    const handler = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setShowStreaming(false);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [showStreaming]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowStreaming(!showStreaming);
  };

  return (
    <div ref={cardRef} className="group cursor-pointer relative">
      <div
        onClick={handleClick}
        className="relative aspect-square rounded-lg overflow-hidden"
      >
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
            <span className="text-white/60 font-bold text-2xl sm:text-4xl select-none tracking-wider">
              {initials}
            </span>
          </div>
        )}

        {/* Streaming overlay on hover (desktop) / tap (mobile) */}
        <div
          className={`absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center transition-all duration-200 ${
            showStreaming ? "opacity-100" : "opacity-0 sm:group-hover:opacity-100 pointer-events-none sm:group-hover:pointer-events-auto"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="grid grid-cols-3 gap-2 p-3">
            {links.map((link) => (
              <a
                key={link.name}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                title={link.name}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full transition-all duration-200 hover:scale-110"
                style={{
                  background: `${link.color}30`,
                  color: link.color,
                  border: `1px solid ${link.color}40`,
                }}
              >
                <div className="w-5 h-5">{StreamingIcons[link.name]}</div>
              </a>
            ))}
          </div>
        </div>
      </div>
      <div className="px-0.5 mt-1.5">
        <p className="text-white text-xs sm:text-sm font-semibold truncate leading-tight">
          {album.artist}
        </p>
        <p className="text-neutral-500 text-[10px] sm:text-xs truncate mt-0.5">
          {album.title}
        </p>
      </div>
    </div>
  );
}

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
  const tags = albumTags[album.id];

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
        className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="overflow-y-auto">
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
          <div className="p-6">
            <h2 className="text-white text-2xl font-bold leading-tight">
              {album.artist}
            </h2>
            <h3 className="text-neutral-400 text-lg mt-1">{album.title}</h3>
            {tags && (
              <div className="mt-4 flex flex-wrap gap-2">
                {tags.mood.map((t) => (
                  <span key={t} className="text-xs px-2 py-1 rounded bg-blue-900/30 text-blue-200 border border-blue-800/50">{t}</span>
                ))}
                {tags.time.map((t) => (
                  <span key={t} className="text-xs px-2 py-1 rounded bg-orange-900/30 text-orange-200 border border-orange-800/50">{t}</span>
                ))}
                {tags.energy.map((t) => (
                  <span key={t} className="text-xs px-2 py-1 rounded bg-purple-900/30 text-purple-200 border border-purple-800/50">{t}</span>
                ))}
              </div>
            )}
            <div className="grid grid-cols-3 gap-2 mt-5">
              {links.map((link) => (
                <a
                  key={link.name}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={link.name}
                  className="flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200 hover:scale-110 hover:brightness-125 mx-auto"
                  style={{
                    background: `${link.color}18`,
                    color: link.color,
                    border: `1px solid ${link.color}25`,
                  }}
                >
                  <div className="w-5 h-5">{StreamingIcons[link.name]}</div>
                </a>
              ))}
            </div>
            <div className="mt-6 pt-5 border-t border-neutral-800">
              <p className="text-neutral-600 text-sm italic">No review yet.</p>
            </div>
            <button
              onClick={onClose}
              className="mt-4 w-full py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-sm font-medium transition-colors duration-200"
            >
              Close
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── BOTTOM SHEET ────────────────────────────────────────────

function BottomSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[60] bg-black/60 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />
      {/* Sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-[61] bg-neutral-900 border-t border-neutral-700 rounded-t-2xl max-h-[80vh] overflow-y-auto transition-transform duration-300 ease-out ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="w-10 h-1 bg-neutral-600 rounded-full mx-auto mt-3 mb-2" />
        {children}
      </div>
    </>
  );
}

// ── MAIN PAGE ───────────────────────────────────────────────

export default function Home() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Album | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Filter States
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set());
  const [selectedMoods, setSelectedMoods] = useState<Set<string>>(new Set());
  const [selectedTimes, setSelectedTimes] = useState<Set<string>>(new Set());
  const [selectedEnergies, setSelectedEnergies] = useState<Set<string>>(new Set());

  // Draft states for bottom sheet
  const [draftGenres, setDraftGenres] = useState<Set<string>>(new Set());
  const [draftMoods, setDraftMoods] = useState<Set<string>>(new Set());
  const [draftTimes, setDraftTimes] = useState<Set<string>>(new Set());
  const [draftEnergies, setDraftEnergies] = useState<Set<string>>(new Set());

  // Randomizer state
  const [randomAlbum, setRandomAlbum] = useState<Album | null>(null);
  const [isRandomizing, setIsRandomizing] = useState(false);

  const toggleSet = (set: Set<string>, val: string, update: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    update(next);
  };

  const resetFilters = () => {
    setSelectedGenres(new Set());
    setSelectedMoods(new Set());
    setSelectedTimes(new Set());
    setSelectedEnergies(new Set());
  };

  const activeFiltersCount =
    selectedGenres.size + selectedMoods.size + selectedTimes.size + selectedEnergies.size;
  const hasFilters = activeFiltersCount > 0;

  // Open sheet: copy current filters to draft
  const openSheet = () => {
    setDraftGenres(new Set(selectedGenres));
    setDraftMoods(new Set(selectedMoods));
    setDraftTimes(new Set(selectedTimes));
    setDraftEnergies(new Set(selectedEnergies));
    setSheetOpen(true);
  };

  const applySheet = () => {
    setSelectedGenres(new Set(draftGenres));
    setSelectedMoods(new Set(draftMoods));
    setSelectedTimes(new Set(draftTimes));
    setSelectedEnergies(new Set(draftEnergies));
    setSheetOpen(false);
  };

  const resetSheet = () => {
    setDraftGenres(new Set());
    setDraftMoods(new Set());
    setDraftTimes(new Set());
    setDraftEnergies(new Set());
  };

  // Filter Logic
  const filtered = albums.filter((a) => {
    if (search) {
      const q = search.toLowerCase();
      if (!a.artist.toLowerCase().includes(q) && !a.title.toLowerCase().includes(q)) return false;
    }
    if (selectedGenres.size > 0 && !selectedGenres.has(a.genre || "Other")) return false;
    const tags = albumTags[a.id];
    if ((selectedMoods.size > 0 || selectedTimes.size > 0 || selectedEnergies.size > 0) && !tags) return false;
    if (tags) {
      if (selectedMoods.size > 0 && !tags.mood.some((m) => selectedMoods.has(m))) return false;
      if (selectedTimes.size > 0 && !tags.time.some((t) => selectedTimes.has(t))) return false;
      if (selectedEnergies.size > 0 && !tags.energy.some((e) => selectedEnergies.has(e))) return false;
    }
    return true;
  });

  // Randomizer
  const handleRandom = () => {
    if (filtered.length === 0 || isRandomizing) return;
    setIsRandomizing(true);
    let count = 0;
    const maxFlips = 8;
    const interval = setInterval(() => {
      const rand = filtered[Math.floor(Math.random() * filtered.length)];
      setRandomAlbum(rand);
      count++;
      if (count >= maxFlips) {
        clearInterval(interval);
        const final = filtered[Math.floor(Math.random() * filtered.length)];
        setRandomAlbum(final);
        setSelected(final);
        setIsRandomizing(false);
        setTimeout(() => setRandomAlbum(null), 300);
      }
    }, 100);
  };

  // Group filtered albums by genre
  const grouped = useMemo(() => {
    const map = new Map<string, Album[]>();
    for (const genre of GENRE_ORDER) map.set(genre, []);
    for (const album of filtered) {
      const g = album.genre || "Other";
      const list = map.get(g);
      if (list) list.push(album);
      else map.get("Other")!.push(album);
    }
    return GENRE_ORDER
      .filter((g) => (map.get(g)?.length ?? 0) > 0)
      .map((g) => ({ genre: g, albums: map.get(g)! }));
  }, [filtered]);

  const handleSelect = useCallback((album: Album) => setSelected(album), []);
  const handleClose = useCallback(() => setSelected(null), []);

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="bg-[#0a0a0a] border-b border-neutral-800/50">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <div className="flex-shrink-0 flex items-center justify-between">
              <div>
                <h1 className="text-lg sm:text-2xl font-bold text-white tracking-wider">
                  Vova Egorov TOP 500
                </h1>
                <p className="text-neutral-600 text-xs mt-0.5">
                  
                </p>
              </div>
              {/* Mobile buttons: Filters + Random */}
              <div className="flex items-center gap-2 sm:hidden">
                <button
                  onClick={handleRandom}
                  disabled={filtered.length === 0 || isRandomizing}
                  className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-white text-sm font-medium disabled:opacity-30 active:scale-95 transition-all"
                >
                  🎲
                </button>
                <button
                  onClick={openSheet}
                  className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-white text-sm font-medium active:scale-95 transition-all"
                >
                  Filters{activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ""}
                </button>
              </div>
            </div>
            <div className="flex-1 sm:max-w-md sm:ml-auto flex items-center gap-2">
              <input
                type="text"
                placeholder="Search artist or album..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 px-4 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-white text-sm placeholder-neutral-600 outline-none focus:border-neutral-600 transition-colors duration-200"
              />
              {/* Desktop random button */}
              <button
                onClick={handleRandom}
                disabled={filtered.length === 0 || isRandomizing}
                className="hidden sm:flex px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-white text-sm font-medium disabled:opacity-30 hover:bg-neutral-700 transition-all items-center gap-1.5"
              >
                🎲 Lucky
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── FILTER BAR (Desktop only) ── */}
      <div className="hidden sm:block sticky top-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-md border-b border-neutral-800/50 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col gap-3">
          {/* Row 1: Genres */}
          <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-1">
            <button
              onClick={() => setSelectedGenres(new Set())}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-all duration-200 ${
                selectedGenres.size === 0
                  ? "bg-white text-black border-white"
                  : "text-gray-400 border-[#333] hover:border-neutral-500"
              }`}
            >
              All Genres
            </button>
            {GENRE_ORDER.map((genre) => (
              <button
                key={genre}
                onClick={() => toggleSet(selectedGenres, genre, setSelectedGenres)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-all duration-200 ${
                  selectedGenres.has(genre)
                    ? "bg-white text-black border-white"
                    : "text-gray-400 border-[#333] hover:border-neutral-500"
                }`}
              >
                {GENRE_LABELS[genre] || genre}
              </button>
            ))}
          </div>
          <div className="border-t border-neutral-800/50" />
          {/* Row 2: Vibe */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-wider w-12 flex-shrink-0">Vibe</span>
            {MOODS.map((m) => (
              <button
                key={m.label}
                onClick={() => toggleSet(selectedMoods, m.label, setSelectedMoods)}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-all duration-200 flex items-center gap-1.5 ${
                  selectedMoods.has(m.label)
                    ? "bg-blue-100 text-blue-900 border-blue-200"
                    : "text-neutral-400 border-[#2a2a2a] hover:border-neutral-600 bg-[#111]"
                }`}
              >
                <span>{m.emoji}</span> {m.label}
              </button>
            ))}
          </div>
          {/* Row 3: Time */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-wider w-12 flex-shrink-0">Time</span>
            {TIMES.map((t) => (
              <button
                key={t.label}
                onClick={() => toggleSet(selectedTimes, t.label, setSelectedTimes)}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-all duration-200 flex items-center gap-1.5 ${
                  selectedTimes.has(t.label)
                    ? "bg-orange-100 text-orange-900 border-orange-200"
                    : "text-neutral-400 border-[#2a2a2a] hover:border-neutral-600 bg-[#111]"
                }`}
              >
                <span>{t.emoji}</span> {t.label}
              </button>
            ))}
          </div>
          {/* Row 4: Energy */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 relative">
            <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-wider w-12 flex-shrink-0">Energy</span>
            {ENERGIES.map((e) => (
              <button
                key={e.label}
                onClick={() => toggleSet(selectedEnergies, e.label, setSelectedEnergies)}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-all duration-200 flex items-center gap-1.5 ${
                  selectedEnergies.has(e.label)
                    ? "bg-purple-100 text-purple-900 border-purple-200"
                    : "text-neutral-400 border-[#2a2a2a] hover:border-neutral-600 bg-[#111]"
                }`}
              >
                <span>{e.emoji}</span> {e.label}
              </button>
            ))}
            {hasFilters && (
              <button
                onClick={resetFilters}
                className="ml-auto sticky right-0 flex-shrink-0 px-3 py-1 text-xs text-red-400 hover:text-red-300 bg-red-900/20 rounded border border-red-900/50 backdrop-blur-xl"
              >
                ✕ Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── MOBILE BOTTOM SHEET ── */}
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
        <div className="px-4 pb-6 flex flex-col gap-4">
          <h3 className="text-white font-bold text-lg text-center">Filters</h3>

          {/* Genres */}
          <div>
            <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-2">Genre</p>
            <div className="flex flex-wrap gap-2">
              {GENRE_ORDER.map((genre) => (
                <button
                  key={genre}
                  onClick={() => toggleSet(draftGenres, genre, setDraftGenres)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    draftGenres.has(genre)
                      ? "bg-white text-black border-white"
                      : "text-gray-400 border-[#333]"
                  }`}
                >
                  {GENRE_LABELS[genre] || genre}
                </button>
              ))}
            </div>
          </div>

          {/* Vibe */}
          <div>
            <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-2">Vibe</p>
            <div className="flex flex-wrap gap-2">
              {MOODS.map((m) => (
                <button
                  key={m.label}
                  onClick={() => toggleSet(draftMoods, m.label, setDraftMoods)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-all flex items-center gap-1 ${
                    draftMoods.has(m.label)
                      ? "bg-blue-100 text-blue-900 border-blue-200"
                      : "text-neutral-400 border-[#2a2a2a] bg-[#111]"
                  }`}
                >
                  {m.emoji} {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time */}
          <div>
            <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-2">Time</p>
            <div className="flex flex-wrap gap-2">
              {TIMES.map((t) => (
                <button
                  key={t.label}
                  onClick={() => toggleSet(draftTimes, t.label, setDraftTimes)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-all flex items-center gap-1 ${
                    draftTimes.has(t.label)
                      ? "bg-orange-100 text-orange-900 border-orange-200"
                      : "text-neutral-400 border-[#2a2a2a] bg-[#111]"
                  }`}
                >
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Energy */}
          <div>
            <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-2">Energy</p>
            <div className="flex flex-wrap gap-2">
              {ENERGIES.map((e) => (
                <button
                  key={e.label}
                  onClick={() => toggleSet(draftEnergies, e.label, setDraftEnergies)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-all flex items-center gap-1 ${
                    draftEnergies.has(e.label)
                      ? "bg-purple-100 text-purple-900 border-purple-200"
                      : "text-neutral-400 border-[#2a2a2a] bg-[#111]"
                  }`}
                >
                  {e.emoji} {e.label}
                </button>
              ))}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={resetSheet}
              className="flex-1 py-2.5 bg-neutral-800 text-red-400 rounded-xl text-sm font-medium"
            >
              Reset
            </button>
            <button
              onClick={applySheet}
              className="flex-1 py-2.5 bg-white text-black rounded-xl text-sm font-bold"
            >
              Apply
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* Randomizer visual feedback */}
      <AnimatePresence>
        {isRandomizing && randomAlbum && (
          <motion.div
            key={randomAlbum.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-40 h-40 rounded-xl overflow-hidden shadow-2xl pointer-events-none"
          >
            {randomAlbum.cover ? (
              <img src={randomAlbum.cover} className="w-full h-full object-cover" alt="" />
            ) : (
              <div className="w-full h-full flex items-center justify-center" style={{ background: stringToColor(randomAlbum.artist + randomAlbum.title) }}>
                <span className="text-white/60 font-bold text-3xl">{getInitials(randomAlbum.artist)}</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Album Grid */}
      <main className="max-w-7xl mx-auto px-2 sm:px-6 py-4 sm:py-6">
        {grouped.length > 0 ? (
          grouped.map(({ genre, albums: genreAlbums }) => {
            if (selectedGenres.size > 0 && !selectedGenres.has(genre)) return null;
            return (
              <section key={genre} className="mb-6 sm:mb-10 animate-fadeIn">
                <h2 className="text-white text-lg sm:text-2xl font-bold mt-4 sm:mt-6 mb-3 sm:mb-4 flex items-center gap-3 px-1">
                  {genre}
                  <span className="text-neutral-600 text-sm font-normal">{genreAlbums.length}</span>
                </h2>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1.5 sm:gap-3">
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
            );
          })
        ) : (
          <div className="text-center py-32">
            <p className="text-neutral-500 text-lg">No albums match this mood combination 🌑</p>
            <button
              onClick={resetFilters}
              className="mt-4 px-6 py-2 bg-white text-black rounded-full text-sm font-medium hover:bg-neutral-200"
            >
              Clear Filters
            </button>
          </div>
        )}
      </main>

      {/* Modal */}
      <AnimatePresence>
        {selected && <AlbumModal album={selected} onClose={handleClose} />}
      </AnimatePresence>
    </div>
  );
}
