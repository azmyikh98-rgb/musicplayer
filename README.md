# Nada, Pemutar Musik (PWA)

Pemutar musik berbasis YouTube yang bisa di-install ke layar utama HP. Fitur: pencarian lagu, antrean otomatis, acak dan ulangi, favorit, riwayat, kontrol di lock screen (Media Session), dan tempel link YouTube / YouTube Music.

## Cara kerja

- **Pencarian**: `api/search.js` (Vercel Serverless Function) memanggil **YouTube Data API v3** dengan kategori Musik. API key aman di server, tidak ada di kode frontend.
- **Pemutaran**: **YouTube IFrame Player API** resmi, jadi tidak ada scraping atau download yang melanggar ketentuan YouTube.
- **Data pengguna** (favorit, riwayat) disimpan di `localStorage` perangkat.

## 1. Ambil YouTube API key (gratis)

1. Buka <https://console.cloud.google.com/> dan buat project baru.
2. **APIs & Services → Library → YouTube Data API v3 → Enable**.
3. **Credentials → Create credentials → API key**. Salin key-nya.
4. (Disarankan) Batasi key hanya untuk YouTube Data API v3.

Kuota gratis 10.000 unit per hari. Satu pencarian memakai 100 unit, jadi sekitar 100 pencarian unik per hari. Hasil sudah di-cache 24 jam di Vercel supaya hemat.

## 2. Upload ke GitHub

```bash
cd nada-player
git init
git add .
git commit -m "Nada music player"
git branch -M main
git remote add origin https://github.com/USERNAME/nada-player.git
git push -u origin main
```

## 3. Deploy ke Vercel

1. <https://vercel.com/new> → import repo `nada-player`.
2. Framework Preset: **Other** (biarkan default, tanpa build command).
3. **Environment Variables** → tambahkan `YOUTUBE_API_KEY` dengan isi key dari langkah 1.
4. Klik **Deploy**. Setiap `git push` berikutnya akan otomatis deploy ulang.

Tes lokal (opsional): buat `.env.local` berisi `YOUTUBE_API_KEY=...`, lalu jalankan `npx vercel dev`.

## 4. Install di HP

- **Android (Chrome)**: buka URL Vercel → menu ⋮ → **Install app** / **Tambahkan ke layar utama**.
- **iPhone (Safari)**: buka URL Vercel → tombol Bagikan → **Tambah ke Layar Utama**.

## Tampilan responsif

| Perangkat | Lebar | Layout |
|---|---|---|
| HP | di bawah 768 px | Menu di bawah, mini player, pemutar penuh geser dari bawah |
| Tablet | 768 sampai 1199 px | Sidebar ikon, daftar 2 kolom, mini player |
| Desktop | 1200 px ke atas | Sidebar, grid kartu, panel "Sedang diputar" permanen |
| TV | otomatis di smart TV, atau `?tv=1` | Skala besar, fokus jelas, navigasi remote |

- **Mode TV**: terdeteksi dari user agent (Tizen, webOS, Android TV, Fire TV, dll). Bisa dipaksa dengan `?tv=1`, dimatikan dengan `?tv=0`, atau lewat tombol "Mode TV" di sidebar.
- **Remote TV**: panah = pindah fokus, OK = putar, `F` atau tombol kuning = favorit, tombol media = putar/jeda/lanjut, Kembali = ke menu.
- **Keyboard desktop**: `Spasi` putar/jeda, `←` `→` mundur/maju 5 detik, `Shift + ←/→` lagu sebelumnya/berikutnya, `/` fokus ke kolom cari.

## Batasan yang perlu diketahui

- **Pemutaran di latar belakang**: karena memakai player resmi YouTube, musik bisa berhenti saat layar terkunci atau app ditutup, terutama di iPhone. Di Android hasilnya bervariasi tergantung browser dan versi. Ini batasan player embed, bukan bug aplikasi.
- **Tidak semua lagu bisa diputar**: pemilik video bisa melarang embed. Aplikasi otomatis lompat ke lagu berikutnya.
- **Iklan**: iklan YouTube tetap muncul sesuai kebijakan YouTube. Video tidak boleh disembunyikan sepenuhnya, jadi tetap ditampilkan di layar pemutar.
- Aplikasi ini tidak berafiliasi dengan YouTube atau Google.
- Untuk penggunaan pribadi atau komunitas kecil ini aman. Jika dipublikasikan luas, periksa [YouTube API Services Terms](https://developers.google.com/youtube/terms/api-services-terms-of-service).

## Struktur

```
api/search.js           fungsi pencarian (server)
public/index.html       halaman utama
public/app.js           logika pemutar, antrean, favorit
public/style.css        tampilan
public/sw.js            service worker (offline shell)
public/manifest.webmanifest, public/icons/   PWA
vercel.json
```
