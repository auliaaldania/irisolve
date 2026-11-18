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
  status          TEXT    NOT NULL DEFAULT 'Belum',
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
);
-- migrasi untuk database yang sudah ada (aman dijalankan berulang)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Belum';
ALTER TABLE import_runs ADD COLUMN IF NOT EXISTS removed INT NOT NULL DEFAULT 0;`;

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

export const STATUSES = ["Belum", "Sedang dikerjakan", "Selesai", "Revisi"] as const;
export type Status = (typeof STATUSES)[number];
const PROGRESS_OF: Record<Status, number> = { "Belum": 0, "Sedang dikerjakan": 50, "Selesai": 100, "Revisi": 50 };
export const statusFromProgress = (p: number | null): Status =>
  p !== null && p >= 100 ? "Selesai" : p !== null && p > 0 ? "Sedang dikerjakan" : "Belum";

/** Kolom Progress/Status boleh angka ("60%") atau teks ("Selesai", "Revisi"). Salah -> undefined. */
export function parseStatus(raw: string): { status: Status; progress: number | null } | undefined {
  const s = (raw ?? "").trim();
  if (!s) return { status: "Belum", progress: null };
  const text = STATUSES.find((x) => x.toLowerCase() === s.toLowerCase());
  if (text) return { status: text, progress: PROGRESS_OF[text] };
  const n = parseProgress(s);
  if (n === undefined || n === null) return undefined;
  return { status: statusFromProgress(n), progress: n };
}

const splitPics = (raw: string) =>
  (raw ?? "").split(/[,;&]/).map((p) => p.trim()).filter(Boolean);

export class ImportFormatError extends Error {}

export interface RowError { row: number; reason: string }
export interface ParsedTask {
  sourceRow: number; name: string; pics: string[];
  start: string | null; deadline: string | null;
  progress: number | null; status: Status; incomplete: boolean;
}

export function parseTrackerCsv(csvText: string) {
  const { data } = Papa.parse<string[]>(csvText, { skipEmptyLines: false });
  const norm = (s: string) => (s ?? "").trim().toLowerCase();

  // 1. Cari baris header (kolom Tugas + Deadline), semua baris sebelumnya dilewati
  const headerIdx = data.findIndex((r) => r.map(norm).includes("tugas") && r.map(norm).includes("deadline"));
  if (headerIdx === -1) throw new ImportFormatError("Header tidak ditemukan (butuh kolom Tugas, PIC, Start, Deadline, Progress)");
  const col = Object.fromEntries(data[headerIdx].map((h, i) => [norm(h), i]));
  const need = ["tugas", "pic", "start", "deadline"];
  const missing = need.filter((k) => !(k in col));
  const progCol = col["progress"] ?? col["status"];   // sheet asli kadang memakai "Status"
  if (progCol === undefined) missing.push("progress");
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
    const parsed = parseStatus((r[progCol] ?? "").trim());
    if (start === undefined) return void errors.push({ row, reason: `Format Start salah: "${cell("start")}" (harus dd/mm/yyyy)` });
    if (deadline === undefined) return void errors.push({ row, reason: `Format Deadline salah: "${cell("deadline")}" (harus dd/mm/yyyy)` });
    if (parsed === undefined) return void errors.push({ row, reason: `Progress/status tidak valid: "${(r[progCol] ?? "").trim()}" (isi angka 0-100 atau Belum / Sedang dikerjakan / Selesai / Revisi)` });
    if (start && deadline && deadline < start)
      return void errors.push({ row, reason: "Deadline lebih awal dari Start" });

    tasks.push({
      sourceRow: row, name, pics: splitPics(cell("pic")),
      start, deadline, progress: parsed.progress, status: parsed.status,
      incomplete: !start || !deadline,   // satu tanggal atau tanpa tanggal
    });
  });
  return { tasks, errors };
}

// ---------- Import (idempoten) ----------

export async function importDivisionCsv(pool: Pool, division: string, csvText: string, filename?: string) {
  const { tasks, errors } = parseTrackerCsv(csvText);
  let inserted = 0, updated = 0, unchanged = 0, removed = 0;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const t of tasks) {
      const hash = createHash("sha1")
        .update(JSON.stringify([t.name, t.pics, t.start, t.deadline, t.progress, t.status]))
        .digest("hex");
      const res = await client.query(
        `INSERT INTO tasks (division, source_row, name, pics, start_date, deadline, progress, status, data_incomplete, content_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (division, source_row) DO UPDATE SET
           name=EXCLUDED.name, pics=EXCLUDED.pics, start_date=EXCLUDED.start_date,
           deadline=EXCLUDED.deadline, progress=EXCLUDED.progress, status=EXCLUDED.status,
           data_incomplete=EXCLUDED.data_incomplete, content_hash=EXCLUDED.content_hash, imported_at=now()
         WHERE tasks.content_hash <> EXCLUDED.content_hash
         RETURNING (xmax = 0) AS inserted`,
        [division, t.sourceRow, t.name, t.pics, t.start, t.deadline, t.progress, t.status, t.incomplete, hash],
      );
      if (res.rowCount === 0) unchanged++;
      else if (res.rows[0].inserted) inserted++;
      else updated++;
    }
    // Baris yang sudah tidak ada di sheet dibuang. Baris yang error tetap dipertahankan
    // (masih ada di sheet), dan file tanpa tugas valid tidak pernah menghapus apa pun.
    if (tasks.length > 0) {
      const keep = [...tasks.map((t) => t.sourceRow), ...errors.map((e) => e.row)];
      const del = await client.query(
        "DELETE FROM tasks WHERE division = $1 AND NOT (source_row = ANY($2::int[]))", [division, keep]);
      removed = del.rowCount ?? 0;
    }
    const report = {
      succeeded: tasks.length, failed: errors.length,
      inserted, updated, unchanged, removed,
      incomplete: tasks.filter((t) => t.incomplete).length,
      errors,
    };
    await client.query(
      `INSERT INTO import_runs (division, filename, succeeded, failed, inserted, updated, unchanged, removed, incomplete, errors)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [division, filename ?? null, report.succeeded, report.failed, inserted, updated, unchanged, removed, report.incomplete, JSON.stringify(errors)],
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
