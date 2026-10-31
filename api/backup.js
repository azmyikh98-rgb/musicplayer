// POST /api/backup  body {data:"<json cadangan>"}  -> {code}
// GET  /api/backup?code=ABCD2345                    -> {data}
// Kode pindah data sementara (8 karakter, aktif 15 menit) untuk memindahkan playlist, Liked Songs, dll. ke perangkat lain
// (mis. dari HP ke TV tanpa memindahkan file). Memakai Redis (Upstash) yang sama dengan /api/share.
const crypto = require('crypto');
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TTL = 60 * 15;
const MAX = 300 * 1024;

function envBy(suffixes) {
  for (const s of suffixes) if (process.env[s]) return process.env[s];
  for (const k of Object.keys(process.env)) if (suffixes.some((s) => k.endsWith('_' + s)) && process.env[k]) return process.env[k];
  return '';
}
const URL_ = () => envBy(['KV_REST_API_URL', 'UPSTASH_REDIS_REST_URL']);
const TOKEN = () => envBy(['KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_TOKEN']);
async function redis(args) {
  const r = await fetch(URL_(), { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN(), 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) throw new Error(d.error || 'redis ' + r.status);
  return d.result;
}
const newCode = () => Array.from({ length: 8 }, () => ALPHA[crypto.randomInt(ALPHA.length)]).join('');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!URL_() || !TOKEN()) return res.status(501).json({ nostore: true, error: 'Kode pindah belum aktif. Pakai file cadangan dulu ya.' });
  try {
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      const raw = typeof body.data === 'string' ? body.data : '';
      if (!raw || raw.length > MAX) return res.status(413).json({ error: 'Datanya kebesaran buat dipindah lewat kode. Pakai file cadangan ya.' });
      let o; try { o = JSON.parse(raw); } catch { return res.status(400).json({ error: 'Format cadangan nggak valid.' }); }
      if (!o || o.app !== 'nada') return res.status(400).json({ error: 'Ini bukan cadangan Nada.' });
      for (let i = 0; i < 8; i++) {
        const code = newCode();
        if ((await redis(['SET', 'bk:' + code, raw, 'EX', TTL, 'NX'])) === 'OK') return res.status(200).json({ code, minutes: TTL / 60 });
      }
      return res.status(503).json({ error: 'Gagal bikin kode, coba lagi.' });
    }
    const code = String(req.query.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!/^[A-Z2-9]{8}$/.test(code)) return res.status(400).json({ error: 'Kodenya harus 8 karakter.' });
    const raw = await redis(['GET', 'bk:' + code]);
    if (!raw) return res.status(404).json({ error: 'Kodenya nggak ketemu atau udah lewat 15 menit.' });
    return res.status(200).json({ data: raw });
  } catch (e) {
    return res.status(502).json({ error: 'Layanan kodenya lagi nggak bisa dihubungi.' });
  }
};
