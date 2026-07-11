-- ============================================================
-- SETUP DATABASE AMPLOP CLOUD
-- Jalankan sekali di Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- 1. Tabel lisensi: daftar email pembeli.
--    Setiap ada pembeli baru di Lynk.id, tambahkan emailnya ke tabel ini
--    (lewat Dashboard > Table Editor > licenses > Insert row).
create table public.licenses (
  email      text primary key,
  note       text,                          -- opsional: nama pembeli / no. order Lynk.id
  created_at timestamptz not null default now()
);

alter table public.licenses enable row level security;

-- User yang login hanya bisa melihat baris lisensinya sendiri
-- (cukup untuk pengecekan "apakah email saya terdaftar").
create policy "baca lisensi sendiri"
  on public.licenses for select
  using (email = (auth.jwt() ->> 'email'));

-- 2. Tabel data pengguna: seluruh data app disimpan sebagai satu JSON per user.
create table public.user_data (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

create policy "baca data sendiri"
  on public.user_data for select
  using (auth.uid() = user_id);

create policy "tulis data sendiri"
  on public.user_data for insert
  with check (auth.uid() = user_id);

create policy "ubah data sendiri"
  on public.user_data for update
  using (auth.uid() = user_id);

-- Selesai. Dengan Row Level Security di atas, tiap user secara teknis
-- MUSTAHIL membaca atau mengubah data user lain, bahkan lewat API langsung.
