import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Streamdown } from 'streamdown';

interface Tab6AnalysisProps {
  studyId?: number;
  projectId: number;
}

export default function Tab6Analysis({ studyId, projectId }: Tab6AnalysisProps) {
  const [analysis, setAnalysis] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch study data
  const { data: study } = trpc.feasibility.getById.useQuery(studyId || 0, {
    enabled: !!studyId,
  });

  // Load analysis
  useEffect(() => {
    if (study?.aiSummary) {
      setAnalysis(study.aiSummary);
    }
  }, [study]);

  // Generate AI analysis
  const generateAnalysisMutation = trpc.feasibility.generateAiSummary.useMutation({
    onSuccess: (data) => {
      setAnalysis(data.summary);
      toast.success('تم إنشاء التحليل بنجاح');
    },
    onError: (error) => {
      toast.error(error.message || 'خطأ في إنشاء التحليل');
    },
  });

  const handleGenerateAnalysis = async () => {
    if (!studyId) {
      toast.error('يجب تحديد الدراسة أولاً');
      return;
    }
    setIsGenerating(true);
    try {
      await generateAnalysisMutation.mutateAsync({ id: studyId });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🔍 التحليل والسيناريوهات
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Generate Button */}
          <div className="flex gap-2">
            <Button
              onClick={handleGenerateAnalysis}
              disabled={isGenerating || generateAnalysisMutation.isPending}
              className="gap-2"
            >
              {isGenerating || generateAnalysisMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              توليد التحليل بـ AI
            </Button>
          </div>

          {/* Analysis Content */}
          {analysis ? (
            <div className="space-y-4">
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <Streamdown>{analysis}</Streamdown>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <p className="mb-4">لم يتم إنشاء تحليل بعد</p>
              <p className="text-sm">اضغط على الزر أعلاه لتوليد تحليل شامل بـ AI</p>
            </div>
          )}

          {/* Sub-sections Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-semibold text-blue-900 mb-2">التحليل والمخاطر</h4>
              <p className="text-sm text-blue-800">تقييم شامل للمخاطر والفرص</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <h4 className="font-semibold text-green-900 mb-2">تحليل السيناريوهات</h4>
              <p className="text-sm text-green-800">مقارنة السيناريوهات الثلاثة</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <h4 className="font-semibold text-purple-900 mb-2">سجل المصادر</h4>
              <p className="text-sm text-purple-800">مصادر البيانات والافتراضات</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
