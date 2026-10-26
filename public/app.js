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
const hscroll = (items) => `<div class="hscroll">${items.join('')}</div>`;

function chartSection(key, title) {
  const items = state.charts[key];
  let inner;
  if (items && items.length) inner = hscroll(items.slice(0, 12).map((t, i) => cardHTML(t, i, 'chart' + key, true)));
  else if (state.charts.err[key]) inner = empty(esc(state.charts.err[key]));
  else inner = hscroll(Array(6).fill('<div class="card sk"><div class="cover"></div></div>'));
  return section(title, inner, items && items.length ? 'chart' + key : '');
}

function artistsSection() {
  const chips = [`<div class="artist add" data-nav tabindex="0" role="button" data-manageart aria-label="Tambah artis"><div class="av">${ICON.plus}</div><b>Tambah</b></div>`];
  state.artists.forEach((a) => chips.push(
    `<div class="artist" data-nav tabindex="0" role="button" data-artist="${esc(a.name)}" aria-label="Cari lagu ${esc(a.name)}">${avatar(a)}<b>${esc(a.name)}</b></div>`));
  let extra = '';
  const rest = STARTER_ARTISTS.filter((n) => !isFollowing(n)).slice(0, 10);
  if (rest.length && state.artists.length < 10) {
    const sug = rest.map((n) =>
      `<div class="artist" data-nav tabindex="0" role="button" data-followart="${esc(n)}" aria-label="Ikuti ${esc(n)}">${avatar({ name: n })}<b>${esc(n)}</b><small>Ikuti</small></div>`);
    extra = (state.artists.length
      ? '<p class="hint sug">Saran untuk kamu</p>'
      : '<p class="hint">Pilih artis favoritmu di bawah, atau tap Tambah untuk mengetik namanya sendiri.</p>') + hscroll(sug);
  }
  return `<section class="sec"><div class="sec-head"><h2>Artis Favorit</h2><button class="link" data-nav data-manageart>Kelola</button></div>${hscroll(chips)}${extra}</section>`;
}

function homeHTML() {
  const h = new Date().getHours();
  const greet = h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam';
  let out = `<div class="home"><h2 class="greet">${greet}</h2>`;

  if (state.resume && state.resume.track) {
    const r = state.resume, t = r.track, pct = r.dur ? Math.min(100, (r.pos / r.dur) * 100) : 0;
    out += section('Lanjutkan mendengarkan',
      `<div class="continue" data-nav tabindex="0" role="button" data-resume aria-label="Lanjutkan ${esc(t.title)}">
        <img src="${imgOf(t)}" alt="">
        <div class="meta"><b>${esc(t.title)}</b><small>${esc(t.artist)}</small><div class="bar"><i style="width:${pct}%"></i></div><small>${fmt(r.pos)}${r.dur ? ' / ' + fmt(r.dur) : ''}</small></div>
        <span class="play-chip">${ICON.play}</span>
      </div>`);
  }

  out += section('Terakhir diputar',
    state.recent.length ? hscroll(state.recent.slice(0, 12).map((t, i) => cardHTML(t, i, 'recent'))) : empty('Lagu yang kamu putar akan muncul di sini.'),
    state.recent.length ? 'recent' : '');

  out += section('Liked Songs',
    state.fav.length ? hscroll(state.fav.slice(0, 12).map((t, i) => cardHTML(t, i, 'liked'))) : empty('Tap ikon hati pada lagu untuk menyimpannya di sini.'),
    state.fav.length ? 'liked' : '');

  const plCards = state.playlists.map((p) => {
    const first = p.tracks[0];
    return `<div class="card pl" data-nav tabindex="0" role="button" data-pl="${p.id}" aria-label="Buka playlist ${esc(p.name)}">
      <div class="cover${first ? '' : ' ph'}">${first ? `<img src="${imgOf(first)}" alt="" loading="lazy">` : ICON.list}<span class="cnt">${p.tracks.length} lagu</span></div>
      <b>${esc(p.name)}</b><small>Playlist</small></div>`;
  });
  plCards.unshift(`<div class="card new" data-nav tabindex="0" role="button" data-newpl aria-label="Buat playlist baru"><div class="cover">${ICON.plus}</div><b>Playlist baru</b><small>Buat sendiri</small></div>`);
  out += section('My Playlist', hscroll(plCards));

  out += artistsSection();

  out += chartSection('ID', 'Tangga Lagu Indonesia');
  out += chartSection('GLOBAL', 'Tangga Lagu Global');
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
  let out = '<div class="home">';
  out += lib('data-open="liked"', ICON.heart, true, 'Liked Songs', `${state.fav.length} lagu`);
  out += lib('data-open="recent"', ICON.clock, false, 'Terakhir diputar', `${state.recent.length} lagu`);
  out += lib('data-open="chartID"', ICON.list, false, 'Tangga Lagu Indonesia', 'Musik terpopuler di Indonesia');
  out += lib('data-open="chartGLOBAL"', ICON.list, false, 'Tangga Lagu Global', 'Gabungan beberapa negara');
  out += '<div class="lib-h">Playlist</div>';
  out += lib('data-newpl', ICON.plus, false, 'Buat playlist baru', 'Kumpulkan lagu pilihanmu');
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
  const fKey = f ? { play: f.dataset.play, i: f.dataset.i, sel: ['data-open', 'data-pl', 'data-artist', 'data-manageart', 'data-followart', 'data-newpl', 'data-resume', 'data-back', 'data-playall', 'data-delpl'].find((a) => f.hasAttribute(a)) } : null;
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

function renderPlayer() {
  const t = current();
  $('#mini').hidden = !t;
  if (!t) return;
  $('#title').textContent = t.title;
  $('#artist').textContent = t.artist;
  $('#miniTitle').textContent = t.title;
  $('#miniArtist').textContent = t.artist;
  $('#miniArt').src = t.thumb || thumb(t.id);
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
  (mctx.mode === 'newpl' ? $('#plName') : mctx.mode === 'artists' ? $('#artName') : $('#menuBody button'))?.focus();
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
  } else {
    h += '<div class="sub">Buat playlist</div>' + newPlForm + act('close', ICON.back, 'Tutup');
  }
  $('#menuBody').innerHTML = h;
}

$('#menu').addEventListener('click', (e) => {
  if (e.target === $('#menu')) { closeMenu(); return; }
  const b = e.target.closest('[data-act]');
  if (!b || !mctx) return;
  const { track, ctx } = mctx, a = b.dataset.act;
  if (a === 'close') { closeMenu(); render(); }
  else if (a === 'addart') { followArtist(b.dataset.name); renderMenu(); render(); $('#menuBody .act')?.focus(); }
  else if (a === 'delart') { unfollowArtist(b.dataset.name); renderMenu(); render(); $('#menuBody .act')?.focus(); }
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
  if ((el = t.closest('[data-like]'))) { const [c, i] = splitRef(el.dataset.like); toggleFav(ctxTracks(c)[i]); return; }
  if ((el = t.closest('[data-more]'))) { const [c, i] = splitRef(el.dataset.more); const tr = ctxTracks(c)[i]; if (tr) openMenu(tr, c); return; }
  if ((el = t.closest('[data-play]'))) { playList(ctxTracks(el.dataset.play), +el.dataset.i); return; }
  if ((el = t.closest('[data-playall]'))) { const l = ctxTracks(el.dataset.playall); if (l.length) playList(l, 0); return; }
  if ((el = t.closest('[data-open]'))) { openView(el.dataset.open); return; }
  if ((el = t.closest('[data-pl]'))) { openView('pl:' + el.dataset.pl); return; }
  if ((el = t.closest('[data-artist]'))) { runSearch(el.dataset.artist); return; }
  if (t.closest('[data-manageart]')) { openMenu(null, null, 'artists'); return; }
  if ((el = t.closest('[data-followart]'))) { followArtist(el.dataset.followart); render(); return; }
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
  return [...document.querySelectorAll('.tabs button, #q, #officialBtn, #suggest button, #list [data-nav], #seek, #prev, #play, #next, #shuffle, #repeat, #favBtn, #moreBtn')].filter(visible);
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
applyLayout(); updateOfficialBtn(); renderControls(); render();
if (state.tab === 'home' || state.tab === 'library') loadCharts();
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
