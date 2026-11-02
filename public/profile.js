/* =====================================================================
   PROFIL (lokal, tanpa login)
   Nama + avatar inisial berwarna, ringkasan dengar, pengaturan pemutaran, dan pengelolaan data.
   Semua tersimpan di perangkat dan ikut cadangan.
   ===================================================================== */
const PF_COLORS = [['#ff4f6d', '#ff8a5c'], ['#8b5cf6', '#ec4899'], ['#06b6d4', '#3b82f6'], ['#10b981', '#84cc16'], ['#f59e0b', '#ef4444'], ['#6366f1', '#22d3ee'], ['#14b8a6', '#6366f1'], ['#64748b', '#94a3b8']];
const PF = { p: store.get('nada.profile', null) || { name: '', color: 0, since: '' } };
function pfSave() { store.set('nada.profile', PF.p); }
function pfSince() {
  if (PF.p.since) return PF.p.since;
  const ks = Object.keys((NF.stats && NF.stats.months) || {}).sort();
  PF.p.since = ks.length ? ks[0] + '-01' : new Date().toISOString().slice(0, 10); pfSave();
  return PF.p.since;
}
pfSince();
function pfInitials(name) {
  const w = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!w.length) return '♪';
  return (w[0][0] + (w.length > 1 ? w[1][0] : '')).toUpperCase();
}
function pfAvatar(cls) {
  const c = PF_COLORS[PF.p.color] || PF_COLORS[0];
  return `<span class="pf-av ${cls || ''}" style="--a:${c[0]};--b:${c[1]}" aria-hidden="true">${esc(pfInitials(PF.p.name))}</span>`;
}
const profileAvatarBtn = () => `<button type="button" class="pf-av-btn" data-nav data-open="profile" aria-label="Buka profil">${pfAvatar('sm')}</button>`;
function pfGreet(part, fallback) { if (!PF.p.name) return fallback; const f = PF.p.name.split(/\s+/)[0]; return `${part}, ${esc(f[0].toUpperCase() + f.slice(1))}!`; }

const pfDur = (min) => { const h = Math.floor(min / 60), m = min % 60; return h ? `${h} j ${m} m` : `${m} m`; };
function pfSwitch(key, on, title, sub) {
  return `<button type="button" class="pf-row" data-nav data-pftoggle="${key}" role="switch" aria-checked="${on}"><span class="pf-t"><b>${title}</b><small>${sub}</small></span><span class="pf-sw${on ? ' on' : ''}"><i></i></span></button>`;
}
function pfSeg(key, opts, cur, title, sub) {
  return `<div class="pf-row seg"><span class="pf-t"><b>${title}</b><small>${sub}</small></span><div class="psort" role="group" aria-label="${title}">${opts.map(([v, l]) => `<button type="button" class="${String(v) === String(cur) ? 'on' : ''}" data-nav data-pfset="${key}:${v}">${l}</button>`).join('')}</div></div>`;
}
function pfAct(attr, title, sub, danger) {
  return `<button type="button" class="pf-row${danger ? ' danger' : ''}" data-nav ${attr}><span class="pf-t"><b>${title}</b><small>${sub}</small></span><span class="pf-go">›</span></button>`;
}

function profileViewHTML() {
  const month = statsRange('month'), all = statsRange('all');
  const topA = topBy(month.artists, 1)[0] || topBy(all.artists, 1)[0];
  const since = new Date(pfSince() + 'T12:00:00').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  const days = Object.keys(all.days).length;
  const pv = state.pview === 'lyrics' ? 'lyrics' : 'video';
  return `<div class="pf">
    <div class="pf-card">
      ${pfAvatar('lg')}
      <input id="pfName" class="pf-name" type="text" maxlength="24" autocomplete="off" autocapitalize="words" placeholder="Nama panggilanmu" value="${esc(PF.p.name)}" aria-label="Nama panggilan">
      <div class="pf-colors" role="group" aria-label="Warna avatar">${PF_COLORS.map((c, i) => `<button type="button" class="pf-dot${i === PF.p.color ? ' on' : ''}" data-nav data-pfcolor="${i}" style="--a:${c[0]};--b:${c[1]}" aria-label="Warna ${i + 1}" aria-pressed="${i === PF.p.color}"></button>`).join('')}</div>
      <small class="pf-since">Pendengar sejak ${esc(since)}${days ? ' · ' + days + ' hari aktif' : ''}</small>
    </div>
    <div class="pf-stats">
      <div><b>${pfDur(Math.round(month.sec / 60))}</b><small>Dengar bulan ini</small></div>
      <div><b>${month.plays}</b><small>Lagu diputar</small></div>
      <div><b class="sm">${topA ? esc(topA.key) : '–'}</b><small>Artis teratas</small></div>
    </div>
    <button class="pill big pf-recap" data-nav data-open="recap">${FI.spark}<span>Lihat Nada Recap</span></button>

    <h3 class="pf-h">Pemutaran</h3>
    <div class="pf-group">
      ${pfSeg('pview', [['video', 'Video'], ['lyrics', 'Lirik']], pv, 'Tampilan pemutar', 'Yang dibuka saat memutar lagu')}
      ${pfSeg('rate', [[1, '1×'], [1.25, '1,25×'], [1.5, '1,5×'], [2, '2×']], PD.rate, 'Kecepatan podcast', 'Berlaku untuk semua episode')}
      ${pfSwitch('official', state.official, 'Hanya musik resmi', 'Sembunyikan reupload dan cover di pencarian')}
      ${pfSwitch('autoplay', NF.autoplay, 'Putar otomatis lagu serupa', 'Lanjut sendiri saat antrean habis')}
    </div>

    <h3 class="pf-h">Data saya</h3>
    <div class="pf-group">
      ${pfAct('data-backup', 'Cadangan & pindah data', 'Simpan atau pindah ke perangkat lain')}
      ${pfAct('data-pfclear="recent"', 'Hapus riwayat putar', 'Daftar "Baru diputar" dikosongkan')}
      ${pfAct('data-pfclear="cache"', 'Kosongkan cache', 'Hasil pencarian & lirik tersimpan dibersihkan')}
      ${pfAct('data-pfclear="stats"', 'Hapus statistik dengar', 'Nada Recap dan Mix mulai dari nol', true)}
      ${pfAct('data-pfclear="all"', 'Hapus semua data', 'Suka, playlist, riwayat, dan pengaturan', true)}
    </div>

    <h3 class="pf-h">Tentang</h3>
    <div class="pf-group">
      ${pfAct('data-update', 'Perbarui aplikasi', 'Versi ' + esc(APP_V) + ' · muat ulang versi terbaru')}
      <a class="pf-row" href="/api/lyrics?debug=1" target="_blank" rel="noopener"><span class="pf-t"><b>Cek koneksi lirik</b><small>Diagnosa sumber lirik dari server</small></span><span class="pf-go">›</span></a>
    </div>
    <p class="pf-foot">Data profil tersimpan di perangkat ini dan ikut cadangan. Tidak ada akun atau login.</p>
  </div>`;
}

/* --- interaksi --- */
let pfDeb = 0;
$('#list').addEventListener('input', (e) => {
  if (e.target.id !== 'pfName') return;
  PF.p.name = e.target.value.replace(/\s+/g, ' ').slice(0, 24); clearTimeout(pfDeb); pfDeb = setTimeout(pfSave, 250);
  const av = document.querySelector('.pf-card .pf-av'); if (av) av.textContent = pfInitials(PF.p.name);
});
$('#list').addEventListener('change', (e) => { if (e.target.id === 'pfName') { PF.p.name = e.target.value.trim().slice(0, 24); pfSave(); } });
$('#list').addEventListener('click', (e) => {
  const t = e.target; let el;
  if ((el = t.closest('[data-pfcolor]'))) { PF.p.color = +el.dataset.pfcolor; pfSave(); const nm = $('#pfName'); if (nm) PF.p.name = nm.value.trim().slice(0, 24); render(); return; }
  if ((el = t.closest('[data-pftoggle]'))) {
    const k = el.dataset.pftoggle;
    if (k === 'official') { state.official = !state.official; store.set('official', state.official); if (typeof updateOfficialBtn === 'function') updateOfficialBtn(); toast(state.official ? 'Cuma musik resmi' : 'Semua hasil, termasuk reupload'); }
    else if (k === 'autoplay') { NF.autoplay = !NF.autoplay; store.set('autoplay', NF.autoplay); toast(NF.autoplay ? 'Putar otomatis aktif' : 'Putar otomatis mati'); }
    render(); return;
  }
  if ((el = t.closest('[data-pfset]'))) {
    const [k, v] = el.dataset.pfset.split(':');
    if (k === 'pview') { if (isPod()) { state.pview = v; store.set('pview', v); podSync(); } else setPview(v); }
    else if (k === 'rate') { PD.rate = +v; store.set('podRate', PD.rate); podApplyRate(true); podSync(); toast('Kecepatan podcast ' + rateTxt(PD.rate)); }
    render(); return;
  }
  if ((el = t.closest('[data-pfclear]'))) {
    const k = el.dataset.pfclear;
    const msg = { recent: 'Kosongkan daftar "Baru diputar"?', cache: 'Bersihkan cache pencarian dan lirik? Liked Songs dan playlist aman.', stats: 'Hapus semua statistik dengar? Recap dan Mix akan mulai dari nol.', all: 'HAPUS SEMUA DATA di perangkat ini (Liked Songs, playlist, riwayat, statistik, pengaturan)? Tidak bisa dibatalkan. Sudah dicadangkan?' }[k];
    if (!msg || !confirm(msg)) return;
    if (k === 'recent') { state.recent = []; store.set('recent', []); toast('Riwayat putar dihapus'); }
    else if (k === 'cache') { apiCache.m = {}; store.set(apiCache.KEY, {}); lyrCache.clear(); lyrNone.clear(); lyrDisk.m = {}; store.set('nada.lyr2', {}); PD.lists = {}; toast('Cache dibersihkan'); }
    else if (k === 'stats') { NF.stats = { v: 1, months: {} }; store.set('nada.stats', NF.stats); NF.mix = null; store.set('nada.mix', null); NF.card = { blob: null, busy: false, key: '' }; toast('Statistik dihapus'); }
    else if (k === 'all') { if (!confirm('Yakin sekali? Semua data akan hilang.')) return; try { localStorage.clear(); sessionStorage.clear(); } catch {} location.reload(); return; }
    render(); return;
  }
});
render();
