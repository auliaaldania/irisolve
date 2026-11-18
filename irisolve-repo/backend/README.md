# IRISolve Backend

Node + TypeScript + Express + Postgres.

## Menjalankan
1. `npm install`
2. Salin `.env.example` jadi `.env`, ganti `JWT_SECRET` dengan string acak panjang
3. Database: `docker compose up -d` (atau pakai Neon/Supabase, isi `DATABASE_URL` di `.env`)
4. `npm run db:init` (buat tabel) lalu `npm run db:seed` (akun contoh)
5. `npm run dev` -> http://localhost:3000

Akun contoh (password dev: `iris12345`, atau isi `SEED_PASSWORD`): `gm`, `koor.programming`, `koor.mekanik`, `koor.electrical`, `koor.adfin`, `koor.desbrand`, `aslam` (staff)

## Endpoint
| Method | Path | Akses |
|---|---|---|
| POST | /api/auth/login | publik |
| GET | /api/auth/me | login |
| GET | /api/tasks (?view=mine, ?division=X khusus GM) | login, dibatasi role |
| POST | /api/import (multipart, field `file`) | koordinator, divisinya sendiri |
| GET | /api/import/latest | login |

Kolom Progress di CSV boleh angka (`60%`) atau teks (`Belum`, `Sedang dikerjakan`, `Selesai`, `Revisi`). Baris yang sudah hilang dari sheet ikut dihapus saat impor ulang.

Tes cepat: `sample/tracker-programming.csv`
