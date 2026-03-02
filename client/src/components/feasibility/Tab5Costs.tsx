import { useState, useEffect, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Tab5CostsProps {
  studyId?: number;
  projectId: number;
}

function fmt(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '0';
  return Math.round(n).toLocaleString('en-US');
}

export default function Tab5Costs({ studyId, projectId }: Tab5CostsProps) {
  const [constructionCostPerSqft, setConstructionCostPerSqft] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Fetch study data
  const { data: study } = trpc.feasibility.getById.useQuery(studyId || 0, {
    enabled: !!studyId,
  });

  // Load study data
  useEffect(() => {
    if (study) {
      setConstructionCostPerSqft(study.constructionCostPerSqft?.toString() || '');
    }
  }, [study]);

  // Update mutation
  const updateMutation = trpc.feasibility.update.useMutation({
    onSuccess: () => {
      toast.success('تم حفظ البيانات بنجاح');
    },
    onError: (error) => {
      toast.error(error.message || 'خطأ في الحفظ');
    },
  });

  // Calculate financial metrics
  const calculations = useMemo(() => {
    if (!study) return null;

    const bua = study.estimatedBua || 0;
    const costPerSqft = parseInt(constructionCostPerSqft) || 0;
    const constructionCost = bua * costPerSqft;

    const gfaRes = study.gfaResidential || 0;
    const gfaRet = study.gfaRetail || 0;
    const gfaOff = study.gfaOffices || 0;

    const saleableRes = gfaRes * ((study.saleableResidentialPct || 90) / 100);
    const saleableRet = gfaRet * ((study.saleableRetailPct || 99) / 100);
    const saleableOff = gfaOff * ((study.saleableOfficesPct || 90) / 100);

    const revenueRes = saleableRes * (study.residentialSalePrice || 0);
    const revenueRet = saleableRet * (study.retailSalePrice || 0);
    const revenueOff = saleableOff * (study.officesSalePrice || 0);
    const totalRevenue = revenueRes + revenueRet + revenueOff;

    const landReg = (study.landPrice || 0) * 0.04;
    const agentLand = (study.landPrice || 0) * ((study.agentCommissionLandPct || 1) / 100);
    const designFee = constructionCost * ((study.designFeePct || 2) / 100);
    const supervisionFee = constructionCost * ((study.supervisionFeePct || 2) / 100);
    const separationFee = (study.plotAreaM2 || 0) * (study.separationFeePerM2 || 40);
    const contingencies = constructionCost * ((study.contingenciesPct || 2) / 100);
    const reraUnits = (study.numberOfUnits || 0) * (study.reraUnitFee || 850);
    const fixedFees =
      (study.reraOffplanFee || 150000) +
      (study.nocFee || 10000) +
      (study.escrowFee || 140000) +
      (study.bankCharges || 20000) +
      (study.surveyorFees || 12000) +
      (study.reraAuditFees || 18000) +
      (study.reraInspectionFees || 70000);

    const devFee = totalRevenue * ((study.developerFeePct || 5) / 100);
    const agentSale = totalRevenue * ((study.agentCommissionSalePct || 5) / 100);
    const marketing = totalRevenue * ((study.marketingPct || 2) / 100);

    const totalCosts =
      (study.landPrice || 0) +
      landReg +
      agentLand +
      constructionCost +
      designFee +
      supervisionFee +
      separationFee +
      contingencies +
      reraUnits +
      fixedFees +
      (study.soilInvestigation || 0) +
      (study.topographySurvey || 0) +
      (study.authoritiesFee || 0) +
      (study.communityFee || 0) +
      devFee +
      agentSale +
      marketing;

    const profit = totalRevenue - totalCosts;
    const fundingRequired = totalCosts - constructionCost * 0.65;
    const comoProfit = profit * ((study.comoProfitSharePct || 15) / 100);
    const investorProfit = profit - comoProfit;
    const roi = fundingRequired > 0 ? (investorProfit / fundingRequired) * 100 : 0;
    const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

    return {
      totalRevenue,
      totalCosts,
      profit,
      fundingRequired,
      comoProfit,
      investorProfit,
      roi,
      profitMargin,
      constructionCost,
    };
  }, [study, constructionCostPerSqft]);

  const handleSave = async () => {
    if (!studyId) {
      toast.error('يجب تحديد الدراسة أولاً');
      return;
    }

    setIsSaving(true);
    try {
      await updateMutation.mutateAsync({
        id: studyId,
        constructionCostPerSqft: constructionCostPerSqft ? parseInt(constructionCostPerSqft) : null,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            📊 التكاليف والتدفقات
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Editable Input */}
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
            <Label className="text-base font-semibold mb-2 block">سعر البناء لكل قدم² (درهم)</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                value={constructionCostPerSqft}
                onChange={(e) => setConstructionCostPerSqft(e.target.value)}
                placeholder="0"
                className="flex-1"
              />
              <Button
                onClick={handleSave}
                disabled={isSaving || updateMutation.isPending}
                className="gap-2"
              >
                {isSaving || updateMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                حفظ
              </Button>
            </div>
          </div>

          {/* Financial Summary - READ ONLY */}
          {calculations && (
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-900 text-lg">الملخص المالي</h3>

              {/* Revenue Section */}
              <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                <h4 className="font-semibold text-green-900 mb-3">الإيرادات</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-600">إجمالي الإيرادات</span>
                    <span className="font-bold text-green-600">{fmt(calculations.totalRevenue)} درهم</span>
                  </div>
                </div>
              </div>

              {/* Costs Section */}
              <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                <h4 className="font-semibold text-red-900 mb-3">التكاليف</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-600">إجمالي التكاليف</span>
                    <span className="font-bold text-red-600">{fmt(calculations.totalCosts)} درهم</span>
                  </div>
                </div>
              </div>

              {/* Profit Section */}
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-3">الربح والعائد</h4>
                <div className="space-y-2">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-slate-600">الربح الإجمالي</span>
                    <span className="font-bold text-blue-600">{fmt(calculations.profit)} درهم</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-slate-600">هامش الربح</span>
                    <span className="font-bold text-blue-600">{calculations.profitMargin.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-slate-600">التمويل المطلوب</span>
                    <span className="font-bold text-blue-600">{fmt(calculations.fundingRequired)} درهم</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-600">العائد على الاستثمار (ROI)</span>
                    <span className="font-bold text-blue-600">{calculations.roi.toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              {/* COMO Share Section */}
              <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg">
                <h4 className="font-semibold text-purple-900 mb-3">حصة COMO</h4>
                <div className="space-y-2">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-slate-600">حصة COMO من الربح</span>
                    <span className="font-bold text-purple-600">{fmt(calculations.comoProfit)} درهم</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-600">حصة المستثمر</span>
                    <span className="font-bold text-purple-600">{fmt(calculations.investorProfit)} درهم</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!calculations && (
            <div className="text-center py-8 text-slate-500">
              <p>جاري تحميل البيانات...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
