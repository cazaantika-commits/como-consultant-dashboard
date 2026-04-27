import { useState, useEffect, useRef, Fragment, useMemo, useCallback } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Trash2, DollarSign, Users, ExternalLink, TrendingUp, Target, CheckCircle2, Building, AlertTriangle, Shield, Settings2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// ===== Supervision Monthly Rate Dialog =====
function SupervisionRateDialog({ open, onClose, fin, projectDurationMonths }: {
  open: boolean;
  onClose: (newTotal?: number) => void;
  fin: any;
  projectDurationMonths: number;
}) {
  const cpaProjectId = fin?.cpaProjectId || 0;
  const projectConsultantId = fin?.projectConsultantId || 0;
  const rolesQuery = trpc.financial.getProjectSupervisionRoles.useQuery(
    { cpaProjectId, projectConsultantId },
    { enabled: open && cpaProjectId > 0 && projectConsultantId > 0 }
  );
  const saveRateMutation = trpc.financial.saveSupervisionMonthlyRate.useMutation({
    onSuccess: () => rolesQuery.refetch(),
  });
  const [rates, setRates] = useState<Record<number, string>>({});

  useEffect(() => {
    if (rolesQuery.data) {
      const init: Record<number, string> = {};
      rolesQuery.data.forEach((r: any) => {
        init[r.id] = r.proposed_monthly_rate != null ? String(r.proposed_monthly_rate) : '';
      });
      setRates(init);
    }
  }, [rolesQuery.data]);

  const handleBlur = (roleId: number) => {
    const val = parseFloat(rates[roleId] || '0') || null;
    saveRateMutation.mutate({ projectConsultantId, supervisionRoleId: roleId, proposedMonthlyRate: val });
  };

  const total = (rolesQuery.data || []).reduce((sum: number, r: any) => {
    const rate = parseFloat(rates[r.id] || '0') || 0;
    const alloc = Number(r.required_allocation_pct) / 100;
    return sum + rate * alloc * projectDurationMonths;
  }, 0);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose(total)}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right text-teal-800">تفاصيل أتعاب الإشراف — Monthly Rate</DialogTitle>
        </DialogHeader>
        {rolesQuery.isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="animate-spin w-6 h-6" /></div>
        ) : (
          <>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-teal-700 text-white text-xs">
                  <th className="border border-teal-600 p-2 text-right">الدور</th>
                  <th className="border border-teal-600 p-2 text-center">نسبة الإشغال</th>
                  <th className="border border-teal-600 p-2 text-center">المدة (شهر)</th>
                  <th className="border border-teal-600 p-2 text-center">الراتب الشهري (AED)</th>
                  <th className="border border-teal-600 p-2 text-center">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {(rolesQuery.data || []).map((role: any) => {
                  const rate = parseFloat(rates[role.id] || '0') || 0;
                  const alloc = Number(role.required_allocation_pct) / 100;
                  const roleTotal = rate * alloc * projectDurationMonths;
                  return (
                    <tr key={role.id} className="border-b hover:bg-teal-50">
                      <td className="border border-slate-200 p-2 font-medium text-slate-800">{role.label}</td>
                      <td className="border border-slate-200 p-2 text-center text-slate-600">{Number(role.required_allocation_pct).toFixed(0)}%</td>
                      <td className="border border-slate-200 p-2 text-center text-slate-600">{projectDurationMonths}</td>
                      <td className="border border-slate-200 p-2">
                        <Input
                          type="number"
                          value={rates[role.id] ?? ''}
                          onChange={(e) => setRates(prev => ({ ...prev, [role.id]: e.target.value }))}
                          onBlur={() => handleBlur(role.id)}
                          placeholder={role.reference_rate ? `مرجع: ${Number(role.reference_rate).toLocaleString()}` : '0'}
                          className="text-center text-xs border-teal-300"
                        />
                      </td>
                      <td className="border border-slate-200 p-2 text-center font-bold text-teal-700">
                        {roleTotal > 0 ? roleTotal.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-teal-100 font-bold">
                  <td colSpan={4} className="border border-teal-300 p-2 text-right text-teal-800">المجموع الكلي</td>
                  <td className="border border-teal-300 p-2 text-center text-teal-900 text-base">{total.toLocaleString(undefined, { maximumFractionDigits: 0 })} AED</td>
                </tr>
              </tfoot>
            </table>
            {cpaProjectId === 0 && (
              <p className="text-amber-600 text-xs mt-2 text-center">⚠ لم يتم ربط هذا المشروع بنظام CPA. أضف المشروع في إعدادات المكاتب الاستشارية أولاً.</p>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// FinancialRow component with local state - saves ONLY on blur
function FinancialRow({ consultant, fin, selectedProjectId, constructionCost, updateFinancialMutation, onTotalChange, projectDurationMonths }: {
  consultant: any;
  fin: any;
  selectedProjectId: number;
  constructionCost: number;
  updateFinancialMutation: any;
  onTotalChange: (consultantId: number, total: number) => void;
  designScopeGapCost?: number;
  projectDurationMonths: number;
}) {
  const [designType, setDesignType] = useState(fin?.designType || 'pct');
  const [designValue, setDesignValue] = useState(fin ? String(parseFloat(String(fin.designValue)) || 0) : '0');
  const [supervisionType, setSupervisionType] = useState(fin?.supervisionType || 'pct');
  const [supervisionValue, setSupervisionValue] = useState(fin ? String(parseFloat(String(fin.supervisionValue)) || 0) : '0');
  const [proposalLink, setProposalLink] = useState((fin as any)?.proposalLink || '');
  // Gap overrides: null means "use CPA auto value", number means manual override
  const [designGapInput, setDesignGapInput] = useState(
    fin?.designGapOverride !== null && fin?.designGapOverride !== undefined
      ? String(Number(fin.designGapOverride))
      : String(Number(fin?.designScopeGapCost || 0))
  );
  const [supervisionGapInput, setSupervisionGapInput] = useState(
    fin?.supervisionGapOverride !== null && fin?.supervisionGapOverride !== undefined
      ? String(Number(fin.supervisionGapOverride))
      : String(Number(fin?.supervisionScopeGapCost || 0))
  );
  const [supervisionDialogOpen, setSupervisionDialogOpen] = useState(false);
  const [monthlyRateTotal, setMonthlyRateTotal] = useState<number>(0);
  const editingRef = useRef(false);
  const initRef = useRef(fin?.id);

  useEffect(() => {
    if (fin && fin.id !== initRef.current) {
      initRef.current = fin.id;
      setDesignType(fin.designType || 'pct');
      setDesignValue(String(parseFloat(String(fin.designValue)) || 0));
      setSupervisionType(fin.supervisionType || 'pct');
      setSupervisionValue(String(parseFloat(String(fin.supervisionValue)) || 0));
      setProposalLink((fin as any)?.proposalLink || '');
      setDesignGapInput(
        fin?.designGapOverride !== null && fin?.designGapOverride !== undefined
          ? String(Number(fin.designGapOverride))
          : String(Number(fin?.designScopeGapCost || 0))
      );
      setSupervisionGapInput(
        fin?.supervisionGapOverride !== null && fin?.supervisionGapOverride !== undefined
          ? String(Number(fin.supervisionGapOverride))
          : String(Number(fin?.supervisionScopeGapCost || 0))
      );
    }
  }, [fin?.id]);

  const dv = parseFloat(designValue) || 0;
  const sv = parseFloat(supervisionValue) || 0;
  const designAmount = designType === 'pct' ? constructionCost * (dv / 100) : dv;
  const supervisionAmount = supervisionType === 'pct' ? constructionCost * (sv / 100) : supervisionType === 'monthly_rate' ? monthlyRateTotal : sv;
  const designGapCost = parseFloat(designGapInput) || 0;
  const supervisionGapCost = parseFloat(supervisionGapInput) || 0;
  const total = designAmount + designGapCost + supervisionAmount + supervisionGapCost;

  const totalRef = useRef(total);
  useEffect(() => {
    if (totalRef.current !== total) {
      totalRef.current = total;
      onTotalChange(consultant.id, total);
    }
  }, [total, consultant.id, onTotalChange]);
  const gapCost = designGapCost; // keep for legacy ref

  const doSave = (overrides: any = {}) => {
    editingRef.current = false;
    const data = {
      projectId: selectedProjectId,
      consultantId: consultant.id,
      designType: overrides.designType ?? designType,
      designValue: overrides.designValue !== undefined ? overrides.designValue : (parseFloat(designValue) || 0),
      supervisionType: overrides.supervisionType ?? supervisionType,
      supervisionValue: overrides.supervisionValue !== undefined ? overrides.supervisionValue : (parseFloat(supervisionValue) || 0),
      proposalLink: overrides.proposalLink ?? proposalLink,
      designGapOverride: overrides.designGapOverride !== undefined ? overrides.designGapOverride : (parseFloat(designGapInput) || 0),
      supervisionGapOverride: overrides.supervisionGapOverride !== undefined ? overrides.supervisionGapOverride : (parseFloat(supervisionGapInput) || 0),
    };
    updateFinancialMutation.mutate(data);
  };

  const designTotal = designAmount + designGapCost;
  const supervisionTotal = supervisionAmount + supervisionGapCost;

  return (
    <>
    <tr className="border-b hover:bg-gradient-to-l hover:from-blue-50/30 hover:to-transparent transition-all duration-200">
      {/* Consultant name */}
      <td className="border border-slate-200 p-3 font-semibold text-sm whitespace-normal leading-tight bg-gradient-to-l from-slate-50 to-white">
        {consultant.name}
      </td>

      {/* === DESIGN GROUP === */}
      {/* Design type */}
      <td className="border border-slate-200 p-0 text-center bg-blue-50" style={{width:'5%'}}>
        <Select value={designType} onValueChange={(v: any) => {
          setDesignType(v);
          doSave({ designType: v });
        }}>
          <SelectTrigger className="w-full h-8 bg-white border-blue-300 text-[11px] font-bold px-1 [&>svg]:hidden justify-center">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pct">%</SelectItem>
            <SelectItem value="lump">مبلغ</SelectItem>
          </SelectContent>
        </Select>
      </td>
      {/* Design fees */}
      <td className="border border-slate-200 p-2 bg-blue-50">
        <Input
          type="number"
          value={designValue}
          onChange={(e) => { editingRef.current = true; setDesignValue(e.target.value); }}
          onBlur={() => doSave()}
          className="text-center bg-white border-blue-300 text-xs"
        />
        {designType === 'pct' && constructionCost > 0 && (
          <p className="text-[10px] text-blue-500 mt-1 text-center">{designAmount.toLocaleString()}</p>
        )}
      </td>
      {/* Design gap (editable) */}
      <td className="border border-slate-200 p-2 bg-orange-50">
        <Input
          type="number"
          value={designGapInput}
          onChange={(e) => { editingRef.current = true; setDesignGapInput(e.target.value); }}
          onBlur={() => doSave()}
          className="text-center bg-orange-50 border-orange-300 text-orange-700 font-semibold text-xs"
          placeholder="0"
        />
        {fin?.cpaDesignGap > 0 && (
          <p className="text-[10px] text-orange-400 mt-1 text-center">CPA: {Number(fin.cpaDesignGap).toLocaleString()}</p>
        )}
      </td>
      {/* Design total */}
      <td className="border border-slate-200 p-2 text-center font-bold text-sm bg-blue-100 text-blue-800">
        {designTotal.toLocaleString()}
        <p className="text-[10px] font-normal text-blue-500">AED</p>
      </td>

      {/* === SUPERVISION GROUP === */}
      {/* Supervision type */}
      <td className="border border-slate-200 p-0 text-center bg-teal-50" style={{width:'5%'}}>
        <Select value={supervisionType} onValueChange={(v: any) => {
          setSupervisionType(v);
          doSave({ supervisionType: v });
        }}>
          <SelectTrigger className="w-full h-8 bg-white border-teal-300 text-[11px] font-bold px-1 [&>svg]:hidden justify-center">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pct">%</SelectItem>
            <SelectItem value="lump">مبلغ</SelectItem>
            <SelectItem value="monthly_rate">شهري</SelectItem>
          </SelectContent>
        </Select>
      </td>
      {/* Supervision fees */}
      <td className="border border-slate-200 p-2 bg-teal-50">
        {supervisionType === 'monthly_rate' ? (
          <div className="flex flex-col items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              className="w-full h-8 text-xs border-teal-400 text-teal-700 hover:bg-teal-50 flex items-center gap-1"
              onClick={() => setSupervisionDialogOpen(true)}
            >
              <Settings2 className="w-3 h-3" />
              تفاصيل الرواتب
            </Button>
            {monthlyRateTotal > 0 && (
              <p className="text-[10px] text-teal-600 font-semibold">{monthlyRateTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            )}
          </div>
        ) : (
          <>
            <Input
              type="number"
              value={supervisionValue}
              onChange={(e) => { editingRef.current = true; setSupervisionValue(e.target.value); }}
              onBlur={() => doSave()}
              className="text-center bg-white border-teal-300 text-xs"
            />
            {supervisionType === 'pct' && constructionCost > 0 && (
              <p className="text-[10px] text-teal-500 mt-1 text-center">{supervisionAmount.toLocaleString()}</p>
            )}
          </>
        )}
      </td>
      {/* Supervision gap — hidden for monthly_rate mode */}
      {supervisionType !== 'monthly_rate' ? (
        <td className="border border-slate-200 p-2 bg-purple-50">
          <Input
            type="number"
            value={supervisionGapInput}
            onChange={(e) => { editingRef.current = true; setSupervisionGapInput(e.target.value); }}
            onBlur={() => doSave()}
            className="text-center bg-purple-50 border-purple-300 text-purple-700 font-semibold text-xs"
            placeholder="0"
          />
          {fin?.cpaSupervisionGap > 0 && (
            <p className="text-[10px] text-purple-400 mt-1 text-center">CPA: {Number(fin.cpaSupervisionGap).toLocaleString()}</p>
          )}
        </td>
      ) : (
        <td className="border border-slate-200 p-2 bg-purple-50 text-center text-slate-400 text-xs">—</td>
      )}
      {/* Supervision total */}
      <td className="border border-slate-200 p-2 text-center font-bold text-sm bg-teal-100 text-teal-800">
        {supervisionTotal.toLocaleString()}
        <p className="text-[10px] font-normal text-teal-500">AED</p>
      </td>
      {/* Grand Total */}
      <td className="border border-slate-200 p-2 text-center font-bold text-sm bg-gradient-to-b from-amber-100 to-amber-50 text-amber-900 border-l-2 border-amber-400">
        {total.toLocaleString()}
        <p className="text-[10px] font-normal text-amber-600">AED</p>
      </td>

      {/* Proposal Link */}
      <td className="border border-slate-200 p-2">
        <div className="flex items-center gap-1">
          <Input
            value={proposalLink}
            onChange={(e) => { editingRef.current = true; setProposalLink(e.target.value); }}
            onBlur={() => doSave()}
            placeholder="رابط العرض"
            className="text-xs bg-white border-slate-300"
          />
          {proposalLink && (
            <a
              href={proposalLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 p-1"
              title="فتح العرض"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </td>
    </tr>
    <SupervisionRateDialog
      open={supervisionDialogOpen}
      onClose={(newTotal) => {
        setSupervisionDialogOpen(false);
        if (newTotal !== undefined) setMonthlyRateTotal(newTotal);
      }}
      fin={fin}
      projectDurationMonths={projectDurationMonths}
    />
    </>
  );
}

// BUA/Price fields with local state - saves on blur
function BuaPriceFields({ project, updateProjectMutation }: { project: any; updateProjectMutation: any }) {
  const [localBua, setLocalBua] = useState(String(project.bua || ''));
  const [localPrice, setLocalPrice] = useState(String(project.pricePerSqft || ''));
  const prevProjectId = useRef(project.id);

  useEffect(() => {
    if (project.id !== prevProjectId.current) {
      prevProjectId.current = project.id;
      setLocalBua(String(project.bua || ''));
      setLocalPrice(String(project.pricePerSqft || ''));
    }
  }, [project.id, project.bua, project.pricePerSqft]);

  const bua = parseFloat(localBua) || 0;
  const price = parseFloat(localPrice) || 0;
  const total = bua * price;

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="bg-gradient-to-br from-blue-50 to-white p-4 rounded-xl border border-blue-200">
        <p className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
          <Building className="w-4 h-4" />
          مساحة البناء (BUA)
        </p>
        <Input
          type="number"
          value={localBua}
          onChange={(e) => setLocalBua(e.target.value)}
          onBlur={() => {
            const val = parseFloat(localBua) || 0;
            updateProjectMutation.mutate({ id: project.id, bua: val });
          }}
          placeholder="مثلاً: 50000"
          className="text-lg font-bold bg-white border-blue-300"
        />
      </div>
      <div className="bg-gradient-to-br from-purple-50 to-white p-4 rounded-xl border border-purple-200">
        <p className="text-sm font-semibold text-purple-900 mb-2 flex items-center gap-2">
          <Target className="w-4 h-4" />
          سعر القدم المربع
        </p>
        <Input
          type="number"
          value={localPrice}
          onChange={(e) => setLocalPrice(e.target.value)}
          onBlur={() => {
            const val = parseFloat(localPrice) || 0;
            updateProjectMutation.mutate({ id: project.id, pricePerSqft: val });
          }}
          placeholder="مثلاً: 100"
          className="text-lg font-bold bg-white border-purple-300"
        />
      </div>
      <div className="bg-gradient-to-br from-emerald-50 to-white p-4 rounded-xl border border-emerald-200">
        <p className="text-sm font-semibold text-emerald-900 mb-2 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          إجمالي تكلفة البناء
        </p>
        <p className="text-2xl font-bold text-emerald-700">
          {total.toLocaleString()}
        </p>
        <p className="text-xs text-emerald-600 mt-1">AED</p>
      </div>
    </div>
  );
}

// Fee Deviation Zone Badge
function FeeDeviationBadge({ deviation, zone, flag }: { deviation: number; zone: string; flag: string | null }) {
  const zoneStyles: Record<string, string> = {
    normal: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    moderate_high: 'bg-amber-100 text-amber-800 border-amber-300',
    extreme_high: 'bg-red-100 text-red-800 border-red-300',
    extreme_low: 'bg-blue-100 text-blue-800 border-blue-300',
  };
  const zoneIcons: Record<string, any> = {
    normal: <CheckCircle2 className="w-3.5 h-3.5" />,
    moderate_high: <AlertTriangle className="w-3.5 h-3.5" />,
    extreme_high: <AlertTriangle className="w-3.5 h-3.5" />,
    extreme_low: <Shield className="w-3.5 h-3.5" />,
  };
  const zoneLabels: Record<string, string> = {
    normal: 'نطاق طبيعي',
    moderate_high: 'انحراف مرتفع معتدل',
    extreme_high: 'انحراف مرتفع جداً',
    extreme_low: 'انحراف منخفض جداً',
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border ${zoneStyles[zone] || zoneStyles.normal}`}>
        {zoneIcons[zone]}
        {deviation > 0 ? '+' : ''}{deviation.toFixed(1)}%
      </span>
      <span className="text-[10px] text-slate-500">{zoneLabels[zone]}</span>
      {flag && (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${zone === 'extreme_high' ? 'bg-red-200 text-red-800' : 'bg-blue-200 text-blue-800'}`}>
          {flag}
        </span>
      )}
    </div>
  );
}

export default function ConsultantEvaluationPage() {
  const { user, isAuthenticated } = useAuth();
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [newConsultantName, setNewConsultantName] = useState("");

  // Queries
  const projectsQuery = trpc.projects.list.useQuery();
  const projectDetailsQuery = trpc.projects.getWithDetails.useQuery(selectedProjectId || 0, {
    enabled: !!selectedProjectId,
  });
  const consultantsQuery = trpc.consultants.list.useQuery();
  const financialQuery = trpc.financial.getByProject.useQuery(selectedProjectId || 0, {
    enabled: !!selectedProjectId,
  });

  // Mutations
  const updateProjectMutation = trpc.projects.update.useMutation({
    onSuccess: () => {
      projectsQuery.refetch();
      projectDetailsQuery.refetch();
    },
  });

  const addConsultantMutation = trpc.projectConsultants.add.useMutation({
    onSuccess: () => {
      projectDetailsQuery.refetch();
    },
  });

  const removeConsultantFromProjectMutation = trpc.projectConsultants.remove.useMutation({
    onSuccess: () => {
      projectDetailsQuery.refetch();
    },
  });

  const createConsultantMutation = trpc.consultants.create.useMutation({
    onSuccess: () => {
      consultantsQuery.refetch();
      setNewConsultantName("");
    },
  });

  const deleteConsultantMutation = trpc.consultants.delete.useMutation({
    onSuccess: () => {
      consultantsQuery.refetch();
      projectDetailsQuery.refetch();
    },
  });

  const updateFinancialMutation = trpc.financial.upsert.useMutation({
    onSuccess: () => {
      financialQuery.refetch();
    },
  });

  // Calculate financial totals
  const financialTotals = useMemo(() => {
    if (!selectedProjectId) return {};
    const totals: Record<number, number> = {};
    const pConsultants = projectDetailsQuery.data?.consultants || [];
    const buildingCost = (projectDetailsQuery.data?.bua || 0) * (projectDetailsQuery.data?.pricePerSqft || 0);

    pConsultants.forEach((consultant: any) => {
      const fin = financialQuery.data?.find((f: any) => f.consultantId === consultant.id);
      if (fin) {
        const dv = parseFloat(String(fin.designValue)) || 0;
        const sv = parseFloat(String(fin.supervisionValue)) || 0;
        const designAmount = fin.designType === 'pct' ? buildingCost * (dv / 100) : dv;
        const supervisionAmount = fin.supervisionType === 'pct' ? buildingCost * (sv / 100) : sv;
        const designGap = Number(fin.designScopeGapCost || 0);
        const supervisionGap = Number(fin.supervisionScopeGapCost || 0);
        totals[consultant.id] = designAmount + designGap + supervisionAmount + supervisionGap;
      }
    });

    return totals;
  }, [selectedProjectId, projectDetailsQuery.data, financialQuery.data]);

  // Fee Deviation Analysis
  const feeDeviations = useMemo(() => {
    const fees = Object.entries(financialTotals).filter(([_, v]) => v > 0);
    if (fees.length === 0) return { average: 0, consultants: {} as Record<number, { deviation: number; zone: string; zoneLabel: string; penalty: number; flag: string | null }> };
    
    const average = fees.reduce((sum, [_, v]) => sum + v, 0) / fees.length;
    const consultants: Record<number, { deviation: number; zone: string; zoneLabel: string; penalty: number; flag: string | null }> = {};
    
    fees.forEach(([id, fee]) => {
      const deviation = ((fee - average) / average) * 100;
      let zone = 'normal';
      let zoneLabel = 'النطاق الطبيعي';
      let penalty = 0;
      let flag: string | null = null;

      if (deviation > 30) {
        zone = 'extreme_high';
        zoneLabel = 'انحراف مرتفع جداً';
        penalty = 0.15;
        flag = 'مخاطر تكلفة عالية';
      } else if (deviation > 15) {
        zone = 'moderate_high';
        zoneLabel = 'انحراف مرتفع معتدل';
        penalty = 0.07;
      } else if (deviation < -30) {
        zone = 'extreme_low';
        zoneLabel = 'انحراف منخفض جداً';
        flag = 'مخاطر سعر منخفض';
      }

      consultants[parseInt(id)] = { deviation: Math.round(deviation * 10) / 10, zone, zoneLabel, penalty, flag };
    });

    return { average: Math.round(average), consultants };
  }, [financialTotals]);

  // Rankings by financial (lowest fee first)
  const rankings = useMemo(() => {
    const pConsultants = projectDetailsQuery.data?.consultants || [];
    return pConsultants
      .map((c: any) => ({
        id: c.id,
        name: c.name,
        totalFee: financialTotals[c.id] || 0,
        feeDeviation: feeDeviations.consultants[c.id]?.deviation || 0,
        feeZone: feeDeviations.consultants[c.id]?.zone || 'normal',
        feeFlag: feeDeviations.consultants[c.id]?.flag || null,
      }))
      .sort((a, b) => (a.totalFee || Infinity) - (b.totalFee || Infinity));
  }, [projectDetailsQuery.data, financialTotals, feeDeviations]);

  const projects = projectsQuery.data || [];
  const consultants = consultantsQuery.data || [];
  const selectedProject = projects.find((p: any) => p.id === selectedProjectId);
  const projectConsultants = projectDetailsQuery.data?.consultants || [];

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
        <Card className="w-96 shadow-2xl border-0">
          <CardContent className="p-8 text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-slate-600">جارٍ التحميل...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-teal-50 p-4" dir="rtl">
      <div className="w-full max-w-none">
        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-3xl mb-8 shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700" />
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMSIgb3BhY2l0eT0iMC4xIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-20" />
          <div className="relative px-8 py-10">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <DollarSign className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white mb-1">الأتعاب المالية للاستشاريين</h1>
                <p className="text-emerald-100">إدارة وتسجيل أتعاب التصميم والإشراف لكل استشاري — البيانات تنعكس في مركز القيادة</p>
              </div>
            </div>
          </div>
        </div>

        {/* Project Selector */}
        <Card className="mb-6 shadow-lg border-0">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b py-4">
            <CardTitle className="flex items-center gap-2 text-slate-800 text-base">
              <Building className="w-5 h-5 text-emerald-600" />
              اختر المشروع
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex gap-3">
              <Select value={selectedProjectId?.toString() || ""} onValueChange={(value) => setSelectedProjectId(parseInt(value))}>
                <SelectTrigger className="flex-1 h-12 bg-white border-slate-300 text-lg">
                  <SelectValue placeholder="اختر مشروعاً" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project: any) => (
                    <SelectItem key={project.id} value={project.id.toString()}>{project.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {selectedProject && (
          <>
            {/* Project Info */}
            <Card className="mb-6 shadow-lg border-0">
              <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b py-4">
                <CardTitle className="text-xl text-slate-800">{selectedProject.name}</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <BuaPriceFields project={selectedProject} updateProjectMutation={updateProjectMutation} />
              </CardContent>
            </Card>

            {/* Consultants Management */}
            <Card className="mb-6 shadow-lg border-0">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b py-4">
                <CardTitle className="flex items-center gap-2 text-slate-800 text-base">
                  <Users className="w-5 h-5 text-teal-600" />
                  إدارة الاستشاريين للمشروع
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex gap-2 mb-4">
                  <Select onValueChange={(value) => {
                    const consultantId = parseInt(value);
                    if (!projectConsultants.find((c: any) => c.id === consultantId)) {
                      addConsultantMutation.mutate({ projectId: selectedProject.id, consultantId });
                    }
                  }}>
                    <SelectTrigger className="flex-1 bg-white border-slate-300">
                      <SelectValue placeholder="أضف استشاري للمشروع" />
                    </SelectTrigger>
                    <SelectContent>
                      {consultants.filter((c: any) => !projectConsultants.find((pc: any) => pc.id === c.id)).map((consultant: any) => (
                        <SelectItem key={consultant.id} value={consultant.id.toString()}>{consultant.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap gap-3">
                  {projectConsultants.map((consultant: any) => (
                    <div key={consultant.id} className="bg-gradient-to-r from-emerald-100 to-teal-100 text-slate-800 px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 shadow-sm">
                      {consultant.name}
                      <button onClick={() => {
                        if (confirm(`هل تريد إزالة ${consultant.name} من هذا المشروع؟`)) {
                          removeConsultantFromProjectMutation.mutate({ projectId: selectedProject.id, consultantId: consultant.id });
                        }
                      }} className="mr-1 text-red-500 hover:text-red-700 transition-colors" title="إزالة من المشروع">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Financial Fees Table */}
            {projectConsultants.length > 0 && (
              <Card className="shadow-xl border-0">
                <CardHeader className="bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 border-b">
                  <CardTitle className="flex items-center gap-2 text-slate-800 text-lg">
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                    الأتعاب المالية
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  {/* Fee Deviation Legend */}
                  <div className="bg-gradient-to-r from-slate-50 to-emerald-50 p-4 rounded-xl border border-slate-200 mb-6">
                    <h4 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-emerald-600" />
                      مناطق انحراف الأتعاب (Safety First)
                    </h4>
                    <div className="grid grid-cols-4 gap-3 text-xs">
                      <div className="bg-emerald-50 border border-emerald-200 p-2 rounded-lg">
                        <span className="font-bold text-emerald-800">النطاق الطبيعي</span>
                        <p className="text-emerald-600">±15% من المتوسط</p>
                      </div>
                      <div className="bg-amber-50 border border-amber-200 p-2 rounded-lg">
                        <span className="font-bold text-amber-800">انحراف مرتفع معتدل</span>
                        <p className="text-amber-600">+15% إلى +30%</p>
                      </div>
                      <div className="bg-red-50 border border-red-200 p-2 rounded-lg">
                        <span className="font-bold text-red-800">انحراف مرتفع جداً</span>
                        <p className="text-red-600">أكثر من +30%</p>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 p-2 rounded-lg">
                        <span className="font-bold text-blue-800">انحراف منخفض جداً</span>
                        <p className="text-blue-600">أقل من -30%</p>
                      </div>
                    </div>
                    {feeDeviations.average > 0 && (
                      <p className="mt-2 text-sm text-slate-600">متوسط الأتعاب: <span className="font-bold text-slate-800">{feeDeviations.average.toLocaleString()} AED</span></p>
                    )}
                  </div>

                  <div className="overflow-x-auto border-2 border-slate-200 rounded-2xl shadow-lg w-full">
                    <table className="border-collapse w-full" style={{tableLayout:'fixed'}}>
                      <thead>
                        {/* Two-level header: group header + column headers */}
                        <tr className="bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-700 text-white text-center text-xs font-bold">
                          <th className="border border-emerald-600 p-2" rowSpan={2} style={{ width: '14%' }}>الاستشاري</th>
                          <th className="border border-emerald-600 p-2 bg-blue-700" colSpan={4}>التصميم</th>
                          <th className="border border-emerald-600 p-2 bg-teal-700" colSpan={4}>الإشراف</th>
                          <th className="border border-emerald-600 p-2 bg-amber-600" rowSpan={2} style={{ width: '11%' }}>المجموع الكلي</th>
                          <th className="border border-emerald-600 p-2" rowSpan={2} style={{ width: '9%' }}>رابط العرض</th>
                        </tr>
                        <tr className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white text-center text-xs font-bold">
                          <th className="border border-emerald-700 p-1 bg-blue-600" style={{ width: '5%' }}>نوع</th>
                          <th className="border border-emerald-700 p-2 bg-blue-600" style={{ width: '10%' }}>أتعاب التصميم</th>
                          <th className="border border-emerald-700 p-2 bg-orange-600" style={{ width: '9%' }}>فجوة التصميم</th>
                          <th className="border border-emerald-700 p-2 bg-blue-800" style={{ width: '9%' }}>مجموع التصميم</th>
                          <th className="border border-emerald-700 p-1 bg-teal-600" style={{ width: '5%' }}>نوع</th>
                          <th className="border border-emerald-700 p-2 bg-teal-600" style={{ width: '10%' }}>أتعاب الإشراف</th>
                          <th className="border border-emerald-700 p-2 bg-purple-600" style={{ width: '9%' }}>فجوة الإشراف</th>
                          <th className="border border-emerald-700 p-2 bg-teal-800" style={{ width: '9%' }}>مجموع الإشراف</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white">
                        {[...projectConsultants]
                          .sort((a: any, b: any) => (financialTotals[a.id] || 0) - (financialTotals[b.id] || 0))
                          .map((consultant: any) => {
                            const fin = financialQuery.data?.find((f: any) => f.consultantId === consultant.id);
                            const buildingCost = (selectedProject?.bua || 0) * (selectedProject?.pricePerSqft || 0);
                            return (
                              <Fragment key={consultant.id}>
                                <FinancialRow
                                  consultant={consultant}
                                  fin={fin}
                                  selectedProjectId={selectedProjectId!}
                                  constructionCost={buildingCost}
                                  updateFinancialMutation={updateFinancialMutation}
                                  onTotalChange={() => {}}
                                  designScopeGapCost={fin?.designScopeGapCost || 0}
                                  projectDurationMonths={selectedProject?.constructionDurationMonths || 24}
                                />
                              </Fragment>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>

                  {/* Fee Deviation Summary Cards */}
                  {feeDeviations.average > 0 && (
                    <div className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {rankings.map((r) => {
                        const dev = feeDeviations.consultants[r.id];
                        if (!dev) return null;
                        return (
                          <div key={r.id} className="bg-white p-4 rounded-xl border-2 border-slate-200 shadow-md">
                            <h4 className="font-bold text-slate-800 text-sm mb-2">{r.name}</h4>
                            <p className="text-lg font-bold text-emerald-700">{r.totalFee.toLocaleString()} AED</p>
                            <FeeDeviationBadge deviation={dev.deviation} zone={dev.zone} flag={dev.flag} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {projectConsultants.length === 0 && (
              <Card className="shadow-lg border-0">
                <CardContent className="p-12 text-center">
                  <Users className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                  <h3 className="text-xl font-bold text-slate-600 mb-2">لا يوجد استشاريين</h3>
                  <p className="text-slate-500">أضف استشاريين للمشروع من القائمة أعلاه لبدء تسجيل الأتعاب المالية</p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
