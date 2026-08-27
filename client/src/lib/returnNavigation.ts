/**
 * Keeps a user inside COMO when a report was opened from another in-app screen.
 * Only relative, same-application paths are accepted; callers always retain a
 * local fallback for direct URL access.
 */
export function resolveReturnPath(search: string, fallback: string): string {
  const candidate = new URLSearchParams(search).get("returnTo");
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) {
    return fallback;
  }
  return candidate;
}

export function withReturnPath(target: string, returnTo: string): string {
  const [beforeHash, hash = ""] = target.split("#", 2);
  const [pathname, search = ""] = beforeHash.split("?", 2);
  const params = new URLSearchParams(search);
  params.set("returnTo", returnTo);
  return `${pathname}?${params.toString()}${hash ? `#${hash}` : ""}`;
}
