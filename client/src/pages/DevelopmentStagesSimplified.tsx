import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, Circle, Clock } from "lucide-react";

const stages = [
  { name: "التأسيس ودراسة الجدوى", status: "completed", icon: CheckCircle2 },
  { name: "الإعداد القانوني", status: "in-progress", icon: Clock },
  { name: "التصميم والتصاريح", status: "pending", icon: Circle },
  { name: "المقاولات والتنفيذ", status: "pending", icon: Circle },
  { name: "التسليم والإدارة", status: "pending", icon: Circle },
];

export default function DevelopmentStagesSimplified() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto"
      >
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">مراحل التطوير</h1>
          <p className="text-gray-600">تتبع مراحل تطوير المشروع من البداية إلى النهاية</p>
        </div>

        <div className="space-y-4 mb-8">
          {stages.map((stage, index) => {
            const Icon = stage.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className={`${
                  stage.status === "completed" ? "bg-green-50" :
                  stage.status === "in-progress" ? "bg-blue-50" :
                  "bg-gray-50"
                }`}>
                  <CardContent className="pt-6 flex items-center gap-4">
                    <Icon className={`w-6 h-6 ${
                      stage.status === "completed" ? "text-green-600" :
                      stage.status === "in-progress" ? "text-blue-600" :
                      "text-gray-400"
                    }`} />
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{stage.name}</h3>
                      <p className="text-sm text-gray-600">
                        {stage.status === "completed" && "مكتملة"}
                        {stage.status === "in-progress" && "قيد التنفيذ"}
                        {stage.status === "pending" && "قيد الانتظار"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="details">التفاصيل</TabsTrigger>
            <TabsTrigger value="timeline">الجدول الزمني</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>تفاصيل المراحل</CardTitle>
                <CardDescription>معلومات مفصلة عن كل مرحلة</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">سيتم عرض التفاصيل هنا</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="timeline" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>الجدول الزمني</CardTitle>
                <CardDescription>توقيت تنفيذ كل مرحلة</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">سيتم عرض الجدول الزمني هنا</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
