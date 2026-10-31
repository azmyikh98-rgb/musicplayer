/* =====================================================================
   features.js: fitur lanjutan Nada
   Statistik dengar + Nada Recap, Mix Untukmu, rekomendasi "Mirip lagu ini" + putar otomatis,
   lirik layar penuh (karaoke), serta cadangan & pindah data.
   Dimuat setelah app.js dan memakai variabel/fungsi global dari app.js.
   ===================================================================== */

const NF = {
  stats: store.get('nada.stats', { v: 1, months: {} }),
  dirty: false,
  listen: { id: '', sec: 0, counted: false },
  period: store.get('recapPeriod', 'month'),
  card: { blob: null, busy: false, key: '' },
  mix: store.get('nada.mix', null),
  mixBusy: false, mixSalt: 0,
  sim: { id: '', status: 'idle', items: [] },
  autoplay: store.get('autoplay', true),
  k: { tid: '', sig: '', size: store.get('kSize', 1), wl: null, tint: '' },
};
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const monthKey = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
const dayKey = (d = new Date()) => monthKey(d) + '-' + String(d.getDate()).padStart(2, '0');
const FI = {
  recap: '<svg viewBox="0 0 24 24"><path d="M5 20V10M12 20V4M19 20v-7"/></svg>',
  backup: '<svg viewBox="0 0 24 24"><path d="M12 16V4M8 8l4-4 4 4M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/></svg>',
  spark: '<svg viewBox="0 0 24 24"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/></svg>',
};

/* =====================================================================
   1. STATISTIK DENGAR
   ===================================================================== */
function statsMonth(k) { const m = NF.stats.months; return m[k] || (m[k] = { sec: 0, plays: 0, days: {}, tracks: {}, artists: {} }); }
function statsTick() {
  if (!state.playing) return;
  const t = current(); if (!t) return;
  const L = NF.listen;
  if (L.id !== t.id) { L.id = t.id; L.sec = 0; L.counted = false; }
  L.sec++;
  const now = new Date(), m = statsMonth(monthKey(now)), dk = dayKey(now);
  m.sec++; m.days[dk] = (m.days[dk] || 0) + 1;
  const an = firstArtist(t.artist) || 'Tanpa nama';
  const tr = m.tracks[t.id] || (m.tracks[t.id] = { t: t.title, a: t.artist, th: t.thumb || '', n: 0, s: 0 });
  const ar = m.artists[an] || (m.artists[an] = { n: 0, s: 0, th: t.thumb || thumb(t.id), id: t.id });
  tr.s++; ar.s++;
  if (!L.counted && L.sec >= 30) { L.counted = true; m.plays++; tr.n++; ar.n++; }
  NF.dirty = true;
}
function statsSave() {
  if (!NF.dirty) return; NF.dirty = false;
  const m = statsMonth(monthKey());
  const ids = Object.keys(m.tracks);
  if (ids.length > 260) ids.sort((a, b) => (m.tracks[b].n * 1000 + m.tracks[b].s) - (m.tracks[a].n * 1000 + m.tracks[a].s)).slice(160).forEach((id) => delete m.tracks[id]);
  store.set('nada.stats', NF.stats);
}
setInterval(statsTick, 1000);
setInterval(statsSave, 15000);
window.addEventListener('pagehide', statsSave);
document.addEventListener('visibilitychange', () => { if (document.hidden) statsSave(); });

function statsRange(period) {
  const ms = NF.stats.months, keys = period === 'month' ? [monthKey()] : Object.keys(ms);
  const agg = { sec: 0, plays: 0, days: {}, tracks: {}, artists: {} };
  keys.forEach((k) => {
    const m = ms[k]; if (!m) return;
    agg.sec += m.sec; agg.plays += m.plays; Object.assign(agg.days, m.days);
    for (const [id, t] of Object.entries(m.tracks)) { const x = agg.tracks[id] || (agg.tracks[id] = { ...t, n: 0, s: 0 }); x.n += t.n; x.s += t.s; }
    for (const [n, a] of Object.entries(m.artists)) { const x = agg.artists[n] || (agg.artists[n] = { ...a, n: 0, s: 0 }); x.n += a.n; x.s += a.s; }
  });
  return agg;
}
const topBy = (obj, k = 5) => Object.entries(obj).map(([key, v]) => ({ key, ...v })).sort((a, b) => (b.n * 1000 + b.s) - (a.n * 1000 + a.s)).slice(0, k);
const asTrack = (e) => ({ id: e.key, title: e.t, artist: e.a, thumb: e.th || thumb(e.key) });

function recapData() {
  const d = statsRange(NF.period);
  const wd = new Array(7).fill(0);
  Object.entries(d.days).forEach(([k, s]) => { wd[new Date(k + 'T12:00:00').getDay()] += s; });
  const best = wd.indexOf(Math.max(...wd));
  // beruntun: hari-hari berturut-turut sampai hari ini (dari seluruh riwayat)
  const all = statsRange('all').days; let streak = 0; const c = new Date();
  if (!all[dayKey(c)]) c.setDate(c.getDate() - 1);
  while (all[dayKey(c)]) { streak++; c.setDate(c.getDate() - 1); }
  const active = Object.keys(d.days).length;
  return {
    minutes: Math.round(d.sec / 60), plays: d.plays, active, streak,
    avgDay: active ? Math.round(d.sec / 60 / active) : 0,
    bestDay: Math.max(...wd) > 0 ? DAYS[best] : '',
    artists: topBy(d.artists, 5), tracks: topBy(d.tracks, 10).map(asTrack),
    label: NF.period === 'month' ? `${MONTHS[new Date().getMonth()]} ${new Date().getFullYear()}` : 'Sepanjang waktu',
    empty: d.sec < 60,
  };
}

function recapViewHTML() {
  const R = recapData();
  const seg = (k, l) => `<button class="seg${NF.period === k ? ' on' : ''}" data-nav data-recapperiod="${k}" aria-pressed="${NF.period === k}">${l}</button>`;
  let h = `<div class="recap"><div class="segs">${seg('month', 'Bulan ini')}${seg('all', 'Semua')}</div>`;
  if (R.empty) {
    return h + `<div class="empty"><b>Recap kamu belum ada</b>Putar beberapa lagu dulu, nanti ringkasan dengarmu muncul di sini. Dihitung dari lagu yang kamu dengerin di Nada.</div></div>`;
  }
  const top = R.artists[0];
  h += `<div class="rc-hero"><small>${esc(R.label)}</small><div class="rc-num"><b>${R.minutes.toLocaleString('id-ID')}</b><span>menit dengerin musik</span></div>
    <p>${R.plays} lagu diputar · ${R.active} hari aktif</p></div>`;
  if (top) h += `<div class="rc-top" data-nav tabindex="0" role="button" data-artist="${esc(top.key)}"><div class="rc-av">${avatar({ name: top.key, thumb: top.th })}</div><div><small>Artis nomor satu</small><b>${esc(top.key)}</b><i>${top.n} kali diputar</i></div></div>`;
  h += '<div class="rc-chips">'
    + (R.bestDay ? `<span><em>Hari favorit</em><b>${R.bestDay}</b></span>` : '')
    + (R.streak > 1 ? `<span><em>Beruntun</em><b>${R.streak} hari</b></span>` : '')
    + (R.avgDay ? `<span><em>Rata-rata</em><b>${R.avgDay} mnt/hari</b></span>` : '') + '</div>';
  h += '<div class="sec-head" style="margin-top:1.25rem"><h2>Lagu teratas</h2></div><div class="tracks">' + R.tracks.slice(0, 5).map((t, i) => rowHTML(t, i, 'recap', true)).join('') + '</div>';
  if (R.artists.length > 1) h += '<div class="sec-head" style="margin-top:1.25rem"><h2>Artis teratas</h2></div>' + hscroll(R.artists.map((a) => `<div class="artist" data-nav tabindex="0" role="button" data-artist="${esc(a.key)}">${avatar({ name: a.key, thumb: a.th })}<b>${esc(a.key)}</b></div>`));
  h += `<div class="rc-act"><button class="pill big" data-nav data-recapshare ${NF.card.blob ? '' : 'disabled'}>${ICON.share}<span>${NF.card.blob ? 'Bagikan kartu' : 'Menyiapkan kartu…'}</span></button><button class="pill ghost big" data-nav data-recapsave ${NF.card.blob ? '' : 'disabled'}>${ICON.download}<span>Simpan</span></button></div>`;
  h += '<p class="hint">Dihitung dari lagu yang diputar di Nada pada perangkat ini. Satu lagu dihitung kalau didengerin lebih dari 30 detik.</p></div>';
  scheduleCard();
  return h;
}

/* kartu recap yang bisa dibagikan (gambar 1080x1920) */
function loadImg(src) { return new Promise((res) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }); }
function scheduleCard() {
  const R = recapData(); if (R.empty) return;
  const key = NF.period + '|' + R.minutes + '|' + (R.artists[0] ? R.artists[0].key : '');
  if (NF.card.key === key && (NF.card.blob || NF.card.busy)) return;
  NF.card = { blob: null, busy: true, key };
  drawRecapCard(R).then((blob) => {
    if (NF.card.key !== key) return;
    NF.card = { blob, busy: false, key };
    if (state.view && state.view.ctx === 'recap') render();
  });
}
async function drawRecapCard(R) {
  const W = 1080, H = 1920, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#2b0a3d'); bg.addColorStop(.55, '#6b1d5a'); bg.addColorStop(1, '#ff5a5f');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const glow = (x, y, r, col) => { const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(0, 0, W, H); };
  glow(900, 250, 700, 'rgba(255,200,120,.35)'); glow(100, 1500, 800, 'rgba(120,80,255,.35)');
  const F = 'Inter, "Segoe UI", system-ui, -apple-system, sans-serif';
  g.textBaseline = 'alphabetic';
  g.fillStyle = 'rgba(255,255,255,.75)'; g.font = `700 40px ${F}`; g.fillText('NADA RECAP', 90, 150);
  g.font = `600 44px ${F}`; g.fillStyle = '#fff'; g.fillText(R.label, 90, 215);
  g.font = `900 300px ${F}`; g.fillStyle = '#fff';
  const num = R.minutes.toLocaleString('id-ID'); g.fillText(num, 82, 560);
  g.font = `600 52px ${F}`; g.fillStyle = 'rgba(255,255,255,.88)'; g.fillText('menit dengerin musik', 90, 640);
  g.font = `500 40px ${F}`; g.fillStyle = 'rgba(255,255,255,.7)'; g.fillText(`${R.plays} lagu diputar · ${R.active} hari aktif`, 90, 705);
  // artis teratas
  const top = R.artists[0];
  if (top) {
    const img = await loadImg('/api/img?id=' + encodeURIComponent(top.id || (R.tracks[0] && R.tracks[0].id) || ''));
    const cx = 270, cy = 960, r = 150;
    g.save(); g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip();
    if (img) { const s = Math.max(2 * r / img.width, 2 * r / img.height), w = img.width * s, h = img.height * s; g.drawImage(img, cx - w / 2, cy - h / 2, w, h); }
    else { g.fillStyle = '#ff7a59'; g.fillRect(cx - r, cy - r, 2 * r, 2 * r); }
    g.restore(); g.lineWidth = 8; g.strokeStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.7)'; g.font = `700 36px ${F}`; g.fillText('ARTIS NOMOR SATU', 470, 905);
    g.fillStyle = '#fff'; g.font = `900 72px ${F}`;
    let nm = top.key; while (g.measureText(nm).width > 540 && nm.length > 3) nm = nm.slice(0, -2); if (nm !== top.key) nm += '…';
    g.fillText(nm, 470, 990);
    g.fillStyle = 'rgba(255,255,255,.75)'; g.font = `500 40px ${F}`; g.fillText(`${top.n} kali diputar`, 470, 1050);
  }
  const list = (title, rows, y0) => {
    g.fillStyle = 'rgba(255,255,255,.7)'; g.font = `700 36px ${F}`; g.fillText(title, 90, y0);
    rows.slice(0, 3).forEach((t, i) => {
      const y = y0 + 90 + i * 92;
      g.fillStyle = 'rgba(255,255,255,.55)'; g.font = `800 52px ${F}`; g.fillText(String(i + 1), 90, y);
      g.fillStyle = '#fff'; g.font = `700 50px ${F}`;
      let s = t; while (g.measureText(s).width > 820 && s.length > 4) s = s.slice(0, -2); if (s !== t) s += '…';
      g.fillText(s, 170, y);
    });
  };
  list('LAGU TERATAS', R.tracks.map((t) => t.title), 1190);
  list('ARTIS TERATAS', R.artists.map((a) => a.key), 1540);
  g.fillStyle = 'rgba(255,255,255,.8)'; g.font = `700 36px ${F}`; g.fillText('Dengerin di Nada', 90, 1870);
  return new Promise((res) => c.toBlob((b) => res(b), 'image/png'));
}
async function recapShare(saveOnly) {
  const blob = NF.card.blob; if (!blob) { toast('Kartunya masih disiapkan'); return; }
  const file = new File([blob], 'nada-recap.png', { type: 'image/png' });
  try {
    if (!saveOnly && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Nada Recap', text: 'Recap dengar musikku di Nada' }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'nada-recap.png';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('Kartu disimpan');
}

/* =====================================================================
   2. MIX UNTUKMU
   ===================================================================== */
function seedRand(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const shuffled = (arr, rnd) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; };
const uniqTracks = (arr) => { const seen = new Set(); return arr.filter((t) => t && t.id && !seen.has(t.id) && seen.add(t.id)); };
function knownTracks() {
  const all = statsRange('all');
  return uniqTracks([...topBy(all.tracks, 40).map(asTrack), ...state.fav, ...state.recent]);
}
function artistScores() {
  const sc = {};
  const add = (n, v) => { const k = firstArtist(n); if (k) sc[k] = (sc[k] || 0) + v; };
  const all = statsRange('all');
  Object.entries(all.artists).forEach(([n, a]) => add(n, a.n * 3 + a.s / 300));
  state.fav.forEach((t) => add(t.artist, 2));
  state.recent.forEach((t) => add(t.artist, 1));
  state.artists.forEach((a) => add(a.name, 3));
  return Object.entries(sc).sort((a, b) => b[1] - a[1]).map((e) => e[0]);
}
async function artistSongs(name) {
  try {
    const d = await searchApi(name, true), n = lc(name);
    const mine = (d.items || []).filter((t) => { const a = lc(t.artist); return a && (a.includes(n) || n.includes(a)); });
    return mine.length >= 4 ? mine : [];
  } catch { return []; }
}
async function buildMixes() {
  if (NF.mixBusy) return; NF.mixBusy = true;
  try {
    const day = dayKey(), rnd = seedRand(day + '|' + NF.mixSalt);
    const known = knownTracks(), tops = artistScores().slice(0, 3);
    if (typeof loadCharts === 'function') loadCharts();
    const songs = await Promise.all(tops.map(artistSongs));
    const items = [];
    const knownIds = new Set(known.map((t) => t.id));
    const all = statsRange('all');
    const favs = shuffled(uniqTracks([...topBy(all.tracks, 15).map(asTrack), ...state.fav]), rnd).slice(0, 12);
    const rec = shuffled(state.recent, rnd).slice(0, 6);
    const extra = shuffled(uniqTracks(songs.flat()), rnd).slice(0, 10);
    const daily = shuffled(uniqTracks([...favs, ...rec, ...extra]), rnd).slice(0, 25);
    if (daily.length >= 5) items.push({ id: 'daily', name: 'Mix Harian', sub: 'Dari lagu yang sering kamu putar', tracks: daily });
    tops.slice(0, 2).forEach((a, i) => {
      const mine = known.filter((t) => lc(firstArtist(t.artist)) === lc(a));
      const tr = shuffled(uniqTracks([...mine, ...songs[i]]), rnd).slice(0, 20);
      if (tr.length >= 5) items.push({ id: 'artist' + i, name: `Mix ${a}`, sub: `${a} dan lagu yang kamu suka`, tracks: tr });
    });
    for (let w = 0; w < 12 && !(state.charts.ID && state.charts.ID.length); w++) await new Promise((r) => setTimeout(r, 300));
    const fresh = shuffled(uniqTracks([...(state.charts.ID || []), ...(state.charts.GLOBAL || [])]).filter((t) => !knownIds.has(t.id)), rnd).slice(0, 20);
    if (fresh.length >= 8) items.push({ id: 'new', name: 'Mix Penemuan', sub: 'Lagu hits yang belum kamu putar', tracks: fresh.map(slim) });
    NF.mix = { day, items: items.map((m) => ({ ...m, tracks: m.tracks.map(slim) })) };
    store.set('nada.mix', NF.mix);
  } catch { NF.mix = { day: dayKey(), items: [] }; }
  NF.mixBusy = false;
  if (state.tab === 'home' && !state.view) render();
}
const mosaic = (tracks) => {
  const t = tracks.slice(0, 4); while (t.length && t.length < 4) t.push(t[t.length % tracks.length]);
  return `<div class="cover mosaic">${t.map((x) => `<img src="${imgOf(x)}" alt="" loading="lazy">`).join('')}</div>`;
};
function mixSection() {
  const enough = knownTracks().length >= 3;
  let h = '';
  if (!enough) {
    h = `<section class="sec"><div class="sec-head"><h2>Mix Untukmu<small class="sub">Diracik dari kebiasaan dengarmu</small></h2></div><div class="mix-tease">${FI.spark}<p>Muter atau Like beberapa lagu dulu. Nanti kami racik mix harian khusus buat kamu di sini.</p></div></section>`;
  } else {
    if (!NF.mix || NF.mix.day !== dayKey()) buildMixes();
    const ready = NF.mix && NF.mix.day === dayKey() && NF.mix.items.length;
    const cards = ready
      ? NF.mix.items.map((m) => `<div class="card mix" data-nav tabindex="0" role="button" data-open="mix:${m.id}" aria-label="Buka ${esc(m.name)}">${mosaic(m.tracks)}<span class="mixtag">${FI.spark}</span><b>${esc(m.name)}</b><small>${m.tracks.length} lagu</small></div>`)
      : Array(3).fill('<div class="card sk"><div class="cover"></div></div>');
    if (!ready && NF.mix && NF.mix.day === dayKey()) return '';
    h = section('Mix Untukmu', hscroll(cards), '', 'Diracik tiap hari dari kebiasaan dengarmu');
  }
  // teaser Recap kalau sudah cukup data
  const cur = statsRange('month');
  if (cur.sec >= 600) h += `<button class="rc-teaser" data-nav data-open="recap"><span class="ico">${FI.recap}</span><span><b>Recap ${MONTHS[new Date().getMonth()]} kamu</b><small>${Math.round(cur.sec / 60)} menit dengerin musik. Lihat ringkasannya</small></span></button>`;
  return h;
}
function mixById(id) { return NF.mix && NF.mix.items.find((m) => m.id === id); }
function mixViewHTML(id) {
  const m = mixById(id);
  if (!m) return `<div class="empty"><b>Mix-nya udah berganti</b>Mix diracik ulang tiap hari. Balik ke Beranda buat lihat yang terbaru.</div>`;
  const n = m.tracks.length;
  return `<div class="vhero"><div class="vcover grid">${m.tracks.slice(0, 4).map((t) => `<img src="${imgOf(t)}" alt="">`).join('')}</div>
    <div class="vinfo"><small class="vkind">Mix Untukmu</small><h2>${esc(m.name)}</h2><p class="vsub">${n} lagu · ${esc(m.sub)}</p>
      <div class="vact"><button class="pill big" data-nav data-playall="mix:${m.id}">${ICON.play}<span>Putar</span></button><button class="pill ghost big" data-nav data-shuffleall="mix:${m.id}">${ICON.shuffle}<span>Acak</span></button>
      <button class="round" data-nav data-mixsave="${m.id}" aria-label="Simpan jadi playlist" title="Simpan jadi playlist">${ICON.plus}</button></div></div></div>
    <div class="tracks">${m.tracks.map((t, i) => rowHTML(t, i, 'mix:' + id)).join('')}</div>
    <div class="rc-act"><button class="pill ghost big" data-nav data-mixrefresh>${FI.spark}<span>Racik ulang</span></button></div>`;
}

/* =====================================================================
   3. MIRIP LAGU INI + PUTAR OTOMATIS
   ===================================================================== */
async function loadSimilar(force) {
  const t = current(); if (!t) return;
  if (NF.sim.id === t.id && NF.sim.status !== 'err' && !force) return;
  NF.sim = { id: t.id, status: 'loading', items: [] };
  refreshQueueSheet();
  try {
    const an = firstArtist(t.artist), n = lc(an);
    const reqs = [searchApi(an, true)]; if (state.src) reqs.push(searchApi(state.src, true));
    const res = await Promise.allSettled(reqs);
    const A = (res[0].value && res[0].value.items) || [], G = (res[1] && res[1].value && res[1].value.items) || [];
    const same = A.filter((x) => { const a = lc(x.artist); return a && (a.includes(n) || n.includes(a)); });
    const other = A.filter((x) => !same.includes(x));
    const inQ = new Set(state.queue.map((x) => x.id));
    const mix = []; const L = Math.max(same.length, G.length, other.length);
    for (let i = 0; i < L; i++) [same[i], G[i], other[i]].forEach((x) => x && mix.push(x));
    const items = uniqTracks(mix).filter((x) => x.id !== t.id && !inQ.has(x.id)).slice(0, 12).map(slim);
    if (NF.sim.id !== t.id) return;
    NF.sim = { id: t.id, status: items.length ? 'ok' : 'none', items };
  } catch { if (NF.sim.id === t.id) NF.sim = { id: t.id, status: 'err', items: [] }; }
  refreshQueueSheet();
}
function refreshQueueSheet() { if (!$('#queueSheet').hidden) renderQueueSheet(); }
function similarHTML() {
  const t = current(); if (!t) return '';
  if (NF.sim.id !== t.id) loadSimilar();
  const S = NF.sim.id === t.id ? NF.sim : { status: 'loading', items: [] };
  let h = `<div class="q-sec">Mirip lagu ini<em>${esc(firstArtist(t.artist))}</em></div>`;
  h += `<button class="qauto${NF.autoplay ? ' on' : ''}" type="button" data-autoplay aria-pressed="${NF.autoplay}"><span><b>Putar otomatis</b><small>Lanjut ke lagu mirip kalau antrean habis</small></span><i class="sw"></i></button>`;
  if (S.status === 'loading') h += '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
  else if (S.status === 'err') h += '<p class="q-end">Rekomendasinya gagal dimuat. <button class="link" type="button" data-simretry>Coba lagi</button></p>';
  else if (!S.items.length) h += '<p class="q-end">Belum nemu lagu yang mirip.</p>';
  else h += S.items.map((x, i) => `<div class="qr sim"><div class="qm" data-nav tabindex="0" role="button" data-simplay="${i}" aria-label="Putar ${esc(x.title)} sekarang"><img src="${imgOf(x)}" alt="" loading="lazy"><span class="meta"><b>${esc(x.title)}</b><small>${esc(x.artist)}</small></span></div><button class="qx add" type="button" data-nav data-simadd="${i}" aria-label="Tambah ${esc(x.title)} ke antrean"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button></div>`).join('');
  return h;
}
$('#qsBody').addEventListener('click', (e) => {
  if (e.target.closest('[data-autoplay]')) { NF.autoplay = !NF.autoplay; store.set('autoplay', NF.autoplay); renderQueueSheet(); toast(NF.autoplay ? 'Putar otomatis aktif' : 'Putar otomatis mati'); return; }
  if (e.target.closest('[data-simretry]')) { loadSimilar(true); return; }
  const a = e.target.closest('[data-simadd]'), p = e.target.closest('[data-simplay]');
  const i = a ? +a.dataset.simadd : p ? +p.dataset.simplay : -1, x = NF.sim.items[i]; if (!x) return;
  if (a) { addToQueue(x); NF.sim.items.splice(i, 1); renderQueueSheet(); }
  else { playNext(x); NF.sim.items.splice(i, 1); next(); renderQueueSheet(); }
});
function autoplayNext() {
  if (!NF.autoplay || !current()) return false;
  const t = current();
  (async () => {
    await loadSimilar();
    const items = NF.sim.id === t.id ? NF.sim.items : [];
    if (!items.length) { state.want = false; keep.stop(); setPlaying(false); toast('Antrean habis'); return; }
    state.queue.push(...items); NF.sim.items = [];
    state.idx++; state.userQ = 0; load(0); qChanged();
    toast('Lanjut ke lagu mirip');
  })();
  return true;
}

/* =====================================================================
   4. LIRIK LAYAR PENUH (KARAOKE)
   ===================================================================== */
const kEl = $('#karaoke');
$('#kPrev').innerHTML = ICON.prev; $('#kNext').innerHTML = ICON.next;
function kImgSrc(t) { return '/api/img?id=' + encodeURIComponent(t.id); }
async function kTint(t) {
  const img = await loadImg(kImgSrc(t)); let col = '';
  try {
    if (img) {
      const c = document.createElement('canvas'); c.width = c.height = 8; const g = c.getContext('2d'); g.drawImage(img, 0, 0, 8, 8);
      const d = g.getImageData(0, 0, 8, 8).data; let r = 0, gg = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; }
      col = `${Math.round(r / n * .55)}, ${Math.round(gg / n * .55)}, ${Math.round(b / n * .55)}`;
    }
  } catch {}
  if (current() && current().id === t.id) kEl.style.setProperty('--kc', col || '60, 20, 40');
}
function kMeta() {
  const t = current(); if (!t) return;
  NF.k.tid = t.id; NF.k.sig = '';
  $('#kTitle').textContent = t.title; $('#kArtist').textContent = t.artist;
  const im = $('#kImg'); im.onerror = () => { im.onerror = null; im.src = t.thumb || thumb(t.id); }; im.src = kImgSrc(t);
  kTint(t);
  if (state.lyr.id !== t.id || state.lyr.status === 'idle') ensureLyrics();
}
async function kLock() { try { if ('wakeLock' in navigator && !NF.k.wl) { NF.k.wl = await navigator.wakeLock.request('screen'); NF.k.wl.addEventListener('release', () => { NF.k.wl = null; }); } } catch {} }
function openKaraoke() {
  if (!current()) { toast('Putar lagu dulu ya'); return; }
  kEl.hidden = false; kEl.dataset.size = NF.k.size; kMeta(); kLock(); kTick(true);
  $('#kClose').focus();
}
function closeKaraoke() { kEl.hidden = true; try { if (NF.k.wl) NF.k.wl.release(); } catch {} NF.k.wl = null; }
function kTick(force) {
  if (kEl.hidden) return;
  const t = current(); if (!t) { closeKaraoke(); return; }
  if (NF.k.tid !== t.id) kMeta();
  $('#kPlay').innerHTML = state.playing ? ICON.pause : ICON.play;
  let cur = 0, dur = 0; try { if (ytReady) { cur = yt.getCurrentTime() || 0; dur = yt.getDuration() || 0; } } catch {}
  $('#kBar').style.width = dur ? (cur / dur * 100) + '%' : '0%';
  const L = state.lyr, box = $('#kLines');
  if (L.id !== t.id || L.status === 'loading' || L.status === 'idle') { sig('load', '<p class="k-msg">Nyari liriknya…</p>'); return; }
  if (L.status === 'instrumental') { sig('ins', '<p class="k-msg">Lagu instrumental, nggak ada liriknya.</p>'); return; }
  if (L.status !== 'ok') { sig('none', `<p class="k-msg">${L.status === 'err' ? 'Liriknya lagi nggak bisa dimuat.' : 'Lirik lagu ini belum ada nih.'}</p>`); return; }
  if (!L.synced.length) { sig('plain', '<div class="k-plain">' + L.plain.split(/\r?\n/).map((l) => (l.trim() ? `<p>${esc(l)}</p>` : '<p class="gap"></p>')).join('') + '</div>'); return; }
  const x = cur + 0.25 - lyrOff();
  let lo = 0, hi = L.synced.length - 1, idx = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (L.synced[m][0] <= x) { idx = m; lo = m + 1; } else hi = m - 1; }
  let h = '';
  for (let k = idx - 2; k <= idx + 3; k++) {
    const l = L.synced[k]; if (!l) { h += '<p class="k-l blank"></p>'; continue; }
    h += `<p class="k-l c${k - idx}" data-kt="${l[0]}">${l[1] ? esc(l[1]) : '♪'}</p>`;
  }
  sig('s' + idx, h, true);
  function sig(s, html, anim) { const key = t.id + '|' + s; if (NF.k.sig === key && !force) return; NF.k.sig = key; box.classList.toggle('anim', !!anim); box.innerHTML = html; }
}
setInterval(kTick, 150);
document.addEventListener('visibilitychange', () => { if (!document.hidden && !kEl.hidden) kLock(); });
$('#kBtn').addEventListener('click', () => { if (state.pview !== 'lyrics') setPview('lyrics'); openKaraoke(); });
$('#kClose').addEventListener('click', closeKaraoke);
$('#kPlay').addEventListener('click', toggle);
$('#kPrev').addEventListener('click', prev);
$('#kNext').addEventListener('click', () => next());
$('#kSize').addEventListener('click', () => { NF.k.size = (NF.k.size + 1) % 3; store.set('kSize', NF.k.size); kEl.dataset.size = NF.k.size; toast(['Huruf kecil', 'Huruf sedang', 'Huruf besar'][NF.k.size]); });
$('#kLines').addEventListener('click', (e) => { const p = e.target.closest('[data-kt]'); if (p && ytReady) { yt.seekTo(parseFloat(p.dataset.kt) + lyrOff(), true); NF.k.sig = ''; } });

/* =====================================================================
   5. CADANGAN & PINDAH PERANGKAT
   ===================================================================== */
function backupData() {
  return { app: 'nada', v: 1, at: new Date().toISOString(), fav: state.fav, recent: state.recent, playlists: state.playlists, artists: state.artists, history: state.history, stats: NF.stats, lyrOffs };
}
const okTrack = (t) => t && typeof t.id === 'string' && /^[\w-]{11}$/.test(t.id);
const cleanTracks = (a) => (Array.isArray(a) ? a.filter(okTrack).map((t) => ({ id: t.id, title: String(t.title || '').slice(0, 160), artist: String(t.artist || '').slice(0, 100), thumb: t.thumb && /^https:\/\/i\.ytimg\.com\//.test(t.thumb) ? t.thumb : thumb(t.id) })) : []);
function parseBackup(text) {
  let o; try { o = JSON.parse(text); } catch { throw new Error('File-nya rusak, bukan cadangan yang valid.'); }
  if (!o || o.app !== 'nada') throw new Error('Ini bukan file cadangan Nada.');
  return {
    fav: cleanTracks(o.fav), recent: cleanTracks(o.recent),
    playlists: (Array.isArray(o.playlists) ? o.playlists : []).filter((p) => p && typeof p.name === 'string').slice(0, 100).map((p) => ({ id: String(p.id || uid()).slice(0, 24), name: p.name.slice(0, 40), tracks: cleanTracks(p.tracks).slice(0, 500) })),
    artists: (Array.isArray(o.artists) ? o.artists : []).filter((a) => a && typeof a.name === 'string').slice(0, 300).map((a) => ({ name: a.name.slice(0, 40), thumb: typeof a.thumb === 'string' ? a.thumb.slice(0, 300) : '' })),
    history: (Array.isArray(o.history) ? o.history : []).filter((x) => typeof x === 'string').slice(0, 30),
    stats: o.stats && typeof o.stats.months === 'object' ? o.stats : { v: 1, months: {} },
    lyrOffs: o.lyrOffs && typeof o.lyrOffs === 'object' ? o.lyrOffs : {},
  };
}
function backupSummary(d) {
  const mins = Math.round(Object.values(d.stats.months || {}).reduce((s, m) => s + ((m && m.sec) || 0), 0) / 60);
  return `${d.fav.length} Liked Songs · ${d.playlists.length} playlist · ${d.artists.length} artis · ${mins} menit dengar`;
}
function applyBackup(inc, replace) {
  const un = (a, b, key) => { const seen = new Set(a.map(key)); return [...a, ...b.filter((x) => !seen.has(key(x)))]; };
  if (replace) {
    state.fav = inc.fav; state.recent = inc.recent.slice(0, 50); state.playlists = inc.playlists; state.artists = inc.artists; state.history = inc.history;
    NF.stats = inc.stats; Object.keys(lyrOffs).forEach((k) => delete lyrOffs[k]); Object.assign(lyrOffs, inc.lyrOffs);
  } else {
    state.fav = un(state.fav, inc.fav, (t) => t.id);
    state.recent = un(state.recent, inc.recent, (t) => t.id).slice(0, 50);
    inc.playlists.forEach((p) => {
      const ex = state.playlists.find((x) => x.id === p.id) || state.playlists.find((x) => lc(x.name) === lc(p.name));
      if (ex) ex.tracks = un(ex.tracks, p.tracks, (t) => t.id); else state.playlists.push(p);
    });
    state.artists = un(state.artists, inc.artists, (a) => lc(a.name));
    state.history = un(state.history, inc.history, (x) => lc(x)).slice(0, 30);
    // statistik: ambil bulan dengan data lebih banyak (aman kalau cadangan yang sama diimpor dua kali)
    for (const [k, m] of Object.entries(inc.stats.months || {})) { const cur = NF.stats.months[k]; if (!cur || (m.sec || 0) > (cur.sec || 0)) NF.stats.months[k] = m; }
    Object.keys(inc.lyrOffs).forEach((k) => { if (!(k in lyrOffs)) lyrOffs[k] = inc.lyrOffs[k]; });
  }
  store.set('fav', state.fav); store.set('recent', state.recent); store.set('playlists', state.playlists);
  store.set('artists', state.artists); store.set('history', state.history); store.set('nada.stats', NF.stats); store.set('lyrOffs', lyrOffs);
  NF.mix = null; store.set('nada.mix', null); NF.card = { blob: null, busy: false, key: '' };
}
function backupMenuHTML(mode) {
  const B = (mctx && mctx.bk) || {};
  let h = '';
  if (mode === 'bkcode') {
    h += '<div class="sub">Kode pindah data</div>';
    h += `<div class="share-code" aria-label="Kode ${esc(B.code || '')}">${esc(B.code || '')}</div>`;
    h += `<p class="share-note">Di perangkat lain buka Pustaka, Cadangan & pindah data, lalu ketik kode ini. Aktif ${B.minutes || 15} menit.</p>`;
    h += act('bkback', ICON.back, 'Kembali');
  } else if (mode === 'bkprev') {
    const P = B.preview;
    h += '<div class="sub">Cadangan ketemu!</div>';
    h += `<p class="share-note">${esc(backupSummary(P))}</p>`;
    h += act('bkmerge', ICON.plus, 'Gabungkan dengan data sekarang') + '<p class="share-note">Aman: data yang udah ada nggak hilang.</p>';
    h += act('bkreplace', ICON.trash, 'Ganti semua data di sini') + act('bkback', ICON.back, 'Batal');
  } else {
    const d = backupData(), mins = Math.round(Object.values(d.stats.months).reduce((s, m) => s + (m.sec || 0), 0) / 60);
    h += '<div class="sub">Cadangan & pindah data</div>';
    h += `<p class="share-note">Sekarang: ${state.fav.length} Liked Songs · ${state.playlists.length} playlist · ${state.artists.length} artis · ${mins} menit dengar.</p>`;
    h += act('bkfile', ICON.download, 'Simpan / bagikan file cadangan');
    h += act('bkmake', ICON.share, 'Buat kode pindah (buat TV / HP lain)');
    h += act('bkpick', ICON.download, 'Impor dari file cadangan');
    if (B.busy) h += '<p class="share-note">Lagi ngambil data…</p>';
    else h += '<form id="bkForm"><input id="bkCode" type="text" maxlength="12" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="Masukkan kode 8 karakter" aria-label="Kode pindah data"><button class="pill" type="submit">Ambil</button></form>';
    if (B.err) h += `<p class="share-note err">${esc(B.err)}</p>`;
    h += act('close', ICON.back, 'Tutup');
  }
  return h;
}
const bkSet = (o) => { mctx.bk = { ...(mctx.bk || {}), ...o }; renderMenu(); };
async function backupAct(a) {
  if (!mctx) return;
  if (a === 'bkback') { mctx.mode = 'bk'; mctx.bk = { ...(mctx.bk || {}), err: '' }; renderMenu(); return; }
  if (a === 'bkfile') {
    const text = JSON.stringify(backupData()), name = `nada-cadangan-${dayKey()}.json`;
    const file = new File([text], name, { type: 'application/json' });
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Cadangan Nada' }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    const l = document.createElement('a'); l.href = URL.createObjectURL(file); l.download = name; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(l.href), 4000);
    toast('Cadangan disimpan'); return;
  }
  if (a === 'bkmake') {
    bkSet({ busy: true, err: '' });
    try {
      const r = await fetch('/api/backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: JSON.stringify(backupData()) }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.nostore ? 'Kode pindah belum aktif di server. Pakai file cadangan dulu ya.' : d.error || 'Gagal bikin kode.');
      if (!mctx) return; mctx.mode = 'bkcode'; bkSet({ busy: false, code: d.code, minutes: d.minutes });
    } catch (e) { if (mctx) bkSet({ busy: false, err: e.message || 'Gagal bikin kode.' }); }
    return;
  }
  if (a === 'bkpick') { $('#bkFile').click(); return; }
  if (a === 'bkmerge' || a === 'bkreplace') {
    const P = mctx.bk && mctx.bk.preview; if (!P) return;
    applyBackup(P, a === 'bkreplace'); closeMenu(); render();
    toast(a === 'bkreplace' ? 'Data berhasil diganti' : 'Data berhasil digabung');
  }
}
(function () {
  const inp = document.createElement('input'); inp.type = 'file'; inp.id = 'bkFile'; inp.accept = 'application/json,.json'; inp.hidden = true; document.body.appendChild(inp);
  inp.addEventListener('change', async () => {
    const f = inp.files && inp.files[0]; inp.value = ''; if (!f || !mctx) return;
    try { if (f.size > 3e6) throw new Error('File-nya kebesaran.'); const P = parseBackup(await f.text()); mctx.mode = 'bkprev'; bkSet({ preview: P, err: '' }); }
    catch (e) { bkSet({ err: e.message || 'File nggak bisa dibaca.' }); }
  });
  $('#menu').addEventListener('submit', async (e) => {
    if (e.target.id !== 'bkForm') return;
    e.preventDefault();
    const code = $('#bkCode').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 8) { bkSet({ err: 'Kodenya harus 8 karakter.' }); return; }
    bkSet({ busy: true, err: '' });
    try {
      const r = await fetch('/api/backup?code=' + code), d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Kodenya nggak ketemu.');
      const P = parseBackup(d.data); if (!mctx) return; mctx.mode = 'bkprev'; bkSet({ busy: false, preview: P });
    } catch (er) { if (mctx) bkSet({ busy: false, err: er.message || 'Gagal ngambil data.' }); }
  });
})();

/* =====================================================================
   PENGHUBUNG KE app.js
   ===================================================================== */
function featTracks(ctx) {
  if (ctx === 'recap') return recapData().tracks;
  if (ctx.startsWith('mix:')) { const m = mixById(ctx.slice(4)); return m ? m.tracks : []; }
  return null;
}
function featView(ctx) {
  if (ctx === 'recap') return recapViewHTML();
  if (ctx.startsWith('mix:')) return mixViewHTML(ctx.slice(4));
  return '';
}
function featViewMeta(ctx) {
  if (ctx === 'recap') return { kind: 'Ringkasan', title: 'Nada Recap' };
  if (ctx.startsWith('mix:')) { const m = mixById(ctx.slice(4)); return { kind: 'Mix Untukmu', title: m ? m.name : 'Mix' }; }
  return null;
}
function featLibTiles(lib) {
  return '<div class="lib-h">Kamu</div>'
    + lib('data-open="recap"', FI.recap, false, 'Nada Recap', 'Ringkasan dengar musikmu')
    + lib('data-backup', FI.backup, false, 'Cadangan & pindah data', 'Simpan atau pindah ke perangkat lain');
}
$('#list').addEventListener('click', (e) => {
  const t = e.target; let el;
  if ((el = t.closest('[data-recapperiod]'))) { NF.period = el.dataset.recapperiod; store.set('recapPeriod', NF.period); render(); return; }
  if (t.closest('[data-recapshare]')) { recapShare(false); return; }
  if (t.closest('[data-recapsave]')) { recapShare(true); return; }
  if ((el = t.closest('[data-mixsave]'))) {
    const m = mixById(el.dataset.mixsave); if (!m) return;
    state.playlists.unshift({ id: uid(), name: m.name, tracks: m.tracks.map(slim) }); store.set('playlists', state.playlists);
    toast(`Disimpan jadi playlist "${m.name}"`); return;
  }
  if (t.closest('[data-mixrefresh]')) { NF.mixSalt++; NF.mix = null; buildMixes().then(() => { if (state.view && state.view.ctx.startsWith('mix:')) closeView(); toast('Mix diracik ulang'); }); return; }
  if (t.closest('[data-backup]')) { openMenu(null, null, 'bk'); return; }
});
render();
