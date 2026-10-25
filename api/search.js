// GET /api/search?q=...&official=1|0
// Memakai YouTube Data API v3. Set env var YOUTUBE_API_KEY di Vercel.
// Hasil diberi skor supaya musik resmi (channel artis, label, VEVO, "- Topic")
// naik ke atas dan reupload (lirik, cover, slowed, dll) turun atau disaring.

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'" };
const decode = (s = '') =>
  s.replace(/&(amp|lt|gt|quot|apos|#39);/g, (m) => ENTITIES[m] || m)
   .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
const norm = (s = '') => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

// Pola yang umum pada reupload / versi tidak resmi
const BAD = /\b(lyrics?|lirik|cover|karaoke|instrumental|slowed|reverb|sped[ -]?up|nightcore|8d|bass ?boosted|mashup|reaction|tutorial|fan ?made|ringtone|status wa|story wa|full album|1 hour|loop)\b/i;
const BAD_CHANNEL = /(lyrics?|lirik|songs?|hits|mix|playlist|nation|fans?|world|zone|hub|cover|reup|remix|karaoke|nightcore)/i;
// Jika pengguna memang mencari varian itu, jangan dihukum
const VARIANT_Q = /\b(remix|cover|lyrics?|lirik|karaoke|live|acoustic|instrumental|slowed|reverb|nightcore|8d|sped|mashup|album)\b/i;

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

function rank(items, details, q) {
  const wantsVariant = VARIANT_Q.test(q);
  const seen = new Map();
  for (const i of items) {
    const id = i.id && i.id.videoId;
    if (!id) continue;
    const ch = decode(i.snippet.channelTitle);
    const rawTitle = decode(i.snippet.title);
    const artist = cleanArtist(ch);
    const title = cleanTitle(rawTitle, artist);
    const d = details[id] || {};

    const topic = / - topic$/i.test(ch);
    const vevo = /vevo$/i.test(ch.replace(/\s+/g, ''));
    const nArtist = norm(artist);
    const nameMatch = nArtist.length >= 3 && norm(rawTitle).includes(nArtist);
    const officialTag = /\b(official|resmi)\b/i.test(rawTitle);
    const bad = !wantsVariant && (BAD.test(rawTitle) || BAD_CHANNEL.test(ch));
    const suspiciousChannel = BAD_CHANNEL.test(ch);

    const score =
      (topic ? 6 : 0) + (vevo ? 5 : 0) + (nameMatch ? 3 : 0) + (d.licensed ? 2 : 0) + (officialTag ? 1.5 : 0) +
      Math.log10((d.views || 0) + 10) * 0.4 - (bad ? 8 : 0);
    const official = !bad && (topic || vevo || nameMatch || (d.licensed && (officialTag || !suspiciousChannel)));

    const row = {
      id, title, artist, official, score,
      thumb: (i.snippet.thumbnails && (i.snippet.thumbnails.medium || i.snippet.thumbnails.default || {}).url) ||
        `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
    };
    const key = norm(title) + '|' + nArtist;
    const prev = seen.get(key);
    if (!prev || row.score > prev.score) seen.set(key, row);
  }
  return [...seen.values()].sort((a, b) => (b.official - a.official) || (b.score - a.score));
}

module.exports = async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 100);
  const officialOnly = req.query.official !== '0';
  const key = process.env.YOUTUBE_API_KEY;

  if (!key) return res.status(500).json({ error: 'YOUTUBE_API_KEY belum diatur di Vercel (Settings > Environment Variables).' });
  if (!q) return res.status(400).json({ error: 'Parameter q wajib diisi.' });

  try {
    const sUrl = new URL('https://www.googleapis.com/youtube/v3/search');
    sUrl.search = new URLSearchParams({
      part: 'snippet', type: 'video', videoCategoryId: '10', videoEmbeddable: 'true', videoSyndicated: 'true',
      maxResults: '50', regionCode: process.env.YT_REGION || 'ID', q, key,
    }).toString();
    const sRes = await fetch(sUrl);
    const sData = await sRes.json();
    if (!sRes.ok) {
      const msg = (sData.error && sData.error.message) || 'Gagal menghubungi YouTube API.';
      return res.status(sRes.status === 403 ? 429 : 502).json({ error: msg });
    }
    const items = sData.items || [];

    // Detail video (1 unit kuota): status licensed + jumlah penonton
    const details = {};
    try {
      const ids = items.map((i) => i.id && i.id.videoId).filter(Boolean).join(',');
      if (ids) {
        const vUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
        vUrl.search = new URLSearchParams({ part: 'contentDetails,statistics', id: ids, key }).toString();
        const vData = await (await fetch(vUrl)).json();
        for (const v of vData.items || []) {
          details[v.id] = {
            licensed: !!(v.contentDetails && v.contentDetails.licensedContent),
            views: Number(v.statistics && v.statistics.viewCount) || 0,
          };
        }
      }
    } catch (e) { /* tanpa detail pun tetap bisa diranking */ }

    let ranked = rank(items, details, q);
    if (officialOnly) ranked = ranked.filter((r) => r.official);
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).json({ items: ranked.slice(0, 30).map(({ score, ...r }) => r) });
  } catch (e) {
    return res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
};
module.exports._rank = rank;
