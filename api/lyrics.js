// GET /api/lyrics?title=&artist=&dur=
// Lirik diambil dari LRCLIB (https://lrclib.net), layanan lirik komunitas yang terbuka dan tanpa API key.
// Hasil bisa berupa lirik bertanda waktu (synced, disorot mengikuti lagu) atau lirik biasa.
// Tidak semua lagu ada liriknya. Jika tidak ketemu, aplikasi menampilkan pesan dan tautan pencarian.

const BASE = 'https://lrclib.net/api';
const UA = 'Nada-Player/1.0 (https://github.com/azmyikh98-rgb/musicplayer)';

const cleanArtist = (s = '') =>
  s.replace(/\s*-\s*Topic$/i, '').replace(/\s*VEVO$/i, '').replace(/\s*official$/i, '').trim();

function cleanTitle(raw = '', artist = '') {
  let s = raw
    .replace(/\s*[\(\[【]\s*(official|resmi|lyric|lirik|audio|video|mv|m\/v|music video|clip|visuali[sz]er|hd|4k|live|remaster)[^\)\]】]*[\)\]】]/gi, '')
    .replace(/\s*\|\s*.*$/, '')
    .trim();
  const a = artist.toLowerCase();
  for (const sep of [' - ', ' – ', ' — ']) {
    const i = s.indexOf(sep);
    if (i > 0 && (a && s.slice(0, i).toLowerCase().includes(a))) s = s.slice(i + sep.length).trim();
  }
  s = s.replace(/\s+(feat\.?|ft\.?)\s+.*$/i, '').trim();
  return s || raw;
}

// "[01:23.45] teks" -> [83.45, "teks"]; satu baris boleh punya beberapa stempel waktu
function parseLRC(lrc = '') {
  const out = [];
  for (const line of lrc.split(/\r?\n/)) {
    const stamps = [...line.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    if (!stamps.length) continue;
    const text = line.replace(/\[[^\]]*\]/g, '').trim();
    for (const m of stamps) {
      const frac = m[3] ? Number('0.' + m[3]) : 0;
      out.push([Math.round((Number(m[1]) * 60 + Number(m[2]) + frac) * 100) / 100, text]);
    }
  }
  return out.sort((a, b) => a[0] - b[0]);
}

async function lr(path, params) {
  const r = await fetch(`${BASE}/${path}?${new URLSearchParams(params)}`, { headers: { 'User-Agent': UA } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('lrclib ' + r.status);
  return r.json();
}

// Nilai kandidat: makin kecil makin bagus. Durasi yang jauh berbeda biasanya versi lain (remix, live, intro panjang).
function rate(x, dur) {
  if (!x || !(x.syncedLyrics || x.plainLyrics || x.instrumental)) return null;
  const diff = dur && x.duration ? Math.abs(x.duration - dur) : null;
  const tol = dur ? Math.max(12, dur * 0.1) : 1e9;
  const bad = diff != null && diff > tol;
  return { x, diff, bad, score: (bad ? 5000 : 0) + (x.syncedLyrics ? 0 : 200) + (diff == null ? 40 : diff) };
}
const best = (list, dur) => (Array.isArray(list) ? list : [list]).map((x) => rate(x, dur)).filter(Boolean).sort((a, b) => a.score - b.score)[0] || null;

// variasi judul/artis: judul YouTube sering berformat "Artis - Judul", dan nama kanal bisa berupa label
function variants(rawTitle, title, artist) {
  const v = [[title, artist]];
  const m = String(rawTitle).replace(/\s*[\(\[【][^\)\]】]*[\)\]】]/g, '').split(/\s+[-–—]\s+/);
  if (m.length >= 2) {
    const l = m[0].trim(), r = m.slice(1).join(' - ').replace(/\s+(feat\.?|ft\.?)\s+.*$/i, '').trim();
    if (l && r) { v.push([r, l]); v.push([l, r]); v.push([r, artist]); }
  }
  const noParen = String(title).replace(/\s*[\(\[][^\)\]]*[\)\]]/g, '').trim();
  if (noParen && noParen !== title) v.push([noParen, artist]);
  v.push([title, '']);
  const seen = new Set();
  return v.filter(([t, a]) => { const k = (t + '|' + a).toLowerCase(); if (!t || seen.has(k)) return false; seen.add(k); return true; }).slice(0, 6);
}

async function find(rawTitle, title, artist, dur) {
  let top = null, ok = 0, fail = 0;
  const take = (r) => { if (r && (!top || r.score < top.score)) top = r; return top && !top.bad && top.x.syncedLyrics && (top.diff == null || top.diff <= 3); };
  for (const [t, a] of variants(rawTitle, title, artist)) {
    if (a && dur) { try { const g = await lr('get', { track_name: t, artist_name: a, duration: String(dur) }); ok++; if (take(best(g, dur))) return top; } catch { fail++; } }
    const qs = [];
    if (a) qs.push({ track_name: t, artist_name: a });
    qs.push({ q: `${t} ${a}`.trim() });
    for (const q of qs) {
      let list = null;
      try { list = await lr('search', q); ok++; } catch { fail++; continue; }
      if (take(best((list || []).slice(0, 20), dur))) return top;
    }
    if (top && !top.bad && top.x.syncedLyrics) return top;   // sudah cukup baik, hemat waktu
  }
  if (!top && fail && !ok) throw new Error('lrclib down');
  return top;
}

module.exports = async (req, res) => {
  const artist = cleanArtist(String(req.query.artist || '')).slice(0, 80);
  const rawTitle = String(req.query.title || '').slice(0, 160);
  const title = cleanTitle(rawTitle, artist);
  const dur = Math.round(Number(req.query.dur) || 0);
  if (!title) return res.status(400).json({ error: 'Judul kosong.' });
  try {
    const top = await find(rawTitle, title, artist, dur);
    const hit = top && top.x;
    // hasil ketemu boleh di-cache lama; "belum ada" cukup sebentar supaya lirik baru cepat terpakai
    res.setHeader('Cache-Control', hit ? 's-maxage=604800, stale-while-revalidate=86400' : 's-maxage=1800');
    if (!hit) return res.status(200).json({ found: false });
    if (hit.instrumental && !hit.syncedLyrics && !hit.plainLyrics) return res.status(200).json({ found: true, instrumental: true });
    const synced = hit.syncedLyrics ? parseLRC(hit.syncedLyrics) : [];
    return res.status(200).json({
      found: true, synced: synced.length >= 3 ? synced : [], plain: hit.plainLyrics || '',
      title: hit.trackName || title, artist: hit.artistName || artist, source: 'LRCLIB',
      lrcDur: hit.duration || 0, mismatch: !!top.bad,
    });
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ error: 'Layanan liriknya lagi nggak bisa dihubungi.' });
  }
};
module.exports._parseLRC = parseLRC;
module.exports._cleanTitle = cleanTitle;
