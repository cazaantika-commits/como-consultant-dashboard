/**
 * TrueCostReportScreen — تقرير التكلفة الحقيقية (Dynamic Version)
 * Full detailed report matching PDF structure with dynamic calculations
 * All numbers update automatically when BUA, price per sqft, or duration changes
 */

import { useState, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowRight,
  Loader2,
  Pencil,
  Check,
  X,
  ShieldCheck,
  Lock,
  Unlock,
  FileBarChart2,
} from "lucide-react";

type FieldKey = 'quotedDesignFee' | 'designScopeGap' | 'trueDesignFee' | 'quotedSupervisionFee' | 'supervisionGap' | 'adjustedSupervisionFee' | 'totalTrueCost';

function formatNum(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—';
  return Math.round(n).toLocaleString();
}

function formatCurrency(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—';
  return `AED ${Math.round(n).toLocaleString()}`;
}

export default function TrueCostReportScreen({ projectId, onBack }: { projectId: number; onBack: () => void }) {
  const { toast } = useToast();
  const reportQuery = trpc.cpa.evaluation.getFullReport.useQuery({ cpaProjectId: projectId }, { enabled: !!projectId });
  const saveMutation = trpc.cpa.evaluation.saveOverride.useMutation({
    onSuccess: () => { reportQuery.refetch(); toast({ title: 'تم حفظ التعديل ✔️' }); },
    onError: (err) => toast({ title: 'خطأ', description: err.message, variant: 'destructive' }),
  });
  const approveMutation = trpc.cpa.evaluation.approveReport.useMutation({
    onSuccess: () => { reportQuery.refetch(); toast({ title: 'تم اعتماد التقرير ✔️' }); },
    onError: (err) => toast({ title: 'خطأ', description: err.message, variant: 'destructive' }),
  });
  const revokeMutation = trpc.cpa.evaluation.revokeApproval.useMutation({
    onSuccess: () => { reportQuery.refetch(); toast({ title: 'تم إلغاء الاعتماد' }); },
    onError: (err) => toast({ title: 'خطأ', description: err.message, variant: 'destructive' }),
  });

  const [editingCell, setEditingCell] = useState<{ pcId: number; field: FieldKey } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [approverName, setApproverName] = useState('');

  if (reportQuery.isLoading) return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <Loader2 className="w-12 h-12 animate-spin text-indigo-400" />
      <p className="text-slate-500 text-lg">جاري تحميل التقرير...</p>
    </div>
  );
  if (!reportQuery.data) return (
    <div className="text-center py-24 text-slate-400 text-xl">لا توجد بيانات لهذا المشروع</div>
  );

  const report = reportQuery.data!;
  const isApproved = report.approval?.isApproved;

  // Dynamic variables for editing
  const originalPricePerSqft = report.bua > 0 ? report.constructionCost / report.bua : 0;
  const [dynamicBUA, setDynamicBUA] = useState<number>(report.bua);
  const [dynamicPricePerSqft, setDynamicPricePerSqft] = useState<number>(originalPricePerSqft);
  const [dynamicDuration, setDynamicDuration] = useState<number>(report.durationMonths);

  // Calculated values based on dynamic inputs
  const calculatedConstructionCost = dynamicBUA * dynamicPricePerSqft;

  const getVal = (c: typeof report.consultants[0], field: FieldKey): number => {
    const ov = c.override?.[field];
    if (ov != null) return ov;

    // Apply dynamic calculations for design fees based on percentage
    if (field === 'quotedDesignFee' && c.designMethod === 'PERCENTAGE') {
      return (calculatedConstructionCost * (c.designPct || 0)) / 100;
    }
    if (field === 'trueDesignFee' && c.designMethod === 'PERCENTAGE') {
      const quoted = (calculatedConstructionCost * (c.designPct || 0)) / 100;
      const gap = ((c.calc as any)['designScopeGap'] ?? 0);
      return quoted + gap;
    }

    // Apply dynamic calculations for supervision fees
    if (field === 'quotedSupervisionFee' && c.supervisionMethod === 'PERCENTAGE') {
      return (calculatedConstructionCost * (c.supervisionPct || 0)) / 100;
    }
    if (field === 'quotedSupervisionFee' && c.supervisionMethod === 'MONTHLY_RATE') {
      return (c.supervisionMonthlyRate || 0) * dynamicDuration;
    }
    if (field === 'adjustedSupervisionFee' && c.supervisionMethod === 'PERCENTAGE') {
      const quoted = (calculatedConstructionCost * (c.supervisionPct || 0)) / 100;
      const gap = ((c.calc as any)['supervisionGap'] ?? 0);
      return quoted + gap;
    }
    if (field === 'adjustedSupervisionFee' && c.supervisionMethod === 'MONTHLY_RATE') {
      const quoted = (c.supervisionMonthlyRate || 0) * dynamicDuration;
      const gap = ((c.calc as any)['supervisionGap'] ?? 0);
      return quoted + gap;
    }

    return (c.calc as any)[field] ?? 0;
  };

  const getEffectiveTotal = (c: typeof report.consultants[0]): number => {
    const trueDesign = getVal(c, 'trueDesignFee');
    const adjSupervision = getVal(c, 'adjustedSupervisionFee');
    if (c.override?.totalTrueCost != null) return c.override.totalTrueCost;
    const total = trueDesign + adjSupervision;
    return total > 0 ? total : 0;
  };

  const sorted = [...report.consultants].sort((a, b) => {
    const aTotal = getEffectiveTotal(a);
    const bTotal = getEffectiveTotal(b);
    if (aTotal === 0 && bTotal === 0) return 0;
    if (aTotal === 0) return 1;
    if (bTotal === 0) return -1;
    return aTotal - bTotal;
  });

  const lowestTotal = sorted.find(c => getEffectiveTotal(c) > 0) ? getEffectiveTotal(sorted.find(c => getEffectiveTotal(c) > 0)!) : 1;

  const startEdit = useCallback((pcId: number, field: FieldKey, currentValue: number) => {
    setEditingCell({ pcId, field });
    setEditValue(currentValue ? String(Math.round(currentValue)) : '0');
  }, []);

  const saveEdit = useCallback(() => {
    if (!editingCell || !reportQuery.data) return;
    const val = parseFloat(editValue.replace(/,/g, ''));
    saveMutation.mutate({
      cpaProjectId: reportQuery.data.cpaProjectId,
      projectConsultantId: editingCell.pcId,
      field: editingCell.field,
      value: isNaN(val) ? null : val,
    });
    setEditingCell(null);
  }, [editingCell, editValue, reportQuery.data, saveMutation]);

  const cancelEdit = useCallback(() => {
    setEditingCell(null);
    setEditValue('');
  }, []);

  return (
    <div className="space-y-6 p-6 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
          <ArrowRight className="w-4 h-4" />
          رجوع
        </Button>
        <div className="text-center flex-1">
          <h1 className="text-3xl font-bold text-slate-900">تقرير التكلفة الحقيقية</h1>
          <p className="text-slate-600 mt-1">{report.projectName}</p>
        </div>
        <div className="flex gap-2">
          {isApproved ? (
            <Badge className="bg-emerald-100 text-emerald-800">معتمد</Badge>
          ) : (
            <Badge className="bg-amber-100 text-amber-800">قيد المراجعة</Badge>
          )}
        </div>
      </div>

      {/* Dynamic Input Section */}
      {!isApproved && (
        <div className="bg-white rounded-2xl p-6 border-2 border-indigo-200 shadow-lg">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <span className="text-indigo-600">⚙️</span>
            متغيرات ديناميكية — عدّل القيم وسيتحدث التقرير تلقائياً
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* BUA Input */}
            <div className="bg-slate-50 rounded-lg p-4 border border-indigo-200">
              <label className="text-sm font-semibold text-slate-700 mb-2 block">المساحة (قدم²)</label>
              <Input
                type="number"
                value={dynamicBUA}
                onChange={(e) => setDynamicBUA(parseFloat(e.target.value) || 0)}
                className="text-lg font-bold text-center border-2 border-indigo-300"
              />
            </div>
            {/* Price per Sqft Input */}
            <div className="bg-slate-50 rounded-lg p-4 border border-indigo-200">
              <label className="text-sm font-semibold text-slate-700 mb-2 block">سعر القدم (AED/sqft)</label>
              <Input
                type="number"
                step="0.01"
                value={dynamicPricePerSqft}
                onChange={(e) => setDynamicPricePerSqft(parseFloat(e.target.value) || 0)}
                className="text-lg font-bold text-center border-2 border-indigo-300"
              />
              <p className="text-xs text-slate-500 mt-1">الأصلي: {originalPricePerSqft.toFixed(2)} AED</p>
            </div>
            {/* Duration Input */}
            <div className="bg-slate-50 rounded-lg p-4 border border-indigo-200">
              <label className="text-sm font-semibold text-slate-700 mb-2 block">مدة الإشراف (شهر)</label>
              <Input
                type="number"
                value={dynamicDuration}
                onChange={(e) => setDynamicDuration(parseFloat(e.target.value) || 0)}
                className="text-lg font-bold text-center border-2 border-indigo-300"
              />
            </div>
            {/* Calculated Cost Display */}
            <div className="bg-emerald-50 rounded-lg p-4 border-2 border-emerald-300">
              <p className="text-sm text-slate-600 mb-1">التكلفة المحسوبة:</p>
              <p className="text-2xl font-bold text-emerald-600">{formatCurrency(calculatedConstructionCost)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Project Info Card */}
      <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-200">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-slate-600 mb-1">المساحة (قدم²)</p>
            <p className="text-2xl font-bold text-slate-900">{formatNum(dynamicBUA)}</p>
          </div>
          <div>
            <p className="text-sm text-slate-600 mb-1">تكلفة البناء</p>
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(calculatedConstructionCost)}</p>
          </div>
          <div>
            <p className="text-sm text-slate-600 mb-1">مدة الإشراف</p>
            <p className="text-2xl font-bold text-slate-900">{formatNum(dynamicDuration)} شهر</p>
          </div>
          <div>
            <p className="text-sm text-slate-600 mb-1">الفئة</p>
            <p className="text-2xl font-bold text-slate-900">{report.category}</p>
          </div>
        </div>
      </div>

      {/* Design Fee Analysis Section */}
      <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-200">
        <h2 className="text-xl font-bold text-white bg-slate-900 -m-6 mb-6 p-4 rounded-t-2xl">تحليل أتعاب التصميم</h2>

        {sorted.map((consultant, idx) => (
          <div key={consultant.pcId} className="mb-8 pb-8 border-b border-slate-200 last:border-b-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">{consultant.consultantName}</h3>
              <Badge className="bg-blue-100 text-blue-800">#{idx + 1}</Badge>
            </div>

            {/* Design Pricing Method */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="text-sm text-slate-600">طريقة التسعير</p>
                <p className="font-semibold text-slate-900">
                  {consultant.designMethod === 'PERCENTAGE' ? `${consultant.designPct}% من التكلفة` : 'مبلغ مقطوع'}
                </p>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="text-sm text-slate-600">أتعاب التصميم المقتبسة</p>
                <p className="font-semibold text-slate-900">{formatCurrency(getVal(consultant, 'quotedDesignFee'))}</p>
              </div>
            </div>

            {/* Scope Gaps Table */}
            {consultant.calc?.designScopeGap > 0 && (
              <div className="mb-4">
                <p className="text-sm font-semibold text-slate-700 mb-2">فجوات النطاق:</p>
                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-sm text-slate-600">إجمالي فجوات التصميم: {formatCurrency(consultant.calc.designScopeGap)}</p>
                </div>
              </div>
            )}

            {/* True Design Fee */}
            <div className="bg-indigo-50 p-4 rounded-lg border-2 border-indigo-300 mb-4">
              <p className="text-sm text-slate-600 mb-1">أتعاب التصميم الحقيقية</p>
              <p className="text-2xl font-bold text-indigo-600">{formatCurrency(getVal(consultant, 'trueDesignFee'))}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Supervision Fee Analysis Section */}
      <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-200">
        <h2 className="text-xl font-bold text-white bg-slate-900 -m-6 mb-6 p-4 rounded-t-2xl">تحليل أتعاب الإشراف</h2>

        {sorted.map((consultant, idx) => (
          <div key={consultant.pcId} className="mb-8 pb-8 border-b border-slate-200 last:border-b-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">{consultant.consultantName}</h3>
              <Badge className="bg-cyan-100 text-cyan-800">#{idx + 1}</Badge>
            </div>

            {/* Supervision Pricing Method */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="text-sm text-slate-600">طريقة الإشراف</p>
                <p className="font-semibold text-slate-900">
                  {consultant.supervisionMethod === 'PERCENTAGE' 
                    ? `${consultant.supervisionPct}% من التكلفة` 
                    : `${formatCurrency(consultant.supervisionMonthlyRate)} / شهر`}
                </p>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="text-sm text-slate-600">أتعاب الإشراف المقتبسة</p>
                <p className="font-semibold text-slate-900">{formatCurrency(getVal(consultant, 'quotedSupervisionFee'))}</p>
              </div>
            </div>

            {/* Adjusted Supervision Fee */}
            <div className="bg-cyan-50 p-4 rounded-lg border-2 border-cyan-300">
              <p className="text-sm text-slate-600 mb-1">أتعاب الإشراف المعدلة</p>
              <p className="text-2xl font-bold text-cyan-600">{formatCurrency(getVal(consultant, 'adjustedSupervisionFee'))}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Summary Table */}
      <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-200 overflow-x-auto">
        <h2 className="text-xl font-bold text-white bg-slate-900 -m-6 mb-6 p-4 rounded-t-2xl">الملخص والترتيب</h2>

        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100 border-b-2 border-slate-300">
              <th className="p-3 text-right font-bold text-slate-900">الترتيب</th>
              <th className="p-3 text-right font-bold text-slate-900">الاستشاري</th>
              <th className="p-3 text-right font-bold text-slate-900">أتعاب التصميم</th>
              <th className="p-3 text-right font-bold text-slate-900">أتعاب الإشراف</th>
              <th className="p-3 text-right font-bold text-slate-900">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((consultant, idx) => {
              const total = getEffectiveTotal(consultant);
              const percentage = lowestTotal > 0 ? ((total - lowestTotal) / lowestTotal * 100).toFixed(1) : '0';
              return (
                <tr key={consultant.pcId} className="border-b border-slate-200 hover:bg-slate-50">
                  <td className="p-3 font-bold text-center text-slate-900">#{idx + 1}</td>
                  <td className="p-3 font-semibold text-slate-900">{consultant.consultantName}</td>
                  <td className="p-3 text-slate-900">{formatCurrency(getVal(consultant, 'trueDesignFee'))}</td>
                  <td className="p-3 text-slate-900">{formatCurrency(getVal(consultant, 'adjustedSupervisionFee'))}</td>
                  <td className="p-3 font-bold text-slate-900">
                    {formatCurrency(total)}
                    {idx > 0 && <span className="text-xs text-slate-500 block">+{percentage}%</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Approval Section */}
      {!isApproved && (
        <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-200">
          <h3 className="text-lg font-bold text-slate-900 mb-4">اعتماد التقرير</h3>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="اسم المعتمِد"
              value={approverName}
              onChange={(e) => setApproverName(e.target.value)}
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg"
            />
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => {
                if (!approverName.trim()) {
                  toast({ title: 'الرجاء إدخال اسم المعتمِد' });
                  return;
                }
                approveMutation.mutate({
                  cpaProjectId: report.cpaProjectId,
                  approverName,
                });
              }}
              disabled={approveMutation.isPending}
            >
              <ShieldCheck className="w-4 h-4 ml-2" />
              اعتماد التقرير
            </Button>
          </div>
        </div>
      )}

      {isApproved && (
        <div className="bg-emerald-50 rounded-2xl p-6 border-2 border-emerald-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-emerald-700 mb-1">معتمد من:</p>
              <p className="text-lg font-bold text-emerald-900">{report.approval?.approverName}</p>
              <p className="text-xs text-emerald-600 mt-1">
                {new Date(report.approval?.approvedAt || '').toLocaleString('ar-AE')}
              </p>
            </div>
            <Button
              variant="outline"
              className="border-emerald-300 text-emerald-700 hover:bg-emerald-100"
              onClick={() => {
                revokeMutation.mutate({ cpaProjectId: report.cpaProjectId });
              }}
              disabled={revokeMutation.isPending}
            >
              <Unlock className="w-4 h-4 ml-2" />
              إلغاء الاعتماد
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
