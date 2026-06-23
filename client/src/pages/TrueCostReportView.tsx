import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
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
  Save,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type FieldKey = 'quotedDesignFee' | 'designScopeGap' | 'trueDesignFee' | 'quotedSupervisionFee' | 'supervisionGap' | 'adjustedSupervisionFee' | 'totalTrueCost';

const FIELD_LABELS: Record<FieldKey, string> = {
  quotedDesignFee: 'أتعاب التصميم المقتبسة',
  designScopeGap: 'فجوة نطاق التصميم',
  trueDesignFee: 'أتعاب التصميم الحقيقية',
  quotedSupervisionFee: 'أتعاب الإشراف المقتبسة',
  supervisionGap: 'فجوة نطاق الإشراف',
  adjustedSupervisionFee: 'أتعاب الإشراف المعدّلة',
  totalTrueCost: 'التكلفة الحقيقية الإجمالية',
};

function formatNum(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—';
  return Math.round(n).toLocaleString();
}

export default function TrueCostReportView({ token, projectId, onBack }: { token: string; projectId: number; onBack: () => void }) {
  const reportQuery = trpc.commandCenter.getTrueCostReportData.useQuery({ token, projectId });
  const saveMutation = trpc.commandCenter.saveTrueCostOverride.useMutation({
    onSuccess: () => { reportQuery.refetch(); toast.success('تم حفظ التعديل ✔️'); },
    onError: (err) => toast.error(err.message),
  });
  const approveMutation = trpc.commandCenter.approveTrueCostReport.useMutation({
    onSuccess: () => { reportQuery.refetch(); toast.success('تم اعتماد التقرير ✔️'); },
    onError: (err) => toast.error(err.message),
  });
  const revokeMutation = trpc.commandCenter.revokeTrueCostApproval.useMutation({
    onSuccess: () => { reportQuery.refetch(); toast.success('تم إلغاء الاعتماد'); },
    onError: (err) => toast.error(err.message),
  });

  const [editingCell, setEditingCell] = useState<{ pcId: number; field: FieldKey } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [approverName, setApproverName] = useState('');

  const startEdit = useCallback((pcId: number, field: FieldKey, currentValue: number) => {
    setEditingCell({ pcId, field });
    setEditValue(currentValue ? String(Math.round(currentValue)) : '0');
  }, []);

  const saveEdit = useCallback(() => {
    if (!editingCell || !reportQuery.data) return;
    const val = parseFloat(editValue.replace(/,/g, ''));
    saveMutation.mutate({
      token,
      cpaProjectId: reportQuery.data.cpaProjectId,
      projectConsultantId: editingCell.pcId,
      field: editingCell.field,
      value: isNaN(val) ? null : val,
    });
    setEditingCell(null);
  }, [editingCell, editValue, token, reportQuery.data, saveMutation]);

  const cancelEdit = useCallback(() => {
    setEditingCell(null);
    setEditValue('');
  }, []);

  if (reportQuery.isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;
  if (!reportQuery.data) return <div className="text-center py-12 text-slate-400">لا توجد بيانات لهذا المشروع</div>;

  const report = reportQuery.data;
  const isApproved = report.approval?.isApproved;

  // Helper: get effective value (override or calculated)
  const getVal = (c: typeof report.consultants[0], field: FieldKey): number => {
    const ov = c.override?.[field];
    if (ov != null) return ov;
    return c.calc[field];
  };

  // Check if a field has an override
  const hasOverride = (c: typeof report.consultants[0], field: FieldKey): boolean => {
    return c.override?.[field] != null;
  };

  // Recalculate totals based on effective values
  const getEffectiveTotal = (c: typeof report.consultants[0]): number => {
    const trueDesign = getVal(c, 'trueDesignFee');
    const adjSupervision = getVal(c, 'adjustedSupervisionFee');
    // If totalTrueCost has override, use it
    if (c.override?.totalTrueCost != null) return c.override.totalTrueCost;
    return trueDesign + adjSupervision;
  };

  // Sort by effective total cost
  const sorted = [...report.consultants].sort((a, b) => {
    const aTotal = getEffectiveTotal(a);
    const bTotal = getEffectiveTotal(b);
    if (aTotal === 0 && bTotal === 0) return 0;
    if (aTotal === 0) return 1;
    if (bTotal === 0) return -1;
    return aTotal - bTotal;
  });

  const lowestTotal = sorted.find(c => getEffectiveTotal(c) > 0) ? getEffectiveTotal(sorted.find(c => getEffectiveTotal(c) > 0)!) : 1;

  const renderCell = (c: typeof report.consultants[0], field: FieldKey) => {
    const isEditing = editingCell?.pcId === c.pcId && editingCell?.field === field;
    const val = getVal(c, field);
    const isOverridden = hasOverride(c, field);

    if (isEditing) {
      return (
        <div className="flex items-center gap-1">
          <Input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="h-7 text-xs w-24 text-center"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveEdit();
              if (e.key === 'Escape') cancelEdit();
            }}
          />
          <button onClick={saveEdit} className="text-emerald-600 hover:text-emerald-800 p-0.5"><Check className="w-3.5 h-3.5" /></button>
          <button onClick={cancelEdit} className="text-red-500 hover:text-red-700 p-0.5"><X className="w-3.5 h-3.5" /></button>
        </div>
      );
    }

    return (
      <div className="group/cell relative flex items-center justify-center gap-1">
        <span className={`text-xs font-semibold ${isOverridden ? 'text-purple-700' : 'text-slate-800'}`}>
          {formatNum(val)}
        </span>
        {isOverridden && (
          <span className="text-[9px] text-purple-500 block" title={`القيمة الأصلية: ${formatNum(c.calc[field])}`}>✎</span>
        )}
        {!isApproved && (
          <button
            onClick={() => startEdit(c.pcId, field, val)}
            className="opacity-0 group-hover/cell:opacity-100 transition-opacity text-slate-400 hover:text-blue-600 p-0.5"
            title="تعديل"
          >
            <Pencil className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div dir="rtl" className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-500 hover:text-slate-700">
            <ArrowRight className="w-4 h-4 ml-1" /> العودة
          </Button>
          <FileBarChart2 className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-bold text-slate-900">تقرير التكلفة الحقيقية</h2>
          <span className="text-sm text-slate-500">— {report.projectName}</span>
        </div>
        <div className="flex items-center gap-2">
          {isApproved ? (
            <>
              <Badge className="bg-emerald-100 text-emerald-700 border-0 gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                معتمد بواسطة {report.approval?.approvedBy}
              </Badge>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-amber-600 border-amber-300 hover:bg-amber-50">
                    <Unlock className="w-3.5 h-3.5 ml-1" /> إلغاء الاعتماد
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent dir="rtl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>إلغاء اعتماد التقرير؟</AlertDialogTitle>
                    <AlertDialogDescription>سيتم فتح التقرير للتعديل مرة أخرى. هل أنت متأكد؟</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="flex-row-reverse gap-2">
                    <AlertDialogAction onClick={() => revokeMutation.mutate({ token, cpaProjectId: report.cpaProjectId })} className="bg-amber-600 hover:bg-amber-700">
                      نعم، إلغاء الاعتماد
                    </AlertDialogAction>
                    <AlertDialogCancel>تراجع</AlertDialogCancel>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> اعتماد التقرير
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent dir="rtl">
                <AlertDialogHeader>
                  <AlertDialogTitle>اعتماد تقرير التكلفة الحقيقية</AlertDialogTitle>
                  <AlertDialogDescription>
                    بعد الاعتماد سيُقفل التقرير ولن يمكن تعديله. سيصبح هذا التقرير المصدر الرسمي للبيانات المالية.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="px-1">
                  <label className="text-sm font-medium text-slate-700 mb-1 block">اسم المعتمد</label>
                  <Input
                    value={approverName}
                    onChange={(e) => setApproverName(e.target.value)}
                    placeholder="أدخل اسمك..."
                    className="text-right"
                  />
                </div>
                <AlertDialogFooter className="flex-row-reverse gap-2">
                  <AlertDialogAction
                    disabled={!approverName.trim()}
                    onClick={() => approveMutation.mutate({ token, cpaProjectId: report.cpaProjectId, approvedBy: approverName.trim() })}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    اعتماد
                  </AlertDialogAction>
                  <AlertDialogCancel>تراجع</AlertDialogCancel>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Project Info Bar */}
      <div className="flex flex-wrap gap-6 px-2 text-sm bg-gradient-to-r from-slate-50 to-white rounded-xl border border-slate-200 p-4">
        <div><span className="text-slate-500">فئة المبنى:</span> <span className="font-semibold text-slate-800">{report.category}</span></div>
        <div><span className="text-slate-500">المساحة:</span> <span className="font-semibold text-slate-800">{report.bua.toLocaleString()} قدم²</span></div>
        <div><span className="text-slate-500">تكلفة البناء:</span> <span className="font-semibold text-slate-800">{report.constructionCost.toLocaleString()} درهم</span></div>
        <div><span className="text-slate-500">مدة الإشراف:</span> <span className="font-semibold text-slate-800">{report.durationMonths} شهر</span></div>
        {isApproved && (
          <div className="mr-auto flex items-center gap-1 text-emerald-700">
            <Lock className="w-3.5 h-3.5" />
            <span className="font-medium text-xs">التقرير مقفل — معتمد</span>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-slate-500 px-2">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-purple-200 inline-block" /> قيمة معدّلة يدوياً</span>
        <span className="flex items-center gap-1"><Pencil className="w-2.5 h-2.5" /> مرّر على الخلية للتعديل</span>
        {!isApproved && <span className="text-amber-600 font-medium">● التقرير مفتوح للتعديل</span>}
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gradient-to-r from-slate-700 to-slate-800 text-white">
              <th className="border border-slate-600 p-3 text-right font-bold" rowSpan={2}>الاستشاري</th>
              <th className="border border-slate-600 p-2 text-center font-bold" colSpan={3}>التصميم</th>
              <th className="border border-slate-600 p-2 text-center font-bold" colSpan={3}>الإشراف</th>
              <th className="border border-slate-600 p-2 text-center font-bold bg-amber-700" rowSpan={2}>التكلفة الحقيقية<br/><span className="text-[10px] font-normal">الإجمالية</span></th>
              <th className="border border-slate-600 p-2 text-center font-bold" rowSpan={2}>الترتيب</th>
            </tr>
            <tr className="bg-slate-600 text-white text-[11px]">
              <th className="border border-slate-500 p-2 text-center bg-blue-700/60">الأتعاب المقتبسة</th>
              <th className="border border-slate-500 p-2 text-center bg-orange-700/60">فجوة النطاق</th>
              <th className="border border-slate-500 p-2 text-center bg-blue-800/60">الأتعاب الحقيقية</th>
              <th className="border border-slate-500 p-2 text-center bg-teal-700/60">الأتعاب المقتبسة</th>
              <th className="border border-slate-500 p-2 text-center bg-orange-700/60">فجوة النطاق</th>
              <th className="border border-slate-500 p-2 text-center bg-teal-800/60">الأتعاب المعدّلة</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c, i) => {
              const effectiveTotal = getEffectiveTotal(c);
              const isLowest = effectiveTotal > 0 && effectiveTotal === lowestTotal;
              const rank = effectiveTotal > 0 ? i + 1 : '—';
              const score = effectiveTotal > 0 ? Math.round((lowestTotal / effectiveTotal) * 100 * 100) / 100 : 0;

              return (
                <tr key={c.pcId} className={`hover:bg-slate-50/80 transition-colors ${isLowest ? 'bg-emerald-50/40' : ''}`}>
                  {/* Consultant Name */}
                  <td className="border border-slate-200 p-3 font-semibold text-sm whitespace-nowrap bg-gradient-to-l from-slate-50 to-white">
                    <div className="flex items-center gap-2">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                        rank === 1 ? 'bg-emerald-600 text-white' : rank === 2 ? 'bg-slate-600 text-white' : rank === 3 ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-600'
                      }`}>{rank}</span>
                      <div>
                        <span>{c.name}</span>
                        <div className="text-[10px] text-slate-400 font-normal">
                          {c.designMethod === 'PERCENTAGE' ? `تصميم: ${c.designPct}%` : 'تصميم: مبلغ مقطوع'}
                          {' • '}
                          {c.supervisionMethod === 'PERCENTAGE' ? `إشراف: ${c.supervisionPct}%` : c.supervisionMethod === 'MONTHLY_RATE' ? 'إشراف: سعر شهري' : c.supervisionSubmitted ? 'إشراف: مبلغ مقطوع' : 'إشراف: غير مقدم'}
                        </div>
                      </div>
                    </div>
                    {isLowest && <p className="text-[10px] text-emerald-600 font-medium mt-0.5 mr-8">الأفضل سعراً ✓</p>}
                  </td>

                  {/* Design Quoted */}
                  <td className="border border-slate-200 p-2 bg-blue-50/50 text-center">
                    {renderCell(c, 'quotedDesignFee')}
                  </td>
                  {/* Design Gap */}
                  <td className="border border-slate-200 p-2 bg-orange-50/50 text-center">
                    {renderCell(c, 'designScopeGap')}
                  </td>
                  {/* True Design Fee */}
                  <td className="border border-slate-200 p-2 bg-blue-100/50 text-center font-bold">
                    {renderCell(c, 'trueDesignFee')}
                  </td>
                  {/* Supervision Quoted */}
                  <td className="border border-slate-200 p-2 bg-teal-50/50 text-center">
                    {renderCell(c, 'quotedSupervisionFee')}
                  </td>
                  {/* Supervision Gap */}
                  <td className="border border-slate-200 p-2 bg-orange-50/50 text-center">
                    {renderCell(c, 'supervisionGap')}
                  </td>
                  {/* Adjusted Supervision */}
                  <td className="border border-slate-200 p-2 bg-teal-100/50 text-center font-bold">
                    {renderCell(c, 'adjustedSupervisionFee')}
                  </td>
                  {/* Total True Cost */}
                  <td className="border border-slate-200 p-2 text-center font-bold bg-gradient-to-b from-amber-100 to-amber-50 border-x-2 border-amber-300">
                    {renderCell(c, 'totalTrueCost')}
                    {score > 0 && <p className="text-[9px] text-amber-600 mt-0.5">Score: {score}%</p>}
                  </td>
                  {/* Rank */}
                  <td className="border border-slate-200 p-2 text-center">
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                      rank === 1 ? 'bg-emerald-100 text-emerald-700' : rank === 2 ? 'bg-slate-100 text-slate-700' : rank === 3 ? 'bg-amber-100 text-amber-700' : 'bg-slate-50 text-slate-400'
                    }`}>{rank}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Supervision Baseline Reference */}
      {report.supervisionBaseline.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
            <FileBarChart2 className="w-4 h-4 text-indigo-500" />
            مرجع الـ Baseline — فريق الإشراف ({report.category})
          </h3>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-200 p-2 text-right">الوظيفة</th>
                  <th className="border border-slate-200 p-2 text-center">السعر الشهري (AED)</th>
                  <th className="border border-slate-200 p-2 text-center">نسبة التخصيص</th>
                  <th className="border border-slate-200 p-2 text-center">التكلفة الشهرية الفعلية</th>
                  <th className="border border-slate-200 p-2 text-center">التكلفة لـ {report.durationMonths} شهر</th>
                </tr>
              </thead>
              <tbody>
                {report.supervisionBaseline.map((b) => {
                  const effectiveMonthly = b.monthlyRate * (b.requiredPct / 100);
                  const totalCost = effectiveMonthly * report.durationMonths;
                  return (
                    <tr key={b.roleId} className="hover:bg-slate-50">
                      <td className="border border-slate-200 p-2 font-medium">{b.label}</td>
                      <td className="border border-slate-200 p-2 text-center">{b.monthlyRate.toLocaleString()}</td>
                      <td className="border border-slate-200 p-2 text-center">{b.requiredPct}%</td>
                      <td className="border border-slate-200 p-2 text-center">{Math.round(effectiveMonthly).toLocaleString()}</td>
                      <td className="border border-slate-200 p-2 text-center font-semibold">{Math.round(totalCost).toLocaleString()}</td>
                    </tr>
                  );
                })}
                <tr className="bg-slate-100 font-bold">
                  <td className="border border-slate-200 p-2" colSpan={4}>المجموع</td>
                  <td className="border border-slate-200 p-2 text-center">
                    {Math.round(report.supervisionBaseline.reduce((sum, b) => sum + (b.monthlyRate * (b.requiredPct / 100) * report.durationMonths), 0)).toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
