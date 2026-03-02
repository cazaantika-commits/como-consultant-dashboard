import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Streamdown } from 'streamdown';

interface Tab8ExecutiveReportProps {
  studyId?: number;
  projectId: number;
}

export default function Tab8ExecutiveReport({ studyId, projectId }: Tab8ExecutiveReportProps) {
  const [report, setReport] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch study data
  const { data: study } = trpc.feasibility.getById.useQuery(studyId || 0, {
    enabled: !!studyId,
  });

  // Load report
  useEffect(() => {
    if (study?.priceRecommendation) {
      setReport(study.priceRecommendation);
    }
  }, [study]);

  // Generate executive report
  const generateReportMutation = trpc.feasibility.generateExecutiveReport.useMutation({
    onSuccess: (data) => {
      setReport(data.report);
      toast.success('تم إنشاء التقرير المختصر بنجاح');
    },
    onError: (error) => {
      toast.error(error.message || 'خطأ في إنشاء التقرير');
    },
  });

  const handleGenerateReport = async () => {
    if (!studyId) {
      toast.error('يجب تحديد الدراسة أولاً');
      return;
    }
    setIsGenerating(true);
    try {
      await generateReportMutation.mutateAsync({ id: studyId });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPDF = () => {
    toast.info('سيتم إضافة خاصية التحميل قريباً');
  };

  return (
    <div className="space-y-6" dir="rtl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            📋 التقرير المختصر لمجلس الإدارة
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Action Buttons */}
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={handleGenerateReport}
              disabled={isGenerating || generateReportMutation.isPending}
              className="gap-2"
            >
              {isGenerating || generateReportMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              توليد التقرير المختصر
            </Button>
            <Button
              onClick={handleDownloadPDF}
              variant="outline"
              className="gap-2"
              disabled={!report}
            >
              <Download className="w-4 h-4" />
              تحميل PDF
            </Button>
          </div>

          {/* Report Content */}
          {report ? (
            <div className="space-y-4 prose prose-sm max-w-none dark:prose-invert">
              <Streamdown>{report}</Streamdown>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <p className="mb-4">لم يتم إنشاء تقرير بعد</p>
              <p className="text-sm">اضغط على الزر أعلاه لتوليد تقرير مختصر وموجز لمجلس الإدارة</p>
            </div>
          )}

          {/* Report Features */}
          <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <h4 className="font-semibold text-slate-900 mb-3">محتويات التقرير المختصر:</h4>
            <ul className="space-y-2 text-sm text-slate-700">
              <li>✓ ملخص تنفيذي (1-2 صفحة)</li>
              <li>✓ النقاط الرئيسية والتوصيات</li>
              <li>✓ المؤشرات المالية الأساسية</li>
              <li>✓ تقييم المخاطر الرئيسية</li>
              <li>✓ الخطوات التالية المقترحة</li>
              <li>✓ جداول ملخصة</li>
            </ul>
          </div>

          {/* Key Metrics Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="p-3 bg-green-50 rounded border border-green-200">
              <p className="text-xs text-green-600 mb-1">العائد على الاستثمار</p>
              <p className="text-lg font-bold text-green-900">19.5%</p>
            </div>
            <div className="p-3 bg-blue-50 rounded border border-blue-200">
              <p className="text-xs text-blue-600 mb-1">هامش الربح</p>
              <p className="text-lg font-bold text-blue-900">13.1%</p>
            </div>
            <div className="p-3 bg-purple-50 rounded border border-purple-200">
              <p className="text-xs text-purple-600 mb-1">حصة COMO</p>
              <p className="text-lg font-bold text-purple-900">15%</p>
            </div>
            <div className="p-3 bg-amber-50 rounded border border-amber-200">
              <p className="text-xs text-amber-600 mb-1">المدة الزمنية</p>
              <p className="text-lg font-bold text-amber-900">36 شهر</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
