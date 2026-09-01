import { useState, useEffect, useCallback, useMemo } from "react";
import { useProjectContext } from "@/contexts/ProjectContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { ProjectSelector } from "@/components/ProjectSelector";
import { Button } from "@/components/ui/button";
import { default as Save } from "lucide-react/dist/esm/icons/save.js";
import { default as Loader2 } from "lucide-react/dist/esm/icons/loader-circle.js";
import { default as Pencil } from "lucide-react/dist/esm/icons/pencil.js";
import { default as X } from "lucide-react/dist/esm/icons/x.js";
import { dbProjectToInputs, dbProjectToRates, calculateProjectFormulas } from "@/lib/projectData";
import { getProjectDesignTiming, getProjectReraQuarterlyFeeSettings } from "@/lib/projectTiming";
import { isFinancialStudiesGeneralInputVisible } from "@/lib/financialStudiesNavigation";
import { formatFullNumber, unformatNumberInput } from "@/lib/numberFormat";
import {
  getJointVentureTerms,
  isJointVentureLandForUnits,
  saveJointVentureTerms,
} from "@/lib/jointVentureLandForUnits";

const ALL_FIELDS = [
  { key: "plotAreaSqft", label: "مساحة الأرض", unit: "قدم²", type: "number" },
  { key: "manualBuaSqft", label: "مساحة البناء (BUA)", unit: "قدم²", type: "number" },
  { key: "estimatedConstructionPricePerSqft", label: "تكلفة الإنشاء/قدم²", unit: "درهم/قدم²", type: "number", defaultValue: "400" },
  { key: "landPrice", label: "سعر الأرض", unit: "درهم", type: "number" },
  { key: "startDate", label: "تاريخ البدء", unit: "", type: "date" },
  { key: "constructionMonths", label: "مدة الإنشاء", unit: "شهر", type: "number", defaultValue: "18" },

  { key: "gfaResidentialSqft", label: "GFA سكني", unit: "قدم²", type: "number" },
  { key: "gfaRetailSqft", label: "GFA تجزئة", unit: "قدم²", type: "number" },
  { key: "gfaOfficesSqft", label: "GFA مكاتب", unit: "قدم²", type: "number" },
  { key: "saleableResidentialPct", label: "نسبة بيع سكني", unit: "%", type: "number", defaultValue: "95" },
  { key: "saleableRetailPct", label: "نسبة بيع تجزئة", unit: "%", type: "number", defaultValue: "97" },
  { key: "saleableOfficesPct", label: "نسبة بيع مكاتب", unit: "%", type: "number", defaultValue: "95" },
  { key: "landOwnerProjectSharePct", label: "حصة مالك الأرض من جميع الوحدات", unit: "%", type: "number", defaultValue: "35", jointVentureOnly: true },
  { key: "developmentLicenseCost", label: "رخصة التطوير العقاري للاتفاق", unit: "درهم", type: "number", jointVentureOnly: true },
  { key: "waelLicenseRegistrationCost", label: "تسجيل وائل في رخصة التطوير", unit: "درهم", type: "number", jointVentureOnly: true },
  { key: "landOwnerLicenseRegistrationCost", label: "تسجيل صاحب الأرض في الرخصة", unit: "درهم", type: "number", jointVentureOnly: true },
  { key: "landOwnerUnitsRegistrationFeePct", label: "تسجيل وحدات صاحب الأرض عند الإنجاز", unit: "% من قيمة حصته", type: "number", defaultValue: "4", jointVentureOnly: true },
  { key: "agentCommissionLandPct", label: "عمولة وسيط الأرض", unit: "%", type: "number", defaultValue: "1" },
  { key: "designFeePct", label: "أتعاب التصميم (%)", unit: "%", type: "number", defaultValue: "1.8" },
  { key: "designFeeFixed", label: "أتعاب التصميم (مقطوع)", unit: "درهم", type: "number" },
  { key: "supervisionFeePct", label: "أتعاب الإشراف (%)", unit: "%", type: "number", defaultValue: "2" },
  { key: "supervisionFeeFixed", label: "أتعاب الإشراف (مقطوع)", unit: "درهم", type: "number" },
  { key: "separationFeePerSqft", label: "رسوم الفرز", unit: "درهم/قدم²", type: "number", defaultValue: "40" },
  { key: "developerFeePct", label: "أتعاب المطور", unit: "%", type: "number", defaultValue: "5" },
  { key: "buildForRentDeveloperFeeDesignRate", label: "أتعاب المطور — التصاميم", unit: "% من تكلفة الإنشاء", type: "number", defaultValue: "1.5", buildForRentOnly: true },
  { key: "buildForRentDeveloperFeeSupervisionRate", label: "أتعاب المطور — الإشراف", unit: "% من تكلفة الإنشاء", type: "number", defaultValue: "2.5", buildForRentOnly: true },
  { key: "soilTestFee", label: "فحص التربة", unit: "درهم", type: "number", defaultValue: "45000" },
  { key: "topographicSurveyFee", label: "المسح الطبوغرافي", unit: "درهم", type: "number", defaultValue: "12000" },
  { key: "surveyorDwgFees", label: "رسوم المسّاح (DWG)", unit: "درهم", type: "number", hint: "دفعة مباشرة من وائل في مرحلة تسجيل المشروع وإصدار ترخيص البيع" },
  { key: "surveyorFees", label: "رسوم المسّاح (As-Built)", unit: "درهم", type: "number", hint: "تظهر في حساب الضمان قرب نهاية الإنشاء" },

  { key: "officialBodiesFees", label: "رسوم الجهات الحكومية", unit: "درهم", type: "number", defaultValue: "7000000" },
  { key: "developerNocFee", label: "رسوم NOC المطور", unit: "درهم", type: "number", defaultValue: "10000" },
  { key: "reraProjectRegFee", label: "تسجيل المشروع (ريرا)", unit: "درهم", type: "number", defaultValue: "150000" },
  { key: "escrowAccountFee", label: "فتح حساب الضمان", unit: "درهم", type: "number", defaultValue: "180000" },
  { key: "bankFees", label: "رسوم البنك", unit: "درهم", type: "number", defaultValue: "35000" },
  { key: "reraAuditReportFee", label: "تقرير مدقق ريرا (محسوب تلقائياً)", unit: "درهم", type: "number", defaultValue: "24000", computed: true, hint: "= 3,500 × عدد الدفعات الربع سنوية (من الإعدادات)" },
  { key: "reraInspectionReportFee", label: "تقرير فحص ريرا (محسوب تلقائياً)", unit: "درهم", type: "number", defaultValue: "150000", computed: true, hint: "= 15,020 × عدد الدفعات الربع سنوية (من الإعدادات)" },
];

const DOCUMENT_DERIVED_FIELD_KEYS = new Set([
  "plotAreaSqft",
  "gfaResidentialSqft",
  "gfaRetailSqft",
  "gfaOfficesSqft",
]);

function fmt(n: number): string {
  if (!n || isNaN(n)) return "0";
  return Math.round(n).toLocaleString("en-US");
}

export default function GeneralInputsPage({ embedded, hideDocumentFields = false, hideProjectSelector = false }: { embedded?: boolean; hideDocumentFields?: boolean; hideProjectSelector?: boolean } = {}) {
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
      let savedRates: Record<string, unknown> = {};
      try {
        savedRates = JSON.parse(p.constructionScheduleJson || "{}")?.settings?.configurableRates || {};
      } catch { /* use approved defaults */ }
      ALL_FIELDS.forEach(f => {
        const val = p[f.key];
        if (val != null && val !== "") data[f.key] = String(val);
        else if (f.defaultValue && !isJointVentureLandForUnits(p.financingScenario)) data[f.key] = f.defaultValue;
      });
      data.financingScenario = p.financingScenario || "offplan_escrow";
      if (isJointVentureLandForUnits(data.financingScenario)) {
        const terms = getJointVentureTerms(p);
        data.landOwnerProjectSharePct = String(terms.landOwnerResidentialSharePct);
        data.developmentLicenseCost = terms.developmentLicenseCost > 0 ? String(terms.developmentLicenseCost) : "";
        data.waelLicenseRegistrationCost = terms.waelLicenseRegistrationCost > 0 ? String(terms.waelLicenseRegistrationCost) : "";
        data.landOwnerLicenseRegistrationCost = terms.landOwnerLicenseRegistrationCost > 0 ? String(terms.landOwnerLicenseRegistrationCost) : "";
        data.landOwnerUnitsRegistrationFeePct = String(terms.landOwnerUnitsRegistrationFeePct);
      }
      if (data.financingScenario === "build_for_sale" || data.financingScenario === "build_for_rent") data.developerFeePct = "3";
      if (data.financingScenario === "joint_venture_land_for_units") data.developerFeePct = "0";
      if (data.financingScenario === "build_for_rent") {
        data.buildForRentDeveloperFeeDesignRate = String(savedRates.buildForRentDeveloperFeeDesignRate ?? 1.5);
        data.buildForRentDeveloperFeeSupervisionRate = String(savedRates.buildForRentDeveloperFeeSupervisionRate ?? 2.5);
      }
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
      ALL_FIELDS.forEach(f => {
        if ((f as any).jointVentureOnly) return;
        if ((f as any).buildForRentOnly) return;
        if ((f as any).computed) return;
        if (formData[f.key] === undefined || formData[f.key] === "") return;
        const val = formData[f.key];
        if (f.key === "preConMonths" || f.key === "constructionMonths" || f.key === "handoverMonths") {
          payload[f.key] = parseInt(val) || 0;
        } else {
          payload[f.key] = val;
        }
      });
      payload.financingScenario = formData.financingScenario || "offplan_escrow";
      if (isJointVentureLandForUnits(payload.financingScenario)) {
        payload.constructionScheduleJson = saveJointVentureTerms(
          (projectQuery.data as any)?.constructionScheduleJson,
          {
            landOwnerProjectSharePct: Number(formData.landOwnerProjectSharePct ?? 35),
            landOwnerResidentialSharePct: Number(formData.landOwnerProjectSharePct ?? 35),
            landOwnerCommercialSharePct: Number(formData.landOwnerProjectSharePct ?? 35),
            developmentLicenseCost: Number(formData.developmentLicenseCost || 0),
            waelLicenseRegistrationCost: Number(formData.waelLicenseRegistrationCost || 0),
            landOwnerLicenseRegistrationCost: Number(formData.landOwnerLicenseRegistrationCost || 0),
            landOwnerUnitsRegistrationFeePct: Number(formData.landOwnerUnitsRegistrationFeePct ?? 4),
          },
        );
      }
      if (payload.financingScenario === "build_for_rent") {
        let schedule: any = {};
        try { schedule = JSON.parse((projectQuery.data as any)?.constructionScheduleJson || "{}"); } catch {}
        schedule.settings ||= {};
        schedule.settings.configurableRates ||= {};
        schedule.settings.configurableRates.buildForRentDeveloperFeeDesignRate = Number(formData.buildForRentDeveloperFeeDesignRate ?? 1.5);
        schedule.settings.configurableRates.buildForRentDeveloperFeeSupervisionRate = Number(formData.buildForRentDeveloperFeeSupervisionRate ?? 2.5);
        payload.constructionScheduleJson = JSON.stringify(schedule);
      }
      await updateProject.mutateAsync(payload);
      setHasChanges(false);
      setIsEditing(false);
      toast({ title: "تم الحفظ ✓" });
      projectQuery.refetch();
    } catch { toast({ title: "خطأ", variant: "destructive" }); }
  }, [selectedProjectId, formData, updateProject, toast, projectQuery]);

  const computed = useMemo(() => {
    const mockDb: any = {};
    const isJointVenture = isJointVentureLandForUnits(formData.financingScenario);
    ALL_FIELDS.forEach(f => { mockDb[f.key] = formData[f.key] || (isJointVenture ? "" : f.defaultValue || ""); });
    mockDb.constructionScheduleJson = (projectQuery.data as any)?.constructionScheduleJson;
    if (isJointVenture) {
      mockDb.constructionScheduleJson = saveJointVentureTerms(mockDb.constructionScheduleJson, {
        landOwnerProjectSharePct: Number(formData.landOwnerProjectSharePct ?? 35),
        landOwnerResidentialSharePct: Number(formData.landOwnerProjectSharePct ?? 35),
        landOwnerCommercialSharePct: Number(formData.landOwnerProjectSharePct ?? 35),
        developmentLicenseCost: Number(formData.developmentLicenseCost || 0),
        waelLicenseRegistrationCost: Number(formData.waelLicenseRegistrationCost || 0),
        landOwnerLicenseRegistrationCost: Number(formData.landOwnerLicenseRegistrationCost || 0),
        landOwnerUnitsRegistrationFeePct: Number(formData.landOwnerUnitsRegistrationFeePct ?? 4),
      });
    }
    if (formData.financingScenario === "build_for_rent") {
      let schedule: any = {};
      try { schedule = JSON.parse(mockDb.constructionScheduleJson || "{}"); } catch {}
      schedule.settings ||= {};
      schedule.settings.configurableRates ||= {};
      schedule.settings.configurableRates.buildForRentDeveloperFeeDesignRate = Number(formData.buildForRentDeveloperFeeDesignRate ?? 1.5);
      schedule.settings.configurableRates.buildForRentDeveloperFeeSupervisionRate = Number(formData.buildForRentDeveloperFeeSupervisionRate ?? 2.5);
      mockDb.constructionScheduleJson = JSON.stringify(schedule);
    }
    const inputs = dbProjectToInputs(mockDb);
    const rates = dbProjectToRates(mockDb);
    return calculateProjectFormulas(inputs, rates);
  }, [formData, projectQuery.data]);
  const designTiming = useMemo(() => getProjectDesignTiming(projectQuery.data), [projectQuery.data]);
  const reraQuarterlyFees = useMemo(() => {
    const project = {
      ...(projectQuery.data as any),
      constructionMonths: formData.constructionMonths || (projectQuery.data as any)?.constructionMonths,
    };
    return getProjectReraQuarterlyFeeSettings(project);
  }, [formData.constructionMonths, projectQuery.data]);

  if (!selectedProjectId) {
    return (<div className="p-4 text-center text-sm text-gray-400" dir="rtl">{!hideProjectSelector && <ProjectSelector selectedId={selectedProjectId} onSelect={setSelectedProjectId} />}<p className="mt-2">اختر مشروعاً من دليل الدراسات</p></div>);
  }
  if (projectQuery.isLoading) {
    return <div className="p-4 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>;
  }

  const isBuildForSale = formData.financingScenario === "build_for_sale";
  const isBuildForRent = formData.financingScenario === "build_for_rent";
  const isJointVenture = isJointVentureLandForUnits(formData.financingScenario);
  const isIndependentType = isBuildForSale || isBuildForRent || isJointVenture;
  const visibleFields = (isIndependentType
    ? ALL_FIELDS.filter((field) => {
        if ((field as any).jointVentureOnly) return isJointVenture;
        if (isBuildForRent && (field as any).buildForRentOnly) return true;
        if ((field as any).buildForRentOnly) return false;
        if ((isBuildForRent || isJointVenture) && field.key === "developerFeePct") return false;
        return isFinancialStudiesGeneralInputVisible(field.key, formData.financingScenario);
      })
    : ALL_FIELDS.filter((field) => !(field as any).buildForRentOnly && !(field as any).jointVentureOnly))
    .filter((field) => !isJointVenture || (field.key !== "landPrice" && field.key !== "agentCommissionLandPct"))
    .filter((field) => !hideDocumentFields || !DOCUMENT_DERIVED_FIELD_KEYS.has(field.key));
  const columnSize = Math.ceil(visibleFields.length / 3);
  const col1 = visibleFields.slice(0, columnSize);
  const col2 = visibleFields.slice(columnSize, columnSize * 2);
  const col3 = visibleFields.slice(columnSize * 2);

  const renderCol = (fields: typeof ALL_FIELDS) => (
    <div className="space-y-[2px]">
      {fields.map((field) => {
        const isComputed = (field as any).computed;
        const hint = (field as any).hint;
        const displayLabel = isBuildForRent && (field as any).buildForRentOnly
          ? field.label
          : isBuildForSale && field.key === "developerFeePct"
          ? "أتعاب المطور (1% تصميم + 2% تنفيذ)"
          : field.label;
        const displayValue = field.key === "reraAuditReportFee"
          ? String(reraQuarterlyFees.auditorTotal)
          : field.key === "reraInspectionReportFee"
            ? String(reraQuarterlyFees.inspectionTotal)
            : formData[field.key] || "";
        const visibleValue = !isEditing && field.type === "number"
          ? formatFullNumber(displayValue, "")
          : displayValue;
        return (
          <div key={field.key} className={`flex items-center gap-2 h-[28px] border-b border-slate-300 ${isComputed ? "bg-amber-50/80" : ""}`}>
            <span className="text-[13px] text-gray-600 w-[45%] text-right whitespace-nowrap overflow-hidden text-ellipsis" title={hint || ""}>{displayLabel}</span>
            <input
              type={field.type === "date" ? "month" : "text"}
              value={visibleValue}
              onChange={e => updateField(field.key, field.type === "number" ? unformatNumberInput(e.target.value) : e.target.value)}
              disabled={!isEditing || isComputed}
              className={`flex-1 h-[24px] px-2 text-[13px] rounded ${isComputed ? "bg-amber-50 text-amber-700 font-medium cursor-not-allowed" : !isEditing ? "bg-transparent text-gray-800 font-medium" : "bg-white border border-gray-300 text-gray-900 focus:border-teal-500 focus:ring-1 focus:ring-teal-500"}`}
              dir="ltr"
              placeholder={isJointVenture ? "—" : field.defaultValue || "—"}
              title={isComputed ? hint : ""}
            />
            <span className="text-[11px] text-gray-400 w-[50px] text-left">{field.unit}</span>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="bg-[#f7fafb] px-4 py-2" dir="rtl">
      {/* Toolbar */}
      <div className="mb-3 flex items-center gap-3 rounded-xl border border-slate-300 border-t-2 border-t-teal-500 bg-white px-4 py-2 shadow-sm">
        {!hideProjectSelector && <ProjectSelector selectedId={selectedProjectId} onSelect={(id) => { setSelectedProjectId(id); setIsEditing(false); }} />}
        <label className="flex items-center gap-2 text-[12px] text-gray-600">
          <span className="font-medium">نوع التطوير</span>
          <select
            value={formData.financingScenario || "offplan_escrow"}
            onChange={e => updateField("financingScenario", e.target.value)}
            disabled={!isEditing}
            className="h-7 rounded border border-gray-200 bg-white px-2 text-[12px] text-gray-800 disabled:cursor-not-allowed disabled:bg-gray-50"
          >
            <option value="offplan_escrow">أوف بلان</option>
            <option value="build_for_sale">بناء للبيع</option>
            <option value="build_for_rent">بناء للتأجير</option>
            <option value="joint_venture_land_for_units">Joint Venture Off-Plan — الأرض مقابل وحدات</option>
          </select>
        </label>
        <span className="text-[11px] text-blue-700 font-medium">مدة التصاميم: {designTiming.designMonths} شهر <span className="text-gray-400">(من الإعدادات والقواعد)</span></span>
        {!isEditing ? (
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="h-7 text-[12px] px-3 gap-1 border-gray-200 hover:bg-gray-50">
            <Pencil className="w-3.5 h-3.5" /> تعديل
          </Button>
        ) : (
          <>
            <Button variant="ghost" size="sm" onClick={() => { setIsEditing(false); setHasChanges(false); projectQuery.refetch(); }} className="h-7 text-[12px] px-3 gap-1">
              <X className="w-3.5 h-3.5" /> إلغاء
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!hasChanges || updateProject.isPending} className="h-7 text-[12px] px-3 gap-1 bg-teal-600 hover:bg-teal-700 text-white">
              {updateProject.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} حفظ
            </Button>
          </>
        )}
      </div>

      {isBuildForSale && (
        <div className="mb-3 rounded-xl border border-teal-300 border-r-4 border-r-teal-500 bg-teal-50/80 px-4 py-2 text-[12px] text-teal-900">
          <span className="font-semibold">قواعد البناء للبيع:</span> لا يوجد حساب ضمان أو رسوم بنكية أو تقارير ريرا للأوف بلان. أتعاب المطور 1% خلال التصميم و2% خلال التنفيذ، بينما التسويق والمبيعات بعد الإنجاز يُداران من صفحة المبيعات.
        </div>
      )}
      {isBuildForRent && (
        <div className="mb-3 rounded-xl border border-indigo-300 border-r-4 border-r-indigo-500 bg-indigo-50/80 px-4 py-2 text-[12px] text-indigo-900">
          <span className="font-semibold">قواعد البناء للتأجير:</span> لا توجد مبيعات أو تسويق أو عمولات أو إيرادات في هذه المرحلة، ولا يوجد حساب ضمان أو رسوم بنكية أو تقارير ريرا للأوف بلان. أتعاب المطور قابلة للتعديل: 1.5% في التصميم و2.5% في الإشراف من تكلفة الإنشاء.
        </div>
      )}
      {isJointVenture && (
        <div className="mb-3 rounded-xl border border-violet-300 border-r-4 border-r-violet-600 bg-violet-50/80 px-4 py-2 text-[12px] text-violet-950">
          <span className="font-semibold">Joint Venture Off-Plan:</span> صاحب الأرض يقدّم الأرض ويحصل على النسبة المحددة من جميع الوحدات السكنية والتجارية. يبيع وائل حصته أثناء الإنشاء عبر خطة الدفع وحساب الضمان. مصاريف الرخصة والتسجيل تُدخل هنا، بينما أتعاب الوساطة العقارية وميزانية التسويق تُحددان من صفحة مبيعات وائل.
        </div>
      )}

      {/* 3-column grid inside white rounded container */}
      <div className="fs-card fs-card-teal rounded-xl p-4">
        <div className="grid grid-cols-3 divide-x divide-slate-300">
          <div className="px-3 first:pr-0">{renderCol(col1)}</div>
          <div className="px-3">{renderCol(col2)}</div>
          <div className="px-3 last:pl-0">{renderCol(col3)}</div>
        </div>
      </div>

      {/* Computed summary cards - Portfolio style */}
      <div className="mt-3 grid grid-cols-3 gap-3">
        <div className="fs-card fs-card-teal rounded-xl p-3 text-center">
          <div className="text-[10px] text-teal-600 mb-0.5">GFA الإجمالي</div>
          <div className="text-base font-bold text-teal-700" dir="ltr">{fmt(computed.gfaTotal)} <span className="text-[11px] text-gray-400">قدم²</span></div>
        </div>
        <div className="fs-card fs-card-cyan rounded-xl p-3 text-center">
          <div className="text-[10px] text-teal-600 mb-0.5">القابل للبيع</div>
          <div className="text-base font-bold text-teal-700" dir="ltr">{fmt(computed.sellableResidential + computed.sellableRetail + computed.sellableOffice)} <span className="text-[11px] text-gray-400">قدم²</span></div>
        </div>
        <div className="fs-card fs-card-rose rounded-xl p-3 text-center">
          <div className="text-[10px] text-red-600 mb-0.5">تكلفة الإنشاء</div>
          <div className="text-base font-bold text-red-700" dir="ltr">{fmt(computed.constructionCost)} <span className="text-[11px] text-gray-400">درهم</span></div>
        </div>
      </div>
    </div>
  );
}
