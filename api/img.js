// GET /api/img?id=VIDEO_ID  -> gambar sampul (thumbnail YouTube) lewat server sendiri
// Dipakai fitur "Bagikan ke Story": gambar harus satu asal (same-origin) supaya bisa digambar ke kanvas dan diekspor jadi PNG.

const UA = 'Nada-Player/1.0 (+https://github.com/azmyikh98-rgb/musicplayer)';

async function grab(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) return null;
  const type = r.headers.get('content-type') || '';
  if (!type.startsWith('image/')) return null;
  return { buf: Buffer.from(await r.arrayBuffer()), type };
}

module.exports = async (req, res) => {
  const id = String(req.query.id || '');
  if (!/^[\w-]{11}$/.test(id)) return res.status(400).send('id tidak valid');
  try {
    // maxres = 16:9 tanpa bingkai hitam. Tidak semua video punya, jadi cadangannya mqdefault (juga 16:9).
    let img = null;
    for (const f of ['maxresdefault', 'mqdefault']) {
      img = await grab(`https://i.ytimg.com/vi/${id}/${f}.jpg`);
      // YouTube kadang mengirim gambar abu-abu kecil (120x90) untuk maxres yang tidak ada
      if (img && img.buf.length > 4000) break;
      img = null;
    }
    if (!img) return res.status(404).send('tidak ada gambar');
    res.setHeader('Content-Type', img.type);
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, immutable');
    return res.status(200).send(img.buf);
  } catch (e) {
    return res.status(502).send('gagal mengambil gambar');
  }
};
