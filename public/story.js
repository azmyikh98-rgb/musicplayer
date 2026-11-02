/* Bagikan lagu ke Story (IG, WhatsApp, dll).
   Hasilnya VIDEO pendek yang bergerak (piringan hitam berputar, visualizer, stiker bergoyang) atau gambar diam.
   Video direkam dari kanvas lewat MediaRecorder. Visualizer-nya animasi mengikuti ketukan, bukan analisis audio asli
   (audio YouTube tidak bisa dibaca dari luar iframe).
   Pakai: NadaStory.open({ id, title, artist }, { cur, dur })  (detik, opsional) */
(function () {
  const W = 1080, H = 1920, DUR = 6;           // DUR = siklus gerakan (berulang tiap 6 detik). Panjang video dipilih terpisah (LENS)
  const LENS = [10, 20, 30];                   // pilihan panjang video (detik), maksimal 30
  const getLen = () => { try { const v = +localStorage.getItem('storyLen'); return LENS.includes(v) ? v : 30; } catch (e) { return 30; } };
  const FONT_A = '"Bricolage Grotesque","SF Pro Display",system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif';
  const FONT_B = '"Permanent Marker","Marker Felt","Bradley Hand","Segoe Print","Comic Sans MS",cursive';
  const $ = (s) => document.querySelector(s);
  const TAU = Math.PI * 2;

  /* ---------- font (diambil sekali, kalau gagal pakai font bawaan) ---------- */
  let fontsP = null;
  function loadFonts() {
    if (fontsP) return fontsP;
    fontsP = new Promise((res) => {
      try {
        const l = document.createElement('link');
        l.rel = 'stylesheet';
        l.href = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;800&family=Permanent+Marker&display=swap';
        l.onload = res; l.onerror = res; document.head.appendChild(l);
        setTimeout(res, 2500);
      } catch (e) { res(); }
    }).then(() => Promise.race([
      Promise.all([document.fonts.load('800 48px "Bricolage Grotesque"'), document.fonts.load('600 48px "Bricolage Grotesque"'), document.fonts.load('48px "Permanent Marker"')]).catch(() => {}),
      new Promise((r) => setTimeout(r, 2000)),
    ]));
    return fontsP;
  }

  /* ---------- helper umum ---------- */
  const loadImg = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
  const fmt = (s) => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const hash = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rng = (seed) => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function rr(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  const squareOf = (img) => { const s = Math.min(img.width, img.height); return [(img.width - s) / 2, (img.height - s) / 2, s, s]; };
  function drawSquare(c, img, x, y, size) {
    if (!img) { const g = c.createLinearGradient(x, y, x + size, y + size); g.addColorStop(0, '#ff4f6d'); g.addColorStop(1, '#ff9a56'); c.fillStyle = g; c.fillRect(x, y, size, size); return; }
    const [sx, sy, sw, sh] = squareOf(img); c.drawImage(img, sx, sy, sw, sh, x, y, size, size);
  }
  // "blur" tanpa ctx.filter (Safari lama tidak mendukung): kecilkan lalu besarkan bertahap
  function blurCover(c, img, x, y, w, h) {
    if (!img) return;
    let cur = img, cw = img.width, ch = img.height;
    for (const t of [64, 24, 10]) {
      const k = document.createElement('canvas'); k.width = t; k.height = Math.max(2, Math.round(t * h / w));
      const kc = k.getContext('2d'); kc.imageSmoothingQuality = 'high';
      const ratio = Math.max(k.width / cw, k.height / ch);
      kc.drawImage(cur, (k.width - cw * ratio) / 2, (k.height - ch * ratio) / 2, cw * ratio, ch * ratio);
      cur = k; cw = k.width; ch = k.height;
    }
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    const ratio = Math.max(w / cw, h / ch);
    c.drawImage(cur, x + (w - cw * ratio) / 2, y + (h - ch * ratio) / 2, cw * ratio, ch * ratio);
  }
  // warna dominan dari sampul supaya tiap lagu punya nuansa sendiri
  function palette(img) {
    const fallback = { h: 345, s: 85 };
    if (!img) return fallback;
    try {
      const k = document.createElement('canvas'); k.width = k.height = 24;
      const kc = k.getContext('2d'); const [sx, sy, sw, sh] = squareOf(img); kc.drawImage(img, sx, sy, sw, sh, 0, 0, 24, 24);
      const d = kc.getImageData(0, 0, 24, 24).data; let R = 0, G = 0, B = 0, Wt = 0;
      for (let i = 0; i < d.length; i += 4) {
        const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
        const w = 0.05 + (mx - mn) / 255 * (mx / 255); R += d[i] * w; G += d[i + 1] * w; B += d[i + 2] * w; Wt += w;
      }
      R /= Wt; G /= Wt; B /= Wt;
      const mx = Math.max(R, G, B) / 255, mn = Math.min(R, G, B) / 255, dl = mx - mn;
      if (dl < 0.04) return fallback;
      let h = mx === R / 255 ? ((G - B) / 255 / dl) % 6 : mx === G / 255 ? (B - R) / 255 / dl + 2 : (R - G) / 255 / dl + 4;
      return { h: Math.round((h * 60 + 360) % 360), s: 85 };
    } catch (e) { return fallback; }
  }

  /* ---------- teks ---------- */
  function lines(c, text, maxW, maxLines) {
    const words = String(text).split(/\s+/).filter(Boolean), out = []; let cur = '';
    for (let i = 0; i < words.length; i++) {
      const t = cur ? cur + ' ' + words[i] : words[i];
      if (c.measureText(t).width <= maxW || !cur) cur = t; else { out.push(cur); cur = words[i]; }
    }
    if (cur) out.push(cur);
    if (out.length > maxLines) {
      out.length = maxLines; let last = out[maxLines - 1];
      while (last.length > 1 && c.measureText(last + '…').width > maxW) last = last.slice(0, -1);
      out[maxLines - 1] = last.replace(/[\s,.-]+$/, '') + '…';
    }
    return out.map((l) => { while (l.length > 1 && c.measureText(l).width > maxW) l = l.slice(0, -2) + '…'; return l; });
  }
  function fit(c, text, weight, family, maxW, maxLines, start, min) {
    for (let s = start; s >= min; s -= 4) {
      c.font = `${weight} ${s}px ${family}`;
      const l = lines(c, text, maxW, 99);
      if (l.length <= maxLines) return { size: s, lines: l };
    }
    c.font = `${weight} ${min}px ${family}`;
    return { size: min, lines: lines(c, text, maxW, maxLines) };
  }
  function grain(c, n, alpha, rnd) {
    for (let i = 0; i < n; i++) { c.fillStyle = rnd() > .5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`; c.fillRect(rnd() * W, rnd() * H, 2, 2); }
  }
  function sparkle(c, x, y, r, color) {
    c.save(); c.translate(x, y); c.fillStyle = color; c.beginPath();
    c.moveTo(0, -r); c.quadraticCurveTo(r * .12, -r * .12, r, 0); c.quadraticCurveTo(r * .12, r * .12, 0, r);
    c.quadraticCurveTo(-r * .12, r * .12, -r, 0); c.quadraticCurveTo(-r * .12, -r * .12, 0, -r); c.fill(); c.restore();
  }
  function logo(c, x, y, size, ink) {
    const g = c.createLinearGradient(x, y, x + size, y + size); g.addColorStop(0, '#ff4f6d'); g.addColorStop(1, '#ff9a56');
    c.fillStyle = g; c.beginPath(); c.arc(x + size / 2, y + size / 2, size / 2, 0, TAU); c.fill();
    c.save(); c.translate(x, y); c.scale(size / 512, size / 512); c.fillStyle = ink || '#0e0e13';
    c.translate(30, 20); c.scale(.92, .92); c.fill(new Path2D('M215 180v152a44 44 0 1 1-24-39V204l112-28v112a44 44 0 1 1-24-39V150z')); c.restore();
  }
  const noShadow = (c) => { c.shadowBlur = 0; c.shadowColor = 'transparent'; c.shadowOffsetX = 0; c.shadowOffsetY = 0; };

  /* ---------- gerakan: ketukan dan visualizer (berulang rapi tiap DUR detik) ---------- */
  const beatOf = (t) => Math.pow(.5 + .5 * Math.cos(TAU * 2 * t), 3);   // 120 bpm
  function level(t, i, n, ph) {
    const A = [2, 4, 6][i % 3], B = [3, 5, 7, 4][i % 4];
    const env = Math.sin(Math.PI * (i + .5) / n);
    let v = .4 + .24 * Math.sin(TAU * A * t / DUR + i * .9 + ph) + .18 * Math.sin(TAU * B * t / DUR + i * 1.7 + ph * 2);
    v += .09 * Math.sin(TAU * t / 30 * (1 + i % 4) + i * 2.3 + ph);   // melayang pelan: siklus penuh 30 detik
    v *= (.55 + .5 * env) * (.62 + .55 * beatOf(t) * (.55 + .45 * env));
    return clamp(v, .07, 1);
  }

  /* Setiap template punya:
       layers(d, w, h) -> bagian statis yang digambar SEKALI ke kanvas tersembunyi (hemat tenaga HP)
       frame(c, d, t, L) -> gambar satu frame pada detik ke-t (c sudah diskalakan ke koordinat 1080x1920) */
  function mkLayer(w, h, fn) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c = cv.getContext('2d'); c.scale(w / W, w / W); c.textBaseline = 'alphabetic'; fn(c); return cv;
  }

  /* =====================================================================
     TEMPLATE 1: Neon Vinyl  (piringan berputar, visualizer, partikel)
     ===================================================================== */
  const VX = 760, VY = 830, VR = 340;
  const NEON = {
    layers(d, w, h) {
      const { h: hue } = d.pal, rnd = rng(hash(d.id));
      const back = mkLayer(w, h, (c) => {
        c.fillStyle = '#0a0a10'; c.fillRect(0, 0, W, H);
        c.globalAlpha = .55; blurCover(c, d.img, -200, -200, W + 400, H + 400); c.globalAlpha = 1;
        c.fillStyle = 'rgba(8,8,14,.62)'; c.fillRect(0, 0, W, H);
        let g = c.createRadialGradient(150, 380, 0, 150, 380, 900); g.addColorStop(0, `hsla(${hue},95%,58%,.55)`); g.addColorStop(1, 'transparent'); c.fillStyle = g; c.fillRect(0, 0, W, H);
        g = c.createRadialGradient(1000, 1500, 0, 1000, 1500, 900); g.addColorStop(0, `hsla(${(hue + 55) % 360},95%,55%,.45)`); g.addColorStop(1, 'transparent'); c.fillStyle = g; c.fillRect(0, 0, W, H);
        grain(c, 5000, .035, rnd);
      });
      const mid = mkLayer(w, h, (c) => {              // badan piringan (tidak berputar terlihat: hanya alur)
        c.save(); c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 60; c.shadowOffsetY = 20;
        c.beginPath(); c.arc(VX, VY, VR, 0, TAU); c.fillStyle = '#0c0c10'; c.fill(); c.restore();
        c.lineWidth = 2; for (let r = 130; r < VR - 8; r += 14) { c.beginPath(); c.arc(VX, VY, r, 0, TAU); c.strokeStyle = `rgba(255,255,255,${r % 28 ? .035 : .07})`; c.stroke(); }
      });
      const front = mkLayer(w, h, (c) => {
        // chip
        c.font = `800 34px ${FONT_A}`; const label = 'LAGI DENGERIN'; const cw = c.measureText(label).width + 130, cx = 100, cy = 250;
        rr(c, cx, cy, cw, 84, 42); c.fillStyle = 'rgba(255,255,255,.08)'; c.fill();
        c.lineWidth = 3; c.strokeStyle = `hsla(${hue},100%,70%,.9)`; c.shadowColor = `hsla(${hue},100%,60%,.9)`; c.shadowBlur = 24; c.stroke(); noShadow(c);
        c.fillStyle = '#fff'; c.textBaseline = 'middle'; c.fillText(label, cx + 76, cy + 44); c.textBaseline = 'alphabetic';
        // sampul
        c.save(); c.translate(380, VY); c.rotate(-.05);
        c.shadowColor = `hsla(${hue},100%,55%,.55)`; c.shadowBlur = 90; c.shadowOffsetY = 30; rr(c, -310, -310, 620, 620, 52); c.fillStyle = '#111'; c.fill(); noShadow(c);
        c.save(); rr(c, -310, -310, 620, 620, 52); c.clip(); drawSquare(c, d.img, -310, -310, 620); c.restore();
        rr(c, -310, -310, 620, 620, 52); c.lineWidth = 4; c.strokeStyle = 'rgba(255,255,255,.28)'; c.stroke(); c.restore();
        // judul + artis
        const mw = W - 200, t = fit(c, d.title, 800, FONT_A, mw, 2, 100, 56);
        c.fillStyle = '#fff'; c.shadowColor = `hsla(${hue},100%,60%,.55)`; c.shadowBlur = 30;
        const ty = 1310; t.lines.forEach((l, i) => c.fillText(l, 100, ty + i * (t.size * 1.08))); noShadow(c);
        const ay = ty + (t.lines.length - 1) * (t.size * 1.08) + 84;
        const a = fit(c, d.artist, 600, FONT_A, mw, 1, 52, 34); c.fillStyle = `hsl(${hue},100%,76%)`; c.fillText(a.lines[0], 100, ay);
        // merek
        logo(c, 100, 1716, 56); c.font = `800 38px ${FONT_A}`; c.fillStyle = '#fff'; c.fillText('Nada', 172, 1757);
        c.font = `600 30px ${FONT_A}`; c.fillStyle = 'rgba(255,255,255,.55)'; c.textAlign = 'right'; c.fillText('dengerin juga di Nada', W - 100, 1757); c.textAlign = 'left';
      });
      const pr = rng(hash(d.id) + 7);
      const parts = Array.from({ length: 18 }, () => ({ x: 60 + pr() * 960, ph: pr(), r: 3 + pr() * 7, sway: 20 + pr() * 40 }));
      return { back, mid, front, parts };
    },
    frame(c, d, t, L) {
      const hue = d.pal.h, beat = beatOf(t), ph = (hash(d.id) % 628) / 100;
      c.drawImage(L.back, 0, 0, W, H);
      // cahaya berdenyut mengikuti ketukan
      let g = c.createRadialGradient(560, VY, 80, 560, VY, 760); g.addColorStop(0, `hsla(${hue},100%,62%,${.1 + .16 * beat})`); g.addColorStop(1, 'transparent'); c.fillStyle = g; c.fillRect(0, 250, W, 1250);
      // partikel naik
      for (const p of L.parts) {
        const q = ((t / DUR) + p.ph) % 1, y = 1700 - q * 1350, x = p.x + Math.sin(q * TAU) * p.sway, a = Math.sin(Math.PI * q) * .55;
        c.fillStyle = `hsla(${(hue + p.ph * 70) % 360},100%,75%,${a})`; c.beginPath(); c.arc(x, y, p.r, 0, TAU); c.fill();
      }
      c.drawImage(L.mid, 0, 0, W, H);
      // piringan berputar: kilau + label (cover) yang ikut berputar
      c.save(); c.translate(VX, VY); c.rotate(t / DUR * TAU * 2);
      let sg = c.createRadialGradient(0, 0, 130, 0, 0, VR); sg.addColorStop(0, 'rgba(255,255,255,.02)'); sg.addColorStop(1, 'rgba(255,255,255,.11)'); c.fillStyle = sg; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, VR - 4, -.3, .3); c.closePath(); c.fill();
      c.globalAlpha = .6; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, VR - 4, Math.PI - .3, Math.PI + .3); c.closePath(); c.fill(); c.globalAlpha = 1;
      c.save(); c.beginPath(); c.arc(0, 0, 120, 0, TAU); c.clip(); drawSquare(c, d.img, -120, -120, 240); c.restore();
      c.beginPath(); c.arc(0, 0, 120, 0, TAU); c.lineWidth = 6; c.strokeStyle = `hsl(${hue},100%,68%)`; c.stroke();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(92, 0, 9, 0, TAU); c.fill();     // penanda supaya putarannya terlihat jelas
      c.fillStyle = '#0a0a10'; c.beginPath(); c.arc(0, 0, 22, 0, TAU); c.fill(); c.restore();
      c.drawImage(L.front, 0, 0, W, H);
      // titik chip berdenyut + equalizer kanan atas
      c.fillStyle = `hsl(${hue},100%,72%)`; c.shadowColor = `hsl(${hue},100%,65%)`; c.shadowBlur = 22; c.beginPath(); c.arc(144, 292, 11 + 4 * beat, 0, TAU); c.fill(); noShadow(c);
      for (let i = 0; i < 5; i++) {
        const hh = 20 + 80 * level(t, i * 3 + 1, 15, ph); rr(c, 800 + i * 36, 292 - hh, 20, hh, 10);
        const eg = c.createLinearGradient(0, 292 - hh, 0, 292); eg.addColorStop(0, `hsl(${hue},100%,72%)`); eg.addColorStop(1, `hsl(${(hue + 55) % 360},100%,62%)`); c.fillStyle = eg; c.fill();
      }
      // visualizer pengganti progress bar
      const n = 36, bw = 16, gap = (W - 200 - n * bw) / (n - 1), base = 1630, maxH = 200;
      for (let i = 0; i < n; i++) {
        const hh = Math.max(14, maxH * level(t, i, n, ph)), x = 100 + i * (bw + gap), col = `hsl(${(hue + i / n * 60) % 360},100%,${66 + 8 * beat}%)`;
        rr(c, x, base - hh, bw, hh, 8); c.fillStyle = col; c.fill();
        rr(c, x, base + 10, bw, hh * .28, 8); c.fillStyle = `hsla(${(hue + i / n * 60) % 360},100%,70%,.16)`; c.fill();
      }
    },
  };

  /* =====================================================================
     TEMPLATE 2: Y2K Polaroid  (polaroid bergoyang, stiker, not musik)
     ===================================================================== */
  const PW = 800, PH = 1010, PAD = 150;
  const Y2K = {
    layers(d, w, h) {
      const hue = d.pal.h, h2 = (hue + 48) % 360, rnd = rng(hash(d.id));
      const back = mkLayer(w, h, (c) => {
        const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, `hsl(${hue},95%,66%)`); g.addColorStop(.55, `hsl(${(hue + 24) % 360},95%,70%)`); g.addColorStop(1, `hsl(${h2},95%,68%)`);
        c.fillStyle = g; c.fillRect(0, 0, W, H);
        c.fillStyle = 'rgba(255,255,255,.22)';
        for (let y = 0; y < 560; y += 46) for (let x = (y / 46) % 2 ? 23 : 0; x < W; x += 46) { const r = 14 * (1 - y / 600); if (r > 1) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); } }
        for (let y = H - 520; y < H; y += 46) for (let x = (y / 46) % 2 ? 23 : 0; x < W; x += 46) { const r = 14 * ((y - (H - 520)) / 520); if (r > 1) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); } }
        c.fillStyle = `hsla(${(hue + 180) % 360},95%,72%,.35)`; c.beginPath(); c.arc(960, 330, 230, 0, TAU); c.fill();
        c.fillStyle = 'rgba(255,255,255,.28)'; c.beginPath(); c.arc(80, 1480, 200, 0, TAU); c.fill();
        grain(c, 4500, .04, rnd);
      });
      // kartu polaroid lengkap (bayangan, foto, tulisan, selotip) digambar sekali, lalu hanya digoyang
      const cw = PW + PAD * 2, ch = PH + PAD * 2, k = w / W;
      const card = document.createElement('canvas'); card.width = Math.round(cw * k); card.height = Math.round(ch * k);
      const cc = card.getContext('2d'); cc.scale(k, k); cc.translate(cw / 2, ch / 2);
      cc.shadowColor = 'rgba(40,0,40,.4)'; cc.shadowBlur = 70; cc.shadowOffsetY = 40; rr(cc, -PW / 2, -PH / 2, PW, PH, 14); cc.fillStyle = '#fffdf8'; cc.fill(); noShadow(cc);
      const px = -PW / 2 + 50, py = -PH / 2 + 50, ps = PW - 100;
      cc.save(); cc.beginPath(); cc.rect(px, py, ps, ps); cc.clip(); drawSquare(cc, d.img, px, py, ps);
      const sg = cc.createLinearGradient(px, py, px + ps, py + ps); sg.addColorStop(0, 'rgba(255,255,255,.18)'); sg.addColorStop(.5, 'rgba(255,255,255,0)'); sg.addColorStop(1, `hsla(${h2},100%,60%,.18)`); cc.fillStyle = sg; cc.fillRect(px, py, ps, ps); cc.restore();
      cc.lineWidth = 3; cc.strokeStyle = 'rgba(0,0,0,.12)'; cc.strokeRect(px, py, ps, ps);
      const capY = py + ps + 40, mw = PW - 120, t = fit(cc, d.title, 400, FONT_B, mw, 2, 66, 40);
      cc.fillStyle = '#16121c'; t.lines.forEach((l, i) => cc.fillText(l, px + 10, capY + 62 + i * (t.size * 1.12)));
      const ay = capY + 62 + (t.lines.length - 1) * (t.size * 1.12) + 56, a = fit(cc, d.artist, 700, FONT_A, mw, 1, 36, 26);
      cc.fillStyle = `hsl(${hue},75%,40%)`; cc.fillText(a.lines[0], px + 10, ay);
      for (const [tx, ty, rot] of [[-PW / 2 + 80, -PH / 2 + 10, -.5], [PW / 2 - 80, -PH / 2 + 10, .5]]) {
        cc.save(); cc.translate(tx, ty); cc.rotate(rot); cc.fillStyle = 'rgba(255,236,120,.82)'; cc.fillRect(-90, -30, 180, 60);
        cc.fillStyle = 'rgba(255,255,255,.35)'; for (let kx = -80; kx < 90; kx += 24) cc.fillRect(kx, -30, 8, 60); cc.restore();
      }
      const front = mkLayer(w, h, (c) => {            // kapsul mini player + merek
        const mx = 120, my = 1500, mwid = W - 240, mh = 120;
        rr(c, mx + 6, my + 8, mwid, mh, 60); c.fillStyle = '#111'; c.fill();
        rr(c, mx, my, mwid, mh, 60); c.fillStyle = '#fff'; c.fill(); c.lineWidth = 6; c.strokeStyle = '#111'; c.stroke();
        c.fillStyle = '#111'; c.beginPath(); c.arc(mx + 66, my + 60, 38, 0, TAU); c.fill();
        c.fillStyle = '#fff'; c.fillRect(mx + 53, my + 44, 10, 32); c.fillRect(mx + 70, my + 44, 10, 32);      // ikon jeda = sedang diputar
        c.textBaseline = 'middle'; logo(c, 120, 1686, 58, '#fff'); c.font = `800 40px ${FONT_A}`; c.fillStyle = '#111'; c.fillText('Nada', 194, 1717);
        c.font = `36px ${FONT_B}`; c.textAlign = 'right'; c.fillText('dengerin bareng yuk!', W - 120, 1717); c.textAlign = 'left'; c.textBaseline = 'alphabetic';
      });
      return { back, card, front, cw, ch };
    },
    frame(c, d, t, L) {
      const hue = d.pal.h, beat = beatOf(t), ph = (hash(d.id) % 628) / 100;
      c.drawImage(L.back, 0, 0, W, H);
      // sparkle berkedip
      const tw = (o) => .55 + .45 * Math.sin(TAU * t / DUR * 2 + o);
      sparkle(c, 880, 230, 70 * tw(0), '#fff'); sparkle(c, 960, 330, 36 * tw(1.7), '#fff'); sparkle(c, 790, 330, 26 * tw(3), '#111');
      sparkle(c, 150, 1400, 44 * tw(2.4), '#fff'); sparkle(c, 230, 1455, 22 * tw(4.1), '#111'); sparkle(c, 930, 1630, 34 * tw(5), '#fff');
      // not musik naik di tepi kiri-kanan (di belakang polaroid supaya tidak menutupi tulisan)
      c.textBaseline = 'middle';
      for (let i = 0; i < 6; i++) {
        const q = ((t / DUR) + i / 6) % 1, side = i % 2 ? 1 : -1, x = W / 2 + side * (500 + (i % 3) * 14) + Math.sin(q * TAU * 2 + i) * 26, y = 1500 - q * 1050, a = Math.sin(Math.PI * q);
        c.save(); c.translate(x, y); c.rotate(Math.sin(q * TAU + i) * .4); c.globalAlpha = a * .95; c.font = `${80 + (i % 2) * 28}px ${FONT_A}`; c.fillStyle = i % 2 ? '#111' : '#fff'; c.textAlign = 'center'; c.fillText(i % 3 ? '♪' : '♫', 0, 0); c.restore();
      }
      c.textBaseline = 'alphabetic'; c.textAlign = 'left';
      // polaroid bergoyang pelan
      c.save(); c.translate(W / 2, 880 + 12 * Math.sin(TAU * t / DUR * 2)); c.rotate(.045 + .016 * Math.sin(TAU * t / DUR));
      c.drawImage(L.card, -L.cw / 2, -L.ch / 2, L.cw, L.ch); c.restore();
      // stiker bintang "on repeat" bergoyang dan berdenyut
      c.save(); c.translate(870, 1330); c.rotate(.2 + .14 * Math.sin(TAU * t / DUR * 2)); const sc = 1 + .06 * beat; c.scale(sc, sc);
      c.beginPath(); for (let i = 0; i < 24; i++) { const r = i % 2 ? 98 : 124, a2 = i / 24 * TAU; c.lineTo(Math.cos(a2) * r, Math.sin(a2) * r); } c.closePath();
      c.fillStyle = '#111'; c.save(); c.translate(7, 9); c.fill(); c.restore(); c.fillStyle = '#ffe14a'; c.fill(); c.lineWidth = 6; c.strokeStyle = '#111'; c.stroke();
      c.fillStyle = '#111'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `46px ${FONT_B}`; c.fillText('on', 0, -26); c.fillText('repeat', 0, 30); c.restore();
      c.textAlign = 'left'; c.textBaseline = 'alphabetic';
      // stiker NOW PLAYING bergoyang
      c.save(); c.translate(250, 262); c.rotate(-.1 + .035 * Math.sin(TAU * t / DUR * 2 + 1));
      c.font = `800 42px ${FONT_A}`; const label = 'NOW PLAYING', lw = c.measureText(label).width + 150;
      rr(c, -lw / 2 + 8, -34, lw, 92, 46); c.fillStyle = '#111'; c.fill();
      rr(c, -lw / 2, -44, lw, 92, 46); c.fillStyle = '#fff'; c.fill(); c.lineWidth = 6; c.strokeStyle = '#111'; c.stroke();
      c.textBaseline = 'middle'; c.font = '46px sans-serif'; c.fillStyle = '#111'; c.fillText('🎧', -lw / 2 + 28, 4);
      c.font = `800 42px ${FONT_A}`; c.fillText(label, -lw / 2 + 98, 5); c.restore(); c.textBaseline = 'alphabetic';
      // kapsul mini player + visualizer pengganti progress bar
      c.drawImage(L.front, 0, 0, W, H);
      const mx = 120, my = 1500, mwid = W - 240, bx = mx + 130, bw = mwid - 130 - 60, n = 24, bwid = 12, gap = (bw - n * bwid) / (n - 1);
      for (let i = 0; i < n; i++) {
        const hh = Math.max(18, 92 * level(t, i, n, ph)), x = bx + i * (bwid + gap);
        rr(c, x, my + 60 - hh / 2, bwid, hh, 6); c.fillStyle = i % 4 === 3 ? '#111' : `hsl(${hue},90%,52%)`; c.fill();
      }
    },
  };

  /* =====================================================================
     TEMPLATE 3: Aurora Glass  (cahaya aurora melayang, kartu kaca, progres bergerak)
     ===================================================================== */
  const AURORA = {
    layers(d, w, h) {
      const hue = d.pal.h, rnd = rng(hash(d.id) + 3);
      const back = mkLayer(w, h, (c) => {
        c.fillStyle = `hsl(${hue},45%,8%)`; c.fillRect(0, 0, W, H);
        c.globalAlpha = .5; blurCover(c, d.img, -300, -300, W + 600, H + 600); c.globalAlpha = 1;
        c.fillStyle = `hsla(${hue},50%,6%,.55)`; c.fillRect(0, 0, W, H);
        grain(c, 4500, .03, rnd);
      });
      const CX = 140, CY = 360, CW = W - 280, CH = 1130;   // kartu kaca
      const card = mkLayer(w, h, (c) => {
        c.save(); c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = 90; c.shadowOffsetY = 40; rr(c, CX, CY, CW, CH, 70); c.fillStyle = 'rgba(255,255,255,.08)'; c.fill(); c.restore();
        c.save(); rr(c, CX, CY, CW, CH, 70); c.clip();
        c.globalAlpha = .5; blurCover(c, d.img, CX - 60, CY - 60, CW + 120, CH + 120); c.globalAlpha = 1;
        const g = c.createLinearGradient(CX, CY, CX + CW, CY + CH); g.addColorStop(0, 'rgba(255,255,255,.26)'); g.addColorStop(.5, 'rgba(255,255,255,.08)'); g.addColorStop(1, `hsla(${(hue + 40) % 360},100%,70%,.16)`);
        c.fillStyle = g; c.fillRect(CX, CY, CW, CH); c.restore();
        rr(c, CX, CY, CW, CH, 70); c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,.4)'; c.stroke();
        // sampul
        const s = 580, sx = W / 2 - s / 2, sy = CY + 90;
        c.save(); c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 60; c.shadowOffsetY = 28; rr(c, sx, sy, s, s, 48); c.fillStyle = '#111'; c.fill(); c.restore();
        c.save(); rr(c, sx, sy, s, s, 48); c.clip(); drawSquare(c, d.img, sx, sy, s); c.restore();
        rr(c, sx, sy, s, s, 48); c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,.35)'; c.stroke();
        // teks
        const mw = CW - 120, t = fit(c, d.title, 800, FONT_A, mw, 2, 78, 48);
        c.textAlign = 'center'; c.fillStyle = '#fff'; const ty = sy + s + 120;
        t.lines.forEach((l, i) => c.fillText(l, W / 2, ty + i * (t.size * 1.1)));
        const ay = ty + (t.lines.length - 1) * (t.size * 1.1) + 70, a = fit(c, d.artist, 600, FONT_A, mw, 1, 44, 30);
        c.fillStyle = `hsl(${hue},100%,80%)`; c.fillText(a.lines[0], W / 2, ay); c.textAlign = 'left';
      });
      const front = mkLayer(w, h, (c) => {
        c.font = `800 34px ${FONT_A}`; const label = 'SEDANG DIPUTAR', lw = c.measureText(label).width + 90;
        rr(c, W / 2 - lw / 2, 190, lw, 80, 40); c.fillStyle = 'rgba(255,255,255,.12)'; c.fill(); c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,.4)'; c.stroke();
        c.fillStyle = '#fff'; c.textBaseline = 'middle'; c.textAlign = 'center'; c.fillText(label, W / 2 + 22, 232); c.textAlign = 'left'; c.textBaseline = 'alphabetic';
        logo(c, W / 2 - 150, 1640, 64); c.font = `800 44px ${FONT_A}`; c.fillStyle = '#fff'; c.fillText('Nada', W / 2 - 70, 1686);
        c.font = `600 30px ${FONT_A}`; c.fillStyle = 'rgba(255,255,255,.55)'; c.textAlign = 'center'; c.fillText('dengerin juga di Nada', W / 2, 1768); c.textAlign = 'left';
      });
      return { back, card, front };
    },
    frame(c, d, t, L) {
      const hue = d.pal.h, beat = beatOf(t), ph = (hash(d.id) % 628) / 100, u = t / DUR * TAU;
      c.drawImage(L.back, 0, 0, W, H);
      // aurora: tiga cahaya besar melayang pelan
      const blobs = [[hue, 220, 420, 150, 90], [(hue + 55) % 360, 880, 760, 130, 110], [(hue + 300) % 360, 420, 1440, 170, 80]];
      c.globalCompositeOperation = 'screen';
      blobs.forEach(([hh, x, y, rx, ry], i) => {
        const bx = x + Math.sin(u + i * 2.1) * rx, by = y + Math.cos(u + i * 1.3) * ry, r = 620 + 40 * Math.sin(u * 2 + i);
        const g = c.createRadialGradient(bx, by, 0, bx, by, r); g.addColorStop(0, `hsla(${hh},95%,58%,${.5 + .08 * beat})`); g.addColorStop(1, 'transparent');
        c.fillStyle = g; c.fillRect(0, 0, W, H);
      });
      c.globalCompositeOperation = 'source-over';
      // cincin berdenyut di belakang sampul
      for (let k = 0; k < 2; k++) {
        const q = ((t / DUR * 2) + k * .5) % 1; c.beginPath(); c.arc(W / 2, 740, 330 + q * 260, 0, TAU);
        c.lineWidth = 4; c.strokeStyle = `hsla(${hue},100%,75%,${(1 - q) * .35})`; c.stroke();
      }
      c.drawImage(L.card, 0, 0, W, H);
      // progres: pakai posisi lagu asli kalau ada, kalau tidak berjalan berulang
      const bx = 220, bw = W - 440, by = 1405, has = d.dur > 0;
      const p = has ? clamp((d.cur + t) / d.dur, 0, 1) : (t / DUR);
      rr(c, bx, by, bw, 12, 6); c.fillStyle = 'rgba(255,255,255,.22)'; c.fill();
      const pw = Math.max(16, bw * p); rr(c, bx, by, pw, 12, 6); const pg = c.createLinearGradient(bx, 0, bx + bw, 0); pg.addColorStop(0, `hsl(${hue},100%,72%)`); pg.addColorStop(1, `hsl(${(hue + 55) % 360},100%,72%)`); c.fillStyle = pg; c.fill();
      c.fillStyle = '#fff'; c.shadowColor = `hsl(${hue},100%,70%)`; c.shadowBlur = 24; c.beginPath(); c.arc(bx + pw, by + 6, 16 + 3 * beat, 0, TAU); c.fill(); noShadow(c);
      c.font = `600 30px ${FONT_A}`; c.fillStyle = 'rgba(255,255,255,.75)';
      c.fillText(has ? fmt(d.cur + t) : fmt(t), bx, by + 62); c.textAlign = 'right'; c.fillText(has ? fmt(d.dur) : '∞', bx + bw, by + 62); c.textAlign = 'left';
      // gelombang mini di atas progres
      for (let i = 0; i < 5; i++) { const hh = 14 + 46 * level(t, i * 3 + 1, 15, ph); rr(c, W / 2 - 80 + i * 36, 1340 - hh, 18, hh, 9); c.fillStyle = `hsla(${hue},100%,80%,.9)`; c.fill(); }
      c.drawImage(L.front, 0, 0, W, H);
      c.fillStyle = `hsl(${hue},100%,72%)`; c.shadowColor = `hsl(${hue},100%,65%)`; c.shadowBlur = 20; c.beginPath(); c.arc(W / 2 - 150, 231, 9 + 3 * beat, 0, TAU); c.fill(); noShadow(c);
    },
  };

  /* =====================================================================
     TEMPLATE 4: Kaset Retro  (kaset dengan roda berputar, label tulisan tangan)
     ===================================================================== */
  const CAS = { x: 90, y: 560, w: 900, h: 600 };
  const CASSETTE = {
    layers(d, w, h) {
      const hue = d.pal.h, rnd = rng(hash(d.id) + 11);
      const back = mkLayer(w, h, (c) => {
        const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, `hsl(${(hue + 12) % 360},70%,86%)`); g.addColorStop(1, `hsl(${(hue + 340) % 360},65%,78%)`);
        c.fillStyle = g; c.fillRect(0, 0, W, H);
        c.fillStyle = `hsla(${hue},70%,45%,.12)`; for (let y = 60; y < H; y += 60) c.fillRect(0, y, W, 3);      // garis seperti buku catatan
        c.fillStyle = `hsla(${(hue + 40) % 360},85%,60%,.5)`; c.beginPath(); c.arc(960, 230, 190, 0, TAU); c.fill();
        c.fillStyle = 'rgba(255,255,255,.4)'; c.beginPath(); c.arc(70, 1640, 230, 0, TAU); c.fill();
        grain(c, 7000, .05, rnd);
      });
      const bodyW = CAS.w, bodyH = CAS.h, k = w / W, pad = 80;
      const body = document.createElement('canvas'); body.width = Math.round((bodyW + pad * 2) * k); body.height = Math.round((bodyH + pad * 2) * k);
      const cc = body.getContext('2d'); cc.scale(k, k); cc.translate(pad, pad); cc.textBaseline = 'alphabetic';
      cc.shadowColor = 'rgba(40,10,30,.45)'; cc.shadowBlur = 60; cc.shadowOffsetY = 36; rr(cc, 0, 0, bodyW, bodyH, 48); cc.fillStyle = '#1b1620'; cc.fill(); noShadow(cc);
      const bg = cc.createLinearGradient(0, 0, 0, bodyH); bg.addColorStop(0, '#2a2330'); bg.addColorStop(1, '#14101a'); rr(cc, 0, 0, bodyW, bodyH, 48); cc.fillStyle = bg; cc.fill();
      // label (stiker) berisi sampul + judul tulisan tangan
      const lx = 60, ly = 50, lw = bodyW - 120, lh = 330;
      rr(cc, lx, ly, lw, lh, 26); cc.fillStyle = '#fff6e5'; cc.fill();
      cc.save(); rr(cc, lx, ly, lw, lh, 26); cc.clip();
      cc.fillStyle = `hsl(${hue},85%,58%)`; cc.fillRect(lx, ly, lw, 62); cc.fillStyle = `hsl(${(hue + 50) % 360},90%,62%)`; cc.fillRect(lx, ly + 62, lw, 14);
      cc.restore();
      cc.fillStyle = '#fff'; cc.font = `800 32px ${FONT_A}`; cc.textBaseline = 'middle'; cc.fillText('SIDE A', lx + 28, ly + 33);
      cc.textAlign = 'right'; cc.fillText('NADA TAPE · 90 MIN', lx + lw - 28, ly + 33); cc.textAlign = 'left'; cc.textBaseline = 'alphabetic';
      const cs = 196, cx0 = lx + 28, cy0 = ly + 106;
      cc.save(); rr(cc, cx0, cy0, cs, cs, 18); cc.clip(); drawSquare(cc, d.img, cx0, cy0, cs); cc.restore(); rr(cc, cx0, cy0, cs, cs, 18); cc.lineWidth = 4; cc.strokeStyle = '#1b1620'; cc.stroke();
      const tx = cx0 + cs + 34, mw = lw - cs - 28 * 2 - 34, t = fit(cc, d.title, 400, FONT_B, mw, 2, 60, 36);
      cc.fillStyle = '#1b1620'; t.lines.forEach((l, i) => cc.fillText(l, tx, cy0 + 56 + i * (t.size * 1.12)));
      const ay = cy0 + 56 + (t.lines.length - 1) * (t.size * 1.12) + 52, a = fit(cc, d.artist, 700, FONT_A, mw, 1, 34, 24);
      cc.fillStyle = `hsl(${hue},70%,38%)`; cc.fillText(a.lines[0], tx, ay);
      cc.fillStyle = '#1b1620'; for (let i = 0; i < 3; i++) cc.fillRect(tx, cy0 + cs - 18 + i * 0, 0, 0);
      // jendela pita (bawah) + sekrup
      rr(cc, 190, 420, bodyW - 380, 130, 65); cc.fillStyle = '#0a080d'; cc.fill(); cc.lineWidth = 4; cc.strokeStyle = 'rgba(255,255,255,.18)'; cc.stroke();
      for (const [sx, sy] of [[40, 40], [bodyW - 40, 40], [40, bodyH - 40], [bodyW - 40, bodyH - 40]]) { cc.fillStyle = '#4a4252'; cc.beginPath(); cc.arc(sx, sy, 11, 0, TAU); cc.fill(); cc.fillStyle = '#1b1620'; cc.fillRect(sx - 8, sy - 2, 16, 4); }
      const front = mkLayer(w, h, (c) => {
        c.font = `800 36px ${FONT_A}`; c.fillStyle = '#1b1620'; c.fillText('♪ LAGI DIPUTAR', 100, 250);
        c.font = `64px ${FONT_B}`; c.fillStyle = '#1b1620'; c.fillText('mixtape', 100, 340);
        logo(c, 100, 1716, 60, '#fff'); c.font = `800 40px ${FONT_A}`; c.fillStyle = '#1b1620'; c.fillText('Nada', 176, 1760);
        c.font = `38px ${FONT_B}`; c.textAlign = 'right'; c.fillText('dengerin bareng yuk!', W - 100, 1760); c.textAlign = 'left';
      });
      return { back, body, front, pad };
    },
    frame(c, d, t, L) {
      const hue = d.pal.h, beat = beatOf(t), u = t / DUR * TAU;
      c.drawImage(L.back, 0, 0, W, H);
      // not musik naik
      c.textBaseline = 'middle'; c.textAlign = 'center';
      for (let i = 0; i < 6; i++) {
        const q = ((t / DUR) + i / 6) % 1, x = 160 + (i * 163) % 780 + Math.sin(q * TAU * 2 + i) * 24, y = 520 - q * 340, a = Math.sin(Math.PI * q);
        c.save(); c.translate(x, y); c.rotate(Math.sin(q * TAU + i) * .4); c.globalAlpha = a * .9; c.font = `${70 + (i % 2) * 24}px ${FONT_A}`; c.fillStyle = i % 2 ? `hsl(${hue},80%,40%)` : '#fff'; c.fillText(i % 3 ? '♪' : '♫', 0, 0); c.restore();
      }
      c.textBaseline = 'alphabetic'; c.textAlign = 'left';
      // kaset bergoyang pelan
      c.save(); c.translate(CAS.x + CAS.w / 2, CAS.y + CAS.h / 2 + 10 * Math.sin(u * 2)); c.rotate(-.05 + .014 * Math.sin(u));
      c.translate(-CAS.w / 2, -CAS.h / 2); c.drawImage(L.body, -L.pad, -L.pad, CAS.w + L.pad * 2, CAS.h + L.pad * 2);
      // pita + roda berputar di jendela
      const wy = 485, lx = 305, rx = CAS.w - 305;
      const lr = 52 + 20 * (1 - (t / DUR)), rrad = 52 + 20 * (t / DUR);       // pita pindah dari kiri ke kanan
      c.fillStyle = '#5a3a24'; for (const [x, r] of [[lx, lr], [rx, rrad]]) { c.beginPath(); c.arc(x, wy, r, 0, TAU); c.fill(); }
      for (const x of [lx, rx]) {
        c.save(); c.translate(x, wy); c.rotate(u * 3 * (x === lx ? 1 : 1));
        c.fillStyle = '#efe8dc'; c.beginPath(); c.arc(0, 0, 38, 0, TAU); c.fill();
        c.fillStyle = '#1b1620'; for (let i = 0; i < 6; i++) { c.save(); c.rotate(i * TAU / 6); c.fillRect(-5, -38, 10, 20); c.restore(); }
        c.beginPath(); c.arc(0, 0, 14, 0, TAU); c.fill(); c.restore();
      }
      c.strokeStyle = '#5a3a24'; c.lineWidth = 5; c.beginPath(); c.moveTo(lx, wy + lr); c.lineTo(rx, wy + rrad); c.stroke();
      // lampu REC kecil berdenyut
      c.fillStyle = `hsl(${hue},95%,${55 + 15 * beat}%)`; c.beginPath(); c.arc(CAS.w - 100, 440, 12 + 3 * beat, 0, TAU); c.fill();
      c.restore();
      // pita menjuntai bergelombang di bawah kaset
      c.strokeStyle = '#3a2618'; c.lineWidth = 8; c.lineCap = 'round'; c.beginPath();
      for (let x = 120; x <= W - 120; x += 12) { const y = 1330 + Math.sin(x / 90 + u * 2) * 26 + Math.sin(x / 41 - u * 3) * 8; x === 120 ? c.moveTo(x, y) : c.lineTo(x, y); }
      c.stroke(); c.lineCap = 'butt';
      c.drawImage(L.front, 0, 0, W, H);
      // stiker bintang
      c.save(); c.translate(900, 1520); c.rotate(.2 + .12 * Math.sin(u * 2)); const sc = 1 + .06 * beat; c.scale(sc, sc);
      c.beginPath(); for (let i = 0; i < 24; i++) { const r = i % 2 ? 92 : 116, a2 = i / 24 * TAU; c.lineTo(Math.cos(a2) * r, Math.sin(a2) * r); } c.closePath();
      c.fillStyle = '#1b1620'; c.save(); c.translate(7, 9); c.fill(); c.restore(); c.fillStyle = '#ffe14a'; c.fill(); c.lineWidth = 6; c.strokeStyle = '#1b1620'; c.stroke();
      c.fillStyle = '#1b1620'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `44px ${FONT_B}`; c.fillText('best', 0, -24); c.fillText('tape', 0, 26); c.restore();
      c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    },
  };

  const TEMPLATES = [
    { id: 'neon', name: 'Neon Vinyl', ...NEON },
    { id: 'y2k', name: 'Y2K Polaroid', ...Y2K },
    { id: 'aurora', name: 'Aurora Glass', ...AURORA },
    { id: 'kaset', name: 'Kaset Retro', ...CASSETTE },
  ];
  const STILL_T = 1.0;      // detik yang dipakai untuk gambar diam

  /* ---------- gambar satu frame ke kanvas mana pun ---------- */
  function layersFor(i, w, h) {
    const key = i + ':' + w; S.layers = S.layers || {};
    return S.layers[key] || (S.layers[key] = TEMPLATES[i].layers(S.data, w, h));
  }
  function paint(canvas, i, t) {
    const c = canvas.getContext('2d'), k = canvas.width / W;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, canvas.width, canvas.height);
    c.scale(k, k); c.textBaseline = 'alphabetic'; c.textAlign = 'left'; c.globalAlpha = 1; noShadow(c);
    c.save(); TEMPLATES[i].frame(c, S.data, t, layersFor(i, canvas.width, canvas.height)); c.restore();
  }

  /* ---------- link lagu: dibuka di Nada langsung memilih lagunya ---------- */
  const songLink = (id) => `${location.origin}/s/${encodeURIComponent(id)}`;
  async function copyLink() {
    try { await navigator.clipboard.writeText(songLink(S.track.id)); return true; } catch (e) { return false; }
  }

  /* ---------- merekam video ---------- */
  function pickMime() {
    if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream) return '';
    return ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
      .find((m) => { try { return MediaRecorder.isTypeSupported(m); } catch (e) { return false; } }) || '';
  }
  function startRecord() {
    if (!S || !S.data) return;
    const i = S.tpl;
    if (S.vids[i] || (S.rec && S.rec.tpl === i)) { ui(); return; }
    if (S.rec) { S.rec.cancel = true; try { S.rec.mr.stop(); } catch (e) {} S.rec = null; }
    const mime = pickMime(); if (!mime) { S.noVideo = true; ui(); return; }
    const cv = document.createElement('canvas'); cv.width = 720; cv.height = 1280;
    paint(cv, i, 0);
    let mr; try { mr = new MediaRecorder(cv.captureStream(30), { mimeType: mime, videoBitsPerSecond: 4e6 }); } catch (e) { S.noVideo = true; ui(); return; }
    const R = { tpl: i, cv, mr, chunks: [], t0: 0, pct: 0, mime, cancel: false, len: S.len };
    mr.ondataavailable = (e) => { if (e.data && e.data.size) R.chunks.push(e.data); };
    mr.onstop = () => {
      if (R.cancel) return;
      S.vids[i] = { blob: new Blob(R.chunks, { type: mime.split(';')[0] }), ext: /mp4/.test(mime) ? 'mp4' : 'webm' };
      if (S.rec === R) S.rec = null; ui();
    };
    S.rec = R; mr.start(); ui();
  }
  function recStep(now) {
    const R = S.rec; if (!R || R.cancel) return;
    if (!R.t0) R.t0 = now;
    const t = (now - R.t0) / 1000;
    if (t >= R.len) { paint(R.cv, R.tpl, 0); R.pct = 1; if (R.mr.state !== 'inactive') R.mr.stop(); ui(); return; }
    paint(R.cv, R.tpl, t); R.pct = t / R.len;
    if (now - (R.lastUi || 0) > 200) { R.lastUi = now; ui(); }
  }

  /* ---------- gambar diam ---------- */
  function stillBlob() {
    const i = S.tpl; S.stills = S.stills || {};
    if (!S.stills[i]) S.stills[i] = new Promise((res) => {
      setTimeout(() => {
        const cv = document.createElement('canvas'); cv.width = W; cv.height = H; paint(cv, i, STILL_T);
        cv.toBlob(res, 'image/png');
      }, 0);
    });
    return S.stills[i];
  }

  /* ---------- antarmuka ---------- */
  let S = null;
  function ui() {
    if (!S) return;
    const sh = $('#storyShare'), txt = $('#storyShareTxt'), vid = S.vids[S.tpl], R = S.rec && S.rec.tpl === S.tpl ? S.rec : null;
    const busy = !S.data || (!S.noVideo && !vid);
    sh.disabled = busy; sh.classList.toggle('busy', busy);
    sh.style.setProperty('--p', (R ? Math.round(R.pct * 100) : 0) + '%');
    txt.textContent = !S.data ? 'Menyiapkan…' : (S.noVideo || vid) ? 'Bagikan ke Story' : `Menyiapkan video… ${R ? Math.round(R.pct * 100) : 0}%`;
    $('#storySave').hidden = !S.data || !(S.noVideo || vid);
    $('#storyStill').hidden = !S.data || S.noVideo;
    $('#storyTip').textContent = !S.data ? '' : S.noVideo
      ? 'HP-mu belum bisa bikin video, jadi dibagikan sebagai gambar. Tempel link lagu di stiker Link.'
      : `Video ${S.len} detik tanpa suara. Tambah lagunya lewat stiker Musik di Instagram, lalu tempel link-nya di stiker Link.`;
    document.querySelectorAll('#storyLen button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.s === S.len)));
  }

  async function open(track, opt) {
    opt = opt || {};
    S = { track, len: getLen(), tpl: +(localStorage.getItem('storyTpl') || 0) || 0, data: null, vids: {}, rec: null, layers: null, t0: 0, lastPaint: 0, raf: 0 };
    if (S.tpl >= TEMPLATES.length) S.tpl = 0;
    const el = $('#story'); el.hidden = false; el.classList.remove('ready'); el.classList.add('loading'); fitCanvas();
    requestAnimationFrame(() => el.classList.add('show'));
    ui();
    const mine = S;
    const [img] = await Promise.all([loadImg('/api/img?id=' + encodeURIComponent(track.id)), loadFonts()]);
    if (S !== mine) return;
    const dur = opt.dur > 0 ? opt.dur : 0;
    S.data = { id: track.id, img, title: tidy(track.title) || track.title || 'Tanpa judul', artist: tidyArtist(track.artist), pal: palette(img), cur: opt.cur || 0, dur };
    fitCanvas();
    const pv = $('#storyCanvas'); pv.width = 540; pv.height = 960;
    document.querySelectorAll('#storyTpls .stpl').forEach((b, i) => { const cv = b.querySelector('canvas'); paint(cv, i, STILL_T); });
    el.classList.remove('loading'); el.classList.add('ready');
    markPicked(); startRecord(); ui();
    S.raf = requestAnimationFrame(loop);
  }
  function loop(now) {
    if (!S) return;
    S.raf = requestAnimationFrame(loop);
    if (!S.t0) S.t0 = now;
    if (now - S.lastPaint >= 33) { S.lastPaint = now; paint($('#storyCanvas'), S.tpl, ((now - S.t0) / 1000) % DUR); }
    if (S.rec) recStep(now);
  }
  function markPicked() { document.querySelectorAll('#storyTpls .stpl').forEach((b, i) => b.setAttribute('aria-pressed', String(i === S.tpl))); }
  function close() {
    if (S) { cancelAnimationFrame(S.raf); if (S.rec) { S.rec.cancel = true; try { S.rec.mr.stop(); } catch (e) {} } }
    const el = $('#story'); el.classList.remove('show'); S = null;
    setTimeout(() => { if (!S) el.hidden = true; }, 220);
  }

  // ukuran pratinjau mengikuti ruang yang tersisa (rasio 9:16)
  function fitCanvas() {
    const st = $('.story-stage'), cv = $('#storyCanvas'); if (!st) return;
    const r = st.getBoundingClientRect(), h = Math.max(0, Math.min(r.height, r.width * 16 / 9));
    cv.style.height = h + 'px'; cv.style.width = (h * 9 / 16) + 'px';
  }
  const tidy = (t) => String(t || '').replace(/\s*[\(\[【]\s*(official|resmi|lyric|lirik|audio|video|mv|m\/v|music video|clip|visuali[sz]er|hd|4k|live|remaster)[^\)\]】]*[\)\]】]/gi, '').replace(/\s*\|\s*.*$/, '').replace(/\s+/g, ' ').trim();
  const tidyArtist = (t) => String(t || '').replace(/\s*-\s*Topic$/i, '').replace(/VEVO$/i, '').trim();

  /* ---------- bagikan / simpan ---------- */
  function canShareFile(file) { try { return !!(navigator.canShare && navigator.canShare({ files: [file] })); } catch (e) { return false; } }
  function download(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  // asVideo=false -> gambar diam. saveOnly -> simpan ke perangkat, tidak membuka menu share.
  async function deliver(asVideo, saveOnly) {
    if (!S || !S.data) return;
    const vid = asVideo ? S.vids[S.tpl] : null;
    if (asVideo && !vid && !S.noVideo) return;
    const linkP = copyLink();                                   // salin link lagu selagi masih dalam sentuhan pengguna
    let blob, name, type;
    if (vid) { blob = vid.blob; name = 'nada-story.' + vid.ext; type = blob.type; }
    else { blob = await stillBlob(); name = 'nada-story.png'; type = 'image/png'; }
    if (!blob) return;
    const file = new File([blob], name, { type });
    const copied = await linkP;
    if (!saveOnly && canShareFile(file)) {
      try { await navigator.share({ files: [file], title: S && S.data.title, text: `Lagi dengerin ${S && S.data.title} - ${S && S.data.artist} di Nada\n${songLink(S && S.track.id)}` }); if (copied && window.toast) window.toast('Link lagu udah disalin. Tempel di stiker Link ya!'); return; }
      catch (e) { if (e && e.name === 'AbortError') return; }
    }
    download(blob, name);
    if (window.toast) window.toast(copied ? 'Tersimpan. Link lagu udah disalin, tempel di stiker Link ya!' : 'Tersimpan. Buka Instagram buat posting!');
  }

  function init() {
    const tpls = $('#storyTpls'); if (!tpls) return;
    tpls.innerHTML = TEMPLATES.map((t, i) => `<button type="button" class="stpl" aria-pressed="false" data-i="${i}" aria-label="Template ${t.name}"><canvas width="81" height="144"></canvas><span>${t.name}</span></button>`).join('');
    tpls.addEventListener('click', (e) => {
      const b = e.target.closest('.stpl'); if (!b || !S || !S.data) return;
      S.tpl = +b.dataset.i; try { localStorage.setItem('storyTpl', S.tpl); } catch (er) {}
      markPicked(); startRecord(); ui();
    });
    $('#storyLen').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-s]'); if (!b || !S) return;
      const v = +b.dataset.s; if (v === S.len) return;
      S.len = v; try { localStorage.setItem('storyLen', v); } catch (er) {}
      if (S.rec) { S.rec.cancel = true; try { S.rec.mr.stop(); } catch (er) {} S.rec = null; }
      S.vids = {}; if (S.data) startRecord(); ui();
    });
    $('#storyClose').addEventListener('click', close);
    $('#story').addEventListener('click', (e) => { if (e.target.id === 'story') close(); });
    $('#storyShare').addEventListener('click', () => deliver(true, false));
    $('#storySave').addEventListener('click', () => deliver(true, true));
    $('#storyStill').addEventListener('click', () => deliver(false, false));
    $('#storyLink').addEventListener('click', async () => { if (S && await copyLink() && window.toast) window.toast('Link lagu disalin'); });
    window.addEventListener('resize', () => { if (S) fitCanvas(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && S) close(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  window.NadaStory = { open, close, _templates: TEMPLATES, _state: () => S };
})();
