const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const STATUS = ["Belum", "Sedang dikerjakan", "Selesai", "Revisi"];
const DAY = 86400000;

const slug = (s) => s.toLowerCase().replace(/\s+/g, "-");
const fmt = (d) => `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;

export default function GanttChart({ tasks, range, today }) {
  const total = range.end - range.start;
  const pct = (d) => ((d - range.start) / total) * 100;

  // penanda awal tiap bulan
  const ticks = [];
  for (
    let d = new Date(range.start.getFullYear(), range.start.getMonth(), 1);
    d < range.end;
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  ) {
    ticks.push({ label: BULAN[d.getMonth()], left: Math.max(pct(d), 0) });
  }

  const dated = tasks.filter((t) => t.start && t.deadline);
  const undated = tasks.filter((t) => !t.start || !t.deadline);

  return (
    <div className="chart-scroll">
      <div className="chart">
        <div className="row head">
          <div className="label muted">Tugas · PIC</div>
          <div className="track">
            {ticks.map((t) => (
              <span key={t.label + t.left} className="tick" style={{ left: `${t.left}%` }}>{t.label}</span>
            ))}
            <span className="today-tag" style={{ left: `${pct(today)}%` }}>
              Hari ini · {today.getDate()} {BULAN[today.getMonth()]}
            </span>
          </div>
        </div>

        {[...dated, ...undated].map((t) => {
          const hasRange = t.start && t.deadline;
          return (
            <div className="row" key={t.id}>
              <div className="label">
                <strong>{t.nama}</strong>
                <span className="muted">
                  {t.pic.join(", ") || "Tanpa PIC"}
                  {t.status === "Revisi" ? " · perlu revisi" : ""}
                </span>
              </div>
              <div className="track">
                {hasRange ? (
                  <div
                    className={`bar ${slug(t.status)}`}
                    style={{
                      left: `${pct(t.start)}%`,
                      width: `${Math.max(((t.deadline - t.start + DAY) / total) * 100, 0.8)}%`,
                    }}
                    title={`${t.nama}: ${fmt(t.start)} sampai ${fmt(t.deadline)} · ${t.status}`}
                  />
                ) : (
                  <span className="no-date">Tanggal tidak lengkap · tidak bisa digambar</span>
                )}
              </div>
            </div>
          );
        })}

        <div className="today-line"><i style={{ left: `${pct(today)}%` }} /></div>
      </div>

      <div className="legend">
        {STATUS.map((s) => (
          <span key={s}><i className={`dot ${slug(s)}`} />{s}</span>
        ))}
        <span><i className="dot today" />Hari ini</span>
      </div>
    </div>
  );
}