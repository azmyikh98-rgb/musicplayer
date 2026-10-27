'use strict';

/* =====================================================================
   Nada: pemutar musik (YouTube IFrame Player API)
   Bagian: util, state, tampilan (Beranda/Cari/Pustaka), menu, pemutaran,
           layout responsif, keyboard & remote TV.
   ===================================================================== */

/* ---------- util ---------- */
const $ = (s) => document.querySelector(s);
const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (s) => { s = Math.max(0, Math.floor(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const thumb = (id) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
const uid = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const lc = (s) => (s || '').toLowerCase();
const STARTER_ARTISTS = ['Tulus', 'Hindia', 'Mahalini', 'Raim Laode', 'Bernadya', 'Fourtwnty', 'Nadin Amizah', 'Andmesh', 'Juicy Luicy', 'Sheila on 7', 'Dewa 19', 'NOAH', 'Raisa', 'Isyana Sarasvati', 'Weird Genius', 'The Weeknd', 'Taylor Swift', 'Coldplay'];
const artHue = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const avatar = (a) => a.thumb
  ? `<div class="av"><img src="${esc(a.thumb)}" alt="" loading="lazy"></div>`
  : `<div class="av" style="background:linear-gradient(135deg,hsl(${artHue(a.name)},65%,55%),hsl(${(artHue(a.name) + 40) % 360},65%,35%))">${esc(a.name.charAt(0).toUpperCase())}</div>`;

const ICON = {
  share: '<svg viewBox="0 0 24 24"><path d="M12 15V4M8 8l4-4 4 4M5 13v6h14v-6"/></svg>',
  download: '<svg viewBox="0 0 24 24"><path d="M12 4v11M8 11l4 4 4-4M5 19h14"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>',
  prev: '<svg viewBox="0 0 24 24"><path d="M6 5h2v14H6zM20 5v14L9 12z"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M16 5h2v14h-2zM4 5v14l11-7z"/></svg>',
  heart: '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
  more: '<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 5 5"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  list: '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h9"/></svg>',
  user: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="m5 12 4.5 4.5L19 7"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/></svg>',};

/* ---------- state ---------- */
function detectTV() {
  const q = new URLSearchParams(location.search).get('tv');
  if (q === '1') return true;
  if (q === '0') return false;
  const saved = store.get('tv', null);
  if (saved !== null) return saved;
  return /SMART-?TV|Tizen|Web0S|WebOS|NetCast|HbbTV|BRAVIA|AFTT|AFTM|GoogleTV|Android.*TV|CrKey|Roku|VIDAA/i.test(navigator.userAgent);
}

const state = {
  tv: detectTV(),
  tab: store.get('tab', 'home'),            // home | search | library
  view: null,                                // { ctx } = halaman daftar penuh
  results: store.get('lastResults', []),
  q: '', loading: false, error: '',
  official: store.get('official', true),
  fav: store.get('fav', []),                 // Liked Songs
  recent: store.get('recent', []),
  playlists: store.get('playlists', []),     // [{id,name,tracks:[]}]
  artists: store.get('artists', []),         // [{name,thumb}]
  history: store.get('history', []),         // riwayat pencarian
  resume: store.get('resume', null),         // {track,pos,dur,queue,idx}
  charts: { ID: null, GLOBAL: null, err: {} },
  chartTab: store.get('chartTab', 'ID'),
  pview: store.get('pview', 'video'),        // video | lyrics
  lyr: { id: '', status: 'idle', synced: [], plain: '', src: '', active: -1 },
  confirmDel: false,
  queue: [], idx: -1,
  shuffle: store.get('shuffle', false),
  repeat: store.get('repeat', 'off'),        // off | all | one
  playing: false,                            // status sebenarnya dari player
  want: false,                               // niat pengguna: ingin musik berbunyi
};
let yt = null, ytReady = false, pending = null, seeking = false;

const current = () => state.queue[state.idx];
const isFav = (id) => state.fav.some((t) => t.id === id);
const isFollowing = (name) => state.artists.some((a) => lc(a.name) === lc(name));
const slim = (t) => ({ id: t.id, title: t.title, artist: t.artist, thumb: t.thumb || thumb(t.id) });

/* konteks daftar: 'search' | 'liked' | 'recent' | 'chartID' | 'chartGLOBAL' | 'pl:<id>' */
function ctxTracks(ctx) {
  if (ctx === 'search') return state.results;
  if (ctx === 'liked') return state.fav;
  if (ctx === 'recent') return state.recent;
  if (ctx === 'chartID') return state.charts.ID || [];
  if (ctx === 'chartGLOBAL') return state.charts.GLOBAL || [];
  if (ctx && ctx.startsWith('pl:')) return (state.playlists.find((p) => p.id === ctx.slice(3)) || { tracks: [] }).tracks;
  return [];
}
const splitRef = (ref) => { const i = ref.lastIndexOf(':'); return [ref.slice(0, i), +ref.slice(i + 1)]; };

/* ---------- toast ---------- */
let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

/* =====================================================================
   TAMPILAN
   ===================================================================== */
const imgOf = (t) => esc(t.thumb || thumb(t.id));
const empty = (msg) => `<p class="hint">${msg}</p>`;

function rowHTML(t, i, ctx, rank) {
  const playing = current()?.id === t.id;
  return `<div class="row${playing ? ' playing' : ''}" data-nav tabindex="0" role="button" data-id="${esc(t.id)}" data-play="${esc(ctx)}" data-i="${i}" aria-label="Putar ${esc(t.title)}">
    ${rank ? `<span class="rk">${i + 1}</span>` : ''}
    <img src="${imgOf(t)}" alt="" loading="lazy">
    <div class="meta"><b>${esc(t.title)}</b><small>${esc(t.artist)}</small></div>
    <div class="actions">
      <button class="heart icon-btn${isFav(t.id) ? ' on' : ''}" data-like="${esc(ctx)}:${i}" tabindex="-1" aria-label="Suka">${ICON.heart}</button>
      <button class="more icon-btn" data-more="${esc(ctx)}:${i}" tabindex="-1" aria-label="Menu lagu">${ICON.more}</button>
    </div>
  </div>`;
}

function cardHTML(t, i, ctx, rank) {
  const playing = current()?.id === t.id;
  return `<div class="card${playing ? ' playing' : ''}" data-nav tabindex="0" role="button" data-id="${esc(t.id)}" data-play="${esc(ctx)}" data-i="${i}" aria-label="Putar ${esc(t.title)}">
    <div class="cover"><img src="${imgOf(t)}" alt="" loading="lazy">${rank ? `<span class="rank">${i + 1}</span>` : ''}</div>
    <button class="more icon-btn card-more" data-more="${esc(ctx)}:${i}" tabindex="-1" aria-label="Menu lagu">${ICON.more}</button>
    <b>${esc(t.title)}</b><small>${esc(t.artist)}</small>
  </div>`;
}

const section = (title, inner, seeAll) =>
  `<section class="sec"><div class="sec-head"><h2>${title}</h2>${seeAll ? `<button class="link" data-nav data-open="${seeAll}">Lihat semua</button>` : ''}</div>${inner}</section>`;
const hscroll = (items) => `<div class="hs"><button class="hs-btn l" data-hs="-1" tabindex="-1" aria-label="Geser ke kiri">‹</button><div class="hscroll">${items.join('')}</div><button class="hs-btn r" data-hs="1" tabindex="-1" aria-label="Geser ke kanan">›</button></div>`;

function artistsSection() {
  const chips = [`<div class="artist add" data-nav tabindex="0" role="button" data-manageart aria-label="Tambah artis"><div class="av">${ICON.plus}</div><b>Tambah</b></div>`];
  state.artists.forEach((a) => chips.push(
    `<div class="artist" data-nav tabindex="0" role="button" data-artist="${esc(a.name)}" aria-label="Cari lagu ${esc(a.name)}">${avatar(a)}<b>${esc(a.name)}</b></div>`));
  const body = hscroll(chips) + (state.artists.length ? '' : '<p class="hint">Ikuti artis dari daftar Artis Populer di bawah, atau tap Tambah untuk mengetik namanya.</p>');
  return `<section class="sec"><div class="sec-head"><h2>Artis Favorit</h2><button class="link" data-nav data-manageart>Kelola</button></div>${body}</section>`;
}

/* Artis populer: dihitung dari tangga lagu (lengkap dengan foto), cadangan daftar bawaan */
function popularArtists() {
  const seen = new Map();
  for (const key of ['ID', 'GLOBAL']) (state.charts[key] || []).forEach((t, i) => {
    const n = (t.artist || '').split(/\s*(?:,|&| feat\.?| ft\.?| x )\s*/i)[0].trim();
    if (!n || n.length > 40) return;
    const k = lc(n), e = seen.get(k) || { name: n, thumb: t.thumb || thumb(t.id), score: 0 };
    e.score += 100 - i; seen.set(k, e);
  });
  let list = [...seen.values()].sort((x, y) => y.score - x.score).slice(0, 14);
  if (list.length < 8) STARTER_ARTISTS.forEach((n) => { if (!list.some((e) => lc(e.name) === lc(n))) list.push({ name: n, thumb: '' }); });
  return list.slice(0, 14);
}

function popularSection() {
  const cards = popularArtists().map((a) => {
    const f = isFollowing(a.name);
    return `<div class="artist pop" data-nav tabindex="0" role="button" data-artist="${esc(a.name)}" aria-label="Cari lagu ${esc(a.name)}">${avatar(a)}<b>${esc(a.name)}</b>
      <button class="fol${f ? ' on' : ''}" data-followart="${esc(a.name)}" tabindex="-1" aria-label="${f ? 'Berhenti mengikuti' : 'Ikuti'} ${esc(a.name)}">${f ? 'Diikuti' : '+ Ikuti'}</button></div>`;
  });
  return `<section class="sec"><div class="sec-head"><h2>Artis Populer</h2></div>${hscroll(cards)}</section>`;
}

function quickTile(attrs, ico, g, title, sub) {
  return `<button class="qt" data-nav ${attrs}><span class="ico${g ? ' g' : ''}">${ico}</span><span class="qm"><b>${title}</b><small>${sub}</small></span></button>`;
}

function chartsBlock() {
  const key = state.chartTab === 'GLOBAL' ? 'GLOBAL' : 'ID';
  const items = state.charts[key];
  let inner;
  if (items && items.length) inner = hscroll(items.slice(0, 12).map((t, i) => cardHTML(t, i, 'chart' + key, true)));
  else if (state.charts.err[key]) inner = empty(esc(state.charts.err[key]));
  else inner = hscroll(Array(6).fill('<div class="card sk"><div class="cover"></div></div>'));
  const seg = (k, label) => `<button class="seg${k === key ? ' on' : ''}" data-nav data-charttab="${k}" aria-pressed="${k === key}">${label}</button>`;
  return `<section class="sec"><div class="sec-head"><h2>Tangga Lagu</h2>${items && items.length ? `<button class="link" data-nav data-open="chart${key}">Lihat semua</button>` : ''}</div>
    <div class="segs">${seg('ID', 'Indonesia')}${seg('GLOBAL', 'Global')}</div>${inner}</section>`;
}

function homeHTML() {
  const h = new Date().getHours();
  const greet = h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam';
  const fresh = !state.resume && !state.recent.length && !state.fav.length && !state.artists.length;
  let out = `<div class="home"><h2 class="greet">${greet}</h2>`;

  // 1. lanjutkan, hal paling sering dibutuhkan
  if (state.resume && state.resume.track) {
    const r = state.resume, t = r.track, pct = r.dur ? Math.min(100, (r.pos / r.dur) * 100) : 0;
    out += `<div class="continue" data-nav tabindex="0" role="button" data-resume aria-label="Lanjutkan ${esc(t.title)}">
        <img src="${imgOf(t)}" alt="">
        <div class="meta"><small class="kick">Lanjutkan mendengarkan</small><b>${esc(t.title)}</b><small>${esc(t.artist)}</small><div class="bar"><i style="width:${pct}%"></i></div><small>${fmt(r.pos)}${r.dur ? ' / ' + fmt(r.dur) : ''}</small></div>
        <span class="play-chip">${ICON.play}</span>
      </div>`;
  } else if (fresh) {
    out += `<div class="welcome"><b>Selamat datang di Nada</b><p>Cari lagu favoritmu di kolom atas, atau mulai dari tangga lagu dan artis di bawah.</p><button class="pill" data-nav data-focussearch>Cari lagu</button></div>`;
  }

  // 2. akses cepat, selalu ada dan tidak pernah kosong
  out += `<div class="quick">`
    + quickTile('data-open="liked"', ICON.heart, true, 'Liked Songs', state.fav.length ? `${state.fav.length} lagu` : 'Belum ada')
    + quickTile('data-open="recent"', ICON.clock, false, 'Terakhir diputar', state.recent.length ? `${state.recent.length} lagu` : 'Belum ada')
    + quickTile('data-open="chartID"', ICON.list, false, 'Top Indonesia', 'Tangga lagu')
    + quickTile('data-open="chartGLOBAL"', ICON.list, false, 'Top Global', 'Tangga lagu')
    + `</div>`;

  // 3. terakhir diputar, hanya jika ada
  if (state.recent.length) out += section('Putar lagi', hscroll(state.recent.slice(0, 12).map((t, i) => cardHTML(t, i, 'recent'))), 'recent');

  // 4. artis
  out += artistsSection();
  out += popularSection();

  // 5. playlist, selalu ada kartu "Playlist baru"
  const plCards = state.playlists.map((p) => {
    const first = p.tracks[0];
    return `<div class="card pl" data-nav tabindex="0" role="button" data-pl="${p.id}" aria-label="Buka playlist ${esc(p.name)}">
      <div class="cover${first ? '' : ' ph'}">${first ? `<img src="${imgOf(first)}" alt="" loading="lazy">` : ICON.list}<span class="cnt">${p.tracks.length} lagu</span></div>
      <b>${esc(p.name)}</b><small>Playlist</small></div>`;
  });
  plCards.unshift(`<div class="card new" data-nav tabindex="0" role="button" data-newpl aria-label="Buat playlist baru"><div class="cover">${ICON.plus}</div><b>Playlist baru</b><small>Buat sendiri</small></div>`);
  plCards.splice(1, 0, `<div class="card new" data-nav tabindex="0" role="button" data-import aria-label="Impor playlist dengan kode"><div class="cover">${ICON.download}</div><b>Impor playlist</b><small>Pakai kode / QR</small></div>`);
  out += section('My Playlist', hscroll(plCards));

  // 6. liked songs, hanya jika ada (tile di atas sudah jadi pintu masuk saat kosong)
  if (state.fav.length) out += section('Liked Songs', hscroll(state.fav.slice(0, 12).map((t, i) => cardHTML(t, i, 'liked'))), 'liked');

  // 7. tangga lagu: satu bagian dengan pilihan Indonesia / Global
  out += chartsBlock();
  return out + '</div>';
}

function searchHTML() {
  if (state.loading) return '<div class="tracks">' + '<div class="skeleton"></div>'.repeat(7) + '</div>';
  if (state.error) return `<div class="tracks"><div class="empty"><b>Ups</b>${esc(state.error)}</div></div>`;
  if (!state.results.length) {
    return `<div class="tracks"><div class="empty"><b>Mau dengar apa hari ini?</b>Ketik judul lagu atau artis. Filter "Resmi" menyaring reupload, lirik, dan cover.</div></div>`;
  }
  return '<div class="tracks">' + state.results.map((t, i) => rowHTML(t, i, 'search')).join('') + '</div>';
}

function libraryHTML() {
  const lib = (attrs, ico, g, title, sub) =>
    `<button class="lib" data-nav ${attrs}><span class="ico${g ? ' g' : ''}">${ico}</span><span><b>${title}</b><small>${sub}</small></span></button>`;
  let out = '<div class="home libp">';
  out += lib('data-open="liked"', ICON.heart, true, 'Liked Songs', `${state.fav.length} lagu`);
  out += lib('data-open="recent"', ICON.clock, false, 'Terakhir diputar', `${state.recent.length} lagu`);
  out += lib('data-open="chartID"', ICON.list, false, 'Tangga Lagu Indonesia', 'Musik terpopuler di Indonesia');
  out += lib('data-open="chartGLOBAL"', ICON.list, false, 'Tangga Lagu Global', 'Gabungan beberapa negara');
  out += '<div class="lib-h">Playlist</div>';
  out += lib('data-newpl', ICON.plus, false, 'Buat playlist baru', 'Kumpulkan lagu pilihanmu');
  out += lib('data-import', ICON.download, false, 'Impor playlist', 'Pakai kode atau QR dari perangkat lain');
  out += state.playlists.map((p) => lib(`data-pl="${p.id}"`, ICON.list, false, esc(p.name), `${p.tracks.length} lagu`)).join('');
  out += '<div class="lib-h">Artis favorit</div>';
  out += lib('data-manageart', ICON.plus, false, 'Tambah / kelola artis', 'Ikuti artis favoritmu');
  out += state.artists.length
    ? state.artists.map((a) => lib(`data-artist="${esc(a.name)}"`, ICON.user, false, esc(a.name), 'Cari lagu artis ini')).join('')
    : '';
  return out + '</div>';
}

const VIEW_TITLES = { liked: 'Liked Songs', recent: 'Terakhir diputar', chartID: 'Tangga Lagu Indonesia', chartGLOBAL: 'Tangga Lagu Global' };

function viewHTML() {
  const ctx = state.view.ctx;
  const isPl = ctx.startsWith('pl:');
  const pl = isPl ? state.playlists.find((p) => p.id === ctx.slice(3)) : null;
  if (isPl && !pl) { state.view = null; return state.tab === 'library' ? libraryHTML() : homeHTML(); }
  const tracks = ctxTracks(ctx), title = isPl ? esc(pl.name) : VIEW_TITLES[ctx];
  const isChart = ctx.startsWith('chart');
  let body;
  if (isChart && !tracks.length) body = state.charts.err[ctx.slice(5)] ? `<div class="empty">${esc(state.charts.err[ctx.slice(5)])}</div>` : '<div class="skeleton"></div>'.repeat(6);
  else if (!tracks.length) body = `<div class="empty"><b>Belum ada lagu</b>${isPl ? 'Tambahkan lewat menu titik tiga pada lagu.' : 'Daftar ini masih kosong.'}</div>`;
  else body = tracks.map((t, i) => rowHTML(t, i, ctx, isChart)).join('');
  return `<div class="view-head">
    <button class="icon-btn" data-nav data-back aria-label="Kembali">${ICON.back}</button><h2>${title}</h2><span class="grow"></span>
    ${tracks.length && (isPl || ctx === 'liked') ? `<button class="pill ghost" data-nav data-share="${esc(ctx)}">Bagikan</button>` : ''}
    ${tracks.length ? `<button class="pill" data-nav data-playall="${esc(ctx)}">Putar semua</button>` : ''}
    ${isPl ? `<button class="pill ghost" data-nav data-delpl>${state.confirmDel ? 'Yakin hapus?' : 'Hapus'}</button>` : ''}
  </div><div class="tracks">${body}</div>`;
}

function render() {
  const el = $('#list');
  document.querySelectorAll('.tabs button[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === state.tab));

  // jaga posisi geser carousel dan fokus (penting untuk remote TV)
  const scrolls = [...el.querySelectorAll('.hscroll')].map((h) => h.scrollLeft);
  const f = el.contains(document.activeElement) ? document.activeElement.closest('[data-nav]') : null;
  const fKey = f ? { play: f.dataset.play, i: f.dataset.i, sel: ['data-open', 'data-share', 'data-import', 'data-charttab', 'data-focussearch', 'data-pl', 'data-artist', 'data-manageart', 'data-followart', 'data-newpl', 'data-resume', 'data-back', 'data-playall', 'data-delpl'].find((a) => f.hasAttribute(a)) } : null;
  const fVal = fKey && fKey.sel ? f.getAttribute(fKey.sel) : null;

  el.innerHTML = state.view ? viewHTML() : state.tab === 'home' ? homeHTML() : state.tab === 'library' ? libraryHTML() : searchHTML();

  el.querySelectorAll('.hscroll').forEach((h, i) => { h.scrollLeft = scrolls[i] || 0; });
  if (fKey) {
    let t = null;
    if (fKey.play != null) t = el.querySelector(`[data-play="${CSS.escape(fKey.play)}"][data-i="${fKey.i}"]`);
    else if (fKey.sel) t = el.querySelector(`[${fKey.sel}${fVal ? `="${CSS.escape(fVal)}"` : ''}]`);
    t?.focus({ preventScroll: true });
  }
}

function markPlaying() {
  const id = current()?.id;
  document.querySelectorAll('#list [data-id]').forEach((n) => n.classList.toggle('playing', n.dataset.id === id));
}

function renderUpnext() {
  const el = $('#upnext'), t = current();
  if (!t) { el.innerHTML = ''; return; }
  const q = state.queue, next = [];
  for (let i = state.idx + 1; i < q.length && next.length < 8; i++) next.push(i);
  if (!next.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<h3>Berikutnya${state.shuffle ? ' <small>(urutan acak aktif)</small>' : ''}</h3>` + next.map((i) =>
    `<div class="up" data-nav tabindex="0" role="button" data-upi="${i}" aria-label="Putar ${esc(q[i].title)}"><img src="${imgOf(q[i])}" alt="" loading="lazy"><span class="meta"><b>${esc(q[i].title)}</b><small>${esc(q[i].artist)}</small></span></div>`).join('');
}

function renderPlayer() {
  const t = current();
  $('#mini').hidden = !t;
  $('#player').classList.toggle('idle', !t);
  renderUpnext();
  if (!t) return;
  $('#title').textContent = t.title;
  $('#artist').textContent = t.artist;
  $('#miniTitle').textContent = t.title;
  $('#miniArtist').textContent = t.artist;
  $('#miniArt').src = t.thumb || thumb(t.id);
  $('#pbg i').style.backgroundImage = `url("${(t.thumb || thumb(t.id)).replace(/"/g, '')}")`;
  $('#favBtn').classList.toggle('on', isFav(t.id));
  document.title = `${t.title} · Nada`;
}

function renderControls() {
  const ic = state.playing ? ICON.pause : ICON.play;
  $('#play').innerHTML = ic; $('#miniPlay').innerHTML = ic;
  $('#prev').innerHTML = ICON.prev; $('#next').innerHTML = ICON.next; $('#miniNext').innerHTML = ICON.next;
  $('#shuffle').classList.toggle('on', state.shuffle);
  $('#repeat').classList.toggle('on', state.repeat !== 'off');
  $('#repeat').classList.toggle('one', state.repeat === 'one');
}

/* ---------- navigasi ---------- */
function setTab(tab) {
  state.tab = tab; state.view = null; state.confirmDel = false;
  store.set('tab', tab);
  render(); $('#list').scrollTop = 0;
  if (tab === 'home' || tab === 'library') loadCharts();
}
function openView(ctx) {
  state.view = { ctx }; state.confirmDel = false;
  render(); $('#list').scrollTop = 0;
  if (ctx.startsWith('chart')) loadCharts();
}
function closeView() { state.view = null; state.confirmDel = false; render(); }

/* ---------- tangga lagu ---------- */
function loadCharts() {
  for (const key of ['ID', 'GLOBAL']) {
    if (state.charts[key]) continue;
    let cached = null;
    try { const c = JSON.parse(sessionStorage.getItem('chart' + key)); if (c && Date.now() - c.t < 3600e3) cached = c.items; } catch {}
    if (cached) { state.charts[key] = cached; continue; }
    state.charts.err[key] = '';
    fetch(`/api/charts?region=${key}`)
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) throw new Error(d.error || 'Gagal memuat tangga lagu.');
        state.charts[key] = d.items || [];
        try { sessionStorage.setItem('chart' + key, JSON.stringify({ t: Date.now(), items: state.charts[key] })); } catch {}
      })
      .catch((e) => { state.charts.err[key] = e.message || 'Gagal memuat tangga lagu.'; })
      .finally(() => { if ((state.tab === 'home' || state.tab === 'library' || state.view) && !$('#list').matches(':active')) render(); });
  }
}

/* =====================================================================
   PENCARIAN + SARAN KETIKAN
   ===================================================================== */
function parseVideoId(text) {
  const m = text.match(/(?:v=|youtu\.be\/|\/shorts\/|\/embed\/)([\w-]{11})/);
  return m ? m[1] : null;
}

function pushHistory(q) {
  state.history = [q, ...state.history.filter((h) => lc(h) !== lc(q))].slice(0, 15);
  store.set('history', state.history);
}

async function search(q) {
  state.tab = 'search'; state.view = null; state.q = q; state.error = ''; state.loading = true;
  store.set('tab', 'search'); hideSuggest(); render();
  if (!/^https?:\/\//i.test(q)) pushHistory(q);
  try {
    const id = /^https?:\/\//i.test(q) ? parseVideoId(q) : null;
    if (id) {
      const r = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent('https://www.youtube.com/watch?v=' + id)}&format=json`);
      if (!r.ok) throw new Error('Link tidak bisa dibuka atau pemilik melarang pemutaran di luar YouTube.');
      const d = await r.json();
      state.results = [{ id, title: d.title, artist: d.author_name.replace(/ - Topic$/, ''), thumb: thumb(id) }];
    } else {
      const r = await fetch(`/api/search?q=${encodeURIComponent(q)}&official=${state.official ? 1 : 0}`);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Pencarian gagal.');
      state.results = d.items;
      if (!d.items.length) {
        state.error = state.official
          ? `Tidak ada musik resmi untuk "${q}". Coba kata kunci lain, atau matikan filter Resmi.`
          : 'Tidak ada hasil. Coba kata kunci lain.';
      }
    }
    store.set('lastResults', state.results);
    state.results.forEach(backfillArtist);
  } catch (e) {
    state.error = e.message || 'Terjadi kesalahan.';
  }
  state.loading = false; render();
  if (state.tv) $('#list .row')?.focus();
}

function runSearch(text) { $('#q').value = text; search(text); }

/* saran saat mengetik */
const sgCache = new Map();
let sgTimer, sgAbort;

function showSuggest(items) {
  const box = $('#suggest');
  if (!items.length) { box.hidden = true; return; }
  box.innerHTML = items.map((s) => `<button type="button" tabindex="-1" data-suggest="${esc(s.text)}">${s.hist ? ICON.clock : ICON.search}<span>${esc(s.text)}</span></button>`).join('');
  box.hidden = false;
}
function hideSuggest() { $('#suggest').hidden = true; }

function mergeSuggest(hist, remote) {
  const seen = new Set(), out = [];
  for (const t of hist) { if (!seen.has(lc(t))) { seen.add(lc(t)); out.push({ text: t, hist: true }); } }
  for (const t of remote) { if (!seen.has(lc(t))) { seen.add(lc(t)); out.push({ text: t, hist: false }); } }
  return out.slice(0, 8);
}

function onType() {
  const v = $('#q').value.trim(), key = lc(v);
  if (!v) { showSuggest(state.history.slice(0, 8).map((t) => ({ text: t, hist: true }))); return; }
  const hist = state.history.filter((h) => lc(h).includes(key)).slice(0, 3);
  if (sgCache.has(key)) { showSuggest(mergeSuggest(hist, sgCache.get(key))); return; }
  showSuggest(mergeSuggest(hist, []));                       // tampil instan dari riwayat
  clearTimeout(sgTimer);
  sgTimer = setTimeout(async () => {
    if (sgAbort) sgAbort.abort();
    sgAbort = new AbortController();
    try {
      const r = await fetch(`/api/suggest?q=${encodeURIComponent(v)}`, { signal: sgAbort.signal });
      const d = await r.json();
      sgCache.set(key, d.items || []);
      if (lc($('#q').value.trim()) === key && document.activeElement === $('#q')) showSuggest(mergeSuggest(hist, d.items || []));
    } catch {}
  }, 160);
}

/* =====================================================================
   LIKE / PLAYLIST / ARTIS + MENU
   ===================================================================== */
function toggleFav(t) {
  if (!t) return;
  state.fav = isFav(t.id) ? state.fav.filter((x) => x.id !== t.id) : [slim(t), ...state.fav];
  store.set('fav', state.fav);
  render(); renderPlayer();
}

function followArtist(name, thumbUrl = '') {
  name = name.trim().slice(0, 40);
  if (!name || isFollowing(name)) { if (name) toast(`${name} sudah diikuti`); return false; }
  state.artists = [{ name, thumb: thumbUrl }, ...state.artists];
  store.set('artists', state.artists);
  toast(`Mengikuti ${name}`);
  return true;
}
function unfollowArtist(name) {
  state.artists = state.artists.filter((a) => lc(a.name) !== lc(name));
  store.set('artists', state.artists);
  toast(`Berhenti mengikuti ${name}`);
}

function toggleArtist(t) {
  if (isFollowing(t.artist)) {
    state.artists = state.artists.filter((a) => lc(a.name) !== lc(t.artist));
    toast(`Berhenti mengikuti ${t.artist}`);
  } else {
    state.artists = [{ name: t.artist, thumb: t.thumb || thumb(t.id) }, ...state.artists];
    toast(`Mengikuti ${t.artist}`);
  }
  store.set('artists', state.artists);
}

// isi foto artis dari lagu yang sama (tanpa biaya kuota)
function backfillArtist(t) {
  const a = state.artists.find((x) => !x.thumb && lc(x.name) === lc(t.artist));
  if (a) { a.thumb = t.thumb || thumb(t.id); store.set('artists', state.artists); }
}

function addToPlaylist(pid, t) {
  const p = state.playlists.find((x) => x.id === pid);
  if (!p) return;
  if (p.tracks.some((x) => x.id === t.id)) { toast(`Sudah ada di ${p.name}`); return; }
  p.tracks.push(slim(t));
  store.set('playlists', state.playlists);
  toast(`Ditambahkan ke ${p.name}`);
}

let mctx = null;
const act = (a, ico, label, on, extra = '') => `<button class="act${on ? ' on' : ''}${a === 'like' ? ' fill' : ''}" data-act="${a}" ${extra}>${ico}<span>${esc(label)}</span></button>`;
const newPlForm = '<form id="plForm"><input id="plName" type="text" maxlength="40" placeholder="Nama playlist baru" aria-label="Nama playlist"><button class="pill" type="submit">Buat</button></form>';

function openMenu(track, ctx, mode) {
  mctx = { track, ctx, mode: mode || (track ? 'main' : 'newpl') };
  renderMenu();
  $('#menu').hidden = false;
  (mctx.mode === 'newpl' ? $('#plName') : mctx.mode === 'artists' ? $('#artName') : mctx.mode === 'import' ? $('#impCode') : $('#menuBody button'))?.focus();
}
function closeMenu() { $('#menu').hidden = true; mctx = null; }

function renderMenu() {
  const { track, ctx, mode } = mctx;
  $('#menuHead').hidden = !track;
  if (track) { $('#menuArt').src = track.thumb || thumb(track.id); $('#menuTitle').textContent = track.title; $('#menuSub').textContent = track.artist; }
  let h = '';
  if (mode === 'main') {
    h += act('like', ICON.heart, isFav(track.id) ? 'Hapus dari Liked Songs' : 'Tambah ke Liked Songs', isFav(track.id));
    h += act('toplaylist', ICON.list, 'Tambah ke playlist');
    h += act('follow', ICON.user, isFollowing(track.artist) ? `Berhenti ikuti ${track.artist}` : `Ikuti ${track.artist}`, isFollowing(track.artist));
    h += act('artistsearch', ICON.search, `Cari lagu dari ${track.artist}`);
    if (ctx && ctx.startsWith('pl:')) h += act('rmpl', ICON.trash, 'Hapus dari playlist ini');
    h += act('close', ICON.back, 'Tutup');
  } else if (mode === 'pl') {
    h += '<div class="sub">Pilih playlist</div>';
    h += state.playlists.map((p) => act('addpl', ICON.list, p.name, p.tracks.some((x) => x.id === track.id), `data-pid="${p.id}"`)).join('');
    h += newPlForm + act('backmain', ICON.back, 'Kembali');
  } else if (mode === 'artists') {
    h += '<div class="sub">Tambah artis favorit</div><form id="artForm"><input id="artName" type="text" maxlength="40" placeholder="Nama artis" aria-label="Nama artis"><button class="pill" type="submit">Tambah</button></form>';
    const sug = STARTER_ARTISTS.filter((n) => !isFollowing(n)).slice(0, 8);
    if (sug.length) h += '<div class="sub">Saran</div>' + sug.map((n) => act('addart', ICON.plus, n, false, `data-name="${esc(n)}"`)).join('');
    if (state.artists.length) h += '<div class="sub">Diikuti (tap untuk berhenti mengikuti)</div>' + state.artists.map((a) => act('delart', ICON.trash, a.name, true, `data-name="${esc(a.name)}"`)).join('');
    h += act('close', ICON.back, 'Selesai');
  } else if (mode === 'share') {
    const S = mctx.share;
    h += `<div class="sub">Bagikan "${esc(S.name)}" · ${S.count} lagu</div>`;
    if (S.status === 'loading') h += '<p class="share-note">Membuat kode…</p>';
    else {
      if (S.qr) h += `<div class="share-qr">${S.qr}</div>`;
      if (S.code) h += `<div class="share-code" aria-label="Kode ${esc(S.code)}">${esc(S.code.slice(0, 4))}<i>-</i>${esc(S.code.slice(4))}</div><p class="share-note">Pindai QR dengan kamera HP, atau ketik kode ini lewat menu Impor di Nada. Berlaku 30 hari.</p>`;
      else h += `<div class="share-long" tabindex="0" aria-label="Kode panjang">${esc(S.payload)}</div><p class="share-note">${S.long ? 'Playlist ini terlalu panjang untuk QR. ' : 'Pindai QR dengan kamera HP, atau salin kode di atas dan tempel lewat menu Impor. '}${S.nostore ? 'Kode pendek 8 karakter (untuk diketik di TV) aktif setelah Upstash Redis disambungkan di Vercel.' : ''}</p>`;
      h += act('copycode', ICON.list, S.code ? 'Salin kode' : 'Salin kode panjang') + act('copylink', ICON.share, 'Salin tautan');
      if (navigator.share) h += act('nativeshare', ICON.share, 'Bagikan lewat…');
    }
    h += act('close', ICON.back, 'Selesai');
  } else if (mode === 'import') {
    h += '<div class="sub">Impor playlist</div>';
    if (mctx.busy) h += '<p class="share-note">Memuat playlist…</p>';
    else {
      h += '<form id="impForm"><input id="impCode" type="text" maxlength="2000" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="Kode 8 karakter atau tautan" aria-label="Kode playlist"><button class="pill" type="submit">Cari</button></form>';
      h += '<p class="share-note">Ketik kode dari perangkat lain, atau tempel tautan yang dibagikan. Di HP, pindai QR dengan kamera bawaan.</p>';
      if (mctx.err) h += `<p class="share-note err">${esc(mctx.err)}</p>`;
    }
    h += act('close', ICON.back, 'Tutup');
  } else if (mode === 'preview') {
    const P = mctx.preview;
    h += '<div class="sub">Playlist ditemukan</div>';
    h += `<form id="impSave"><input id="impName" type="text" maxlength="40" value="${esc(P.name)}" aria-label="Nama playlist"><button class="pill" type="submit">Simpan</button></form>`;
    h += `<p class="share-note">${P.tracks.length} lagu: ${esc(P.tracks.slice(0, 3).map((t) => t.title).join(', '))}${P.tracks.length > 3 ? ', …' : ''}</p>`;
    h += act('toimport', ICON.back, 'Kembali') + act('close', ICON.back, 'Batal');
  } else {
    h += '<div class="sub">Buat playlist</div>' + newPlForm + act('toimport', ICON.download, 'Impor dengan kode / QR') + act('close', ICON.back, 'Tutup');
  }
  $('#menuBody').innerHTML = h;
}


/* ---------- Bagikan & impor playlist (QR + kode) ---------- */
const b64u = {
  enc(str) { const b = new TextEncoder().encode(str); let bin = ''; b.forEach((x) => { bin += String.fromCharCode(x); }); return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  dec(str) { str = str.replace(/-/g, '+').replace(/_/g, '/'); while (str.length % 4) str += '='; return new TextDecoder().decode(Uint8Array.from(atob(str), (c) => c.charCodeAt(0))); },
};
const packShare = (name, tracks) => b64u.enc(JSON.stringify({ n: name, i: tracks.map((t) => t.id).join('') }));
const QR_MAX = 700;   // batas panjang teks agar QR tetap mudah dipindai

function parseShareInput(text) {
  text = String(text || '').trim();
  let m = text.match(/[#?&](?:c|code)=([A-Za-z0-9-]{8,9})(?![A-Za-z0-9-])/);
  if (m) return { code: m[1].replace(/-/g, '').toUpperCase() };
  m = text.match(/[#?&]share=([\w-]+)/); if (m) return { payload: m[1] };
  m = text.match(/^NADA1\.([\w-]+)$/); if (m) return { payload: m[1] };
  const c = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (/^[A-Z2-9]{8}$/.test(c)) return { code: c };
  return null;
}

async function resolveShare(text) {
  const p = parseShareInput(text);
  if (!p) throw new Error('Kode tidak dikenali. Periksa lagi atau tempel tautannya.');
  if (p.code) {
    const r = await fetch('/api/share?code=' + encodeURIComponent(p.code));
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Kode tidak ditemukan.');
    return { name: d.name || 'Playlist', tracks: (d.tracks || []).map((t) => ({ id: t.id, title: t.title, artist: t.artist, thumb: thumb(t.id) })) };
  }
  let o; try { o = JSON.parse(b64u.dec(p.payload)); } catch { throw new Error('Kode rusak atau terpotong. Salin ulang dari awal.'); }
  const ids = String(o.i || '').match(/[\w-]{11}/g) || [];
  if (!ids.length) throw new Error('Playlist ini kosong.');
  const tracks = [];
  for (let i = 0; i < ids.length; i += 50) {
    const r = await fetch('/api/videos?ids=' + ids.slice(i, i + 50).join(','));
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Data lagu tidak bisa dimuat.');
    (d.items || []).forEach((t) => tracks.push({ id: t.id, title: t.title, artist: t.artist, thumb: thumb(t.id) }));
  }
  if (!tracks.length) throw new Error('Lagu dalam playlist ini tidak ditemukan.');
  return { name: String(o.n || 'Playlist').slice(0, 40), tracks };
}

async function importFrom(text) {
  const my = mctx; if (!my) return;
  my.busy = true; my.err = ''; renderMenu();
  try {
    const res = await resolveShare(text);
    if (mctx !== my) return;
    my.busy = false; my.mode = 'preview'; my.preview = res; renderMenu();
    $('#impName')?.focus();
  } catch (e) {
    if (mctx !== my) return;
    my.busy = false; my.mode = 'import'; my.err = e.message || 'Gagal memuat.'; renderMenu();
    $('#impCode')?.focus();
  }
}

async function openShare(ctx) {
  const tracks = ctxTracks(ctx);
  if (!tracks.length) { toast('Playlist masih kosong'); return; }
  const pl = ctx.startsWith('pl:') ? state.playlists.find((p) => p.id === ctx.slice(3)) : null;
  const name = pl ? pl.name : 'Liked Songs';
  const list = tracks.slice(0, 200).map((t) => ({ id: t.id, title: t.title, artist: t.artist }));
  const S = { name, count: list.length, status: 'loading', code: '', link: '', qr: '', long: false, nostore: false };
  mctx = { track: null, ctx, mode: 'share', share: S };
  renderMenu(); $('#menu').hidden = false; $('#menuBody button')?.focus();
  const my = mctx;
  try {
    const r = await fetch('/api/share', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, tracks: list }) });
    const d = await r.json().catch(() => ({}));
    if (r.ok && d.code) { S.code = d.code; S.link = `${location.origin}/#c=${d.code}`; }
    else { S.nostore = r.status === 501; }
  } catch { /* offline: pakai tautan panjang */ }
  if (!S.code) { S.link = `${location.origin}/#share=${packShare(name, list)}`; S.payload = `NADA1.${packShare(name, list)}`; }
  if (S.link.length <= QR_MAX && window.NadaQR) { try { S.qr = NadaQR.svg(S.link); } catch {} }
  S.long = !S.code && !S.qr;
  S.status = 'ok';
  if (mctx !== my) return;
  renderMenu(); $('#menuBody button')?.focus();
}

async function copyText(text, okMsg) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch {}
    ta.remove();
  }
  toast(okMsg);
}

$('#menu').addEventListener('click', (e) => {
  if (e.target === $('#menu')) { closeMenu(); return; }
  const b = e.target.closest('[data-act]');
  if (!b || !mctx) return;
  const { track, ctx } = mctx, a = b.dataset.act;
  if (a === 'close') { closeMenu(); render(); }
  else if (a === 'addart') { followArtist(b.dataset.name); renderMenu(); render(); $('#menuBody .act')?.focus(); }
  else if (a === 'delart') { unfollowArtist(b.dataset.name); renderMenu(); render(); $('#menuBody .act')?.focus(); }
  else if (a === 'copycode') { const S = mctx.share; copyText(S.code || S.payload, S.code ? 'Kode disalin' : 'Kode panjang disalin'); }
  else if (a === 'copylink') { copyText(mctx.share.link, 'Tautan disalin'); }
  else if (a === 'nativeshare') { const S = mctx.share; navigator.share({ title: `Playlist ${S.name} di Nada`, text: `Playlist "${S.name}" (${S.count} lagu) di Nada`, url: S.link }).catch(() => {}); }
  else if (a === 'toimport') { mctx.mode = 'import'; mctx.err = ''; renderMenu(); $('#impCode')?.focus(); }
  else if (a === 'like') { toggleFav(track); closeMenu(); }
  else if (a === 'toplaylist') { mctx.mode = 'pl'; renderMenu(); $('#menuBody button')?.focus(); }
  else if (a === 'backmain') { mctx.mode = 'main'; renderMenu(); $('#menuBody button')?.focus(); }
  else if (a === 'addpl') { addToPlaylist(b.dataset.pid, track); closeMenu(); render(); }
  else if (a === 'follow') { toggleArtist(track); closeMenu(); render(); }
  else if (a === 'artistsearch') { closeMenu(); runSearch(track.artist); }
  else if (a === 'rmpl') {
    const p = state.playlists.find((x) => x.id === ctx.slice(3));
    if (p) { p.tracks = p.tracks.filter((x) => x.id !== track.id); store.set('playlists', state.playlists); toast('Dihapus dari playlist'); }
    closeMenu(); render();
  }
});

$('#menu').addEventListener('submit', (e) => {
  e.preventDefault();
  if (e.target.id === 'artForm') {
    const n = $('#artName').value;
    if (followArtist(n)) { renderMenu(); render(); }
    $('#artName')?.focus();
    return;
  }
  if (e.target.id === 'impForm') { const v = $('#impCode').value; if (v.trim()) importFrom(v); return; }
  if (e.target.id === 'impSave') {
    const P = mctx.preview, nm = ($('#impName').value.trim() || P.name).slice(0, 40);
    const p = { id: uid(), name: nm, tracks: P.tracks.map((t) => ({ id: t.id, title: t.title, artist: t.artist, thumb: t.thumb || thumb(t.id) })) };
    state.playlists.push(p); store.set('playlists', state.playlists);
    toast(`Playlist "${nm}" disimpan (${p.tracks.length} lagu)`);
    closeMenu(); state.tab = 'home'; store.set('tab', 'home'); openView('pl:' + p.id);
    return;
  }
  const name = $('#plName').value.trim();
  if (!name) return;
  const p = { id: uid(), name, tracks: [] };
  state.playlists.push(p);
  if (mctx && mctx.track) p.tracks.push(slim(mctx.track));
  store.set('playlists', state.playlists);
  toast(mctx && mctx.track ? `Playlist "${name}" dibuat dan lagu ditambahkan` : `Playlist "${name}" dibuat`);
  closeMenu(); render();
});

/* =====================================================================
   PEMUTARAN
   ===================================================================== */
window.onYouTubeIframeAPIReady = () => {
  yt = new YT.Player('yt', {
    width: '100%', height: '100%',
    playerVars: { playsinline: 1, controls: 0, rel: 0, modestbranding: 1, disablekb: 1, fs: 0, iv_load_policy: 3 },
    events: {
      onReady() {
        ytReady = true;
        if (pending) { yt.loadVideoById({ videoId: pending.id, startSeconds: pending.start }); pending = null; }
      },
      onStateChange(e) {
        const S = YT.PlayerState;
        if (e.data === S.PLAYING) setPlaying(true);
        else if (e.data === S.PAUSED) {
          setPlaying(false);
          // dijeda sistem saat app di latar? coba lanjutkan (bukan jeda dari pengguna)
          if (state.want && document.hidden) setTimeout(() => { if (state.want && document.hidden) yt.playVideo(); }, 400);
        } else if (e.data === S.ENDED) { setPlaying(false); next(true); }
      },
      onError() {
        toast('Lagu ini tidak bisa diputar di luar YouTube, lanjut ke berikutnya…');
        setTimeout(() => next(true), 1200);
      },
    },
  });
};

/* Audio senyap: membuat browser menganggap halaman ini sedang memutar media,
   sehingga notifikasi/kontrol media muncul dan halaman lebih jarang "dibekukan" di latar. */
const keep = (() => {
  let a = null;
  const wav = () => {
    const sr = 8000, buf = new ArrayBuffer(44 + sr), v = new DataView(buf);
    const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    w(0, 'RIFF'); v.setUint32(4, 36 + sr, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr, true);
    v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, sr, true);
    new Uint8Array(buf, 44).fill(128);
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  };
  return {
    start() { try { if (!a) { a = new Audio(wav()); a.loop = true; } a.play().catch(() => {}); } catch {} },
    stop() { try { a && a.pause(); } catch {} },
  };
})();

function setPlaying(v) {
  state.playing = v; renderControls();
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = v ? 'playing' : 'paused';
}

function playList(list, i) { state.queue = list.slice(); state.idx = i; load(0); }

function load(start = 0) {
  const t = current(); if (!t) return;
  state.want = true; keep.start();
  if (ytReady) yt.loadVideoById({ videoId: t.id, startSeconds: start }); else pending = { id: t.id, start };
  state.recent = [slim(t), ...state.recent.filter((x) => x.id !== t.id)].slice(0, 50);
  store.set('recent', state.recent);
  backfillArtist(t);
  renderPlayer(); renderControls(); markPlaying(); updateMediaSession();
  if (state.pview === 'lyrics') ensureLyrics(); else { state.lyr = { id: '', status: 'idle', synced: [], plain: '', src: '', active: -1 }; }
  $('#seek').value = 0; $('#seek').style.setProperty('--p', '0%');
}

function playYT() { if (!ytReady || !current()) return; state.want = true; keep.start(); yt.playVideo(); }
function pauseYT() { if (!ytReady) return; state.want = false; yt.pauseVideo(); keep.stop(); }
function toggle() { state.playing ? pauseYT() : playYT(); }

function next(auto = false) {
  const n = state.queue.length; if (!n) return;
  if (auto && state.repeat === 'one') { yt.seekTo(0, true); yt.playVideo(); return; }
  if (state.shuffle && n > 1) {
    let r; do { r = Math.floor(Math.random() * n); } while (r === state.idx);
    state.idx = r;
  } else if (state.idx + 1 < n) state.idx++;
  else if (state.repeat === 'all' || !auto) state.idx = 0;
  else { state.want = false; keep.stop(); setPlaying(false); return; }
  load(0);
}

function prev() {
  if (!state.queue.length) return;
  if (ytReady && yt.getCurrentTime() > 3) { yt.seekTo(0, true); return; }
  state.idx = (state.idx - 1 + state.queue.length) % state.queue.length;
  load(0);
}

function resume() {
  const r = state.resume; if (!r || !r.track) return;
  const q = (r.queue && r.queue.length ? r.queue : [r.track]);
  const i = q.findIndex((t) => t.id === r.track.id);
  state.queue = q; state.idx = i >= 0 ? i : 0;
  load(r.pos || 0);
}

/* simpan posisi untuk "Lanjutkan mendengarkan" */
setInterval(() => {
  if (!ytReady || !current() || typeof yt.getCurrentTime !== 'function' || !state.playing) return;
  const pos = Math.floor(yt.getCurrentTime() || 0), dur = Math.floor(yt.getDuration() || 0);
  if (pos < 2) return;
  state.resume = { track: slim(current()), pos, dur, queue: state.queue.slice(0, 50).map(slim), idx: state.idx };
  store.set('resume', state.resume);
}, 3000);

/* ---------- Lirik ---------- */
const lyrCache = new Map();
let lyrUser = 0, lyrReq = 0;
const lyrOffs = store.get('lyrOffs', {});   // geser waktu lirik per lagu (detik)
const lyrOff = () => (current() && lyrOffs[current().id]) || 0;

function setPview(v, silent) {
  state.pview = v === 'lyrics' ? 'lyrics' : 'video';
  store.set('pview', state.pview);
  $('#player').dataset.pview = state.pview;
  $('#pvVideo').setAttribute('aria-pressed', String(state.pview === 'video'));
  $('#pvLyrics').setAttribute('aria-pressed', String(state.pview === 'lyrics'));
  if (state.pview === 'lyrics') ensureLyrics();
}

function lyrSearchLink(t) {
  return `https://www.google.com/search?q=${encodeURIComponent(`${t.title} ${t.artist} lirik`)}`;
}

function renderLyrics() {
  const el = $('#lyrics'), L = state.lyr, t = current();
  el.classList.toggle('plain', L.status === 'ok' && !L.synced.length);
  if (!t) { el.innerHTML = '<p class="ly-msg">Putar lagu untuk melihat liriknya.</p>'; return; }
  if (L.status === 'loading') { el.innerHTML = '<div class="ly-sk" style="width:80%"></div><div class="ly-sk" style="width:60%"></div><div class="ly-sk" style="width:72%"></div><div class="ly-sk" style="width:50%"></div>'; return; }
  if (L.status === 'instrumental') { el.innerHTML = '<p class="ly-msg">Lagu instrumental, tidak ada lirik.</p>'; return; }
  if (L.status !== 'ok') {
    el.innerHTML = `<p class="ly-msg">${L.status === 'err' ? 'Lirik tidak bisa dimuat sekarang.' : 'Lirik lagu ini belum tersedia.'}<br><a href="${lyrSearchLink(t)}" target="_blank" rel="noopener">Cari di Google</a></p>`;
    return;
  }
  const off = lyrOff();
  const sync = L.synced.length ? `<span class="ly-off"><button type="button" data-lyoff="-0.5" aria-label="Lirik lebih cepat">−0,5s</button>${off ? `<em>${off > 0 ? '+' : ''}${String(off).replace('.', ',')}s</em>` : ''}<button type="button" data-lyoff="0.5" aria-label="Lirik lebih lambat">+0,5s</button></span>` : '';
  const src = `<div class="ly-src"><span>Lirik dari ${esc(L.src || 'LRCLIB')}</span>${sync}</div>`;
  if (L.synced.length) {
    el.innerHTML = L.synced.map((l, i) => `<p data-ly="${i}" data-t="${l[0]}"${l[1] ? '' : ' class="gap"'}>${l[1] ? esc(l[1]) : '♪'}</p>`).join('') + src;
  } else {
    el.innerHTML = L.plain.split(/\r?\n/).map((l) => (l.trim() ? `<p>${esc(l)}</p>` : '<p class="gap"></p>')).join('') + src;
  }
  L.active = -1;
}

async function ensureLyrics() {
  const t = current(); if (!t) { renderLyrics(); return; }
  if (state.lyr.id === t.id && state.lyr.status !== 'idle' && state.lyr.status !== 'err') { return; }
  const hit = lyrCache.get(t.id);
  if (hit) { state.lyr = { id: t.id, ...hit, active: -1 }; renderLyrics(); { $('#stage').scrollTop = 0; $('#lyrics').scrollTop = 0; } return; }
  const my = ++lyrReq;
  state.lyr = { id: t.id, status: 'loading', synced: [], plain: '', src: '', active: -1 };
  renderLyrics(); { $('#stage').scrollTop = 0; $('#lyrics').scrollTop = 0; }
  const dur = ytReady && yt.getDuration ? Math.round(yt.getDuration() || 0) : 0;
  try {
    const r = await fetch(`/api/lyrics?title=${encodeURIComponent(t.title)}&artist=${encodeURIComponent(t.artist)}${dur ? '&dur=' + dur : ''}`);
    const d = await r.json();
    if (my !== lyrReq) return;
    if (!r.ok) throw new Error(d.error || 'gagal');
    let v;
    if (!d.found) v = { status: 'none', synced: [], plain: '', src: '' };
    else if (d.instrumental) v = { status: 'instrumental', synced: [], plain: '', src: '' };
    else if ((d.synced && d.synced.length) || (d.plain && d.plain.trim())) v = { status: 'ok', synced: d.synced || [], plain: d.plain || '', src: d.source || 'LRCLIB' };
    else v = { status: 'none', synced: [], plain: '', src: '' };
    lyrCache.set(t.id, v);
    state.lyr = { id: t.id, ...v, active: -1 };
  } catch {
    if (my !== lyrReq) return;
    state.lyr = { id: t.id, status: 'err', synced: [], plain: '', src: '', active: -1 };
  }
  renderLyrics();
}

// sorot baris yang sedang dinyanyikan dan gulir ke tengah
function lyricsTick(cur) {
  const L = state.lyr, t = current();
  if (state.pview !== 'lyrics' || !t || L.id !== t.id || L.status !== 'ok' || !L.synced.length) return;
  const x = cur + 0.25 - lyrOff();
  let lo = 0, hi = L.synced.length - 1, idx = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (L.synced[m][0] <= x) { idx = m; lo = m + 1; } else hi = m - 1; }
  if (idx === L.active) return;
  const el = $('#lyrics'), own = getComputedStyle(el).overflowY === 'auto', sc = own ? el : $('#stage');
  el.querySelector('p.on')?.classList.remove('on');
  L.active = idx;
  const p = idx >= 0 ? el.querySelector(`[data-ly="${idx}"]`) : null;
  if (!p) return;
  p.classList.add('on');
  if (Date.now() - lyrUser > 4000) sc.scrollTo({ top: Math.max(0, (own ? 0 : el.offsetTop) + p.offsetTop - sc.clientHeight / 2 + p.offsetHeight / 2), behavior: 'smooth' });
}

/* progres */
setInterval(() => {
  if (!ytReady || !current() || typeof yt.getCurrentTime !== 'function') return;
  const cur = yt.getCurrentTime() || 0, dur = yt.getDuration() || 0;
  lyricsTick(cur);
  if (!dur) return;
  const p = (cur / dur) * 100;
  $('#miniBar').style.width = p + '%';
  if (!seeking) { $('#seek').value = (cur / dur) * 1000; $('#seek').style.setProperty('--p', p + '%'); $('#cur').textContent = fmt(cur); }
  $('#dur').textContent = fmt(dur);
  if ('mediaSession' in navigator && navigator.mediaSession.setPositionState) {
    try { navigator.mediaSession.setPositionState({ duration: dur, position: Math.min(cur, dur), playbackRate: 1 }); } catch {}
  }
}, 500);

/* saat app ke latar belakang, terus coba pastikan musik berjalan */
let bgTimer;
document.addEventListener('visibilitychange', () => {
  clearInterval(bgTimer);
  if (!document.hidden) return;
  let n = 0;
  bgTimer = setInterval(() => {
    if (!state.want || !ytReady) return;
    const st = yt.getPlayerState && yt.getPlayerState();
    if (st !== YT.PlayerState.PLAYING && st !== YT.PlayerState.BUFFERING) yt.playVideo();
    if (++n > 1200) clearInterval(bgTimer);
  }, 1500);
});

/* Media Session: kontrol di lock screen / notifikasi / tombol media */
function updateMediaSession() {
  if (!('mediaSession' in navigator)) return;
  const t = current(); if (!t) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: t.title, artist: t.artist,
    artwork: [{ src: `https://i.ytimg.com/vi/${t.id}/hqdefault.jpg`, sizes: '480x360', type: 'image/jpeg' }],
  });
}
if ('mediaSession' in navigator) {
  const h = (a, f) => { try { navigator.mediaSession.setActionHandler(a, f); } catch {} };
  h('play', playYT);
  h('pause', pauseYT);
  h('previoustrack', prev);
  h('nexttrack', () => next());
  h('seekto', (d) => yt && yt.seekTo(d.seekTime, true));
  h('seekbackward', () => seekBy(-10));
  h('seekforward', () => seekBy(10));
}

/* =====================================================================
   EVENT
   ===================================================================== */
$('#searchForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = $('#q').value.trim(); if (!q) return;
  $('#q').blur(); search(q);
});
$('#q').addEventListener('input', onType);
$('#q').addEventListener('focus', onType);
$('#q').addEventListener('blur', () => setTimeout(() => { if (!$('#suggest').contains(document.activeElement)) hideSuggest(); }, 160));
$('#suggest').addEventListener('pointerdown', (e) => e.preventDefault()); // jaga fokus input saat disentuh
$('#suggest').addEventListener('click', (e) => {
  const b = e.target.closest('[data-suggest]'); if (!b) return;
  runSearch(b.dataset.suggest);
});

function updateOfficialBtn() { $('#officialBtn').setAttribute('aria-pressed', String(state.official)); }
$('#officialBtn').addEventListener('click', () => {
  state.official = !state.official; store.set('official', state.official); updateOfficialBtn();
  toast(state.official ? 'Hanya musik resmi' : 'Semua hasil, termasuk reupload');
  if (state.q && state.tab === 'search') search(state.q);
});

$('#list').addEventListener('click', (e) => {
  const t = e.target; let el;
  if ((el = t.closest('[data-hs]'))) { const sc = el.parentElement.querySelector('.hscroll'); sc.scrollBy({ left: +el.dataset.hs * sc.clientWidth * 0.8, behavior: 'smooth' }); return; }
  if ((el = t.closest('[data-like]'))) { const [c, i] = splitRef(el.dataset.like); toggleFav(ctxTracks(c)[i]); return; }
  if ((el = t.closest('[data-more]'))) { const [c, i] = splitRef(el.dataset.more); const tr = ctxTracks(c)[i]; if (tr) openMenu(tr, c); return; }
  if ((el = t.closest('[data-play]'))) { playList(ctxTracks(el.dataset.play), +el.dataset.i); return; }
  if ((el = t.closest('[data-playall]'))) { const l = ctxTracks(el.dataset.playall); if (l.length) playList(l, 0); return; }
  if ((el = t.closest('[data-charttab]'))) { state.chartTab = el.dataset.charttab; store.set('chartTab', state.chartTab); render(); return; }
  if (t.closest('[data-focussearch]')) { $('#q').focus(); return; }
  if ((el = t.closest('[data-open]'))) { openView(el.dataset.open); return; }
  if ((el = t.closest('[data-pl]'))) { openView('pl:' + el.dataset.pl); return; }
  if (t.closest('[data-manageart]')) { openMenu(null, null, 'artists'); return; }
  if ((el = t.closest('[data-followart]'))) { const n = el.dataset.followart; if (isFollowing(n)) { unfollowArtist(n); } else followArtist(n, el.closest('.artist')?.querySelector('img')?.src || ''); render(); return; }
  if ((el = t.closest('[data-artist]'))) { runSearch(el.dataset.artist); return; }
  if ((el = t.closest('[data-share]'))) { openShare(el.dataset.share); return; }
  if (t.closest('[data-import]')) { openMenu(null, null, 'import'); return; }
  if (t.closest('[data-newpl]')) { openMenu(null, null, 'newpl'); return; }
  if (t.closest('[data-resume]')) { resume(); return; }
  if (t.closest('[data-back]')) { closeView(); return; }
  if (t.closest('[data-delpl]')) {
    if (!state.confirmDel) { state.confirmDel = true; render(); setTimeout(() => { if (state.confirmDel) { state.confirmDel = false; if (state.view) render(); } }, 4000); return; }
    const id = state.view.ctx.slice(3);
    state.playlists = state.playlists.filter((p) => p.id !== id); store.set('playlists', state.playlists);
    state.confirmDel = false; state.view = null; toast('Playlist dihapus'); render();
  }
});

document.querySelectorAll('.tabs button[data-tab]').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));

$('#mini').addEventListener('click', (e) => {
  if (e.target.closest('#miniPlay')) return toggle();
  if (e.target.closest('#miniNext')) return next();
  $('#player').classList.add('open');
});
$('#upnext').addEventListener('click', (e) => {
  const el = e.target.closest('[data-upi]'); if (!el) return;
  state.idx = +el.dataset.upi; load(0);
});
$('#pvVideo').addEventListener('click', () => setPview('video'));
$('#pvLyrics').addEventListener('click', () => setPview('lyrics'));
$('#lyrics').addEventListener('click', (e) => {
  const ob = e.target.closest('[data-lyoff]');
  if (ob && current()) {
    const id = current().id, v = Math.round(((lyrOffs[id] || 0) + parseFloat(ob.dataset.lyoff)) * 10) / 10;
    if (v) lyrOffs[id] = v; else delete lyrOffs[id];
    const keys = Object.keys(lyrOffs); if (keys.length > 60) delete lyrOffs[keys[0]];
    store.set('lyrOffs', lyrOffs); const top = $('#stage').scrollTop, top2 = $('#lyrics').scrollTop; renderLyrics(); $('#stage').scrollTop = top; $('#lyrics').scrollTop = top2; state.lyr.active = -1; return;
  }
  const p = e.target.closest('[data-t]'); if (!p || !ytReady) return;
  lyrUser = 0; yt.seekTo(parseFloat(p.dataset.t), true);
});
['wheel', 'touchmove'].forEach((ev) => $('#stage').addEventListener(ev, () => { lyrUser = Date.now(); }, { passive: true }));
$('#collapse').addEventListener('click', () => $('#player').classList.remove('open'));
$('#play').addEventListener('click', toggle);
$('#next').addEventListener('click', () => next());
$('#prev').addEventListener('click', prev);
$('#favBtn').addEventListener('click', () => toggleFav(current()));
$('#moreBtn').addEventListener('click', () => { const t = current(); if (t) openMenu(t, null); });
$('#shuffle').addEventListener('click', () => { state.shuffle = !state.shuffle; store.set('shuffle', state.shuffle); renderControls(); });
$('#repeat').addEventListener('click', () => {
  state.repeat = { off: 'all', all: 'one', one: 'off' }[state.repeat];
  store.set('repeat', state.repeat); renderControls();
  toast({ off: 'Ulangi: mati', all: 'Ulangi semua', one: 'Ulangi satu lagu' }[state.repeat]);
});

const seekEl = $('#seek');
seekEl.addEventListener('input', () => {
  seeking = true;
  seekEl.style.setProperty('--p', seekEl.value / 10 + '%');
  if (ytReady) $('#cur').textContent = fmt((seekEl.value / 1000) * yt.getDuration());
});
seekEl.addEventListener('change', () => {
  if (ytReady) yt.seekTo((seekEl.value / 1000) * yt.getDuration(), true);
  seeking = false;
});

/* =====================================================================
   LAYOUT RESPONSIF & MODE TV
   ===================================================================== */
function applyLayout() {
  const w = window.innerWidth;
  const layout = state.tv || w >= 1200 ? 'desktop' : w >= 768 ? 'tablet' : 'phone';
  const root = document.documentElement;
  root.dataset.layout = layout;
  root.classList.toggle('tv', state.tv);
  $('#tvHint').hidden = !state.tv;
  $('#tvToggle').classList.toggle('on', state.tv);
  if (layout === 'desktop') $('#player').classList.remove('open'); // panel permanen di desktop/TV
}
window.addEventListener('resize', applyLayout);

$('#tvToggle').addEventListener('click', () => {
  state.tv = !state.tv; store.set('tv', state.tv);
  applyLayout(); render(); $('#tvToggle').focus();
  toast(state.tv ? 'Mode TV aktif: pakai tombol panah remote' : 'Mode TV dimatikan');
});

/* ---------- keyboard (desktop) & remote (TV) ---------- */
function seekBy(sec) {
  if (ytReady && current()) yt.seekTo(Math.max(0, yt.getCurrentTime() + sec), true);
}

const visible = (el) => el.getClientRects().length > 0;
function focusables() {
  if (!$('#menu').hidden) return [...document.querySelectorAll('#menu button, #menu input')].filter(visible);
  return [...document.querySelectorAll('.tabs button, #q, #officialBtn, #suggest button, #list [data-nav], #pvVideo, #pvLyrics, #upnext [data-nav], #seek, #prev, #play, #next, #shuffle, #repeat, #favBtn, #moreBtn')].filter(visible);
}

// Navigasi spasial: pindah fokus ke elemen terdekat pada arah panah
function spatial(dir) {
  const els = focusables(), cur = document.activeElement;
  if (!els.includes(cur)) { (els.find((e) => e.hasAttribute('data-nav')) || els[0])?.focus(); return; }
  const a = cur.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  const horiz = dir === 'ArrowLeft' || dir === 'ArrowRight';
  const sign = dir === 'ArrowRight' || dir === 'ArrowDown' ? 1 : -1;
  let best = null, bestScore = Infinity;
  for (const el of els) {
    if (el === cur) continue;
    const b = el.getBoundingClientRect(), dx = b.left + b.width / 2 - ax, dy = b.top + b.height / 2 - ay;
    const main = (horiz ? dx : dy) * sign, side = Math.abs(horiz ? dy : dx);
    if (main < 4) continue;
    const score = main + side * 2.5;
    if (score < bestScore) { bestScore = score; best = el; }
  }
  if (best) { best.focus(); best.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); }
}

function focusedItem() {
  const el = document.activeElement?.closest?.('[data-play]');
  if (!el) return null;
  return { track: ctxTracks(el.dataset.play)[+el.dataset.i], ctx: el.dataset.play };
}
function likeFocused() { const f = focusedItem(); toggleFav(f ? f.track : current()); }
function menuFocused() { const f = focusedItem(); const t = f ? f.track : current(); if (t) openMenu(t, f ? f.ctx : null); }

document.addEventListener('keydown', (e) => {
  const t = e.target, k = e.key, kc = e.keyCode;
  const typing = !!(t.matches && t.matches('input[type=search], input[type=text]'));

  // tombol media (keyboard & remote TV)
  if (k === 'MediaPlayPause' || kc === 415 || kc === 19 || kc === 179) { e.preventDefault(); toggle(); return; }
  if (k === 'MediaTrackNext' || kc === 417) { e.preventDefault(); next(); return; }
  if (k === 'MediaTrackPrevious' || kc === 412) { e.preventDefault(); prev(); return; }
  if (kc === 404) { e.preventDefault(); setPview(state.pview === 'lyrics' ? 'video' : 'lyrics'); return; }  // 404 = hijau
  if (kc === 405 || (state.tv && !typing && (k === 'f' || k === 'F'))) { e.preventDefault(); likeFocused(); return; }  // 405 = kuning
  if (kc === 406 || (state.tv && !typing && (k === 'm' || k === 'M'))) { e.preventDefault(); menuFocused(); return; }  // 406 = biru

  if (k === 'Escape' || (state.tv && (k === 'Backspace' || k === 'GoBack' || kc === 10009 || kc === 461) && !typing)) {
    if (!$('#menu').hidden) { e.preventDefault(); closeMenu(); return; }
    if (!$('#suggest').hidden) { e.preventDefault(); hideSuggest(); $('#q').blur(); return; }
    if (typing) { t.blur(); return; }
    if (state.tv) { e.preventDefault(); if (state.view) closeView(); else $(`.tabs [data-tab="${state.tab}"]`)?.focus(); return; }
  }

  // panah bawah/atas di kolom cari ↔ daftar saran (non-TV)
  if (!state.tv && t.id === 'q' && k === 'ArrowDown' && !$('#suggest').hidden) { e.preventDefault(); $('#suggest button')?.focus(); return; }
  if (!state.tv && t.closest && t.closest('#suggest') && (k === 'ArrowDown' || k === 'ArrowUp')) {
    e.preventDefault();
    const items = [...document.querySelectorAll('#suggest button')], i = items.indexOf(t);
    if (k === 'ArrowDown') items[Math.min(i + 1, items.length - 1)].focus();
    else if (i > 0) items[i - 1].focus(); else $('#q').focus();
    return;
  }

  if (typing && !(state.tv && (k === 'ArrowUp' || k === 'ArrowDown'))) return;
  if ((k === 'l' || k === 'L') && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); setPview(state.pview === 'lyrics' ? 'video' : 'lyrics'); return; }
  if (k === '/' && !typing) { e.preventDefault(); $('#q').focus(); return; }
  if (t.id === 'seek' && (k === 'ArrowLeft' || k === 'ArrowRight')) { e.preventDefault(); seekBy(k === 'ArrowRight' ? 5 : -5); return; }
  if ((k === 'Enter' || k === ' ') && t.hasAttribute && t.hasAttribute('data-nav') && !t.matches('button')) { e.preventDefault(); t.click(); return; }

  if (state.tv) {
    if (k.startsWith('Arrow')) { e.preventDefault(); spatial(k); }
    return;
  }
  // pintasan desktop
  if (k === ' ' && !t.matches('button, input, a')) { e.preventDefault(); toggle(); }
  else if (k === 'ArrowRight' && e.shiftKey) next();
  else if (k === 'ArrowLeft' && e.shiftKey) prev();
  else if (k === 'ArrowRight' && !t.matches('input')) seekBy(5);
  else if (k === 'ArrowLeft' && !t.matches('input')) seekBy(-5);
});

/* ---------- init ---------- */
if (/[#?&](c|code|share)=/.test(location.hash)) {
  const linkText = location.href;
  try { history.replaceState(null, '', location.pathname + location.search); } catch {}
  setTimeout(() => { openMenu(null, null, 'import'); importFrom(linkText); }, 300);
}
applyLayout(); setPview(state.pview); updateOfficialBtn(); renderControls(); render();
if (state.tab === 'home' || state.tab === 'library') loadCharts();
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
