import { useState } from "react";
import { importCsv } from "../services/api";

export default function ImportDialog({ onClose, onDone }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      setReport(await importCsv(file));
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="panel modal" role="dialog" aria-modal="true" aria-label="Impor CSV" onClick={(e) => e.stopPropagation()}>
        <h3>Impor ulang dari CSV</h3>
        <p className="muted">
          Unduh tab divisi dari Google Sheets sebagai CSV. Kolom: Tugas, PIC, Start, Deadline (dd/mm/yyyy), Progress
          (angka atau Belum / Sedang dikerjakan / Selesai / Revisi). Baris yang sudah hilang dari sheet ikut dihapus.
        </p>
        <form onSubmit={submit} className="importform">
          <input type="file" accept=".csv,text/csv" onChange={(e) => { setFile(e.target.files[0] ?? null); setReport(null); }} />
          <button className="btn primary" disabled={!file || busy}>{busy ? "Mengunggah…" : "Impor"}</button>
        </form>
        {error && <p className="late" role="alert">{error}</p>}
        {report && (
          <div className="report">
            <p>
              <b>{report.succeeded} baris berhasil</b> ({report.inserted} baru, {report.updated} diperbarui, {report.unchanged} tetap
              {report.removed > 0 && `, ${report.removed} dihapus`}), <b>{report.failed} gagal</b>, {report.incomplete} tanggalnya tidak lengkap.
            </p>
            {report.errors.length > 0 && (
              <ul>{report.errors.map((x) => <li key={x.row}>Baris {x.row}: {x.reason}</li>)}</ul>
            )}
          </div>
        )}
        <div className="modalfoot"><button className="btn" onClick={onClose}>Tutup</button></div>
      </div>
    </div>
  );
}
