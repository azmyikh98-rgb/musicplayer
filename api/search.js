// Vercel Serverless Function: GET /api/search?q=...
// Memakai YouTube Data API v3 (resmi). Set env var YOUTUBE_API_KEY di Vercel.

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'" };
const decode = (s = '') =>
  s.replace(/&(amp|lt|gt|quot|apos|#39);/g, (m) => ENTITIES[m] || m)
   .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

module.exports = async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 100);
  const key = process.env.YOUTUBE_API_KEY;

  if (!key) return res.status(500).json({ error: 'YOUTUBE_API_KEY belum diatur di Vercel (Settings > Environment Variables).' });
  if (!q) return res.status(400).json({ error: 'Parameter q wajib diisi.' });

  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.search = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    videoCategoryId: '10', // Music
    videoEmbeddable: 'true',
    videoSyndicated: 'true',
    maxResults: '25',
    q,
    key,
  }).toString();

  try {
    const r = await fetch(url);
    const data = await r.json();
    if (!r.ok) {
      const msg = data?.error?.message || 'Gagal menghubungi YouTube API.';
      return res.status(r.status === 403 ? 429 : 502).json({ error: msg });
    }
    const items = (data.items || [])
      .filter((i) => i.id?.videoId)
      .map((i) => ({
        id: i.id.videoId,
        title: decode(i.snippet.title),
        artist: decode(i.snippet.channelTitle).replace(/ - Topic$/, ''),
        thumb: i.snippet.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${i.id.videoId}/mqdefault.jpg`,
      }));
    // Cache di edge supaya kuota API hemat (1 pencarian = 100 unit dari 10.000/hari)
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).json({ items });
  } catch (e) {
    return res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
};
