import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight } from "lucide-react";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";

export default function ConsultantDashboardPage() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col" dir="rtl">
      {/* شريط علوي بسيط */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="text-white hover:bg-white/20"
          >
            <ArrowRight className="w-4 h-4 ml-1" />
            الرئيسية
          </Button>
          <span className="text-lg font-bold">تقييم الاستشاريين</span>
        </div>
        <span className="text-blue-100 text-sm">{user?.name}</span>
      </div>

      {/* الصفحة الأصلية كما هي */}
      <iframe
        src="/consultant-dashboard.html"
        className="flex-1 w-full border-0"
        style={{ minHeight: "calc(100vh - 52px)" }}
        title="لوحة تقييم الاستشاريين"
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-popups-to-escape-sandbox"
      />
    </div>
  );
}
