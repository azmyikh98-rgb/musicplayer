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

// pilih hasil terbaik: utamakan yang punya lirik bertanda waktu dan durasinya paling dekat
function pick(list, dur) {
  const ok = (Array.isArray(list) ? list : [list]).filter((x) => x && (x.syncedLyrics || x.plainLyrics || x.instrumental));
  if (!ok.length) return null;
  const score = (x) => (x.syncedLyrics ? 0 : 1000) + (dur && x.duration ? Math.abs(x.duration - dur) : 30);
  return ok.sort((a, b) => score(a) - score(b))[0];
}

async function find(title, artist, dur) {
  if (artist && dur) {
    try { const g = await lr('get', { track_name: title, artist_name: artist, duration: String(dur) }); const p = pick(g, dur); if (p) return p; } catch {}
  }
  const tries = [];
  if (artist) tries.push({ track_name: title, artist_name: artist });
  tries.push({ q: `${title} ${artist}`.trim() });
  tries.push({ track_name: title });
  for (const q of tries) {
    const list = await lr('search', q);
    const p = pick((list || []).slice(0, 15), dur);
    if (p) return p;
  }
  return null;
}

module.exports = async (req, res) => {
  const artist = cleanArtist(String(req.query.artist || '')).slice(0, 80);
  const title = cleanTitle(String(req.query.title || '').slice(0, 160), artist);
  const dur = Math.round(Number(req.query.dur) || 0);
  if (!title) return res.status(400).json({ error: 'Judul kosong.' });
  try {
    const hit = await find(title, artist, dur);
    res.setHeader('Cache-Control', 's-maxage=604800, stale-while-revalidate=86400');
    if (!hit) return res.status(200).json({ found: false });
    if (hit.instrumental && !hit.syncedLyrics && !hit.plainLyrics) return res.status(200).json({ found: true, instrumental: true });
    const synced = hit.syncedLyrics ? parseLRC(hit.syncedLyrics) : [];
    return res.status(200).json({
      found: true, synced: synced.length >= 3 ? synced : [], plain: hit.plainLyrics || '',
      title: hit.trackName || title, artist: hit.artistName || artist, source: 'LRCLIB',
    });
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ error: 'Layanan liriknya lagi nggak bisa dihubungi.' });
  }
};
module.exports._parseLRC = parseLRC;
module.exports._cleanTitle = cleanTitle;
