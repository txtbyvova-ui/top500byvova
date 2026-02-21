#!/usr/bin/env python3
import os

albums = []
aid = 0
with open("list_clean.txt", "r", encoding="utf-8") as f:
    for line in f:
        s = line.strip()
        if not s:
            continue
        for sep in [" - "]:
            if sep in s:
                p = s.split(sep, 1)
                aid += 1
                albums.append((f"a{aid:03d}", p[0].strip(), p[1].strip()))
                break

def esc(x):
    return x.replace("\\","\\\\").replace("`","\\`").replace("${","\\${")

ts = """export type Album = {
  id: string;
  artist: string;
  title: string;
};

export const albums: Album[] = [
"""
for a in albums:
    ts += f'  {{ id: "{a[0]}", artist: `{esc(a[1])}`, title: `{esc(a[2])}` }},\n'
ts += "];\n"

os.makedirs("src/data", exist_ok=True)
with open("src/data/albums.ts", "w", encoding="utf-8") as f:
    f.write(ts)
print(f"Done! {len(albums)} albums")
