import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface DesignsAndPermitsTabProps {
  projectId: number | null;
}

export function DesignsAndPermitsTab({ projectId }: DesignsAndPermitsTabProps) {
  const [form, setForm] = useState<Record<string, any>>({});
  const [recordId, setRecordId] = useState<number | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Fetch designs and permits record
  const { data: record } = trpc.designsAndPermits.listByProject.useQuery(projectId || 0, {
    enabled: !!projectId,
  });

  useEffect(() => {
    if (record && record.length > 0) {
      setForm(record[0]);
      setRecordId(record[0].id);
    }
  }, [record]);

  // Create mutation
  const createMutation = trpc.designsAndPermits.create.useMutation({
    onSuccess: (data) => {
      setRecordId(data.id);
      setIsDirty(false);
      toast.success('تم إنشاء سجل التصاميم والتصاريح بنجاح');
    },
  });

  // Update mutation
  const updateMutation = trpc.designsAndPermits.update.useMutation({
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
      {/* Architectural Design Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">التصميم المعماري</CardTitle>
          <CardDescription>معلومات التصميم المعماري والملفات</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">حالة التصميم</label>
              <Select value={form.architecturalDesignStatus || ''} onValueChange={(v) => handleChange('architecturalDesignStatus', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الحالة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="مكتمل">مكتمل</SelectItem>
                  <SelectItem value="قيد الإعداد">قيد الإعداد</SelectItem>
                  <SelectItem value="معلق">معلق</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">تاريخ إنجاز التصميم</label>
              <Input
                type="date"
                value={form.architecturalDesignDate || ''}
                onChange={(e) => handleChange('architecturalDesignDate', e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium">رابط ملف التصميم (S3)</label>
              <Input
                value={form.architecturalDesignFileUrl || ''}
                onChange={(e) => handleChange('architecturalDesignFileUrl', e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Engineering Design Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">التصميم الهندسي</CardTitle>
          <CardDescription>معلومات التصميم الهندسي والملفات</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">حالة التصميم الهندسي</label>
              <Select value={form.engineeringDesignStatus || ''} onValueChange={(v) => handleChange('engineeringDesignStatus', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الحالة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="مكتمل">مكتمل</SelectItem>
                  <SelectItem value="قيد الإعداد">قيد الإعداد</SelectItem>
                  <SelectItem value="معلق">معلق</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">تاريخ إنجاز التصميم الهندسي</label>
              <Input
                type="date"
                value={form.engineeringDesignDate || ''}
                onChange={(e) => handleChange('engineeringDesignDate', e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium">رابط ملف التصميم الهندسي (S3)</label>
              <Input
                value={form.engineeringDesignFileUrl || ''}
                onChange={(e) => handleChange('engineeringDesignFileUrl', e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Building Permit Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">تصريح البناء</CardTitle>
          <CardDescription>معلومات تصريح البناء والموافقات</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">حالة التصريح</label>
              <Select value={form.buildingPermitStatus || ''} onValueChange={(v) => handleChange('buildingPermitStatus', v)}>
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
              <label className="text-sm font-medium">رقم التصريح</label>
              <Input
                value={form.buildingPermitNumber || ''}
                onChange={(e) => handleChange('buildingPermitNumber', e.target.value)}
                placeholder="أدخل رقم التصريح"
              />
            </div>
            <div>
              <label className="text-sm font-medium">تاريخ التصريح</label>
              <Input
                type="date"
                value={form.buildingPermitDate || ''}
                onChange={(e) => handleChange('buildingPermitDate', e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">تاريخ انتهاء التصريح</label>
              <Input
                type="date"
                value={form.buildingPermitExpiryDate || ''}
                onChange={(e) => handleChange('buildingPermitExpiryDate', e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium">رابط ملف التصريح (S3)</label>
              <Input
                value={form.buildingPermitFileUrl || ''}
                onChange={(e) => handleChange('buildingPermitFileUrl', e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Municipality Design Approval Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">موافقة البلدية على التصاميم</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">حالة الموافقة</label>
              <Select value={form.municipalityDesignApprovalStatus || ''} onValueChange={(v) => handleChange('municipalityDesignApprovalStatus', v)}>
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
              <label className="text-sm font-medium">تاريخ الموافقة</label>
              <Input
                type="date"
                value={form.municipalityDesignApprovalDate || ''}
                onChange={(e) => handleChange('municipalityDesignApprovalDate', e.target.value)}
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
              <label className="text-sm font-medium">أتعاب الاستشارة التصميمية</label>
              <Input
                type="number"
                value={form.designConsultationFees || ''}
                onChange={(e) => handleChange('designConsultationFees', e.target.value ? parseInt(e.target.value) : null)}
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-sm font-medium">رسوم تصريح البناء</label>
              <Input
                type="number"
                value={form.buildingPermitFees || ''}
                onChange={(e) => handleChange('buildingPermitFees', e.target.value ? parseInt(e.target.value) : null)}
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-sm font-medium">رسوم مراجعة التصاميم</label>
              <Input
                type="number"
                value={form.municipalityDesignReviewFees || ''}
                onChange={(e) => handleChange('municipalityDesignReviewFees', e.target.value ? parseInt(e.target.value) : null)}
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
            <label className="text-sm font-medium">ملاحظات عامة على التصاميم</label>
            <Textarea
              value={form.designNotes || ''}
              onChange={(e) => handleChange('designNotes', e.target.value)}
              placeholder="أضف ملاحظات عامة على التصاميم"
              className="min-h-24"
            />
          </div>
          <div>
            <label className="text-sm font-medium">تحليل الاستشاري المعماري</label>
            <Textarea
              value={form.consultantAnalysis || ''}
              onChange={(e) => handleChange('consultantAnalysis', e.target.value)}
              placeholder="تحليل الاستشاري المعماري للتصاميم"
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
