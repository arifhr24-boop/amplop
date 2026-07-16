# Prompt untuk Claude Code — Redesign UI Amplop

> Cara pakai: salin seluruh isi bagian "PROMPT" di bawah, lalu paste ke Claude Code
> di VS Code. Pastikan file `amplop-redesign-v2.html` sudah kamu taruh di folder
> `design-reference/` di root project sebelum menjalankan prompt ini.

---

## PROMPT (salin mulai dari sini)

Saya ingin kamu me-redesign seluruh UI aplikasi Amplop di repo ini mengikuti
design system baru. Referensi visual lengkapnya ada di file
`design-reference/amplop-redesign-v2.html` — buka dan pelajari file itu dulu
sebelum mengubah apa pun. File itu adalah SOURCE OF TRUTH untuk semua keputusan
visual: warna, font, spacing, radius, shadow, dan struktur komponen.

## Aturan utama

1. HANYA ubah lapisan presentasi (HTML/JSX structure, CSS/class). JANGAN ubah
   logika bisnis, state management, nama fungsi, event handler, struktur data,
   API call, atau alur autentikasi yang sudah ada.
2. Kerjakan bertahap per bagian (urutan ada di bawah). Setelah tiap bagian
   selesai, tunjukkan ringkasan perubahan dan tunggu konfirmasi saya sebelum
   lanjut ke bagian berikutnya.
3. Semua teks UI tetap Bahasa Indonesia, ikuti copy yang ada di file referensi.
4. Semua halaman harus responsive: desktop pakai sidebar kiri, di bawah 860px
   sidebar hilang dan diganti bottom navigation + FAB (floating action button)
   untuk "Catat Transaksi". Modal di bawah 640px berubah jadi bottom sheet
   (menempel di bawah, radius hanya di atas).
5. Hormati aksesibilitas: focus-visible outline warna brass, dan
   prefers-reduced-motion mematikan semua animasi.

## Design tokens (buat sebagai CSS custom properties di :root)

--ink:        #1D2338   (navy tinta — sidebar, hero, teks utama gelap, tombol primer)
--ink-soft:   #2B3352
--paper:      #F6F3EC   (background utama aplikasi — warm paper)
--card:       #FFFFFF
--line:       #E9E3D6   (border/divider)
--muted:      #8A8577   (teks sekunder)
--text:       #2A2A26
--brass:      #A97E3F   (aksen utama — pengganti oranye lama)
--brass-bright: #C9A05B (ujung terang gradient brass)
--brass-soft: #F1E7D4
--sage:       #3E7256   (pemasukan / positif)
--sage-soft:  #E7F0EA
--clay:       #B2503F   (pengeluaran berlebih / bahaya)
--clay-soft:  #F7E9E5
--radius:     18px
--shadow:     0 1px 2px rgba(29,35,56,.05), 0 8px 24px -12px rgba(29,35,56,.12)
--shadow-lg:  0 2px 4px rgba(29,35,56,.06), 0 20px 48px -20px rgba(29,35,56,.25)

Gradient brass untuk tombol emas & progress bar:
linear-gradient(180deg, #C9A05B, #A97E3F)

## Tipografi

Import dari Google Fonts:
- "Fraunces" (weight 500/600/700) — HANYA untuk: angka rupiah, judul section,
  judul modal, headline landing. Gunakan font-variant-numeric: tabular-nums
  untuk semua angka.
- "Plus Jakarta Sans" (weight 400–800) — body, label, tombol, navigasi.

Jangan pakai font lain. Jangan pakai Fraunces untuk body text.

## Komponen kunci (spesifikasi ada di file referensi, cari class-nya)

1. Kartu amplop (.env-card): kartu putih dengan "flap amplop" di atas
   (strip 40px + segitiga lipatan via clip-path polygon(0 0,100% 0,50% 100%))
   dan "wax seal" bulat berisi emoji kategori di tengah flap. Seal berwarna
   brass normal, berubah merah clay kalau amplop over budget (class .over).
   Progress bar 6px di bawahnya menunjukkan persentase terpakai.
2. Hero saldo (.hero): kartu gradient ink dengan watermark flap amplop
   transparan di kanan atas (clip-path segitiga, brass 16% opacity), angka
   saldo besar pakai Fraunces, chip "Aman dipakai /hari" warna gold.
3. Sidebar (.sidebar): background ink, logo amplop (kotak cream dengan flap
   brass), tombol "Catat Transaksi" gradient brass, nav item dengan ikon SVG
   stroke 1.8, item aktif dapat background putih 10% + ikon brass.
4. Modal (.modal): radius 24px, strip aksen gradient brass 5px di tepi atas,
   judul Fraunces, tombol close bulat. Backdrop blur 5px rgba(24,29,48,.55).
5. Form (.input): border 1.5px var(--line), radius 13px, background paper;
   saat focus: border brass + ring rgba(169,126,63,.12) + background putih.
6. Transaksi: dikelompokkan per hari dengan label uppercase kecil
   ("HARI INI · 15 JUL", "KEMARIN · 14 JUL", lalu tanggal), tiap grup dalam
   satu card, ikon emoji dalam kotak rounded, nominal pakai Fraunces,
   pemasukan hijau sage dengan ikon background sage-soft.
7. Bottom nav mobile (.bottom-nav): floating, ink 94% + backdrop blur,
   radius 20px, margin 12px dari tepi, item aktif warna gold. FAB gradient
   brass 56px di kanan bawah, di atas bottom nav.

## Urutan pengerjaan

Tahap 1 — Fondasi: buat/ganti file tokens (CSS variables), import font,
  set background & tipografi global. Pastikan build tetap jalan.
Tahap 2 — App shell: sidebar desktop, topbar (period switcher pill),
  bottom nav + FAB mobile.
Tahap 3 — Beranda: hero saldo, tagihan terdekat, grid kartu amplop.
Tahap 4 — Transaksi: search, filter pill, grouping per hari.
Tahap 5 — Amplop: toolbar, tabel alokasi dengan input inline, summary bar
  ("Total diisi / Pemasukan / Belum dialokasikan"), sisa per amplop.
Tahap 6 — Laporan: stat cards, bar pengeluaran per amplop, chart arus kas,
  saldo per dompet.
Tahap 7 — Cicilan: summary beban + kartu cicilan dengan progress.
Tahap 8 — Pengaturan: grid 2 kolom (akun, preset, tagihan rutin, periode
  gajian segmented control, dompet, data & ekspor, tentang).
Tahap 9 — Semua modal: Catat Transaksi (tab Keluar/Masuk/Transfer),
  Dompet Baru, Tagihan Rutin Baru, Cicilan Baru, Edit Amplop.
Tahap 10 — Auth (login/daftar/reset): background gradient ink dengan glow
  brass, kartu putih terpusat.
Tahap 11 — Landing page: header sticky blur, hero 2 kolom dengan phone
  mockup, grid fitur, 3 langkah cara kerja, CTA gelap, footer.

## Definition of done per tahap

- Tidak ada regresi fungsi (semua tombol/form masih memanggil handler lama).
- Tampilan cocok dengan file referensi di breakpoint desktop (≥1280px),
  tablet (768px), dan mobile (390px).
- Tidak ada warna hardcoded di luar design tokens.
- Jalankan dev server dan cek visual sebelum lapor selesai.

Mulai dari Tahap 1. Sebelum menulis kode, ringkas dulu struktur project ini
(framework apa, di mana file style global, bagaimana komponen diorganisir)
supaya kita sepakat pendekatannya.

## (selesai — akhir prompt)
