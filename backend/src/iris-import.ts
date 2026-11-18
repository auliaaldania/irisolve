// IRISOLVE-9: Import CSV tracker divisi
// Asumsi stack: Node + TypeScript, Postgres (pg), papaparse.
import Papa from "papaparse";
import { createHash } from "node:crypto";
import type { Pool } from "pg";

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS tasks (
  id              BIGSERIAL PRIMARY KEY,
  division        TEXT    NOT NULL,
  source_row      INT     NOT NULL,          -- nomor baris di sheet ("baris 18")
  name            TEXT    NOT NULL,
  pics            TEXT[]  NOT NULL DEFAULT '{}',
  start_date      DATE,
  deadline        DATE,
  progress        INT CHECK (progress BETWEEN 0 AND 100),
  data_incomplete BOOLEAN NOT NULL DEFAULT FALSE,
  content_hash    TEXT    NOT NULL,
  imported_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (division, source_row)               -- kunci idempotensi
);

CREATE TABLE IF NOT EXISTS import_runs (
  id          BIGSERIAL PRIMARY KEY,
  division    TEXT NOT NULL,
  filename    TEXT,
  succeeded   INT NOT NULL,
  failed      INT NOT NULL,
  inserted    INT NOT NULL,
  updated     INT NOT NULL,
  unchanged   INT NOT NULL,
  incomplete  INT NOT NULL,
  errors      JSONB NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);`;

// ---------- Parsing helpers ----------

/** dd/mm/yyyy (atau d/m/yyyy) -> "yyyy-mm-dd". Kosong -> null. Salah -> undefined. */
export function parseDate(raw: string): string | null | undefined {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (!m) return undefined;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  // tolak tanggal yang tidak ada, mis. 31/02/2026
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d)
    return undefined;
  return dt.toISOString().slice(0, 10);
}

/** "50%", "50", "50,5%" -> 0..100. Kosong -> null. Salah -> undefined. */
export function parseProgress(raw: string): number | null | undefined {
  const s = (raw ?? "").trim().replace("%", "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0 || n > 100) return undefined;
  return Math.round(n);
}

const splitPics = (raw: string) =>
  (raw ?? "").split(/[,;&]/).map((p) => p.trim()).filter(Boolean);

export class ImportFormatError extends Error {}

export interface RowError { row: number; reason: string }
export interface ParsedTask {
  sourceRow: number; name: string; pics: string[];
  start: string | null; deadline: string | null;
  progress: number | null; incomplete: boolean;
}

export function parseTrackerCsv(csvText: string) {
  const { data } = Papa.parse<string[]>(csvText, { skipEmptyLines: false });
  const norm = (s: string) => (s ?? "").trim().toLowerCase();

  // 1. Cari baris header (kolom Tugas + Deadline), semua baris sebelumnya dilewati
  const headerIdx = data.findIndex((r) => r.map(norm).includes("tugas") && r.map(norm).includes("deadline"));
  if (headerIdx === -1) throw new ImportFormatError("Header tidak ditemukan (butuh kolom Tugas, PIC, Start, Deadline, Progress)");
  const col = Object.fromEntries(data[headerIdx].map((h, i) => [norm(h), i]));
  const need = ["tugas", "pic", "start", "deadline", "progress"];
  const missing = need.filter((k) => !(k in col));
  if (missing.length) throw new ImportFormatError(`Kolom tidak ada: ${missing.join(", ")}`);

  const tasks: ParsedTask[] = [];
  const errors: RowError[] = [];

  data.slice(headerIdx + 1).forEach((r, i) => {
    const row = headerIdx + 2 + i; // nomor baris asli di sheet (1-based)
    const cell = (k: string) => (r[col[k]] ?? "").trim();
    if (r.every((c) => !c?.trim())) return;               // baris kosong: abaikan
    if (/^contoh\b/i.test(cell("tugas"))) return;          // baris contoh: lewati

    const name = cell("tugas");
    if (!name) return void errors.push({ row, reason: "Nama tugas kosong" });

    const start = parseDate(cell("start"));
    const deadline = parseDate(cell("deadline"));
    const progress = parseProgress(cell("progress"));
    if (start === undefined) return void errors.push({ row, reason: `Format Start salah: "${cell("start")}" (harus dd/mm/yyyy)` });
    if (deadline === undefined) return void errors.push({ row, reason: `Format Deadline salah: "${cell("deadline")}" (harus dd/mm/yyyy)` });
    if (progress === undefined) return void errors.push({ row, reason: `Progress tidak valid: "${cell("progress")}"` });
    if (start && deadline && deadline < start)
      return void errors.push({ row, reason: "Deadline lebih awal dari Start" });

    tasks.push({
      sourceRow: row, name, pics: splitPics(cell("pic")),
      start, deadline, progress,
      incomplete: !start || !deadline,   // satu tanggal atau tanpa tanggal
    });
  });
  return { tasks, errors };
}

// ---------- Import (idempoten) ----------

export async function importDivisionCsv(pool: Pool, division: string, csvText: string, filename?: string) {
  const { tasks, errors } = parseTrackerCsv(csvText);
  let inserted = 0, updated = 0, unchanged = 0;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const t of tasks) {
      const hash = createHash("sha1")
        .update(JSON.stringify([t.name, t.pics, t.start, t.deadline, t.progress]))
        .digest("hex");
      const res = await client.query(
        `INSERT INTO tasks (division, source_row, name, pics, start_date, deadline, progress, data_incomplete, content_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (division, source_row) DO UPDATE SET
           name=EXCLUDED.name, pics=EXCLUDED.pics, start_date=EXCLUDED.start_date,
           deadline=EXCLUDED.deadline, progress=EXCLUDED.progress,
           data_incomplete=EXCLUDED.data_incomplete, content_hash=EXCLUDED.content_hash, imported_at=now()
         WHERE tasks.content_hash <> EXCLUDED.content_hash
         RETURNING (xmax = 0) AS inserted`,
        [division, t.sourceRow, t.name, t.pics, t.start, t.deadline, t.progress, t.incomplete, hash],
      );
      if (res.rowCount === 0) unchanged++;
      else if (res.rows[0].inserted) inserted++;
      else updated++;
    }
    const report = {
      succeeded: tasks.length, failed: errors.length,
      inserted, updated, unchanged,
      incomplete: tasks.filter((t) => t.incomplete).length,
      errors,
    };
    await client.query(
      `INSERT INTO import_runs (division, filename, succeeded, failed, inserted, updated, unchanged, incomplete, errors)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [division, filename ?? null, report.succeeded, report.failed, inserted, updated, unchanged, report.incomplete, JSON.stringify(errors)],
    );
    await client.query("COMMIT");
    return report;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// ---------- Contoh quick test (jalankan manual) ----------
// parseDate("05/09/2026") -> "2026-09-05"   (5 September, bukan 9 Mei)
// parseDate("31/02/2026") -> undefined      (tanggal tidak ada)
// parseDate("")           -> null           (kosong -> data_incomplete)
