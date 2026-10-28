// POST /api/share  body {name, tracks:[{id,title,artist}]}  -> {code}
// GET  /api/share?code=K7M42Q                             -> {name, tracks}
// Kode pendek 6 karakter untuk berbagi playlist antar perangkat (juga bisa diketik di TV).
// Daftar lagu dititipkan di Redis (Upstash) selama 30 hari, tanpa akun dan tanpa data pribadi.
// Cek status: /api/share?status=1. Jika Redis belum tersambung, fungsi ini menjawab 501 dan aplikasi memakai tautan panjang sebagai cadangan.

const crypto = require('crypto');
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // tanpa 0/O/1/I agar tidak membingungkan
const TTL = 60 * 60 * 24 * 30;

// Vercel bisa memberi awalan sendiri (mis. STORAGE_KV_REST_API_URL), jadi cari semua nama yang berakhiran sama.
function envBy(suffixes) {
  for (const s of suffixes) if (process.env[s]) return process.env[s];
  for (const k of Object.keys(process.env)) {
    if (suffixes.some((s) => k.endsWith('_' + s)) && process.env[k]) return process.env[k];
  }
  return '';
}
const REST_URL = () => envBy(['KV_REST_API_URL', 'UPSTASH_REDIS_REST_URL']);
const REST_TOKEN = () => envBy(['KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_TOKEN']);

async function redis(args) {
  const r = await fetch(REST_URL(), {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + REST_TOKEN(), 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) throw new Error(d.error || 'redis ' + r.status);
  return d.result;
}

const newCode = () => Array.from({ length: 6 }, () => ALPHA[crypto.randomInt(ALPHA.length)]).join('');
const clip = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);

function clean(body) {
  const name = clip(body && body.name, 40) || 'Playlist';
  const src = Array.isArray(body && body.tracks) ? body.tracks.slice(0, 200) : [];
  const seen = new Set();
  const tracks = [];
  for (const t of src) {
    if (!t || typeof t.id !== 'string' || !/^[\w-]{11}$/.test(t.id) || seen.has(t.id)) continue;
    seen.add(t.id);
    tracks.push({ id: t.id, title: clip(t.title, 120), artist: clip(t.artist, 80) });
  }
  return { name, tracks };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  // Cek status: buka /api/share?status=1 (tidak menampilkan rahasia apa pun)
  if (req.query && req.query.status) {
    const names = Object.keys(process.env).filter((k) => /REST_API_URL|REDIS_REST_URL|REDIS_URL|KV_/.test(k));
    return res.status(200).json({ ready: !!(REST_URL() && REST_TOKEN()), variabelTerdeteksi: names });
  }
  if (!REST_URL() || !REST_TOKEN()) {
    return res.status(501).json({ nostore: true, error: 'Kode pendek belum diaktifkan. Sambungkan Upstash Redis di Vercel.' });
  }
  try {
    if (req.method === 'POST') {
      const data = clean(typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body);
      if (!data.tracks.length) return res.status(400).json({ error: 'Playlist kosong.' });
      const value = JSON.stringify(data);
      for (let i = 0; i < 8; i++) {
        const code = newCode();
        const ok = await redis(['SET', 'pl:' + code, value, 'EX', TTL, 'NX']);
        if (ok === 'OK') return res.status(200).json({ code, days: 30 });
      }
      return res.status(503).json({ error: 'Gagal membuat kode, coba lagi.' });
    }
    const code = String(req.query.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!/^[A-Z2-9]{6}$/.test(code)) return res.status(400).json({ error: 'Format kode tidak valid.' });
    const raw = await redis(['GET', 'pl:' + code]);
    if (!raw) return res.status(404).json({ error: 'Kode tidak ditemukan atau sudah kedaluwarsa.' });
    return res.status(200).json(JSON.parse(raw));
  } catch (e) {
    return res.status(502).json({ error: 'Layanan kode sedang tidak bisa dihubungi.' });
  }
};
module.exports._clean = clean;
