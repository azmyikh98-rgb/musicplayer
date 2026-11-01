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

const REQ_MS = 4500;      // batas tiap permintaan ke sumber lirik
const BUDGET_MS = 8000;   // batas total (fungsi Vercel gratis terbatas ~10 detik)

const norm = (s = '') => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const toks = (s) => new Set(norm(s).split(' ').filter(Boolean));
function dice(a, b) {
  const A = toks(a), B = toks(b); if (!A.size || !B.size) return 0;
  let n = 0; for (const x of A) if (B.has(x)) n++;
  return (2 * n) / (A.size + B.size);
}
// seberapa mirip kandidat dengan yang dicari (0..1); judul wajib mirip, artis hanya bonus
function relevance(c, vs) {
  let best = 0;
  for (const [t, a] of vs) {
    const td = dice(c.name, t); if (td < 0.55) continue;
    const ad = a ? Math.max(dice(c.artist, a), norm(c.artist).includes(norm(a)) || norm(a).includes(norm(c.artist)) ? 0.8 : 0) : 0.5;
    best = Math.max(best, td * 0.75 + ad * 0.25);
  }
  return best;
}

async function lr(path, params, ms = REQ_MS) {
  const r = await fetch(`${BASE}/${path}?${new URLSearchParams(params)}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(ms) });
  if (r.status === 404) return [];
  if (!r.ok) throw new Error('lrclib ' + r.status);
  const j = await r.json();
  return Array.isArray(j) ? j : [j];
}
async function ovh(artist, title, ms = 4500) {
  const r = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(ms) });
  if (r.status === 404) return [];
  if (!r.ok) throw new Error('ovh ' + r.status);
  const d = await r.json().catch(() => null);
  const text = d && typeof d.lyrics === 'string' ? d.lyrics.replace(/\r/g, '').trim() : '';
  return text.length > 40 ? [{ trackName: title, artistName: artist, duration: 0, plainLyrics: text, _src: 'lyrics.ovh' }] : [];
}


// NetEase Cloud Music: sumber tambahan lirik tersinkron (API tidak resmi; kalau gagal diabaikan saja)
const NE_H = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', Referer: 'https://music.163.com/', Cookie: 'appver=2.0.2' };
async function netease(artist, title, ms = 4500) {
  const q = `${title} ${artist}`.trim();
  const r = await fetch('https://music.163.com/api/search/get/web?' + new URLSearchParams({ s: q, type: '1', offset: '0', total: 'true', limit: '6' }), { headers: NE_H, signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error('netease ' + r.status);
  const j = await r.json().catch(() => null);
  const songs = ((j && j.result && j.result.songs) || []).filter((x) => dice(x.name, title) >= 0.55).slice(0, 3);
  const out = await Promise.all(songs.map(async (x) => {
    try {
      const lr2 = await fetch(`https://music.163.com/api/song/lyric?id=${x.id}&lv=1&kv=1&tv=-1`, { headers: NE_H, signal: AbortSignal.timeout(ms) });
      const d = await lr2.json();
      const lrc = d && d.lrc && d.lrc.lyric; if (!lrc) return null;
      const clean = lrc.split(/\r?\n/).filter((l) => !/^\[[\d:.]+\]\s*(作词|作曲|编曲|制作|制作人|词|曲|Lyrics?|Composer|Producer)\s*[:：]/i.test(l)).join('\n');
      return { trackName: x.name, artistName: (x.artists || x.ar || []).map((a) => a.name).join(', '), duration: Math.round((x.duration || x.dt || 0) / 1000), syncedLyrics: clean, plainLyrics: '', _src: 'NetEase' };
    } catch { return null; }
  }));
  return out.filter(Boolean);
}

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
  const seen = new Set();
  return v.filter(([t, a]) => { const k = norm(t) + '|' + norm(a); if (!t || seen.has(k)) return false; seen.add(k); return true; }).slice(0, 4);
}

// Kumpulkan KANDIDAT dari semua sumber sekaligus. Pemilihan versi (berdasarkan durasi video) dilakukan di aplikasi.
async function collect(rawTitle, title, artist) {
  const t0 = Date.now(), left = () => BUDGET_MS - (Date.now() - t0);
  const vs = variants(rawTitle, title, artist);
  const jobs = [];
  vs.forEach(([t, a], i) => {
    if (a) jobs.push([() => lr('search', { track_name: t, artist_name: a }), true]);
    jobs.push([() => lr('search', { q: `${t} ${a}`.trim() }), true]);
  });
  const fv = vs.find(([, a]) => a);
  if (fv) jobs.push([() => netease(fv[1], fv[0]), false]);   // sumber tambahan: kegagalannya tidak dianggap "layanan mati"
  if (fv) jobs.push([() => ovh(fv[1], fv[0]), false]);
  let ok = 0, fail = 0; const all = [];
  await Promise.all(jobs.map(async ([job, core], i) => {
    if (core && i >= 2 && left() < 1500) return;
    try { const list = await job(); if (core) ok++; all.push(...list.slice(0, 25)); } catch { if (core) fail++; }
  }));
  if (!ok && fail) throw new Error('lyrics sources down');
  const seen = new Set(), items = [];
  for (const x of all) {
    if (!x || !(x.syncedLyrics || x.plainLyrics || x.instrumental)) continue;
    const c = { name: x.trackName || '', artist: x.artistName || '', dur: Math.round(x.duration || 0), synced: x.syncedLyrics ? parseLRC(x.syncedLyrics) : [], plain: x.plainLyrics || '', instr: !!x.instrumental, src: x._src || 'LRCLIB' };
    if (c.synced.length < 3) c.synced = [];
    if (!c.synced.length && !c.plain && !c.instr) continue;
    const rel = relevance(c, vs); if (rel <= 0) continue;
    const k = norm(c.name) + '|' + norm(c.artist) + '|' + c.dur; if (seen.has(k)) continue; seen.add(k);
    c.rel = Math.round(rel * 100) / 100; items.push(c);
  }
  if (!items.length && fail) throw new Error('lyrics sources partial');   // ada sumber yang gagal: jangan simpulkan "belum ada"
  // sinkron dulu, lalu paling mirip; buang yang plain kalau sudah ada cukup versi sinkron
  items.sort((a, b) => (!!b.synced.length - !!a.synced.length) || (b.rel - a.rel));
  const synced = items.filter((i) => i.synced.length).slice(0, 4);
  const plain = items.filter((i) => !i.synced.length).slice(0, synced.length ? 1 : 2);
  return [...synced, ...plain];
}

// /api/lyrics?debug=1 : cek apakah server Vercel bisa menjangkau sumber lirik (untuk diagnosa)
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
  if (!title) return res.status(400).json({ error: 'Judul kosong.' });
  try {
    const items = await collect(rawTitle, title, artist);
    res.setHeader('Cache-Control', items.length ? 's-maxage=259200, stale-while-revalidate=86400' : 's-maxage=900');
    return res.status(200).json({ v: 2, ok: true, items });
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ error: 'Layanan liriknya lagi nggak bisa dihubungi.' });
  }
};
module.exports._parseLRC = parseLRC;
module.exports._cleanTitle = cleanTitle;
