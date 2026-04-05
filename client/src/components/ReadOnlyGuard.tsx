import { useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";

/**
 * ReadOnlyGuard
 * Adds `data-readonly="true"` to <body> when the logged-in user is not an admin.
 * CSS in index.css hides all [data-hide-readonly] elements in that state.
 * No page-level changes needed.
 */
export function ReadOnlyGuard({ children }: { children: React.ReactNode }) {
  const { isReadOnly, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (isReadOnly) {
      document.body.setAttribute("data-readonly", "true");
    } else {
      document.body.removeAttribute("data-readonly");
    }
  }, [isReadOnly, loading]);

  return <>{children}</>;
}
