import { useMemo, useState } from "react";
import { DAY_MS, LEVEL_LABEL, buildMembers, dayOf, fmtDay, isActive, levelOf, loadIn, toEntries, weeksFrom } from "../workload";

const KEY = "iris-batas-beban";
const CUR = 2; // indeks kolom "minggu ini"

const Pill = ({ n, high }) => {
  const lv = levelOf(n, high);
  return <span className={`wl-pill lv-${lv}`}>{LEVEL_LABEL[lv]}</span>;
};

export default function BebanKerja({ tasks, today, lastImport }) {
  const [high, setHigh] = useState(() => {
    try { return Number(localStorage.getItem(KEY)) || 3; } catch { return 3; }
  });
  const step = (v) => {
    const n = Math.max(3, Math.min(5, high + v));
    setHigh(n);
    try { localStorage.setItem(KEY, String(n)); } catch { /* abaikan */ }
  };

  const t0 = dayOf(today);
  const { members, act, weeks, skipped } = useMemo(() => {
    const entries = toEntries(tasks);
    return {
      members: buildMembers(entries),
      act: entries.filter((e) => e.dated && isActive(e.status)),
      weeks: weeksFrom(t0),
      skipped: tasks.filter((t) => isActive(t.status) && !(dayOf(t.start) != null && dayOf(t.deadline) != null)).length,
    };
  }, [tasks, t0]);

  const rows = members.map((mem) => {
    const loads = weeks.map((w) => loadIn(act, mem.m, w));
    return { ...mem, loads, peak: Math.max(...loads) };
  });
  const count = (lv) => rows.filter((r) => levelOf(r.peak, high) === lv).length;

  const divisions = [...new Set(rows.map((r) => r.div))].map((div) => {
    const mm = rows.filter((r) => r.div === div);
    return {
      div,
      n: mm.length,
      avg: mm.reduce((s, r) => s + r.loads[CUR], 0) / mm.length,
      peak: Math.max(...mm.map((r) => r.peak)),
      tinggi: mm.filter((r) => levelOf(r.peak, high) === "h").length,
    };
  });

  const endTs = weeks[weeks.length - 1] + 6 * DAY_MS;
  const dec = (x) => x.toFixed(1).replace(".", ",");

  return (
    <>
      <div className="titlebar">
        <div className="titleline">
          <h1>Beban kerja</h1>
          <span className="sub">{fmtDay(weeks[0])} – {fmtDay(endTs)} {new Date(endTs).getUTCFullYear()}</span>
        </div>
        {lastImport && (
          <span className="muted">
            Terakhir diimpor: {lastImport.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
          </span>
        )}
      </div>

      {skipped > 0 && (
        <div className="banner"><span>{skipped} tugas aktif tidak punya tanggal lengkap, jadi tidak dihitung.</span></div>
      )}

      {rows.length === 0 ? (
        <div className="state">Belum ada tugas dengan PIC dan tanggal lengkap.</div>
      ) : (
        <>
          <div className="cards four">
            <div className="card"><span>Anggota dipantau</span><b>{rows.length}</b></div>
            <div className="card"><span>Beban tinggi</span><b style={{ color: "var(--today)" }}>{count("h")}</b></div>
            <div className="card"><span>Beban normal</span><b>{count("n")}</b></div>
            <div className="card"><span>Beban rendah</span><b style={{ color: "var(--sedang)" }}>{count("l") + count("z")}</b></div>
          </div>

          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="wl-top">
              <h3>Tugas aktif per anggota per minggu</h3>
              <div className="wl-step">
                Batas beban tinggi ≥
                <button onClick={() => step(-1)} aria-label="Kurangi batas">−</button>
                <b>{high}</b>
                <button onClick={() => step(1)} aria-label="Tambah batas">+</button>
                tugas/minggu
              </div>
            </div>
            <div className="wl-scroll">
              <table className="wl-table">
                <thead>
                  <tr>
                    <th>Anggota</th>
                    {weeks.map((w, k) => (
                      <th key={w}>{fmtDay(w)}{k === CUR && <><br />minggu ini</>}</th>
                    ))}
                    <th>Puncak</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.m}>
                      <td><b>{r.m}</b><br /><span className="muted">{r.div}</span></td>
                      {r.loads.map((n, k) => (
                        <td key={k}>
                          <div className={`wl-cell lv-${levelOf(n, high)}${k === CUR ? " cur" : ""}`} title={`${r.m}: ${n} tugas aktif`}>
                            {n || "·"}
                          </div>
                        </td>
                      ))}
                      <td style={{ textAlign: "center" }}><Pill n={r.peak} high={high} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="wl-legend">
              <span><i className="dot lv-l" />Rendah (≤ 1)</span>
              <span><i className="dot lv-n" />Normal</span>
              <span><i className="dot lv-h" />Tinggi (≥ {high})</span>
              <span>Garis tepi = minggu ini</span>
            </div>
          </div>

          <div className="panel">
            <h3 style={{ marginBottom: 6 }}>Rekap per divisi · minggu ini</h3>
            {divisions.map((d) => {
              const lv = levelOf(d.peak, high);
              return (
                <div className="wl-div" key={d.div}>
                  <div><b>{d.div}</b><br /><span className="muted">{d.n} anggota</span></div>
                  <div>
                    <div className="wl-bar"><i className={`f-${lv}`} style={{ width: `${Math.min(100, (d.avg / high) * 100)}%` }} /></div>
                    <span className="muted" style={{ fontSize: 12 }}>Rata-rata {dec(d.avg)} tugas/anggota · puncak {d.peak}</span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    {d.tinggi ? <span className="wl-pill lv-h">{d.tinggi} berbeban tinggi</span> : <span className="wl-pill lv-n">Tidak ada yang tinggi</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}