export function toDateKey(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-CA");
}

export function formatDayLabel(key: string) {
  const d = new Date(key + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatMonth(key: string) {
  const d = new Date(key + "T12:00:00");
  return d.toLocaleDateString("en-US", { 
    month: "short"
  }).toUpperCase();
}
