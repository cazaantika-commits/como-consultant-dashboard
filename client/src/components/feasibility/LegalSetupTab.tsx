import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface LegalSetupTabProps {
  projectId: number | null;
}

export function LegalSetupTab({ projectId }: LegalSetupTabProps) {
  const [form, setForm] = useState<Record<string, any>>({});
  const [recordId, setRecordId] = useState<number | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Fetch legal setup record
  const { data: record } = trpc.legalSetup.listByProject.useQuery(projectId || 0, {
    enabled: !!projectId,
  });

  useEffect(() => {
    if (record && record.length > 0) {
      setForm(record[0]);
      setRecordId(record[0].id);
    }
  }, [record]);

  // Create mutation
  const createMutation = trpc.legalSetup.create.useMutation({
    onSuccess: (data) => {
      setRecordId(data.id);
      setIsDirty(false);
      toast.success('تم إنشاء السجل القانوني بنجاح');
    },
  });

  // Update mutation
  const updateMutation = trpc.legalSetup.update.useMutation({
    onSuccess: () => {
      setIsDirty(false);
      toast.success('تم حفظ التغييرات بنجاح');
    },
  });

  const handleChange = (field: string, value: any) => {
    setForm((prev: Record<string, any>) => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (!projectId) {
      toast.error('يرجى تحديد مشروع أولاً');
      return;
    }

    try {
      if (recordId) {
        await updateMutation.mutateAsync({ id: recordId, ...form });
      } else {
        await createMutation.mutateAsync({ projectId, ...form });
      }
    } catch (error) {
      toast.error('حدث خطأ أثناء الحفظ');
    }
  };

  return (
    <div className="space-y-6">
      {/* Title Deed Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">سند الملكية</CardTitle>
          <CardDescription>معلومات سند الملكية والتسجيل الأساسي</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">حالة السند</label>
              <Select value={form.titleDeedStatus || ''} onValueChange={(v) => handleChange('titleDeedStatus', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الحالة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="مكتمل">مكتمل</SelectItem>
                  <SelectItem value="قيد الإجراء">قيد الإجراء</SelectItem>
                  <SelectItem value="معلق">معلق</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">رقم السند</label>
              <Input
                value={form.titleDeedNumber || ''}
                onChange={(e) => handleChange('titleDeedNumber', e.target.value)}
                placeholder="أدخل رقم السند"
              />
            </div>
            <div>
              <label className="text-sm font-medium">تاريخ السند</label>
              <Input
                type="date"
                value={form.titleDeedDate || ''}
                onChange={(e) => handleChange('titleDeedDate', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* DDA Registration Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">التسجيل لدى هيئة دبي للتطوير</CardTitle>
          <CardDescription>معلومات التسجيل والموافقات الحكومية</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">حالة التسجيل</label>
              <Select value={form.ddaRegistrationStatus || ''} onValueChange={(v) => handleChange('ddaRegistrationStatus', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الحالة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="مكتمل">مكتمل</SelectItem>
                  <SelectItem value="قيد الانتظار">قيد الانتظار</SelectItem>
                  <SelectItem value="معلق">معلق</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">رقم التسجيل</label>
              <Input
                value={form.ddaRegistrationNumber || ''}
                onChange={(e) => handleChange('ddaRegistrationNumber', e.target.value)}
                placeholder="أدخل رقم التسجيل"
              />
            </div>
            <div>
              <label className="text-sm font-medium">تاريخ التسجيل</label>
              <Input
                type="date"
                value={form.ddaRegistrationDate || ''}
                onChange={(e) => handleChange('ddaRegistrationDate', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Municipality Approval Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">موافقة البلدية</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">حالة الموافقة</label>
              <Select value={form.municipalityApprovalStatus || ''} onValueChange={(v) => handleChange('municipalityApprovalStatus', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الحالة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="موافق">موافق</SelectItem>
                  <SelectItem value="قيد المراجعة">قيد المراجعة</SelectItem>
                  <SelectItem value="مرفوض">مرفوض</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">رقم الموافقة</label>
              <Input
                value={form.municipalityApprovalNumber || ''}
                onChange={(e) => handleChange('municipalityApprovalNumber', e.target.value)}
                placeholder="أدخل رقم الموافقة"
              />
            </div>
            <div>
              <label className="text-sm font-medium">تاريخ الموافقة</label>
              <Input
                type="date"
                value={form.municipalityApprovalDate || ''}
                onChange={(e) => handleChange('municipalityApprovalDate', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fees Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">الرسوم والتكاليف</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium">رسوم التسجيل</label>
              <Input
                type="number"
                value={form.registrationFees || ''}
                onChange={(e) => handleChange('registrationFees', e.target.value ? parseInt(e.target.value) : null)}
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-sm font-medium">أتعاب الاستشارة القانونية</label>
              <Input
                type="number"
                value={form.legalConsultationFees || ''}
                onChange={(e) => handleChange('legalConsultationFees', e.target.value ? parseInt(e.target.value) : null)}
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-sm font-medium">إجمالي الرسوم الحكومية</label>
              <Input
                type="number"
                value={form.governmentFeesTotal || ''}
                onChange={(e) => handleChange('governmentFeesTotal', e.target.value ? parseInt(e.target.value) : null)}
                placeholder="0"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ملاحظات وتعليقات</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">الملاحظات القانونية</label>
            <Textarea
              value={form.legalNotes || ''}
              onChange={(e) => handleChange('legalNotes', e.target.value)}
              placeholder="أضف ملاحظات قانونية عامة"
              className="min-h-24"
            />
          </div>
          <div>
            <label className="text-sm font-medium">تحليل فاروق (المحامي)</label>
            <Textarea
              value={form.farouqAnalysis || ''}
              onChange={(e) => handleChange('farouqAnalysis', e.target.value)}
              placeholder="تحليل المحامي للوضع القانوني"
              className="min-h-24"
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-2">
        <Button
          onClick={handleSave}
          disabled={!isDirty || !projectId}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {recordId ? 'حفظ التغييرات' : 'إنشاء السجل'}
        </Button>
      </div>
    </div>
  );
}
