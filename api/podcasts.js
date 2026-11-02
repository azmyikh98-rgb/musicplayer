// GET /api/podcasts?topic=indo&sort=new|pop
// Episode podcast dari YouTube (video panjang, bisa disematkan). Di-cache lama di edge supaya hemat kuota YouTube API.

const TOPICS = {
  indo:      { q: 'podcast indonesia full episode', region: 'ID', lang: 'id' },
  komedi:    { q: 'podcast komedi lucu indonesia', region: 'ID', lang: 'id' },
  bisnis:    { q: 'podcast bisnis keuangan investasi indonesia', region: 'ID', lang: 'id' },
  teknologi: { q: 'podcast teknologi startup AI indonesia', region: 'ID', lang: 'id' },
  misteri:   { q: 'podcast misteri horor true crime indonesia', region: 'ID', lang: 'id' },
  psikologi: { q: 'podcast psikologi kesehatan mental self improvement indonesia', region: 'ID', lang: 'id' },
  religi:    { q: 'podcast islam hijrah kajian santai indonesia', region: 'ID', lang: 'id' },
  edukasi:   { q: 'podcast sejarah sains edukasi indonesia', region: 'ID', lang: 'id' },
  olahraga:  { q: 'podcast sepak bola olahraga indonesia', region: 'ID', lang: 'id' },
  global:    { q: 'podcast full episode interview', region: 'US', lang: 'en' },
};
const BAD = /\b(lagu|song|music|musik|lofi|lo-fi|playlist|full album|sholawat|nasyid|remix|karaoke|ringtone|asmr|sleep|meditation|sound|nonstop|non stop|shorts?)\b/i;

const iso = (d) => new Date(d).toISOString();
function secs(d = '') {   // PT1H2M3S
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(d); if (!m) return 0;
  return (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0);
}

module.exports = async (req, res) => {
  const key = process.env.YOUTUBE_API_KEY;
  const topic = TOPICS[req.query.topic] ? String(req.query.topic) : 'indo', T = TOPICS[topic];
  const pop = req.query.sort === 'pop';
  if (!key) return res.status(500).json({ error: 'YOUTUBE_API_KEY belum diatur di Vercel.' });
  try {
    const sUrl = new URL('https://www.googleapis.com/youtube/v3/search');
    sUrl.search = new URLSearchParams({
      part: 'snippet', type: 'video', videoEmbeddable: 'true', videoSyndicated: 'true', videoDuration: 'long',
      order: pop ? 'viewCount' : 'date', publishedAfter: iso(Date.now() - (pop ? 120 : 45) * 864e5),
      maxResults: '40', regionCode: T.region, relevanceLanguage: T.lang, q: T.q, key,
    }).toString();
    const sRes = await fetch(sUrl, { signal: AbortSignal.timeout(8000) });
    const sData = await sRes.json();
    if (!sRes.ok) return res.status(sRes.status === 403 ? 429 : 502).json({ error: (sData.error && sData.error.message) || 'Gagal menghubungi YouTube API.' });
    const found = (sData.items || []).filter((i) => i.id && i.id.videoId && i.snippet && i.snippet.liveBroadcastContent !== 'live' && !BAD.test(i.snippet.title));
    const ids = found.map((i) => i.id.videoId).join(',');
    const det = {};
    if (ids) {
      const vUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
      vUrl.search = new URLSearchParams({ part: 'contentDetails,statistics,status', id: ids, key }).toString();
      const vData = await (await fetch(vUrl, { signal: AbortSignal.timeout(8000) })).json().catch(() => ({}));
      for (const v of vData.items || []) det[v.id] = { dur: secs(v.contentDetails && v.contentDetails.duration), views: Number(v.statistics && v.statistics.viewCount) || 0, emb: !v.status || v.status.embeddable !== false };
    }
    const items = found.map((i) => {
      const d = det[i.id.videoId] || {}, sn = i.snippet, th = sn.thumbnails || {};
      return { id: i.id.videoId, title: sn.title.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"'), artist: sn.channelTitle, thumb: (th.medium || th.default || {}).url || '', dur: d.dur || 0, views: d.views || 0, pub: sn.publishedAt, emb: d.emb !== false, pod: 1 };
    }).filter((x) => x.emb && x.dur >= 15 * 60 && x.dur <= 5 * 3600)
      .map(({ emb, ...x }) => x);
    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
    return res.status(200).json({ topic, sort: pop ? 'pop' : 'new', items: items.slice(0, 24) });
  } catch (e) {
    return res.status(500).json({ error: 'Servernya lagi error, coba lagi ya.' });
  }
};
module.exports.TOPICS = Object.keys(TOPICS);
