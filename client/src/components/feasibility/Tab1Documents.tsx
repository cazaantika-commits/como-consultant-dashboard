import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Tab1DocumentsProps {
  studyId?: number;
  projectId: number;
}

export default function Tab1Documents({ studyId, projectId }: Tab1DocumentsProps) {
  const [formData, setFormData] = useState({
    projectName: '',
    community: '',
    plotNumber: '',
    projectDescription: '',
    landUse: '',
    plotArea: '',
    plotAreaM2: '',
    gfaResidential: '',
    gfaRetail: '',
    gfaOffices: '',
    landPrice: '',
    agentCommissionLandPct: '',
  });

  const [isSaving, setIsSaving] = useState(false);

  // Fetch study data
  const { data: study } = trpc.feasibility.getById.useQuery(studyId || 0, {
    enabled: !!studyId,
  });

  // Fetch project data
  const { data: project } = trpc.projects.getById.useQuery(projectId, {
    enabled: !!projectId,
  });

  // Load study data
  useEffect(() => {
    if (study) {
      setFormData({
        projectName: study.projectName || '',
        community: study.community || '',
        plotNumber: study.plotNumber || '',
        projectDescription: study.projectDescription || '',
        landUse: study.landUse || '',
        plotArea: study.plotArea?.toString() || '',
        plotAreaM2: study.plotAreaM2?.toString() || '',
        gfaResidential: study.gfaResidential?.toString() || '',
        gfaRetail: study.gfaRetail?.toString() || '',
        gfaOffices: study.gfaOffices?.toString() || '',
        landPrice: study.landPrice?.toString() || '',
        agentCommissionLandPct: study.agentCommissionLandPct?.toString() || '',
      });
    } else if (project) {
      // Auto-populate from project
      setFormData((prev) => ({
        ...prev,
        projectName: project.name || '',
        community: project.areaCode || '',
        plotNumber: project.plotNumber || '',
        plotArea: project.plotAreaSqft?.toString() || '',
        plotAreaM2: project.plotAreaSqm?.toString() || '',
        gfaResidential: project.gfaSqft?.toString() || '',
      }));
    }
  }, [study, project]);

  // Update mutation
  const updateMutation = trpc.feasibility.update.useMutation({
    onSuccess: () => {
      toast.success('تم حفظ البيانات بنجاح');
    },
    onError: (error) => {
      toast.error(error.message || 'خطأ في الحفظ');
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSave = async () => {
    if (!studyId) {
      toast.error('يجب تحديد الدراسة أولاً');
      return;
    }

    setIsSaving(true);
    try {
      await updateMutation.mutateAsync({
        id: studyId,
        projectName: formData.projectName,
        community: formData.community,
        plotNumber: formData.plotNumber,
        projectDescription: formData.projectDescription,
        landUse: formData.landUse,
        plotArea: formData.plotArea ? parseInt(formData.plotArea) : null,
        plotAreaM2: formData.plotAreaM2 ? parseInt(formData.plotAreaM2) : null,
        gfaResidential: formData.gfaResidential ? parseInt(formData.gfaResidential) : null,
        gfaRetail: formData.gfaRetail ? parseInt(formData.gfaRetail) : null,
        gfaOffices: formData.gfaOffices ? parseInt(formData.gfaOffices) : null,
        landPrice: formData.landPrice ? parseInt(formData.landPrice) : null,
        agentCommissionLandPct: formData.agentCommissionLandPct ? parseInt(formData.agentCommissionLandPct) : null,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            📋 الوثائق والأرض
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Project Information */}
          <div>
            <h3 className="font-semibold mb-4 text-slate-900">بيانات المشروع</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>اسم المشروع</Label>
                <Input
                  name="projectName"
                  value={formData.projectName}
                  onChange={handleChange}
                  placeholder="اسم المشروع"
                />
              </div>
              <div>
                <Label>المنطقة</Label>
                <Input
                  name="community"
                  value={formData.community}
                  onChange={handleChange}
                  placeholder="المنطقة"
                />
              </div>
              <div>
                <Label>رقم القطعة</Label>
                <Input
                  name="plotNumber"
                  value={formData.plotNumber}
                  onChange={handleChange}
                  placeholder="رقم القطعة"
                />
              </div>
              <div>
                <Label>الاستخدام</Label>
                <Input
                  name="landUse"
                  value={formData.landUse}
                  onChange={handleChange}
                  placeholder="الاستخدام"
                />
              </div>
              <div className="md:col-span-2">
                <Label>وصف المشروع</Label>
                <Input
                  name="projectDescription"
                  value={formData.projectDescription}
                  onChange={handleChange}
                  placeholder="وصف المشروع"
                />
              </div>
            </div>
          </div>

          {/* Land Information */}
          <div>
            <h3 className="font-semibold mb-4 text-slate-900">بيانات الأرض</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>مساحة الأرض (قدم²)</Label>
                <Input
                  name="plotArea"
                  type="number"
                  value={formData.plotArea}
                  onChange={handleChange}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>مساحة الأرض (م²)</Label>
                <Input
                  name="plotAreaM2"
                  type="number"
                  value={formData.plotAreaM2}
                  onChange={handleChange}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>سعر الأرض (درهم)</Label>
                <Input
                  name="landPrice"
                  type="number"
                  value={formData.landPrice}
                  onChange={handleChange}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>عمولة الوسيط (%)</Label>
                <Input
                  name="agentCommissionLandPct"
                  type="number"
                  value={formData.agentCommissionLandPct}
                  onChange={handleChange}
                  placeholder="1"
                />
              </div>
            </div>
          </div>

          {/* GFA Information */}
          <div>
            <h3 className="font-semibold mb-4 text-slate-900">المساحات المسموح بناؤها (GFA)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>GFA سكني (قدم²)</Label>
                <Input
                  name="gfaResidential"
                  type="number"
                  value={formData.gfaResidential}
                  onChange={handleChange}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>GFA تجاري (قدم²)</Label>
                <Input
                  name="gfaRetail"
                  type="number"
                  value={formData.gfaRetail}
                  onChange={handleChange}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>GFA مكاتب (قدم²)</Label>
                <Input
                  name="gfaOffices"
                  type="number"
                  value={formData.gfaOffices}
                  onChange={handleChange}
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-2">
            <Button
              onClick={handleSave}
              disabled={isSaving || updateMutation.isPending}
              className="gap-2"
            >
              {isSaving || updateMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              حفظ التغييرات
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
