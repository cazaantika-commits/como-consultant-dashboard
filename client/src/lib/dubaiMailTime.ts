/** Mail timestamps are stored in UTC; SQL DATETIME values may arrive without an offset. */
export function formatDubaiMailTime(value: string | null | undefined): string {
  if (!value) return "غير مؤرخ";
  const utcValue = /Z$|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(utcValue);
  if (Number.isNaN(date.getTime())) return "غير مؤرخ";
  return new Intl.DateTimeFormat("ar-AE", {
    timeZone: "Asia/Dubai",
    day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
  }).format(date);
}
