import type { ReactNode } from "react";
import type { MajanLocale, ModelIssue } from "@shared/majanFinanceTypes";

export type Translation = {
  en: string;
  ar: string;
};

export function phrase(value: Translation, locale: MajanLocale): string {
  return locale === "ar" ? value.ar : value.en;
}

export function displayNumber(
  value: number | null | undefined,
  locale: MajanLocale,
  digits = 0
): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return locale === "ar" ? "غير قابل للحساب" : "Not calculable";
  return new Intl.NumberFormat(locale === "ar" ? "ar-AE" : "en-AE", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(value);
}

export function displayMoney(
  value: number | null | undefined,
  locale: MajanLocale
): string {
  return displayNumber(value, locale, 0);
}

export function displayPct(
  value: number | null | undefined,
  locale: MajanLocale
): string {
  const formatted = displayNumber(value, locale, 1);
  return formatted === "Not calculable" || formatted === "غير قابل للحساب"
    ? formatted
    : `${formatted}%`;
}

export function displayRatio(
  value: number | null | undefined,
  locale: MajanLocale
): string {
  const formatted = displayNumber(value, locale, 2);
  return formatted === "Not calculable" || formatted === "غير قابل للحساب"
    ? formatted
    : `${formatted}x`;
}

export function MajanSection({
  title,
  subtitle,
  children,
  actions,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[#d5e3df] bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e3ece9] bg-[#f7fbf9] px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-[16px] font-bold text-[#163c36]">{title}</h2>
          {subtitle && (
            <p className="mt-0.5 max-w-4xl text-[13px] leading-5 text-slate-600">
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
        )}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function MajanMetric({
  label,
  value,
  note,
  tone = "teal",
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "teal" | "amber" | "slate" | "rose";
}) {
  const tones = {
    teal: "border-teal-100 bg-teal-50/50 text-teal-900",
    amber: "border-amber-100 bg-amber-50/60 text-amber-900",
    slate: "border-slate-200 bg-slate-50 text-slate-900",
    rose: "border-rose-100 bg-rose-50/60 text-rose-900",
  };
  return (
    <div className={`min-w-0 rounded-lg border p-3 ${tones[tone]}`}>
      <p className="text-[11px] font-semibold leading-4 text-slate-600">
        {label}
      </p>
      <p className="mt-1 truncate text-[18px] font-bold tracking-tight">
        {value}
      </p>
      {note && (
        <p className="mt-1 text-[11px] leading-4 text-slate-600">{note}</p>
      )}
    </div>
  );
}

export function MajanIssueList({
  issues,
  locale,
  limit,
}: {
  issues: ModelIssue[];
  locale: MajanLocale;
  limit?: number;
}) {
  const visible = limit ? issues.slice(0, limit) : issues;
  if (!visible.length)
    return (
      <div className="rounded-lg bg-teal-50 px-3 py-2 text-[13px] text-teal-800">
        {locale === "ar"
          ? "لا توجد ملاحظات في هذه المعاينة."
          : "No issues in this preview."}
      </div>
    );
  return (
    <ul className="space-y-2">
      {visible.map((issue, index) => (
        <li
          key={`${issue.code}-${issue.field}-${index}`}
          className={`rounded-lg border px-3 py-2 text-[13px] leading-5 ${issue.severity === "error" ? "border-rose-200 bg-rose-50 text-rose-900" : issue.severity === "warning" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-sky-200 bg-sky-50 text-sky-900"}`}
        >
          <span className="me-1.5 inline-flex rounded bg-white/70 px-1.5 py-0.5 text-[10px] font-bold uppercase">
            {issue.code}
          </span>
          {locale === "ar" ? issue.messageAr : issue.messageEn}
        </li>
      ))}
    </ul>
  );
}

export function MajanEditableNumber({
  value,
  onChange,
  min,
  max,
  step = "any",
  disabled = false,
  ariaLabel,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number | null;
  max?: number | null;
  step?: number | "any";
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <input
      aria-label={ariaLabel}
      type="number"
      min={min ?? undefined}
      max={max ?? undefined}
      step={step}
      disabled={disabled}
      value={value ?? ""}
      onChange={event => {
        const raw = event.target.value;
        onChange(raw === "" ? null : Number(raw));
      }}
      className="h-9 w-full min-w-[92px] rounded-md border border-slate-300 bg-white px-2 text-[14px] text-slate-900 outline-none ring-offset-1 transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100 disabled:text-slate-500"
    />
  );
}

export function MajanTextInput({
  value,
  onChange,
  ariaLabel,
  disabled = false,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <input
      aria-label={ariaLabel}
      type="text"
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={event => onChange(event.target.value)}
      className="h-9 w-full min-w-[118px] rounded-md border border-slate-300 bg-white px-2 text-[14px] text-slate-900 outline-none ring-offset-1 transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100 disabled:text-slate-500"
    />
  );
}

export function MajanTable({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-auto rounded-lg border border-slate-200 ${className}`}
    >
      <table className="w-full min-w-[720px] border-collapse text-[13px]">
        {children}
      </table>
    </div>
  );
}

export function MajanTableHeader({ children }: { children: ReactNode }) {
  return (
    <thead className="sticky top-0 z-10 bg-[#e7f3f0] text-[#174a43] [&_th]:border-b [&_th]:border-[#cde1dc] [&_th]:px-2.5 [&_th]:py-2.5 [&_th]:text-start [&_th]:text-[11px] [&_th]:font-bold">
      {children}
    </thead>
  );
}

export function MajanTableBody({ children }: { children: ReactNode }) {
  return (
    <tbody className="bg-white [&_td]:border-b [&_td]:border-slate-100 [&_td]:px-2.5 [&_td]:py-2 [&_td]:align-top">
      {children}
    </tbody>
  );
}
