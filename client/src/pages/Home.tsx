import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, BarChart3, Users, Settings } from "lucide-react";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";

export default function Home() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [, navigate] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4" dir="rtl">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-2xl">لوحة تحكم تقييم الاستشاريين</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-gray-600">
              نظام متكامل لإدارة وتقييم الاستشاريين الهندسيين في مشاريع التطوير العقاري
            </p>
            <Button
              onClick={() => (window.location.href = getLoginUrl())}
              className="w-full"
              size="lg"
            >
              تسجيل الدخول
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100" dir="rtl">
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">لوحة التحكم الرئيسية</h1>
            <p className="text-blue-100">مرحبا {user?.name || "بك"}</p>
          </div>
          <Button
            variant="outline"
            onClick={() => logout()}
            className="text-white border-white hover:bg-white hover:text-blue-600"
          >
            تسجيل الخروج
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card
            className="cursor-pointer hover:shadow-lg transition-all"
            onClick={() => navigate("/dashboard")}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                لوحة التحكم
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                إدارة المشاريع والاستشاريين وتنظيم البيانات الأساسية
              </p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-lg transition-all"
            onClick={() => navigate("/evaluation")}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                التقييم والمقارنة
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                تقييم الاستشاريين فنيا وماليا والمقارنة بينهم
              </p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-all">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                الإعدادات
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                إدارة الإعدادات والتكوينات
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
