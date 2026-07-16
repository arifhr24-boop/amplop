# Progress Redesign UI Amplop

Mengikuti `PROMPT-CLAUDE-CODE.md`. Referensi visual: `amplop-redesign-v2.html`.
Aturan: hanya ubah lapisan presentasi, kerjakan bertahap, tunggu konfirmasi user
sebelum lanjut ke tahap berikutnya.

## Status tahap

- [x] Tahap 0 — Ringkasan struktur project & kesepakatan pendekatan
- [x] Tahap 1 — Fondasi: design tokens, font, background & tipografi global
- [x] Tahap 2 — App shell: sidebar desktop, topbar, bottom nav + FAB mobile
- [x] Tahap 3 — Beranda: hero saldo, tagihan terdekat, grid kartu amplop
- [x] Tahap 4 — Transaksi: search, filter pill, grouping per hari
- [x] Tahap 5 — Amplop: toolbar, tabel alokasi, summary bar, sisa per amplop
- [x] Tahap 6 — Laporan: stat cards, bar per amplop, chart arus kas, saldo dompet
- [x] Tahap 7 — Cicilan: summary beban + kartu cicilan
- [x] Tahap 8 — Pengaturan: grid 2 kolom semua card
- [x] Tahap 9 — Semua modal (Transaksi, Dompet, Tagihan, Cicilan, Edit Amplop)
- [x] Tahap 10 — Auth (login/daftar/reset)
- [x] Tahap 11 — Landing page

## Catatan per tahap

### Tahap 0 — Kesepakatan pendekatan
- File yang dikerjakan bertahap: `login.html` (Tahap 1–10), lalu `index.html` (Tahap 11).
- `admin.html` tidak disentuh (tidak disebut di brief).
- Navigasi akan diubah dari 1 elemen `<nav class="bottom">` yang di-transform,
  jadi 2 elemen terpisah (`.sidebar` + `.bottom-nav`/`.fab`) mengikuti referensi
  persis — dikerjakan di Tahap 2.

### Tahap 1 — Fondasi (selesai, di `login.html`)
- `:root`: token baru ditambahkan (--ink, --ink-soft, --paper baru [F6F3EC],
  --card, --line, --muted, --text, --brass/--brass-bright/--brass-soft,
  --sage/--sage-soft, --clay/--clay-soft, --radius, --shadow, --shadow-lg).
- Token lama (--primary, --deep, --kraft*, --green*, --red*, --r) DIPERTAHANKAN
  sementara (dipakai komponen yang belum direstyle) — akan dibersihkan
  tahap demi tahap seiring komponennya diupdate.
- Font: ditambahkan Fraunces + Plus Jakarta Sans ke Google Fonts link
  (Bricolage Grotesque + Inter tetap dimuat sementara, masih dipakai
  beberapa komponen yang belum di-restyle).
- `body`: font-family → Plus Jakarta Sans, background → var(--paper) baru,
  color → var(--text).
- `h1,h2,h3,.disp` dan `.num`: font-family → Fraunces (sesuai spec: judul
  section & angka rupiah pakai Fraunces).
- Ditambahkan `.serif` utility class.
- Ditambahkan aturan aksesibilitas: `prefers-reduced-motion` mematikan semua
  animasi/transisi, `:focus-visible` outline warna brass.
- Meta `theme-color` disesuaikan ke warna ink baru.
- Diverifikasi: desktop 1280px, tablet 768px, mobile 390px — tidak ada
  regresi fungsi, tidak ada elemen rusak/terpotong.
- Catatan: breakpoint sidebar/bottom-nav saat ini masih 900px (kode lama),
  referensi pakai 860px — akan disamakan persis di Tahap 2.

### Tahap 2 — App shell (selesai, di `login.html`)
- `<header class="app">` lama (judul + ikon gear) dihapus total, diganti struktur
  baru: `<div class="app"><aside class="sidebar">…</aside><main class="main">
  <div class="topbar">…</div>…halaman…</main></div>` lalu `<button class="fab">`
  + `<nav class="bottom-nav">` di luar `.app` untuk mobile.
- Sidebar (desktop ≥861px, sembunyi di mobile): logo, tombol `.btn-record`
  ("Catat Transaksi" → tetap panggil `openTxnModal()`), `.nav` berisi 6
  `.nav-item` (Beranda/Transaksi/Amplop/Laporan/Cicilan/Pengaturan) + 1
  `.nav-item.js-admin-btn` (khusus admin, hidden by default), lalu
  `.sidebar-foot` (avatar inisial email, email, indikator sync, tombol
  install PWA). Semua ikon SVG diambil persis dari
  `design-reference/amplop-redesign-v2.html` (viewBox + path sama).
- Topbar (dalam `.main`, tampil di semua ukuran layar): logo kecil `.m-logo`
  (hanya tampil di mobile), pill periode `.period` (isi label sama seperti
  `.monthbar` lama, tombol ‹ › tetap panggil `shiftMonth(-1/1)`), dan 4 tombol
  `.m-gear` (Cicilan, Admin [hidden default], Instal PWA [hidden default],
  Pengaturan) — hanya tampil di mobile, disembunyikan di desktop karena
  fungsinya sudah ada di sidebar.
- 4 `.monthbar` duplikat (di page-home/txns/env/report) dihapus, dikonsolidasi
  jadi satu `#topbar-period-label` yang di-update oleh keempat fungsi
  render*() yang sudah ada (tidak mengubah kapan/bagaimana label dihitung,
  cuma target elemennya yang disatukan).
- Mobile nav lama (`<nav class="bottom">` yang di-transform via media query)
  diganti 2 elemen terpisah persis seperti referensi: `.fab` (tombol Catat
  Transaksi mengambang) + `.bottom-nav` (4 `.bnav-item`: Beranda/Transaksi/
  Amplop/Laporan — Cicilan & Pengaturan tidak ada slot di sini, diakses lewat
  `.m-gear` di topbar, sama seperti keputusan desain referensi).
- Breakpoint desktop disamakan ke 861px (referensi: ≤860 mobile / ≥861
  desktop), kondisi `and (display-mode:browser)` dipertahankan supaya PWA
  yang sudah diinstal tetap pakai tampilan mobile berapa pun lebar jendelanya.
- JS yang diupdate (perilaku sama, cuma cara nge-target elemen yang berubah
  karena elemennya kini terduplikasi sidebar+topbar):
  - `go(p)`: toggle `.active` lewat `data-page` ke semua `.nav-item`/
    `.bnav-item` (dulu: toggle `.on` ke `nav.bottom button[id]`), plus
    show/hide `#topbar-period` berdasar apakah `p` termasuk
    home/txns/env/report.
  - `startApp()`: `admin-btn` (dulu 1 elemen by id) → `querySelectorAll(
    '.js-admin-btn')` supaya kedua salinan (sidebar + topbar) ikut
    disembunyikan/ditampilkan.
  - Alur instal PWA (`beforeinstallprompt`, `installApp()`, `appinstalled`,
    fallback Safari): `install-btn` by id → `querySelectorAll(
    '.js-install-btn')`, alasan sama seperti admin-btn.
  - `setSync(state)`: nama & pemanggil tidak berubah, tapi target elemen
    diganti dari `#sync-dot` (pill teks tunggal di header lama, sudah tidak
    ada) ke `#sf-sync-label` (teks) + `#sync-ind` (titik warna) di
    sidebar-foot.
  - `render()`: tambah baris untuk isi `#sf-email` dan huruf pertama email ke
    `#sf-avatar` (selain `#st-email` yang sudah ada di halaman Pengaturan).
  - CSS `#sync-dot{…}` (pill lama) dihapus karena elemennya sudah tidak ada
    (dead code).
- Diverifikasi pakai Playwright (headless Chromium) di 1280px/768px/390px:
  sidebar+topbar+nav-item active state benar di desktop, bottom-nav+FAB+
  m-gear benar di tablet & mobile, halaman tanpa periode (Cicilan/Pengaturan)
  otomatis menyembunyikan pill periode, modal Catat Transaksi masih terbuka
  normal dari FAB, tidak ada error di console maupun page error.
- Belum disentuh (menunggu tahap sendiri): styling internal tiap halaman
  (hero, kartu amplop, dsb — Tahap 3+), styling modal (Tahap 9), auth gate
  (Tahap 10).

### Tahap 3 — Beranda (selesai, di `login.html`)
- `.hero` diganti total ke gaya referensi: gradient ink gelap 3-titik,
  watermark segitiga brass transparan (`.hero::before`), `.eyebrow` (label
  kecil uppercase), `.amount` (angka saldo pakai Fraunces), `.hero-chips`
  (pill "Aman dipakai" jadi `.chip.gold`, "hari tersisa" jadi `.chip` biasa),
  dan `.hero-stats`/`.hero-stat` (2 kolom Masuk/Keluar bulan ini, DIPINDAH
  dari `.grid2`/`.stat` lama ke dalam hero, jadi baris terpisah dengan titik
  warna hijau/merah) — `.grid2`/`.stat` lama TIDAK dihapus/diubah karena
  masih dipakai apa adanya oleh Laporan (Tahap 6, belum digarap).
- Judul section ("Tagihan Terdekat", "Amplop Periode Ini") dipindah keluar
  dari `.card` mengikuti pola referensi `h2.section` (judul Fraunces + link
  aksi brass di kanan, mis. "Kelola"/short label periode) — sebelumnya judul
  ada di dalam `.card h2`.
- Kartu tagihan/cicilan mendesak: `.bill` → `.bill-row`, `.due` →
  `.date-badge`, `.mid`/`.d`/`.s` → `.bill-info`/`b`/`.sub`, status lunas
  jadi pill `.tag.paid`, badge telat mewarnai `.date-badge` clay. Class lama
  ini TIDAK dipakai di tempat lain (dicek by grep), aman diganti total.
- Grid amplop: `.env`/`.flap`/`.em`/`.nm`/`.left`/`.sub` (lama, hanya dipakai
  Beranda) diganti `.env-card`/`.env-flap`/`.env-seal`/`.env-name`/
  `.env-left`/`.env-of`/`.meter`/`.env-foot`, mengikuti persis referensi:
  strip flap amplop di atas + wax seal bulat emoji kategori, progress bar
  gradient brass (kelas `.low` kalau <40% terpakai, `.full`/warna clay HANYA
  kalau over budget — bukan saat 100% "habis" pas, ini sempat salah pas
  verifikasi screenshot lalu diperbaiki), teks kaki "terpakai X% / sisa Y%"
  atau "melebihi jatah / over" saat over, atau "terpakai 100% / habis" saat
  pas habis tanpa over.
- JS yang diupdate (isi/kondisi tampil tidak berubah, cuma target class &
  markup output-nya): `renderHome()` — template bill-row & debt-row,
  template env-card (tambah perhitungan `over`/`habis`/`meterClass`/
  `footLeft`/`footRight` dari nilai `alloc`/`spent` yang SUDAH ada
  sebelumnya, bukan logika baru).
- Diverifikasi pakai Playwright dengan data contoh (alokasi + transaksi +
  tagihan disuntik lewat `DB` langsung, lalu `save()+go('home')`) di
  1280/768/390px: hero, tagihan (lunas & belum), grid amplop (kondisi
  normal/habis/over) semua tampil sesuai referensi, tidak ada error
  console/page. Regresi-check cepat di halaman Amplop/Laporan/Cicilan/
  Pengaturan — semua masih utuh seperti sebelum Tahap 3 (tidak tersentuh).

### Tahap 4 — Transaksi (selesai, di `login.html`)
- Kotak pencarian: `<input class="f">` polos diganti `.search` (kotak putih
  dengan ikon kaca pembesar SVG + input tanpa border), tetap `id="tx-search"`
  dan `oninput="renderTxns()"` yang sama persis.
- Filter chip: `.fchips`/`.fchip` (lama, hanya dipakai di sini) diganti
  `.filters`/`.filter`, state aktif `.on` → `.active` (background ink pekat
  mengikuti referensi, bukan lagi warna primary lama). Logic filter
  (`txFilter`, urutan Semua/Keluar/Masuk/Transfer) tidak berubah.
- Daftar transaksi: sebelumnya list datar `.txn` dengan tanggal disisipkan di
  teks sub tiap baris. Sekarang dikelompokkan per tanggal mengikuti
  referensi: label `.tx-day` ("Hari ini · 16 Jul" / "Kemarin · 15 Jul" /
  "14 Jul" untuk tanggal lain) di atas tiap grup, isi grup dibungkus `.card`
  berisi `.tx-row` (ikon kategori `.tx-ico`, judul+sub `.tx-info`, nominal
  `.tx-amt` — hijau sage untuk pemasukan, ink untuk lainnya). Tombol hapus
  tetap ada di tiap baris (`.tx-del`, referensi tidak punya ini karena versi
  statis, tapi fungsi hapus transaksi harus tetap ada) — cuma restyle ikon
  kecil abu-abu mengikuti desain baru.
- JS `renderTxns()`: logic filter/pencarian/urutan (`txnsOf`, `txFilter`,
  pencocokan `q`) TIDAK berubah. Yang ditambah cuma pengelompokan hasil per
  `date` (pakai util `ymd()` yang sudah ada) sebelum di-render, dan template
  HTML output per baris disesuaikan ke class baru. Teks sub baris tidak lagi
  menyisipkan tanggal (mis. "15 Jul · Makan · Bank Utama") karena tanggal
  sekarang sudah terwakili oleh label `.tx-day` di atasnya — mengikuti pola
  referensi persis.
- Diverifikasi pakai Playwright dengan 7 transaksi contoh (keluar/masuk/
  transfer, 3 hari berbeda) di 1280/768/390px: grouping benar (Hari ini/
  Kemarin/tanggal biasa), filter & search berfungsi (dites ketik "makan" →
  hasil terfilter benar lintas grup tanggal), tidak ada error console.

### Tahap 5 — Amplop (selesai, di `login.html`)
- Toolbar: 3 tombol aksi (dulu tombol `.btn.ghost.sm` polos di dalam card)
  dipindah ke luar card jadi `.toolbar` dengan `.btn-soft` (tombol "Amplop
  baru" jadi `.btn-soft.primary` warna ink, sesuai referensi menonjolkan aksi
  utama). Handler `openEnvModal()`/`copyPrevAlloc()`/`openMoveModal()` tidak
  berubah.
- Tabel alokasi: `.brow`/`.em`/`.nm`/`.brow-ic` (lama, hanya dipakai di sini)
  diganti `.alloc-row`/`.name` (emoji+nama jadi satu `<div class="name">`)/
  `.alloc-input`/`.mini-act` (bungkus 2 tombol edit+hapus). Input alokasi
  dapat class `zero` (warna muted) kalau nilainya kosong/0, mengikuti
  referensi. Handler `fmtInput`/`setAlloc`/`openEnvModal`/`quickDeleteEnv`
  semua dipanggil persis sama seperti sebelumnya.
- Summary bar baru ("Total diisi / Pemasukan bulan ini / Belum
  dialokasikan") mengganti 2 baris `.totline` lama yang cuma menampilkan
  Total & Pemasukan — field "Belum dialokasikan" (`Pemasukan − Total diisi`)
  ditambahkan sebagai penghitungan baru di JS (bukan cuma restyle, tapi murni
  turunan dari 2 angka yang sudah ada, bukan state/logika bisnis baru), warna
  hijau sage kalau masih sisa, clay kalau minus (dialokasikan melebihi
  pemasukan). Panel ini dibuat "flush" ke tepi bawah card pakai margin
  negatif (`margin:14px -16px -16px`) supaya sudut membulatnya nyatu dengan
  card walau `.card` lama masih punya padding 16px baku (tidak diubah, sebab
  `.card` dipakai luas di halaman lain yang belum digarap).
- "Sisa per Amplop": `.usage`/`.row`/`.top`/`.cat`/`.amt`/`.bar` (LAMA) sengaja
  TIDAK disentuh/dihapus — class-class ini juga dipakai oleh Laporan
  (`#rp-envs`, Tahap 6) dan kartu Cicilan (progress cicilan, Tahap 7) yang
  belum digarap. Sebagai gantinya dibuat class baru khusus halaman ini:
  `.env-usage`/`.env-usage-row`/`.env-usage-head`/`.env-usage-bar`, isi &
  warna mengikuti referensi (bar gradient ink utk kondisi normal, brass utk
  pas habis 100%, clay utk over-budget — pakai kondisi over/habis yang SAMA
  persis dengan variabel lama `a>0&&s>a`, tidak diubah).
- Diverifikasi pakai Playwright dengan alokasi 3 amplop + transaksi contoh
  (termasuk 1 amplop over-budget tanpa alokasi) di 1280/768/390px — sempat
  ada baris alokasi yang wrap ke 2 baris di 390px karena input terlalu lebar,
  diperbaiki dengan menyempitkan `.alloc-input` di mobile (104px, kembali ke
  130px di desktop) mengikuti pola breakpoint referensi. Regresi-check cepat
  di Beranda/Transaksi/Cicilan/Laporan/Pengaturan — semua utuh, tidak ada
  error console.

### Tahap 6 — Laporan (selesai, di `login.html`)
- `.grid2`/`.stat` (lama) di-upgrade jadi `.stat-grid`/`.stat` (nama baru,
  DIRENAME bukan ditambah) karena sejak Tahap 3 memindah Beranda ke
  `.hero-stats`, `.grid2`/`.stat` sudah tidak dipakai di tempat lain KECUALI
  di sini — aman diganti total. Grid sekarang `repeat(auto-fit,minmax(150px,1fr))`
  (otomatis reflow, tidak perlu override kolom manual di media query desktop
  lagi — override lama `#page-report .grid2{grid-template-columns:repeat(4,1fr)}`
  dihapus karena jadi dead code). Angka pakai Fraunces, warna sage untuk
  positif/pemasukan, clay untuk selisih negatif (state ini belum pernah
  ke-trigger di data contoh tapi kelasnya sudah disiapkan mengikuti token
  baru, bukan lagi `--red`/`--green` lama).
- "Pengeluaran per Amplop": menggunakan ULANG class `.env-usage`/
  `.env-usage-row`/`.env-usage-head`/`.env-usage-bar` yang dibuat di Tahap 5
  (bukan bikin nama baru lagi) karena secara visual komponennya identik
  (baris emoji+nama, nominal, bar) — hanya beda kontennya (di sini cuma
  nominal keluar, tanpa "/ alokasi"). `.usage`/`.row`/`.top`/`.cat`/`.amt`
  (lama) SENGAJA ditinggalkan begitu saja tanpa dihapus karena `.bar` (bagian
  dari situ) masih dipakai progress cicilan di halaman Cicilan (Tahap 7,
  belum digarap) — cuma dead code untuk bagian `.row`/`.top`/`.cat` yang
  sudah tidak direferensikan HTML manapun lagi, akan dibersihkan kalau Tahap
  7 juga sudah tidak butuh sisa-sisanya.
- "Arus Kas 6 Periode": `.trend`/`.grp`/`.pair` (lama, hanya dipakai di sini)
  diganti `.legend`/`.cash-chart`/`.cash-col`/`.cash-bars`, warna bar masuk
  jadi gradient sage, keluar jadi gradient brass (dulu hijau/kraft polos).
  Legend "■ masuk ■ keluar" yang dulu inline di judul `<h2>` dipindah jadi
  elemen `.legend` tersendiri di dalam card, judulnya sendiri pindah ke
  `h2.section` di luar card mengikuti pola tahap-tahap sebelumnya.
- "Saldo per Dompet": `<table class="t">` (lama, hanya dipakai di sini)
  diganti daftar `.wallet-row` (nama dompet+tipe di kiri, saldo Fraunces di
  kanan, muted kalau Rp0, clay kalau minus) — sesuai referensi yang tidak
  memakai tabel HTML untuk ini.
- JS `renderReport()`: TIDAK ada perhitungan baru, murni ganti template
  string ke class-class baru di atas; logic pemasukan/pengeluaran/cashflow/
  rata-rata, urutan bar per amplop (diurutkan by pengeluaran terbesar), dan
  6-periode trend sama persis seperti sebelumnya.
- Diverifikasi pakai Playwright dengan 6 periode riwayat transaksi (untuk
  mengisi grafik arus kas) + beberapa dompet saldo campuran (positif/nol) di
  1280/768/390px — stat-grid reflow wajar (4 kolom desktop, 2 kolom mobile,
  3+1 di tablet — bukan bug, konsekuensi wajar grid auto-fit yang memang
  dipakai reference sendiri), chart & wallet list tampil benar, tidak ada
  error console. Regresi-check ke Beranda/Transaksi/Amplop/Cicilan/
  Pengaturan — semua masih utuh.

### Tahap 7 — Cicilan (selesai, di `login.html`)
- Ringkasan beban: dulu `<p class="hint" id="debt-summary">` teks polos di
  dalam card kecil, diganti `.card.loan-sum` (flex space-between): label +
  angka besar Fraunces (`#debt-total`) + subteks persentase (`#debt-pct`,
  termasuk peringatan rasio >30% yang sudah ada sebelumnya, warna diganti
  dari `--kraft` lama ke `--clay`) di kiri, tombol "+ Cicilan Baru" jadi
  `.btn-soft.primary` di kanan (dulu `.btn.ghost.sm` di baris terpisah).
- Kartu cicilan aktif: dibungkus `.loan-grid` (2 kolom di desktop ≥861px,
  1 kolom di mobile — menggantikan override lama `#debt-list{grid...}` yang
  ikut me-grid-kan section "Cicilan Selesai" segaligus; sekarang grid HANYA
  membungkus kartu aktif, "Cicilan Selesai" tetap full-width di bawahnya,
  sesuai struktur referensi). Tiap kartu pakai `.loan-card` (modifier di atas
  `.card` biasa) + `.loan-head`/`.loan-meta`.
- Status cicilan: `.badge`/`.badge.late`/`.badge.soon`/`.badge.ok` (lama,
  hanya dipakai di sini) DIHAPUS, diganti `.tag` yang sudah ada dari Tahap 3
  (`.tag.paid` sage, `.tag.due` brass untuk "segera jatuh tempo") ditambah
  1 varian baru `.tag.late` (clay) untuk status terlambat — supaya semua
  pill status di aplikasi (tagihan & cicilan) konsisten satu sistem warna.
- Progress bar cicilan: pakai ULANG `.meter`/`.meter i.low`/`.meter i.full`
  dari Tahap 3 (bukan `.bar` lama yang sudah dipensiunkan penuh di sini) —
  brass utk progres wajar, clay (`.full`) kalau telat bayar, brass pudar
  (`.low`) kalau progres masih <40%. `.bar` sendiri TIDAK dihapus dari
  stylesheet karena sudah tidak ada satu pun pemakainya lagi setelah tahap
  ini (aman dibersihkan lain kali jika mau, tidak mendesak).
- Tombol "Bayar" (aksi bayar cicilan bulan ini) dipertahankan — referensi
  versi statis tidak menampilkannya (cuma contoh yang sudah lunas), jadi
  ditambahkan sebagai baris kecil di bawah `.loan-meta` mengikuti gaya
  `.btn.ok.sm` yang sudah ada, hanya muncul kalau belum bayar bulan ini.
- JS `renderDebts()`: TIDAK ada logic baru — perhitungan total beban, %
  terhadap pemasukan, kondisi late/dueSoon/paid, dan urutan render tetap
  sama; hanya target elemen & template HTML yang diperbarui ke class-class
  di atas.
- Diverifikasi pakai Playwright dengan 3 cicilan aktif (lunas/telat/telat)
  + 1 cicilan selesai di 1280/768/390px — ringkasan, grid 2 kolom desktop
  / 1 kolom mobile, warna tag & meter sesuai status, tombol Bayar tampil
  tepat saat dibutuhkan, tidak ada error console. Regresi-check ke Beranda/
  Transaksi/Amplop/Laporan/Pengaturan — semua masih utuh.

### Tahap 8 - Pengaturan (selesai, di login.html)
- Halaman dibungkus .set-grid (2 kolom 1fr 1fr desktop >=861px, 1 kolom
  mobile) berisi 2 div kolom: kolom kiri Akun/Preset Amplop/Tagihan
  Rutin, kolom kanan Periode Gajian/Dompet/Data & Ekspor/Tentang - persis
  pembagian di referensi. Override lama #page-settings.active (yang
  men-grid-kan SEMUA card langsung) dihapus, diganti .set-grid yang hanya
  membungkus 2 div kolom, bukan tiap card - jadi tidak perlu lagi override
  margin-bottom:0 manual per-card seperti sebelumnya (spacing antar-card
  dalam 1 kolom cukup mengandalkan margin-bottom bawaan .card).
- Akun: .list-item (row generik lama) diganti .acct (nama & deskripsi di
  kiri, tombol "Keluar" jadi .btn-out - outline warna clay, bukan lagi
  .btn.ghost.sm netral, supaya aksi keluar terasa sedikit lebih tegas
  tanpa jadi tombol destructive penuh).
- Preset Amplop: 3 tombol preset diganti dari .btn.ghost.sm jadi .preset
  (baris lebar penuh, background paper, hover jadi brass-soft).
- Tagihan Rutin & Dompet: menggunakan ULANG .bill-row/.date-badge/
  .bill-info (dari Tahap 3) dan .wallet-row (dari Tahap 6) - bukan bikin
  komponen baru, karena referensi sendiri memang memakai persis komponen
  yang sama di sini. .list-item (lama) sekarang hanya tersisa dipakai di
  daftar "Cicilan Selesai" (Tahap 7) - tidak dihapus karena masih dipakai
  di situ.
- Tombol "+Tambah" pada judul Dompet/Tagihan Rutin: dari
  small>button.btn.ghost.sm (lama) diganti .btn-soft langsung di dalam h2
  (dengan box-shadow:none supaya tidak dobel bayangan dengan card),
  otomatis rata kanan karena .card h2 sudah justify-content:space-between.
- Judul semua card (.card h2 & details.card summary, dipakai di semua card
  Pengaturan + "Cicilan Selesai" + panel Data & Ekspor) di-upgrade ke
  Fraunces 16.5px/600 (dulu font default browser 15px/800) - efeknya cuma
  konsistensi tipografi tambahan karena semua pemakainya sudah masuk
  lingkup redesign, bukan regresi.
- "Periode saat ini" label diberi highlight bold warna ink pada nilai
  periodenya (dulu teks polos semua), mengikuti referensi.
- JS renderSettings(): tidak ada logic baru, hanya ganti innerHTML/target
  elemen sesuai class-class di atas; perhitungan cycle/wallet balance/bill
  list sama persis.
- Diverifikasi pakai Playwright dengan 1 tagihan rutin contoh di
  1280/768/390px, termasuk expand panel "Data & Ekspor" (masih berfungsi
  penuh dengan semua kontrol ekspor CSV/Excel/backup/restore/reset) - tidak
  ada error console. Regresi-check ke Beranda/Transaksi/Amplop/Laporan/
  Cicilan - semua masih utuh.

### Tahap 9 - Semua modal (selesai, di login.html)
- 5 modal target sesuai brief (Catat Transaksi, Dompet Baru, Tagihan Rutin
  Baru, Cicilan Baru, Edit Amplop) direstyle penuh. 3 modal LAIN yang ada di
  app tapi TIDAK disebut di brief (Pindah Dana, Onboarding, Rekap Periode)
  SENGAJA tidak disentuh isi dalamnya - hanya ikut menikmati upgrade chrome
  modal (backdrop blur, kartu bulat, strip aksen brass, bottom-sheet di
  mobile) karena itu levelnya .modal-bg/.modal yang shared, bukan spesifik
  per-modal.
- Backdrop & kartu modal: .modal-bg (backdrop gelap 55% + blur 5px, dulu
  polos rgba tanpa blur) dan .modal (dulu bottom-sheet radius atas selalu,
  sekarang DEFAULT jadi dialog mengambang di tengah - card rounded 24px,
  strip aksen gradient brass 5px di tepi atas lewat .modal::before, animasi
  "pop" masuk dari bawah+scale, bukan "up" lama).
- Breakpoint bottom-sheet DIPISAH dari breakpoint shell: dulu modal ikut
  berubah jadi dialog tengah di >=861px (sama dengan breakpoint sidebar),
  sekarang jadi bottom-sheet HANYA di <=640px (media query baru khusus,
  independen dari breakpoint shell 861px) - persis sesuai instruksi brief
  "Modal di bawah 640px jadi bottom sheet" dan sesuai referensi. Konsekuensi:
  di lebar 641-860px, shell tetap tampilan mobile (bottom-nav+FAB) TAPI
  modal sudah dialog tengah, bukan bottom-sheet - ini disengaja, meniru
  persis perilaku file referensi.
- Header modal: pola lama <h3 id="xxx-modal-title">Judul <button>✕</button></h3>
  (tombol ✕ jadi ANAK dari h3) diganti .modal-head (div pembungkus terpisah)
  berisi <h3 id="xxx-modal-title">Judul</h3> + <button class="modal-x">✕</button>
  sebagai SIBLING, bukan lagi anak dari h3. Ini AMAN untuk semua fungsi
  openXxxModal() yang men-set judul via `getElementById('xxx-modal-title')
  .firstChild.textContent=...` karena firstChild h3 tetap text node yang
  sama persis (tombol yang tadinya ikut jadi child kedua sudah dipindah
  keluar, tidak mengubah firstChild).
- Form: label.f/input.f/select.f (lama, MASIH dipakai di modal Pindah Dana/
  Onboarding & form auth-gate/Tahap 10 - makanya TIDAK disentuh/dihapus)
  diganti field baru khusus 5 modal ini: .field (wrapper label+input),
  .input/select.input (border lebih tebal, radius 13px, background paper,
  focus jadi ring brass + putih - dulu cuma ganti border color polos),
  .row-2 (grid 2 kolom utk pasangan field pendek: Tanggal+Nominal, Jenis+
  Saldo Awal, Nominal+Jumlah Cicilan, Sudah Terbayar+Jatuh Tempo - dulu semua
  field ditumpuk 1 kolom memanjang ke bawah).
- Tombol aksi: .btn.p/.btn.dngr (lama, dipakai di modal luar-scope + Tahap10)
  diganti .btn-primary (full-width ink, dipakai sendirian di modal tanpa
  tombol hapus) dan .modal-actions (flex row) + .btn-primary + .btn-danger
  (clay, bukan lagi merah) utk modal yang punya tombol Hapus (Transaksi,
  Amplop, Dompet, Tagihan, Cicilan - semua sudah py-edit-mode).
- Emoji amplop: input emoji polos ditambah .emoji-input (kotak kecil rata
  tengah font besar) + teks hint "Emoji ini muncul sebagai segel di kartu
  amplop" (baru, mengikuti referensi, murni tambahan penjelasan).
- Field re-grouping HANYA presentasi, urutan logis field & semua atribut
  (id, oninput, onchange, placeholder, value awal) TIDAK berubah - cuma
  dikelompokkan ulang jadi .row-2 utk field pendek yang cocok berdampingan.
- .seg (dipakai bersama oleh cycle-seg/Tahap 8, tx-seg/Tahap 9 ini, dan seg
  onboarding di luar-scope): TIDAK di-fork jadi class baru, cuma dipoles
  tipis (border ditambah, radius & box-shadow diselaraskan ke token var(--
  shadow) baru) - berlaku ke ketiga pemakainya sekaligus, aman karena
  perubahannya kecil & konsisten dgn arah desain baru, bukan mengubah
  struktur/nama class/logic toggle .on yang sudah ada.
- Diverifikasi pakai Playwright di 1280px (dialog tengah) & 390px
  (bottom-sheet) utk kelima modal, termasuk: toggle tab Transaksi
  Keluar/Masuk/Transfer (field Dari Amplop/Ke Dompet & label Dompet ikut
  berubah benar), mode edit Amplop (tombol Hapus muncul, judul jadi "Edit
  Amplop"), dan smoke-test simpan Dompet baru end-to-end (data benar-benar
  masuk ke DB.wallets) - tidak ada error console. Regresi-check ke semua
  halaman - masih utuh.

### Tahap 10 - Auth: login/daftar/reset (selesai, di login.html)
- #auth-gate: background diganti gradient ink gelap + glow brass radial
  (dulu gradient biru --deep/--primary polos), kartu .ag-card diganti jadi
  card mengambang rounded-24 dengan shadow besar (dulu rounded-22 dengan
  shadow generik), logo teks emoji polos diganti komponen .logo-mark +
  .logo-name yang SAMA PERSIS dipakai sidebar/topbar (Tahap 2) - jadi logo
  konsisten di semua permukaan aplikasi, bukan re-implementasi terpisah.
- Form: label.f/input.f (lama, TIDAK dihapus - konsep sama tapi versi ini
  cuma dipakai auth-gate jadi aman diganti total di sini) diganti .field/
  .input yang sama persis dipakai modal (Tahap 9) - login/daftar/lupa
  password/OTP/reset password semua pakai komponen field yang identik
  dengan form modal, satu sistem form di seluruh aplikasi.
- Password toggle: .pw-wrap/.pw-toggle (lama, HANYA dipakai di 3 field
  password auth-gate) diganti .input-wrap/.eye (nama & style dari
  referensi) - fungsi togglePw() tidak berubah sama sekali karena cuma
  mengganti innerHTML ikon SVG di dalam tombol, tidak peduli nama class
  pembungkusnya.
- Tombol submit: .btn.p diganti .btn-primary (dipakai bersama modal Tahap
  9) di kelima langkah (login/daftar/lupa password/verifikasi OTP/set
  password baru).
- Link aksi sekunder ("Daftar", "Lupa password?", "Kembali ke Masuk", dst):
  dulu tiap grup dibungkus <div style="display:flex;..."> manual + class
  .ag-link dengan inline style="width:auto" utk override lebar 100% -
  disederhanakan jadi wrapper .auth-links (flex, gap, center, wrap) berisi
  <button> polos, meniru persis .auth-links referensi - tidak perlu lagi
  akal-akalan inline style, dan otomatis wrap rapi di layar sempit (dicoba
  di 390px, 2 link "Daftar"/"Lupa password" pecah jadi 2 baris tanpa
  terpotong).
- Pesan error/info (.ag-err/.ag-info): warna diganti dari --red-soft/
  --green-soft (token lama) ke --clay-soft/--sage-soft (token desain baru),
  logic show/hide (agErr()/agInfo()) tidak disentuh.
- 2 langkah tambahan yang TIDAK ada di referensi (versi statis referensi
  cuma py login/daftar/reset) tapi WAJIB dipertahankan karena fitur nyata
  aplikasi: verifikasi OTP pendaftaran (ag-step-register-otp) dan set
  password baru dari link reset (ag-step-recovery) - keduanya dibuat
  mengikuti pola visual yang sama (field/input/btn-primary/auth-links)
  supaya konsisten, walau tidak ada mockup persis untuk langkah ini.
- Tombol "Kembali ke beranda" (link ke index.html, BUKAN button showView
  seperti di referensi karena app nyata kita punya index.html terpisah
  sebagai halaman landing sungguhan) tetap <a href="index.html">, cuma
  restyle .ag-back mengikuti .auth-back referensi.
- Diverifikasi pakai Playwright di 1280px & 390px: kelima langkah
  (login/daftar/lupa-password/OTP/reset-password - dipaksa tampil via
  agShow() untuk testing karena Supabase belum terkonfigurasi di
  lingkungan lokal), toggle show/hide password berfungsi (ikon ganti
  benar), banner error tampil dengan warna clay - tidak ada error console.
  Regresi-check ke seluruh halaman app (Beranda/Transaksi/Amplop/Laporan/
  Cicilan/Pengaturan) - semua masih utuh, tidak terpengaruh perubahan di
  auth-gate.

### Tahap 11 - Landing page (selesai, di index.html)
- Berbeda dari Tahap 1-10 (semua di login.html, migrasi bertahap sambil
  mempertahankan token/komponen lama untuk bagian yang belum digarap),
  index.html adalah file TERPISAH yang belum pernah disentuh sama sekali di
  proyek redesign ini - jadi dikerjakan sebagai satu kali tulis ulang penuh
  (bukan migrasi token lama->baru bertahap) karena tidak ada komponen lama
  yang perlu dipertahankan kompatibel.
- Font Google diganti total ke Fraunces + Plus Jakarta Sans saja (Bricolage
  Grotesque & Inter yang lama dilepas sepenuhnya, tidak seperti login.html
  yang masih menahan font lama untuk komponen yang belum dimigrasikan -
  index.html tidak punya sisa komponen lama sama sekali).
- :root token diganti total ke set token baru yang sama dengan login.html
  (ink/paper/card/line/muted/brass/sage/clay/radius/shadow) - token lama
  (--bg/--primary/--deep/--kraft/--green/--red) dihapus semua, tidak ada
  yang menahannya.
- Header: logo teks polos diganti .logo-mark + .logo-name (komponen yang
  sama dipakai sidebar/topbar aplikasi & auth-gate di login.html - identik
  di semua permukaan produk sekarang), tombol "Masuk" jadi .btn-ink.
- Hero: badge pill jadi .pill (brass), h1 pakai Fraunces + aksen italic
  brass pada frasa "tanpa pusing", tombol CTA ganda .btn-gold (utama) +
  .btn-ghost (sekunder, TETAP `<a href="#cara-kerja">` sungguhan buat
  scroll-anchor - referensi cuma tombol kosong tanpa aksi karena versi
  mockup-nya SPA, tapi di app nyata kita anchor-link ini perlu tetap
  berfungsi), mockup HP direstyle penuh mengikuti komponen .phone/
  .phone-screen/.phone-top/.phone-envs/.p-env dari referensi (mockup lama
  pakai warna/style kartu ala aplikasi versi lama, sekarang match visual
  kartu amplop yang baru - termasuk aksen flap amplop kecil di tiap
  .p-env).
- Fitur: grid 3 kolom .feat-grid/.feat dengan kotak ikon brass-soft (dulu
  grid3 generik dengan ikon kotak paper polos) - ditambah 1 fitur baru
  "Pelacak Cicilan" 💳 supaya daftar fitur mencerminkan Fitur B (cicilan)
  yang sudah ada di aplikasi tapi belum pernah disebut di landing lama.
  Copy 5 fitur lain dipertahankan sama persis, cuma diikutkan style baru.
- Cara kerja: disederhanakan dari 2-kolom (daftar langkah + strip pil
  "contoh amplop" di sebelahnya) jadi grid 3 kolom .steps dengan penomoran
  otomatis via CSS counter (counter-reset/counter-increment), mengikuti
  struktur referensi persis. Strip pil "contoh amplop" (dulu ada, tidak ada
  di referensi) SENGAJA dihapus karena murni dekoratif/bukan fitur nyata,
  bukan regresi fungsi.
- CTA akhir & footer: `.cta-band` gradient biru lama diganti `.land-cta`/
  `.land-cta-in` gradient ink gelap + watermark segitiga brass transparan
  (pola yang sama dengan hero Beranda di aplikasi - konsisten satu bahasa
  visual), footer disederhanakan copy-nya sesuai referensi.
- SEMUA link CTA ("Masuk", "Mulai sekarang", "Masuk / Daftar gratis") tetap
  mengarah ke `login.html` apa adanya (TIDAK ada perubahan alur) - berbeda
  dari referensi yang pakai `showView('daftar')` karena itu SPA satu file;
  app nyata kita tidak punya route /daftar terpisah, jadi tombol "Daftar"
  di login.html sendiri (langkah agShow('register')) yang menangani itu,
  persis seperti sebelum redesign.
- Diverifikasi pakai Playwright di 1280/768/390px (tidak ada error
  console), dan smoke-test klik tombol "Masuk" sungguhan berhasil
  bernavigasi ke login.html tanpa error - alur landing→login tidak
  terganggu oleh penulisan ulang total file ini.

## Status akhir
Seluruh 11 tahap redesign UI (Tahap 0 s.d. Tahap 11) sudah selesai per
catatan di atas. Semua verifikasi dilakukan per-tahap dengan Playwright di
1280/768/390px plus regresi-check ke halaman lain, tidak ada logika bisnis/
state/handler/alur autentikasi yang berubah - murni lapisan presentasi
sesuai aturan utama brief. Belum ada commit/push untuk pekerjaan redesign
ini - menunggu instruksi eksplisit dari user.
