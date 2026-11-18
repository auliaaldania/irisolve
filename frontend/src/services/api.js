const BASE = import.meta.env.VITE_API_URL;

const toDate = (s) => (s ? new Date(`${s}T00:00:00`) : null);

export async function fetchTasks() {
  const url = BASE ? `${BASE}/api/tasks` : "/mock/tasks.json";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Data gagal dimuat (kode ${res.status})`);
  const data = await res.json();
  return data.map((t) => ({
    ...t,
    pic: Array.isArray(t.pic) ? t.pic : t.pic ? [t.pic] : [],
    start: toDate(t.start),
    deadline: toDate(t.deadline),
  }));
}