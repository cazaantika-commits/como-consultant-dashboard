import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, TrendingUp, Users, FileText } from "lucide-react";

export default function ProjectLifecycleSimplified() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-yellow-100 p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto"
      >
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">دورة حياة المشروع</h1>
          <p className="text-gray-600">إدارة شاملة لكل مراحل المشروع من البداية إلى النهاية</p>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <FileText className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                <p className="text-sm text-gray-600">المستندات</p>
                <p className="text-2xl font-bold">0</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Users className="w-8 h-8 mx-auto mb-2 text-green-600" />
                <p className="text-sm text-gray-600">الفريق</p>
                <p className="text-2xl font-bold">0</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <TrendingUp className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                <p className="text-sm text-gray-600">التقدم</p>
                <p className="text-2xl font-bold">0%</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <BarChart3 className="w-8 h-8 mx-auto mb-2 text-red-600" />
                <p className="text-sm text-gray-600">المخاطر</p>
                <p className="text-2xl font-bold">0</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
            <TabsTrigger value="team">الفريق</TabsTrigger>
            <TabsTrigger value="documents">المستندات</TabsTrigger>
            <TabsTrigger value="risks">المخاطر</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>نظرة عامة على المشروع</CardTitle>
                <CardDescription>ملخص شامل لحالة المشروع</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">سيتم عرض النظرة العامة هنا</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="team" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>فريق المشروع</CardTitle>
                <CardDescription>أعضاء الفريق والأدوار</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">سيتم عرض فريق المشروع هنا</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>المستندات</CardTitle>
                <CardDescription>جميع مستندات المشروع</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">سيتم عرض المستندات هنا</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="risks" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>إدارة المخاطر</CardTitle>
                <CardDescription>تقييم وإدارة مخاطر المشروع</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">سيتم عرض تقييم المخاطر هنا</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
