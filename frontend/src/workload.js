const DAY = 86400000;
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export const DAY_MS = DAY;
export const LEVEL_LABEL = { z: "Kosong", l: "Rendah", n: "Normal", h: "Tinggi" };

export const fmtDay = (t) => {
  const d = new Date(t);
  return `${d.getUTCDate()} ${BULAN[d.getUTCMonth()]}`;
};

// semua tanggal diubah jadi "tengah malam UTC" supaya perbandingan hari konsisten
export function dayOf(v) {
  if (v == null || v === "") return null;
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return Date.parse(`${v}T00:00:00Z`);
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
}

// "Selesai" dan "Selesai revisi" dianggap tidak aktif
export const isActive = (status) => !/^selesai/i.test(String(status ?? "").trim());

function picsOf(t) {
  const p = t.pic ?? [];
  const list = Array.isArray(p) ? p : String(p).split(/[,&]/);
  return [...new Set(list.map((x) => String(x).trim()).filter(Boolean))];
}

// satu baris per (anggota, tugas)
export function toEntries(tasks) {
  const out = [];
  for (const t of tasks) {
    const s = dayOf(t.start);
    const e = dayOf(t.deadline);
    for (const m of picsOf(t)) {
      out.push({
        m,
        n: t.nama ?? t.name ?? "(tanpa nama)",
        div: t.divisi ?? t.division ?? "",
        s,
        e,
        status: t.status,
        dated: s != null && e != null,
      });
    }
  }
  return out;
}

export function buildMembers(entries) {
  const count = new Map();
  for (const e of entries) {
    const c = count.get(e.m) ?? {};
    c[e.div] = (c[e.div] ?? 0) + 1;
    count.set(e.m, c);
  }
  return [...count]
    .map(([m, c]) => ({ m, div: Object.entries(c).sort((a, b) => b[1] - a[1])[0][0] }))
    .sort((a, b) => a.div.localeCompare(b.div) || a.m.localeCompare(b.m));
}

// 8 minggu: 2 minggu sebelum minggu ini, minggu ini, dan 5 minggu ke depan (mulai Senin)
export function weeksFrom(today, count = 8, before = 2) {
  const dow = (new Date(today).getUTCDay() + 6) % 7;
  const monday = today - dow * DAY;
  return Array.from({ length: count }, (_, i) => monday + (i - before) * 7 * DAY);
}

export const loadIn = (act, m, w) =>
  act.filter((t) => t.m === m && t.s <= w + 6 * DAY && t.e >= w).length;

export const levelOf = (n, high) => (!n ? "z" : n >= high ? "h" : n >= 2 ? "n" : "l");

// dua tugas aktif milik anggota yang sama dengan tanggal bertumpuk
export function findConflicts(entries) {
  const act = entries.filter((e) => e.dated && isActive(e.status));
  const out = [];
  act.forEach((a, i) =>
    act.forEach((b, j) => {
      if (j > i && a.m === b.m && a.s <= b.e && b.s <= a.e) {
        out.push({ m: a.m, div: a.div, a, b, s: Math.max(a.s, b.s), e: Math.min(a.e, b.e) });
      }
    })
  );
  return out;
}