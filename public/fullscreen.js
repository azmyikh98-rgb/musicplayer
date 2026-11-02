/* =====================================================================
   VIDEO LAYAR PENUH (musik dan podcast)
   iPhone tidak mengizinkan layar penuh untuk iframe, jadi dipakai layar penuh buatan: video menutupi seluruh layar,
   otomatis diputar ke mode landscape kalau HP masih tegak, dengan kontrol sendiri (putar/jeda, lompat, seek).
   Di Android/desktop/iPad dicoba juga layar penuh asli supaya bilah browser hilang.
   ===================================================================== */
const VFS = { on: false, native: false, rot: false, hide: 0, tap: 0, seeking: false };
const vfsIcon = {
  enter: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  exit: '<svg viewBox="0 0 24 24"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>',
  rot: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 0 1 13.5-5.8L20 8M20 4v4h-4M20 12a8 8 0 0 1-13.5 5.8L4 16M4 20v-4h4"/></svg>',
};
(function vfsInit() {
  const box = document.querySelector('.video'); if (!box) return;
  const btn = document.createElement('button');
  btn.id = 'vfsBtn'; btn.type = 'button'; btn.className = 'vfs-btn'; btn.setAttribute('aria-label', 'Layar penuh'); btn.innerHTML = vfsIcon.enter;
  const ui = document.createElement('div');
  ui.id = 'vfs'; ui.className = 'vfs-ui';
  ui.innerHTML = `<div class="vfs-top"><button type="button" class="vfs-i" data-vfs="close" aria-label="Keluar dari layar penuh">${vfsIcon.exit}</button>
      <div class="vfs-title"><b id="vfsT"></b><small id="vfsA"></small></div>
      <button type="button" class="vfs-i" data-vfs="rot" aria-label="Putar tampilan">${vfsIcon.rot}</button></div>
    <div class="vfs-mid"><button type="button" class="vfs-i big" data-vfs="back" aria-label="Sebelumnya"></button><button type="button" class="vfs-i xl" data-vfs="play" aria-label="Putar/Jeda"></button><button type="button" class="vfs-i big" data-vfs="fwd" aria-label="Berikutnya"></button></div>
    <div class="vfs-bot"><span id="vfsCur">0:00</span><input id="vfsSeek" type="range" min="0" max="1000" value="0" aria-label="Posisi"><span id="vfsDur">0:00</span></div>
    <div class="vfs-hint" id="vfsHint"></div>`;
  box.appendChild(btn); box.appendChild(ui);
})();

const vfsBox = () => document.querySelector('.video');
const vfsEl = (id) => document.getElementById(id);
const vfsFmt = (s) => { s = Math.max(0, Math.floor(s || 0)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${m}:${String(s % 60).padStart(2, '0')}`; };
const vfsPod = () => typeof isPod === 'function' && isPod();

function vfsPortrait() { return window.innerHeight > window.innerWidth; }
function vfsLayout() {
  const box = vfsBox(); if (!box) return;
  // tegak & bukan layar penuh asli yang terkunci landscape: putar videonya 90°
  VFS.rot = VFS.on && vfsPortrait() && VFS.rotWanted !== false;
  box.classList.toggle('rot', VFS.rot);
}
function vfsControls() {
  const pod = vfsPod();
  vfsEl('vfsT').textContent = (current() || {}).title || ''; vfsEl('vfsA').textContent = (current() || {}).artist || '';
  const ui = vfsEl('vfs');
  ui.querySelector('[data-vfs="back"]').innerHTML = pod ? skipIcon(15, 'back') : ICON.prev;
  ui.querySelector('[data-vfs="fwd"]').innerHTML = pod ? skipIcon(30, 'fwd') : ICON.next;
  ui.querySelector('[data-vfs="back"]').setAttribute('aria-label', pod ? 'Mundur 15 detik' : 'Sebelumnya');
  ui.querySelector('[data-vfs="fwd"]').setAttribute('aria-label', pod ? 'Maju 30 detik' : 'Berikutnya');
}
function vfsShow(stay) {
  const ui = vfsEl('vfs'); ui.classList.add('show'); clearTimeout(VFS.hide);
  if (!stay) VFS.hide = setTimeout(() => { if (state.playing && !VFS.seeking) ui.classList.remove('show'); }, 3200);
}
async function vfsEnter() {
  if (VFS.on || !current()) return;
  const box = vfsBox(); VFS.on = true; VFS.rotWanted = undefined;
  document.documentElement.classList.add('vfs-on'); box.classList.add('vfs');
  VFS.native = false;
  try {
    const req = box.requestFullscreen || box.webkitRequestFullscreen;
    if (req && !/iPhone|iPod/.test(navigator.userAgent)) { await req.call(box, { navigationUI: 'hide' }); VFS.native = true; try { await screen.orientation.lock('landscape'); } catch {} }
  } catch {}
  vfsLayout(); vfsControls(); vfsTick(); vfsShow();
  if (typeof navSync === 'function') navSync();
}
function vfsExit(fromNav) {
  if (!VFS.on) return;
  VFS.on = false; clearTimeout(VFS.hide);
  const box = vfsBox();
  document.documentElement.classList.remove('vfs-on'); box.classList.remove('vfs', 'rot'); vfsEl('vfs').classList.remove('show');
  try { screen.orientation.unlock(); } catch {}
  try { if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch {}
  if (!fromNav && typeof navSync === 'function') navSync();
}
function vfsTick() {
  if (!VFS.on) return;
  const L = vfsEl('vfsPlay'); const ui = vfsEl('vfs');
  const p = ui.querySelector('[data-vfs="play"]'), want = state.playing ? ICON.pause : ICON.play;
  if (p.dataset.s !== (state.playing ? '1' : '0')) { p.innerHTML = want; p.dataset.s = state.playing ? '1' : '0'; }
  if (ytReady && typeof yt.getCurrentTime === 'function') {
    const cur = lyrNow ? lyrNow() : yt.getCurrentTime(), dur = yt.getDuration() || 0;
    vfsEl('vfsCur').textContent = vfsFmt(cur); vfsEl('vfsDur').textContent = vfsFmt(dur);
    if (!VFS.seeking && dur) vfsEl('vfsSeek').value = Math.round((cur / dur) * 1000);
    vfsEl('vfsSeek').style.setProperty('--p', dur ? (cur / dur) * 100 + '%' : '0%');
  }
  if (vfsEl('vfsT').textContent !== ((current() || {}).title || '')) vfsControls();
}
setInterval(vfsTick, 250);

function vfsHint(txt) { const h = vfsEl('vfsHint'); h.textContent = txt; h.classList.add('on'); setTimeout(() => h.classList.remove('on'), 700); }
function vfsSeekBy(d) { if (!ytReady) return; const dur = yt.getDuration() || 0; yt.seekTo(Math.max(0, Math.min(dur ? dur - 1 : 1e9, (yt.getCurrentTime() || 0) + d)), true); vfsHint((d > 0 ? '+' : '−') + Math.abs(d) + ' dtk'); }

document.addEventListener('click', (e) => {
  if (e.target.closest('#vfsBtn')) { e.stopPropagation(); vfsEnter(); return; }
  const ui = e.target.closest('#vfs'); if (!ui || !VFS.on) return;
  const shown = ui.classList.contains('show');
  const b = shown ? e.target.closest('[data-vfs]') : null;   // saat kontrol tersembunyi, ketukan dianggap ketukan di area video
  if (b) {
    const a = b.dataset.vfs;
    if (a === 'close') vfsExit();
    else if (a === 'rot') { VFS.rotWanted = !VFS.rot; vfsLayout(); }
    else if (a === 'play') toggle();
    else if (a === 'back') { if (vfsPod()) podSkip(-15); else prev(); }
    else if (a === 'fwd') { if (vfsPod()) podSkip(30); else next(false); }
    vfsShow(); return;
  }
  if (shown && e.target.closest('#vfsSeek')) { vfsShow(true); return; }
  // ketuk area video: tampil/sembunyi kontrol; ketuk dua kali di sisi kiri/kanan: lompat 10 dtk
  const now = Date.now(), r = vfsBox().getBoundingClientRect();
  const along = VFS.rot ? (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width;   // posisi sepanjang sisi panjang video
  const frac = VFS.rot ? 1 - along : along;
  if (now - VFS.tap < 320) { clearTimeout(VFS.t1); VFS.tap = 0; if (frac < 0.38) vfsSeekBy(-10); else if (frac > 0.62) vfsSeekBy(10); else toggle(); vfsShow(); return; }
  VFS.tap = now;
  VFS.t1 = setTimeout(() => { const ui2 = vfsEl('vfs'); if (ui2.classList.contains('show')) ui2.classList.remove('show'); else vfsShow(); }, 330);
}, true);

vfsEl('vfsSeek').addEventListener('input', (e) => { VFS.seeking = true; vfsShow(true); vfsEl('vfsCur').textContent = vfsFmt((e.target.value / 1000) * (ytReady ? yt.getDuration() || 0 : 0)); });
vfsEl('vfsSeek').addEventListener('change', (e) => { if (ytReady) yt.seekTo((e.target.value / 1000) * (yt.getDuration() || 0), true); VFS.seeking = false; vfsShow(); });

['resize', 'orientationchange'].forEach((ev) => window.addEventListener(ev, () => { if (VFS.on) { VFS.rotWanted = undefined; vfsLayout(); } }));
['fullscreenchange', 'webkitfullscreenchange'].forEach((ev) => document.addEventListener(ev, () => { if (VFS.on && VFS.native && !document.fullscreenElement && !document.webkitFullscreenElement) vfsExit(); }));
document.addEventListener('keydown', (e) => {
  if (!VFS.on) return;
  if (e.key === 'Escape') { e.stopPropagation(); vfsExit(); }
  else if (e.key === 'ArrowLeft') vfsSeekBy(-10); else if (e.key === 'ArrowRight') vfsSeekBy(10);
  else if (e.key === ' ') { e.preventDefault(); toggle(); }
}, true);
/* lagu berganti/tidak ada lagu: tetap aman */
setInterval(() => { if (VFS.on && !current()) vfsExit(); }, 1000);
