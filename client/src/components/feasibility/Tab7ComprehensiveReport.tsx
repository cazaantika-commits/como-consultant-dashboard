import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Streamdown } from 'streamdown';

interface Tab7ComprehensiveReportProps {
  studyId?: number;
  projectId: number;
}

export default function Tab7ComprehensiveReport({ studyId, projectId }: Tab7ComprehensiveReportProps) {
  const [report, setReport] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch study data
  const { data: study } = trpc.feasibility.getById.useQuery(studyId || 0, {
    enabled: !!studyId,
  });

  // Load report
  useEffect(() => {
    if (study?.competitorAnalysis) {
      setReport(study.competitorAnalysis);
    }
  }, [study]);

  // Generate comprehensive report
  const generateReportMutation = trpc.feasibility.generateComprehensiveReport.useMutation({
    onSuccess: (data) => {
      setReport(data.report);
      toast.success('تم إنشاء التقرير الشامل بنجاح');
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
            📄 التقرير الشامل المهني
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
              توليد التقرير الشامل
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
              <p className="text-sm">اضغط على الزر أعلاه لتوليد تقرير شامل واحترافي بـ AI</p>
            </div>
          )}

          {/* Report Features */}
          <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <h4 className="font-semibold text-slate-900 mb-3">محتويات التقرير الشامل:</h4>
            <ul className="space-y-2 text-sm text-slate-700">
              <li>✓ ملخص تنفيذي شامل</li>
              <li>✓ تحليل السوق والمنافسة</li>
              <li>✓ تقييم المخاطر والفرص</li>
              <li>✓ الإسقاطات المالية المفصلة</li>
              <li>✓ توصيات استراتيجية</li>
              <li>✓ جداول ورسوم بيانية توضيحية</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
