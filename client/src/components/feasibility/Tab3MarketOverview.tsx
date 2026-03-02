import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Save, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Streamdown } from 'streamdown';

interface Tab3MarketOverviewProps {
  studyId?: number;
  projectId: number;
}

export default function Tab3MarketOverview({ studyId, projectId }: Tab3MarketOverviewProps) {
  const [formData, setFormData] = useState({
    residentialSalePrice: '',
    retailSalePrice: '',
    officesSalePrice: '',
    marketAnalysis: '',
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
        residentialSalePrice: study.residentialSalePrice?.toString() || '',
        retailSalePrice: study.retailSalePrice?.toString() || '',
        officesSalePrice: study.officesSalePrice?.toString() || '',
        marketAnalysis: study.marketAnalysis || '',
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

  // Generate AI analysis
  const generateAnalysisMutation = trpc.feasibility.generateMarketAnalysis.useMutation({
    onSuccess: (data) => {
      setFormData((prev) => ({
        ...prev,
        marketAnalysis: data.analysis,
      }));
      toast.success('تم إنشاء التحليل بنجاح');
    },
    onError: (error) => {
      toast.error(error.message || 'خطأ في إنشاء التحليل');
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
        residentialSalePrice: formData.residentialSalePrice ? parseInt(formData.residentialSalePrice) : null,
        retailSalePrice: formData.retailSalePrice ? parseInt(formData.retailSalePrice) : null,
        officesSalePrice: formData.officesSalePrice ? parseInt(formData.officesSalePrice) : null,
        marketAnalysis: formData.marketAnalysis,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateAnalysis = async () => {
    if (!studyId) {
      toast.error('يجب تحديد الدراسة أولاً');
      return;
    }
    await generateAnalysisMutation.mutateAsync({ id: studyId });
  };

  return (
    <div className="space-y-6" dir="rtl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🌍 النظرة العامة والسوق
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Sale Prices */}
          <div>
            <h3 className="font-semibold mb-4 text-slate-900">أسعار البيع المقترحة</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>سعر البيع - سكني (درهم/قدم²)</Label>
                <Input
                  name="residentialSalePrice"
                  type="number"
                  value={formData.residentialSalePrice}
                  onChange={handleChange}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>سعر البيع - تجاري (درهم/قدم²)</Label>
                <Input
                  name="retailSalePrice"
                  type="number"
                  value={formData.retailSalePrice}
                  onChange={handleChange}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>سعر البيع - مكاتب (درهم/قدم²)</Label>
                <Input
                  name="officesSalePrice"
                  type="number"
                  value={formData.officesSalePrice}
                  onChange={handleChange}
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {/* Market Analysis */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">تحليل السوق</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={handleGenerateAnalysis}
                disabled={generateAnalysisMutation.isPending}
                className="gap-2"
              >
                {generateAnalysisMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                توليد بـ AI
              </Button>
            </div>
            <Textarea
              name="marketAnalysis"
              value={formData.marketAnalysis}
              onChange={handleChange}
              placeholder="تحليل السوق والاتجاهات..."
              rows={8}
              className="font-sans"
            />
            {formData.marketAnalysis && (
              <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-600 mb-2">معاينة التحليل:</p>
                <Streamdown>{formData.marketAnalysis}</Streamdown>
              </div>
            )}
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
