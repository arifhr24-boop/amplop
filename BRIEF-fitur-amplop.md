# BRIEF PENGEMBANGAN FITUR — APLIKASI "AMPLOP" (PWA Envelope Budgeting)

> Dokumen ini adalah brief implementasi untuk Claude Code. Kerjakan fitur sesuai urutan prioritas. Baca bagian KONTEKS & ARSITEKTUR dulu sebelum menulis kode apa pun, lalu inspeksi struktur kode yang ada di repo sebelum mengubahnya.

---

## 1. KONTEKS PRODUK

**Amplop** adalah aplikasi budgeting berbasis sistem amplop (envelope budgeting) untuk pasar Indonesia, dijual sebagai produk digital sekali bayar (lifetime) di Lynk.id dan Gumroad. Kompetitor langsungnya adalah template Excel/Google Sheets murah — jadi setiap fitur baru harus memperkuat keunggulan yang TIDAK BISA dilakukan spreadsheet: hidup di HP, aktif mengingatkan, tanpa formula yang bisa rusak, dan terasa seperti aplikasi sungguhan.

**Target user:** pekerja muda / first jobber / mahasiswa Indonesia, gaji bulanan, mobile-first, familiar dengan istilah "tanggal tua", banyak yang punya cicilan paylater (SPayLater, GoPayLater, Kredivo).

---

## 2. ARSITEKTUR SAAT INI (JANGAN DIROMBAK, HANYA DIKEMBANGKAN)

- **Single-file PWA**: seluruh app ada di `index.html` (HTML + CSS + JS vanilla, tanpa framework, tanpa build step). Ada `manifest.json` dan `service worker` untuk installable Add to Home Screen.
- **Penyimpanan**: objek global `DB` yang dipersist ke `localStorage` lewat fungsi `save()`. Versi Cloud memakai Supabase (email OTP login, tabel `licenses`, RLS per user, sync offline-first last-write-wins) — jika repo yang dibuka adalah versi Cloud, semua perubahan skema data HARUS ikut dipropagasi ke layer sync Supabase dan file SQL setup.
- **Fitur eksisting**: multi-dompet dengan saldo ledger, amplop budget dengan kalkulasi "aman dipakai per hari", tagihan rutin dengan tombol Bayar sekali tap, transfer dana antar amplop, pencatatan & edit & hapus transaksi (keluar/masuk/transfer), pencarian transaksi, navigasi bulan `‹ ›` di semua halaman termasuk Beranda, onboarding 3 langkah saat pertama buka.
- **Pola kode eksisting**: fungsi `render()` untuk re-render UI, `save()` untuk persist, `toast()` untuk notifikasi kecil, modal-modal dengan `closeModal(id)`. Ikuti pola dan gaya penamaan yang sudah ada.
- **Desain**: palet navy + kraft, tipografi Bricolage Grotesque, motif flap amplop pada kartu. Semua UI baru WAJIB konsisten dengan bahasa visual ini. Seluruh teks UI berbahasa Indonesia, tone santai-sopan (kamu/aku style seperti UI eksisting).
- **Batasan teknis**: tetap single-file, tetap vanilla JS, tetap offline-first. Library eksternal hanya boleh via CDN dan hanya jika benar-benar perlu (lihat Fitur E). Jangan menambah dependensi build.

---

## 3. FITUR YANG DIKEMBANGKAN (URUT PRIORITAS)

---

### FITUR A — SIKLUS GAJIAN CUSTOM (Payday Cycle) 🔥 PRIORITAS 1

**Masalah yang diselesaikan:** siklus keuangan orang Indonesia mengikuti tanggal gajian (misal 25 → 24 bulan berikutnya), bukan bulan kalender. Template Excel kompetitor hampir semuanya pakai bulan kalender — ini pembeda utama.

**User story:** Sebagai pengguna yang gajian tanggal 25, aku ingin semua budget amplop, rekap, dan "aman dipakai per hari" dihitung berdasarkan periode 25 s.d. 24, supaya angkanya sesuai kenyataan uangku.

**Spesifikasi:**
1. Tambahkan pengaturan baru di halaman Pengaturan: **"Tanggal mulai periode"** — pilihan angka 1–28 (batasi maksimal 28 agar aman untuk Februari). Default: `1` (perilaku lama, bulan kalender), sehingga user lama tidak merasakan perubahan apa pun sampai mereka mengubahnya sendiri.
2. Simpan di `DB.settings.cycleStartDay` (buat objek `settings` jika belum ada).
3. Buat util terpusat, misal `getPeriod(dateOrOffset)` yang mengembalikan `{start, end, label}` untuk sebuah periode. SEMUA kalkulasi yang saat ini memakai bulan kalender harus dialihkan memakai util ini: filter transaksi per periode, sisa amplop, safe-to-spend harian (pembaginya = sisa hari sampai akhir periode, bukan akhir bulan), navigasi `‹ ›`, laporan/tren.
4. **Label periode**: jika `cycleStartDay === 1` tampilkan seperti sekarang ("Juli 2026"). Jika bukan, tampilkan rentangnya, contoh: `25 Jun – 24 Jul`.
5. Saat user MENGUBAH tanggal siklus di tengah jalan: tidak perlu migrasi data transaksi (transaksi punya tanggal absolut), cukup re-render — tapi tampilkan dialog konfirmasi singkat yang menjelaskan bahwa pengelompokan periode akan berubah.
6. Tambahkan copy kecil di onboarding: pertanyaan "Kapan biasanya kamu gajian?" dengan pilihan cepat (1, 25, 27, tanggal lain) supaya fitur ini terasa sejak menit pertama.

**Acceptance criteria:**
- [ ] Dengan `cycleStartDay = 25`, transaksi tanggal 24 Juli masuk periode "25 Jun – 24 Jul", transaksi 25 Juli masuk periode berikutnya.
- [ ] Safe-to-spend harian membagi sisa budget dengan sisa hari periode (bukan sisa hari bulan kalender).
- [ ] Navigasi `‹ ›` berpindah antar periode gajian, bukan antar bulan kalender.
- [ ] Default tetap bulan kalender; data user lama tidak berubah/rusak.
- [ ] Edge case aman: tahun baru (periode Des–Jan), bulan pendek, timezone lokal device.

---

### FITUR B — TRACKER CICILAN & PAYLATER 🔥 PRIORITAS 2

**Masalah yang diselesaikan:** pain point terbesar target user adalah lupa/keteteran cicilan paylater. Belum ada produk lokal murah yang menangani ini dengan baik.

**User story:** Sebagai pengguna yang punya cicilan SPayLater 3 bulan dan Kredivo 6 bulan, aku ingin melihat semua cicilanku, sisa berapa kali bayar, jatuh tempo kapan, dan diingatkan sebelum telat.

**Spesifikasi:**
1. Entitas baru `DB.debts[]` dengan field: `id`, `name` (contoh: "SPayLater — Sepatu"), `provider` (pilihan preset: SPayLater, GoPayLater, Kredivo, Akulaku, Kartu Kredit, Lainnya), `installmentAmount` (nominal per bayar), `totalInstallments`, `paidInstallments`, `dueDay` (tanggal jatuh tempo tiap bulan, 1–28), `walletId` (dompet sumber pembayaran), `createdAt`, `done` (boolean).
2. **UI**: section/halaman baru "Cicilan" (ikut pola halaman eksisting). Tiap cicilan tampil sebagai kartu berisi: nama + provider, progress (misal "3/6 terbayar" + progress bar), nominal per bulan, jatuh tempo berikutnya, dan tombol **"Bayar"**.
3. Tombol **Bayar** sekali tap (pola sama dengan tagihan rutin eksisting): membuat transaksi keluar dari `walletId` dengan kategori/amplop "Cicilan", menaikkan `paidInstallments`, dan jika sudah lunas → tandai `done`, tampilkan toast perayaan kecil ("🎉 Cicilan lunas!").
4. **Pengingat**: di Beranda, tampilkan banner/kartu jika ada cicilan jatuh tempo dalam ≤3 hari atau sudah lewat (sorot merah untuk yang telat). Integrasikan ke area yang sama dengan kartu tagihan rutin eksisting agar tidak ada dua sistem pengingat terpisah.
5. **Ringkasan beban hutang**: satu baris di halaman Cicilan: "Total beban cicilan bulan ini: Rp X (Y% dari pemasukan periode ini)". Jika Y > 30%, beri catatan lembut satu kalimat bahwa rasio cicilan sudah tinggi.
6. Edit & hapus cicilan lewat modal, pola sama dengan edit transaksi.

**Acceptance criteria:**
- [ ] Menambah cicilan baru → muncul di daftar dengan jatuh tempo berikutnya yang benar.
- [ ] Tap Bayar → transaksi tercatat, saldo dompet berkurang, progress bertambah, jatuh tempo maju 1 bulan.
- [ ] Cicilan lunas otomatis pindah ke state selesai (disembunyikan/di-collapse, tidak dihapus).
- [ ] Pengingat muncul di Beranda H-3 dan saat telat.
- [ ] Pembayaran cicilan ikut terhitung di rekap pengeluaran periode.

---

### FITUR C — REKAP PERIODE SHAREABLE (Kartu Screenshot) — PRIORITAS 3

**Masalah yang diselesaikan:** retensi + marketing organik. User yang bangga dengan progresnya akan share ke story/TikTok → promosi gratis.

**User story:** Di akhir periode, aku ingin mendapat kartu rekap yang cantik (pemasukan, pengeluaran, jumlah yang berhasil dihemat, kategori terboros) yang bisa kuunduh sebagai gambar dan kubagikan.

**Spesifikasi:**
1. Tombol **"Rekap Periode"** di halaman Laporan (atau Beranda saat ≤3 hari terakhir periode).
2. Render kartu rekap ukuran **1080×1920 (9:16, pas untuk story)** memakai elemen `<canvas>` — TANPA library eksternal. Semua digambar manual dengan Canvas API mengikuti palet navy/kraft dan motif flap amplop.
3. Isi kartu: nama periode, total masuk, total keluar, selisih (dihemat/defisit) sebagai angka hero paling besar, top 3 amplop pengeluaran, streak/jumlah hari mencatat, dan watermark kecil logo/nama app di bawah (branding halus, bukan iklan besar).
4. Aksi: **Unduh PNG** (`canvas.toDataURL` → anchor download) dan, jika `navigator.share` dengan file didukung (mobile), tombol **Bagikan** memakai Web Share API. Fallback: hanya tombol unduh.
5. Jangan tampilkan saldo dompet di kartu (privasi) — hanya angka periode. Tambahkan toggle kecil "Sembunyikan nominal" yang mengganti angka menjadi persentase, untuk user yang mau share tanpa mengekspos gajinya.

**Acceptance criteria:**
- [ ] Kartu ter-render benar di device mobile (retina/DPR 2–3, teks tidak blur — set ukuran canvas fisik × DPR).
- [ ] Unduh menghasilkan PNG 1080×1920 yang tajam.
- [ ] Toggle privasi mengganti semua nominal menjadi persentase.
- [ ] Desain konsisten dengan brand (navy/kraft, Bricolage Grotesque via `ctx.font`; jika font belum ter-load, tunggu `document.fonts.ready`).

---

### FITUR D — PRESET KATEGORI & AMPLOP KHAS INDONESIA — PRIORITAS 4

**Masalah yang diselesaikan:** onboarding terasa "dibuat untuk aku", mengurangi friksi setup.

**Spesifikasi:**
1. Saat onboarding (dan bisa diakses lagi dari Pengaturan → "Pakai preset amplop"), tawarkan 3 paket preset:
   - **Anak Kos**: Makan, Kos, Transport, Kuota & Pulsa, Jajan & Nongkrong, Dana Darurat
   - **Pekerja Kantoran**: Makan, Transport, Tagihan, Kirim ke Orang Tua, Cicilan, Tabungan, Hiburan, Dana Darurat
   - **Keluarga Muda**: Dapur & Belanja, Tagihan Rumah, Anak & Sekolah, Transport, Kesehatan, Tabungan, Dana Darurat
2. Memilih preset akan MEMBUAT amplop-amplop tersebut dengan budget kosong (user isi nominalnya sendiri di langkah berikutnya) — jangan menimpa amplop yang sudah ada; jika nama sama sudah ada, lewati.
3. Tambahkan juga preset musiman yang muncul kontekstual berdasar bulan: amplop "THR & Lebaran" (muncul ±2 bulan sebelum Idulfitri) dan "Kado Akhir Tahun" (Nov–Des) sebagai saran satu-tap di Beranda, bisa di-dismiss.

**Acceptance criteria:**
- [ ] Preset membuat amplop tanpa menduplikasi yang sudah ada.
- [ ] Onboarding tetap bisa dilewati sepenuhnya (skip).
- [ ] Saran musiman muncul di bulan yang tepat dan bisa ditutup permanen (simpan flag di `DB.settings`).

---

### FITUR E — EKSPOR KE EXCEL/CSV — PRIORITAS 5

**Masalah yang diselesaikan:** menetralkan keraguan pembeli yang pindah dari template spreadsheet ("datamu tetap milikmu, kapan pun bisa jadi Excel").

**Spesifikasi:**
1. Di Pengaturan, section **"Ekspor Data"** dengan dua tombol: **Ekspor CSV** dan **Ekspor Excel (.xlsx)**.
2. **CSV**: generate manual tanpa library (escape koma/kutip dengan benar, prepend BOM `\uFEFF` supaya karakter terbaca benar saat dibuka di Excel Windows). Kolom: Tanggal, Jenis, Keterangan, Amplop, Dompet, Nominal (masuk positif, keluar negatif).
3. **XLSX**: gunakan SheetJS via CDN (`https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js`) — **lazy load** hanya saat tombol ditekan (inject `<script>` on demand), supaya tidak membebani load awal PWA dan tetap berfungsi offline untuk fitur lain. Jika load gagal (offline), tampilkan toast "Butuh koneksi internet untuk ekspor Excel — coba Ekspor CSV" .
4. Workbook berisi 2 sheet: `Transaksi` (semua transaksi) dan `Ringkasan` (per periode: total masuk, keluar, selisih; dan per amplop di periode berjalan).
5. Opsi rentang: "Periode ini" / "Semua data".
6. Nama file: `amplop-export-YYYY-MM-DD.xlsx` / `.csv`.

**Acceptance criteria:**
- [ ] CSV terbuka rapi di Excel & Google Sheets, karakter Indonesia tidak rusak.
- [ ] XLSX berisi 2 sheet dengan data benar.
- [ ] Lazy-load SheetJS tidak menambah waktu load awal app; gagal load ditangani anggun.
- [ ] Service worker tidak meng-cache-paksa CDN SheetJS dengan cara yang membuatnya stale/rusak.

---

## 4. ATURAN UMUM IMPLEMENTASI

1. **Backward compatibility data**: user lama punya `DB` tanpa field baru. Setiap akses field baru harus punya default aman (mis. `DB.settings ??= {}`, `DB.debts ??= []`). Jangan pernah membuat app crash karena data lama.
2. **Versi Cloud**: jika repo ini versi Supabase, tambahkan kolom/tabel yang diperlukan ke file SQL setup, pastikan RLS tetap benar, dan `debts` + `settings` ikut tersinkron dengan pola last-write-wins yang sudah ada. Dokumentasikan perubahan SQL di file terpisah `MIGRATION.md`.
3. **Bahasa & tone**: seluruh UI berbahasa Indonesia santai, konsisten dengan copy eksisting.
4. **Ukuran**: karena single-file, jaga JS tetap terorganisir — kelompokkan kode fitur baru dengan komentar section yang jelas (`/* ===== FITUR: CICILAN ===== */`).
5. **Testing manual minimum** setelah tiap fitur: buka fresh (localStorage kosong), buka dengan data lama, ganti bulan/periode maju-mundur, dan cek `node --check` / tidak ada error console.
6. **Service worker**: naikkan versi cache setiap rilis supaya user lama mendapat update.
7. Kerjakan **satu fitur per commit/PR**, urut A → E. Setelah tiap fitur selesai, tulis ringkasan singkat perubahan + cara mengujinya.

---

## 5. DEFINISI SELESAI (KESELURUHAN)

- Kelima fitur berfungsi di mobile viewport (±380px) dan desktop.
- Tidak ada regresi pada fitur eksisting (dompet, amplop, tagihan, transfer, pencarian, edit transaksi, onboarding, navigasi periode).
- Landing page TIDAK diubah di scope ini (akan di-update terpisah setelah fitur final).
