/**
 * TrueCostReportScreen — تقرير التكلفة الحقيقية
 * Full detailed table report — every cell visible and editable.
 * Designed as a single comparison table (not cards) for board presentation.
 */

import { useState, useCallback } from "react";
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

function formatNum(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—';
  return Math.round(n).toLocaleString();
}

export default function TrueCostReportScreen({ projectId, onBack }: { projectId: number; onBack: () => void }) {
  const { toast } = useToast();
  const reportQuery = trpc.cpa.evaluation.getFullReport.useQuery({ cpaProjectId: projectId });
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

  if (reportQuery.isLoading) return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <Loader2 className="w-12 h-12 animate-spin text-indigo-400" />
      <p className="text-slate-500 text-lg">جاري تحميل التقرير...</p>
    </div>
  );
  if (!reportQuery.data) return (
    <div className="text-center py-24 text-slate-400 text-xl">لا توجد بيانات لهذا المشروع</div>
  );

  const report = reportQuery.data;
  const isApproved = report.approval?.isApproved;

  const getVal = (c: typeof report.consultants[0], field: FieldKey): number => {
    const ov = c.override?.[field];
    if (ov != null) return ov;
    return (c.calc as any)[field] ?? 0;
  };

  const hasOverride = (c: typeof report.consultants[0], field: FieldKey): boolean => {
    return c.override?.[field] != null;
  };

  const getEffectiveTotal = (c: typeof report.consultants[0]): number => {
    const trueDesign = getVal(c, 'trueDesignFee');
    const adjSupervision = getVal(c, 'adjustedSupervisionFee');
    if (c.override?.totalTrueCost != null) return c.override.totalTrueCost;
    return trueDesign + adjSupervision;
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

  // Render an editable cell
  const renderCell = (c: typeof report.consultants[0], field: FieldKey) => {
    const isEditing = editingCell?.pcId === c.pcId && editingCell?.field === field;
    const val = getVal(c, field);
    const isOverridden = hasOverride(c, field);

    if (isEditing) {
      return (
        <div className="flex items-center gap-1 justify-center">
          <Input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="h-8 text-sm w-28 text-center font-semibold border-2 border-indigo-400"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveEdit();
              if (e.key === 'Escape') cancelEdit();
            }}
          />
          <button onClick={saveEdit} className="text-emerald-600 hover:text-emerald-800 p-0.5"><Check className="w-4 h-4" /></button>
          <button onClick={cancelEdit} className="text-red-500 hover:text-red-700 p-0.5"><X className="w-4 h-4" /></button>
        </div>
      );
    }

    return (
      <div
        className={`group/cell relative flex items-center justify-center gap-1 cursor-pointer rounded px-2 py-1.5 transition-all whitespace-nowrap ${
          !isApproved ? 'hover:bg-indigo-50 hover:ring-1 hover:ring-indigo-200' : ''
        }`}
        onClick={() => !isApproved && startEdit(c.pcId, field, val)}
        title={!isApproved ? 'انقر للتعديل' : ''}
      >
        <span className={`text-sm font-bold tabular-nums ${isOverridden ? 'text-purple-700' : 'text-slate-900'}`}>
          {formatNum(val)}
        </span>
        {isOverridden && (
          <span className="text-[10px] text-purple-500" title={`الأصلي: ${formatNum((c.calc as any)[field])}`}>✎</span>
        )}
        {!isApproved && (
          <Pencil className="w-3 h-3 text-slate-300 opacity-0 group-hover/cell:opacity-100 transition-opacity shrink-0" />
        )}
      </div>
    );
  };

  return (
    <div dir="rtl" className="space-y-8 pb-12">
      {/* ═══════════════════════ REPORT HEADER ═══════════════════════ */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 rounded-2xl p-8 text-white shadow-xl">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <Button variant="ghost" size="sm" onClick={onBack} className="text-white/70 hover:text-white hover:bg-white/10">
                <ArrowRight className="w-4 h-4 ml-1" /> العودة
              </Button>
            </div>
            <h1 className="text-3xl font-bold mb-2">تقرير التكلفة الحقيقية</h1>
            <p className="text-xl text-white/80">{report.projectName}</p>
          </div>
          <div className="flex items-center gap-3">
            {isApproved ? (
              <>
                <Badge className="bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 gap-2 text-sm px-4 py-2">
                  <ShieldCheck className="w-5 h-5" />
                  معتمد بواسطة {report.approval?.approvedBy}
                </Badge>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="text-amber-200 border-amber-400/50 hover:bg-amber-500/20 bg-transparent">
                      <Unlock className="w-4 h-4 ml-2" /> إلغاء الاعتماد
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                      <AlertDialogTitle>إلغاء اعتماد التقرير؟</AlertDialogTitle>
                      <AlertDialogDescription>سيتم فتح التقرير للتعديل مرة أخرى. هل أنت متأكد؟</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-row-reverse gap-2">
                      <AlertDialogAction onClick={() => revokeMutation.mutate({ cpaProjectId: report.cpaProjectId })} className="bg-amber-600 hover:bg-amber-700">
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
                  <Button className="bg-emerald-500 hover:bg-emerald-600 text-white gap-2 text-base px-6 py-3 h-auto shadow-lg">
                    <ShieldCheck className="w-5 h-5" /> اعتماد التقرير
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
                      className="text-right text-base h-11"
                    />
                  </div>
                  <AlertDialogFooter className="flex-row-reverse gap-2">
                    <AlertDialogAction
                      disabled={!approverName.trim()}
                      onClick={() => approveMutation.mutate({ cpaProjectId: report.cpaProjectId, approvedBy: approverName.trim() })}
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

        {/* Project Info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
          <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
            <p className="text-white/60 text-sm mb-1">فئة المبنى</p>
            <p className="text-xl font-bold">{report.category}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
            <p className="text-white/60 text-sm mb-1">المساحة (قدم²)</p>
            <p className="text-xl font-bold">{report.bua.toLocaleString()}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
            <p className="text-white/60 text-sm mb-1">تكلفة البناء (درهم)</p>
            <p className="text-xl font-bold">{report.constructionCost.toLocaleString()}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
            <p className="text-white/60 text-sm mb-1">مدة الإشراف</p>
            <p className="text-xl font-bold">{report.durationMonths} شهر</p>
          </div>
        </div>
      </div>

      {/* ═══════════════════════ STATUS BAR ═══════════════════════ */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-6 text-sm text-slate-500">
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-purple-300 inline-block border border-purple-400" />
            قيمة معدّلة يدوياً
          </span>
          <span className="flex items-center gap-2">
            <Pencil className="w-3.5 h-3.5" />
            انقر على أي رقم للتعديل
          </span>
        </div>
        {isApproved ? (
          <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 px-4 py-2 rounded-lg border border-emerald-200">
            <Lock className="w-4 h-4" />
            <span className="font-semibold text-sm">التقرير مقفل — معتمد</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-amber-700 bg-amber-50 px-4 py-2 rounded-lg border border-amber-200">
            <Unlock className="w-4 h-4" />
            <span className="font-semibold text-sm">التقرير مفتوح للتعديل</span>
          </div>
        )}
      </div>

      {/* ═══════════════════════ MAIN COMPARISON TABLE ═══════════════════════ */}
      <div className="rounded-2xl border border-slate-200 shadow-lg overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ minWidth: '1100px' }}>
            <thead>
              {/* Group Headers */}
              <tr className="bg-slate-800 text-white">
                <th className="px-4 py-3 text-right text-sm font-bold border-l border-slate-600" rowSpan={2}>
                  الاستشاري
                </th>
                <th className="px-2 py-2 text-center text-sm font-bold border-l border-slate-600" colSpan={3}>
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                    التصميم
                  </div>
                </th>
                <th className="px-2 py-2 text-center text-sm font-bold border-l border-slate-600" colSpan={3}>
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-teal-400" />
                    الإشراف
                  </div>
                </th>
                <th className="px-2 py-2 text-center text-sm font-bold border-l border-slate-600" rowSpan={2}>
                  التكلفة الحقيقية<br/>الإجمالية
                </th>
                <th className="px-2 py-2 text-center text-sm font-bold" rowSpan={2}>
                  الترتيب
                </th>
              </tr>
              {/* Sub Headers */}
              <tr className="bg-slate-600 text-white text-[11px]">
                <th className="px-2 py-2 text-center font-medium border-l border-slate-500 bg-blue-700/60">الأتعاب المقتبسة</th>
                <th className="px-2 py-2 text-center font-medium border-l border-slate-500 bg-orange-700/60">فجوة النطاق</th>
                <th className="px-2 py-2 text-center font-medium border-l border-slate-600 bg-blue-800/60">الأتعاب الحقيقية</th>
                <th className="px-2 py-2 text-center font-medium border-l border-slate-500 bg-teal-700/60">الأتعاب المقتبسة</th>
                <th className="px-2 py-2 text-center font-medium border-l border-slate-500 bg-orange-700/60">فجوة النطاق</th>
                <th className="px-2 py-2 text-center font-medium border-l border-slate-600 bg-teal-800/60">الأتعاب المعدّلة</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c, i) => {
                const effectiveTotal = getEffectiveTotal(c);
                const isLowest = effectiveTotal > 0 && effectiveTotal === lowestTotal;
                const rank = effectiveTotal > 0 ? i + 1 : 0;
                const score = effectiveTotal > 0 ? Math.round((lowestTotal / effectiveTotal) * 100 * 100) / 100 : 0;

                return (
                  <tr
                    key={c.pcId}
                    className={`border-b border-slate-100 transition-colors ${
                      isLowest
                        ? 'bg-emerald-50/60 hover:bg-emerald-50'
                        : i % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/40 hover:bg-slate-50'
                    }`}
                  >
                    {/* Consultant Name */}
                    <td className="px-4 py-4 border-l border-slate-100">
                      <div className="flex items-center gap-3">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          rank === 1 ? 'bg-emerald-600 text-white' :
                          rank === 2 ? 'bg-slate-500 text-white' :
                          rank === 3 ? 'bg-amber-500 text-white' :
                          'bg-slate-200 text-slate-600'
                        }`}>{rank || '—'}</span>
                        <div>
                          <p className="font-bold text-sm text-slate-900 whitespace-nowrap">{c.name}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {c.designMethod === 'PERCENTAGE' ? `تصميم: ${c.designPct}%` : 'تصميم: مبلغ مقطوع'}
                            {' • '}
                            {c.supervisionMethod === 'PERCENTAGE' ? `إشراف: ${c.supervisionPct}%` : c.supervisionMethod === 'MONTHLY_RATE' ? 'إشراف: سعر شهري' : c.supervisionSubmitted ? 'إشراف: مبلغ مقطوع' : 'إشراف: غير مقدم'}
                          </p>
                          {isLowest && <p className="text-[10px] text-emerald-600 font-medium mt-0.5">الأفضل سعراً ✓</p>}
                        </div>
                      </div>
                    </td>

                    {/* Design: Quoted Fee */}
                    <td className="px-1 py-3 text-center border border-slate-200 bg-blue-50/50">
                      {renderCell(c, 'quotedDesignFee')}
                    </td>
                    {/* Design: Scope Gap */}
                    <td className="px-1 py-3 text-center border border-slate-200 bg-orange-50/50">
                      {renderCell(c, 'designScopeGap')}
                    </td>
                    {/* Design: True Fee */}
                    <td className="px-1 py-3 text-center border border-slate-200 bg-blue-100/50 font-bold">
                      {renderCell(c, 'trueDesignFee')}
                    </td>

                    {/* Supervision: Quoted Fee */}
                    <td className="px-1 py-3 text-center border border-slate-200 bg-teal-50/50">
                      {renderCell(c, 'quotedSupervisionFee')}
                    </td>
                    {/* Supervision: Scope Gap */}
                    <td className="px-1 py-3 text-center border border-slate-200 bg-orange-50/50">
                      {renderCell(c, 'supervisionGap')}
                    </td>
                    {/* Supervision: Adjusted Fee */}
                    <td className="px-1 py-3 text-center border border-slate-200 bg-teal-100/50 font-bold">
                      {renderCell(c, 'adjustedSupervisionFee')}
                    </td>

                    {/* Total True Cost */}
                    <td className="px-2 py-3 text-center border border-slate-200 bg-gradient-to-b from-amber-100 to-amber-50 border-x-2 border-amber-300">
                      {renderCell(c, 'totalTrueCost')}
                      {score > 0 && <p className="text-[9px] text-amber-600 mt-0.5">Score: {score}%</p>}
                    </td>

                    {/* Rank */}
                    <td className="px-2 py-3 text-center">
                      {rank > 0 ? (
                        <Badge className={`text-sm px-3 py-1 ${
                          rank === 1 ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                          rank === 2 ? 'bg-slate-100 text-slate-700 border-slate-300' :
                          rank === 3 ? 'bg-amber-100 text-amber-800 border-amber-300' :
                          'bg-slate-50 text-slate-500 border-slate-200'
                        }`}>
                          #{rank}
                        </Badge>
                      ) : (
                        <span className="text-slate-300 text-sm">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══════════════════════ SCOPE GAP DETAILS ═══════════════════════ */}
      {sorted.some(c => c.scopeGaps && c.scopeGaps.length > 0) && (
        <div className="mt-8">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <FileBarChart2 className="w-5 h-5 text-blue-600" />
            تفاصيل فجوة النطاق لكل استشاري
          </h2>
          <div className="space-y-4">
            {sorted.filter(c => c.scopeGaps && c.scopeGaps.length > 0).map(c => (
              <div key={c.pcId} className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-5 py-3 border-b border-slate-200">
                  <h3 className="font-bold text-sm text-slate-800">{c.name}</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-100/50">
                        <th className="px-4 py-2 text-right font-medium text-slate-600 border-b border-slate-100">#</th>
                        <th className="px-4 py-2 text-right font-medium text-slate-600 border-b border-slate-100">البند</th>
                        <th className="px-4 py-2 text-center font-medium text-slate-600 border-b border-slate-100">الحالة</th>
                        <th className="px-4 py-2 text-center font-medium text-slate-600 border-b border-slate-100">التكلفة (AED)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.scopeGaps.map((gap: any, idx: number) => (
                        <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                          <td className="px-4 py-2 text-slate-500 border-b border-slate-50">{gap.itemNumber || idx + 1}</td>
                          <td className="px-4 py-2 text-slate-800 border-b border-slate-50">{gap.description || gap.label || '—'}</td>
                          <td className="px-4 py-2 text-center border-b border-slate-50">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              gap.status === 'missing' || gap.included === false
                                ? 'bg-red-100 text-red-700'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {gap.status === 'missing' || gap.included === false ? 'غير مشمول' : 'مشمول'}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-center font-semibold tabular-nums border-b border-slate-50">
                            {gap.cost ? formatNum(gap.cost) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════ BASELINE TABLE ═══════════════════════ */}
      {report.supervisionBaseline.length > 0 && (
        <div className="mt-10">
          <div className="flex items-center gap-3 mb-5">
            <FileBarChart2 className="w-6 h-6 text-indigo-600" />
            <h2 className="text-xl font-bold text-slate-800">مرجع الـ Baseline — فريق الإشراف ({report.category})</h2>
          </div>
          <div className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border-b border-slate-200 px-6 py-4 text-right text-sm font-bold text-slate-700">الوظيفة</th>
                  <th className="border-b border-slate-200 px-4 py-4 text-center text-sm font-bold text-slate-700">السعر الشهري (AED)</th>
                  <th className="border-b border-slate-200 px-4 py-4 text-center text-sm font-bold text-slate-700">نسبة التخصيص</th>
                  <th className="border-b border-slate-200 px-4 py-4 text-center text-sm font-bold text-slate-700">التكلفة الشهرية الفعلية</th>
                  <th className="border-b border-slate-200 px-4 py-4 text-center text-sm font-bold text-slate-700">التكلفة لـ {report.durationMonths} شهر</th>
                </tr>
              </thead>
              <tbody>
                {report.supervisionBaseline.map((b, idx) => {
                  const effectiveMonthly = b.monthlyRate * (b.requiredPct / 100);
                  const totalCost = effectiveMonthly * report.durationMonths;
                  return (
                    <tr key={b.roleId} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      <td className="border-b border-slate-100 px-6 py-3 font-medium text-sm text-slate-800">{b.label}</td>
                      <td className="border-b border-slate-100 px-4 py-3 text-center text-sm font-semibold tabular-nums">{b.monthlyRate.toLocaleString()}</td>
                      <td className="border-b border-slate-100 px-4 py-3 text-center text-sm">{b.requiredPct}%</td>
                      <td className="border-b border-slate-100 px-4 py-3 text-center text-sm tabular-nums">{Math.round(effectiveMonthly).toLocaleString()}</td>
                      <td className="border-b border-slate-100 px-4 py-3 text-center text-sm font-bold tabular-nums">{Math.round(totalCost).toLocaleString()}</td>
                    </tr>
                  );
                })}
                <tr className="bg-slate-800 text-white">
                  <td className="px-6 py-3 font-bold text-sm" colSpan={4}>المجموع</td>
                  <td className="px-4 py-3 text-center text-base font-black tabular-nums">
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
