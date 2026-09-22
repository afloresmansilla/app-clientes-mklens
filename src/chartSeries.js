function parseDay(day) {
  const parts = String(day || "").split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function toIso(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

function startOfIsoWeek(date) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() - ((next.getDay() + 6) % 7));
  return next;
}

function monthKey(date) {
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
}

function spannedMonths(first, last) {
  return (last.getFullYear() - first.getFullYear()) * 12 + (last.getMonth() - first.getMonth()) + 1;
}

export function chartGranularity(points) {
  const list = points || [];
  if (list.length < 21) return "day";
  const first = parseDay(list[0].day);
  const last = parseDay(list[list.length - 1].day);
  if (!first || !last) return "day";
  if (first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear()) return "day";
  const days = Math.round((last.getTime() - first.getTime()) / 86400000) + 1;
  const weeks = Math.ceil(days / 7);
  if (spannedMonths(first, last) >= 3 || weeks > 8) return "month";
  return "week";
}

export function shouldUseWeekly(points) {
  return chartGranularity(points) === "week";
}

function groupBy(list, keyOf) {
  const groups = new Map();
  for (const point of list) {
    const date = parseDay(point.day);
    if (!date) continue;
    const key = keyOf(date);
    let group = groups.get(key);
    if (!group) {
      group = { day: key.length === 7 ? key + "-01" : key, count: 0, from: point.day, to: point.day };
      groups.set(key, group);
    }
    group.count += Number(point.count || 0);
    if (point.day < group.from) group.from = point.day;
    if (point.day > group.to) group.to = point.day;
  }
  return [...groups.values()];
}

export function chartSeries(points) {
  const list = points || [];
  const mode = chartGranularity(list);
  if (mode === "day") return { mode, points: list };
  if (mode === "month") {
    return { mode, points: groupBy(list, monthKey) };
  }
  return {
    mode,
    points: groupBy(list, (date) => toIso(startOfIsoWeek(date))),
  };
}

export { parseDay };
