import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, BarChart3, PieChart } from "lucide-react";

export default function ProjectCashFlowSimplified() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto"
      >
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">التدفق النقدي</h1>
          <p className="text-gray-600">إدارة وتحليل التدفقات النقدية للمشاريع</p>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
            <TabsTrigger value="monthly">التنبؤ الشهري</TabsTrigger>
            <TabsTrigger value="analysis">التحليل</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <TrendingUp className="w-8 h-8 mx-auto mb-2 text-green-600" />
                    <p className="text-sm text-gray-600">إجمالي الإيرادات</p>
                    <p className="text-2xl font-bold text-green-600">د.إ 0</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <BarChart3 className="w-8 h-8 mx-auto mb-2 text-red-600" />
                    <p className="text-sm text-gray-600">إجمالي المصروفات</p>
                    <p className="text-2xl font-bold text-red-600">د.إ 0</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <PieChart className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                    <p className="text-sm text-gray-600">صافي التدفق</p>
                    <p className="text-2xl font-bold text-blue-600">د.إ 0</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="monthly" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>التنبؤ الشهري</CardTitle>
                <CardDescription>توقعات التدفق النقدي الشهري</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">سيتم عرض البيانات الشهرية هنا</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analysis" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>التحليل</CardTitle>
                <CardDescription>تحليل التدفقات والاتجاهات</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">سيتم عرض التحليل التفصيلي هنا</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
