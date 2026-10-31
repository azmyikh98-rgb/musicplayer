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
  qnext: '<svg viewBox="0 0 24 24"><path d="M4 6h10M4 11h7M4 16h7M16 9l4 3-4 3z"/></svg>',
  qadd: '<svg viewBox="0 0 24 24"><path d="M4 6h12M4 11h12M4 16h7M17 14v6M14 17h6"/></svg>',
  scan: '<svg viewBox="0 0 24 24"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M4 12h16"/></svg>',
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
  story: '<svg viewBox="0 0 24 24"><rect x="6" y="3" width="12" height="18" rx="3"/><path d="M12 8.5l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24"><path d="M3 7h3c5 0 6 10 11 10h4M3 17h3c1.5 0 2.6-.9 3.6-2.2M14.4 9.2C15.4 7.9 16.5 7 18 7h3M18 4l3 3-3 3M18 14l3 3-3 3"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M5 19l1-4L16 5l3 3L9 18zM14 7l3 3"/></svg>',
};

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
  userQ: 0,                                  // jumlah lagu antrean buatan pengguna tepat setelah lagu yang diputar
  sleep: null,                               // {mode:'time',at} | {mode:'end'}
  artistData: {},                            // cache halaman artis: nama -> {status,tracks}
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
  if (ctx && ctx.startsWith('artist:')) return artistTracks(ctx.slice(7));
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
    <span class="thumb"><img src="${imgOf(t)}" alt="" loading="lazy">${playing ? '<span class="eqb" aria-hidden="true"><i></i><i></i><i></i></span>' : ''}</span>
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
    <div class="cover"><img src="${imgOf(t)}" alt="" loading="lazy">${playing ? '<span class="eqb" aria-hidden="true"><i></i><i></i><i></i></span>' : ''}${rank ? `<span class="rank">${i + 1}</span>` : ''}</div>
    <button class="more icon-btn card-more" data-more="${esc(ctx)}:${i}" tabindex="-1" aria-label="Menu lagu">${ICON.more}</button>
    <b>${esc(t.title)}</b><small>${esc(t.artist)}</small>
  </div>`;
}

const zone = (kick) => `<div class="zone"><span>${kick}</span></div>`;
const section = (title, inner, seeAll, sub) =>
  `<section class="sec"><div class="sec-head"><h2>${title}${sub ? `<small class="sub">${sub}</small>` : ''}</h2>${seeAll ? `<button class="link" data-nav data-open="${seeAll}">Lihat semua</button>` : ''}</div>${inner}</section>`;
const hscroll = (items) => `<div class="hs"><button class="hs-btn l" data-hs="-1" tabindex="-1" aria-label="Geser ke kiri">‹</button><div class="hscroll">${items.join('')}</div><button class="hs-btn r" data-hs="1" tabindex="-1" aria-label="Geser ke kanan">›</button></div>`;

function artistsSection() {
  const chips = [`<div class="artist add" data-nav tabindex="0" role="button" data-manageart aria-label="Tambah artis"><div class="av">${ICON.plus}</div><b>Tambah</b></div>`];
  state.artists.forEach((a) => chips.push(
    `<div class="artist" data-nav tabindex="0" role="button" data-artist="${esc(a.name)}" aria-label="Cari lagu ${esc(a.name)}">${avatar(a)}<b>${esc(a.name)}</b></div>`));
  const body = hscroll(chips) + (state.artists.length ? '' : '<p class="hint">Follow artis dari daftar Artis Populer di bawah, atau tap Tambah buat ngetik nama artisnya.</p>');
  return `<section class="sec"><div class="sec-head"><h2>Artis Favorit<small class="sub">${state.artists.length ? state.artists.length + ' diikuti' : 'Belum ada yang diikuti'}</small></h2><button class="link" data-nav data-manageart>Kelola</button></div>${body}</section>`;
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
      <button class="fol${f ? ' on' : ''}" data-followart="${esc(a.name)}" tabindex="-1" aria-label="${f ? 'Berhenti mengikuti' : 'Ikuti'} ${esc(a.name)}">${f ? 'Difollow' : '+ Follow'}</button></div>`;
  });
  return `<section class="sec"><div class="sec-head"><h2>Artis Populer<small class="sub">Dari tangga lagu minggu ini</small></h2></div>${hscroll(cards)}</section>`;
}

function quickTile(attrs, ico, g, title, sub) {
  return `<button class="qt" data-nav ${attrs}><span class="ico${g ? ' g' : ''}">${ico}</span><span class="qm"><b>${title}</b><small>${sub}</small></span></button>`;
}

function chartsBlock() {
  const key = state.chartTab === 'GLOBAL' ? 'GLOBAL' : 'ID';
  const items = state.charts[key];
  let inner;
  if (items && items.length) inner = '<div class="tracks top5">' + items.slice(0, 5).map((t, i) => rowHTML(t, i, 'chart' + key, true)).join('') + '</div>'
    + hscroll(items.slice(5, 15).map((t, i) => cardHTML(t, i + 5, 'chart' + key, true)));
  else if (state.charts.err[key]) inner = empty(esc(state.charts.err[key]));
  else inner = hscroll(Array(6).fill('<div class="card sk"><div class="cover"></div></div>'));
  const seg = (k, label) => `<button class="seg${k === key ? ' on' : ''}" data-nav data-charttab="${k}" aria-pressed="${k === key}">${label}</button>`;
  return `<section class="sec"><div class="sec-head"><h2>Tangga Lagu<small class="sub">Musik terpopuler saat ini</small></h2>${items && items.length ? `<button class="link" data-nav data-open="chart${key}">Lihat semua</button>` : ''}</div>
    <div class="segs">${seg('ID', 'Indonesia')}${seg('GLOBAL', 'Global')}</div>${inner}</section>`;
}

const GENRES = [
  ['Pop Indonesia', 'lagu pop indonesia terbaru', '#ff5f7e,#ff9a5a'],
  ['Hip-Hop', 'lagu hip hop rap terbaru', '#8a5cff,#4b7bff'],
  ['Indie', 'lagu indie indonesia', '#20c997,#3b9ae1'],
  ['Dangdut', 'lagu dangdut terbaru', '#f7b733,#fc4a1a'],
  ['Rock', 'lagu rock terbaik', '#e53935,#6a1b1b'],
  ['R&B', 'lagu rnb soul terbaru', '#b24bf3,#ff6fb5'],
  ['EDM', 'lagu edm dance terbaru', '#00d4ff,#7a5cff'],
  ['K-Pop', 'kpop lagu terbaru', '#ff6ec4,#7873f5'],
  ['Akustik', 'lagu akustik santai', '#c8a46a,#7a5a2e'],
  ['Lo-fi', 'lofi chill lagu', '#4facfe,#2a3a6b'],
  ['Jazz', 'lagu jazz santai', '#f6d365,#a0522d'],
  ['Galau', 'lagu galau indonesia', '#5c6b8a,#2b3350'],
];
function genreBar() {
  const chips = GENRES.map(([n], i) => `<button type="button" class="gchip${state.genre === n ? ' on' : ''}" data-nav data-genre="${i}" aria-pressed="${state.genre === n}">${esc(n)}</button>`);
  return `<div class="gbar" role="group" aria-label="Pilih genre">${chips.join('')}</div>`;
}
function runGenre(i) {
  const g = GENRES[i]; if (!g) return;
  state.genre = g[0]; state._gq = g[1];
  $('#q').value = g[0]; $('#qClear').hidden = false; hideSuggest();
  search(g[1]);
  $('#list').scrollTop = 0;
}
function genreSection() {
  const tiles = GENRES.map(([n, q, g], i) => `<button class="gtile" data-nav data-genre="${i}" style="--g:${g.split(',')[0]};--g2:${g.split(',')[1]}" aria-label="Cari lagu ${esc(n)}"><b>${esc(n)}</b></button>`);
  return `<section class="sec"><div class="sec-head"><h2>Genre<small class="sub">Pilih suasana, kami carikan lagunya</small></h2></div><div class="genres">${tiles.join('')}</div></section>`;
}

function homeHTML() {
  const h = new Date().getHours();
  const greet = h < 11 ? 'Pagi, yuk gas!' : h < 15 ? 'Siang, lagi ngapain?' : h < 18 ? 'Sore, waktunya santai' : 'Malam, mau muter apa?';
  const fresh = !state.resume && !state.recent.length && !state.fav.length && !state.artists.length;
  const dateLbl = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
  let out = `<div class="home"><div class="greet-wrap"><small>${dateLbl}</small><h2 class="greet">${greet}</h2></div>`;

  // 1. lanjutkan, hal paling sering dibutuhkan
  if (state.resume && state.resume.track) {
    const r = state.resume, t = r.track, pct = r.dur ? Math.min(100, (r.pos / r.dur) * 100) : 0;
    out += `<div class="continue" data-nav tabindex="0" role="button" data-resume aria-label="Lanjutkan ${esc(t.title)}">
        <img src="${imgOf(t)}" alt="">
        <div class="meta"><small class="kick">Lanjutkan mendengarkan</small><b>${esc(t.title)}</b><small>${esc(t.artist)}</small><div class="bar"><i style="width:${pct}%"></i></div><small>${fmt(r.pos)}${r.dur ? ' / ' + fmt(r.dur) : ''}</small></div>
        <span class="play-chip">${ICON.play}</span>
      </div>`;
  } else if (fresh) {
    out += `<div class="welcome"><b>Halo, selamat datang di Nada!</b><p>Ketik lagu atau artis favoritmu di kolom atas, atau langsung intip yang lagi hits di bawah.</p><button class="pill" data-nav data-focussearch>Cari lagu</button></div>`;
  }

  // 2. akses cepat, selalu ada dan tidak pernah kosong
  out += `<div class="quick">`
    + quickTile('data-open="liked"', ICON.heart, true, 'Liked Songs', state.fav.length ? `${state.fav.length} lagu` : 'Masih kosong')
    + quickTile('data-open="recent"', ICON.clock, false, 'Baru diputar', state.recent.length ? `${state.recent.length} lagu` : 'Masih kosong')
    + quickTile('data-open="chartID"', ICON.list, false, 'Top Indonesia', 'Lagi hits')
    + quickTile('data-open="chartGLOBAL"', ICON.list, false, 'Top Global', 'Lagi hits')
    + `</div>`;

  // 3. lagi ramai: tangga lagu di atas supaya beranda langsung terasa hidup
  out += zone('Jelajahi') + chartsBlock();

  // 4. untukmu: riwayat dan lagu yang disukai
  if (state.recent.length || state.fav.length) out += zone('Untukmu');
  if (state.recent.length) out += section('Putar lagi', hscroll(state.recent.slice(0, 12).map((t, i) => cardHTML(t, i, 'recent'))), 'recent', 'Terakhir kamu putar');
  if (state.fav.length) out += section('Liked Songs', hscroll(state.fav.slice(0, 12).map((t, i) => cardHTML(t, i, 'liked'))), 'liked', state.fav.length + ' lagu favoritmu');

  // 5. koleksi
  out += zone('Koleksi');
  const plCards = state.playlists.map((p) => {
    const first = p.tracks[0];
    return `<div class="card pl" data-nav tabindex="0" role="button" data-pl="${p.id}" aria-label="Buka playlist ${esc(p.name)}">
      <div class="cover${first ? '' : ' ph'}">${first ? `<img src="${imgOf(first)}" alt="" loading="lazy">` : ICON.list}<span class="cnt">${p.tracks.length} lagu</span></div>
      <b>${esc(p.name)}</b><small>Playlist</small></div>`;
  });
  plCards.unshift(`<div class="card new" data-nav tabindex="0" role="button" data-newpl aria-label="Bikin playlist baru"><div class="cover">${ICON.plus}</div><b>Playlist baru</b><small>Bikin sendiri</small></div>`);
  out += section('Playlist Kamu', hscroll(plCards), '', state.playlists.length ? state.playlists.length + ' playlist' : 'Bikin yang pertama'); 

  // 6. artis
  out += zone('Kenalan') + artistsSection() + popularSection();
  return out + '</div>';
}

function searchHTML() {
  // Mode "home": pilihan genre dulu. Mode "results": daftar lagu hasil genre / pencarian, dengan tombol kembali.
  if (state.sMode !== 'results') {
    const chip = (q) => `<button class="qchip" data-nav data-q="${esc(q)}">${esc(q)}</button>`;
    const hist = state.history.slice(0, 8);
    const tries = STARTER_ARTISTS.filter((n) => !hist.some((h) => lc(h) === lc(n))).slice(0, 8);
    return `<div class="searchhome">`
      + genreSection()
      + (hist.length ? `<div class="sh-head"><h3>Pencarian terakhir</h3><button class="link" data-nav data-clearhist>Hapus</button></div><div class="qchips">${hist.map(chip).join('')}</div>` : '')
      + `<div class="sh-head"><h3>Coba cari</h3></div><div class="qchips">${tries.map(chip).join('')}</div></div>`;
  }
  const title = state.genre || (state.q && !/^https?:/i.test(state.q) ? state.q : 'Hasil pencarian');
  const top = '';
  const gb = state.genre ? genreBar() : '';
  if (state.loading) return top + gb + '<div class="tracks">' + '<div class="skeleton"></div>'.repeat(7) + '</div>';
  if (state.error) return top + gb + `<div class="tracks"><div class="empty"><b>Ups</b>${esc(state.error)}</div></div>`;
  return top + gb + `<div class="res-h"><span>${state.results.length} lagu</span><span class="res-act"><button class="pill sm" data-nav data-playall="search">${ICON.play}<span>Putar</span></button><button class="pill ghost sm" data-nav data-shuffleall="search">${ICON.shuffle}<span>Acak</span></button></span></div><div class="tracks">` + state.results.map((t, i) => rowHTML(t, i, 'search')).join('') + '</div>';
}

function libraryHTML() {
  const lib = (attrs, ico, g, title, sub) =>
    `<button class="lib" data-nav ${attrs}><span class="ico${g ? ' g' : ''}">${ico}</span><span><b>${title}</b><small>${sub}</small></span></button>`;
  let out = '<div class="home libp">';
  out += lib('data-open="liked"', ICON.heart, true, 'Liked Songs', `${state.fav.length} lagu`);
  out += lib('data-open="recent"', ICON.clock, false, 'Baru diputar', `${state.recent.length} lagu`);
  out += lib('data-open="chartID"', ICON.list, false, 'Tangga Lagu Indonesia', 'Lagu-lagu paling hits di Indonesia');
  out += lib('data-open="chartGLOBAL"', ICON.list, false, 'Tangga Lagu Global', 'Yang lagi hits di berbagai negara');
  out += '<div class="lib-h">Playlist</div>';
  out += lib('data-newpl', ICON.plus, false, 'Bikin playlist baru', 'Kumpulin lagu andalanmu');
  out += lib('data-import', ICON.download, false, 'Impor playlist', 'Pakai kode atau QR dari device lain');
  out += state.playlists.map((p) => lib(`data-pl="${p.id}"`, ICON.list, false, esc(p.name), `${p.tracks.length} lagu`)).join('');
  out += '<div class="lib-h">Artis favorit</div>';
  out += lib('data-manageart', ICON.plus, false, 'Tambah / atur artis', 'Follow artis favoritmu');
  out += state.artists.length
    ? state.artists.map((a) => lib(`data-artist="${esc(a.name)}"`, ICON.user, false, esc(a.name), 'Cari lagu artis ini')).join('')
    : '';
  return out + '</div>';
}

const VIEW_TITLES = { liked: 'Liked Songs', recent: 'Baru diputar', chartID: 'Tangga Lagu Indonesia', chartGLOBAL: 'Tangga Lagu Global' };

function viewHTML() {
  const ctx = state.view.ctx;
  if (ctx.startsWith('artist:')) return artistViewHTML(ctx.slice(7));
  const isPl = ctx.startsWith('pl:');
  const pl = isPl ? state.playlists.find((p) => p.id === ctx.slice(3)) : null;
  if (isPl && !pl) { state.view = null; return state.tab === 'library' ? libraryHTML() : homeHTML(); }
  const tracks = ctxTracks(ctx), title = isPl ? esc(pl.name) : VIEW_TITLES[ctx];
  const isChart = ctx.startsWith('chart');
  let body;
  if (isChart && !tracks.length) body = state.charts.err[ctx.slice(5)] ? `<div class="empty">${esc(state.charts.err[ctx.slice(5)])}</div>` : '<div class="skeleton"></div>'.repeat(6);
  else if (!tracks.length) body = `<div class="empty"><b>Masih kosong nih</b>${isPl ? 'Cari lagu dulu, terus masukin lewat menu titik tiga di lagunya.' : 'Belum ada isinya.'}${isPl ? '<br><button class="pill big" data-nav data-focussearch style="margin-top:1rem">' + ICON.search + '<span>Cari lagu</span></button>' : ''}</div>`;
  else body = tracks.map((t, i) => rowHTML(t, i, ctx, isChart)).join('');
  const n = tracks.length;
  const kind = isPl ? 'Playlist' : ctx === 'liked' ? 'Lagu yang kamu sukai' : ctx === 'recent' ? 'Riwayat' : 'Tangga lagu';
  const uniq = []; for (const t of tracks) { if (!uniq.includes(t.id) && uniq.length < 4) uniq.push(t.id); }
  const byId = (id) => tracks.find((t) => t.id === id);
  let cover;
  if (uniq.length >= 4) cover = `<div class="vcover grid">${uniq.map((id) => `<img src="${imgOf(byId(id))}" alt="">`).join('')}</div>`;
  else if (uniq.length) cover = `<div class="vcover"><img src="${imgOf(byId(uniq[0]))}" alt=""></div>`;
  else cover = `<div class="vcover g">${ctx === 'liked' ? ICON.heart : ctx === 'recent' ? ICON.clock : ICON.list}</div>`;
  const canShare = n && (isPl || ctx === 'liked');
  return `<div class="vhero">
    ${cover}
    <div class="vinfo">
      <small class="vkind">${kind}</small>
      <h2>${title}</h2>
      <p class="vsub">${n ? `${n} lagu` : 'Belum ada lagu'}${isPl ? `<button class="vedit" data-nav data-rename aria-label="Ubah nama playlist">${ICON.edit}<span>Ubah nama</span></button>` : ''}</p>
      ${n ? `<div class="vact">
        <button class="pill big" data-nav data-playall="${esc(ctx)}">${ICON.play}<span>Putar</span></button>
        <button class="pill ghost big" data-nav data-shuffleall="${esc(ctx)}">${ICON.shuffle}<span>Acak</span></button>
        ${canShare ? `<button class="round" data-nav data-share="${esc(ctx)}" aria-label="Bagikan">${ICON.share}</button>` : ''}
        ${isPl ? `<button class="round${state.confirmDel ? ' danger' : ''}" data-nav data-delpl aria-label="Hapus playlist">${ICON.trash}${state.confirmDel ? '<span>Yakin?</span>' : ''}</button>` : ''}
      </div>` : (isPl ? `<div class="vact"><button class="round${state.confirmDel ? ' danger' : ''}" data-nav data-delpl aria-label="Hapus playlist">${ICON.trash}${state.confirmDel ? '<span>Yakin?</span>' : ''}</button></div>` : '')}
    </div>
  </div><div class="tracks">${body}</div>`;
}

let lastRoute = '';
const scrollPos = {};   // posisi gulir terakhir tiap halaman, supaya kembali tidak mulai dari atas lagi
function render() {
  const el = $('#list');
  const route = state.tab + '|' + (state.view ? state.view.ctx : '');
  const routeChanged = route !== lastRoute;
  if (routeChanged) {
    if (lastRoute) scrollPos[lastRoute] = el.scrollTop;
    lastRoute = route; el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter');
  }
  document.querySelectorAll('.tabs button[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === state.tab));

  // jaga posisi geser carousel dan fokus (penting untuk remote TV)
  const scrolls = [...el.querySelectorAll('.hscroll')].map((h) => h.scrollLeft);
  const f = el.contains(document.activeElement) ? document.activeElement.closest('[data-nav]') : null;
  const fKey = f ? { play: f.dataset.play, i: f.dataset.i, sel: ['data-open', 'data-share', 'data-import', 'data-charttab', 'data-focussearch', 'data-pl', 'data-artist', 'data-manageart', 'data-followart', 'data-newpl', 'data-resume', 'data-back', 'data-playall', 'data-shuffleall', 'data-rename', 'data-delpl'].find((a) => f.hasAttribute(a)) } : null;
  const fVal = fKey && fKey.sel ? f.getAttribute(fKey.sel) : null;

  el.innerHTML = state.view ? viewHTML() : state.tab === 'home' ? homeHTML() : state.tab === 'library' ? libraryHTML() : searchHTML();

  el.querySelectorAll('.hscroll').forEach((h, i) => { h.scrollLeft = scrolls[i] || 0; });
  if (routeChanged) el.scrollTop = scrollPos[route] || 0;
  if (state.tab === 'search' && state.sMode === 'results' && !state.view && (state.genre || state.q) && !$('#q').value && document.activeElement !== $('#q')) { $('#q').value = state.genre || state.q; $('#qClear').hidden = false; }
  renderNavbar();
  navSync();
  if (fKey) {
    let t = null;
    if (fKey.play != null) t = el.querySelector(`[data-play="${CSS.escape(fKey.play)}"][data-i="${fKey.i}"]`);
    else if (fKey.sel) t = el.querySelector(`[${fKey.sel}${fVal ? `="${CSS.escape(fVal)}"` : ''}]`);
    t?.focus({ preventScroll: true });
  }
}

/* bar navigasi di atas kolom cari: tombol kembali + judul halaman dalam / hasil pencarian */
function renderNavbar() {
  const nb = $('#navbar'); let html = '';
  if (state.view) {
    const ctx = state.view.ctx, pl = ctx.startsWith('pl:') ? state.playlists.find((p) => p.id === ctx.slice(3)) : null;
    const isArt = ctx.startsWith('artist:');
    const kind = isArt ? 'Artis' : pl ? 'Playlist' : ctx === 'liked' ? 'Koleksi' : ctx === 'recent' ? 'Riwayat' : 'Tangga lagu';
    html = `<button class="icon-btn" data-nav data-back aria-label="Kembali">${ICON.back}</button><div class="nt"><small>${kind}</small><b>${esc(isArt ? ctx.slice(7) : pl ? pl.name : VIEW_TITLES[ctx] || '')}</b></div>`;
  } else if (state.tab === 'search' && state.sMode === 'results') {
    const title = state.genre || (state.q && !/^https?:/i.test(state.q) ? state.q : 'Hasil pencarian');
    html = `<button class="icon-btn" data-nav data-sback aria-label="Kembali ke pilihan genre">${ICON.back}</button><div class="nt"><small>${state.genre ? 'Genre' : 'Hasil pencarian'}</small><b>${esc(title)}</b></div>`;
  }
  const had = !nb.hidden;
  nb.innerHTML = html; nb.hidden = !html;
  if (html && !had) { nb.classList.remove('in'); void nb.offsetWidth; nb.classList.add('in'); }
}
$('#navbar').addEventListener('click', (e) => {
  if (e.target.closest('[data-back]')) closeView();
  else if (e.target.closest('[data-sback]')) searchBack();
});

function markPlaying() {
  const id = current()?.id;
  document.querySelectorAll('#list [data-id]').forEach((n) => {
    const on = n.dataset.id === id;
    n.classList.toggle('playing', on);
    const host = n.querySelector('.thumb, .cover');
    const has = host && host.querySelector('.eqb');
    if (host && on && !has) host.insertAdjacentHTML('beforeend', '<span class="eqb" aria-hidden="true"><i></i><i></i><i></i></span>');
    else if (host && !on && has) has.remove();
  });
}

function renderUpnext() {
  const el = $('#upnext'), t = current();
  if (!t) { el.innerHTML = ''; return; }
  const q = state.queue, next = [];
  for (let i = state.idx + 1; i < q.length && next.length < 8; i++) next.push(i);
  if (!next.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<h3>Berikutnya${state.shuffle ? ' <small>(lagi mode acak)</small>' : ''}</h3>` + next.map((i) =>
    `<div class="up" data-nav tabindex="0" role="button" data-upi="${i}" aria-label="Putar ${esc(q[i].title)}"><img src="${imgOf(q[i])}" alt="" loading="lazy"><span class="meta"><b>${esc(q[i].title)}</b><small>${esc(q[i].artist)}</small></span></div>`).join('');
}

function renderPeek() {
  const b = $('#nextPeek'), q = state.queue, n = q[state.idx + 1];
  if (!n || state.shuffle) { b.hidden = true; return; }
  b.hidden = false; b.dataset.upi = state.idx + 1;
  b.innerHTML = `<img src="${imgOf(n)}" alt=""><span><small>Berikutnya</small><b>${esc(n.title)}</b><i>${esc(n.artist)}</i></span>${ICON.next}`;
}
function renderPlayer() {
  const t = current();
  $('#mini').hidden = !t;
  $('#player').classList.toggle('idle', !t);
  renderUpnext(); renderQBadge();
  if (!t) return;
  $('#title').textContent = t.title;
  $('#artist').textContent = t.artist;
  $('#miniTitle').textContent = t.title;
  $('#miniArtist').textContent = t.artist;
  $('#miniArt').src = t.thumb || thumb(t.id);
  $('#player').style.setProperty('--art', `url("${(t.thumb || thumb(t.id)).replace(/"/g, '')}")`);
  renderPeek();
  $('#mini').style.setProperty('--art', `url("${(t.thumb || thumb(t.id)).replace(/"/g, '')}")`);
  $('#pbg i').style.backgroundImage = `url("${(t.thumb || thumb(t.id)).replace(/"/g, '')}")`;
  $('#favBtn').classList.toggle('on', isFav(t.id));
  document.title = `${t.title} · Nada`;
}

function renderControls() {
  const ic = state.playing ? ICON.pause : ICON.play;
  document.documentElement.classList.toggle('is-playing', !!state.playing);
  $('#play').innerHTML = ic; $('#miniPlay').innerHTML = ic;
  $('#prev').innerHTML = ICON.prev; $('#next').innerHTML = ICON.next; $('#miniNext').innerHTML = ICON.next;
  $('#shuffle').classList.toggle('on', state.shuffle);
  $('#repeat').classList.toggle('on', state.repeat !== 'off');
  $('#repeat').classList.toggle('one', state.repeat === 'one');
}

/* ---------- navigasi ---------- */
function setTab(tab) {
  // tap tab yang sedang aktif: tutup halaman dalam, atau gulir ke atas
  if (tab === state.tab) {
    if (state.view) { closeView(); return; }
    if (state.tab === 'search' && state.sMode === 'results') { searchBack(); return; }
    if (tab === 'search' && state.sMode === 'results') { searchBack(); return; }
    if ($('#list').scrollTop > 4) { $('#list').scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (tab === 'search') $('#q').focus();
    return;
  }
  if (tab === 'search') { state.sMode = 'home'; state.genre = ''; state._gq = ''; $('#q').value = ''; $('#qClear').hidden = true; }
  state.tab = tab; state.view = null; state.confirmDel = false;
  store.set('tab', tab);
  render();
  if (tab === 'home' || tab === 'library') loadCharts();
}
function openView(ctx) {
  state.view = { ctx }; state.confirmDel = false;
  delete scrollPos[state.tab + '|' + ctx];
  render(); $('#list').scrollTop = 0;
  if (ctx.startsWith('chart')) loadCharts();
}
function searchBack() {
  state.sMode = 'home'; state.genre = ''; state._gq = ''; state.loading = false; state.error = '';
  $('#q').value = ''; $('#qClear').hidden = true; hideSuggest();
  render(); $('#list').scrollTop = 0;
}
function closeView() { state.view = null; state.confirmDel = false; render(); }

/* Tombol kembali bawaan HP / browser: tutup lapisan paling atas (menu, pemutar, lalu halaman dalam)
   alih-alih langsung keluar dari aplikasi. */
let navPushed = 0, navSilent = false;
const navLayers = () => {
  const full = document.documentElement.dataset.layout !== 'desktop' && !document.documentElement.classList.contains('tv');
  return (!$('#menu').hidden ? 1 : 0) + (!$('#queueSheet').hidden ? 1 : 0) + (full && $('#player').classList.contains('open') ? 1 : 0) + (state.view ? 1 : 0) + (state.tab === 'search' && state.sMode === 'results' ? 1 : 0) + (state.tab !== 'home' ? 1 : 0);
};
function navSync() {
  const n = navLayers();
  try {
    if (n > navPushed) { for (let i = navPushed; i < n; i++) history.pushState({ nada: i + 1 }, ''); navPushed = n; }
    else if (n < navPushed) { const d = navPushed - n; navPushed = n; navSilent = true; history.go(-d); setTimeout(() => { navSilent = false; }, 400); }
  } catch {}
}
window.addEventListener('popstate', () => {
  if (navSilent) { navSilent = false; return; }
  if (navPushed > 0) navPushed--;
  if (!$('#menu').hidden) closeMenu();
  else if (!$('#queueSheet').hidden) closeQueue();
  else if ($('#player').classList.contains('open') && document.documentElement.dataset.layout !== 'desktop') $('#player').classList.remove('open');
  else if (state.view) closeView();
  else if (state.tab === 'search' && state.sMode === 'results') searchBack();
  else if (state.tab !== 'home') setTab('home');
});
new MutationObserver(navSync).observe($('#player'), { attributes: true, attributeFilter: ['class'] });
new MutationObserver(navSync).observe($('#queueSheet'), { attributes: true, attributeFilter: ['hidden'] });
new MutationObserver(navSync).observe($('#menu'), { attributes: true, attributeFilter: ['hidden'] });

/* geser dari tepi kiri layar = kembali (iPhone standalone tidak punya gesture ini) */
(function () {
  let g = null;
  window.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    g = t.clientX < 22 && (state.view || (state.tab === 'search' && state.sMode === 'results') || (!$('#menu').hidden)) ? { x: t.clientX, y: t.clientY } : null;
  }, { passive: true });
  window.addEventListener('touchend', (e) => {
    if (!g) return; const t = e.changedTouches[0], dx = t.clientX - g.x, dy = Math.abs(t.clientY - g.y); g = null;
    if (dx > 70 && dy < 60) { if (!$('#menu').hidden) closeMenu(); else if (state.view) closeView(); else if (state.tab === 'search' && state.sMode === 'results') searchBack(); }
  }, { passive: true });
})();

/* header: baris logo menyusut saat gulir ke bawah, muncul lagi saat gulir ke atas; kolom cari tetap */
(function () {
  const top = document.querySelector('header.top'), list = $('#list'); let last = 0, tick = false;
  list.addEventListener('scroll', () => {
    if (tick) return; tick = true;
    requestAnimationFrame(() => {
      tick = false;
      const y = list.scrollTop, d = y - last;
      top.classList.toggle('lifted', y > 4);
      last = y;
    });
  }, { passive: true });
})();

/* bar atas halaman dalam: judul muncul saat digulir */
$('#list').addEventListener('scroll', () => {
  const v = $('#list .vtop'); if (v) v.classList.toggle('solid', $('#list').scrollTop > 140);
}, { passive: true });

/* ---------- tangga lagu ---------- */
function loadCharts() {
  for (const key of ['ID', 'GLOBAL']) {
    if (state.charts[key]) continue;
    let cached = null;
    cached = apiCache.get('chart' + key, 3 * 3600e3);
    if (cached) { state.charts[key] = cached; continue; }
    state.charts.err[key] = '';
    fetch(`/api/charts?region=${key}`)
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) throw new Error(d.error || 'Yah, tangga lagunya gagal dimuat.');
        state.charts[key] = d.items || [];
        if (state.charts[key].length) apiCache.set('chart' + key, state.charts[key]);
      })
      .catch((e) => { const old = apiCache.stale('chart' + key); if (old) state.charts[key] = old; else state.charts.err[key] = e.message || 'Yah, tangga lagunya gagal dimuat.'; })
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
  if (q !== state._gq) state.genre = '';
  state.sMode = 'results';
  state.tab = 'search'; state.view = null; state.q = q; state.error = ''; state.loading = true;
  store.set('tab', 'search'); hideSuggest(); render();
  if (!/^https?:\/\//i.test(q)) pushHistory(q);
  try {
    const id = /^https?:\/\//i.test(q) ? parseVideoId(q) : null;
    if (id) {
      const r = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent('https://www.youtube.com/watch?v=' + id)}&format=json`);
      if (!r.ok) throw new Error('Link-nya nggak bisa dibuka, atau pemiliknya nggak ngizinin diputar di luar YouTube.');
      const d = await r.json();
      state.results = [{ id, title: d.title, artist: d.author_name.replace(/ - Topic$/, ''), thumb: thumb(id) }];
    } else {
      const d = await searchApi(q);
      state.results = d.items;
      if (!d.items.length) {
        state.error = state.official
          ? `Nggak nemu musik resmi buat "${q}". Coba kata kunci lain, atau matiin filter Resmi.`
          : 'Yah, nggak ketemu. Coba kata kunci lain deh.';
      }
    }
    store.set('lastResults', state.results);
    state.results.forEach(backfillArtist);
  } catch (e) {
    state.error = e.message || 'Ada yang error nih, coba lagi ya.';
  }
  state.loading = false; render();
  if (state.tv) $('#list .row')?.focus();
}

function runSearch(text) { $('#q').value = text; $('#qClear').hidden = !text; search(text); }

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
  if (!name || isFollowing(name)) { if (name) toast(`${name} udah kamu follow`); return false; }
  state.artists = [{ name, thumb: thumbUrl }, ...state.artists];
  store.set('artists', state.artists);
  toast(`Sekarang kamu follow ${name}`);
  return true;
}
function unfollowArtist(name) {
  state.artists = state.artists.filter((a) => lc(a.name) !== lc(name));
  store.set('artists', state.artists);
  toast(`Unfollow ${name}`);
}

function toggleArtist(t) {
  if (isFollowing(t.artist)) {
    state.artists = state.artists.filter((a) => lc(a.name) !== lc(t.artist));
    toast(`Unfollow ${t.artist}`);
  } else {
    state.artists = [{ name: t.artist, thumb: t.thumb || thumb(t.id) }, ...state.artists];
    toast(`Sekarang kamu follow ${t.artist}`);
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
  if (p.tracks.some((x) => x.id === t.id)) { toast(`Udah ada di ${p.name}`); return; }
  p.tracks.push(slim(t));
  store.set('playlists', state.playlists);
  toast(`Masuk ke ${p.name}`);
}

let mctx = null;
const act = (a, ico, label, on, extra = '') => `<button class="act${on ? ' on' : ''}${a === 'like' ? ' fill' : ''}" data-act="${a}" ${extra}>${ico}<span>${esc(label)}</span></button>`;
const newPlForm = '<form id="plForm"><input id="plName" type="text" maxlength="40" placeholder="Nama playlist baru" aria-label="Nama playlist" autocomplete="off" enterkeyhint="done"><button class="pill" type="submit" id="plGo" disabled>Buat</button></form>';

function openMenu(track, ctx, mode) {
  mctx = { track, ctx, mode: mode || (track ? 'main' : 'newpl') };
  renderMenu();
  $('#menu').hidden = false;
  (mctx.mode === 'newpl' ? $('#plName') : mctx.mode === 'artists' ? $('#artName') : mctx.mode === 'import' ? $('#impCode') : $('#menuBody button'))?.focus();
}
function closeMenu() { stopScan(); $('#menu').hidden = true; mctx = null; }

function renderMenu() {
  const { track, ctx, mode } = mctx;
  if (mode !== 'scan') stopScan();
  $('#menuHead').hidden = !track;
  if (track) { $('#menuArt').src = track.thumb || thumb(track.id); $('#menuTitle').textContent = track.title; $('#menuSub').textContent = track.artist; }
  let h = '';
  if (mode === 'main') {
    h += act('like', ICON.heart, isFav(track.id) ? 'Hapus dari Liked Songs' : 'Tambah ke Liked Songs', isFav(track.id));
    h += act('playnext', ICON.qnext, 'Putar berikutnya');
    h += act('queueadd', ICON.qadd, 'Tambah ke antrean');
    h += act('toplaylist', ICON.list, 'Tambah ke playlist');
    h += act('follow', ICON.user, isFollowing(track.artist) ? `Unfollow ${track.artist}` : `Follow ${track.artist}`, isFollowing(track.artist));
    h += act('artistsearch', ICON.user, `Lihat halaman ${firstArtist(track.artist)}`);
    if (!document.documentElement.classList.contains('tv')) h += act('story', ICON.story, 'Bagikan ke Story');
    if (ctx && ctx.startsWith('pl:')) h += act('rmpl', ICON.trash, 'Hapus dari playlist ini');
    h += act('close', ICON.back, 'Tutup');
  } else if (mode === 'sleep') {
    const S = state.sleep;
    h += '<div class="sub">Timer tidur</div>';
    if (S) h += `<p class="share-note">${S.mode === 'end' ? 'Musik berhenti setelah lagu ini selesai.' : 'Musik berhenti ' + fmt(Math.max(0, (S.at - Date.now()) / 1000)) + ' lagi.'}</p>`;
    h += [15, 30, 45, 60].map((m) => act('sleepset', ICON.clock, `${m} menit`, S && S.mode === 'time' && Math.round((S.at - S.set) / 60000) === m, `data-v="${m}"`)).join('');
    h += act('sleepset', ICON.clock, 'Sampai lagu ini selesai', S && S.mode === 'end', 'data-v="end"');
    if (S) h += act('sleepset', ICON.trash, 'Matikan timer', false, 'data-v="off"');
    h += act('close', ICON.back, 'Tutup');
  } else if (mode === 'pl') {
    h += '<div class="sub">Pilih playlist</div>';
    h += state.playlists.map((p) => act('addpl', ICON.list, p.name, p.tracks.some((x) => x.id === track.id), `data-pid="${p.id}"`)).join('');
    h += newPlForm + act('backmain', ICON.back, 'Kembali');
  } else if (mode === 'artists') {
    h += '<div class="sub">Tambah artis favorit</div><form id="artForm"><input id="artName" type="text" maxlength="40" placeholder="Nama artis" aria-label="Nama artis"><button class="pill" type="submit">Tambah</button></form>';
    const sug = STARTER_ARTISTS.filter((n) => !isFollowing(n)).slice(0, 8);
    if (sug.length) h += '<div class="sub">Rekomendasi</div>' + sug.map((n) => act('addart', ICON.plus, n, false, `data-name="${esc(n)}"`)).join('');
    if (state.artists.length) h += '<div class="sub">Yang kamu follow (tap buat unfollow)</div>' + state.artists.map((a) => act('delart', ICON.trash, a.name, true, `data-name="${esc(a.name)}"`)).join('');
    h += act('close', ICON.back, 'Selesai');
  } else if (mode === 'share') {
    const S = mctx.share;
    h += `<div class="sub">Bagikan "${esc(S.name)}" · ${S.count} lagu</div>`;
    if (S.status === 'loading') h += '<p class="share-note">Membuat kode…</p>';
    else {
      if (S.qr) h += `<div class="share-qr">${S.qr}</div>`;
      if (S.code) h += `<div class="share-code" aria-label="Kode ${esc(S.code)}">${esc(S.code)}</div><p class="share-note">Scan QR pakai kamera HP, atau ketik kode ini lewat menu Impor di Nada. Aktif 30 hari.</p>`;
      else h += `<div class="share-long" tabindex="0" aria-label="Kode panjang">${esc(S.payload)}</div><p class="share-note">${S.long ? 'Playlist ini kepanjangan buat QR. ' : 'Scan QR pakai kamera HP, atau salin kode di atas terus tempel lewat menu Impor. '}${S.nostore ? 'Kode pendek 6 karakter (enak buat diketik di TV) belum aktif, perlu Redis disambungkan di Vercel dulu.' : ''}</p>`;
      h += act('copycode', ICON.list, S.code ? 'Salin kode' : 'Salin kode panjang') + act('copylink', ICON.share, 'Salin tautan');
      if (navigator.share) h += act('nativeshare', ICON.share, 'Bagikan lewat…');
    }
    h += act('close', ICON.back, 'Selesai');
  } else if (mode === 'import') {
    h += '<div class="sub">Impor playlist</div>';
    if (canScan() && !mctx.busy) h += act('scan', ICON.scan, 'Scan QR pakai kamera');
    if (mctx.busy) h += '<p class="share-note">Lagi ngambil playlist…</p>';
    else {
      h += '<form id="impForm"><input id="impCode" type="text" maxlength="2000" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="Kode 6 karakter atau tautan" aria-label="Kode playlist"><button class="pill" type="submit">Cari</button></form>';
      h += '<p class="share-note">Ketik kode dari device lain, atau tempel link yang dibagiin. Di HP, scan QR pakai kamera bawaan juga bisa.</p>';
      if (mctx.err) h += `<p class="share-note err">${esc(mctx.err)}</p>`;
    }
    h += act('close', ICON.back, 'Tutup');
  } else if (mode === 'scan') {
    h += '<div class="sub">Scan kode QR</div>';
    h += '<div class="scan-box"><video id="scanVideo" playsinline muted></video></div>';
    h += `<p class="share-note${mctx.scanErr ? ' err' : ''}" id="scanNote">${esc(mctx.scanErr || 'Arahkan kamera ke QR playlist Nada ya.')}</p>`;
    h += act('toimport', ICON.list, 'Ketik kode manual') + act('close', ICON.back, 'Batal');
  } else if (mode === 'preview') {
    const P = mctx.preview;
    h += '<div class="sub">Playlist ketemu!</div>';
    h += `<form id="impSave"><input id="impName" type="text" maxlength="40" value="${esc(P.name)}" aria-label="Nama playlist"><button class="pill" type="submit">Simpan</button></form>`;
    h += `<p class="share-note">${P.tracks.length} lagu: ${esc(P.tracks.slice(0, 3).map((t) => t.title).join(', '))}${P.tracks.length > 3 ? ', …' : ''}</p>`;
    h += act('toimport', ICON.back, 'Kembali') + act('close', ICON.back, 'Batal');
  } else {
    const tile = (a, ico, t, d) => `<button class="np-tile" data-act="${a}">${ico}<b>${t}</b><small>${d}</small></button>`;
    h += `<div class="np-head"><span class="np-ico">${ICON.plus}</span><div><b>Playlist baru</b><small>Kasih nama dulu, lagunya nanti kamu masukin lewat menu titik tiga.</small></div></div>`;
    h += newPlForm;
    h += '<div class="np-chips" role="group" aria-label="Saran nama">' + ['Galau', 'Santai', 'Semangat', 'Road Trip', 'Fokus'].map((n) => `<button type="button" class="np-chip" data-act="plname" data-v="${n}">${n}</button>`).join('') + '</div>';
    h += '<div class="np-or"><span>atau impor dari device lain</span></div>';
    h += '<div class="np-tiles">' + (canScan() ? tile('scan', ICON.scan, 'Scan QR', 'Arahkan kamera') : '') + tile('toimport', ICON.download, 'Ketik kode', '6 karakter') + '</div>';
    h += act('close', ICON.back, 'Tutup');
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
  let m = text.match(/[#?&](?:c|code)=([A-Za-z0-9-]{6,7})(?![A-Za-z0-9-])/);
  if (m) return { code: m[1].replace(/-/g, '').toUpperCase() };
  m = text.match(/[#?&]share=([\w-]+)/); if (m) return { payload: m[1] };
  m = text.match(/^NADA1\.([\w-]+)$/); if (m) return { payload: m[1] };
  const c = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (/^[A-Z2-9]{6}$/.test(c)) return { code: c };
  return null;
}

async function resolveShare(text) {
  const p = parseShareInput(text);
  if (!p) throw new Error('Kodenya nggak dikenali. Cek lagi atau tempel link-nya.');
  if (p.code) {
    const r = await fetch('/api/share?code=' + encodeURIComponent(p.code));
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Kodenya nggak ketemu.');
    return { name: d.name || 'Playlist', tracks: (d.tracks || []).map((t) => ({ id: t.id, title: t.title, artist: t.artist, thumb: thumb(t.id) })) };
  }
  let o; try { o = JSON.parse(b64u.dec(p.payload)); } catch { throw new Error('Kodenya rusak atau kepotong. Salin ulang dari awal ya.'); }
  const ids = String(o.i || '').match(/[\w-]{11}/g) || [];
  if (!ids.length) throw new Error('Playlist ini kosong, nggak ada yang bisa diimpor.');
  const tracks = [];
  for (let i = 0; i < ids.length; i += 50) {
    const r = await fetch('/api/videos?ids=' + ids.slice(i, i + 50).join(','));
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Data lagunya gagal dimuat.');
    (d.items || []).forEach((t) => tracks.push({ id: t.id, title: t.title, artist: t.artist, thumb: thumb(t.id) }));
  }
  if (!tracks.length) throw new Error('Lagu di playlist ini nggak ketemu.');
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
    my.busy = false; my.mode = 'import'; my.err = e.message || 'Gagal memuat, coba lagi ya.'; renderMenu();
    $('#impCode')?.focus();
  }
}

async function openShare(ctx) {
  const tracks = ctxTracks(ctx);
  if (!tracks.length) { toast('Playlistnya masih kosong'); return; }
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


/* ---------- Scan QR dengan kamera ---------- */
let scanStream = null, scanRaf = 0, scanBusy = false, scanLast = '', scanLastAt = 0;
const canScan = () => !state.tv && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

function stopScan() {
  cancelAnimationFrame(scanRaf); scanRaf = 0;
  if (scanStream) { scanStream.getTracks().forEach((t) => t.stop()); scanStream = null; }
  const v = $('#scanVideo'); if (v) { try { v.pause(); } catch {} v.srcObject = null; }
}

function loadJsQR() {
  if (window.jsQR) return Promise.resolve(window.jsQR);
  return new Promise((res, rej) => {
    const el = document.createElement('script'); el.src = '/jsqr.js';
    el.onload = () => (window.jsQR ? res(window.jsQR) : rej(new Error('jsQR')));
    el.onerror = () => rej(new Error('jsQR'));
    document.head.appendChild(el);
  });
}

async function startScan() {
  const my = mctx; if (!my) return;
  my.mode = 'scan'; my.scanErr = ''; renderMenu();
  $('#menuBody button')?.focus();
  const fail = (msg) => { if (mctx !== my) return; my.scanErr = msg; const n = $('#scanNote'); if (n) { n.textContent = msg; n.classList.add('err'); } };
  try {
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
  } catch (e) {
    fail(e && e.name === 'NotAllowedError' ? 'Izin kameranya ditolak nih. Aktifin dulu di pengaturan, atau ketik kodenya aja.' : 'Kameranya nggak bisa dipakai. Ketik kodenya manual aja ya.');
    return;
  }
  if (mctx !== my || my.mode !== 'scan') { stopScan(); return; }
  const video = $('#scanVideo'); video.srcObject = scanStream;
  try { await video.play(); } catch {}
  let detector = null;
  if ('BarcodeDetector' in window) { try { detector = new BarcodeDetector({ formats: ['qr_code'] }); } catch {} }
  let jsqr = null;
  if (!detector) { try { jsqr = await loadJsQR(); } catch { fail('Scanner-nya gagal dimuat. Ketik kodenya manual aja ya.'); stopScan(); return; } }
  const canvas = document.createElement('canvas'), cx = canvas.getContext('2d', { willReadFrequently: true });
  let lastTick = 0;
  const tick = async (ts) => {
    if (!scanStream || mctx !== my || my.mode !== 'scan') return;
    scanRaf = requestAnimationFrame(tick);
    if (ts - lastTick < 140 || scanBusy || video.readyState < 2 || !video.videoWidth) return;
    lastTick = ts; scanBusy = true;
    try {
      let text = '';
      if (detector) {
        const r = await detector.detect(video); text = r && r[0] ? r[0].rawValue : '';
      } else {
        const w = Math.min(video.videoWidth, 720), h = Math.round(video.videoHeight * (w / video.videoWidth));
        canvas.width = w; canvas.height = h; cx.drawImage(video, 0, 0, w, h);
        const img = cx.getImageData(0, 0, w, h), r = jsqr(img.data, w, h, { inversionAttempts: 'dontInvert' });
        text = r ? r.data : '';
      }
      if (text && mctx === my && my.mode === 'scan') {
        if (parseShareInput(text)) {
          stopScan(); if (navigator.vibrate) { try { navigator.vibrate(60); } catch {} }
          my.mode = 'import'; importFrom(text);
        } else if (text !== scanLast || Date.now() - scanLastAt > 3000) {
          scanLast = text; scanLastAt = Date.now();
          const n = $('#scanNote'); if (n) { n.textContent = 'Ini bukan QR playlist Nada. Coba QR yang lain.'; n.classList.add('err'); }
        }
      }
    } catch {} finally { scanBusy = false; }
  };
  scanRaf = requestAnimationFrame(tick);
}
document.addEventListener('visibilitychange', () => { if (document.hidden && mctx && mctx.mode === 'scan') { stopScan(); mctx.scanErr = 'Scan berhenti karena kamu keluar dari aplikasi.'; renderMenu(); } });

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
  if (a === 'plname') { const i = $('#plName'); i.value = b.dataset.v; i.dispatchEvent(new Event('input', { bubbles: true })); i.focus(); return; }
  if (a === 'close') { closeMenu(); render(); }
  else if (a === 'addart') { followArtist(b.dataset.name); renderMenu(); render(); $('#menuBody .act')?.focus(); }
  else if (a === 'delart') { unfollowArtist(b.dataset.name); renderMenu(); render(); $('#menuBody .act')?.focus(); }
  else if (a === 'copycode') { const S = mctx.share; copyText(S.code || S.payload, S.code ? 'Kode udah disalin' : 'Kode panjang udah disalin'); }
  else if (a === 'copylink') { copyText(mctx.share.link, 'Link udah disalin'); }
  else if (a === 'nativeshare') { const S = mctx.share; navigator.share({ title: `Playlist ${S.name} di Nada`, text: `Playlist "${S.name}" (${S.count} lagu) di Nada`, url: S.link }).catch(() => {}); }
  else if (a === 'scan') { startScan(); }
  else if (a === 'story') {
    const tr = mctx.track, cur = current(); let pos = {};
    try { if (cur && cur.id === tr.id && yt && yt.getDuration) pos = { cur: yt.getCurrentTime(), dur: yt.getDuration() }; } catch {}
    closeMenu(); window.NadaStory.open(tr, pos);
  }
  else if (a === 'toimport') { mctx.mode = 'import'; mctx.err = ''; renderMenu(); $('#impCode')?.focus(); }
  else if (a === 'like') { toggleFav(track); closeMenu(); }
  else if (a === 'toplaylist') { mctx.mode = 'pl'; renderMenu(); $('#menuBody button')?.focus(); }
  else if (a === 'backmain') { mctx.mode = 'main'; renderMenu(); $('#menuBody button')?.focus(); }
  else if (a === 'addpl') { addToPlaylist(b.dataset.pid, track); closeMenu(); render(); }
  else if (a === 'follow') { toggleArtist(track); closeMenu(); render(); }
  else if (a === 'artistsearch') { closeMenu(); openArtist(track.artist); }
  else if (a === 'playnext') { closeMenu(); playNext(track); }
  else if (a === 'queueadd') { closeMenu(); addToQueue(track); }
  else if (a === 'sleepset') { closeMenu(); setSleep(b.dataset.v === 'end' || b.dataset.v === 'off' ? b.dataset.v : +b.dataset.v); }
  else if (a === 'rmpl') {
    const p = state.playlists.find((x) => x.id === ctx.slice(3));
    if (p) { p.tracks = p.tracks.filter((x) => x.id !== track.id); store.set('playlists', state.playlists); toast('Udah dihapus dari playlist'); }
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
    toast(`Playlist "${nm}" udah tersimpan (${p.tracks.length} lagu)`);
    closeMenu(); state.tab = 'home'; store.set('tab', 'home'); openView('pl:' + p.id);
    return;
  }
  const name = $('#plName').value.trim();
  if (!name) return;
  const p = { id: uid(), name, tracks: [] };
  state.playlists.push(p);
  if (mctx && mctx.track) p.tracks.push(slim(mctx.track));
  store.set('playlists', state.playlists);
  toast(mctx && mctx.track ? `Playlist "${name}" jadi, lagunya udah masuk` : `Playlist "${name}" jadi!`);
  const fromHome = !(mctx && mctx.track);
  closeMenu();
  if (fromHome) openView('pl:' + p.id); else render();
});

document.addEventListener('input', (e) => { if (e.target.id === 'plName') { const g = $('#plGo'); if (g) g.disabled = !e.target.value.trim(); } });

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
        toast('Lagu ini nggak bisa diputar di luar YouTube, skip ke yang berikutnya…');
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

function playList(list, i) { state.queue = list.slice(); state.idx = i; state.userQ = 0; load(0); }

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
  if (auto && state.sleep && state.sleep.mode === 'end') { sleepFire(); return; }
  if (auto && state.repeat === 'one') { yt.seekTo(0, true); yt.playVideo(); return; }
  if (state.userQ > 0 && state.idx + 1 < n) { state.idx++; state.userQ--; load(0); return; }
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
  state.userQ = Math.min(state.userQ, state.queue.length - state.idx - 1);
  load(0);
}

function resume() {
  const r = state.resume; if (!r || !r.track) return;
  const q = (r.queue && r.queue.length ? r.queue : [r.track]);
  const i = q.findIndex((t) => t.id === r.track.id);
  state.queue = q; state.idx = i >= 0 ? i : 0; state.userQ = 0;
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
let lyrUser = 0, lyrReq = 0, lyrTap = false;
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
    el.innerHTML = `<p class="ly-msg">${L.status === 'err' ? 'Liriknya lagi nggak bisa dimuat.' : 'Lirik lagu ini belum ada nih.'}<br>${L.status === 'err' || L.status === 'none' ? '<button type="button" class="ly-retry" data-lyretry>Coba lagi</button> ' : ''}<a href="${lyrSearchLink(t)}" target="_blank" rel="noopener">Cari di Google</a></p>`;
    return;
  }
  const off = lyrOff(), vdur = ytReady && yt.getDuration ? Math.round(yt.getDuration() || 0) : 0;
  const fmtOff = (v) => (v > 0 ? '+' : '') + String(v).replace('.', ',') + ' dtk';
  let bar = '';
  if (L.synced.length) {
    const d = L.lrcDur && vdur ? vdur - L.lrcDur : 0;
    const hint = !off && Math.abs(d) >= 2 && d > 0 && d <= 45
      ? `<button type="button" class="ly-auto" data-lyauto="${d}">Video ini ${d} dtk lebih panjang dari lagunya. Sesuaikan otomatis?</button>`
      : (L.mismatch ? '<span class="ly-warn">Versi lirik mungkin beda dengan video ini. Kalau meleset, sinkronkan manual.</span>' : '');
    bar = `<div class="ly-bar">${hint}<div class="ly-ctl"><span class="ly-lbl">Sinkron${off ? ' <em>' + fmtOff(off) + '</em>' : ''}</span>`
      + `<button type="button" data-lyoff="-0.5" aria-label="Lirik lebih cepat">−0,5</button><button type="button" data-lyoff="0.5" aria-label="Lirik lebih lambat">+0,5</button>`
      + `<button type="button" class="${lyrTap ? 'on' : ''}" data-lytap>${lyrTap ? 'Tap baris yang lagi dinyanyiin…' : 'Tap buat sinkron'}</button>`
      + `${off ? '<button type="button" data-lyreset>Reset</button>' : ''}</div></div>`;
  }
  const src = `<div class="ly-src"><span>Lirik dari ${esc(L.src || 'LRCLIB')}</span></div>`;
  if (L.synced.length) {
    el.innerHTML = bar + L.synced.map((l, i) => `<p data-ly="${i}" data-t="${l[0]}"${l[1] ? '' : ' class="gap"'}>${l[1] ? esc(l[1]) : '♪'}</p>`).join('') + src;
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
  // durasi video dibutuhkan untuk memilih versi lirik yang tepat; tunggu sampai pemutar melaporkannya
  let dur = 0;
  for (let i = 0; i < 16 && my === lyrReq; i++) {
    dur = ytReady && yt.getDuration ? Math.round(yt.getDuration() || 0) : 0;
    if (dur > 0) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  if (my !== lyrReq) return;
  try {
    const r = await fetch(`/api/lyrics?title=${encodeURIComponent(t.title)}&artist=${encodeURIComponent(t.artist)}${dur ? '&dur=' + dur : ''}`);
    const d = await r.json().catch(() => ({}));
    if (my !== lyrReq) return;
    if (!r.ok) throw new Error(d.error || 'gagal');
    let v;
    if (!d.found) v = { status: 'none', synced: [], plain: '', src: '' };
    else if (d.instrumental) v = { status: 'instrumental', synced: [], plain: '', src: '' };
    else if ((d.synced && d.synced.length) || (d.plain && d.plain.trim())) v = { status: 'ok', synced: d.synced || [], plain: d.plain || '', src: d.source || 'LRCLIB', lrcDur: d.lrcDur || 0, mismatch: !!d.mismatch };
    else v = { status: 'none', synced: [], plain: '', src: '' };
    if (v.status === 'ok') lyrCache.set(t.id, v);
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

/* lirik dicek lebih sering supaya sorotan tidak telat */
setInterval(() => { if (state.pview === 'lyrics' && ytReady && current() && typeof yt.getCurrentTime === 'function') lyricsTick(yt.getCurrentTime() || 0); }, 150);

/* progres */
setInterval(() => {
  if (!ytReady || !current() || typeof yt.getCurrentTime !== 'function') return;
  const cur = yt.getCurrentTime() || 0, dur = yt.getDuration() || 0;
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
$('#q').addEventListener('input', () => { $('#qClear').hidden = !$('#q').value; });
$('#qClear').addEventListener('click', () => { $('#q').value = ''; $('#qClear').hidden = true; if (state.tab === 'search' && state.sMode === 'results') searchBack(); $('#q').focus(); onType(); });
$('#list').addEventListener('scroll', () => document.querySelector('.top').classList.toggle('scrolled', $('#list').scrollTop > 6), { passive: true });
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
  toast(state.official ? 'Cuma musik resmi' : 'Semua hasil, termasuk reupload');
  if (state.q && state.tab === 'search') search(state.q);
});

$('#list').addEventListener('click', (e) => {
  const t = e.target; let el;
  if ((el = t.closest('[data-hs]'))) { const sc = el.parentElement.querySelector('.hscroll'); sc.scrollBy({ left: +el.dataset.hs * sc.clientWidth * 0.8, behavior: 'smooth' }); return; }
  if ((el = t.closest('[data-like]'))) { const [c, i] = splitRef(el.dataset.like); toggleFav(ctxTracks(c)[i]); return; }
  if ((el = t.closest('[data-more]'))) { const [c, i] = splitRef(el.dataset.more); const tr = ctxTracks(c)[i]; if (tr) openMenu(tr, c); return; }
  if ((el = t.closest('[data-play]'))) { playList(ctxTracks(el.dataset.play), +el.dataset.i); return; }
  if ((el = t.closest('[data-playall]'))) { const l = ctxTracks(el.dataset.playall); if (l.length) playList(l, 0); return; }
  if ((el = t.closest('[data-shuffleall]'))) { const l = ctxTracks(el.dataset.shuffleall); if (l.length) { state.shuffle = true; store.set('shuffle', true); playList(l, Math.floor(Math.random() * l.length)); renderControls(); toast('Acak aktif'); } return; }
  if (t.closest('[data-rename]')) {
    const p = state.playlists.find((x) => x.id === state.view.ctx.slice(3));
    const nm = p && prompt('Nama playlist', p.name);
    if (nm && nm.trim()) { p.name = nm.trim().slice(0, 40); store.set('playlists', state.playlists); render(); }
    return;
  }
  if ((el = t.closest('[data-charttab]'))) { state.chartTab = el.dataset.charttab; store.set('chartTab', state.chartTab); render(); return; }
  if (t.closest('[data-focussearch]')) { $('#q').focus(); return; }
  if ((el = t.closest('[data-open]'))) { openView(el.dataset.open); return; }
  if ((el = t.closest('[data-pl]'))) { openView('pl:' + el.dataset.pl); return; }
  if (t.closest('[data-manageart]')) { openMenu(null, null, 'artists'); return; }
  if ((el = t.closest('[data-followart]'))) { const n = el.dataset.followart; if (isFollowing(n)) { unfollowArtist(n); } else followArtist(n, el.closest('.artist')?.querySelector('img')?.src || el.dataset.thumb || ''); render(); return; }
  if ((el = t.closest('[data-artretry]'))) { loadArtist(el.dataset.artretry, true); render(); return; }
  if (t.closest('[data-sback]')) { searchBack(); return; }
  if ((el = t.closest('[data-genre]'))) { runGenre(+el.dataset.genre); return; }
  if ((el = t.closest('[data-q]'))) { runSearch(el.dataset.q); return; }
  if (t.closest('[data-clearhist]')) { state.history = []; store.set('history', []); render(); return; }
  if ((el = t.closest('[data-artist]'))) { openArtist(el.dataset.artist); return; }
  if ((el = t.closest('[data-share]'))) { openShare(el.dataset.share); return; }
  if (t.closest('[data-import]')) { openMenu(null, null, 'import'); return; }
  if (t.closest('[data-newpl]')) { openMenu(null, null, 'newpl'); return; }
  if (t.closest('[data-resume]')) { resume(); return; }
  if (t.closest('[data-back]')) { closeView(); return; }
  if (t.closest('[data-delpl]')) {
    if (!state.confirmDel) { state.confirmDel = true; render(); setTimeout(() => { if (state.confirmDel) { state.confirmDel = false; if (state.view) render(); } }, 4000); return; }
    const id = state.view.ctx.slice(3);
    state.playlists = state.playlists.filter((p) => p.id !== id); store.set('playlists', state.playlists);
    state.confirmDel = false; state.view = null; toast('Playlist udah dihapus'); render();
  }
});

document.querySelectorAll('.tabs button[data-tab]').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));

/* geser kartu mini: kiri = lagu berikutnya, kanan = sebelumnya, atas = buka pemutar */
let miniSw = null, miniSwiped = false;
$('#mini').addEventListener('pointerdown', (e) => { miniSw = { x: e.clientX, y: e.clientY }; miniSwiped = false; });
window.addEventListener('pointerup', (e) => {
  if (!miniSw) return;
  const dx = e.clientX - miniSw.x, dy = e.clientY - miniSw.y; miniSw = null;
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { miniSwiped = true; dx < 0 ? next() : prev(); }
  else if (dy < -40 && Math.abs(dy) > Math.abs(dx)) { miniSwiped = true; $('#player').classList.add('open'); }
});
window.addEventListener('pointercancel', () => { miniSw = null; });
$('#mini').addEventListener('click', (e) => {
  if (miniSwiped) { miniSwiped = false; return; }
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
  const setOff = (v) => {
    const id = current().id; v = Math.round(v * 10) / 10;
    if (v) lyrOffs[id] = v; else delete lyrOffs[id];
    const keys = Object.keys(lyrOffs); if (keys.length > 60) delete lyrOffs[keys[0]];
    store.set('lyrOffs', lyrOffs); const t1 = $('#stage').scrollTop, t2 = $('#lyrics').scrollTop; lyrTap = false; renderLyrics(); $('#stage').scrollTop = t1; $('#lyrics').scrollTop = t2;
  };
  if (e.target.closest('[data-lyretry]')) { state.lyr.status = 'idle'; lyrCache.delete(current().id); ensureLyrics(); return; }
  if (current() && e.target.closest('[data-lyauto]')) { setOff(parseFloat(e.target.closest('[data-lyauto]').dataset.lyauto)); toast('Lirik udah disesuaiin'); return; }
  if (current() && e.target.closest('[data-lyreset]')) { setOff(0); return; }
  if (e.target.closest('[data-lytap]')) { lyrTap = !lyrTap; const t1 = $('#lyrics').scrollTop; renderLyrics(); $('#lyrics').scrollTop = t1; return; }
  const p = e.target.closest('[data-t]'); if (!p || !ytReady) return;
  if (lyrTap && current()) { setOff((yt.getCurrentTime() || 0) - parseFloat(p.dataset.t)); toast('Sinkron! Lirik udah pas'); return; }
  lyrUser = 0; yt.seekTo(parseFloat(p.dataset.t), true);
});
['wheel', 'touchmove'].forEach((ev) => $('#stage').addEventListener(ev, () => { lyrUser = Date.now(); }, { passive: true }));
$('#nextPeek').addEventListener('click', (e) => { state.idx = +e.currentTarget.dataset.upi; load(0); });
/* tarik ke bawah untuk menutup pemutar */
(function () {
  const sh = $('#player'); let d = null;
  const start = (e) => { if (!e.target.closest('.sheet-head, .info, .pview')) return; if (e.target.closest('button')) { d = null; return; } d = { x: e.clientX, y: e.clientY, dy: 0 }; };
  sh.addEventListener('pointerdown', start);
  window.addEventListener('pointermove', (e) => {
    if (!d) return; const dy = e.clientY - d.y, dx = e.clientX - d.x;
    if (Math.abs(dx) > Math.abs(dy) && !d.dy) { d = null; return; }
    d.dy = Math.max(0, dy); sh.style.transition = 'none'; sh.style.transform = `translateY(${d.dy}px)`;
  });
  const end = () => { if (!d) return; const go = d.dy > 110; d = null; sh.style.transition = ''; sh.style.transform = ''; if (go) sh.classList.remove('open'); };
  window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
})();
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
  toast({ off: 'Ulangi: off', all: 'Ulangi semua', one: 'Ulangi satu lagu' }[state.repeat]);
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
  toast(state.tv ? 'Mode TV nyala: pakai tombol panah di remote' : 'Mode TV mati');
});

/* ---------- keyboard (desktop) & remote (TV) ---------- */
function seekBy(sec) {
  if (ytReady && current()) yt.seekTo(Math.max(0, yt.getCurrentTime() + sec), true);
}

const visible = (el) => el.getClientRects().length > 0;
function focusables() {
  if (!$('#menu').hidden) return [...document.querySelectorAll('#menu button, #menu input')].filter(visible);
  return [...document.querySelectorAll('.tabs button, #navbar [data-nav], #q, #officialBtn, #suggest button, #list [data-nav], #pvVideo, #pvLyrics, #qBtn, #sleepBtn, #artBtn, #queueSheet [data-nav], #upnext [data-nav], #seek, #prev, #play, #next, #shuffle, #repeat, #favBtn, #moreBtn')].filter(visible);
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
    if (!$('#queueSheet').hidden) { e.preventDefault(); closeQueue(); return; }
    if (!$('#suggest').hidden) { e.preventDefault(); hideSuggest(); $('#q').blur(); return; }
    if (typing) { t.blur(); return; }
    if (state.tv) { e.preventDefault(); if (state.view) closeView(); else $(`.tabs [data-tab="${state.tab}"]`)?.focus(); return; }
    if ($('#player').classList.contains('open') && document.documentElement.dataset.layout !== 'desktop') { $('#player').classList.remove('open'); return; }
    if (state.view) { closeView(); return; }
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


/* =====================================================================
   CACHE API: hasil pencarian/genre/tangga lagu disimpan di perangkat supaya cepat dan hemat kuota
   ===================================================================== */
const apiCache = {
  KEY: 'nada.cache.v1', MAX: 40, m: store.get('nada.cache.v1', {}),
  get(k, ttl) { const e = this.m[k]; return e && Date.now() - e.t < ttl ? e.v : null; },
  stale(k) { const e = this.m[k]; return e ? e.v : null; },
  set(k, v) {
    this.m[k] = { t: Date.now(), v };
    const keys = Object.keys(this.m);
    if (keys.length > this.MAX) keys.sort((a, b) => this.m[a].t - this.m[b].t).slice(0, keys.length - this.MAX).forEach((x) => delete this.m[x]);
    try { localStorage.setItem(this.KEY, JSON.stringify(this.m)); }
    catch { Object.keys(this.m).sort((a, b) => this.m[a].t - this.m[b].t).slice(0, 15).forEach((x) => delete this.m[x]); store.set(this.KEY, this.m); }
  },
};
const inflight = new Map();
async function searchApi(q, official = state.official) {
  const key = `s:${official ? 1 : 0}:${lc(q).trim()}`;
  const hit = apiCache.get(key, 6 * 3600e3);
  if (hit) return hit;
  if (inflight.has(key)) return inflight.get(key);
  const pr = (async () => {
    try {
      const r = await fetch(`/api/search?q=${encodeURIComponent(q)}&official=${official ? 1 : 0}`);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Pencarian gagal, coba lagi ya.');
      const val = { items: d.items || [] };
      if (val.items.length) apiCache.set(key, val);
      return val;
    } catch (e) {
      const old = apiCache.stale(key);   // kuota habis / offline: pakai hasil lama daripada kosong
      if (old) return old;
      throw e;
    } finally { inflight.delete(key); }
  })();
  inflight.set(key, pr);
  return pr;
}

/* =====================================================================
   ANTREAN
   ===================================================================== */
const firstArtist = (a = '') => (String(a).split(/\s*(?:,|&| feat\.?| ft\.?| x )\s*/i)[0] || a).trim();

function qChanged() {
  state.userQ = Math.max(0, Math.min(state.userQ, state.queue.length - state.idx - 1));
  renderQBadge(); renderUpnext(); renderPeek();
  if (!$('#queueSheet').hidden) renderQueueSheet();
}
function removeUpcoming(id) {
  for (let i = state.queue.length - 1; i > state.idx; i--) {
    if (state.queue[i].id === id) { state.queue.splice(i, 1); if (i <= state.idx + state.userQ) state.userQ--; }
  }
}
function playNext(t) {
  t = slim(t);
  if (!current()) { playList([t], 0); toast('Langsung diputar'); return; }
  removeUpcoming(t.id);
  state.queue.splice(state.idx + 1, 0, t); state.userQ++;
  qChanged(); toast('Diputar setelah lagu ini');
}
function addToQueue(t) {
  t = slim(t);
  if (!current()) { playList([t], 0); toast('Langsung diputar'); return; }
  removeUpcoming(t.id);
  state.queue.splice(state.idx + 1 + state.userQ, 0, t); state.userQ++;
  qChanged(); toast(`Masuk antrean, urutan ke-${state.userQ}`);
}
function removeAt(i) {
  if (i <= state.idx || i >= state.queue.length) return;
  const gone = state.queue.splice(i, 1)[0];
  if (i <= state.idx + state.userQ) state.userQ--;
  qChanged(); toast(`${gone.title} dihapus dari antrean`);
}
function moveQueue(from, to) {
  if (from <= state.idx || to <= state.idx || from === to || from >= state.queue.length || to >= state.queue.length) return;
  const wasUser = from <= state.idx + state.userQ;
  const [it] = state.queue.splice(from, 1);
  state.queue.splice(to, 0, it);
  const base = state.userQ - (wasUser ? 1 : 0);
  state.userQ = base + (to <= state.idx + base + 1 ? 1 : 0);
  qChanged();
}
function jumpTo(i) {
  if (i <= state.idx || i >= state.queue.length) return;
  state.userQ = Math.max(0, state.userQ - (i - state.idx)); state.idx = i; load(0); qChanged();
}
function clearUserQueue() {
  if (!state.userQ) return;
  state.queue.splice(state.idx + 1, state.userQ); state.userQ = 0; qChanged(); toast('Antrean dikosongkan');
}
function renderQBadge() {
  const c = $('#qCount'); c.textContent = state.userQ; c.hidden = !state.userQ;
  $('#qBtn').classList.toggle('on', state.userQ > 0);
}

const GRIP = '<svg viewBox="0 0 24 24"><circle cx="9" cy="7" r="1.3"/><circle cx="15" cy="7" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="9" cy="17" r="1.3"/><circle cx="15" cy="17" r="1.3"/></svg>';
const qRow = (t, i) => `<div class="qr" data-qi="${i}"><button class="qh" type="button" tabindex="-1" aria-label="Geser untuk mengurutkan">${GRIP}</button>
  <div class="qm" data-nav tabindex="0" role="button" data-qplay="${i}" aria-label="Putar ${esc(t.title)}"><img src="${imgOf(t)}" alt="" loading="lazy"><span class="meta"><b>${esc(t.title)}</b><small>${esc(t.artist)}</small></span></div>
  <button class="qx" type="button" data-nav data-qdel="${i}" aria-label="Hapus ${esc(t.title)} dari antrean"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>`;

function renderQueueSheet() {
  const q = state.queue, cur = current(), body = $('#qsBody');
  const user = [], rest = [];
  for (let i = state.idx + 1; i < q.length; i++) (i <= state.idx + state.userQ ? user : rest).push(i);
  $('#qsClear').hidden = !state.userQ;
  $('#qsSub').textContent = cur ? `${user.length} antrean kamu · ${rest.length} berikutnya` : '';
  if (!cur) { body.innerHTML = '<div class="empty sm"><b>Antrean masih kosong</b>Putar lagu dulu, terus tambahin lagu lain lewat menu titik tiga: "Putar berikutnya" atau "Tambah ke antrean".</div>'; return; }
  let h = `<div class="q-sec">Sedang diputar</div><div class="qnow"><img src="${imgOf(cur)}" alt=""><span class="meta"><b>${esc(cur.title)}</b><small>${esc(cur.artist)}</small></span><span class="eqb static" aria-hidden="true"><i></i><i></i><i></i></span></div>`;
  if (user.length) h += `<div class="q-sec">Antrean kamu<em>${user.length}</em></div>` + user.map((i) => qRow(q[i], i)).join('');
  h += `<div class="q-sec">Berikutnya${state.shuffle ? '<em class="shf">acak</em>' : ''}</div>`;
  h += rest.length ? rest.slice(0, 60).map((i) => qRow(q[i], i)).join('') : '<p class="q-end">Habis di sini. Aktifkan ulangi, atau tambahin lagu lewat menu titik tiga.</p>';
  if (state.shuffle && rest.length) h += '<p class="q-end">Mode acak aktif, urutan di atas bisa berubah saat diputar.</p>';
  body.innerHTML = h;
}
function openQueue() { $('#queueSheet').hidden = false; renderQueueSheet(); $('#qsClose').focus(); }
function closeQueue() { $('#queueSheet').hidden = true; }
$('#qBtn').addEventListener('click', openQueue);
$('#qsClose').addEventListener('click', closeQueue);
$('#qsClear').addEventListener('click', clearUserQueue);
$('#queueSheet').addEventListener('click', (e) => { if (e.target === $('#queueSheet')) closeQueue(); });
$('#qsBody').addEventListener('click', (e) => {
  const d = e.target.closest('[data-qdel]'); if (d) { removeAt(+d.dataset.qdel); return; }
  const p = e.target.closest('[data-qplay]'); if (p) jumpTo(+p.dataset.qplay);
});
/* seret untuk mengurutkan */
(function () {
  let g = null; const body = $('#qsBody');
  const reset = () => { if (!g) return; g.row.classList.remove('drag'); g.row.style.transform = ''; body.querySelectorAll('.tgt-up,.tgt-down').forEach((r) => r.classList.remove('tgt-up', 'tgt-down')); g = null; };
  body.addEventListener('pointerdown', (e) => {
    const h = e.target.closest('.qh'); if (!h) return;
    e.preventDefault(); h.setPointerCapture(e.pointerId);
    const rows = [...body.querySelectorAll('.qr')], row = h.closest('.qr');
    g = { row, rows, from: +row.dataset.qi, over: +row.dataset.qi, y0: e.clientY, centers: rows.map((r) => { const b = r.getBoundingClientRect(); return b.top + b.height / 2; }), sc0: body.scrollTop };
    row.classList.add('drag');
  });
  body.addEventListener('pointermove', (e) => {
    if (!g) return;
    const dy = e.clientY - g.y0 + (body.scrollTop - g.sc0);
    g.row.style.transform = `translateY(${dy}px)`;
    const c = g.centers[g.rows.indexOf(g.row)] + dy;
    let best = 0, bd = 1e9; g.centers.forEach((v, k) => { const d = Math.abs(v - c); if (d < bd) { bd = d; best = k; } });
    g.over = +g.rows[best].dataset.qi;
    g.rows.forEach((r) => { const qi = +r.dataset.qi; r.classList.toggle('tgt-up', r !== g.row && qi === g.over && g.over < g.from); r.classList.toggle('tgt-down', r !== g.row && qi === g.over && g.over > g.from); });
    const bb = body.getBoundingClientRect();
    if (e.clientY < bb.top + 40) body.scrollTop -= 8; else if (e.clientY > bb.bottom - 40) body.scrollTop += 8;
  });
  const end = () => { if (!g) return; const { from, over } = g; reset(); if (over !== from) moveQueue(from, over); };
  body.addEventListener('pointerup', end); body.addEventListener('pointercancel', reset);
})();

/* =====================================================================
   TIMER TIDUR
   ===================================================================== */
function setVol(v) { try { if (ytReady && yt.setVolume) yt.setVolume(v); } catch {} }
function renderSleep() {
  const S = state.sleep, t = $('#sleepTxt'), b = $('#sleepBtn');
  b.classList.toggle('on', !!S);
  t.textContent = !S ? 'Tidur' : S.mode === 'end' ? 'Akhir lagu' : fmt(Math.max(0, (S.at - Date.now()) / 1000));
}
function setSleep(v) {
  setVol(100);
  if (v === 'off') { state.sleep = null; toast('Timer tidur dimatikan'); }
  else if (v === 'end') { state.sleep = { mode: 'end' }; toast('Musik berhenti setelah lagu ini'); }
  else { state.sleep = { mode: 'time', at: Date.now() + v * 60000, set: Date.now() }; toast(`Musik berhenti ${v} menit lagi`); }
  renderSleep();
}
function sleepFire() {
  state.sleep = null; state.want = false; renderSleep();
  try { if (ytReady) yt.pauseVideo(); } catch {}
  keep.stop(); setPlaying(false);
  setTimeout(() => setVol(100), 800);
  toast('Timer tidur selesai. Selamat istirahat!');
}
function sleepTick() {
  const S = state.sleep; if (!S) return;
  renderSleep();
  if (S.mode !== 'time') return;
  const left = S.at - Date.now();
  if (left <= 0) { sleepFire(); return; }
  if (left < 8000 && state.playing) setVol(Math.max(2, Math.round((left / 8000) * 100)));   // pelan-pelan mengecil
}
setInterval(sleepTick, 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) sleepTick(); });
$('#sleepBtn').addEventListener('click', () => openMenu(null, null, 'sleep'));

/* =====================================================================
   HALAMAN ARTIS
   ===================================================================== */
function artistTracks(name) { const d = state.artistData[lc(name)]; return d ? d.tracks : []; }
function openArtist(name) {
  name = firstArtist(name || ''); if (!name) return;
  $('#player').classList.remove('open'); closeQueue();
  openView('artist:' + name);
  loadArtist(name);
}
async function loadArtist(name, force) {
  const k = lc(name), cur = state.artistData[k];
  if (cur && (cur.status === 'ok' || cur.status === 'loading') && !force) return;
  state.artistData[k] = { status: 'loading', tracks: [] };
  try {
    const d = await searchApi(name, true);
    const n = lc(name);
    let mine = (d.items || []).filter((t) => { const a = lc(t.artist); return a && (a.includes(n) || n.includes(a)); });
    if (mine.length < 5) mine = d.items || [];
    state.artistData[k] = { status: mine.length ? 'ok' : 'none', tracks: mine };
    mine.forEach(backfillArtist);
  } catch (e) { state.artistData[k] = { status: 'err', tracks: [], msg: e.message }; }
  if (state.view && state.view.ctx === 'artist:' + name) render();
}
function artistViewHTML(name) {
  const ctx = 'artist:' + name, d = state.artistData[lc(name)] || { status: 'loading', tracks: [] }, tracks = d.tracks, n = tracks.length;
  const fol = state.artists.find((a) => lc(a.name) === lc(name));
  const thumbUrl = (fol && fol.thumb) || (tracks[0] && (tracks[0].thumb || thumb(tracks[0].id))) || '';
  const f = isFollowing(name);
  let body;
  if (d.status === 'loading') body = '<div class="skeleton"></div>'.repeat(6);
  else if (d.status === 'err') body = `<div class="empty"><b>Ups</b>${esc(d.msg || 'Gagal memuat lagu artis ini.')}<br><button class="pill big" data-nav data-artretry="${esc(name)}" style="margin-top:1rem">Coba lagi</button></div>`;
  else if (!n) body = '<div class="empty"><b>Belum ketemu lagunya</b>Coba cari nama artisnya di kolom pencarian.</div>';
  else body = tracks.map((t, i) => rowHTML(t, i, ctx)).join('');
  return `<div class="vhero artist-hero">
    <div class="aav">${avatar({ name, thumb: thumbUrl })}</div>
    <div class="vinfo"><small class="vkind">Artis</small><h2>${esc(name)}</h2>
      <p class="vsub">${d.status === 'loading' ? 'Lagi nyari lagunya…' : n ? `${n} lagu${f ? ' · Kamu follow' : ''}` : ''}</p>
      <div class="vact">
        ${n ? `<button class="pill big" data-nav data-playall="${esc(ctx)}">${ICON.play}<span>Putar</span></button><button class="pill ghost big" data-nav data-shuffleall="${esc(ctx)}">${ICON.shuffle}<span>Acak</span></button>` : ''}
        <button class="pill ghost big fbtn${f ? ' on' : ''}" data-nav data-followart="${esc(name)}" data-thumb="${esc(thumbUrl)}" aria-pressed="${f}">${f ? 'Difollow' : '+ Follow'}</button>
      </div></div></div><div class="tracks">${body}</div>`;
}
$('#artBtn').addEventListener('click', () => { const t = current(); if (t) openArtist(t.artist); else toast('Putar lagu dulu ya'); });
$('#artist').addEventListener('click', () => { const t = current(); if (t) openArtist(t.artist); });

/* ---------- init ---------- */
/* tautan lagu (/s/ID -> /?t=ID): langsung pilih lagunya dan buka pemutar */
async function openSongFromLink() {
  const id = new URLSearchParams(location.search).get('t');
  if (!id || !/^[\w-]{11}$/.test(id)) return;
  history.replaceState(null, '', location.pathname + (document.documentElement.classList.contains('tv') ? '?tv=1' : ''));
  try {
    const r = await fetch('/api/videos?ids=' + id); const d = await r.json();
    const t = d.items && d.items[0] ? slim(d.items[0]) : { id, title: 'Lagu dari temanmu', artist: 'Nada' };
    state.queue = [t]; state.idx = 0; state.userQ = 0; load(0);
    $('#player').classList.add('open');
    toast('Lagu dari temanmu. Tap putar buat mulai!');
  } catch { toast('Lagunya nggak bisa dibuka, coba lagi ya'); }
}
openSongFromLink();

if (/[#?&](c|code|share)=/.test(location.hash)) {
  const linkText = location.href;
  try { history.replaceState(null, '', location.pathname + location.search); } catch {}
  setTimeout(() => { openMenu(null, null, 'import'); importFrom(linkText); }, 300);
}
renderQBadge(); renderSleep(); applyLayout(); setPview(state.pview); updateOfficialBtn(); renderControls(); render();
if (state.tab === 'home' || state.tab === 'library') loadCharts();
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
