import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q) return NextResponse.json({ data: [] });

  try {
    const res = await fetch(
      `https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=1`,
      { next: { revalidate: 86400 } } // cache 24h
    );
    const data = await res.json();
    const preview = data?.data?.[0]?.preview || null;
    return NextResponse.json({ preview });
  } catch {
    return NextResponse.json({ preview: null });
  }
}
