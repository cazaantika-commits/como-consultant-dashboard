import { ArrowRight, Layers, TrendingUp, Calendar, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  embedded?: boolean;
  onBack?: () => void;
}

export default function CapitalSchedulingPage({ embedded, onBack }: Props) {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {!embedded && (
        <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
              <ArrowRight className="w-4 h-4" />
              العودة
            </Button>
            <div className="h-5 w-px bg-border" />
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}
              >
                <Layers className="w-3.5 h-3.5 text-white" />
              </div>
              <h1 className="text-sm font-bold text-foreground">مشاريع كومو - جدولة رأس المال</h1>
            </div>
          </div>
        </header>
      )}

      <main className="max-w-4xl mx-auto px-6 py-16 text-center">
        <div
          className="w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl"
          style={{
            background: "linear-gradient(135deg, #f97316, #ea580c)",
            boxShadow: "0 16px 48px rgba(249, 115, 22, 0.35)",
          }}
        >
          <Layers className="w-12 h-12 text-white" />
        </div>

        <h2 className="text-3xl font-bold text-foreground mb-3">مشاريع كومو</h2>
        <p className="text-lg text-orange-500 font-semibold mb-6">جدولة رأس المال</p>
        <p className="text-sm text-muted-foreground max-w-lg mx-auto mb-12">
          عرض شامل لجميع مشاريع كومو مع جدولة احتياجات رأس المال لكل مشروع شهرياً، وإمكانية تعديل مراحل المشاريع وتأجيلها أو تسريعها حسب الحاجة.
        </p>

        <div className="grid grid-cols-3 gap-5 max-w-2xl mx-auto">
          {[
            { icon: TrendingUp, label: "عرض جميع المشاريع", desc: "مقارنة احتياجات رأس المال لكل مشروع" },
            { icon: Calendar, label: "الجدول الزمني", desc: "توزيع الاحتياجات شهرياً على مدة المشروع" },
            { icon: DollarSign, label: "تعديل المراحل", desc: "تأجيل أو تسريع مراحل المشاريع" },
          ].map((f, i) => (
            <div
              key={i}
              className="p-5 rounded-2xl bg-card border border-border/50 flex flex-col items-center text-center gap-3"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}
              >
                <f.icon className="w-6 h-6 text-white" />
              </div>
              <p className="text-sm font-bold text-foreground">{f.label}</p>
              <p className="text-[11px] text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground mt-10 opacity-60">قيد التطوير — سيتم الإعلان عن الإطلاق قريباً</p>
      </main>
    </div>
  );
}
