// GET /api/charts?region=ID|GLOBAL
// Tangga lagu = daftar "musik terpopuler" YouTube per negara (videos.list chart=mostPopular,
// kategori Musik). Biaya kuota hanya 1 unit per negara. GLOBAL = gabungan beberapa negara besar.
// Catatan: ini bukan Billboard atau YouTube Music Charts resmi, tapi cerminan musik yang sedang ramai.

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'" };
const decode = (s = '') =>
  s.replace(/&(amp|lt|gt|quot|apos|#39);/g, (m) => ENTITIES[m] || m)
   .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

const GLOBAL_REGIONS = ['US', 'GB', 'BR', 'IN', 'JP', 'DE', 'FR', 'MX', 'KR', 'ID'];

const cleanArtist = (ch = '') =>
  decode(ch).replace(/\s*-\s*Topic$/i, '').replace(/\s*VEVO$/i, '').replace(/\s*official$/i, '').trim();

const cleanTitle = (raw = '', artist = '') => {
  let s = decode(raw)
    .replace(/\s*[\(\[【]\s*(official|resmi|lyric|lirik|audio|video|mv|m\/v|music video|clip|visuali[sz]er|hd|4k)[^\)\]】]*[\)\]】]/gi, '')
    .replace(/\s*\|\s*official.*$/i, '')
    .trim();
  const pre = artist.toLowerCase() + ' - ';
  if (artist && s.toLowerCase().startsWith(pre)) s = s.slice(pre.length).trim();
  return s || decode(raw);
};

async function fetchRegion(code, key) {
  const url = new URL('https://www.googleapis.com/youtube/v3/videos');
  url.search = new URLSearchParams({
    part: 'snippet,status', chart: 'mostPopular', videoCategoryId: '10', regionCode: code, maxResults: '30', key,
  }).toString();
  const r = await fetch(url);
  const d = await r.json();
  if (!r.ok) throw new Error((d.error && d.error.message) || 'Gagal memuat tangga lagu');
  return (d.items || [])
    .filter((v) => !v.status || v.status.embeddable !== false)
    .map((v) => {
      const artist = cleanArtist(v.snippet.channelTitle);
      return {
        id: v.id,
        title: cleanTitle(v.snippet.title, artist),
        artist,
        thumb: (v.snippet.thumbnails && (v.snippet.thumbnails.medium || v.snippet.thumbnails.default || {}).url) ||
          `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`,
        official: true,
      };
    });
}

module.exports = async (req, res) => {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return res.status(500).json({ error: 'YOUTUBE_API_KEY belum diatur di Vercel.' });
  const region = String(req.query.region || 'ID').toUpperCase();

  try {
    let items;
    if (region === 'GLOBAL') {
      const results = await Promise.allSettled(GLOBAL_REGIONS.map((c) => fetchRegion(c, key)));
      const score = new Map();
      const meta = new Map();
      for (const r of results) {
        if (r.status !== 'fulfilled') continue;
        r.value.forEach((t, idx) => {
          score.set(t.id, (score.get(t.id) || 0) + 1 / (idx + 2));
          if (!meta.has(t.id)) meta.set(t.id, t);
        });
      }
      items = [...score.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([id]) => meta.get(id));
      if (!items.length) throw new Error('Tangga lagu global belum tersedia.');
    } else {
      items = (await fetchRegion(region.slice(0, 2), key)).slice(0, 30);
    }
    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
    return res.status(200).json({ items });
  } catch (e) {
    return res.status(502).json({ error: e.message || 'Yah, tangga lagunya gagal dimuat.' });
  }
};
