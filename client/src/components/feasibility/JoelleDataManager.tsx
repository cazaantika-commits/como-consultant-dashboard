import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Database, Globe, BarChart3, Building2, FileText, MapPin,
  Users, RefreshCw, CheckCircle2, AlertTriangle, Clock,
  ExternalLink, Upload, Info, Loader2, ChevronDown, ChevronUp,
} from "lucide-react";
import { Streamdown } from "streamdown";

const JOEL_AVATAR = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663200809965/mCOkEovAXTtxsABs.png";

// Data source configuration
const DATA_SOURCES = [
  {
    id: 'google_maps',
    name: 'Google Maps / Places API',
    nameAr: 'خرائط جوجل',
    icon: MapPin,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    status: 'connected' as const,
    weight: 'متغير',
    description: 'بيانات جغرافية، مرافق قريبة، مسافات، تقييمات',
    howToConnect: 'متصل تلقائياً عبر النظام',
  },
  {
    id: 'dxb_interact',
    name: 'DXB Interact (DLD)',
    nameAr: 'دبي إنتراكت',
    icon: Building2,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    status: 'manual' as const,
    weight: '30%',
    description: 'بيانات المعاملات الرسمية من دائرة الأراضي والأملاك',
    howToConnect: 'يتم إدخال البيانات يدوياً من الموقع الرسمي أو عبر API مستقبلاً',
  },
  {
    id: 'property_monitor',
    name: 'Property Monitor',
    nameAr: 'بروبرتي مونيتور',
    icon: BarChart3,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    status: 'manual' as const,
    weight: '20%',
    description: 'اتجاهات الأسعار، حجم العرض، تحليل السوق',
    howToConnect: 'يحتاج اشتراك — يتم رفع التقارير يدوياً',
  },
  {
    id: 'data_finder',
    name: 'DataFinder',
    nameAr: 'داتا فايندر',
    icon: Database,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    status: 'manual' as const,
    weight: '20%',
    description: 'بيانات المبيعات والإيجارات التفصيلية',
    howToConnect: 'يحتاج اشتراك — يتم رفع التقارير يدوياً',
  },
  {
    id: 'property_finder',
    name: 'Property Finder',
    nameAr: 'بروبرتي فايندر',
    icon: Globe,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    status: 'manual' as const,
    weight: '10%',
    description: 'أسعار الطلب، القوائم النشطة، بيانات السوق',
    howToConnect: 'يتم جمع البيانات يدوياً من الموقع',
  },
  {
    id: 'bayut',
    name: 'Bayut',
    nameAr: 'بيوت',
    icon: Globe,
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
    status: 'manual' as const,
    weight: '10%',
    description: 'أسعار القوائم، بيانات الإيجارات',
    howToConnect: 'يتم جمع البيانات يدوياً من الموقع',
  },
  {
    id: 'market_reports',
    name: 'Market Reports (CBRE/JLL/Knight Frank)',
    nameAr: 'تقارير السوق',
    icon: FileText,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    status: 'manual' as const,
    weight: '10%',
    description: 'تقارير CBRE، JLL، Knight Frank، Savills — اتجاهات كلية',
    howToConnect: 'يتم رفع ملفات PDF للتقارير يدوياً',
  },
];

// Engine descriptions for the data flow
const ENGINE_DATA_FLOW = [
  { engine: 1, name: 'جمع البيانات', inputs: 'بطاقة المشروع + بيانات الأرض', outputs: 'ملف المشروع الكامل' },
  { engine: 2, name: 'تحليل سياق المنطقة', inputs: 'Google Places API', outputs: 'ديموغرافيا + بنية تحتية + مرافق' },
  { engine: 3, name: 'تحليل هيكل السوق', inputs: 'بيانات المعاملات + LLM', outputs: 'حجم السوق + اتجاهات الأسعار' },
  { engine: 4, name: 'خريطة المنافسين', inputs: 'Google Places + LLM', outputs: 'مشاريع منافسة + أسعار + مزيج وحدات' },
  { engine: 5, name: 'توقعات الطلب', inputs: 'نتائج المحركات 1-4', outputs: 'حجم الطلب + توزيع + حصة سوقية' },
  { engine: 6, name: 'استراتيجية المنتج', inputs: 'نتائج المحركات 1-5', outputs: 'مزيج الوحدات + المساحات + التموضع' },
  { engine: 7, name: 'ذكاء التسعير', inputs: 'نتائج المحركات 1-6', outputs: '3 سيناريوهات تسعير + تحليل حساسية' },
  { engine: 8, name: 'محرك الامتصاص', inputs: 'نتائج المحركات 5-7', outputs: 'سرعة البيع + جدول المبيعات' },
  { engine: 9, name: 'ذكاء المخاطر', inputs: 'جميع المحركات السابقة', outputs: '5 فئات مخاطر + مؤشر المخاطر' },
  { engine: 10, name: 'مصالحة البيانات', inputs: 'جميع المحركات', outputs: 'تحقق متعدد المصادر + أوزان' },
  { engine: 11, name: 'توليد المخرجات', inputs: 'نتائج المحركات 1-10', outputs: 'تعبئة حقول النظام تلقائياً' },
  { engine: 12, name: 'توليد التقارير', inputs: 'جميع المخرجات', outputs: '7 تقارير احترافية' },
];

export default function JoelleDataManager({ projectId, community }: { projectId: number | null; community: string }) {
  const [expandedSource, setExpandedSource] = useState<string | null>(null);
  const [expandedStage, setExpandedStage] = useState<number | null>(null);

  // Query all stages to show their data
  const stagesQuery = trpc.joelleEngine.getStages.useQuery(
    projectId || 0,
    { enabled: !!projectId }
  );

  const reportsQuery = trpc.joelleEngine.getReports.useQuery(
    projectId || 0,
    { enabled: !!projectId }
  );

  if (!projectId) {
    return (
      <div className="text-center py-16 bg-muted/20 rounded-xl border border-dashed border-border">
        <Database className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
        <p className="text-sm font-medium text-muted-foreground">اختر مشروع لعرض بيانات جويل</p>
      </div>
    );
  }

  const stagesData = stagesQuery.data || [];
  const reportsData = reportsQuery.data || [];
  const completedStages = stagesData.filter((s: any) => s.stageStatus === 'completed').length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-2 border-emerald-200/50 bg-gradient-to-l from-emerald-50/50 to-teal-50/50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 mb-4">
            <img src={JOEL_AVATAR} alt="Joelle" className="w-14 h-14 rounded-full border-2 border-emerald-300/50 shadow-md" />
            <div>
              <h2 className="text-xl font-bold text-foreground">📦 بيانات محرك جويل</h2>
              <p className="text-sm text-muted-foreground">
                مصادر البيانات • تدفق المحركات • نتائج التحليل
                {community && <span className="text-emerald-600 font-medium"> — {community}</span>}
              </p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white/80 rounded-lg p-3 border border-emerald-100">
              <div className="text-2xl font-bold text-emerald-600">{completedStages}/12</div>
              <div className="text-xs text-muted-foreground">محركات مكتملة</div>
            </div>
            <div className="bg-white/80 rounded-lg p-3 border border-violet-100">
              <div className="text-2xl font-bold text-violet-600">{reportsData.length}/7</div>
              <div className="text-xs text-muted-foreground">تقارير مُنشأة</div>
            </div>
            <div className="bg-white/80 rounded-lg p-3 border border-green-100">
              <div className="text-2xl font-bold text-green-600">1</div>
              <div className="text-xs text-muted-foreground">مصادر متصلة</div>
            </div>
            <div className="bg-white/80 rounded-lg p-3 border border-amber-100">
              <div className="text-2xl font-bold text-amber-600">6</div>
              <div className="text-xs text-muted-foreground">مصادر يدوية</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Sources */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border">
            <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
              <Database className="w-4.5 h-4.5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">مصادر البيانات</h3>
              <p className="text-xs text-muted-foreground">نظام الأوزان: DXB Interact 30% • DataFinder 20% • Property Monitor 20% • DLD 10% • Property Finder 10% • Bayut 5% • تقارير 5%</p>
            </div>
          </div>

          <div className="space-y-2">
            {DATA_SOURCES.map(source => {
              const Icon = source.icon;
              const isExpanded = expandedSource === source.id;
              return (
                <div key={source.id} className="border border-border rounded-lg overflow-hidden">
                  <div
                    className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/20 transition-colors"
                    onClick={() => setExpandedSource(isExpanded ? null : source.id)}
                  >
                    <div className={`w-9 h-9 rounded-lg ${source.bgColor} flex items-center justify-center shrink-0`}>
                      <Icon className={`w-4.5 h-4.5 ${source.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground">{source.nameAr}</span>
                        <span className="text-[10px] text-muted-foreground">{source.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{source.description}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        الوزن: {source.weight}
                      </span>
                      {source.status === 'connected' ? (
                        <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> متصل
                        </span>
                      ) : (
                        <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3" /> يدوي
                        </span>
                      )}
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="border-t border-border p-3 bg-muted/10">
                      <div className="flex items-start gap-2">
                        <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm text-foreground">{source.howToConnect}</p>
                          {source.status === 'manual' && (
                            <p className="text-xs text-muted-foreground mt-2">
                              💡 حالياً جويل تستخدم معرفة الذكاء الاصطناعي العامة + Google Places كبديل. لتحسين الدقة، يُنصح بربط هذا المصدر مستقبلاً.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Engine Data Flow */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border">
            <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center">
              <BarChart3 className="w-4.5 h-4.5 text-purple-600" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">تدفق بيانات المحركات</h3>
              <p className="text-xs text-muted-foreground">12 محرك تحليلي — كل محرك يبني على نتائج المحركات السابقة</p>
            </div>
          </div>

          <div className="space-y-1.5">
            {ENGINE_DATA_FLOW.map(flow => {
              const stageData = stagesData.find((s: any) => s.stageNumber === flow.engine);
              const isCompleted = stageData?.stageStatus === 'completed';
              const isError = stageData?.stageStatus === 'error';
              const isExpanded = expandedStage === flow.engine;

              return (
                <div key={flow.engine} className={`border rounded-lg overflow-hidden transition-colors ${
                  isCompleted ? 'border-emerald-200 bg-emerald-50/30' :
                  isError ? 'border-red-200 bg-red-50/30' :
                  'border-border'
                }`}>
                  <div
                    className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/20 transition-colors"
                    onClick={() => setExpandedStage(isExpanded ? null : flow.engine)}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                      isCompleted ? 'bg-emerald-100 text-emerald-700' :
                      isError ? 'bg-red-100 text-red-700' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {flow.engine}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground">{flow.name}</span>
                        {isCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                        {isError && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                      </div>
                      <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                        <span>📥 {flow.inputs}</span>
                        <span>→</span>
                        <span>📤 {flow.outputs}</span>
                      </div>
                    </div>
                    {stageData?.stageOutput && (
                      isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                  </div>
                  {isExpanded && stageData?.stageOutput && (
                    <div className="border-t border-border p-4 bg-white/50">
                      <div className="prose prose-sm max-w-none" dir="rtl">
                        <Streamdown>{stageData.stageOutput}</Streamdown>
                      </div>
                      {stageData.completedAt && (
                        <div className="mt-2 text-[10px] text-muted-foreground/60">
                          اكتمل: {new Date(stageData.completedAt).toLocaleDateString('ar-AE', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Source Weighting System Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border">
            <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="w-4.5 h-4.5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">نظام الأوزان والمصالحة</h3>
              <p className="text-xs text-muted-foreground">كيف تحسب جويل المتوسط المرجح من مصادر متعددة</p>
            </div>
          </div>

          <div className="bg-muted/20 rounded-xl p-4 border border-border" dir="rtl">
            <div className="prose prose-sm max-w-none">
              <Streamdown>{`### منهجية المصالحة

عند توفر بيانات من مصادر متعددة، تستخدم جويل **المتوسط المرجح** (Weighted Average) لحساب القيم النهائية:

| المصدر | الوزن | النوع |
|--------|-------|-------|
| DXB Interact (DLD) | 30% | معاملات رسمية |
| DataFinder | 20% | بيانات مبيعات وإيجارات |
| Property Monitor | 20% | اتجاهات وتحليل |
| DLD المباشر | 10% | بيانات رسمية |
| Property Finder | 10% | أسعار طلب |
| Bayut | 5% | أسعار قوائم |
| تقارير السوق | 5% | اتجاهات كلية |

**حدود التباين المسموحة:**
- إذا تجاوز الفرق بين أعلى وأدنى مصدر **15%** → يتم تفعيل تنبيه
- إذا تجاوز **25%** → يتم استبعاد المصدر الشاذ وإعادة الحساب

> **ملاحظة حالية:** جويل تعتمد حالياً على Google Maps/Places API (متصل) ومعرفة الذكاء الاصطناعي العامة. كلما تم ربط مصادر بيانات إضافية، تزداد دقة التحليل بشكل ملحوظ.`}</Streamdown>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
