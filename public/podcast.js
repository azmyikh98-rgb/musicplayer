/* =====================================================================
   PODCAST
   Section di beranda, halaman topik, lanjutkan mendengarkan, dan mode pemutar khusus podcast
   (kecepatan putar, lompat -15/+30 dtk, posisi tersimpan, tanpa lirik).
   Dimuat setelah app.js dan features.js; terhubung lewat fungsi global yang dicek dengan typeof.
   ===================================================================== */
const PODT = [['indo', 'Indonesia', 'Podcast Indonesia'], ['komedi', 'Komedi', 'Podcast Komedi'], ['bisnis', 'Bisnis', 'Bisnis & Keuangan'], ['teknologi', 'Teknologi', 'Teknologi & Startup'],
  ['misteri', 'Misteri', 'Misteri & Kriminal'], ['psikologi', 'Psikologi', 'Psikologi & Mental'], ['religi', 'Religi', 'Religi & Kajian'], ['edukasi', 'Edukasi', 'Sejarah & Sains'],
  ['olahraga', 'Olahraga', 'Olahraga'], ['global', 'Global', 'Podcast Global']];
const PODSUB = { indo: 'Obrolan segar dari kreator Indonesia', komedi: 'Biar ketawa sambil santai', bisnis: 'Uang, karier, dan usaha', teknologi: 'AI, gadget, dan startup', misteri: 'Cerita seram dan kasus nyata',
  psikologi: 'Kenali diri dan rawat pikiran', religi: 'Renungan dan kajian santai', edukasi: 'Sejarah, sains, dan wawasan', olahraga: 'Bola dan dunia olahraga', global: 'Interview dan obrolan berbahasa Inggris' };
const PD = { lists: {}, sort: store.get('podSort', {}), pos: store.get('nada.pod', {}), rate: store.get('podRate', 1) };
const PODRATES = [1, 1.25, 1.5, 1.75, 2, 0.75];
const podTopic = (k) => PODT.find((x) => x[0] === k);
const podKey = (k) => k + ':' + (PD.sort[k] || 'new');
const rateTxt = (r) => String(r).replace('.', ',') + '×';
const podLen = (s) => { s = Math.round(s || 0); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${m}:${String(s % 60).padStart(2, '0')}`; };
const podLenTxt = (s) => { const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60); return h ? `${h} j ${m} mnt` : `${m} mnt`; };
function podAgo(iso) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  if (!(d >= 0)) return ''; if (d === 0) return 'Hari ini'; if (d === 1) return 'Kemarin'; if (d < 7) return d + ' hari lalu'; if (d < 30) return Math.floor(d / 7) + ' mgg lalu'; return Math.floor(d / 30) + ' bln lalu';
}
const podPct = (id) => { const p = PD.pos[id]; return p && p.d ? Math.min(100, (p.t / p.d) * 100) : 0; };

/* --- data --- */
function podRefresh() {
  if (state.view && state.view.ctx.startsWith('pod:')) render();
  else if (!state.view && state.tab === 'home') render();
}
async function podLoad(topic, force) {
  const k = podKey(topic), L = PD.lists[k] || (PD.lists[k] = { status: 'idle', items: [], err: '' });
  if (L.status === 'loading' || (L.status === 'ok' && !force)) return;
  const ck = 'p:' + k;
  if (!force) { const hit = apiCache.get(ck, 6 * 3600e3); if (hit && hit.items.length) { L.items = hit.items; L.status = 'ok'; return podRefresh(); } }
  L.status = 'loading'; L.err = '';
  try {
    const r = await fetch(`/api/podcasts?topic=${encodeURIComponent(topic)}&sort=${PD.sort[topic] || 'new'}`);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Podcast belum bisa dimuat, coba lagi ya.');
    L.items = d.items || []; L.status = 'ok';
    if (L.items.length) apiCache.set(ck, { items: L.items });
  } catch (e) {
    const old = apiCache.stale(ck);
    if (old && old.items.length) { L.items = old.items; L.status = 'ok'; } else { L.status = 'err'; L.err = e.message || 'Podcast belum bisa dimuat.'; }
  }
  podRefresh();
}
function podResumeList() {
  return Object.values(PD.pos).filter((p) => p.tr && p.d && p.t > 15 && p.t < p.d - 40).sort((a, b) => b.at - a.at).slice(0, 12).map((p) => p.tr);
}
function podTracks(ctx) {
  if (ctx === 'podresume') return podResumeList();
  if (ctx.startsWith('pod:')) { const L = PD.lists[podKey(ctx.slice(4))]; return L ? L.items : []; }
  return null;
}

/* --- tampilan beranda --- */
function pcardHTML(t, i, ctx) {
  const pct = podPct(t.id), playing = current() && current().id === t.id;
  return `<div class="card pcard${playing ? ' playing' : ''}" data-nav tabindex="0" role="button" data-id="${esc(t.id)}" data-play="${esc(ctx)}" data-i="${i}" aria-label="Putar ${esc(t.title)}">
    <div class="pth"><img src="${imgOf(t)}" alt="" loading="lazy">${t.dur ? `<span class="pdur">${podLen(t.dur)}</span>` : ''}${pct > 1 ? `<i class="pbar"><b style="width:${pct}%"></b></i>` : ''}</div>
    <button class="more icon-btn card-more" data-more="${esc(ctx)}:${i}" tabindex="-1" aria-label="Menu episode">${ICON.more}</button>
    <b>${esc(t.title)}</b><small>${esc(t.artist)}${t.pub ? ' · ' + podAgo(t.pub) : ''}</small>
  </div>`;
}
function podRowHTML(t, i, ctx) {
  const pct = podPct(t.id), playing = current() && current().id === t.id;
  return `<div class="row prow${playing ? ' playing' : ''}" data-nav tabindex="0" role="button" data-id="${esc(t.id)}" data-play="${esc(ctx)}" data-i="${i}" aria-label="Putar ${esc(t.title)}">
    <span class="thumb pthumb"><img src="${imgOf(t)}" alt="" loading="lazy">${playing ? '<span class="eqb" aria-hidden="true"><i></i><i></i><i></i></span>' : ''}${pct > 1 ? `<i class="pbar"><b style="width:${pct}%"></b></i>` : ''}</span>
    <div class="meta"><b>${esc(t.title)}</b><small>${esc(t.artist)}</small><small class="pmeta">${t.dur ? podLenTxt(t.dur) : ''}${t.pub ? ' · ' + podAgo(t.pub) : ''}${pct > 1 ? ' · ' + Math.round(pct) + '% didengar' : ''}</small></div>
    <div class="actions"><button class="more icon-btn" data-more="${esc(ctx)}:${i}" tabindex="-1" aria-label="Menu episode">${ICON.more}</button></div>
  </div>`;
}
function podSection() {
  podLoad('indo');
  const L = PD.lists[podKey('indo')] || { status: 'loading', items: [] };
  const chips = `<div class="pchips" role="group" aria-label="Topik podcast">${PODT.map(([k, n]) => `<button type="button" class="pchip" data-nav data-open="pod:${k}">${esc(n)}</button>`).join('')}</div>`;
  let out = zone('Podcast');
  const res = podResumeList();
  if (res.length) out += section('Lanjutkan Podcast', hscroll(res.map((t, i) => pcardHTML(t, i, 'podresume'))), '', 'Dari terakhir kamu dengar');
  let body;
  if (L.status === 'err') body = `<div class="empty sm"><b>Podcast belum bisa dimuat</b>${esc(L.err)}<br><button class="pill" data-nav data-podretry>Coba lagi</button></div>`;
  else if (L.status !== 'ok') body = hscroll(Array(3).fill('<div class="card pcard sk"><div class="pth"></div></div>'));
  else if (!L.items.length) body = '<div class="empty sm">Belum ada episode baru.</div>';
  else body = hscroll(L.items.slice(0, 12).map((t, i) => pcardHTML(t, i, 'pod:indo')));
  out += `<section class="sec"><div class="sec-head"><h2>Podcast<small class="sub">Teman ngobrol di perjalanan</small></h2><button class="link" data-nav data-open="pod:indo">Lihat semua</button></div>${chips}${body}</section>`;
  return out;
}

/* --- halaman topik --- */
function podViewHTML(topic) {
  const T = podTopic(topic); if (!T) return '';
  podLoad(topic);
  const k = podKey(topic), L = PD.lists[k] || { status: 'loading', items: [] }, ctx = 'pod:' + topic, sort = PD.sort[topic] || 'new';
  const chips = `<div class="pchips" role="group" aria-label="Topik podcast">${PODT.map(([key, n]) => `<button type="button" class="pchip${key === topic ? ' on' : ''}" data-nav data-open="pod:${key}">${esc(n)}</button>`).join('')}</div>`;
  const tabs = `<div class="psort" role="group" aria-label="Urutkan"><button type="button" class="${sort === 'new' ? 'on' : ''}" data-nav data-podsort="new">Terbaru</button><button type="button" class="${sort === 'pop' ? 'on' : ''}" data-nav data-podsort="pop">Terpopuler</button></div>`;
  let body;
  if (L.status === 'err') body = `<div class="empty"><b>Podcast belum bisa dimuat</b>${esc(L.err)}<br><button class="pill big" data-nav data-podretry>Coba lagi</button></div>`;
  else if (L.status !== 'ok') body = '<div class="skeleton"></div>'.repeat(6);
  else if (!L.items.length) body = '<div class="empty"><b>Belum ada episode</b>Coba topik atau urutan lain.</div>';
  else body = `<div class="tracks">${L.items.map((t, i) => podRowHTML(t, i, ctx)).join('')}</div>`;
  const n = L.items.length;
  return `<div class="vhero pod"><div class="vinfo"><small class="vkind">Podcast</small><h2>${esc(T[2])}</h2><p class="vsub">${esc(PODSUB[topic] || '')}${n ? ' · ' + n + ' episode' : ''}</p>
    ${n ? `<div class="vact"><button class="pill big" data-nav data-playall="${ctx}">${ICON.play}<span>Putar</span></button></div>` : ''}</div></div>${chips}${tabs}${body}`;
}

/* --- pemutar mode podcast --- */
const SKIP_BACK = 'M12 5V1L7 6l5 5V7c3.3 0 6 2.7 6 6s-2.7 6-6 6-6-2.7-6-6H4c0 4.4 3.6 8 8 8s8-3.6 8-8-3.6-8-8-8z';
const SKIP_FWD = 'M12 5V1l5 5-5 5V7c-3.3 0-6 2.7-6 6s2.7 6 6 6 6-2.7 6-6h2c0 4.4-3.6 8-8 8s-8-3.6-8-8 3.6-8 8-8z';
/* panah melingkar + angka detik di tengah; gaya ditulis inline supaya tidak ditimpa CSS tombol */
const skipIcon = (n, dir) => `<svg viewBox="0 0 24 24" class="skip" style="fill:currentColor;stroke:none"><path d="${dir === 'back' ? SKIP_BACK : SKIP_FWD}"/><text x="12" y="16.1" text-anchor="middle" style="font:800 7.6px -apple-system,system-ui,sans-serif;fill:currentColor;stroke:none">${n}</text></svg>`;
const isPod = () => { const t = current(); return !!(t && t.pod); };
let podOrig = null;
function podSync() {
  const on = isPod(), P = $('#player');
  if (!podOrig) podOrig = { shuffle: $('#shuffle').innerHTML, repeat: $('#repeat').innerHTML };
  P.classList.toggle('pod', on); document.documentElement.classList.toggle('pod-mode', on);
  P.dataset.pview = on ? 'video' : state.pview;
  const head = document.querySelector('#player .sheet-head span:nth-child(2)'); if (head) head.textContent = on ? 'Podcast' : 'Sedang diputar';
  const ab = $('#artBtn span'); if (ab) ab.textContent = on ? 'Channel' : 'Artis';
  if (P.dataset.podOn !== (on ? '1' : '0') || on) {
    if (on) {
      $('#shuffle').innerHTML = `<b class="spd">${rateTxt(PD.rate)}</b>`; $('#shuffle').classList.remove('on'); $('#shuffle').setAttribute('aria-label', 'Kecepatan putar');
      $('#prev').innerHTML = skipIcon(15, 'back'); $('#prev').setAttribute('aria-label', 'Mundur 15 detik');
      $('#next').innerHTML = skipIcon(30, 'fwd'); $('#next').setAttribute('aria-label', 'Maju 30 detik');
      $('#repeat').innerHTML = ICON.next; $('#repeat').classList.remove('on', 'one'); $('#repeat').setAttribute('aria-label', 'Episode berikutnya');
    } else if (P.dataset.podOn === '1') {
      $('#shuffle').innerHTML = podOrig.shuffle; $('#repeat').innerHTML = podOrig.repeat; $('#shuffle').setAttribute('aria-label', 'Acak'); $('#repeat').setAttribute('aria-label', 'Ulangi');
      $('#prev').setAttribute('aria-label', 'Sebelumnya'); $('#next').setAttribute('aria-label', 'Berikutnya');
      P.dataset.podOn = '0'; renderControls();   // tandai dulu supaya renderControls -> podSync tidak berulang
    }
    P.dataset.podOn = on ? '1' : '0';
  }
  try { const h = (a, f) => navigator.mediaSession.setActionHandler(a, f); h('seekbackward', on ? () => podSkip(-15) : null); h('seekforward', on ? () => podSkip(30) : null); } catch {}
}
function podSkip(d) {
  if (!ytReady || !isPod()) return;
  const cur = yt.getCurrentTime() || 0, dur = yt.getDuration() || 0;
  yt.seekTo(Math.max(0, dur ? Math.min(dur - 1, cur + d) : cur + d), true);
}
function podCycleRate() {
  const i = PODRATES.indexOf(PD.rate); PD.rate = PODRATES[(i + 1) % PODRATES.length];
  store.set('podRate', PD.rate); podApplyRate(true); podSync(); toast('Kecepatan ' + rateTxt(PD.rate));
}
function podApplyRate(force) {
  if (!ytReady || typeof yt.setPlaybackRate !== 'function') return;
  const want = isPod() ? PD.rate : 1;
  try { if (force || yt.getPlaybackRate() !== want) yt.setPlaybackRate(want); } catch {}
}
setInterval(() => podApplyRate(false), 1500);
$('.controls').addEventListener('click', (e) => {
  if (!isPod()) return;
  const b = e.target.closest('button'); if (!b) return;
  if (b.id === 'shuffle') { e.stopPropagation(); podCycleRate(); }
  else if (b.id === 'prev') { e.stopPropagation(); podSkip(-15); }
  else if (b.id === 'next') { e.stopPropagation(); podSkip(30); }
  else if (b.id === 'repeat') { e.stopPropagation(); next(false); }
}, true);

/* --- posisi tersimpan --- */
function podSave() {
  const t = current(); if (!t || !t.pod || !ytReady) return;
  const pos = yt.getCurrentTime() || 0, dur = yt.getDuration() || t.dur || 0; if (!dur || pos < 1) return;
  if (pos > dur - 30) delete PD.pos[t.id];
  else PD.pos[t.id] = { t: Math.floor(pos), d: Math.floor(dur), at: Date.now(), tr: { id: t.id, title: t.title, artist: t.artist, thumb: t.thumb, dur: Math.floor(dur), pub: t.pub, pod: 1 } };
  const ks = Object.keys(PD.pos); if (ks.length > 30) ks.sort((a, b) => PD.pos[a].at - PD.pos[b].at).slice(0, ks.length - 30).forEach((k) => delete PD.pos[k]);
  store.set('nada.pod', PD.pos);
}
setInterval(() => { if (state.playing) podSave(); }, 5000);
document.addEventListener('visibilitychange', () => { if (document.hidden) podSave(); });
function podStart(t) {   // dipanggil load(): lanjut dari posisi terakhir
  if (!t || !t.pod) return 0;
  const p = PD.pos[t.id]; if (!p || !p.d || p.t < 15 || p.t > p.d - 40) return 0;
  setTimeout(() => toast('Dilanjutkan dari ' + podLen(p.t)), 600);
  return p.t;
}

/* --- aksi di daftar --- */
$('#list').addEventListener('click', (e) => {
  const t = e.target; let el;
  if ((el = t.closest('[data-podsort]'))) { const topic = state.view && state.view.ctx.slice(4); if (!topic) return; PD.sort[topic] = el.dataset.podsort; store.set('podSort', PD.sort); podLoad(topic); render(); return; }
  if (t.closest('[data-podretry]')) { const topic = state.view ? state.view.ctx.slice(4) : 'indo'; const L = PD.lists[podKey(topic)]; if (L) L.status = 'idle'; podLoad(topic, true); render(); return; }
});
podSync();
render();
