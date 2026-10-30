// GET /s/:id  (dialihkan ke /api/song?id=...)
// Halaman tautan lagu: pratinjau cantik saat ditempel di WhatsApp / IG / dll (judul + sampul),
// lalu langsung membuka Nada dan memilih lagunya (/?t=ID).

const esc = (s) => String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

module.exports = async (req, res) => {
  const id = String(req.query.id || '');
  if (!/^[\w-]{11}$/.test(id)) { res.statusCode = 302; res.setHeader('Location', '/'); return res.end(); }
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const origin = host ? `${proto}://${host}` : '';
  let title = 'Lagu di Nada', artist = '';
  try {
    const r = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent('https://www.youtube.com/watch?v=' + id)}&format=json`);
    if (r.ok) { const d = await r.json(); title = d.title || title; artist = String(d.author_name || '').replace(/\s*-\s*Topic$/i, ''); }
  } catch (e) {}
  const dest = `/?t=${id}`;
  const desc = (artist ? artist + ' · ' : '') + 'Dengerin di Nada';
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
  res.status(200).send(`<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · Nada</title>
<meta property="og:type" content="music.song"><meta property="og:site_name" content="Nada">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(origin)}/api/img?id=${id}"><meta property="og:url" content="${esc(origin)}/s/${id}">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0;url=${dest}"><meta name="theme-color" content="#0e0e13">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0e0e13;color:#f3f3f7;font:16px system-ui,sans-serif;text-align:center}a{color:#ff4f6d}</style>
</head><body><p>Membuka Nada…<br><a href="${dest}">Klik di sini kalau tidak terbuka</a></p><script>location.replace(${JSON.stringify(dest)})</script></body></html>`);
};
