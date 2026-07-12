# Panduan Setup Amplop Cloud

Versi cloud: login email + password (dengan flow Masuk/Daftar terpisah), data tersinkron otomatis antar perangkat, lisensi menempel di akun pembeli.

## 1. Buat project Supabase (gratis)

1. Daftar di https://supabase.com → **New project**
2. Isi nama project (misal `amplop`), buat database password (simpan baik-baik), pilih region **Southeast Asia (Singapore)** agar cepat dari Indonesia
3. Tunggu ±2 menit sampai project siap

## 2. Jalankan SQL setup

1. Di dashboard Supabase, buka **SQL Editor** → **New query**
2. Copy seluruh isi file `supabase-setup.sql` → paste → **Run**
3. Cek di **Table Editor**: harus muncul tabel `licenses` dan `user_data`

## 3. Aktifkan login email + password dengan kode OTP saat Daftar

1. Buka **Authentication → Sign In / Providers → Email**: pastikan Email aktif
2. Di halaman yang sama, opsi **Confirm email** harus **AKTIF** — ini yang
   memaksa Supabase mengirim kode konfirmasi setiap kali ada yang Daftar.
   Kalau opsi ini nonaktif, Daftar akan langsung membuat sesi login tanpa
   pernah menampilkan langkah kode OTP di app.
3. Buka **Authentication → Emails (Templates)** → template **Confirm signup**
4. Ganti isi template agar mengirim kode 6 digit, bukan link. Contoh:

```html
<h2>Kode konfirmasi akun Amplop kamu</h2>
<p>Masukkan kode berikut di aplikasi untuk menyelesaikan pendaftaran:</p>
<h1>{{ .Token }}</h1>
<p>Kode berlaku 1 jam. Abaikan email ini jika kamu tidak mendaftar.</p>
```

Bagian penting: `{{ .Token }}` — itulah kode 6 digit yang dicocokkan app
lewat `supabase.auth.verifyOtp({ email, token, type: 'signup' })`.

> ⚠️ **PENTING sebelum jualan:** email bawaan Supabase dibatasi sangat ketat
> (hanya beberapa email per jam) dan hanya untuk development. Untuk produksi,
> pasang SMTP sendiri di **Project Settings → Authentication → SMTP Settings**.
> Opsi gratis yang umum: Resend (resend.com, gratis 3.000 email/bulan) atau
> Brevo. Tanpa ini, pembeli kedua yang daftar di jam yang sama bisa tidak
> menerima kode.

## 4. Sambungkan app ke Supabase

1. Di dashboard: **Project Settings → API**
2. Salin **Project URL** dan **anon public key**
3. Buka `login.html`, cari bagian paling atas `<script>`:

```js
const SUPABASE_URL='GANTI_DENGAN_PROJECT_URL';
const SUPABASE_ANON_KEY='GANTI_DENGAN_ANON_PUBLIC_KEY';
```

Ganti kedua nilai tersebut. (Anon key memang aman ditaruh di kode publik —
keamanan data dijaga oleh Row Level Security yang sudah di-setup di SQL.)

Catatan: selama kedua nilai masih `GANTI_...`, app berjalan dalam **mode lokal**
tanpa login — sengaja, supaya kamu bisa testing dulu.

## 5. Deploy

1. Push folder ini ke repo GitHub → import ke Vercel (sama seperti biasa)
2. Pasang domainmu di Vercel: **Settings → Domains** (misal `app.amplop.id`,
   dan landing page di `amplop.id`)
3. Di Supabase: **Authentication → URL Configuration** → isi **Site URL**
   dengan domain app-mu

## 6. Alur kerja setiap ada pembeli

1. Pembeli checkout di Lynk.id → kamu menerima notifikasi berisi **email pembeli**
2. Buka Supabase → **Table Editor → licenses → Insert row** → isi kolom
   `email` dengan email pembeli (huruf kecil semua), kolom `note` bebas
   (misal nama/no. order) → Save
3. Pembeli buka app → tab **Daftar** → isi email yang sama + buat password →
   masukkan kode 6 digit yang dikirim ke emailnya → akun otomatis aktif dan
   langsung masuk ✅. Lain kali, cukup tab **Masuk** dengan email + password.

Jika pembeli komplain "belum terdaftar sebagai pembeli" saat Daftar: hampir
selalu karena email yang dipakai beda dengan email saat checkout. Cocokkan,
lalu tambahkan email yang benar ke tabel `licenses`.

Untuk refund/blokir: hapus baris emailnya dari tabel `licenses` — dia tidak
akan bisa masuk lagi setelah sesi loginnya berakhir (dicek ulang tiap login).

## 7. Cara kerja sinkronisasi (untuk kamu pahami)

- Setiap perubahan disimpan dulu ke perangkat (offline-first), lalu didorong ke
  cloud otomatis ±1 detik kemudian. Status terlihat di pojok kanan atas:
  ☁️ Tersimpan / ☁️ Menyimpan… / 📴 Offline
- Saat app dibuka, versi cloud dan versi lokal dibandingkan berdasarkan waktu —
  yang terbaru yang dipakai (last-write-wins)
- Batasan yang wajar diketahui: jika user mengedit di dua perangkat *bersamaan
  dalam kondisi offline*, saat online yang tersimpan adalah perubahan terakhir.
  Untuk aplikasi keuangan pribadi satu pengguna, ini praktis tidak pernah jadi
  masalah.

## Checklist sebelum launch

- [ ] SQL sudah dijalankan, dua tabel muncul
- [ ] Opsi Confirm email **AKTIF** (wajib, supaya kode OTP saat Daftar terkirim)
- [ ] Template Confirm signup sudah berisi `{{ .Token }}`
- [ ] SMTP custom terpasang (Resend/Brevo)
- [ ] URL + anon key sudah ditempel di login.html
- [ ] Site URL di Supabase diisi domain app
- [ ] Tes end-to-end: tambah email sendiri ke `licenses` → Daftar → masukkan
      kode OTP → langsung masuk → catat transaksi di HP → buka di laptop →
      data muncul
- [ ] Tes Daftar dengan email yang TIDAK ada di `licenses` → harus ditolak
- [ ] Tes Masuk dengan password salah → harus muncul peringatan
