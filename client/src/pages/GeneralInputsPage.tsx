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
    return (<div className="p-2 text-center text-xs text-gray-400" dir="rtl"><ProjectSelector selectedId={selectedProjectId} onSelect={setSelectedProjectId} /><p className="mt-1">اختر مشروعاً</p></div>);
  }
  if (projectQuery.isLoading) {
    return <div className="p-2 text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></div>;
  }

  // Split into 3 columns
  const col1 = ALL_FIELDS.slice(0, 10);
  const col2 = ALL_FIELDS.slice(10, 20);
  const col3 = ALL_FIELDS.slice(20, 30);

  const renderCol = (fields: typeof ALL_FIELDS) => (
    <table className="w-full border-collapse">
      <tbody>
        {fields.map((field, i) => (
          <tr key={field.key} className={i % 2 === 0 ? "bg-gray-50/50" : ""}>
            <td className="py-[1px] px-0.5 text-[9px] text-gray-600 whitespace-nowrap">{field.label}</td>
            <td className="py-[1px] px-0.5">
              <input
                type={field.type === "date" ? "month" : "text"}
                value={formData[field.key] || ""}
                onChange={e => updateField(field.key, e.target.value)}
                disabled={!isEditing}
                className={`w-full h-[16px] px-0.5 text-[9px] rounded border ${!isEditing ? "bg-transparent border-transparent text-gray-700 font-mono" : "bg-white border-gray-300 focus:border-blue-500 font-mono"}`}
                dir="ltr"
                placeholder={field.defaultValue || "—"}
              />
            </td>
            <td className="py-[1px] px-0.5 text-[7px] text-gray-400">{field.unit}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="bg-white p-1" dir="rtl">
      {/* Toolbar */}
      <div className="flex items-center gap-1 mb-1">
        <ProjectSelector selectedId={selectedProjectId} onSelect={(id) => { setSelectedProjectId(id); setIsEditing(false); }} />
        {!isEditing ? (
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="h-4 text-[8px] px-1.5">
            <Pencil className="w-2.5 h-2.5" /> تعديل
          </Button>
        ) : (
          <>
            <Button variant="ghost" size="sm" onClick={() => { setIsEditing(false); setHasChanges(false); projectQuery.refetch(); }} className="h-4 text-[8px] px-1.5">
              <X className="w-2.5 h-2.5" /> إلغاء
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!hasChanges || updateProject.isPending} className="h-4 text-[8px] px-1.5">
              {updateProject.isPending ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Save className="w-2.5 h-2.5" />} حفظ
            </Button>
          </>
        )}
      </div>

      {/* 3-column grid - all fields visible without scrolling */}
      <div className="grid grid-cols-3 gap-0.5">
        {renderCol(col1)}
        {renderCol(col2)}
        {renderCol(col3)}
      </div>

      {/* Computed values - single row */}
      <div className="mt-1 border-t border-gray-200 pt-0.5 grid grid-cols-6 gap-0.5 text-[8px]">
        <div className="text-center"><span className="text-gray-400 block">GFA إجمالي</span><span className="font-bold">{fmt(computed.gfaTotal)}</span></div>
        <div className="text-center"><span className="text-gray-400 block">قابل للبيع</span><span className="font-bold">{fmt(computed.sellableResidential + computed.sellableRetail + computed.sellableOffice)}</span></div>
        <div className="text-center"><span className="text-gray-400 block">تكلفة إنشاء</span><span className="font-bold">{fmt(computed.constructionCost)}</span></div>
        <div className="text-center"><span className="text-gray-400 block">سعر أرض</span><span className="font-bold">{fmt(computed.landPrice)}</span></div>
        <div className="text-center"><span className="text-gray-400 block">تسجيل 4%</span><span className="font-bold">{fmt(computed.landRegistration)}</span></div>
        <div className="text-center"><span className="text-gray-400 block">عمولة وسيط</span><span className="font-bold">{fmt(computed.landBroker)}</span></div>
      </div>
    </div>
  );
}
