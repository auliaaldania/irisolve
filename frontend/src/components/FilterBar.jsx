import StatusFilter from "./StatusFilter";

export default function FilterBar({ filters, setFilters, divisiList, picList, onReset }) {
  const set = (key) => (e) => setFilters({ ...filters, [key]: e.target.value });

  // ganti divisi -> PIC kembali ke "Semua"
  const setDivisi = (e) =>
    setFilters({ ...filters, divisi: e.target.value, pic: "Semua" });

  return (
    <div className="filters">
      <select className="control" value={filters.divisi} onChange={setDivisi} aria-label="Filter divisi">
        <option value="Semua">Divisi: Semua</option>
        {divisiList.map((d) => <option key={d}>{d}</option>)}
      </select>

      <select className="control" value={filters.pic} onChange={set("pic")} aria-label="Filter PIC">
        <option value="Semua">PIC: Semua</option>
        {picList.map((p) => <option key={p}>{p}</option>)}
      </select>

      <StatusFilter
        value={filters.statuses}
        onChange={(statuses) => setFilters({ ...filters, statuses })}
      />

      <button className="btn ghost" onClick={onReset}>Reset filter</button>
    </div>
  );
}