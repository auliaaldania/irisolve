import "dotenv/config";
import { Pool } from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL belum di-set di .env");

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,                    // hemat koneksi (Vercel membuat banyak instance kecil)
  idleTimeoutMillis: 10_000,
  // Neon/Supabase butuh SSL; Postgres lokal tidak
  ssl: /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL) ? false : { rejectUnauthorized: false },
});
