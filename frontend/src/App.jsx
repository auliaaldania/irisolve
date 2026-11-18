import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchTasks } from "./services/api";
import FilterBar from "./components/FilterBar";
import GanttChart from "./components/GanttChart";

const DAY = 86400000;
const DEFAULT_FILTERS = {
  divisi: "Semua",
  pic: "Semua",
  statuses: ["Belum", "Sedang dikerjakan", "Revisi"],
};

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setTasks(await fetchTasks());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // pilihan dropdown dibuat dari data, bukan ditulis manual
  const divisiList = useMemo(() => [...new Set(tasks.map((t) => t.divisi))].sort(), [tasks]);
  const picList = useMemo(() => [...new Set(tasks.flatMap((t) => t.pic))].sort(), [tasks]);

  // tiga filter dipakai bersamaan: tugas harus lolos ketiganya
  const visible = useMemo(
    () =>
      tasks.filter(
        (t) =>
          (filters.divisi === "Semua" || t.divisi === filters.divisi) &&
          (filters.pic === "Semua" || t.pic.includes(filters.pic)) &&
          filters.statuses.includes(t.status)
      ),
    [tasks, filters]
  );

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // rentang dihitung dari SEMUA tugas supaya bar tidak bergeser saat filter berubah
  const range = useMemo(() => {
    const starts = tasks.map((t) => t.start).filter(Boolean);
    const ends = tasks.map((t) => t.deadline).filter(Boolean);
    return {
      start: new Date(Math.min(...starts, today)),
      end: new Date(Math.max(...ends, today) + DAY),
    };
  }, [tasks, today]);

  const reset = () => setFilters(DEFAULT_FILTERS);

  return (
    <div className="page">
      <h1>Timeline</h1>
      <p className="muted">Semua tugas dari tab divisi dalam satu layar</p>

      <FilterBar
        filters={filters}
        setFilters={setFilters}
        divisiList={divisiList}
        picList={picList}
        onReset={reset}
      />

      {error ? (
        <div className="state error">
          <p>{error}. Cek apakah backend sudah jalan atau alamat API sudah benar.</p>
          <button className="btn" onClick={load}>Coba lagi</button>
        </div>
      ) : loading ? (
        <div className="state">Memuat tugas…</div>
      ) : visible.length === 0 ? (
        <div className="state">
          <p>Tidak ada tugas yang cocok dengan filter ini.</p>
          <button className="btn" onClick={reset}>Reset filter</button>
        </div>
      ) : (
        <>
          <p className="muted count">Menampilkan {visible.length} dari {tasks.length} tugas</p>
          <GanttChart tasks={visible} range={range} today={today} />
        </>
      )}
    </div>
  );
}