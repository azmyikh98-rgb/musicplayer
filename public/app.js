'use strict';

/* ---------- util ---------- */
const $ = (s) => document.querySelector(s);
const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const esc = (s = '') => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (s) => { s = Math.max(0, Math.floor(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const thumb = (id) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;

const ICON = {
  play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>',
  prev: '<svg viewBox="0 0 24 24"><path d="M6 5h2v14H6zM20 5v14L9 12z"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M16 5h2v14h-2zM4 5v14l11-7z"/></svg>',
  heart: '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
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
  tab: 'search',
  results: store.get('lastResults', []),
  fav: store.get('fav', []),
  recent: store.get('recent', []),
  queue: [],
  idx: -1,
  shuffle: store.get('shuffle', false),
  repeat: store.get('repeat', 'off'), // off | all | one
  playing: false,
  loading: false,
  error: '',
};
let yt = null, ytReady = false, pendingId = null, seeking = false;

const current = () => state.queue[state.idx];
const isFav = (id) => state.fav.some((t) => t.id === id);

/* ---------- toast ---------- */
let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

/* ---------- rendering ---------- */
function listForTab() {
  return state.tab === 'fav' ? state.fav : state.tab === 'recent' ? state.recent : state.results;
}

function render() {
  const el = $('#list');
  const items = listForTab();
  document.querySelectorAll('.tabs button[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === state.tab));

  if (state.tab === 'search' && state.loading) {
    el.innerHTML = '<div class="skeleton"></div>'.repeat(7); return;
  }
  if (state.tab === 'search' && state.error) {
    el.innerHTML = `<div class="empty"><b>Ups</b>${esc(state.error)}</div>`; return;
  }
  if (!items.length) {
    const msg = {
      search: ['Mau dengar apa hari ini?', 'Ketik judul lagu atau artis, atau tempel link YouTube / YouTube Music.'],
      fav: ['Belum ada favorit', 'Tap ikon hati pada lagu untuk menyimpannya di sini.'],
      recent: ['Belum ada riwayat', 'Lagu yang kamu putar akan muncul di sini.'],
    }[state.tab];
    el.innerHTML = `<div class="empty"><b>${msg[0]}</b>${msg[1]}</div>`; return;
  }
  const cur = current()?.id;
  // simpan fokus (penting untuk remote TV / keyboard) karena daftar dirender ulang
  const focusedI = el.contains(document.activeElement) ? document.activeElement.closest('.row')?.dataset.i : null;
  el.innerHTML = items.map((t, i) => `
    <div class="row${t.id === cur ? ' playing' : ''}" data-i="${i}" tabindex="0" role="button" aria-label="Putar ${esc(t.title)}">
      <img src="${esc(t.thumb || thumb(t.id))}" alt="" loading="lazy">
      <div class="meta"><b>${esc(t.title)}</b><small>${esc(t.artist)}</small></div>
      <button class="heart icon-btn${isFav(t.id) ? ' on' : ''}" data-fav="${i}" tabindex="-1" aria-label="Favorit">${ICON.heart}</button>
    </div>`).join('');
  if (focusedI != null) el.querySelector(`.row[data-i="${focusedI}"]`)?.focus({ preventScroll: true });
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

/* ---------- search ---------- */
function parseVideoId(text) {
  const m = text.match(/(?:v=|youtu\.be\/|\/shorts\/|\/embed\/)([\w-]{11})/);
  return m ? m[1] : null;
}

async function search(q) {
  state.tab = 'search'; state.error = ''; state.loading = true; render();
  try {
    const id = /^https?:\/\//i.test(q) ? parseVideoId(q) : null;
    if (id) {
      const r = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent('https://www.youtube.com/watch?v=' + id)}&format=json`);
      if (!r.ok) throw new Error('Link tidak bisa dibuka atau pemilik melarang pemutaran di luar YouTube.');
      const d = await r.json();
      state.results = [{ id, title: d.title, artist: d.author_name.replace(/ - Topic$/, ''), thumb: thumb(id) }];
    } else {
      const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Pencarian gagal.');
      state.results = d.items;
      if (!d.items.length) state.error = 'Tidak ada hasil. Coba kata kunci lain.';
    }
    store.set('lastResults', state.results);
  } catch (e) {
    state.error = e.message || 'Terjadi kesalahan.';
  }
  state.loading = false; render();
  if (state.tv) $('.row')?.focus();
}

/* ---------- playback ---------- */
window.onYouTubeIframeAPIReady = () => {
  yt = new YT.Player('yt', {
    width: '100%', height: '100%',
    playerVars: { playsinline: 1, controls: 0, rel: 0, modestbranding: 1, disablekb: 1, fs: 0, iv_load_policy: 3 },
    events: {
      onReady() {
        ytReady = true;
        if (pendingId) { yt.loadVideoById(pendingId); pendingId = null; }
      },
      onStateChange(e) {
        const S = YT.PlayerState;
        if (e.data === S.PLAYING) setPlaying(true);
        else if (e.data === S.PAUSED) setPlaying(false);
        else if (e.data === S.ENDED) { setPlaying(false); next(true); }
      },
      onError() {
        toast('Lagu ini tidak bisa diputar di luar YouTube, lanjut ke berikutnya…');
        setTimeout(() => next(true), 1200);
      },
    },
  });
};

function setPlaying(v) {
  state.playing = v; renderControls();
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = v ? 'playing' : 'paused';
}

function playList(list, i) {
  state.queue = list.slice(); state.idx = i; load();
}

function load() {
  const t = current(); if (!t) return;
  if (ytReady) yt.loadVideoById(t.id); else pendingId = t.id;
  state.recent = [t, ...state.recent.filter((x) => x.id !== t.id)].slice(0, 50);
  store.set('recent', state.recent);
  renderPlayer(); renderControls(); render(); updateMediaSession();
  $('#seek').value = 0; $('#seek').style.setProperty('--p', '0%');
}

function toggle() {
  if (!current()) return;
  if (!ytReady) return;
  state.playing ? yt.pauseVideo() : yt.playVideo();
}

function next(auto = false) {
  const n = state.queue.length; if (!n) return;
  if (auto && state.repeat === 'one') { yt.seekTo(0, true); yt.playVideo(); return; }
  if (state.shuffle && n > 1) {
    let r; do { r = Math.floor(Math.random() * n); } while (r === state.idx);
    state.idx = r;
  } else if (state.idx + 1 < n) state.idx++;
  else if (state.repeat === 'all' || !auto) state.idx = 0;
  else { setPlaying(false); return; }
  load();
}

function prev() {
  if (!state.queue.length) return;
  if (ytReady && yt.getCurrentTime() > 3) { yt.seekTo(0, true); return; }
  state.idx = (state.idx - 1 + state.queue.length) % state.queue.length;
  load();
}

function toggleFav(t) {
  if (!t) return;
  state.fav = isFav(t.id) ? state.fav.filter((x) => x.id !== t.id) : [t, ...state.fav];
  store.set('fav', state.fav);
  render(); renderPlayer();
}

/* progress */
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

/* ---------- Media Session (kontrol di lock screen / notifikasi) ---------- */
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
  h('play', () => yt && yt.playVideo());
  h('pause', () => yt && yt.pauseVideo());
  h('previoustrack', prev);
  h('nexttrack', () => next());
  h('seekto', (d) => yt && yt.seekTo(d.seekTime, true));
}

/* ---------- events ---------- */
$('#searchForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = $('#q').value.trim(); if (!q) return;
  $('#q').blur(); search(q);
});

$('#list').addEventListener('click', (e) => {
  const fav = e.target.closest('[data-fav]');
  const items = listForTab();
  if (fav) { toggleFav(items[+fav.dataset.fav]); return; }
  const row = e.target.closest('.row');
  if (row) playList(items, +row.dataset.i);
});

document.querySelectorAll('.tabs button[data-tab]').forEach((b) =>
  b.addEventListener('click', () => { state.tab = b.dataset.tab; render(); $('#list').scrollTop = 0; }));

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

/* ---------- layout responsif & mode TV ---------- */
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

function focusables() {
  return [...document.querySelectorAll('.tabs button, #q, .row, #seek, #prev, #play, #next, #shuffle, #repeat, #favBtn')]
    .filter((el) => el.getClientRects().length > 0);
}

// Navigasi spasial: pindah fokus ke elemen terdekat pada arah panah
function spatial(dir) {
  const els = focusables(), cur = document.activeElement;
  if (!els.includes(cur)) { (els.find((e) => e.classList.contains('row')) || els[0])?.focus(); return; }
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

function favFocused() {
  const row = document.activeElement?.closest?.('.row');
  const t = row ? listForTab()[+row.dataset.i] : current();
  if (t) toggleFav(t);
}

document.addEventListener('keydown', (e) => {
  const t = e.target, k = e.key, kc = e.keyCode;
  const typing = !!t.matches?.('input[type=search], input[type=text]');

  // tombol media (keyboard & remote TV)
  if (k === 'MediaPlayPause' || kc === 415 || kc === 19 || kc === 179) { e.preventDefault(); toggle(); return; }
  if (k === 'MediaTrackNext' || kc === 417) { e.preventDefault(); next(); return; }
  if (k === 'MediaTrackPrevious' || kc === 412) { e.preventDefault(); prev(); return; }
  if (kc === 405 || (state.tv && !typing && (k === 'f' || k === 'F'))) { e.preventDefault(); favFocused(); return; } // 405 = tombol kuning

  if (typing) {
    if (k === 'Escape') { t.blur(); return; }
    if (!state.tv || (k !== 'ArrowUp' && k !== 'ArrowDown')) return;
  }
  if (k === '/' && !typing) { e.preventDefault(); $('#q').focus(); return; }
  if (t.id === 'seek' && (k === 'ArrowLeft' || k === 'ArrowRight')) { e.preventDefault(); seekBy(k === 'ArrowRight' ? 5 : -5); return; }
  if ((k === 'Enter' || k === ' ') && t.classList?.contains('row')) { e.preventDefault(); t.click(); return; }

  if (state.tv) {
    if (k.startsWith('Arrow')) { e.preventDefault(); spatial(k); }
    else if (k === 'Escape' || k === 'Backspace' || k === 'GoBack' || kc === 10009 || kc === 461) {
      e.preventDefault(); $(`.tabs [data-tab="${state.tab}"]`)?.focus(); // tombol Kembali → menu
    }
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
applyLayout(); renderControls(); render();
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
