/* Bagikan lagu ke Story (IG, WhatsApp, dll).
   Menggambar gambar 1080x1920 di kanvas dengan beberapa template, lalu dibagikan lewat menu share HP atau disimpan.
   Pakai: NadaStory.open({ id, title, artist }, { cur, dur })  (detik, opsional) */
(function () {
  const W = 1080, H = 1920;
  const FONT_A = '"Bricolage Grotesque","SF Pro Display",system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif';
  const FONT_B = '"Permanent Marker","Marker Felt","Bradley Hand","Segoe Print","Comic Sans MS",cursive';
  const $ = (s) => document.querySelector(s);

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

  /* ---------- helper gambar ---------- */
  const loadImg = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
  const fmt = (s) => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  function rr(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  // gambar persegi dari tengah gambar 16:9
  function squareOf(img) {
    const s = Math.min(img.width, img.height);
    return [(img.width - s) / 2, (img.height - s) / 2, s, s];
  }
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
  // warna dominan (hue, saturasi) dari sampul supaya tiap lagu punya nuansa sendiri
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
      h = (h * 60 + 360) % 360;
      return { h: Math.round(h), s: 85 };
    } catch (e) { return fallback; }
  }

  /* ---------- helper teks ---------- */
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
    // satu kata terlalu panjang: potong
    return out.map((l) => { while (l.length > 1 && c.measureText(l).width > maxW) l = l.slice(0, -2) + '…'; return l; });
  }
  // cari ukuran font terbesar yang muat dalam maxLines baris
  function fit(c, text, weight, family, maxW, maxLines, start, min) {
    for (let s = start; s >= min; s -= 4) {
      c.font = `${weight} ${s}px ${family}`;
      const l = lines(c, text, maxW, 99);
      if (l.length <= maxLines) return { size: s, lines: l };
    }
    c.font = `${weight} ${min}px ${family}`;
    return { size: min, lines: lines(c, text, maxW, maxLines) };
  }
  function grain(c, n, alpha) {
    for (let i = 0; i < n; i++) { c.fillStyle = Math.random() > .5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`; c.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
  }
  function sparkle(c, x, y, r, color) {
    c.save(); c.translate(x, y); c.fillStyle = color; c.beginPath();
    c.moveTo(0, -r); c.quadraticCurveTo(r * .12, -r * .12, r, 0); c.quadraticCurveTo(r * .12, r * .12, 0, r);
    c.quadraticCurveTo(-r * .12, r * .12, -r, 0); c.quadraticCurveTo(-r * .12, -r * .12, 0, -r); c.fill(); c.restore();
  }
  function logo(c, x, y, size, ink) {
    const g = c.createLinearGradient(x, y, x + size, y + size); g.addColorStop(0, '#ff4f6d'); g.addColorStop(1, '#ff9a56');
    c.fillStyle = g; c.beginPath(); c.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2); c.fill();
    c.save(); c.translate(x, y); c.scale(size / 512, size / 512); c.fillStyle = ink || '#0e0e13';
    const p = new Path2D('M215 180v152a44 44 0 1 1-24-39V204l112-28v112a44 44 0 1 1-24-39V150z');
    c.translate(24 + 6, 14 + 6); c.scale(.92, .92); c.fill(p); c.restore();
  }

  /* =====================================================================
     TEMPLATE 1: Neon Vinyl (gelap, piringan hitam, nuansa dari sampul)
     ===================================================================== */
  function neonVinyl(c, d) {
    const { h } = d.pal;
    c.fillStyle = '#0a0a10'; c.fillRect(0, 0, W, H);
    c.globalAlpha = .55; blurCover(c, d.img, -200, -200, W + 400, H + 400); c.globalAlpha = 1;
    c.fillStyle = 'rgba(8,8,14,.62)'; c.fillRect(0, 0, W, H);
    let g = c.createRadialGradient(150, 380, 0, 150, 380, 900); g.addColorStop(0, `hsla(${h},95%,58%,.55)`); g.addColorStop(1, 'transparent'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    g = c.createRadialGradient(1000, 1500, 0, 1000, 1500, 900); g.addColorStop(0, `hsla(${(h + 55) % 360},95%,55%,.45)`); g.addColorStop(1, 'transparent'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    grain(c, 5000, .035);

    // chip "lagi dengerin"
    c.font = `800 34px ${FONT_A}`; const label = 'LAGI DENGERIN'; const lw = c.measureText(label).width + (c.letterSpacing !== undefined ? 0 : 0);
    const cw = lw + 130, cx = 100, cy = 250;
    rr(c, cx, cy, cw, 84, 42); c.fillStyle = 'rgba(255,255,255,.08)'; c.fill();
    c.lineWidth = 3; c.strokeStyle = `hsla(${h},100%,70%,.9)`; c.shadowColor = `hsla(${h},100%,60%,.9)`; c.shadowBlur = 24; c.stroke(); c.shadowBlur = 0;
    c.fillStyle = `hsl(${h},100%,72%)`; c.beginPath(); c.arc(cx + 44, cy + 42, 12, 0, 7); c.shadowColor = `hsl(${h},100%,65%)`; c.shadowBlur = 22; c.fill(); c.shadowBlur = 0;
    c.fillStyle = '#fff'; c.textBaseline = 'middle'; c.fillText(label, cx + 76, cy + 44);
    // equalizer kecil di kanan atas
    const eqH = [46, 84, 60, 96, 52]; for (let i = 0; i < 5; i++) { rr(c, 800 + i * 36, 292 - eqH[i], 20, eqH[i], 10); const eg = c.createLinearGradient(0, 292 - eqH[i], 0, 292); eg.addColorStop(0, `hsl(${h},100%,72%)`); eg.addColorStop(1, `hsl(${(h + 55) % 360},100%,62%)`); c.fillStyle = eg; c.fill(); }

    // piringan hitam di belakang sampul
    const vx = 760, vy = 830, vr = 340;
    c.save(); c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 60; c.shadowOffsetY = 20;
    c.beginPath(); c.arc(vx, vy, vr, 0, 7); c.fillStyle = '#0c0c10'; c.fill(); c.restore();
    c.lineWidth = 2; for (let r = 130; r < vr - 8; r += 14) { c.beginPath(); c.arc(vx, vy, r, 0, 7); c.strokeStyle = `rgba(255,255,255,${r % 28 ? .035 : .07})`; c.stroke(); }
    g = c.createConicGradient ? c.createConicGradient(-.6, vx, vy) : null;
    if (g) { g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.08, 'rgba(255,255,255,.16)'); g.addColorStop(.16, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,255,255,0)'); g.addColorStop(.58, 'rgba(255,255,255,.12)'); g.addColorStop(.66, 'rgba(255,255,255,0)'); c.beginPath(); c.arc(vx, vy, vr, 0, 7); c.fillStyle = g; c.fill(); }
    c.save(); c.beginPath(); c.arc(vx, vy, 120, 0, 7); c.clip(); drawSquare(c, d.img, vx - 120, vy - 120, 240); c.restore();
    c.beginPath(); c.arc(vx, vy, 120, 0, 7); c.lineWidth = 6; c.strokeStyle = `hsl(${h},100%,68%)`; c.stroke();
    c.beginPath(); c.arc(vx, vy, 22, 0, 7); c.fillStyle = '#0a0a10'; c.fill();

    // sampul
    c.save(); c.translate(380, 830); c.rotate(-.05);
    c.shadowColor = `hsla(${h},100%,55%,.55)`; c.shadowBlur = 90; c.shadowOffsetY = 30; rr(c, -310, -310, 620, 620, 52); c.fillStyle = '#111'; c.fill(); c.shadowBlur = 0; c.shadowColor = 'transparent'; c.shadowOffsetY = 0;
    c.save(); rr(c, -310, -310, 620, 620, 52); c.clip(); drawSquare(c, d.img, -310, -310, 620); c.restore();
    rr(c, -310, -310, 620, 620, 52); c.lineWidth = 4; c.strokeStyle = 'rgba(255,255,255,.28)'; c.stroke(); c.restore();

    // judul + artis
    const mw = W - 200;
    const t = fit(c, d.title, 800, FONT_A, mw, 2, 100, 56);
    c.textBaseline = 'alphabetic'; c.fillStyle = '#fff'; c.shadowColor = `hsla(${h},100%,60%,.55)`; c.shadowBlur = 30;
    const ty = 1310; t.lines.forEach((l, i) => c.fillText(l, 100, ty + i * (t.size * 1.08)));
    c.shadowBlur = 0;
    const ay = ty + (t.lines.length - 1) * (t.size * 1.08) + 84;
    const a = fit(c, d.artist, 600, FONT_A, mw, 1, 52, 34);
    c.fillStyle = `hsl(${h},100%,76%)`; c.fillText(a.lines[0], 100, ay);

    // progres seperti pemutar
    const by = 1600, bw = W - 200, pct = d.pct;
    rr(c, 100, by, bw, 10, 5); c.fillStyle = 'rgba(255,255,255,.2)'; c.fill();
    const pg = c.createLinearGradient(100, 0, 100 + bw, 0); pg.addColorStop(0, `hsl(${h},100%,68%)`); pg.addColorStop(1, `hsl(${(h + 55) % 360},100%,66%)`);
    rr(c, 100, by, Math.max(10, bw * pct), 10, 5); c.fillStyle = pg; c.fill();
    c.beginPath(); c.arc(100 + bw * pct, by + 5, 18, 0, 7); c.fillStyle = '#fff'; c.shadowColor = `hsl(${h},100%,65%)`; c.shadowBlur = 24; c.fill(); c.shadowBlur = 0;
    if (d.dur) { c.font = `600 30px ${FONT_A}`; c.fillStyle = 'rgba(255,255,255,.7)'; c.textAlign = 'left'; c.fillText(fmt(d.cur), 100, by + 62); c.textAlign = 'right'; c.fillText(fmt(d.dur), 100 + bw, by + 62); c.textAlign = 'left'; }

    // merek
    logo(c, 100, 1716, 56); c.font = `800 38px ${FONT_A}`; c.fillStyle = '#fff'; c.fillText('Nada', 172, 1757);
    c.font = `600 30px ${FONT_A}`; c.fillStyle = 'rgba(255,255,255,.55)'; c.textAlign = 'right'; c.fillText('dengerin juga di Nada', W - 100, 1757); c.textAlign = 'left';
  }

  /* =====================================================================
     TEMPLATE 2: Y2K Polaroid (cerah, stiker, nuansa dari sampul)
     ===================================================================== */
  function y2k(c, d) {
    const h = d.pal.h, h2 = (h + 48) % 360;
    let g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, `hsl(${h},95%,66%)`); g.addColorStop(.55, `hsl(${(h + 24) % 360},95%,70%)`); g.addColorStop(1, `hsl(${h2},95%,68%)`);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // pola titik halftone
    c.fillStyle = 'rgba(255,255,255,.22)';
    for (let y = 0; y < 560; y += 46) for (let x = (y / 46) % 2 ? 23 : 0; x < W; x += 46) { const r = 14 * (1 - y / 600); if (r > 1) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); } }
    for (let y = H - 520; y < H; y += 46) for (let x = (y / 46) % 2 ? 23 : 0; x < W; x += 46) { const r = 14 * ((y - (H - 520)) / 520); if (r > 1) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); } }
    // lingkaran besar dekor
    c.fillStyle = `hsla(${(h + 180) % 360},95%,72%,.35)`; c.beginPath(); c.arc(960, 330, 230, 0, 7); c.fill();
    c.fillStyle = 'rgba(255,255,255,.28)'; c.beginPath(); c.arc(80, 1480, 200, 0, 7); c.fill();
    grain(c, 4500, .04);

    // stiker NOW PLAYING
    c.save(); c.translate(250, 262); c.rotate(-.1);
    c.font = `800 42px ${FONT_A}`; const label = 'NOW PLAYING'; const lw = c.measureText(label).width + 150;
    rr(c, -lw / 2 + 8, -44 + 10, lw, 92, 46); c.fillStyle = '#111'; c.fill();
    rr(c, -lw / 2, -44, lw, 92, 46); c.fillStyle = '#fff'; c.fill(); c.lineWidth = 6; c.strokeStyle = '#111'; c.stroke();
    c.font = '46px sans-serif'; c.textBaseline = 'middle'; c.fillText('🎧', -lw / 2 + 28, 4);
    c.font = `800 42px ${FONT_A}`; c.fillStyle = '#111'; c.fillText(label, -lw / 2 + 98, 5); c.restore();
    sparkle(c, 880, 230, 70, '#fff'); sparkle(c, 960, 330, 36, '#fff'); sparkle(c, 790, 330, 26, '#111');

    // polaroid
    const pw = 800, ph = 1010;
    c.save(); c.translate(W / 2, 880); c.rotate(.045);
    c.shadowColor = 'rgba(40,0,40,.4)'; c.shadowBlur = 70; c.shadowOffsetY = 40; rr(c, -pw / 2, -ph / 2, pw, ph, 14); c.fillStyle = '#fffdf8'; c.fill(); c.shadowBlur = 0; c.shadowColor = 'transparent'; c.shadowOffsetX = 0; c.shadowOffsetY = 0;
    const px = -pw / 2 + 50, py = -ph / 2 + 50, ps = pw - 100;
    c.save(); c.beginPath(); c.rect(px, py, ps, ps); c.clip(); drawSquare(c, d.img, px, py, ps);
    const sg = c.createLinearGradient(px, py, px + ps, py + ps); sg.addColorStop(0, 'rgba(255,255,255,.18)'); sg.addColorStop(.5, 'rgba(255,255,255,0)'); sg.addColorStop(1, `hsla(${h2},100%,60%,.18)`); c.fillStyle = sg; c.fillRect(px, py, ps, ps); c.restore();
    c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.12)'; c.strokeRect(px, py, ps, ps);
    // keterangan tulisan tangan
    const capY = py + ps + 40, mw = pw - 120;
    const t = fit(c, d.title, 400, FONT_B, mw, 2, 66, 40);
    c.fillStyle = '#16121c'; c.textBaseline = 'alphabetic'; t.lines.forEach((l, i) => c.fillText(l, px + 10, capY + 62 + i * (t.size * 1.12)));
    const ay = capY + 62 + (t.lines.length - 1) * (t.size * 1.12) + 56;
    const a = fit(c, d.artist, 700, FONT_A, mw, 1, 36, 26); c.fillStyle = `hsl(${h},75%,40%)`; c.fillText(a.lines[0], px + 10, ay);
    // selotip
    for (const [tx, ty, rot] of [[-pw / 2 + 80, -ph / 2 + 10, -.5], [pw / 2 - 80, -ph / 2 + 10, .5]]) {
      c.save(); c.translate(tx, ty); c.rotate(rot); c.fillStyle = 'rgba(255,236,120,.82)'; c.fillRect(-90, -30, 180, 60);
      c.fillStyle = 'rgba(255,255,255,.35)'; for (let k = -80; k < 90; k += 24) c.fillRect(k, -30, 8, 60); c.restore();
    }
    c.restore();

    // stiker bintang "REPLAY"
    c.save(); c.translate(870, 1330); c.rotate(.2);
    c.beginPath(); for (let i = 0; i < 24; i++) { const r = i % 2 ? 98 : 124, a2 = i / 24 * Math.PI * 2; c.lineTo(Math.cos(a2) * r, Math.sin(a2) * r); } c.closePath();
    c.fillStyle = '#111'; c.save(); c.translate(7, 9); c.fill(); c.restore(); c.fillStyle = '#ffe14a'; c.fill(); c.lineWidth = 6; c.strokeStyle = '#111'; c.stroke();
    c.fillStyle = '#111'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `46px ${FONT_B}`; c.fillText('on', 0, -26); c.fillText('repeat', 0, 30); c.restore();

    // mini player
    const mx = 120, my = 1500, mwid = W - 240, mh = 120;
    rr(c, mx + 6, my + 8, mwid, mh, 60); c.fillStyle = '#111'; c.fill();
    rr(c, mx, my, mwid, mh, 60); c.fillStyle = '#fff'; c.fill(); c.lineWidth = 6; c.strokeStyle = '#111'; c.stroke();
    c.fillStyle = '#111'; c.beginPath(); c.arc(mx + 66, my + 60, 38, 0, 7); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(mx + 56, my + 42); c.lineTo(mx + 56, my + 78); c.lineTo(mx + 88, my + 60); c.closePath(); c.fill();
    const bx = mx + 130, bw = mwid - 130 - (d.dur ? 170 : 60), bpct = d.pct;
    rr(c, bx, my + 54, bw, 12, 6); c.fillStyle = 'rgba(0,0,0,.14)'; c.fill();
    rr(c, bx, my + 54, Math.max(12, bw * bpct), 12, 6); c.fillStyle = `hsl(${h},90%,52%)`; c.fill();
    c.beginPath(); c.arc(bx + bw * bpct, my + 60, 18, 0, 7); c.fillStyle = '#111'; c.fill();
    if (d.dur) { c.font = `800 32px ${FONT_A}`; c.fillStyle = '#111'; c.textAlign = 'right'; c.fillText(fmt(d.cur), mx + mwid - 36, my + 62); c.textAlign = 'left'; }
    sparkle(c, 150, 1400, 44, '#fff'); sparkle(c, 230, 1455, 22, '#111'); sparkle(c, 930, 1630, 34, '#fff');

    // merek
    c.textBaseline = 'middle'; logo(c, 120, 1686, 58, '#fff'); c.font = `800 40px ${FONT_A}`; c.fillStyle = '#111'; c.fillText('Nada', 194, 1717);
    c.font = `${'400'} 36px ${FONT_B}`; c.fillStyle = '#111'; c.textAlign = 'right'; c.fillText('dengerin bareng yuk!', W - 120, 1717); c.textAlign = 'left';
  }

  const TEMPLATES = [
    { id: 'neon', name: 'Neon Vinyl', draw: neonVinyl },
    { id: 'y2k', name: 'Y2K Polaroid', draw: y2k },
  ];

  /* ---------- antarmuka ---------- */
  let S = null; // { track, data, tpl, busy }

  function render(canvas, tplIdx, scale) {
    const c = canvas.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, canvas.width, canvas.height);
    c.scale(scale, scale); c.textBaseline = 'alphabetic'; c.textAlign = 'left'; c.lineCap = 'butt'; c.lineJoin = 'miter';
    c.save(); TEMPLATES[tplIdx].draw(c, S.data); c.restore();
  }
  function renderAll() {
    render($('#storyCanvas'), S.tpl, 1);
    document.querySelectorAll('#storyTpls .stpl').forEach((b, i) => {
      b.setAttribute('aria-pressed', String(i === S.tpl));
      render(b.querySelector('canvas'), i, b.querySelector('canvas').width / W);
    });
    // siapkan file PNG dari sekarang: menu share iPhone menolak kalau gambar baru dibuat setelah tombol ditekan
    S.blobP = toBlob();
  }

  // ukuran pratinjau mengikuti ruang yang tersisa (rasio 9:16)
  function fitCanvas() {
    const st = $('.story-stage'), cv = $('#storyCanvas'); if (!st) return;
    const r = st.getBoundingClientRect(), h = Math.max(0, Math.min(r.height, r.width * 16 / 9));
    cv.style.height = h + 'px'; cv.style.width = (h * 9 / 16) + 'px';
  }
  const tidy = (t) => String(t || '').replace(/\s*[\(\[【]\s*(official|resmi|lyric|lirik|audio|video|mv|m\/v|music video|clip|visuali[sz]er|hd|4k|live|remaster)[^\)\]】]*[\)\]】]/gi, '').replace(/\s*\|\s*.*$/, '').replace(/\s+/g, ' ').trim();
  const tidyArtist = (t) => String(t || '').replace(/\s*-\s*Topic$/i, '').replace(/VEVO$/i, '').trim();

  async function open(track, opt) {
    opt = opt || {};
    S = { track, tpl: +(localStorage.getItem('storyTpl') || 0) || 0, data: null, blob: null };
    if (S.tpl >= TEMPLATES.length) S.tpl = 0;
    const el = $('#story'); el.hidden = false; el.classList.remove('ready'); el.classList.add('loading'); fitCanvas();
    requestAnimationFrame(() => el.classList.add('show'));
    $('#storyTip').textContent = '';
    const [img] = await Promise.all([loadImg('/api/img?id=' + encodeURIComponent(track.id)), loadFonts()]);
    if (!S || S.track !== track) return;
    const dur = opt.dur > 0 ? opt.dur : 0;
    S.data = { img, title: tidy(track.title) || track.title || 'Tanpa judul', artist: tidyArtist(track.artist), pal: palette(img), cur: opt.cur || 0, dur, pct: dur ? Math.min(.98, Math.max(.04, (opt.cur || 0) / dur)) : .38 };
    fitCanvas(); renderAll();
    el.classList.remove('loading'); el.classList.add('ready');
    const can = canShareFiles();
    $('#storyShareTxt').textContent = can ? 'Bagikan ke Story' : 'Simpan gambar';
    $('#storySave').hidden = !can;
    $('#storyTip').textContent = can ? 'Di menu yang muncul, pilih Instagram lalu Story.' : 'Gambar akan tersimpan. Buka Instagram, lalu pilih dari galeri.';
    $('#storyShare').focus({ preventScroll: true });
  }
  function close() {
    const el = $('#story'); el.classList.remove('show');
    setTimeout(() => { el.hidden = true; }, 220); S = null;
  }

  function toBlob() {
    return new Promise((res) => $('#storyCanvas').toBlob(res, 'image/png'));
  }
  function canShareFiles() {
    try { return !!(navigator.canShare && navigator.canShare({ files: [new File([new Blob(['x'])], 'a.png', { type: 'image/png' })] })); } catch (e) { return false; }
  }
  function download(blob) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'nada-story.png';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  async function share(forceSave) {
    if (!S || !S.data) return;
    const blob = await (S.blobP || toBlob()); if (!blob) return;
    const file = new File([blob], 'nada-story.png', { type: 'image/png' });
    if (!forceSave && canShareFiles()) {
      try { await navigator.share({ files: [file], title: S.track.title, text: `Lagi dengerin ${S.track.title} - ${S.track.artist} di Nada` }); return; }
      catch (e) { if (e && e.name === 'AbortError') return; }
    }
    download(blob);
    if (window.toast) window.toast('Gambar tersimpan. Buka Instagram buat posting ya!');
  }

  function init() {
    const tpls = $('#storyTpls'); if (!tpls) return;
    tpls.innerHTML = TEMPLATES.map((t, i) => `<button type="button" class="stpl" aria-pressed="false" data-i="${i}" aria-label="Template ${t.name}"><canvas width="81" height="144"></canvas><span>${t.name}</span></button>`).join('');
    tpls.addEventListener('click', (e) => {
      const b = e.target.closest('.stpl'); if (!b || !S || !S.data) return;
      S.tpl = +b.dataset.i; try { localStorage.setItem('storyTpl', S.tpl); } catch (er) {}
      renderAll();
    });
    $('#storyClose').addEventListener('click', close);
    $('#story').addEventListener('click', (e) => { if (e.target.id === 'story') close(); });
    $('#storyShare').addEventListener('click', () => share(false));
    $('#storySave').addEventListener('click', () => share(true));
    window.addEventListener('resize', () => { if (S) fitCanvas(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && S) close(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  window.NadaStory = { open, close, _templates: TEMPLATES, _state: () => S };
})();
