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

def has_separator(s):
    for sep in [" - ", " -- ", " \u2013 ", " \u2014 "]:
        if sep in s:
            p = s.split(sep, 1)
            if p[0].strip() and p[1].strip():
                return (p[0].strip(), re.sub(r'\s*[\(\[].*$', '', p[1].strip()))
    return None

def looks_like_entry(s):
    if not s:
        return False
    if len(s) > 80:
        return False
    if s[0:1] in ['"', '\u00ab', '\u201c']:
        return False
    words = s.split()
    if len(words) > 12:
        return False
    lower_starts = [
        "помните", "удивительно", "для ", "по большому", "это ",
        "если ", "то, ", "три ", "конечно", "серьезно", "примерно",
        "можно ", "каким", "один ", "отличн", "суть ", "холодный",
        "итак", "многие", "думаю", "альбом", "ребята", "группа",
        "пост-", "сейчас", "игги", "независимо", "гитары",
        "превосходное", "этот ", "как по", "кульминац", "есть ",
        "совершенно", "проект", "прежде", "чрезвычайно", "на самом",
        "ретро", "have fun", "темнее", "сокровище", "погруженный",
        "начиная", "симбиоз", "предустановленные", "слишком",
        "он интенсивный", "нельзя", "отлично годится", "длительность",
        "одноименный", "в любом", "такой вот", "давайте", "итого",
        "на дебютном", "нет ни", "песни,", "ты чувствуешь",
        "он затрагивает", "дело не", "форма ", "музыка часто",
        "как и любовь", "вневременные", "некоторые", "немножко",
        "открывающая", "сердце", "используя", "захватывающий",
        "умирать", "его единственный", "одна из", "но выше",
        "с темами", "когда я", "я не могу", "вы не встретите",
        "способность", "каждая ", "пожалуйста", "черт возьми",
        "royal blood", "с момента", "так что", "еще раз",
        "интурист",
    ]
    sl = s.lower()
    for ls in lower_starts:
        if sl.startswith(ls):
            return False
    return True

for line in lines:
    s = line.strip()
    if s in GENRES:
        save()
        genre = s
        continue
    if not s:
        continue
    found = has_separator(s)
    if found:
        save()
        artist, title = found
        revs = []
        continue
    if looks_like_entry(s):
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
