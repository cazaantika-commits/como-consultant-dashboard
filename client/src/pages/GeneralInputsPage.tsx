import { useState, useEffect, useCallback, useMemo } from "react";
import { useProjectContext } from "@/contexts/ProjectContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { ProjectSelector } from "@/components/ProjectSelector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Save, Loader2, MapPin, Ruler, Calendar, DollarSign,
  Calculator, Building2, Percent, FileText, Info, Pencil, X,
} from "lucide-react";
import {
  dbProjectToInputs,
  dbProjectToRates,
  calculateProjectFormulas,
  type ProjectInputs,
  type ProjectRates,
} from "@/lib/projectData";

// ═══════════════════════════════════════════════════════════════
// FIELD DEFINITIONS — organized by section
// ═══════════════════════════════════════════════════════════════

interface FieldDef {
  key: string;
  label: string;
  unit?: string;
  tooltip?: string;
  type: "number" | "text" | "date";
  defaultValue?: string;
}

const SECTIONS: { id: string; title: string; icon: any; fields: FieldDef[] }[] = [
  {
    id: "basic",
    title: "البيانات الأساسية",
    icon: MapPin,
    fields: [
      { key: "plotAreaSqft", label: "مساحة الأرض", unit: "قدم²", type: "number" },
      { key: "manualBuaSqft", label: "مساحة البناء (BUA)", unit: "قدم²", type: "number" },
      { key: "estimatedConstructionPricePerSqft", label: "تكلفة الإنشاء", unit: "درهم/قدم²", type: "number", defaultValue: "400" },
      { key: "landPrice", label: "سعر الأرض (إجمالي)", unit: "درهم", type: "number", tooltip: "السعر الإجمالي للأرض — أو يُحسب تلقائياً من سعر/قدم × GFA" },
      { key: "startDate", label: "تاريخ البدء", type: "date" },
    ],
  },
  {
    id: "durations",
    title: "المدد الزمنية",
    icon: Calendar,
    fields: [
      { key: "preConMonths", label: "مدة التصاميم", unit: "شهر", type: "number", defaultValue: "6" },
      { key: "constructionMonths", label: "مدة الإنشاء", unit: "شهر", type: "number", defaultValue: "18" },
      { key: "handoverMonths", label: "مدة التسليم", unit: "شهر", type: "number", defaultValue: "2" },
    ],
  },
  {
    id: "gfa",
    title: "المساحات الإجمالية (GFA)",
    icon: Ruler,
    fields: [
      { key: "gfaResidentialSqft", label: "GFA سكني", unit: "قدم²", type: "number" },
      { key: "gfaRetailSqft", label: "GFA تجزئة", unit: "قدم²", type: "number" },
      { key: "gfaOfficesSqft", label: "GFA مكاتب", unit: "قدم²", type: "number" },
    ],
  },
  {
    id: "saleable",
    title: "النسب القابلة للبيع",
    icon: Percent,
    fields: [
      { key: "saleableResidentialPct", label: "سكني", unit: "%", type: "number", defaultValue: "95" },
      { key: "saleableRetailPct", label: "تجزئة", unit: "%", type: "number", defaultValue: "97" },
      { key: "saleableOfficesPct", label: "مكاتب", unit: "%", type: "number", defaultValue: "95" },
    ],
  },
  {
    id: "rates",
    title: "النسب والمعدلات",
    icon: Calculator,
    fields: [
      { key: "agentCommissionLandPct", label: "عمولة وسيط الأرض", unit: "%", type: "number", defaultValue: "1" },
      { key: "designFeePct", label: "أتعاب التصميم", unit: "%", type: "number", defaultValue: "1.8", tooltip: "نسبة من تكلفة الإنشاء" },
      { key: "supervisionFeePct", label: "أتعاب الإشراف", unit: "%", type: "number", defaultValue: "2", tooltip: "نسبة من تكلفة الإنشاء" },
      { key: "separationFeePerSqft", label: "رسوم الفرز", unit: "درهم/قدم²", type: "number", defaultValue: "40" },
      { key: "developerFeePct", label: "أتعاب المطور", unit: "%", type: "number", defaultValue: "5", tooltip: "نسبة من إجمالي الإيرادات" },
    ],
  },
  {
    id: "fees",
    title: "الرسوم الثابتة",
    icon: FileText,
    fields: [
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
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
// HELPER: format number with commas
// ═══════════════════════════════════════════════════════════════
function fmt(n: number): string {
  if (!n || isNaN(n)) return "0";
  return Math.round(n).toLocaleString("en-US");
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
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
      toast({ title: "تم الحفظ ✓", description: "تم حفظ الإدخالات العامة بنجاح" });
      setHasChanges(false);
      setIsEditing(false);
      projectQuery.refetch();
    },
    onError: (err: any) => toast({ title: "خطأ", description: "فشل الحفظ: " + err.message, variant: "destructive" }),
  });

  // Load data from DB into form
  useEffect(() => {
    if (projectQuery.data) {
      const p = projectQuery.data as any;
      const newFormData: Record<string, string> = {};
      SECTIONS.forEach(section => {
        section.fields.forEach(field => {
          const dbVal = p[field.key];
          if (field.key === "startDate") {
            newFormData[field.key] = dbVal || "";
          } else if (field.type === "number") {
            newFormData[field.key] = dbVal !== null && dbVal !== undefined ? String(dbVal) : (field.defaultValue || "");
          } else {
            newFormData[field.key] = dbVal || (field.defaultValue || "");
          }
        });
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

  // ═══ COMPUTED FORMULAS (read-only) ═══
  const computed = useMemo(() => {
    const mockDb: any = {};
    SECTIONS.forEach(section => {
      section.fields.forEach(field => {
        if (field.key === "preConMonths" || field.key === "constructionMonths" || field.key === "handoverMonths") {
          mockDb[field.key] = parseInt(formData[field.key] || field.defaultValue || "0");
        } else {
          mockDb[field.key] = formData[field.key] || field.defaultValue || "0";
        }
      });
    });
    // Add gfaSqft for the formula
    mockDb.gfaSqft = "";
    const inputs = dbProjectToInputs(mockDb);
    const rates = dbProjectToRates(mockDb);
    const formulas = calculateProjectFormulas(inputs, rates);
    return {
      gfaTotal: formulas.gfaTotal,
      sellableTotal: formulas.sellableResidential + formulas.sellableRetail + formulas.sellableOffice,
      sellableResidential: formulas.sellableResidential,
      sellableRetail: formulas.sellableRetail,
      sellableOffice: formulas.sellableOffice,
      landPrice: formulas.landPrice,
      landRegistration: formulas.landRegistration,
      landBroker: formulas.landBroker,
      constructionCost: formulas.constructionCost,
      landPricePerSqft: formulas.gfaTotal > 0 ? formulas.landPrice / formulas.gfaTotal : 0,
    };
  }, [formData]);

  // ═══ RENDER ═══
  return (
    <div className="bg-white p-2" dir="rtl">
      <div className="max-w-full mx-auto space-y-2">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-xs font-bold text-foreground">الإدخالات العامة</h1>
          </div>
          <div className="flex items-center gap-3">
            <ProjectSelector selectedId={selectedProjectId} onSelect={(id) => { setSelectedProjectId(id); setIsEditing(false); }} />
            {selectedProjectId && !isEditing && (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="gap-1.5">
                <Pencil className="w-3.5 h-3.5" />
                تعديل
              </Button>
            )}
            {isEditing && (
              <>
                <Button variant="ghost" size="sm" onClick={() => { setIsEditing(false); setHasChanges(false); projectQuery.refetch(); }} className="gap-1.5">
                  <X className="w-3.5 h-3.5" />
                  إلغاء
                </Button>
                <Button size="sm" onClick={handleSave} disabled={!hasChanges || updateProject.isPending} className="gap-1.5">
                  {updateProject.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  حفظ
                </Button>
              </>
            )}
          </div>
        </div>

        {!selectedProjectId && (
          <Card className="border-dashed">
            <CardContent className="py-4 text-center">
              <Building2 className="w-6 h-6 mx-auto text-muted-foreground/50 mb-1" />
              <p className="text-xs text-muted-foreground">اختر مشروعاً من القائمة أعلاه</p>
            </CardContent>
          </Card>
        )}

        {selectedProjectId && projectQuery.isLoading && (
          <Card>
            <CardContent className="py-4 text-center">
              <Loader2 className="w-5 h-5 mx-auto animate-spin text-primary" />
              <p className="text-xs text-muted-foreground mt-1">جاري التحميل...</p>
            </CardContent>
          </Card>
        )}

        {selectedProjectId && !projectQuery.isLoading && (
          <>
            {/* Computed Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryCard label="GFA الإجمالي" value={fmt(computed.gfaTotal)} unit="قدم²" />
              <SummaryCard label="القابل للبيع" value={fmt(computed.sellableTotal)} unit="قدم²" />
              <SummaryCard label="تكلفة الإنشاء" value={fmt(computed.constructionCost)} unit="درهم" />
              <SummaryCard label="سعر الأرض (محسوب)" value={fmt(computed.landPrice)} unit="درهم" />
            </div>

            {/* Input Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              {SECTIONS.map((section) => {
                const Icon = section.icon;
                return (
                  <Card key={section.id} className="overflow-hidden">
                    <CardHeader className="py-1.5 px-2 border-b border-border/50">
                      <CardTitle className="text-[11px] font-bold flex items-center gap-1">
                        <Icon className="w-3 h-3 text-primary" />
                        {section.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-2 space-y-1">
                      {section.fields.map((field) => (
                        <FieldRow
                          key={field.key}
                          field={field}
                          value={formData[field.key] || ""}
                          onChange={(val) => updateField(field.key, val)}
                          disabled={!isEditing}
                        />
                      ))}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Computed Formulas Section */}
            <Card>
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <Calculator className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                  القيم المحسوبة تلقائياً
                  <Badge variant="secondary" className="text-[10px]">للقراءة فقط</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <FormulaRow label="GFA الإجمالي" value={fmt(computed.gfaTotal)} unit="قدم²" formula="سكني + تجزئة + مكاتب" />
                  <FormulaRow label="القابل للبيع (سكني)" value={fmt(computed.sellableResidential)} unit="قدم²" formula="GFA × نسبة البيع" />
                  <FormulaRow label="القابل للبيع (تجزئة)" value={fmt(computed.sellableRetail)} unit="قدم²" formula="GFA × نسبة البيع" />
                  <FormulaRow label="القابل للبيع (مكاتب)" value={fmt(computed.sellableOffice)} unit="قدم²" formula="GFA × نسبة البيع" />
                  <FormulaRow label="سعر الأرض" value={fmt(computed.landPrice)} unit="درهم" formula="سعر/قدم × GFA" />
                  <FormulaRow label="سعر القدم (أرض)" value={fmt(computed.landPricePerSqft)} unit="درهم/قدم²" formula="سعر الأرض ÷ GFA" />
                  <FormulaRow label="تسجيل الأرض (4%)" value={fmt(computed.landRegistration)} unit="درهم" formula="سعر الأرض × 4%" />
                  <FormulaRow label="عمولة الوسيط" value={fmt(computed.landBroker)} unit="درهم" formula="سعر الأرض × النسبة" />
                  <FormulaRow label="تكلفة الإنشاء" value={fmt(computed.constructionCost)} unit="درهم" formula="BUA × سعر/قدم" />
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

function SummaryCard({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded border border-border bg-card px-2 py-1">
      <p className="text-[9px] text-muted-foreground">{label}</p>
      <p className="text-xs font-bold text-foreground">{value} <span className="text-[9px] font-normal text-muted-foreground">{unit}</span></p>
    </div>
  );
}

function FieldRow({ field, value, onChange, disabled }: { field: FieldDef; value: string; onChange: (v: string) => void; disabled: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-medium text-foreground truncate">{field.label}</label>
          {field.tooltip && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-3 h-3 text-muted-foreground cursor-help flex-shrink-0" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px]">
                  <p className="text-xs">{field.tooltip}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type={field.type === "date" ? "month" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`w-36 h-8 px-2.5 text-xs text-left rounded-md border transition-colors ${
            disabled
              ? "bg-muted/30 border-border text-muted-foreground cursor-not-allowed"
              : "bg-input border-border text-foreground focus:border-primary focus:ring-1 focus:ring-primary/30"
          }`}
          dir="ltr"
          placeholder={field.defaultValue || "—"}
        />
        {field.unit && (
          <span className="text-[10px] text-muted-foreground w-12 text-right">{field.unit}</span>
        )}
      </div>
    </div>
  );
}

function FormulaRow({ label, value, unit, formula }: { label: string; value: string; unit: string; formula: string }) {
  return (
    <div className="rounded-lg bg-muted/30 border border-border/50 p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-foreground">{label}</span>
        <Badge variant="outline" className="text-[9px] h-4 px-1.5">{formula}</Badge>
      </div>
      <p className="text-sm font-bold text-primary" dir="ltr">{value} <span className="text-[10px] font-normal text-muted-foreground">{unit}</span></p>
    </div>
  );
}
