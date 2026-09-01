export function mergeProjectScheduleJson(
  currentJson: unknown,
  patch: Record<string, unknown>,
): string {
  let current: Record<string, any> = {};
  try {
    current = JSON.parse(typeof currentJson === "string" ? currentJson : "{}") || {};
  } catch {
    current = {};
  }

  const next: Record<string, any> = { ...current, ...patch };
  if (patch.settings && typeof patch.settings === "object") {
    next.settings = {
      ...(current.settings || {}),
      ...(patch.settings as Record<string, unknown>),
    };
  }
  return JSON.stringify(next);
}
