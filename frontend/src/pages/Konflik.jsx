import { useMemo, useState } from "react";
import { DAY_MS, dayOf, findConflicts, fmtDay, toEntries } from "../workload";

function Pair({ c, past }) {
  const lo = Math.min(c.a.s, c.b.s);
  const span = Math.max(c.a.e, c.b.e) - lo + DAY_MS;
  const x = (t) => ((t - lo) / span) * 100;
  const w = (s, e) => ((e - s + DAY_MS) / span) * 100;
  return (
    <div className="wl-pair">
      <div className="t">
        <span>{c.a.n} × {c.b.n}</span>
        <span className="wl-hit">
          Bentrok {fmtDay(c.s)} – {fmtDay(c.e)} · {(c.e - c.s) / DAY_MS + 1} hari
          {past && <span className="muted"> · sudah lewat</span>}
        </span>
      </div>
      <div className="wl-track">
        <div className="ov" style={{ left: `${x(c.s)}%`, width: `${w(c.s, c.e)}%` }} />
        <b style={{ top: 6, left: `${x(c.a.s)}%`, width: `${w(c.a.s, c.a.e)}%` }} />
        <b style={{ top: 22, left: `${x(c.b.s)}%`, width: `${w(c.b.s, c.b.e)}%` }} />
      </div>
      <div className="wl-dates">
        <span>{fmtDay(c.a.s)} – {fmtDay(c.a.e)}</span>
        <span>{fmtDay(c.b.s)} – {fmtDay(c.b.e)}</span>
      </div>
    </div>
  );
}

export default function Konflik({ tasks, today, lastImport, onGoTimeline }) {
  const [showPast, setShowPast] = useState(false);
  const t0 = dayOf(today);

  const { aktif, pastCount, people } = useMemo(() => {
    const all = findConflicts(toEntries(tasks)).sort((a, b) => a.s - b.s);
    const list = showPast ? all : all.filter((c) => c.e >= t0);
    const map = new Map();
    for (const c of list) map.set(c.m, [...(map.get(c.m) ?? []), c]);
    return {
      aktif: all.filter((c) => c.e >= t0).length,
      pastCount: all.filter((c) => c.e < t0).length,
      people: [...map].sort((a, b) => b[1].length - a[1].length),
    };
  }, [tasks, t0, showPast]);

  return (
    <>
      <div className="titlebar">
        <div className="titleline">
          <h1>Konflik jadwal</h1>
          <span className="sub">Tugas tumpang tindih pada anggota yang sama</span>
        </div>
        {lastImport && (
          <span className="muted">
            Terakhir diimpor: {lastImport.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
          </span>
        )}
      </div>

      <div className={`banner${aktif ? "" : " ok"}`}>
        <div>
          {aktif ? (
            <><b>{aktif} konflik aktif</b>. Dihitung ulang dari data terbaru setiap impor.</>
          ) : (
            <><b>Tidak ada konflik aktif.</b>{pastCount > 0 && <> Ada {pastCount} konflik lama yang jadwalnya sudah lewat.</>}</>
          )}
        </div>
        <button className="btn" onClick={onGoTimeline}>Lihat di timeline</button>
      </div>

      {pastCount > 0 && (
        <label className="wl-check">
          <input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} />
          Tampilkan konflik yang jadwalnya sudah lewat ({pastCount})
        </label>
      )}

      {people.map(([m, arr]) => (
        <div className="panel" key={m} style={{ marginBottom: 16 }}>
          <div className="wl-person">
            <div className="wl-av">{m[0]}</div>
            <div><b>{m}</b><br /><span className="muted">{arr[0].div} · {arr.length} bentrok</span></div>
          </div>
          {arr.map((c, i) => <Pair key={i} c={c} past={c.e < t0} />)}
        </div>
      ))}
    </>
  );
}