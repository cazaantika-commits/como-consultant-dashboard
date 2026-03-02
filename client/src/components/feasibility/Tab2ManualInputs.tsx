import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Tab2ManualInputsProps {
  studyId?: number;
  projectId: number;
}

export default function Tab2ManualInputs({ studyId, projectId }: Tab2ManualInputsProps) {
  const [formData, setFormData] = useState({
    soilInvestigation: '',
    topographySurvey: '',
    authoritiesFee: '',
    constructionCostPerSqft: '',
    communityFee: '',
    designFeePct: '',
    supervisionFeePct: '',
    separationFeePerM2: '',
    contingenciesPct: '',
    developerFeePct: '',
    agentCommissionSalePct: '',
    marketingPct: '',
    numberOfUnits: '',
    estimatedBua: '',
  });

  const [isSaving, setIsSaving] = useState(false);

  // Fetch study data
  const { data: study } = trpc.feasibility.getById.useQuery(studyId || 0, {
    enabled: !!studyId,
  });

  // Load study data
  useEffect(() => {
    if (study) {
      setFormData({
        soilInvestigation: study.soilInvestigation?.toString() || '',
        topographySurvey: study.topographySurvey?.toString() || '',
        authoritiesFee: study.authoritiesFee?.toString() || '',
        constructionCostPerSqft: study.constructionCostPerSqft?.toString() || '',
        communityFee: study.communityFee?.toString() || '',
        designFeePct: study.designFeePct?.toString() || '',
        supervisionFeePct: study.supervisionFeePct?.toString() || '',
        separationFeePerM2: study.separationFeePerM2?.toString() || '',
        contingenciesPct: study.contingenciesPct?.toString() || '',
        developerFeePct: study.developerFeePct?.toString() || '',
        agentCommissionSalePct: study.agentCommissionSalePct?.toString() || '',
        marketingPct: study.marketingPct?.toString() || '',
        numberOfUnits: study.numberOfUnits?.toString() || '',
        estimatedBua: study.estimatedBua?.toString() || '',
      });
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSave = async () => {
    if (!studyId) {
      toast.error('يجب تحديد الدراسة أولاً');
      return;
    }

    setIsSaving(true);
    try {
      await updateMutation.mutateAsync({
        id: studyId,
        soilInvestigation: formData.soilInvestigation ? parseInt(formData.soilInvestigation) : null,
        topographySurvey: formData.topographySurvey ? parseInt(formData.topographySurvey) : null,
        authoritiesFee: formData.authoritiesFee ? parseInt(formData.authoritiesFee) : null,
        constructionCostPerSqft: formData.constructionCostPerSqft ? parseInt(formData.constructionCostPerSqft) : null,
        communityFee: formData.communityFee ? parseInt(formData.communityFee) : null,
        designFeePct: formData.designFeePct ? parseInt(formData.designFeePct) : null,
        supervisionFeePct: formData.supervisionFeePct ? parseInt(formData.supervisionFeePct) : null,
        separationFeePerM2: formData.separationFeePerM2 ? parseInt(formData.separationFeePerM2) : null,
        contingenciesPct: formData.contingenciesPct ? parseInt(formData.contingenciesPct) : null,
        developerFeePct: formData.developerFeePct ? parseInt(formData.developerFeePct) : null,
        agentCommissionSalePct: formData.agentCommissionSalePct ? parseInt(formData.agentCommissionSalePct) : null,
        marketingPct: formData.marketingPct ? parseInt(formData.marketingPct) : null,
        numberOfUnits: formData.numberOfUnits ? parseInt(formData.numberOfUnits) : null,
        estimatedBua: formData.estimatedBua ? parseInt(formData.estimatedBua) : null,
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
            📝 الإدخالات اليدوية
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Costs Section */}
          <div>
            <h3 className="font-semibold mb-4 text-slate-900">التكاليف الإضافية</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>فحص التربة (درهم)</Label>
                <Input
                  name="soilInvestigation"
                  type="number"
                  value={formData.soilInvestigation}
                  onChange={handleChange}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>المسح الطبوغرافي (درهم)</Label>
                <Input
                  name="topographySurvey"
                  type="number"
                  value={formData.topographySurvey}
                  onChange={handleChange}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>رسوم الجهات الحكومية (درهم)</Label>
                <Input
                  name="authoritiesFee"
                  type="number"
                  value={formData.authoritiesFee}
                  onChange={handleChange}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>رسوم المجتمع (درهم)</Label>
                <Input
                  name="communityFee"
                  type="number"
                  value={formData.communityFee}
                  onChange={handleChange}
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {/* Construction Section */}
          <div>
            <h3 className="font-semibold mb-4 text-slate-900">تكاليف البناء</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>تكلفة البناء لكل قدم² (درهم)</Label>
                <Input
                  name="constructionCostPerSqft"
                  type="number"
                  value={formData.constructionCostPerSqft}
                  onChange={handleChange}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>المساحة المقدرة للبناء (قدم²)</Label>
                <Input
                  name="estimatedBua"
                  type="number"
                  value={formData.estimatedBua}
                  onChange={handleChange}
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {/* Fees Percentages */}
          <div>
            <h3 className="font-semibold mb-4 text-slate-900">النسب المئوية للرسوم</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>أتعاب التصميم (%)</Label>
                <Input
                  name="designFeePct"
                  type="number"
                  value={formData.designFeePct}
                  onChange={handleChange}
                  placeholder="2"
                />
              </div>
              <div>
                <Label>أتعاب الإشراف (%)</Label>
                <Input
                  name="supervisionFeePct"
                  type="number"
                  value={formData.supervisionFeePct}
                  onChange={handleChange}
                  placeholder="2"
                />
              </div>
              <div>
                <Label>احتياطي (%)</Label>
                <Input
                  name="contingenciesPct"
                  type="number"
                  value={formData.contingenciesPct}
                  onChange={handleChange}
                  placeholder="2"
                />
              </div>
              <div>
                <Label>أتعاب المطور (%)</Label>
                <Input
                  name="developerFeePct"
                  type="number"
                  value={formData.developerFeePct}
                  onChange={handleChange}
                  placeholder="5"
                />
              </div>
              <div>
                <Label>عمولة البيع (%)</Label>
                <Input
                  name="agentCommissionSalePct"
                  type="number"
                  value={formData.agentCommissionSalePct}
                  onChange={handleChange}
                  placeholder="5"
                />
              </div>
              <div>
                <Label>التسويق (%)</Label>
                <Input
                  name="marketingPct"
                  type="number"
                  value={formData.marketingPct}
                  onChange={handleChange}
                  placeholder="2"
                />
              </div>
            </div>
          </div>

          {/* Other Section */}
          <div>
            <h3 className="font-semibold mb-4 text-slate-900">معلومات أخرى</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>رسوم الفصل لكل م² (درهم)</Label>
                <Input
                  name="separationFeePerM2"
                  type="number"
                  value={formData.separationFeePerM2}
                  onChange={handleChange}
                  placeholder="40"
                />
              </div>
              <div>
                <Label>عدد الوحدات</Label>
                <Input
                  name="numberOfUnits"
                  type="number"
                  value={formData.numberOfUnits}
                  onChange={handleChange}
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-2">
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
              حفظ التغييرات
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
