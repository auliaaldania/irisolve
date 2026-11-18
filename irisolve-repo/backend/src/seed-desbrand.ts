// backend/src/seed-desbrand.ts
// Data diambil dari CSV asli DesBrand (kolom Progress di sheet berisi status teks, bukan angka).
// Status disimpan apa adanya di kolom status (termasuk Revisi); progress diisi perkiraan 100/50/0.
import { createHash } from "node:crypto";
import { pool } from "./db";

const DIVISION = "DesBrand";
const PROGRESS: Record<string, number> = { "Selesai": 100, "Sedang dikerjakan": 50, "Belum": 0, "Revisi": 50 };

// [baris di sheet, nama tugas, PIC[], start, deadline, status]
const rows: [number, string, string[], string | null, string | null, string][] = [
  [21, "Konsep mini Video profile", ["Waffi", "Tiara"], "2026-08-26", "2026-09-02", "Selesai"],
  [22, "Take Video Profile di IG", ["Apip"], "2026-09-05", null, "Selesai"],
  [23, "Editing Video", ["Apip"], "2026-09-06", "2026-09-13", "Selesai"],
  [24, "Membuat Feeds cover video Profile", ["Tiara"], "2026-09-01", "2026-09-13", "Selesai"],
  [25, "Membuat Feeds Open Recruitment", ["Clara"], "2026-09-01", "2026-09-13", "Selesai"],
  [36, "Membuat desain oprec untuk dashboard MyITS", ["Waffi"], "2026-09-01", "2026-09-13", "Selesai"],
  [38, "Membuat Desain GuideBook Open Recruitment", ["Waffi"], "2026-09-01", "2026-09-15", "Selesai"],
  [39, "Penyusunan GSM IRIS yang Baru", ["Clara", "Tiara"], "2026-09-01", "2026-09-30", "Sedang dikerjakan"],
  [40, "Membuat konten Open Recruitment", ["Apip", "Tiara"], "2026-09-01", "2026-09-15", "Selesai"],
  [42, "Membuat modul magang", ["Waffi", "Clara"], "2026-09-01", "2026-09-13", "Selesai"],
  [43, "Membuat desain modul magang", ["Apip", "Tiara"], "2026-09-01", "2026-09-13", "Selesai"],
  [44, "Template twibbon feeds oprec", ["Waffi"], "2026-09-14", "2026-09-17", "Selesai"],
  [45, "Video untuk videotron", ["Apip"], "2026-09-14", "2026-09-15", "Selesai"],
  [46, "Feeds about IRIS dan Our Division", ["Tiara"], "2026-09-14", "2026-09-17", "Selesai"],
  [47, "Desain brosur oprec", ["Waffi"], "2026-09-14", "2026-09-14", "Selesai"],
  [48, "Desain feeds ekstra time", ["Clara"], "2026-09-14", "2026-09-24", "Selesai"],
  [49, "Desain feeds thank you candidates", ["Tiara"], "2026-09-14", "2026-09-25", "Selesai"],
  [50, "Desain banner bundaran SCC", ["Tiara"], "2026-09-14", "2026-09-15", "Selesai"],
  [51, "Story see you at TW 1", ["Clara"], "2026-09-21", "2026-09-21", "Selesai"],
  [53, "Story QnA", ["Clara"], "2026-09-21", "2026-09-22", "Selesai"],
  [54, "Story Extend Regist", ["Clara"], "2026-09-21", "2026-09-24", "Selesai"],
  [55, "Story Countdown Regist", ["Clara"], null, "2026-09-25", "Selesai"],
  [56, "Story ThankYou Candidates", ["Clara"], null, "2026-09-25", "Selesai"],
  [57, "Story informasi Open email (lolos administrasi)", ["Clara"], "2026-09-21", "2026-09-26", "Selesai"],
  [58, "Story lolos magang IRIS (Open Web)", ["Clara"], "2026-09-21", "2026-09-29", "Selesai"],
  [60, "Story Happy Graduation", ["Apip"], "2026-10-09", "2026-10-17", "Selesai"],
  [61, "Desain Propo Sponsorship", ["Tiara"], "2026-10-09", "2026-10-31", "Sedang dikerjakan"],
  [62, "Desain X Banner", ["Clara"], "2026-10-09", "2026-10-17", "Selesai"],
];

async function main() {
  await pool.query("DELETE FROM tasks WHERE division = $1", [DIVISION]); // buang data lama biar tidak dobel
  for (const [sourceRow, name, pics, start, deadline, status] of rows) {
    const progress = PROGRESS[status] ?? 0;
    const hash = createHash("sha1").update(JSON.stringify([name, pics, start, deadline, progress, status])).digest("hex");
    await pool.query(
      `INSERT INTO tasks (division, source_row, name, pics, start_date, deadline, progress, status, data_incomplete, content_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [DIVISION, sourceRow, name, pics, start, deadline, progress, status, !start || !deadline, hash],
    );
  }
  const incomplete = rows.filter((r) => !r[3] || !r[4]).length;
  console.log(`Selesai: ${rows.length} tugas masuk ke DesBrand (${incomplete} tanggalnya tidak lengkap)`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
