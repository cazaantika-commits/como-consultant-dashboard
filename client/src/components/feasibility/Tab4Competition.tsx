import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle } from 'lucide-react';

interface Tab4CompetitionProps {
  studyId?: number;
  projectId: number;
}

export default function Tab4Competition({ studyId, projectId }: Tab4CompetitionProps) {
  const [scenarios] = useState([
    {
      id: 'optimistic',
      name: 'السيناريو المتفائل',
      description: 'أفضل حالة - بيع سريع وأسعار عالية',
      color: 'bg-green-50 border-green-200',
      metrics: {
        salesVelocity: '100%',
        priceMultiplier: '1.15x',
        marketShare: '25%',
        timeline: '24 شهر',
      },
    },
    {
      id: 'baseline',
      name: 'السيناريو الأساسي',
      description: 'حالة متوسطة - بيع معتدل وأسعار عادية',
      color: 'bg-blue-50 border-blue-200',
      metrics: {
        salesVelocity: '75%',
        priceMultiplier: '1.0x',
        marketShare: '15%',
        timeline: '36 شهر',
      },
    },
    {
      id: 'conservative',
      name: 'السيناريو المحافظ',
      description: 'أسوأ حالة - بيع بطيء وأسعار منخفضة',
      color: 'bg-amber-50 border-amber-200',
      metrics: {
        salesVelocity: '50%',
        priceMultiplier: '0.85x',
        marketShare: '10%',
        timeline: '48 شهر',
      },
    },
  ]);

  const [activeScenario, setActiveScenario] = useState('baseline');

  const currentScenario = useMemo(
    () => scenarios.find((s) => s.id === activeScenario),
    [activeScenario, scenarios]
  );

  return (
    <div className="space-y-6" dir="rtl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            💰 المنافسة والتسعير
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Scenario Tabs */}
          <Tabs value={activeScenario} onValueChange={setActiveScenario}>
            <TabsList className="grid w-full grid-cols-3">
              {scenarios.map((scenario) => (
                <TabsTrigger key={scenario.id} value={scenario.id}>
                  {scenario.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {scenarios.map((scenario) => (
              <TabsContent key={scenario.id} value={scenario.id} className="space-y-4">
                <div className={`p-4 rounded-lg border-2 ${scenario.color}`}>
                  <h3 className="font-semibold text-slate-900 mb-2">{scenario.name}</h3>
                  <p className="text-sm text-slate-600 mb-4">{scenario.description}</p>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white/50 p-3 rounded">
                      <p className="text-xs text-slate-600">سرعة البيع</p>
                      <p className="font-bold text-slate-900">{scenario.metrics.salesVelocity}</p>
                    </div>
                    <div className="bg-white/50 p-3 rounded">
                      <p className="text-xs text-slate-600">معامل السعر</p>
                      <p className="font-bold text-slate-900">{scenario.metrics.priceMultiplier}</p>
                    </div>
                    <div className="bg-white/50 p-3 rounded">
                      <p className="text-xs text-slate-600">حصة السوق</p>
                      <p className="font-bold text-slate-900">{scenario.metrics.marketShare}</p>
                    </div>
                    <div className="bg-white/50 p-3 rounded">
                      <p className="text-xs text-slate-600">المدة الزمنية</p>
                      <p className="font-bold text-slate-900">{scenario.metrics.timeline}</p>
                    </div>
                  </div>
                </div>

                {/* Payment Plan */}
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3">خطة السداد</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded">
                      <span className="text-sm text-slate-600">الدفعة الأولى (العقد)</span>
                      <span className="font-semibold text-slate-900">10%</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded">
                      <span className="text-sm text-slate-600">الدفعة الثانية (الأساسات)</span>
                      <span className="font-semibold text-slate-900">20%</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded">
                      <span className="text-sm text-slate-600">الدفعة الثالثة (الهيكل)</span>
                      <span className="font-semibold text-slate-900">30%</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded">
                      <span className="text-sm text-slate-600">الدفعة الرابعة (الإنهاء)</span>
                      <span className="font-semibold text-slate-900">30%</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-blue-50 rounded border border-blue-200">
                      <span className="font-semibold text-slate-900">المجموع</span>
                      <span className="font-bold text-blue-600">100%</span>
                    </div>
                  </div>
                </div>

                {/* Competitive Positioning */}
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3">الموضع التنافسي</h4>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-slate-600">جودة البناء</span>
                        <span className="text-sm font-semibold">85%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div className="bg-blue-500 h-2 rounded-full" style={{ width: '85%' }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-slate-600">الموقع الاستراتيجي</span>
                        <span className="text-sm font-semibold">90%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div className="bg-blue-500 h-2 rounded-full" style={{ width: '90%' }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-slate-600">السعر التنافسي</span>
                        <span className="text-sm font-semibold">75%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div className="bg-blue-500 h-2 rounded-full" style={{ width: '75%' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>

          {/* Note */}
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              هذه السيناريوهات توفر إطار عمل شامل لتقييم الأداء المحتمل للمشروع تحت ظروف مختلفة.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
