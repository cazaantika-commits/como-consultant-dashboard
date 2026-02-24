import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Building2, FileText, Rocket, Sparkles } from "lucide-react";
import FactSheetPage from "./FactSheetPage";

type Tab = "fact-sheet" | "coming-soon";

export default function ProjectManagementPage() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>("fact-sheet");

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

      {/* Tabs */}
      <div className="border-b border-border bg-card/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab("fact-sheet")}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "fact-sheet"
                  ? "border-amber-500 text-amber-700 dark:text-amber-400"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                بطاقة بيانات المشروع
              </div>
            </button>
            <button
              onClick={() => setActiveTab("coming-soon")}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "coming-soon"
                  ? "border-emerald-500 text-emerald-700 dark:text-emerald-400"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              <div className="flex items-center gap-2">
                <Rocket className="w-4 h-4" />
                أدوات إضافية
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {activeTab === "fact-sheet" && (
        <FactSheetPage embedded />
      )}

      {activeTab === "coming-soon" && (
        <main className="max-w-3xl mx-auto px-6 py-24 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-xl shadow-emerald-500/25 mb-8">
            <Rocket className="w-10 h-10 text-white" />
          </div>

          <h2 className="text-3xl font-extrabold text-foreground mb-4">
            قريباً
          </h2>

          <p className="text-lg text-muted-foreground leading-relaxed mb-6 max-w-lg mx-auto">
            نعمل على تطوير أدوات إضافية لإدارة المشاريع بشكل أكثر شمولية
          </p>

          <div className="flex flex-wrap gap-3 justify-center mb-10">
            {[
              "متابعة المشاريع",
              "الجدول الزمني",
              "الميزانيات",
              "فريق العمل",
              "التقارير الذكية",
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
        </main>
      )}
    </div>
  );
}
