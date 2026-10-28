// GET /api/videos?ids=id1,id2,...  -> { items:[{id,title,artist}] }
// Dipakai saat mengimpor playlist dari tautan/kode panjang yang hanya berisi ID lagu.
// Biaya kuota 1 unit per 50 lagu.

const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'" };
const decode = (s = '') => s.replace(/&(amp|lt|gt|quot|apos|#39);/g, (m) => ENT[m] || m).replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
const cleanArtist = (s = '') => decode(s).replace(/\s*-\s*Topic$/i, '').replace(/\s*VEVO$/i, '').replace(/\s*official$/i, '').trim();
const cleanTitle = (raw = '', artist = '') => {
  let s = decode(raw)
    .replace(/\s*[\(\[【]\s*(official|resmi|lyric|lirik|audio|video|mv|m\/v|music video|clip|visuali[sz]er|hd|4k)[^\)\]】]*[\)\]】]/gi, '')
    .replace(/\s*\|\s*official.*$/i, '').trim();
  const pre = artist.toLowerCase() + ' - ';
  if (artist && s.toLowerCase().startsWith(pre)) s = s.slice(pre.length).trim();
  return s || decode(raw);
};

module.exports = async (req, res) => {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return res.status(500).json({ error: 'YOUTUBE_API_KEY belum diatur di Vercel.' });
  const ids = [...new Set(String(req.query.ids || '').split(',').map((s) => s.trim()).filter((s) => /^[\w-]{11}$/.test(s)))].slice(0, 50);
  if (!ids.length) return res.status(200).json({ items: [] });
  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/videos');
    url.search = new URLSearchParams({ part: 'snippet', id: ids.join(','), maxResults: '50', key }).toString();
    const r = await fetch(url);
    const d = await r.json();
    if (!r.ok) throw new Error((d.error && d.error.message) || 'Gagal memuat data lagu');
    const byId = new Map((d.items || []).map((v) => {
      const artist = cleanArtist(v.snippet.channelTitle);
      return [v.id, { id: v.id, title: cleanTitle(v.snippet.title, artist), artist }];
    }));
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).json({ items: ids.map((id) => byId.get(id)).filter(Boolean) });
  } catch (e) {
    return res.status(502).json({ error: e.message || 'Gagal ambil data lagu.' });
  }
};
