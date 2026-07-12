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
2. Buka **Authentication → Emails (Templates)** → template **Magic Link**
3. Ganti isi template agar mengirim kode 6 digit, bukan link. Contoh:

```html
<h2>Kode konfirmasi akun Amplop kamu</h2>
<p>Masukkan kode berikut di aplikasi untuk menyelesaikan pendaftaran:</p>
<h1>{{ .Token }}</h1>
<p>Kode berlaku 1 jam. Abaikan email ini jika kamu tidak mendaftar.</p>
```

Bagian penting: `{{ .Token }}` — itulah kode 6 digit yang dicocokkan app
lewat `supabase.auth.verifyOtp({ email, token, type: 'email' })`.

Catatan: app sengaja **tidak** bergantung pada opsi **Confirm email**
(boleh aktif atau nonaktif, terserah) — setelah `signUp()`, app selalu
memaksa langkah kode OTP terpisah lewat `signInWithOtp()`/template
**Magic Link** di atas, jadi akun tidak akan pernah langsung aktif tanpa
pemilik emailnya memasukkan kode, apa pun pengaturan Confirm email-nya.

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
   dengan domain app-mu, dan tambahkan domain yang sama (misal
   `https://www.amplop.online/login.html`) di kolom **Redirect URLs** —
   ini wajib supaya link "Lupa Password" dan reset dari admin panel
   mengarah balik ke halaman yang benar, bukan ditolak Supabase

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

## 8. Setup Panel Admin

Panel admin (`admin.html`) bisa melihat semua pengguna terdaftar, mengubah
email/password mereka, mengirim link reset password, dan menghapus akun.
Karena ini butuh privilege penuh (Supabase Admin API), butuh 2 langkah setup
manual yang **tidak bisa dilakukan lewat kode**:

1. **Buat akun admin di Supabase** (bukan lewat halaman Daftar):
   - Dashboard Supabase → **Authentication → Users → Add user**
   - Isi email admin (`arifhr24@gmail.com`) dan password admin pilihanmu
   - Centang **Auto Confirm User** supaya tidak perlu konfirmasi email
   - Email ini dicek terhadap konstanta `ADMIN_EMAIL` di `login.html`,
     `admin.html`, dan `api/admin.js` — kalau mau ganti/tambah admin, ubah
     nilai itu di ketiga file tersebut lalu deploy ulang

2. **Tambahkan environment variable di Vercel** (rahasia, jangan pernah
   ditaruh di kode/git):
   - Dashboard Supabase → **Project Settings → API** → salin **service_role
     key** (BUKAN anon key — kunci ini bisa mengambil-alih seluruh database,
     jaga baik-baik)
   - Dashboard Vercel → project ini → **Settings → Environment Variables** →
     tambahkan `SUPABASE_SERVICE_ROLE_KEY` = (paste key tadi) → Save
   - Redeploy project agar env var terbaca oleh `api/admin.js`

Setelah kedua langkah di atas selesai: masuk ke app dengan akun admin →
ikon 🛡️ muncul di pojok kanan atas header → klik untuk buka `admin.html`.

## Checklist sebelum launch

- [ ] SQL sudah dijalankan, dua tabel muncul
- [ ] Template **Magic Link** sudah berisi `{{ .Token }}` (dipakai untuk kode
      OTP saat Daftar — opsi Confirm email boleh aktif/nonaktif, tidak berpengaruh)
- [ ] SMTP custom terpasang (Resend/Brevo)
- [ ] URL + anon key sudah ditempel di login.html
- [ ] Site URL di Supabase diisi domain app
- [ ] Tes end-to-end: tambah email sendiri ke `licenses` → Daftar → masukkan
      kode OTP → langsung masuk → catat transaksi di HP → buka di laptop →
      data muncul
- [ ] Tes Daftar dengan email yang TIDAK ada di `licenses` → harus ditolak
- [ ] Tes Masuk dengan password salah → harus muncul peringatan
- [ ] Akun admin dibuat manual di Supabase Dashboard (bukan lewat Daftar)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` sudah diisi di Environment Variables Vercel
- [ ] Tes masuk sebagai admin → ikon 🛡️ muncul → buka admin.html → daftar
      pengguna muncul → coba edit email/password satu akun test → hapus
