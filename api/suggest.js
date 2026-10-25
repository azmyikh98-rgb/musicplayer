// GET /api/suggest?q=... -> { items: [saran pencarian] }
// Memakai endpoint saran pencarian YouTube (tanpa kunci, tidak memakai kuota API).
// Endpoint ini tidak resmi; jika gagal, aplikasi tetap memakai riwayat pencarian lokal.

module.exports = async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 80);
  if (!q) return res.status(200).json({ items: [] });
  try {
    const r = await fetch(
      'https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&hl=id&q=' + encodeURIComponent(q),
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const data = await r.json();
    const items = Array.isArray(data && data[1]) ? data[1].filter((s) => typeof s === 'string').slice(0, 8) : [];
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({ items });
  } catch (e) {
    return res.status(200).json({ items: [] });
  }
};
