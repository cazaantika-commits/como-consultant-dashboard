import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, HardHat, Activity, ClipboardList, Calendar, Eye, BarChart2 } from "lucide-react";
import DevelopmentStagesPage from "./DevelopmentStagesPage";
import ActivityMonitorPage from "./ActivityMonitorPage";
import ExecutionDashboardPage from "./ExecutionDashboardPage";

type View = "icons" | "development-stages" | "activity-monitor" | "execution-dashboard";

const SECTIONS = [
  {
    id: "development-stages" as View,
    label: "مراحل التطوير",
    icon: HardHat,
    gradient: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
    shadow: "rgba(139, 92, 246, 0.3)",
    borderColor: "#8b5cf6",
  },
  {
    id: "activity-monitor" as View,
    label: "مراقبة التنفيذ",
    icon: Activity,
    gradient: "linear-gradient(135deg, #f97316, #ea580c)",
    shadow: "rgba(249, 115, 22, 0.3)",
    borderColor: "#f97316",
  },
  {
    id: "execution-dashboard" as View,
    label: "لوحة الأداء",
    icon: BarChart2,
    gradient: "linear-gradient(135deg, #06b6d4, #0891b2)",
    shadow: "rgba(6, 182, 212, 0.3)",
    borderColor: "#06b6d4",
  },
];

export default function DevelopmentPhasesPage() {
  const [, navigate] = useLocation();
  const [activeView, setActiveView] = useState<View>("icons");

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-3">
          {activeView === "icons" ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1.5">
                <ArrowRight className="w-4 h-4" />
                الرئيسية
              </Button>
              <div className="h-5 w-px bg-border" />
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center">
                  <HardHat className="w-3.5 h-3.5 text-white" />
                </div>
                <h1 className="text-sm font-bold text-foreground">مراحل التطوير</h1>
              </div>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => setActiveView("icons")} className="gap-1.5">
                <ArrowRight className="w-4 h-4" />
                العودة
              </Button>
              <div className="h-5 w-px bg-border" />
              <div className="flex items-center gap-2">
                {(() => {
                  const config = SECTIONS.find(c => c.id === activeView);
                  return config ? (
                    <>
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ background: config.gradient }}
                      >
                        <config.icon className="w-3.5 h-3.5 text-white" />
                      </div>
                      <h1 className="text-sm font-bold text-foreground">{config.label}</h1>
                    </>
                  ) : null;
                })()}
              </div>
            </>
          )}
        </div>
      </header>

      {/* Icons View */}
      {activeView === "icons" && (
        <main className="max-w-2xl mx-auto px-6 py-12">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-foreground mb-2">مراحل التطوير</h2>
            <p className="text-sm text-muted-foreground">متابعة التنفيذ والجداول الزمنية</p>
          </div>

          <div className="grid grid-cols-3 gap-5">
            {SECTIONS.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className="group relative flex flex-col items-center text-center p-6 rounded-2xl bg-card border border-border/50 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 active:scale-[0.98] overflow-hidden"
              >
                {/* Top colored accent */}
                <div
                  className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl"
                  style={{ backgroundColor: item.borderColor }}
                />

                {/* Icon */}
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3 shadow-lg group-hover:scale-110 transition-transform duration-300"
                  style={{ background: item.gradient, boxShadow: `0 8px 24px ${item.shadow}` }}
                >
                  <item.icon className="w-8 h-8 text-white" />
                </div>

                {/* Label only */}
                <h3 className="text-sm font-bold text-foreground leading-tight">{item.label}</h3>
              </button>
            ))}
          </div>
        </main>
      )}

      {/* Content Views */}
      {activeView === "development-stages" && <DevelopmentStagesPage embedded />}
      {activeView === "activity-monitor" && (
        <main className="py-1">
          <ActivityMonitorPage />
        </main>
      )}
      {activeView === "execution-dashboard" && (
        <main className="py-1">
          <ExecutionDashboardPage />
        </main>
      )}
    </div>
  );
}
