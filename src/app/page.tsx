"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef, useReducer } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { albums, Album } from "../data/albums";
import { albumTags } from "../data/albumTags";
import { albumReviews } from "../data/albumReviews";
import Fuse from "fuse.js";
import { FastAverageColor } from "fast-average-color";

// ── CONSTANTS ───────────────────────────────────────────────

const MOODS = ["Sad", "Euphoric", "Melancholic", "Angry", "Deep", "Trippy", "Nostalgic", "Eerie"];

const TIMES = ["Night", "Morning", "Day", "Sunset", "Late Night"];

const ENERGIES = ["Calm", "Cozy", "Groovy", "Energetic", "Aggressive", "Dark", "Dreamy", "Weird"];

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
    <img src="/icons/applemusiclogo.png" alt="Apple Music" className="w-full h-full object-cover rounded-full" />
  ),
  YouTube: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
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
    <img src="/icons/yandexlogo.png" alt="Яндекс Музыка" className="w-full h-full object-cover rounded-full" />
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
    { name: "YouTube", url: `https://www.youtube.com/results?search_query=${q}`, color: "#FF0000" },
    { name: "YouTube Music", url: `https://music.youtube.com/search?q=${q}`, color: "#FF4E45" },
    { name: "Bandcamp", url: `https://bandcamp.com/search?q=${q}`, color: "#1DA0C3" },
    { name: "Яндекс Музыка", url: `https://music.yandex.ru/search?text=${q}`, color: "#FFDB4D" },
    { name: "VK Music", url: `https://vk.com/audio?q=${q}`, color: "#0077FF" },
  ];
}

// ── COLOR CACHE (for ambient glow) ──────────────────────────

const fac = new FastAverageColor();
const glowColorCache = new Map<string, string>();

// ── DEEZER PREVIEW ──────────────────────────────────────────

const previewCache = new Map<string, string | null>();

async function fetchDeezerPreview(artist: string, title: string): Promise<string | null> {
  const key = `${artist}|${title}`;
  if (previewCache.has(key)) return previewCache.get(key)!;
  try {
    const q = `${artist} ${title}`;
    const res = await fetch(`/api/deezer?q=${encodeURIComponent(q)}`, {
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    const preview = data?.preview || null;
    previewCache.set(key, preview);
    return preview;
  } catch {
    previewCache.set(key, null);
    return null;
  }
}

// ── COMPONENTS ──────────────────────────────────────────────

const AlbumCard = React.memo(function AlbumCard({
  album,
  onClick,
  isPlaying,
  onPlayToggle,
}: {
  album: Album;
  index: number;
  onClick: () => void;
  isPlaying: boolean;
  onPlayToggle: (album: Album) => void;
}) {
  const bg = stringToColor(album.artist + album.title);
  const initials = getInitials(album.artist);
  const [imgError, setImgError] = useState(false);
  const [showStreaming, setShowStreaming] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const hasCover = !!album.cover && !imgError;
  const links = getStreamingLinks(album.artist, album.title);
  const cardRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const handlePlay = async (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isPlaying) {
      onPlayToggle(album);
      return;
    }
    setLoadingPreview(true);
    onPlayToggle(album);
    setLoadingPreview(false);
  };

  // Long press for mobile
  const handleTouchStart = () => {
    longPressTimer.current = setTimeout(() => {
      onPlayToggle(album);
    }, 500);
  };
  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  return (
    <div ref={cardRef} className="group cursor-pointer relative"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <div
        onClick={handleClick}
        className={`album-cover relative aspect-square rounded-lg ${isPlaying ? "ring-2 ring-green-500/70" : ""}`}
        style={glowColorCache.has(album.id) ? { "--glow": glowColorCache.get(album.id) } as React.CSSProperties : undefined}
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
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
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
          <div className="grid grid-cols-4 gap-1.5 p-2">
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

        {/* Play preview button */}
        <button
          onClick={handlePlay}
          className={`absolute bottom-1.5 right-1.5 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all duration-200 z-10 ${
            isPlaying
              ? "bg-green-500 text-black animate-pulse scale-110"
              : "bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-black/80"
          } ${loadingPreview ? "animate-spin" : ""}`}
          title={isPlaying ? "Stop preview" : "Play 30s preview"}
        >
          {isPlaying ? (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 ml-0.5">
              <path d="M8 5.14v14l11-7-11-7z" />
            </svg>
          )}
        </button>
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
});

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
  const [glowColor, setGlowColor] = useState<string | null>(
    glowColorCache.get(album.id) || null
  );
  const imgRef = useRef<HTMLImageElement>(null);

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

  const handleImgLoad = useCallback(() => {
    if (glowColorCache.has(album.id)) {
      setGlowColor(glowColorCache.get(album.id)!);
      return;
    }
    if (!imgRef.current) return;
    fac.getColorAsync(imgRef.current)
      .then((color) => {
        const c = `${color.value[0]},${color.value[1]},${color.value[2]}`;
        glowColorCache.set(album.id, c);
        setGlowColor(c);
      })
      .catch(() => {});
  }, [album.id]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
      className="fixed inset-0 z-50 backdrop-blur-sm flex items-center justify-center p-4"
      style={{
        background: glowColor
          ? `radial-gradient(ellipse at center, rgba(${glowColor},0.15) 0%, rgba(0,0,0,0.8) 70%)`
          : "rgba(0,0,0,0.8)",
        transition: "background 0.5s ease",
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]"
        style={{
          boxShadow: glowColor
            ? `0 0 120px 40px rgba(${glowColor},0.25)`
            : "none",
          transition: "box-shadow 0.5s ease",
        }}
      >
        <div className="overflow-y-auto">
          {hasCover ? (
            <img
              ref={imgRef}
              src={album.cover}
              alt={`${album.artist} — ${album.title}`}
              onError={() => setImgError(true)}
              onLoad={handleImgLoad}
              crossOrigin="anonymous"
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
                {[...tags.mood, ...tags.time, ...tags.energy].map((t) => (
                  <span key={t} className="text-xs px-2 py-1 rounded bg-white/5 text-white/70 border border-white/10">{t}</span>
                ))}
              </div>
            )}
            <div className="grid grid-cols-4 gap-2 mt-5">
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
              {albumReviews[album.id] ? (
                <p className="text-neutral-300 text-sm leading-relaxed whitespace-pre-line">{albumReviews[album.id]}</p>
              ) : (
                <p className="text-neutral-600 text-sm italic">No review yet.</p>
              )}
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

// ── RADIO PLAYER BAR ────────────────────────────────────────

function RadioPlayerBar({
  album,
  isPlaying,
  progress,
  onPrev,
  onPauseResume,
  onNext,
  onClose,
}: {
  album: Album;
  isPlaying: boolean;
  progress: number;
  onPrev: () => void;
  onPauseResume: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const bg = stringToColor(album.artist + album.title);
  const hasCover = !!album.cover;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[55] bg-neutral-900/95 backdrop-blur-md border-t border-neutral-800 h-14">
      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-neutral-800">
        <div
          className="h-full bg-green-500 transition-all duration-300 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="max-w-7xl mx-auto h-full px-3 flex items-center gap-3">
        {/* Cover */}
        <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0">
          {hasCover ? (
            <img src={album.cover} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[10px] text-white/60 font-bold" style={{ background: bg }}>
              {getInitials(album.artist)}
            </div>
          )}
        </div>
        {/* Track info */}
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-semibold truncate">{album.artist}</p>
          <p className="text-neutral-500 text-[10px] truncate">{album.title}</p>
        </div>
        {/* Controls */}
        <div className="flex items-center gap-1">
          <button onClick={onPrev} className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-white transition-colors">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
          </button>
          <button onClick={onPauseResume} className="w-9 h-9 flex items-center justify-center bg-white rounded-full text-black hover:scale-105 transition-transform">
            {isPlaying ? (
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 ml-0.5"><path d="M8 5.14v14l11-7-11-7z"/></svg>
            )}
          </button>
          <button onClick={onNext} className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-white transition-colors">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
          </button>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-neutral-500 hover:text-red-400 transition-colors ml-1">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── AUTO-VIBE ──────────────────────────────────────────────

interface AutoVibe {
  moods: string[];
  times: string[];
  energies: string[];
  label: string;
}

function getTimeVibe(): AutoVibe {
  const hour = new Date().getHours();
  if (hour >= 0 && hour < 6) return { moods: ["Melancholic"], times: ["Late Night"], energies: ["Dark"], label: "Late night" };
  if (hour >= 6 && hour < 12) return { moods: ["Euphoric"], times: ["Morning"], energies: [], label: "Morning" };
  if (hour >= 12 && hour < 18) return { moods: [], times: ["Day"], energies: ["Energetic"], label: "Afternoon" };
  return { moods: [], times: ["Sunset"], energies: ["Calm"], label: "Evening" };
}

function weatherToVibe(weatherCode: number, desc: string): { moods: string[]; energies: string[]; word: string } {
  const d = desc.toLowerCase();
  if (d.includes("rain") || d.includes("drizzle") || d.includes("thunder") || weatherCode >= 200 && weatherCode < 600)
    return { moods: ["Melancholic"], energies: [], word: "Rainy" };
  if (d.includes("snow") || weatherCode >= 600 && weatherCode < 700)
    return { moods: [], energies: ["Dreamy"], word: "Snowy" };
  if (d.includes("cloud") || d.includes("overcast") || d.includes("fog") || d.includes("mist"))
    return { moods: [], energies: ["Calm"], word: "Cloudy" };
  return { moods: ["Euphoric"], energies: [], word: "Clear" };
}

async function fetchWeather(): Promise<{ code: number; desc: string } | null> {
  try {
    const res = await fetch("https://wttr.in/?format=j1", { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    const cur = data?.current_condition?.[0];
    if (!cur) return null;
    return { code: parseInt(cur.weatherCode || "0"), desc: cur.weatherDesc?.[0]?.value || "" };
  } catch {
    return null;
  }
}

// ── FILTER STATE ────────────────────────────────────────────

type FilterState = {
  genres: Set<string>;
  moods: Set<string>;
  times: Set<string>;
  energies: Set<string>;
};

const initialFilters: FilterState = {
  genres: new Set(),
  moods: new Set(),
  times: new Set(),
  energies: new Set(),
};

type FilterAction =
  | { type: "toggle"; category: keyof FilterState; value: string }
  | { type: "set"; payload: FilterState }
  | { type: "reset" }
  | { type: "merge"; moods?: string[]; energies?: string[] };

function filterReducer(state: FilterState, action: FilterAction): FilterState {
  switch (action.type) {
    case "toggle": {
      const next = new Set(state[action.category]);
      if (next.has(action.value)) next.delete(action.value);
      else next.add(action.value);
      return { ...state, [action.category]: next };
    }
    case "set":
      return action.payload;
    case "reset":
      return initialFilters;
    case "merge": {
      const m = new Set(state.moods);
      const e = new Set(state.energies);
      action.moods?.forEach((v) => m.add(v));
      action.energies?.forEach((v) => e.add(v));
      return { ...state, moods: m, energies: e };
    }
  }
}

function cloneFilters(f: FilterState): FilterState {
  return { genres: new Set(f.genres), moods: new Set(f.moods), times: new Set(f.times), energies: new Set(f.energies) };
}

function scoreAlbum(album: Album, f: FilterState): number {
  const tags = albumTags[album.id];
  if (!tags) return 0;
  let score = 0;
  let maxScore = 0;
  if (f.moods.size > 0) {
    maxScore += 1;
    if (tags.mood.some((m) => f.moods.has(m))) score += 1;
  }
  if (f.times.size > 0) {
    maxScore += 1;
    if (tags.time.some((t) => f.times.has(t))) score += 1;
  }
  if (f.energies.size > 0) {
    maxScore += 1;
    if (tags.energy.some((e) => f.energies.has(e))) score += 1;
  }
  return maxScore === 0 ? 1 : score / maxScore;
}

// ── TOAST ───────────────────────────────────────────────────

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[80] px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-full text-xs text-neutral-300 shadow-xl backdrop-blur-md"
    >
      {message}
    </motion.div>
  );
}

// ── MAIN PAGE ───────────────────────────────────────────────

export default function Home() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Album | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [vibeLabel, setVibeLabel] = useState<string | null>(null);

  // Filter state (single reducer replaces 8 useState)
  const [filters, dispatch] = useReducer(filterReducer, initialFilters);
  const [draftFilters, setDraftFilters] = useState<FilterState | null>(null);

  // Init: URL params → autoVibe fallback
  useEffect(() => {
    // Check URL first
    const params = new URLSearchParams(window.location.search);
    const urlGenres = params.get("genre")?.split(",").filter(Boolean) ?? [];
    const urlMoods = params.get("mood")?.split(",").filter(Boolean) ?? [];
    const urlTimes = params.get("time")?.split(",").filter(Boolean) ?? [];
    const urlEnergies = params.get("energy")?.split(",").filter(Boolean) ?? [];
    if (urlGenres.length || urlMoods.length || urlTimes.length || urlEnergies.length) {
      dispatch({
        type: "set",
        payload: { genres: new Set(urlGenres), moods: new Set(urlMoods), times: new Set(urlTimes), energies: new Set(urlEnergies) },
      });
      return;
    }

    // AutoVibe (no URL params)
    const stored = sessionStorage.getItem("autoVibeDone");
    if (stored) {
      const cached = JSON.parse(stored);
      if (cached.label) setVibeLabel(cached.label);
      return;
    }

    const timeVibe = getTimeVibe();
    dispatch({
      type: "set",
      payload: { genres: new Set(), moods: new Set(timeVibe.moods), times: new Set(timeVibe.times), energies: new Set(timeVibe.energies) },
    });
    setVibeLabel(timeVibe.label + " vibe");

    // IP-based weather (no geolocation prompt)
    fetchWeather().then((weather) => {
      if (!weather) {
        sessionStorage.setItem("autoVibeDone", JSON.stringify({ label: timeVibe.label + " vibe" }));
        return;
      }
      const wv = weatherToVibe(weather.code, weather.desc);
      const finalLabel = `${wv.word} ${timeVibe.label.split(" ").pop()} vibe`;
      dispatch({ type: "merge", moods: wv.moods, energies: wv.energies });
      setVibeLabel(finalLabel);
      sessionStorage.setItem("autoVibeDone", JSON.stringify({ label: finalLabel }));
    });
  }, []);

  // Sync filters → URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.genres.size) params.set("genre", Array.from(filters.genres).join(","));
    if (filters.moods.size) params.set("mood", Array.from(filters.moods).join(","));
    if (filters.times.size) params.set("time", Array.from(filters.times).join(","));
    if (filters.energies.size) params.set("energy", Array.from(filters.energies).join(","));
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [filters]);

  // Randomizer state
  const [randomAlbum, setRandomAlbum] = useState<Album | null>(null);
  const [isRandomizing, setIsRandomizing] = useState(false);

  // Audio preview state
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Toast state
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // ── Radio mode ──
  const [radioActive, setRadioActive] = useState(false);
  const [radioPlaying, setRadioPlaying] = useState(false);
  const [radioIndex, setRadioIndex] = useState(0);
  const [radioProgress, setRadioProgress] = useState(0);
  const radioPlaylistRef = useRef<Album[]>([]);
  const radioAudioRef = useRef<HTMLAudioElement | null>(null);
  const radioNextAudioRef = useRef<HTMLAudioElement | null>(null);
  const radioProgressInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const radioCurrentAlbum = radioActive ? radioPlaylistRef.current[radioIndex] : null;

  // Shuffle helper
  const shuffleArray = useCallback(<T,>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }, []);

  // Preload next track
  const preloadNext = useCallback(async (playlist: Album[], idx: number) => {
    const nextIdx = idx + 1;
    if (nextIdx >= playlist.length) return;
    const next = playlist[nextIdx];
    const url = await fetchDeezerPreview(next.artist, next.title);
    if (url) {
      const audio = new Audio(url);
      audio.volume = 0.5;
      audio.preload = "auto";
      radioNextAudioRef.current = audio;
    } else {
      radioNextAudioRef.current = null;
    }
  }, []);

  // Play a specific index in the radio playlist
  const radioPlayIndex = useCallback(async (idx: number) => {
    const playlist = radioPlaylistRef.current;
    if (idx < 0 || idx >= playlist.length) {
      // Reached the end — reshuffle and restart
      radioPlaylistRef.current = shuffleArray(playlist);
      setRadioIndex(0);
      return;
    }

    // Stop existing
    if (radioAudioRef.current) {
      radioAudioRef.current.pause();
      radioAudioRef.current = null;
    }
    if (radioProgressInterval.current) {
      clearInterval(radioProgressInterval.current);
    }

    setRadioIndex(idx);
    setRadioProgress(0);

    // Check if we have a preloaded audio for this index
    let audio: HTMLAudioElement | null = null;
    if (radioNextAudioRef.current && idx > 0) {
      audio = radioNextAudioRef.current;
      radioNextAudioRef.current = null;
    } else {
      const album = playlist[idx];
      const url = await fetchDeezerPreview(album.artist, album.title);
      if (!url) {
        // Skip to next if no preview
        radioPlayIndex(idx + 1);
        return;
      }
      audio = new Audio(url);
      audio.volume = 0.5;
    }

    radioAudioRef.current = audio;
    setPlayingId(playlist[idx].id);
    setRadioPlaying(true);

    // Progress tracking
    radioProgressInterval.current = setInterval(() => {
      if (audio && audio.duration) {
        setRadioProgress((audio.currentTime / audio.duration) * 100);
      }
    }, 250);

    audio.onended = () => {
      if (radioProgressInterval.current) clearInterval(radioProgressInterval.current);
      setRadioProgress(0);
      radioPlayIndex(idx + 1);
    };

    audio.play().catch(() => {
      // Skip on play failure
      if (radioProgressInterval.current) clearInterval(radioProgressInterval.current);
      radioPlayIndex(idx + 1);
    });

    // Preload next
    preloadNext(playlist, idx);
  }, [shuffleArray, preloadNext]);

  // Re-trigger play when radioIndex changes from reshuffle
  useEffect(() => {
    if (radioActive && radioPlaying && radioPlaylistRef.current.length > 0 && radioIndex === 0 && !radioAudioRef.current) {
      radioPlayIndex(0);
    }
  }, [radioIndex, radioActive, radioPlaying, radioPlayIndex]);

  const radioNext = useCallback(() => {
    if (!radioActive) return;
    radioPlayIndex(radioIndex + 1);
  }, [radioActive, radioIndex, radioPlayIndex]);

  const radioPrev = useCallback(() => {
    if (!radioActive) return;
    radioPlayIndex(Math.max(0, radioIndex - 1));
  }, [radioActive, radioIndex, radioPlayIndex]);

  const radioClose = useCallback(() => {
    if (radioAudioRef.current) {
      radioAudioRef.current.pause();
      radioAudioRef.current = null;
    }
    if (radioNextAudioRef.current) {
      radioNextAudioRef.current = null;
    }
    if (radioProgressInterval.current) {
      clearInterval(radioProgressInterval.current);
    }
    setRadioActive(false);
    setRadioPlaying(false);
    setRadioIndex(0);
    setRadioProgress(0);
    setPlayingId(null);
  }, []);

  // When user clicks individual album preview — stop radio
  const handlePlayToggleWithRadio = useCallback(async (album: Album) => {
    if (radioActive) {
      radioClose();
    }
    // Delegate to original handler logic inline
    if (playingId === album.id) {
      audioRef.current?.pause();
      audioRef.current = null;
      setPlayingId(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingId(album.id);
    const url = await fetchDeezerPreview(album.artist, album.title);
    if (!url) {
      setPlayingId(null);
      setToastMsg("No preview available — too underground 🌑");
      return;
    }
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.volume = 0.5;
    audio.play().catch(() => {
      setPlayingId(null);
      audioRef.current = null;
    });
    audio.onended = () => {
      setPlayingId(null);
      audioRef.current = null;
    };
  }, [radioActive, radioClose, playingId]);

  // (vibe background removed — replaced with static film grain in CSS/JSX)

  const resetFilters = () => {
    dispatch({ type: "reset" });
    setVibeLabel(null);
    sessionStorage.removeItem("autoVibeDone");
  };

  const activeFiltersCount =
    filters.genres.size + filters.moods.size + filters.times.size + filters.energies.size;
  const hasFilters = activeFiltersCount > 0;

  const openSheet = () => {
    setDraftFilters(cloneFilters(filters));
    setSheetOpen(true);
  };

  const applySheet = () => {
    if (draftFilters) dispatch({ type: "set", payload: draftFilters });
    setDraftFilters(null);
    setSheetOpen(false);
  };

  const resetSheet = () => {
    setDraftFilters(cloneFilters(initialFilters));
  };

  const toggleDraft = (category: keyof FilterState, value: string) => {
    setDraftFilters((prev) => {
      if (!prev) return prev;
      const next = new Set(prev[category]);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return { ...prev, [category]: next };
    });
  };

  // Fuse.js fuzzy search
  const fuse = useMemo(() => new Fuse(albums, {
    keys: ["artist", "title"],
    threshold: 0.4,
    distance: 100,
    minMatchCharLength: 2,
  }), []);

  // Filter Logic
  const searchedAlbums = useMemo(() => {
    if (!search || search.length < 2) return albums;
    return fuse.search(search).map(r => r.item);
  }, [search, fuse]);

  const hasTagFilters = filters.moods.size > 0 || filters.times.size > 0 || filters.energies.size > 0;

  const filtered = useMemo(() => {
    return searchedAlbums
      .map((a) => ({ album: a, score: scoreAlbum(a, filters) }))
      .filter(({ album, score }) => {
        if (filters.genres.size > 0 && !filters.genres.has(album.genre || "Other")) return false;
        if (!hasTagFilters) return true;
        return score >= 0.5;
      })
      .sort((a, b) => b.score - a.score)
      .map(({ album }) => album);
  }, [searchedAlbums, filters, hasTagFilters]);

  // Start radio (must be after filtered is declared)
  const startRadio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    const playlist = shuffleArray(filtered);
    if (playlist.length === 0) return;
    radioPlaylistRef.current = playlist;
    setRadioActive(true);
    setRadioIndex(0);
    radioPlayIndex(0);
  }, [filtered, shuffleArray, radioPlayIndex]);

  const toggleRadio = useCallback(() => {
    if (!radioActive) {
      startRadio();
    } else if (radioPlaying) {
      radioAudioRef.current?.pause();
      setRadioPlaying(false);
      if (radioProgressInterval.current) clearInterval(radioProgressInterval.current);
    } else {
      radioAudioRef.current?.play();
      setRadioPlaying(true);
      radioProgressInterval.current = setInterval(() => {
        const a = radioAudioRef.current;
        if (a && a.duration) setRadioProgress((a.currentTime / a.duration) * 100);
      }, 250);
    }
  }, [radioActive, radioPlaying, startRadio]);

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
    <div className="min-h-screen">
      {/* Film grain overlay */}
      <svg className="film-grain" aria-hidden="true" width="100%" height="100%">
        <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch" /></filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
      {/* Content */}
      <div className="relative z-[2]">
      {/* Header */}
      <header className="bg-[#0a0a0a]/80 backdrop-blur-md border-b border-neutral-800/50">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <div className="flex-shrink-0 flex items-center justify-between">
              <div>
                <h1 className="text-lg sm:text-2xl font-bold text-white tracking-wider">
                  Vova Egorov TOP 500
                </h1>
                <p className="text-neutral-600 text-xs mt-0.5">
                  {vibeLabel && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/5 border border-white/10 rounded-full text-[10px] text-white/50">
                      {vibeLabel}
                    </span>
                  )}
                </p>
              </div>
              {/* Mobile buttons: Radio + Random + Filters */}
              <div className="flex items-center gap-2 sm:hidden">
                <button
                  onClick={toggleRadio}
                  disabled={filtered.length === 0}
                  className={`px-3 py-2 border rounded-xl text-sm font-medium disabled:opacity-30 active:scale-95 transition-all ${
                    radioActive ? "bg-green-600 border-green-500 text-white" : "bg-neutral-800 border-neutral-700 text-white"
                  }`}
                >
                  {radioActive && radioPlaying ? "⏸" : "▶"}
                </button>
                <button
                  onClick={handleRandom}
                  disabled={filtered.length === 0 || isRandomizing}
                  className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-white text-sm font-medium disabled:opacity-30 active:scale-95 transition-all"
                >
                  Lucky
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
              {/* Desktop Play Vibe button */}
              <button
                onClick={toggleRadio}
                disabled={filtered.length === 0}
                className={`hidden sm:flex px-3 py-2.5 border rounded-xl text-sm font-medium disabled:opacity-30 hover:opacity-90 transition-all items-center gap-1.5 ${
                  radioActive ? "bg-green-600 border-green-500 text-white" : "bg-neutral-800 border-neutral-700 text-white"
                }`}
              >
                {radioActive && radioPlaying ? "⏸ Pause" : "▶ Play Vibe"}
              </button>
              {/* Desktop random button */}
              <button
                onClick={handleRandom}
                disabled={filtered.length === 0 || isRandomizing}
                className="hidden sm:flex px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-white text-sm font-medium disabled:opacity-30 hover:bg-neutral-700 transition-all items-center gap-1.5"
              >
                Shuffle
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── FILTER BAR (Desktop only) ── */}
      <div className="hidden sm:block sticky top-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-neutral-800/50 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col gap-3">
          {/* Row 1: Genres */}
          <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-1">
            <button
              onClick={() => dispatch({ type: "set", payload: { ...filters, genres: new Set() } })}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-all duration-200 ${
                filters.genres.size === 0
                  ? "bg-white text-black border-white"
                  : "text-gray-400 border-[#333] hover:border-neutral-500"
              }`}
            >
              All Genres
            </button>
            {GENRE_ORDER.map((genre) => (
              <button
                key={genre}
                onClick={() => dispatch({ type: "toggle", category: "genres", value: genre })}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-all duration-200 ${
                  filters.genres.has(genre)
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
            <span className="flex-shrink-0 w-14 uppercase text-[11px] font-medium text-white/40" style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.12em" }}>Vibe</span>
            {MOODS.map((m) => (
              <button
                key={m}
                onClick={() => dispatch({ type: "toggle", category: "moods", value: m })}
                className={`flex-shrink-0 py-1.5 px-3.5 rounded-full text-xs font-medium border transition-all duration-200 ${
                  filters.moods.has(m)
                    ? "bg-white text-[#0a0a0c] border-transparent"
                    : "text-white/65 border-white/12 hover:border-white/30 hover:text-white bg-transparent"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          {/* Row 3: Time */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            <span className="flex-shrink-0 w-14 uppercase text-[11px] font-medium text-white/40" style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.12em" }}>Time</span>
            {TIMES.map((t) => (
              <button
                key={t}
                onClick={() => dispatch({ type: "toggle", category: "times", value: t })}
                className={`flex-shrink-0 py-1.5 px-3.5 rounded-full text-xs font-medium border transition-all duration-200 ${
                  filters.times.has(t)
                    ? "bg-white text-[#0a0a0c] border-transparent"
                    : "text-white/65 border-white/12 hover:border-white/30 hover:text-white bg-transparent"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          {/* Row 4: Energy */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 relative">
            <span className="flex-shrink-0 w-14 uppercase text-[11px] font-medium text-white/40" style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.12em" }}>Energy</span>
            {ENERGIES.map((e) => (
              <button
                key={e}
                onClick={() => dispatch({ type: "toggle", category: "energies", value: e })}
                className={`flex-shrink-0 py-1.5 px-3.5 rounded-full text-xs font-medium border transition-all duration-200 ${
                  filters.energies.has(e)
                    ? "bg-white text-[#0a0a0c] border-transparent"
                    : "text-white/65 border-white/12 hover:border-white/30 hover:text-white bg-transparent"
                }`}
              >
                {e}
              </button>
            ))}
            {hasFilters && (
              <button
                onClick={resetFilters}
                className="ml-auto sticky right-0 flex-shrink-0 flex items-center gap-1 px-2 py-1 text-xs text-white/50 hover:text-white transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                Reset
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
            <p className="uppercase text-[11px] font-medium text-white/40 mb-2" style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.12em" }}>Genre</p>
            <div className="flex flex-wrap gap-2">
              {GENRE_ORDER.map((genre) => (
                <button
                  key={genre}
                  onClick={() => toggleDraft("genres", genre)}
                  className={`py-1.5 px-3.5 rounded-full text-xs font-medium border transition-all ${
                    draftFilters?.genres.has(genre)
                      ? "bg-white text-[#0a0a0c] border-transparent"
                      : "text-white/65 border-white/12"
                  }`}
                >
                  {GENRE_LABELS[genre] || genre}
                </button>
              ))}
            </div>
          </div>

          {/* Vibe */}
          <div>
            <p className="uppercase text-[11px] font-medium text-white/40 mb-2" style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.12em" }}>Vibe</p>
            <div className="flex flex-wrap gap-2">
              {MOODS.map((m) => (
                <button
                  key={m}
                  onClick={() => toggleDraft("moods", m)}
                  className={`py-1.5 px-3.5 rounded-full text-xs font-medium border transition-all ${
                    draftFilters?.moods.has(m)
                      ? "bg-white text-[#0a0a0c] border-transparent"
                      : "text-white/65 border-white/12"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Time */}
          <div>
            <p className="uppercase text-[11px] font-medium text-white/40 mb-2" style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.12em" }}>Time</p>
            <div className="flex flex-wrap gap-2">
              {TIMES.map((t) => (
                <button
                  key={t}
                  onClick={() => toggleDraft("times", t)}
                  className={`py-1.5 px-3.5 rounded-full text-xs font-medium border transition-all ${
                    draftFilters?.times.has(t)
                      ? "bg-white text-[#0a0a0c] border-transparent"
                      : "text-white/65 border-white/12"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Energy */}
          <div>
            <p className="uppercase text-[11px] font-medium text-white/40 mb-2" style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.12em" }}>Energy</p>
            <div className="flex flex-wrap gap-2">
              {ENERGIES.map((e) => (
                <button
                  key={e}
                  onClick={() => toggleDraft("energies", e)}
                  className={`py-1.5 px-3.5 rounded-full text-xs font-medium border transition-all ${
                    draftFilters?.energies.has(e)
                      ? "bg-white text-[#0a0a0c] border-transparent"
                      : "text-white/65 border-white/12"
                  }`}
                >
                  {e}
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
      <main className={`max-w-7xl mx-auto px-2 sm:px-6 py-4 sm:py-6 ${radioActive ? "pb-20" : ""}`}>
        {grouped.length > 0 ? (
          grouped.map(({ genre, albums: genreAlbums }) => {
            if (filters.genres.size > 0 && !filters.genres.has(genre)) return null;
            return (
              <section key={genre} className="mb-6 sm:mb-10 animate-fadeIn">
                <h2 className="text-white text-lg sm:text-2xl font-bold mt-4 sm:mt-6 mb-3 sm:mb-4 flex items-center gap-3 px-1" style={{ fontFamily: "var(--font-heading)" }}>
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
                      isPlaying={playingId === album.id}
                      onPlayToggle={handlePlayToggleWithRadio}
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
      </div>{/* end content z-[2] wrapper */}

      {/* Radio Player Bar */}
      {radioActive && radioCurrentAlbum && (
        <RadioPlayerBar
          album={radioCurrentAlbum}
          isPlaying={radioPlaying}
          progress={radioProgress}
          onPrev={radioPrev}
          onPauseResume={toggleRadio}
          onNext={radioNext}
          onClose={radioClose}
        />
      )}

      {/* Toast */}
      <AnimatePresence>
        {toastMsg && <Toast message={toastMsg} onDone={() => setToastMsg(null)} />}
      </AnimatePresence>

      {/* Modal */}
      <AnimatePresence>
        {selected && <AlbumModal album={selected} onClose={handleClose} />}
      </AnimatePresence>
    </div>
  );
}
