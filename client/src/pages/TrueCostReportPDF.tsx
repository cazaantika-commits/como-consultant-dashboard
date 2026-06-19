'use client';
import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'wouter';
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ArrowRight,
  Loader2,
  Pencil,
  Check,
  X,
  ShieldCheck,
  Unlock,
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

function formatNum(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—';
  return Math.round(n).toLocaleString();
}

export default function TrueCostReportPDF({ projectId: propProjectId, onBack }: { projectId?: number; onBack?: () => void }) {
  const params = useParams<{ projectId: string }>();
  const projectId = propProjectId || (params?.projectId ? parseInt(params.projectId, 10) : 0);
  
  const reportQuery = trpc.cpa.evaluation.getFullReport.useQuery({ cpaProjectId: projectId }, { enabled: projectId > 0 });
  
  const [editingCell, setEditingCell] = useState<{ pcId: number; field: FieldKey } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [approverName, setApproverName] = useState('');
  const [dynamicBUA, setDynamicBUA] = useState<number>(0);
  const [dynamicPricePerSqft, setDynamicPricePerSqft] = useState<number>(0);
  const [dynamicDuration, setDynamicDuration] = useState<number>(0);

  const saveMutation = trpc.cpa.evaluation.saveOverride.useMutation({
    onSuccess: () => { reportQuery.refetch(); toast.success('تم حفظ التعديل ✔️'); },
    onError: (err) => toast.error(err.message),
  });
  const approveMutation = trpc.cpa.evaluation.approveReport.useMutation({
    onSuccess: () => { reportQuery.refetch(); toast.success('تم اعتماد التقرير ✔️'); },
    onError: (err) => toast.error(err.message),
  });
  const revokeMutation = trpc.cpa.evaluation.revokeApproval.useMutation({
    onSuccess: () => { reportQuery.refetch(); toast.success('تم إلغاء الاعتماد'); },
    onError: (err) => toast.error(err.message),
  });

  const startEdit = useCallback((pcId: number, field: FieldKey, currentValue: number) => {
    setEditingCell({ pcId, field });
    setEditValue(currentValue ? String(Math.round(currentValue)) : '0');
  }, []);

  const saveEdit = useCallback(() => {
    if (!editingCell || !reportQuery.data) return;
    const val = parseFloat(editValue.replace(/,/g, ''));
    saveMutation.mutate({
      cpaProjectId: projectId,
      projectConsultantId: editingCell.pcId,
      field: editingCell.field,
      value: isNaN(val) ? null : val,
    });
    setEditingCell(null);
  }, [editingCell, editValue, projectId, reportQuery.data, saveMutation]);

  const cancelEdit = useCallback(() => {
    setEditingCell(null);
    setEditValue('');
  }, []);

  useEffect(() => {
    if (reportQuery.data) {
      if (dynamicBUA === 0 && reportQuery.data.bua > 0) setDynamicBUA(reportQuery.data.bua);
      if (dynamicDuration === 0 && reportQuery.data.durationMonths > 0) setDynamicDuration(reportQuery.data.durationMonths);
    }
  }, [reportQuery.data?.bua, reportQuery.data?.durationMonths]);

  useEffect(() => {
    if (reportQuery.data && reportQuery.data.bua > 0) {
      const originalPricePerSqft = reportQuery.data.constructionCost / reportQuery.data.bua;
      if (dynamicPricePerSqft === 0 && originalPricePerSqft > 0) setDynamicPricePerSqft(originalPricePerSqft);
    }
  }, [reportQuery.data?.constructionCost, reportQuery.data?.bua]);

  if (projectId <= 0) return <div className="text-center py-12 text-red-600">خطأ: معرّف المشروع غير صحيح</div>;
  if (reportQuery.isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;
  if (reportQuery.isError) return <div className="text-center py-12 text-red-600">خطأ في تحميل البيانات</div>;
  if (!reportQuery.data) return <div className="text-center py-12 text-slate-400">لا توجد بيانات لهذا المشروع</div>;

  const report = reportQuery.data;
  const isApproved = report.approval?.isApproved;
  const calculatedConstructionCost = dynamicBUA && dynamicPricePerSqft ? dynamicBUA * dynamicPricePerSqft : report.constructionCost;

  const calculateDynamicValue = (c: typeof report.consultants[0], field: FieldKey): number => {
    const ov = c.override?.[field];
    if (ov != null) return ov;

    if (field === 'quotedDesignFee' && c.designMethod === 'PERCENTAGE') {
      return (c.designPct / 100) * calculatedConstructionCost;
    }
    if (field === 'quotedSupervisionFee' && c.supervisionMethod === 'PERCENTAGE') {
      return (c.supervisionPct / 100) * calculatedConstructionCost;
    }

    return c.calc[field];
  };

  const getVal = (c: typeof report.consultants[0], field: FieldKey): number => {
    return calculateDynamicValue(c, field);
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

  const renderEditableCell = (c: typeof report.consultants[0], field: FieldKey) => {
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
            className="h-7 text-xs w-20 text-center"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveEdit();
              if (e.key === 'Escape') cancelEdit();
            }}
          />
          <button onClick={saveEdit} className="text-emerald-600 hover:text-emerald-800 p-0.5"><Check className="w-3 h-3" /></button>
          <button onClick={cancelEdit} className="text-red-500 hover:text-red-700 p-0.5"><X className="w-3 h-3" /></button>
        </div>
      );
    }

    return (
      <div className="group/cell relative flex items-center justify-center gap-1 cursor-pointer">
        <span className={`text-sm font-medium ${isOverridden ? 'text-purple-700' : 'text-slate-900'}`}>
          AED {formatNum(val)}
        </span>
        {isOverridden && <span className="text-[9px] text-purple-500">✎</span>}
        {!isApproved && (
          <button
            onClick={() => startEdit(c.pcId, field, val)}
            className="opacity-0 group-hover/cell:opacity-100 transition-opacity text-slate-400 hover:text-blue-600 p-0.5"
          >
            <Pencil className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div dir="rtl" className="min-h-screen bg-white">
      {/* Header Navigation */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-slate-200">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onBack ? onBack : () => window.history.back()} 
          className="text-slate-600 hover:text-slate-900"
        >
          <ArrowRight className="w-4 h-4 ml-1" /> العودة
        </Button>
        <div className="flex items-center gap-2">
          {isApproved ? (
            <>
              <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1 rounded">
                معتمد بواسطة {report.approval?.approvedBy}
              </span>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-amber-600">
                    <Unlock className="w-3.5 h-3.5 ml-1" /> إلغاء الاعتماد
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent dir="rtl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>إلغاء اعتماد التقرير؟</AlertDialogTitle>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="flex-row-reverse gap-2">
                    <AlertDialogAction onClick={() => revokeMutation.mutate({ cpaProjectId: projectId })} className="bg-amber-600">
                      إلغاء الاعتماد
                    </AlertDialogAction>
                    <AlertDialogCancel>تراجع</AlertDialogCancel>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <ShieldCheck className="w-3.5 h-3.5 ml-1" /> اعتماد التقرير
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent dir="rtl">
                <AlertDialogHeader>
                  <AlertDialogTitle>اعتماد التقرير</AlertDialogTitle>
                </AlertDialogHeader>
                <div className="px-1">
                  <label className="text-sm font-medium text-slate-700 mb-1 block">اسم المعتمد</label>
                  <Input
                    value={approverName}
                    onChange={(e) => setApproverName(e.target.value)}
                    placeholder="أدخل اسمك..."
                  />
                </div>
                <AlertDialogFooter className="flex-row-reverse gap-2">
                  <AlertDialogAction
                    disabled={!approverName.trim()}
                    onClick={() => approveMutation.mutate({ cpaProjectId: projectId, approvedBy: approverName.trim() })}
                    className="bg-emerald-600"
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

      {/* PDF-Style Report Content */}
      <div className="max-w-4xl mx-auto px-8 py-12 space-y-8">
        {/* Title */}
        <div className="text-center space-y-2 border-b border-slate-800 pb-8">
          <h1 className="text-2xl font-bold text-slate-900">COMO REAL ESTATE DEVELOPMENT</h1>
          <p className="text-sm text-slate-600">Engineering Consultancy Evaluation — True Cost Report</p>
          <p className="text-xs text-slate-500">Project {report.cpaProjectId} | 19 June 2026 | Confidential</p>
        </div>

        {/* Dynamic Input Section */}
        {!isApproved && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Save className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-blue-900">متغيرات ديناميكية</h3>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">المساحة (sqft)</label>
                <Input
                  type="number"
                  value={dynamicBUA}
                  onChange={(e) => setDynamicBUA(parseFloat(e.target.value) || 0)}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">سعر القدم (AED/sqft)</label>
                <Input
                  type="number"
                  value={dynamicPricePerSqft}
                  onChange={(e) => setDynamicPricePerSqft(parseFloat(e.target.value) || 0)}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">المدة (شهر)</label>
                <Input
                  type="number"
                  value={dynamicDuration}
                  onChange={(e) => setDynamicDuration(parseFloat(e.target.value) || 0)}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">التكلفة المحسوبة</label>
                <div className="h-8 flex items-center px-2 bg-white rounded border border-slate-200 text-sm font-semibold text-emerald-700">
                  AED {formatNum(calculatedConstructionCost)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Project Info */}
        <div className="grid grid-cols-4 gap-4 border border-slate-300 rounded-lg p-6 bg-slate-50">
          <div className="text-center">
            <p className="text-xs font-semibold text-slate-600 mb-1">BUA</p>
            <p className="text-lg font-bold text-slate-900">{formatNum(dynamicBUA || report.bua)} sqft</p>
          </div>
          <div className="text-center">
            <p className="text-xs font-semibold text-slate-600 mb-1">CONSTRUCTION COST</p>
            <p className="text-lg font-bold text-slate-900">AED {formatNum(calculatedConstructionCost)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs font-semibold text-slate-600 mb-1">DURATION</p>
            <p className="text-lg font-bold text-slate-900">{dynamicDuration || report.durationMonths} months</p>
          </div>
          <div className="text-center">
            <p className="text-xs font-semibold text-slate-600 mb-1">CATEGORY</p>
            <p className="text-lg font-bold text-slate-900">{report.category}</p>
          </div>
        </div>

        {/* Consultant Sections */}
        <div className="space-y-12">
          {sorted.map((c, idx) => {
            const effectiveTotal = getEffectiveTotal(c);
            const rank = effectiveTotal > 0 ? idx + 1 : '—';

            return (
              <div key={c.pcId} className="space-y-4">
                {/* Consultant Header */}
                <div className="flex items-center gap-3 pb-3 border-b-2 border-slate-800">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                    rank === 1 ? 'bg-emerald-600' : rank === 2 ? 'bg-slate-600' : rank === 3 ? 'bg-amber-600' : 'bg-slate-400'
                  }`}>{rank}</span>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{c.name} <span className="text-xs text-slate-500 font-normal">({c.code})</span></h3>
                    <p className="text-xs text-slate-500">
                      {c.designMethod === 'PERCENTAGE' ? `Design: ${c.designPct}% of CC` : 'Design: Lump Sum'} • 
                      {c.supervisionMethod === 'PERCENTAGE' ? ` Supervision: ${c.supervisionPct}% of CC` : c.supervisionMethod === 'MONTHLY_RATE' ? ' Supervision: Monthly Rate' : ' Supervision: Lump Sum'}
                    </p>
                  </div>
                </div>

                {/* Design Fee Analysis */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 bg-slate-800 text-white px-3 py-2 rounded">DESIGN FEE ANALYSIS</h4>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs font-semibold text-slate-600">PRICING METHOD</p>
                      <p className="font-bold text-slate-900">{c.designMethod === 'PERCENTAGE' ? `PERCENTAGE (${c.designPct}% of CC)` : 'LUMP SUM'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-600">QUOTED DESIGN FEE</p>
                      <p className="font-bold text-slate-900">{renderEditableCell(c, 'quotedDesignFee')}</p>
                    </div>
                  </div>

                  {/* Scope Items Table */}
                  {c.scopeGaps && c.scopeGaps.length > 0 && (
                    <div className="border border-slate-300 rounded overflow-hidden text-xs">
                      <table className="w-full">
                        <thead className="bg-slate-100">
                          <tr>
                            <th className="border-r border-slate-300 p-2 text-right font-semibold text-slate-700">#</th>
                            <th className="border-r border-slate-300 p-2 text-right font-semibold text-slate-700">Scope Item</th>
                            <th className="border-r border-slate-300 p-2 text-center font-semibold text-slate-700">Status</th>
                            <th className="p-2 text-right font-semibold text-slate-700">Reference Cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {c.scopeGaps.map((gap, i) => (
                            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                              <td className="border-r border-slate-300 p-2">{gap.itemCode}</td>
                              <td className="border-r border-slate-300 p-2">{gap.itemLabel}</td>
                              <td className="border-r border-slate-300 p-2 text-center">
                                {gap.status === 'EXCLUDED' && <span className="text-red-600 font-semibold">✗ Excluded</span>}
                                {gap.status === 'INCLUDED' && <span className="text-emerald-600 font-semibold">✓ Included</span>}
                              </td>
                              <td className="p-2 text-right">AED {formatNum(gap.gapCost)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="text-right">
                      <p className="text-xs font-semibold text-slate-600">Total Design Gap Cost</p>
                      <p className="font-bold text-slate-900">{renderEditableCell(c, 'designScopeGap')}</p>
                    </div>
                    <div className="text-right bg-slate-100 p-3 rounded">
                      <p className="text-xs font-semibold text-slate-600">TRUE DESIGN FEE</p>
                      <p className="font-bold text-slate-900">{renderEditableCell(c, 'trueDesignFee')}</p>
                    </div>
                  </div>
                </div>

                {/* Supervision Fee Analysis */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 bg-slate-800 text-white px-3 py-2 rounded">SUPERVISION FEE ANALYSIS</h4>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs font-semibold text-slate-600">PRICING METHOD</p>
                      <p className="font-bold text-slate-900">{c.supervisionMethod === 'PERCENTAGE' ? `PERCENTAGE (${c.supervisionPct}% of CC)` : c.supervisionMethod === 'MONTHLY_RATE' ? 'MONTHLY RATE' : 'LUMP SUM'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-600">QUOTED SUPERVISION FEE</p>
                      <p className="font-bold text-slate-900">{renderEditableCell(c, 'quotedSupervisionFee')}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="text-right">
                      <p className="text-xs font-semibold text-slate-600">Supervision Gap</p>
                      <p className="font-bold text-slate-900">{renderEditableCell(c, 'supervisionGap')}</p>
                    </div>
                    <div className="text-right bg-slate-100 p-3 rounded">
                      <p className="text-xs font-semibold text-slate-600">ADJUSTED SUPERVISION FEE</p>
                      <p className="font-bold text-slate-900">{renderEditableCell(c, 'adjustedSupervisionFee')}</p>
                    </div>
                  </div>
                </div>

                {/* Total */}
                <div className="bg-amber-50 border border-amber-200 rounded p-4 text-right">
                  <p className="text-xs font-semibold text-amber-700 mb-1">TOTAL TRUE COST</p>
                  <p className="text-2xl font-bold text-amber-900">{renderEditableCell(c, 'totalTrueCost')}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Baseline Reference */}
        {report.supervisionBaseline.length > 0 && (
          <div className="space-y-3 mt-12 pt-8 border-t border-slate-300">
            <h3 className="text-xs font-bold text-slate-700 bg-slate-800 text-white px-3 py-2 rounded">SUPERVISION BASELINE — {report.category}</h3>
            <div className="border border-slate-300 rounded overflow-hidden text-xs">
              <table className="w-full">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="border-r border-slate-300 p-2 text-right font-semibold text-slate-700">Role</th>
                    <th className="border-r border-slate-300 p-2 text-center font-semibold text-slate-700">Monthly Rate</th>
                    <th className="border-r border-slate-300 p-2 text-center font-semibold text-slate-700">Allocation %</th>
                    <th className="border-r border-slate-300 p-2 text-center font-semibold text-slate-700">Effective Monthly</th>
                    <th className="p-2 text-right font-semibold text-slate-700">Total Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {report.supervisionBaseline.map((b, i) => {
                    const effectiveMonthly = b.monthlyRate * (b.requiredPct / 100);
                    const totalCost = effectiveMonthly * (dynamicDuration || report.durationMonths);
                    return (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="border-r border-slate-300 p-2">{b.label}</td>
                        <td className="border-r border-slate-300 p-2 text-center">AED {formatNum(b.monthlyRate)}</td>
                        <td className="border-r border-slate-300 p-2 text-center">{b.requiredPct}%</td>
                        <td className="border-r border-slate-300 p-2 text-center">AED {formatNum(effectiveMonthly)}</td>
                        <td className="p-2 text-right font-semibold">AED {formatNum(totalCost)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
