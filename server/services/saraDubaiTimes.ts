const UTC_SQL_TIMESTAMP = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/;
const UTC_ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/i;

/** SQL timestamp(mode:string) fields in COMO are stored in UTC without a suffix. */
export function saraDubaiTimestamp(value: unknown) {
  if (typeof value !== "string") return null;
  const source = value.trim();
  if (!UTC_SQL_TIMESTAMP.test(source) && !UTC_ISO_TIMESTAMP.test(source)) return null;
  const date = new Date(UTC_SQL_TIMESTAMP.test(source) ? `${source.replace(" ", "T")}Z` : source);
  if (Number.isNaN(date.getTime())) return null;
  return {
    utc: date.toISOString(),
    dubai: `${new Intl.DateTimeFormat("ar-AE", {
      timeZone: "Asia/Dubai", weekday: "long", year: "numeric", month: "long", day: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
    }).format(date)} بتوقيت دبي`,
  };
}

/** Normalize every timestamp in Sara's read-only tool payload, including nested dossier records. */
export function presentSaraDubaiTimes<T>(value: T): T {
  if (Array.isArray(value)) return value.map(item => presentSaraDubaiTimes(item)) as T;
  if (!value || typeof value !== "object" || value instanceof Date) return value;
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (/At$/.test(key)) {
      const timestamp = saraDubaiTimestamp(item);
      if (timestamp) {
        result[key] = timestamp.utc;
        result[`${key}Dubai`] = timestamp.dubai;
        continue;
      }
    }
    result[key] = presentSaraDubaiTimes(item);
  }
  return result as T;
}
