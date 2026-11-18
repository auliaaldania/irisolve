import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import { pool } from "./db";
import { authRouter, authenticate, requireRole, taskScope } from "./iris-auth";
import { importDivisionCsv, ImportFormatError } from "./iris-import";

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : true }));
app.use(express.json());
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// IRISOLVE-10: login & role
app.use("/api/auth", authRouter(pool));

// Daftar tugas, otomatis dibatasi sesuai role.
// ?view=mine -> hanya tugas atas nama sendiri ("Tugas saya"); ?division=X -> filter (GM)
app.get("/api/tasks", authenticate, async (req, res) => {
  const user = req.user!;
  const scope = taskScope(user, req.query.view === "mine" ? "mine" : "division");
  const params = [...scope.params];
  let where = scope.sql;
  if (user.role === "gm" && typeof req.query.division === "string") {
    params.push(req.query.division);
    where += ` AND division = $${params.length}`;
  }
  const { rows } = await pool.query(
    `SELECT id, division, source_row AS "sourceRow", name, pics,
            start_date::text AS start, deadline::text AS deadline,
            progress, status, data_incomplete AS "dataIncomplete", imported_at AS "importedAt"
     FROM tasks WHERE ${where}
     ORDER BY division, deadline NULLS LAST, source_row`,
    params,
  );
  res.json(rows);
});

// IRISOLVE-9: import CSV (koordinator, hanya untuk divisinya sendiri)
app.post("/api/import", authenticate, requireRole("koordinator"), upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "File CSV wajib diunggah (field: file)" });
  try {
    const report = await importDivisionCsv(
      pool, req.user!.division!, req.file.buffer.toString("utf8"), req.file.originalname,
    );
    res.json(report);
  } catch (e) {
    if (e instanceof ImportFormatError) return res.status(400).json({ error: e.message });
    console.error(e);
    res.status(500).json({ error: "Import gagal karena kesalahan server" });
  }
});

// Info "Terakhir diimpor" untuk header Timeline
app.get("/api/import/latest", authenticate, async (req, res) => {
  const u = req.user!;
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (division) division, filename, succeeded, failed, incomplete, created_at AS "importedAt"
     FROM import_runs ${u.role === "gm" ? "" : "WHERE division = $1"}
     ORDER BY division, created_at DESC`,
    u.role === "gm" ? [] : [u.division],
  );
  res.json(rows);
});

// Error upload (mis. file > 2MB) dan error tak terduga lainnya -> JSON, bukan halaman HTML
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err?.code === "LIMIT_FILE_SIZE") return res.status(400).json({ error: "File terlalu besar (maksimal 2 MB)" });
  console.error(err);
  res.status(500).json({ error: "Kesalahan server" });
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`IRISolve backend jalan di http://localhost:${port}`));
