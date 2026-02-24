import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Building2, Rocket, Sparkles } from "lucide-react";

export default function ProjectManagementPage() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1.5">
            <ArrowRight className="w-4 h-4" />
            الرئيسية
          </Button>
          <div className="h-6 w-px bg-border" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-base font-bold text-foreground">إدارة المشاريع</h1>
          </div>
        </div>
      </header>

      {/* Coming Soon Content */}
      <main className="max-w-3xl mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-xl shadow-emerald-500/25 mb-8">
          <Rocket className="w-10 h-10 text-white" />
        </div>

        <h2 className="text-3xl font-extrabold text-foreground mb-4">
          قريباً
        </h2>

        <p className="text-lg text-muted-foreground leading-relaxed mb-6 max-w-lg mx-auto">
          نعمل على تطوير نظام إدارة مشاريع متكامل وذكي يجمع كل أدوات المتابعة والتخطيط في مكان واحد
        </p>

        <div className="flex flex-wrap gap-3 justify-center mb-10">
          {[
            "متابعة المشاريع",
            "الجدول الزمني",
            "الميزانيات",
            "فريق العمل",
            "التقارير الذكية",
            "بطاقة بيانات المشروع",
          ].map((feature, i) => (
            <span
              key={i}
              className="text-sm px-4 py-2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {feature}
            </span>
          ))}
        </div>

        <Button
          size="lg"
          variant="outline"
          onClick={() => navigate("/")}
          className="gap-2"
        >
          <ArrowRight className="w-4 h-4" />
          العودة للرئيسية
        </Button>
      </main>
    </div>
  );
}
