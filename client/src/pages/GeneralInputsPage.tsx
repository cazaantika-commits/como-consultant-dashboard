import { useState, useEffect, useCallback, useMemo } from "react";
import { useProjectContext } from "@/contexts/ProjectContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { ProjectSelector } from "@/components/ProjectSelector";
import { Button } from "@/components/ui/button";
import { Save, Loader2, Pencil, X } from "lucide-react";
import {
  dbProjectToInputs,
  dbProjectToRates,
  calculateProjectFormulas,
} from "@/lib/projectData";

const ALL_FIELDS = [
  { key: "plotAreaSqft", label: "مساحة الأرض", unit: "قدم²", type: "number" },
  { key: "manualBuaSqft", label: "مساحة البناء (BUA)", unit: "قدم²", type: "number" },
  { key: "estimatedConstructionPricePerSqft", label: "تكلفة الإنشاء/قدم²", unit: "درهم/قدم²", type: "number", defaultValue: "400" },
  { key: "landPrice", label: "سعر الأرض (إجمالي)", unit: "درهم", type: "number" },
  { key: "startDate", label: "تاريخ البدء", unit: "", type: "date" },
  { key: "preConMonths", label: "مدة التصاميم", unit: "شهر", type: "number", defaultValue: "6" },
  { key: "constructionMonths", label: "مدة الإنشاء", unit: "شهر", type: "number", defaultValue: "18" },
  { key: "handoverMonths", label: "مدة التسليم", unit: "شهر", type: "number", defaultValue: "2" },
  { key: "gfaResidentialSqft", label: "GFA سكني", unit: "قدم²", type: "number" },
  { key: "gfaRetailSqft", label: "GFA تجزئة", unit: "قدم²", type: "number" },
  { key: "gfaOfficesSqft", label: "GFA مكاتب", unit: "قدم²", type: "number" },
  { key: "saleableResidentialPct", label: "نسبة البيع سكني", unit: "%", type: "number", defaultValue: "95" },
  { key: "saleableRetailPct", label: "نسبة البيع تجزئة", unit: "%", type: "number", defaultValue: "97" },
  { key: "saleableOfficesPct", label: "نسبة البيع مكاتب", unit: "%", type: "number", defaultValue: "95" },
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
  const updateProject = trpc.projects.update.useMutation({
    onSuccess: () => {
      toast({ title: "تم الحفظ ✓" });
      setHasChanges(false);
      setIsEditing(false);
      projectQuery.refetch();
    },
    onError: (err: any) => toast({ title: "خطأ", description: err.message, variant: "destructive" }),
  });

  useEffect(() => {
    if (projectQuery.data) {
      const p = projectQuery.data as any;
      const newFormData: Record<string, string> = {};
      ALL_FIELDS.forEach(field => {
        const dbVal = p[field.key];
        if (field.key === "startDate") {
          newFormData[field.key] = dbVal || "";
        } else if (field.type === "number") {
          newFormData[field.key] = dbVal !== null && dbVal !== undefined ? String(dbVal) : (field.defaultValue || "");
        } else {
          newFormData[field.key] = dbVal || (field.defaultValue || "");
        }
      });
      setFormData(newFormData);
      setHasChanges(false);
    }
  }, [projectQuery.data]);

  const updateField = useCallback((key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(() => {
    if (!selectedProjectId) return;
    const payload: Record<string, any> = { id: selectedProjectId };
    const intFields = ["preConMonths", "constructionMonths", "handoverMonths"];
    for (const [key, value] of Object.entries(formData)) {
      if (key === "startDate") {
        payload[key] = value?.trim() || undefined;
      } else if (intFields.includes(key)) {
        payload[key] = value ? parseInt(value) : undefined;
      } else {
        payload[key] = value?.trim() !== "" ? value : undefined;
      }
    }
    updateProject.mutate(payload as any);
  }, [selectedProjectId, formData, updateProject]);

  const computed = useMemo(() => {
    const mockDb: any = {};
    ALL_FIELDS.forEach(field => {
      if (field.key === "preConMonths" || field.key === "constructionMonths" || field.key === "handoverMonths") {
        mockDb[field.key] = parseInt(formData[field.key] || field.defaultValue || "0");
      } else {
        mockDb[field.key] = formData[field.key] || field.defaultValue || "0";
      }
    });
    mockDb.gfaSqft = "";
    const inputs = dbProjectToInputs(mockDb);
    const rates = dbProjectToRates(mockDb);
    const formulas = calculateProjectFormulas(inputs, rates);
    return formulas;
  }, [formData]);

  if (!selectedProjectId) {
    return (
      <div className="p-2 text-center text-xs text-gray-400" dir="rtl">
        <ProjectSelector selectedId={selectedProjectId} onSelect={(id) => setSelectedProjectId(id)} />
        <p className="mt-2">اختر مشروعاً</p>
      </div>
    );
  }

  if (projectQuery.isLoading) {
    return <div className="p-2 text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></div>;
  }

  return (
    <div className="bg-white p-1" dir="rtl">
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-1">
        <ProjectSelector selectedId={selectedProjectId} onSelect={(id) => { setSelectedProjectId(id); setIsEditing(false); }} />
        {!isEditing && (
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="h-6 text-[10px] px-2">
            <Pencil className="w-3 h-3 mr-1" /> تعديل
          </Button>
        )}
        {isEditing && (
          <>
            <Button variant="ghost" size="sm" onClick={() => { setIsEditing(false); setHasChanges(false); projectQuery.refetch(); }} className="h-6 text-[10px] px-2">
              <X className="w-3 h-3 mr-1" /> إلغاء
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!hasChanges || updateProject.isPending} className="h-6 text-[10px] px-2">
              {updateProject.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
              حفظ
            </Button>
          </>
        )}
      </div>

      {/* Single flat table */}
      <table className="w-full border-collapse text-[11px]">
        <tbody>
          {ALL_FIELDS.map((field, i) => (
            <tr key={field.key} className={i % 2 === 0 ? "bg-gray-50" : "bg-white"}>
              <td className="py-0.5 px-1 text-right font-medium text-gray-700 w-[40%]">{field.label}</td>
              <td className="py-0.5 px-1 w-[35%]">
                <input
                  type={field.type === "date" ? "month" : "text"}
                  value={formData[field.key] || ""}
                  onChange={(e) => updateField(field.key, e.target.value)}
                  disabled={!isEditing}
                  className={`w-full h-5 px-1 text-[11px] text-left rounded border ${
                    !isEditing ? "bg-transparent border-transparent text-gray-600" : "bg-white border-gray-300 text-gray-900 focus:border-blue-500"
                  }`}
                  dir="ltr"
                  placeholder={field.defaultValue || "—"}
                />
              </td>
              <td className="py-0.5 px-1 text-[9px] text-gray-400 w-[10%]">{field.unit}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Computed values - single flat table too */}
      <div className="mt-1 border-t border-gray-200 pt-1">
        <p className="text-[9px] text-gray-400 mb-0.5">محسوب تلقائياً:</p>
        <table className="w-full border-collapse text-[11px]">
          <tbody>
            <tr className="bg-blue-50"><td className="py-0.5 px-1 text-gray-600">GFA الإجمالي</td><td className="py-0.5 px-1 text-left font-bold" dir="ltr">{fmt(computed.gfaTotal)}</td><td className="py-0.5 px-1 text-[9px] text-gray-400">قدم²</td></tr>
            <tr className="bg-white"><td className="py-0.5 px-1 text-gray-600">القابل للبيع (إجمالي)</td><td className="py-0.5 px-1 text-left font-bold" dir="ltr">{fmt(computed.sellableResidential + computed.sellableRetail + computed.sellableOffice)}</td><td className="py-0.5 px-1 text-[9px] text-gray-400">قدم²</td></tr>
            <tr className="bg-blue-50"><td className="py-0.5 px-1 text-gray-600">تكلفة الإنشاء</td><td className="py-0.5 px-1 text-left font-bold" dir="ltr">{fmt(computed.constructionCost)}</td><td className="py-0.5 px-1 text-[9px] text-gray-400">درهم</td></tr>
            <tr className="bg-white"><td className="py-0.5 px-1 text-gray-600">سعر الأرض</td><td className="py-0.5 px-1 text-left font-bold" dir="ltr">{fmt(computed.landPrice)}</td><td className="py-0.5 px-1 text-[9px] text-gray-400">درهم</td></tr>
            <tr className="bg-blue-50"><td className="py-0.5 px-1 text-gray-600">تسجيل الأرض (4%)</td><td className="py-0.5 px-1 text-left font-bold" dir="ltr">{fmt(computed.landRegistration)}</td><td className="py-0.5 px-1 text-[9px] text-gray-400">درهم</td></tr>
            <tr className="bg-white"><td className="py-0.5 px-1 text-gray-600">عمولة الوسيط</td><td className="py-0.5 px-1 text-left font-bold" dir="ltr">{fmt(computed.landBroker)}</td><td className="py-0.5 px-1 text-[9px] text-gray-400">درهم</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
