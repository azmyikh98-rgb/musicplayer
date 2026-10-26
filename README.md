# Nada, Pemutar Musik (PWA)

Pemutar musik berbasis YouTube yang bisa di-install ke layar utama HP, tablet, desktop, dan dibuka di TV.

## Fitur

- **Beranda**: Lanjutkan mendengarkan, Terakhir diputar, Liked Songs, My Playlist, Artis Favorit, Tangga Lagu Indonesia, Tangga Lagu Global.
- **Artis Favorit**: tap **Tambah** untuk memilih dari saran atau mengetik nama artis sendiri, tap **Kelola** untuk berhenti mengikuti. Tap nama artis untuk mencari lagu-lagunya. Foto artis terisi otomatis setelah kamu memutar lagunya.
- **Cari**: saran muncul saat mengetik, filter **Resmi** (menyaring reupload, lirik, cover, slowed), atau tempel link YouTube / YouTube Music.
- **Pemutar penuh**: pilih **Video** atau **Lirik**. Lirik bertanda waktu disorot mengikuti lagu, tap satu baris untuk lompat ke sana, tombol −0,5s / +0,5s untuk menyesuaikan jika terlalu cepat atau lambat. Pintasan: `L` di keyboard, tombol hijau di remote TV.
- **Pustaka**: semua daftar di atas dalam satu tempat.
- **Menu lagu** (ikon titik tiga): suka, tambah ke playlist, ikuti artis, cari lagu dari artis.
- Kontrol di lock screen (Media Session), acak, ulangi, seek.
- Responsif: HP, tablet, desktop, dan mode TV dengan navigasi remote.

## Cara kerja

- **Pencarian**: `api/search.js` (Vercel Serverless Function) memakai YouTube Data API v3, lalu memberi skor tiap hasil.
- **Saran ketikan**: `api/suggest.js` memakai endpoint saran pencarian YouTube (tanpa kunci, tidak memakai kuota). Endpoint ini tidak resmi, jika gagal aplikasi memakai riwayat pencarian.
- **Lirik**: `api/lyrics.js` mengambil lirik dari [LRCLIB](https://lrclib.net) (gratis, tanpa API key, tidak memakai kuota YouTube). Tidak semua lagu ada liriknya. Video tetap tampil dan berjalan saat mode Lirik, sesuai aturan YouTube.
- **Tangga lagu**: `api/charts.js` memakai daftar "musik terpopuler" YouTube per negara. Global = gabungan 10 negara besar. Ini bukan Billboard atau YouTube Music Charts resmi.
- **Pemutaran**: YouTube IFrame Player API resmi.
- **Data pengguna** (liked, playlist, artis, riwayat, posisi terakhir) disimpan di `localStorage` perangkat, tidak di server.

## Cara filter "Resmi" bekerja

YouTube tidak menyediakan penanda "resmi" di API-nya, jadi hasil dinilai dengan aturan berikut:

- Naik: channel "Nama Artis - Topic" (distribusi label), channel VEVO, channel yang namanya sama dengan artis di judul, video berstatus *licensed* yang diberi tanda official.
- Turun atau disaring: judul/channel berisi lirik, cover, karaoke, slowed, reverb, nightcore, 8D, mashup, dan sejenisnya. Jika kamu sendiri mencari kata itu (misalnya "remix"), aturannya tidak diterapkan.
- Duplikat (misalnya versi Topic dan versi video) digabung jadi satu.

Ini penilaian otomatis, bukan jaminan 100%. Matikan tombol **Resmi** untuk melihat semua hasil.

## 1. Ambil YouTube API key (gratis)

1. Buka <https://console.cloud.google.com/> dan buat project baru.
2. **APIs & Services → Library → YouTube Data API v3 → Enable**.
3. **Credentials → Create credentials → API key**. Pilih pembatasan ke YouTube Data API v3. Salin key-nya.

Kuota gratis 10.000 unit per hari. Satu pencarian memakai sekitar 101 unit (jadi sekitar 99 pencarian unik per hari). Tangga lagu hanya 1 unit per negara dan di-cache 6 jam. Hasil pencarian di-cache 24 jam di Vercel.

## 2. Upload ke GitHub

```bash
git add .
git commit -m "update"
git push
```

## 3. Deploy ke Vercel

Jika repo sudah diimpor di Vercel, setiap `git push` otomatis deploy ulang. Pastikan Environment Variable `YOUTUBE_API_KEY` sudah diisi. Opsional: `YT_REGION` (kode negara untuk bias pencarian, default `ID`).

## 4. Install di HP

- **Android (Chrome)**: menu ⋮ → **Install app** / **Tambahkan ke layar utama**.
- **iPhone (Safari)**: tombol Bagikan → **Tambah ke Layar Utama**.

## Tampilan responsif

| Perangkat | Lebar | Layout |
|---|---|---|
| HP | di bawah 768 px | Menu di bawah, mini player, pemutar penuh geser dari bawah |
| Tablet | 768 sampai 1199 px | Sidebar ikon, mini player |
| Desktop | 1200 px ke atas | Sidebar, grid kartu, panel "Sedang diputar" permanen |
| TV | otomatis di smart TV, atau `?tv=1` | Skala besar, fokus jelas, navigasi remote |

- **Mode TV**: terdeteksi dari user agent (Tizen, webOS, Android TV, Fire TV, dll). Paksa dengan `?tv=1`, matikan dengan `?tv=0`, atau lewat tombol "Mode TV" di sidebar.
- **Remote TV**: panah = pindah fokus, OK = putar, `F` / kuning = suka, `M` / biru = menu lagu, tombol media = putar/jeda/lanjut, Kembali = tutup menu / ke menu utama.
- **Keyboard desktop**: `Spasi` putar/jeda, `←` `→` mundur/maju 5 detik, `Shift + ←/→` lagu sebelumnya/berikutnya, `/` ke kolom cari.

## Musik tetap main saat keluar dari aplikasi

Yang sudah dilakukan (upaya terbaik):

- Audio senyap kecil diputar bersamaan, supaya browser menganggap halaman ini sedang memutar media. Kontrol media di notifikasi/lock screen muncul dan halaman lebih jarang "dibekukan".
- Saat app ke latar belakang dan player berhenti bukan karena kamu jeda, aplikasi mencoba melanjutkannya.
- Lagu berikutnya otomatis diputar saat lagu selesai.

Batasannya: karena memakai player resmi YouTube, perilaku di latar belakang diatur oleh browser dan YouTube, bukan oleh aplikasi ini.

- **Android (Chrome, app sudah di-install)**: kemungkinan besar bisa lanjut saat pindah app atau layar mati. Hasilnya beda-beda per merek HP.
- **iPhone**: hampir pasti berhenti saat keluar dari app. Ini pembatasan iOS untuk video embed.
- **Cara yang pasti**: YouTube Premium / YouTube Music resmi.

Untuk pemutaran latar belakang yang andal, aplikasi perlu mengambil audio langsung dari server YouTube. Itu melanggar ketentuan layanan YouTube, jadi tidak dibuat di sini.

## Batasan lain

- Tidak semua lagu bisa diputar: pemilik video bisa melarang embed. Aplikasi otomatis lompat ke lagu berikutnya.
- Iklan YouTube tetap muncul sesuai kebijakan YouTube. Video tidak boleh disembunyikan sepenuhnya.
- Aplikasi ini tidak berafiliasi dengan YouTube atau Google. Jika dipublikasikan luas, periksa [YouTube API Services Terms](https://developers.google.com/youtube/terms/api-services-terms-of-service).

## Struktur

```
api/search.js           pencarian + ranking musik resmi
api/suggest.js          saran saat mengetik
api/charts.js           tangga lagu Indonesia & Global
api/lyrics.js           lirik dari LRCLIB
public/index.html       halaman utama
public/app.js           logika aplikasi
public/style.css        tampilan responsif
public/sw.js            service worker
public/manifest.webmanifest, public/icons/   PWA
vercel.json
```
