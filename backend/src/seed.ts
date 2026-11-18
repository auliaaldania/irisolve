// npm run db:seed  -> bikin akun contoh (password semua: iris12345, GANTI untuk produksi)
import { pool } from "./db";
import { createUser } from "./iris-auth";

(async () => {
  await pool.query("DELETE FROM users");
  await createUser(pool, { username: "gm", password: "iris12345", role: "gm" });
  await createUser(pool, { username: "koor.programming", password: "iris12345", role: "koordinator", division: "Programming" });
  await createUser(pool, { username: "aslam", password: "iris12345", role: "staff", division: "Programming", picName: "Aslam" });
  console.log("Akun contoh dibuat: gm, koor.programming, aslam (password: iris12345)");
  await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });
