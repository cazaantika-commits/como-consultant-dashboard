import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Settings, User, Mail, Shield, Save, ArrowLeft, Info } from "lucide-react";
import { useLocation } from "wouter";

export default function ApprovalSettings() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: settings, isLoading, refetch } = trpc.approvalSettings.getAll.useQuery();
  const updateMutation = trpc.approvalSettings.update.useMutation({
    onSuccess: () => {
      toast({ title: "✅ تم الحفظ", description: "تم تحديث إعدادات الموافقة بنجاح" });
      refetch();
    },
    onError: (err) => {
      toast({ title: "❌ خطأ", description: err.message, variant: "destructive" });
    },
  });

  const [form, setForm] = useState({
    wael_name: "",
    wael_email: "",
    sheikh_name: "",
    sheikh_email: "",
    finance_emails: "",
    cc_emails: "",
  });

  useEffect(() => {
    if (settings) {
      setForm({
        wael_name: settings["wael_name"] || "وائل",
        wael_email: settings["wael_email"] || "wael@zooma.ae",
        sheikh_name: settings["sheikh_name"] || "الشيخ عيسى",
        sheikh_email: settings["sheikh_email"] || "issa@comodevelopments.com",
        finance_emails: settings["finance_emails"] || "shahid@zooma.ae,account.mrt@zooma.ae,thanseeh@globalhightrend.com",
        cc_emails: settings["cc_emails"] || "wael@zooma.ae,a.zaqout@comodevelopments.com",
      });
    }
  }, [settings]);

  const handleSave = () => {
    if (!form.wael_email || !form.sheikh_email || !form.finance_emails) {
      toast({ title: "⚠️ بيانات ناقصة", description: "يرجى ملء جميع الحقول الإلزامية", variant: "destructive" });
      return;
    }
    updateMutation.mutate(form);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6" dir="rtl">
      {/* Header */}
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/payment-requests")} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            العودة
          </Button>
        </div>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-[#1a3c5e] flex items-center justify-center">
            <Settings className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">إعدادات سير الموافقة</h1>
            <p className="text-gray-500 text-sm">تحديد المسؤولين عن الموافقة على طلبات الصرف وإشعار فريق المالية</p>
          </div>
        </div>

        {/* Info banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">كيف يعمل سير الموافقة؟</p>
            <p>عند إنشاء طلب صرف جديد: يُرسل بريد إلكتروني للمراجع الأول (وائل) ← عند موافقته يُرسل للمعتمد النهائي (الشيخ عيسى) ← عند اعتماده يُرسل أمر الصرف الرسمي لفريق المالية.</p>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-gray-400">جاري التحميل...</div>
        ) : (
          <div className="space-y-6">
            {/* First Approver - Wael */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                    <User className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base">المراجع الأول</CardTitle>
                    <CardDescription className="text-xs">يستلم الطلب أولاً ويوافق أو يرفض أو يطلب مراجعة</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">الاسم</Label>
                    <Input
                      value={form.wael_name}
                      onChange={e => setForm(f => ({ ...f, wael_name: e.target.value }))}
                      placeholder="مثال: وائل"
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">البريد الإلكتروني <span className="text-red-500">*</span></Label>
                    <Input
                      type="email"
                      value={form.wael_email}
                      onChange={e => setForm(f => ({ ...f, wael_email: e.target.value }))}
                      placeholder="wael@example.com"
                      className="text-sm"
                      dir="ltr"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Final Approver - Sheikh Issa */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#1a3c5e]/10 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-[#1a3c5e]" />
                  </div>
                  <div>
                    <CardTitle className="text-base">المعتمد النهائي</CardTitle>
                    <CardDescription className="text-xs">يعتمد الطلب نهائياً بعد مراجعة المراجع الأول — اعتماده يُطلق أمر الصرف لفريق المالية</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">الاسم</Label>
                    <Input
                      value={form.sheikh_name}
                      onChange={e => setForm(f => ({ ...f, sheikh_name: e.target.value }))}
                      placeholder="مثال: الشيخ عيسى"
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">البريد الإلكتروني <span className="text-red-500">*</span></Label>
                    <Input
                      type="email"
                      value={form.sheikh_email}
                      onChange={e => setForm(f => ({ ...f, sheikh_email: e.target.value }))}
                      placeholder="sheikh@example.com"
                      className="text-sm"
                      dir="ltr"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Finance Team */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                    <Mail className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base">فريق المالية</CardTitle>
                    <CardDescription className="text-xs">يستلمون أمر الصرف الرسمي بالإنجليزية عند الاعتماد النهائي</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">
                    بريد فريق المالية <span className="text-red-500">*</span>
                    <span className="text-gray-400 font-normal mr-2">(افصل بين الإيميلات بفاصلة)</span>
                  </Label>
                  <Input
                    value={form.finance_emails}
                    onChange={e => setForm(f => ({ ...f, finance_emails: e.target.value }))}
                    placeholder="finance1@example.com,finance2@example.com"
                    className="text-sm"
                    dir="ltr"
                  />
                  <p className="text-xs text-gray-400">
                    حالياً: {form.finance_emails.split(",").filter(Boolean).length} عنوان بريد
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">
                    نسخة (CC)
                    <span className="text-gray-400 font-normal mr-2">(اختياري — يستلمون نسخة من أمر الصرف)</span>
                  </Label>
                  <Input
                    value={form.cc_emails}
                    onChange={e => setForm(f => ({ ...f, cc_emails: e.target.value }))}
                    placeholder="cc1@example.com,cc2@example.com"
                    className="text-sm"
                    dir="ltr"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end pt-2">
              <Button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="gap-2 bg-[#1a3c5e] hover:bg-[#1a3c5e]/90 text-white px-8"
              >
                <Save className="w-4 h-4" />
                {updateMutation.isPending ? "جاري الحفظ..." : "حفظ الإعدادات"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
