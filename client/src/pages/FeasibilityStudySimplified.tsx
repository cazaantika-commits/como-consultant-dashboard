import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, TrendingUp, DollarSign, Home } from "lucide-react";

export default function FeasibilityStudySimplified() {
  const [projectName, setProjectName] = useState("");
  const [location, setLocation] = useState("");
  const [plotArea, setPlotArea] = useState("");
  const [gfa, setGfa] = useState("");

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto"
      >
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">دراسة الجدوى</h1>
          <p className="text-gray-600">تحليل شامل لجدوى المشاريع العقارية</p>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
            <TabsTrigger value="financial">التحليل المالي</TabsTrigger>
            <TabsTrigger value="market">دراسة السوق</TabsTrigger>
            <TabsTrigger value="technical">الجدوى الفنية</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Home className="w-5 h-5" />
                  بيانات المشروع
                </CardTitle>
                <CardDescription>أدخل المعلومات الأساسية للمشروع</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">اسم المشروع</label>
                    <Input
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder="مثال: ند الشبا"
                      className="text-right"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">الموقع</label>
                    <Input
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="مثال: دبي"
                      className="text-right"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">مساحة الأرض (م²)</label>
                    <Input
                      value={plotArea}
                      onChange={(e) => setPlotArea(e.target.value)}
                      placeholder="0"
                      type="number"
                      className="text-right"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">GFA (م²)</label>
                    <Input
                      value={gfa}
                      onChange={(e) => setGfa(e.target.value)}
                      placeholder="0"
                      type="number"
                      className="text-right"
                    />
                  </div>
                </div>
                <Button className="w-full">حفظ البيانات</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="financial" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  التحليل المالي
                </CardTitle>
                <CardDescription>تفاصيل التكاليف والإيرادات المتوقعة</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm text-gray-600">إجمالي التكاليف</p>
                      <p className="text-2xl font-bold text-blue-600">د.إ 0</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <p className="text-sm text-gray-600">الإيرادات المتوقعة</p>
                      <p className="text-2xl font-bold text-green-600">د.إ 0</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="market" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  دراسة السوق
                </CardTitle>
                <CardDescription>تحليل العرض والطلب والأسعار</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">سيتم إضافة تحليل السوق هنا</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="technical" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  الجدوى الفنية
                </CardTitle>
                <CardDescription>تقييم الجوانب الفنية والقانونية</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">سيتم إضافة التقييم الفني هنا</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
