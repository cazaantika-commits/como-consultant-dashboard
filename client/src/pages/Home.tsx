import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, BarChart3, ClipboardList, TrendingUp, FileText, Building2, HardDrive, Bot } from "lucide-react";
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
            <CardTitle className="text-center text-2xl">مركز قيادة كومو</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-gray-600">
              منظومة إدارة رقمية متكاملة لمشاريع التطوير العقاري
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
            <h1 className="text-3xl font-bold">مركز قيادة كومو</h1>
            <p className="text-blue-100">مرحباً {user?.name || "بك"}</p>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* تقييم الاستشاريين - الصفحة الأصلية */}
          <Card
            className="cursor-pointer hover:shadow-lg transition-all border-2 border-blue-200 hover:border-blue-400"
            onClick={() => navigate("/consultant-dashboard")}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-700">
                <BarChart3 className="w-6 h-6" />
                تقييم الاستشاريين
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                مقارنة وتقييم الاستشاريين الهندسيين — الأتعاب المالية والتقييم الفني والنتائج
              </p>
            </CardContent>
          </Card>

          {/* الملفات التعريفية للاستشاريين */}
          <Card
            className="cursor-pointer hover:shadow-lg transition-all border-2 border-emerald-200 hover:border-emerald-400"
            onClick={() => navigate("/consultant-profiles")}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-700">
                <Building2 className="w-6 h-6" />
                الملفات التعريفية للاستشاريين
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                عرض تفصيلي لكل استشاري مع ملاحظات خاصة ونقاط القوة والضعف
              </p>
            </CardContent>
          </Card>

          {/* مستعرض الملفات - Google Drive */}
          <Card
            className="cursor-pointer hover:shadow-lg transition-all border-2 border-purple-200 hover:border-purple-400"
            onClick={() => navigate("/drive")}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-700">
                <HardDrive className="w-6 h-6" />
                مستعرض الملفات
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                تصفح وإدارة ملفات Google Drive — المجلدات والمستندات والعروض التقديمية
              </p>
            </CardContent>
          </Card>

          {/* صفحات مستقبلية */}
          <Card className="cursor-pointer hover:shadow-lg transition-all opacity-60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-500">
                <TrendingUp className="w-6 h-6" />
                دراسات الجدوى
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-400">قريباً — تحليل الجدوى المالية للمشاريع</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-all opacity-60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-500">
                <FileText className="w-6 h-6" />
                دراسة السوق
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-400">قريباً — تحليل السوق العقاري</p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-lg transition-all border-2 border-amber-200 hover:border-amber-400"
            onClick={() => navigate("/tasks")}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-700">
                <ClipboardList className="w-6 h-6" />
                لوحة المهام
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                إدارة ومتابعة مهام المشاريع — إدخال يدوي وذكي من الوكلاء
              </p>
            </CardContent>
          </Card>

          {/* لوحة تحكم الوكلاء */}
          <Card
            className="cursor-pointer hover:shadow-lg transition-all border-2 border-indigo-200 hover:border-indigo-400"
            onClick={() => navigate("/agent-dashboard")}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-indigo-700">
                <Bot className="w-6 h-6" />
                لوحة تحكم الوكلاء
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                متابعة مهام قاسم وسلوى — فلترة حسب الوكيل والحالة مع سجل النشاط
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
