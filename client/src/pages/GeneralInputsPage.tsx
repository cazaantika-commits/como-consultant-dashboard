import { useState, useEffect, useCallback, useMemo } from "react";
import { useProjectContext } from "@/contexts/ProjectContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { ProjectSelector } from "@/components/ProjectSelector";
import { Button } from "@/components/ui/button";
import { Save, Loader2, Pencil, X } from "lucide-react";
import { dbProjectToInputs, dbProjectToRates, calculateProjectFormulas } from "@/lib/projectData";

const ALL_FIELDS = [
  { key: "plotAreaSqft", label: "مساحة الأرض", unit: "قدم²", type: "number" },
  { key: "manualBuaSqft", label: "مساحة البناء (BUA)", unit: "قدم²", type: "number" },
  { key: "estimatedConstructionPricePerSqft", label: "تكلفة الإنشاء/قدم²", unit: "درهم/قدم²", type: "number", defaultValue: "400" },
  { key: "landPrice", label: "سعر الأرض", unit: "درهم", type: "number" },
  { key: "startDate", label: "تاريخ البدء", unit: "", type: "date" },
  { key: "preConMonths", label: "مدة التصاميم", unit: "شهر", type: "number", defaultValue: "6" },
  { key: "constructionMonths", label: "مدة الإنشاء", unit: "شهر", type: "number", defaultValue: "18" },
  { key: "handoverMonths", label: "مدة التسليم", unit: "شهر", type: "number", defaultValue: "2" },
  { key: "gfaResidentialSqft", label: "GFA سكني", unit: "قدم²", type: "number" },
  { key: "gfaRetailSqft", label: "GFA تجزئة", unit: "قدم²", type: "number" },
  { key: "gfaOfficesSqft", label: "GFA مكاتب", unit: "قدم²", type: "number" },
  { key: "saleableResidentialPct", label: "نسبة بيع سكني", unit: "%", type: "number", defaultValue: "95" },
  { key: "saleableRetailPct", label: "نسبة بيع تجزئة", unit: "%", type: "number", defaultValue: "97" },
  { key: "saleableOfficesPct", label: "نسبة بيع مكاتب", unit: "%", type: "number", defaultValue: "95" },
  { key: "agentCommissionLandPct", label: "عمولة وسيط الأرض", unit: "%", type: "number", defaultValue: "1" },
  { key: "designFeePct", label: "أتعاب التصميم", unit: "%", type: "number", defaultValue: "1.8" },
  { key: "supervisionFeePct", label: "أتعاب الإشراف", unit: "%", type: "number", defaultValue: "2" },
  { key: "separationFeePerSqft", label: "رسوم الفرز", unit: "درهم/قدم²", type: "number", defaultValue: "40" },
  { key: "developerFeePct", label: "أتعاب المطور", unit: "%", type: "number", defaultValue: "5" },
  { key: "soilTestFee", label: "فحص التربة", unit: "درهم", type: "number", defaultValue: "45000" },
  { key: "topographicSurveyFee", label: "المسح الطبوغرافي", unit: "درهم", type: "number", defaultValue: "12000" },
  { key: "surveyorFees", label: "رسوم المساح", unit: "درهم", type: "number", defaultValue: "35000" },
  { key: "communityFees", label: "رسوم المجتمع", unit: "درهم", type: "number", defaultValue: "80000" },
  { key: "officialBodiesFees", label: "رسوم الجهات الحكومية", unit: "درهم", type: "number", defaultValue: "7000000" },
  { key: "developerNocFee", label: "رسوم NOC المطور", unit: "درهم", type: "number", defaultValue: "10000" },
  { key: "reraProjectRegFee", label: "تسجيل المشروع (ريرا)", unit: "درهم", type: "number", defaultValue: "150000" },
  { key: "escrowAccountFee", label: "فتح حساب الضمان", unit: "درهم", type: "number", defaultValue: "180000" },
  { key: "bankFees", label: "رسوم البنك", unit: "درهم", type: "number", defaultValue: "35000" },
  { key: "reraAuditReportFee", label: "تقرير مدقق ريرا", unit: "درهم", type: "number", defaultValue: "24000" },
  { key: "reraInspectionReportFee", label: "تقرير فحص ريرا", unit: "درهم", type: "number", defaultValue: "150000" },
];

function fmt(n: number): string {
  if (!n || isNaN(n)) return "0";
  return Math.round(n).toLocaleString("en-US");
}

export default function GeneralInputsPage({ embedded }: { embedded?: boolean } = {}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { selectedProjectId, setSelectedProjectId } = useProjectContext();
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const projectQuery = trpc.projects.getById.useQuery(selectedProjectId!, { enabled: !!selectedProjectId && !!user });
  const updateProject = trpc.projects.update.useMutation();

  useEffect(() => {
    if (projectQuery.data) {
      const p = projectQuery.data as any;
      const data: Record<string, string> = {};
      ALL_FIELDS.forEach(f => {
        const val = p[f.key];
        if (val != null && val !== "") data[f.key] = String(val);
        else if (f.defaultValue) data[f.key] = f.defaultValue;
      });
      setFormData(data);
      setHasChanges(false);
    }
  }, [projectQuery.data]);

  const updateField = useCallback((key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!selectedProjectId) return;
    try {
      const payload: any = { id: selectedProjectId };
      ALL_FIELDS.forEach(f => { if (formData[f.key] !== undefined) payload[f.key] = formData[f.key]; });
      await updateProject.mutateAsync(payload);
      setHasChanges(false);
      setIsEditing(false);
      toast({ title: "تم الحفظ ✓" });
      projectQuery.refetch();
    } catch { toast({ title: "خطأ", variant: "destructive" }); }
  }, [selectedProjectId, formData, updateProject, toast, projectQuery]);

  const computed = useMemo(() => {
    const mockDb: any = {};
    ALL_FIELDS.forEach(f => { mockDb[f.key] = formData[f.key] || f.defaultValue || ""; });
    const inputs = dbProjectToInputs(mockDb);
    const rates = dbProjectToRates(mockDb);
    return calculateProjectFormulas(inputs, rates);
  }, [formData]);

  if (!selectedProjectId) {
    return (<div className="p-4 text-center text-sm text-gray-500" dir="rtl"><ProjectSelector selectedId={selectedProjectId} onSelect={setSelectedProjectId} /><p className="mt-2">اختر مشروعاً</p></div>);
  }
  if (projectQuery.isLoading) {
    return <div className="p-4 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>;
  }

  // Split into 3 columns of 10
  const col1 = ALL_FIELDS.slice(0, 10);
  const col2 = ALL_FIELDS.slice(10, 20);
  const col3 = ALL_FIELDS.slice(20, 30);

  return (
    <div className="bg-white p-4" dir="rtl">
      {/* Toolbar - same style as Portfolio header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <ProjectSelector selectedId={selectedProjectId} onSelect={(id) => { setSelectedProjectId(id); setIsEditing(false); }} />
          {!isEditing ? (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="h-8 text-sm px-3 gap-1.5 rounded-md">
              <Pencil className="w-3.5 h-3.5" /> تعديل
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setIsEditing(false); setHasChanges(false); projectQuery.refetch(); }} className="h-8 text-sm px-3 gap-1.5">
                <X className="w-3.5 h-3.5" /> إلغاء
              </Button>
              <Button size="sm" onClick={handleSave} disabled={!hasChanges || updateProject.isPending} className="h-8 text-sm px-4 gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md">
                {updateProject.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} حفظ
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Summary cards - same style as Portfolio */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="rounded-lg border border-gray-200 p-3 text-center">
          <div className="text-sm text-gray-500">GFA الإجمالي</div>
          <div className="text-lg font-bold text-gray-800 mt-1" dir="ltr">{fmt(computed.gfaTotal)}</div>
        </div>
        <div className="rounded-lg border border-gray-200 p-3 text-center">
          <div className="text-sm text-gray-500">القابل للبيع</div>
          <div className="text-lg font-bold text-gray-800 mt-1" dir="ltr">{fmt(computed.sellableResidential + computed.sellableRetail + computed.sellableOffice)}</div>
        </div>
        <div className="rounded-lg border border-gray-200 p-3 text-center">
          <div className="text-sm text-gray-500">تكلفة الإنشاء</div>
          <div className="text-lg font-bold text-emerald-600 mt-1" dir="ltr">{fmt(computed.constructionCost)}</div>
        </div>
      </div>

      {/* 3-column table grid - same row style as Portfolio table */}
      <div className="grid grid-cols-3 gap-6">
        {[col1, col2, col3].map((col, ci) => (
          <table key={ci} className="w-full text-sm">
            <tbody>
              {col.map((field) => (
                <tr key={field.key} className="border-b border-gray-100 hover:bg-gray-50/50">
                  <td className="py-2 pr-2 text-gray-600 whitespace-nowrap">{field.label}</td>
                  <td className="py-2 text-left" dir="ltr">
                    <input
                      type={field.type === "date" ? "month" : "text"}
                      value={formData[field.key] || ""}
                      onChange={e => updateField(field.key, e.target.value)}
                      disabled={!isEditing}
                      className={`w-full text-sm text-left px-2 py-0.5 rounded ${!isEditing ? "bg-transparent text-gray-800 font-medium border-none" : "bg-white border border-gray-300 text-gray-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"}`}
                      dir="ltr"
                      placeholder={field.defaultValue || "—"}
                    />
                  </td>
                  <td className="py-2 pl-2 text-xs text-gray-400 whitespace-nowrap">{field.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
    </div>
  );
}
