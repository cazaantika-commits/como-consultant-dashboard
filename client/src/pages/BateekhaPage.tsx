import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight, ClipboardList, HardHat, Target, Settings, Calendar, TrendingDown, FileText, Building2, Briefcase } from "lucide-react";

type TabId = "general" | "construction" | "sales" | "settings" | "timeline" | "cashflows" | "feasibility" | "mall" | "portfolio";

const TABS: { id: TabId; label: string; icon: any; group: "input" | "output" }[] = [
  { id: "general", label: "المدخلات العامة", icon: ClipboardList, group: "input" },
  { id: "construction", label: "الإنشاء", icon: HardHat, group: "input" },
  { id: "sales", label: "المبيعات والتسويق", icon: Target, group: "input" },
  { id: "settings", label: "الإعدادات والقواعد", icon: Settings, group: "input" },
  { id: "timeline", label: "الجدول الزمني", icon: Calendar, group: "output" },
  { id: "cashflows", label: "التدفقات المالية", icon: TrendingDown, group: "output" },
  { id: "feasibility", label: "دراسة الجدوى", icon: FileText, group: "output" },
  { id: "mall", label: "المركز التجاري", icon: Building2, group: "output" },
  { id: "portfolio", label: "تجميع المشاريع", icon: Briefcase, group: "output" },
];

export default function BateekhaPage() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<TabId>("general");

  const inputTabs = TABS.filter(t => t.group === "input");
  const outputTabs = TABS.filter(t => t.group === "output");
  const currentTab = TABS.find(t => t.id === activeTab);

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-3">
          <button onClick={() => navigate("/")} className="p-2 rounded-lg hover:bg-gray-100 transition">
            <ArrowRight className="w-5 h-5 text-gray-600" />
          </button>
          <div className="h-5 w-px bg-gray-300" />
          <h1 className="text-lg font-bold text-gray-900">بطيخة</h1>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 flex gap-1 overflow-x-auto items-center">
          {/* Input Tabs */}
          {inputTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? "border-emerald-600 text-emerald-700"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}

          {/* Separator */}
          <div className="h-6 w-px bg-gray-300 mx-2" />

          {/* Output Tabs */}
          {outputTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content - Placeholder */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex flex-col items-center justify-center text-center gap-4">
          {currentTab && (
            <>
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
                <currentTab.icon className="w-8 h-8 text-gray-400" />
              </div>
              <h2 className="text-xl font-bold text-gray-800">{currentTab.label}</h2>
              <p className="text-sm text-gray-500">
                {currentTab.group === "input" ? "صفحة إدخال" : "صفحة مخرجات"}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
