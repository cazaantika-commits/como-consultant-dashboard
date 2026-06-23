/**
 * Toast hook for Replit-integrated pages
 * This is a compatibility wrapper that uses sonner toast
 */

import { toast as sonnerToast } from "sonner";

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function useToast() {
  return {
    toast: ({
      title,
      description,
      variant = "default",
    }: {
      title?: string;
      description?: string;
      variant?: "default" | "destructive";
    }) => {
      if (variant === "destructive") {
        sonnerToast.error(title || description || "Error");
      } else {
        sonnerToast.success(title || description || "Success");
      }
    },
  };
}
