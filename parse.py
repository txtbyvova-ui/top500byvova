#!/usr/bin/env python3
import re, json, os

with open("top440.txt", "r", encoding="utf-8") as f:
    raw = f.read()

lines = raw.split("\n")
albums = []
genre = "Unknown"
artist = None
title = None
revs = []
aid = 0

GENRES = ["Hip-Hop", "Indie / Twee / Jangle pop",
    "Post-Punk / Rock / Experimental", "Classic Rock / Metal",
    "Electronic / Ambient /", "Mainstream / Pop", "Russian"]

def save():
    global aid, artist, title, revs
    if artist:
        aid += 1
        r = "\n".join(revs).strip() or None
        albums.append({"id": f"a{aid:03d}",
            "artist": (artist or "").strip(),
            "title": (title or "").strip(),
            "genre": genre.strip(), "review": r})
    artist = None
    title = None
    revs = []

for line in lines:
    s = line.strip()
    if s in GENRES:
        save()
        genre = s
        continue
    if not s:
        continue
    found = None
    for sep in [" - ", " -- ", " – ", " — "]:
        if sep in s:
            p = s.split(sep, 1)
            if p[0] and p[1]:
                found = (p[0].strip(), re.sub(r'\s*[\(\[].*$', '', p[1].strip()))
                break
    if found:
        save()
        artist, title = found
        revs = []
    elif len(s) < 80 and not s[0:1].islower():
        save()
        artist = s
        title = ""
        revs = []
    else:
        if artist:
            revs.append(s)

save()

def esc(x):
    if not x: return ""
    return x.replace("\\","\\\\").replace("`","\\`").replace("${","\\${")

ts = "export type Album = {\n  id: string;\n  artist: string;\n  title: string;\n  genre: string;\n  review: string | null;\n};\n\nexport const albums: Album[] = [\n"
for a in albums:
    r = "null" if not a["review"] else "`" + esc(a["review"]) + "`"
    ts += '  { id: "' + a["id"] + '", artist: `' + esc(a["artist"]) + '`, title: `' + esc(a["title"]) + '`, genre: `' + esc(a["genre"]) + '`, review: ' + r + ' },\n'
ts += "];\n"

os.makedirs("src/data", exist_ok=True)
with open("src/data/albums.ts", "w", encoding="utf-8") as f:
    f.write(ts)
print(f"Done! {len(albums)} albums -> src/data/albums.ts")
