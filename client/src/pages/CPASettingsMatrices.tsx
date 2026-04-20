/**
 * CPA Settings — Editable Matrix Tables
 * جداول الإعدادات القابلة للتعديل
 *
 * 1. ScopeMatrixTable  — 47 scope items × 5 building categories (status per cell)
 * 2. ReferenceCostsTable — GREEN/RED items × 5 categories (AED cost per cell)
 * 3. SupervisionBaselineTable — 11 supervision roles × 5 categories (% allocation per cell)
 */

import React, { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ---- Status config ---------------------------------------------------------

const STATUS_OPTIONS = [
  "INCLUDED",
  "GREEN",
  "RED",
  "CONTRACTOR",
  "NOT_REQUIRED",
] as const;
type MatrixStatus = (typeof STATUS_OPTIONS)[number];

const STATUS_LABELS: Record<MatrixStatus, string> = {
  INCLUDED: "مشمول",
  GREEN: "أخضر",
  RED: "أحمر",
  CONTRACTOR: "مقاول",
  NOT_REQUIRED: "غير مطلوب",
};

const STATUS_COLORS: Record<MatrixStatus, string> = {
  INCLUDED:
    "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-900/40 dark:text-sky-300",
  GREEN:
    "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300",
  RED: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-300",
  CONTRACTOR:
    "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300",
  NOT_REQUIRED:
    "bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800/40 dark:text-gray-500",
};

// ---- Scope Matrix Table ----------------------------------------------------

export function ScopeMatrixTable() {
  const { toast } = useToast();
  const matrixQuery = trpc.cpa.settings.getFullScopeMatrix.useQuery();
  const recalcMutation = trpc.cpa.evaluation.recalculateAll.useMutation();
  const upsertMutation = trpc.cpa.settings.upsertMatrixEntry.useMutation({
    onSuccess: () => {
      matrixQuery.refetch();
      toast({ title: "تم الحفظ — جاري تحديث التحليلات..." });
      recalcMutation.mutate(undefined, {
        onSuccess: () => toast({ title: "✓ تم تحديث جميع التحليلات" }),
      });
    },
    onError: (e) =>
      toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const [editingCell, setEditingCell] = useState<string | null>(null);
  const valueChangedRef = React.useRef(false);

  const handleChange = useCallback(
    (
      scopeItemId: number,
      buildingCategoryId: number,
      status: MatrixStatus
    ) => {
      valueChangedRef.current = true;
      upsertMutation.mutate({ scopeItemId, buildingCategoryId, status });
    },
    [upsertMutation]
  );

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        // Small delay to ensure onValueChange fires first
        setTimeout(() => {
          setEditingCell(null);
          valueChangedRef.current = false;
        }, 50);
      }
    },
    []
  );

  if (matrixQuery.isLoading)
    return (
      <div className="text-center py-10 text-muted-foreground text-sm">
        جاري تحميل المصفوفة...
      </div>
    );

  const { items = [], categories = [], matrix = {} } = matrixQuery.data ?? {};

  // Group items by section
  const sections: Record<string, typeof items> = {};
  for (const item of items) {
    const sec = (item as any).section_label ?? "أخرى";
    if (!sections[sec]) sections[sec] = [];
    sections[sec].push(item);
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-muted/60 border-b">
            <th className="sticky right-0 bg-muted/60 z-10 text-right px-3 py-2.5 font-semibold min-w-[220px] border-l">
              بند النطاق
            </th>
            {categories.map((cat: any) => (
              <th
                key={cat.id}
                className="px-3 py-2.5 font-semibold text-center min-w-[110px] border-l last:border-l-0"
              >
                {cat.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.entries(sections).map(([sectionLabel, sectionItems]) => (
            <React.Fragment key={`section-${sectionLabel}`}>
              <tr
                key={`sec-${sectionLabel}`}
                className="bg-muted/30 border-b border-t"
              >
                <td
                  colSpan={categories.length + 1}
                  className="px-3 py-1.5 font-semibold text-muted-foreground text-xs"
                >
                  {sectionLabel}
                </td>
              </tr>
              {sectionItems.map((item: any) => (
                <tr
                  key={item.id}
                  className="border-b hover:bg-muted/20 transition-colors"
                >
                  <td className="sticky right-0 bg-background z-10 px-3 py-2 border-l">
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground font-mono w-5 text-center shrink-0">
                        {item.item_number}
                      </span>
                      <span className="font-medium leading-tight">
                        {item.label}
                      </span>
                    </div>
                  </td>
                  {categories.map((cat: any) => {
                    const cellKey = `${item.id}_${cat.id}`;
                    const status =
                      (matrix[cellKey] as MatrixStatus) ?? "NOT_REQUIRED";
                    const isEditing = editingCell === cellKey;

                    return (
                      <td
                        key={cat.id}
                        className="px-1.5 py-1.5 text-center border-l last:border-l-0"
                      >
                        {isEditing ? (
                          <Select
                            defaultValue={status}
                            onValueChange={(v) =>
                              handleChange(
                                item.id,
                                cat.id,
                                v as MatrixStatus
                              )
                            }
                            open
                            onOpenChange={handleOpenChange}
                          >
                            <SelectTrigger className="h-7 text-xs w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {STATUS_LABELS[s]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <button
                            className={`w-full rounded border px-1.5 py-0.5 text-xs font-medium transition-opacity hover:opacity-80 cursor-pointer ${STATUS_COLORS[status]}`}
                            onClick={() => setEditingCell(cellKey)}
                            title="اضغط للتعديل"
                          >
                            {STATUS_LABELS[status]}
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---- Reference Costs Table -------------------------------------------------

export function ReferenceCostsTable() {
  const { toast } = useToast();
  const costsQuery = trpc.cpa.settings.getFullReferenceCosts.useQuery();
  const recalcMutation = trpc.cpa.evaluation.recalculateAll.useMutation();
  const upsertCostMutation = trpc.cpa.settings.upsertReferenceCost.useMutation(
    {
      onSuccess: () => {
        costsQuery.refetch();
        toast({ title: "تم حفظ السعر — جاري تحديث التحليلات..." });
        recalcMutation.mutate(undefined, {
          onSuccess: () => toast({ title: "✓ تم تحديث جميع التحليلات" }),
        });
      },
      onError: (e) =>
        toast({ title: "خطأ", description: e.message, variant: "destructive" }),
    }
  );

  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const startEdit = (cellKey: string, currentValue: number | null) => {
    setEditingCell(cellKey);
    setEditValue(currentValue !== null ? String(currentValue) : "");
  };

  const commitEdit = (scopeItemId: number, buildingCategoryId: number) => {
    const val = editValue.trim();
    const costAed = val === "" ? null : Number(val);
    if (val !== "" && isNaN(costAed!)) {
      toast({ title: "قيمة غير صالحة", variant: "destructive" });
      return;
    }
    upsertCostMutation.mutate({ scopeItemId, buildingCategoryId, costAed });
    setEditingCell(null);
  };

  if (costsQuery.isLoading)
    return (
      <div className="text-center py-10 text-muted-foreground text-sm">
        جاري تحميل الأسعار...
      </div>
    );

  const { items = [], categories = [], costs = {} } = costsQuery.data ?? {};

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        اضغط على أي خلية لتعديل السعر المرجعي. اتركها فارغة = لا يُضاف للمقارنة.
      </p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-muted/60 border-b">
              <th className="sticky right-0 bg-muted/60 z-10 text-right px-3 py-2.5 font-semibold min-w-[220px] border-l">
                بند النطاق
              </th>
              {categories.map((cat: any) => (
                <th
                  key={cat.id}
                  className="px-3 py-2.5 font-semibold text-center min-w-[120px] border-l last:border-l-0"
                >
                  {cat.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item: any) => (
              <tr
                key={item.id}
                className="border-b hover:bg-muted/20 transition-colors"
              >
                <td className="sticky right-0 bg-background z-10 px-3 py-2 border-l">
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground font-mono w-5 text-center shrink-0">
                      {item.item_number}
                    </span>
                    <div>
                      <span className="font-medium">{item.label}</span>
                      <Badge
                        variant="outline"
                        className={`mr-1 text-[10px] ${
                          item.default_type === "GREEN"
                            ? "border-emerald-300 text-emerald-700"
                            : "border-red-300 text-red-700"
                        }`}
                      >
                        {item.default_type}
                      </Badge>
                    </div>
                  </div>
                </td>
                {categories.map((cat: any) => {
                  const cellKey = `${item.id}_${cat.id}`;
                  const cost = costs[cellKey] ?? null;
                  const isEditing = editingCell === cellKey;

                  return (
                    <td
                      key={cat.id}
                      className="px-1.5 py-1.5 text-center border-l last:border-l-0"
                    >
                      {isEditing ? (
                        <Input
                          autoFocus
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() =>
                            commitEdit(item.id, cat.id)
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter")
                              commitEdit(item.id, cat.id);
                            if (e.key === "Escape") setEditingCell(null);
                          }}
                          className="h-7 text-xs text-center w-full"
                          placeholder="0"
                        />
                      ) : (
                        <button
                          className={`w-full rounded px-1.5 py-1 text-xs transition-colors hover:bg-muted/50 cursor-pointer ${
                            cost !== null
                              ? "font-semibold text-foreground"
                              : "text-muted-foreground"
                          }`}
                          onClick={() => startEdit(cellKey, cost)}
                          title="اضغط للتعديل"
                        >
                          {cost !== null
                            ? `${cost.toLocaleString("ar-AE")}`
                            : "—"}
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- Supervision Baseline Table --------------------------------------------

export function SupervisionBaselineTable() {
  const { toast } = useToast();
  const baselineQuery =
    trpc.cpa.settings.getFullSupervisionBaseline.useQuery();
  const recalcMutation = trpc.cpa.evaluation.recalculateAll.useMutation();
  const upsertBaselineMutation =
    trpc.cpa.settings.upsertBaselineEntry.useMutation({
      onSuccess: () => {
        baselineQuery.refetch();
        toast({ title: "تم الحفظ — جاري تحديث التحليلات..." });
        recalcMutation.mutate(undefined, {
          onSuccess: () => toast({ title: "✓ تم تحديث جميع التحليلات" }),
        });
      },
      onError: (e) =>
        toast({ title: "خطأ", description: e.message, variant: "destructive" }),
    });

  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const startEdit = (cellKey: string, currentValue: number) => {
    setEditingCell(cellKey);
    setEditValue(String(currentValue));
  };

  const commitEdit = (supervisionRoleId: number, buildingCategoryId: number) => {
    const val = editValue.trim();
    const pct = val === "" ? 0 : Number(val);
    if (isNaN(pct) || pct < 0 || pct > 500) {
      toast({ title: "أدخل نسبة بين 0 و 500", variant: "destructive" });
      return;
    }
    upsertBaselineMutation.mutate({
      supervisionRoleId,
      buildingCategoryId,
      requiredAllocationPct: pct,
    });
    setEditingCell(null);
  };

  if (baselineQuery.isLoading)
    return (
      <div className="text-center py-10 text-muted-foreground text-sm">
        جاري تحميل بيانات الإشراف...
      </div>
    );

  const {
    roles = [],
    categories = [],
    baseline = {},
  } = baselineQuery.data ?? {};

  const siteRoles = roles.filter((r: any) => r.team_type === "SITE");
  const hoRoles = roles.filter((r: any) => r.team_type === "HEAD_OFFICE");

  const renderRoleGroup = (groupRoles: any[], groupLabel: string) => (
    <>
      <tr className="bg-muted/30 border-b border-t">
        <td
          colSpan={categories.length + 2}
          className="px-3 py-1.5 font-semibold text-muted-foreground text-xs"
        >
          {groupLabel}
        </td>
      </tr>
      {groupRoles.map((role: any) => (
        <tr
          key={role.id}
          className="border-b hover:bg-muted/20 transition-colors"
        >
          <td className="sticky right-0 bg-background z-10 px-3 py-2 border-l min-w-[180px]">
            <div>
              <span className="font-medium text-xs">{role.label}</span>
              <span className="text-[10px] text-muted-foreground block font-mono">
                {role.code}
              </span>
            </div>
          </td>
          <td className="px-3 py-2 text-center border-l text-xs font-semibold text-sky-700 min-w-[100px]">
            {role.monthly_rate_aed
              ? `${Number(role.monthly_rate_aed).toLocaleString("ar-AE")} AED`
              : "—"}
          </td>
          {categories.map((cat: any) => {
            const cellKey = `${role.id}_${cat.id}`;
            const pct = baseline[cellKey] ?? 0;
            const isEditing = editingCell === cellKey;

            return (
              <td
                key={cat.id}
                className="px-1.5 py-1.5 text-center border-l last:border-l-0"
              >
                {isEditing ? (
                  <Input
                    autoFocus
                    type="number"
                    min={0}
                    max={500}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => commitEdit(role.id, cat.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit(role.id, cat.id);
                      if (e.key === "Escape") setEditingCell(null);
                    }}
                    className="h-7 text-xs text-center w-full"
                    placeholder="0"
                  />
                ) : (
                  <button
                    className={`w-full rounded px-1.5 py-1 text-xs font-medium transition-colors hover:bg-muted/50 cursor-pointer ${
                      pct === 0
                        ? "text-muted-foreground"
                        : pct === 100
                        ? "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300 rounded border border-sky-200"
                        : "bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 rounded border border-amber-200"
                    }`}
                    onClick={() => startEdit(cellKey, pct)}
                    title="اضغط للتعديل"
                  >
                    {pct === 0 ? "—" : `${pct}%`}
                  </button>
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        اضغط على أي خلية لتعديل نسبة التخصيص المطلوبة (0 = غير مطلوب، 100 = دوام كامل).
      </p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-muted/60 border-b">
              <th className="sticky right-0 bg-muted/60 z-10 text-right px-3 py-2.5 font-semibold min-w-[180px] border-l">
                الدور
              </th>
              <th className="px-3 py-2.5 font-semibold text-center min-w-[100px] border-l">
                المعدل الشهري
              </th>
              {categories.map((cat: any) => (
                <th
                  key={cat.id}
                  className="px-3 py-2.5 font-semibold text-center min-w-[90px] border-l last:border-l-0"
                >
                  {cat.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {renderRoleGroup(siteRoles, "فريق الموقع (SITE)")}
            {renderRoleGroup(hoRoles, "المكتب الرئيسي (HEAD OFFICE)")}
          </tbody>
        </table>
      </div>
    </div>
  );
}
