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

const REQ_MS = 4000;      // batas tiap permintaan ke LRCLIB
const BUDGET_MS = 8500;   // batas total pencarian (fungsi Vercel gratis terbatas ~10 detik)
async function lr(path, params, ms = REQ_MS) {
  const r = await fetch(`${BASE}/${path}?${new URLSearchParams(params)}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(ms) });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('lrclib ' + r.status);
  return r.json();
}

// cadangan terakhir: lyrics.ovh (hanya lirik biasa, tanpa waktu)
async function ovh(artist, title, ms = 4000) {
  const r = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(ms) });
  if (!r.ok) return null;
  const d = await r.json().catch(() => null);
  const text = d && typeof d.lyrics === 'string' ? d.lyrics.replace(/\r/g, '').trim() : '';
  return text.length > 40 ? { plainLyrics: text, trackName: title, artistName: artist, duration: 0, _src: 'lyrics.ovh' } : null;
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
  const t0 = Date.now(), left = () => BUDGET_MS - (Date.now() - t0);
  let top = null, ok = 0, fail = 0;
  const take = (r) => { if (r && (!top || r.score < top.score)) top = r; };
  const good = () => top && !top.bad && top.x.syncedLyrics && (top.diff == null || top.diff <= 3);
  // jalankan banyak permintaan sekaligus; satu yang lambat/gagal tidak menahan yang lain
  const run = async (jobs) => {
    await Promise.all(jobs.map(async (job) => {
      if (left() < 600) return;
      try { const res = await job(Math.max(700, Math.min(REQ_MS, left() - 400))); ok++; if (res) take(best(Array.isArray(res) ? res.slice(0, 20) : res, dur)); } catch { fail++; }
    }));
  };
  const vs = variants(rawTitle, title, artist);
  const jobsFor = (list) => {
    const jobs = [];
    for (const [t, a] of list) {
      if (a && dur) jobs.push((ms) => lr('get', { track_name: t, artist_name: a, duration: String(dur) }, ms));
      if (a) jobs.push((ms) => lr('search', { track_name: t, artist_name: a }, ms));
      jobs.push((ms) => lr('search', { q: `${t} ${a}`.trim() }, ms));
    }
    return jobs;
  };
  // cadangan (lirik biasa) jalan bersamaan dari awal, dipakai hanya kalau LRCLIB tidak membuahkan hasil
  const fbV = vs.find(([, a]) => a);
  const fb = fbV ? ovh(fbV[1], fbV[0], 4000).catch(() => null) : Promise.resolve(null);
  await run(jobsFor(vs.slice(0, 2)));                                 // tahap 1: tebakan terbaik
  if (!good() && ok > 0 && left() > 1500) await run(jobsFor(vs.slice(2)));   // tahap 2: variasi lain (hanya kalau LRCLIB responsif)
  if (!top) { const o = await fb; if (o) take(rate(o, 0)); }
  if (!top && fail && !ok) throw new Error('lyrics sources down');
  return top;
}

// /api/lyrics?debug=1 : cek langsung apakah server Vercel bisa menjangkau sumber lirik (untuk diagnosa)
async function diag(res) {
  const out = {};
  const probe = async (name, url) => {
    const t0 = Date.now();
    try { const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6000) }); out[name] = { status: r.status, ms: Date.now() - t0 }; }
    catch (e) { out[name] = { error: String(e && (e.cause && (e.cause.code || e.cause.message) || e.message || e)), ms: Date.now() - t0 }; }
  };
  await Promise.all([
    probe('lrclib', BASE + '/search?q=' + encodeURIComponent('bandung fiersa besari')),
    probe('lyrics.ovh', 'https://api.lyrics.ovh/v1/' + encodeURIComponent('Fiersa Besari') + '/Bandung'),
  ]);
  out.node = process.version;
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json(out);
}

module.exports = async (req, res) => {
  if (req.query.debug) return diag(res);
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
      title: hit.trackName || title, artist: hit.artistName || artist, source: hit._src || 'LRCLIB',
      lrcDur: hit.duration || 0, mismatch: !!top.bad,
    });
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ error: 'Layanan liriknya lagi nggak bisa dihubungi.' });
  }
};
module.exports._parseLRC = parseLRC;
module.exports._cleanTitle = cleanTitle;
