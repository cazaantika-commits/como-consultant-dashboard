/**
 * API utility functions for Replit-integrated pages
 * These are compatibility functions to support ExecutiveCashFlow and other Replit pages
 */

/**
 * Format a number as AED currency
 */
export function formatAED(value: number | undefined | null): string {
  if (value === undefined || value === null) return "د.إ 0";
  return `د.إ ${value.toLocaleString("ar-AE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/**
 * Make an API request
 * This is a compatibility wrapper that uses tRPC under the hood
 */
export async function apiRequest(
  endpoint: string,
  options?: RequestInit
): Promise<any> {
  try {
    const response = await fetch(endpoint, {
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("API request error:", error);
    throw error;
  }
}

/**
 * Format a date string
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("ar-AE");
}

/**
 * Parse a number from a string
 */
export function parseNumber(value: string | number): number {
  if (typeof value === "number") return value;
  return parseFloat(value.replace(/,/g, "")) || 0;
}

/**
 * Format a number with thousands separator
 */
export function formatNumber(value: number | undefined | null): string {
  if (value === undefined || value === null) return "0";
  return value.toLocaleString("ar-AE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
