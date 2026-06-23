import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus, Trash2, Edit, CalendarDays, Clock, AlertTriangle, CheckCircle2,
  Save, RefreshCw, X, BarChart3
} from "lucide-react";

interface Phase {
  id: number;
  phaseNumber: number;
  phaseName: string;
  startDate: string;
  durationMonths: number;
  endDate?: string;
  notes?: string;
}

export default function FlexiblePhasesTab({ cfProjectId, onRefresh }: { cfProjectId: number; onRefresh: () => void }) {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingPhase, setEditingPhase] = useState<Phase | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  // Form state
  const [formPhaseName, setFormPhaseName] = useState("");
  const [formStartDate, setFormStartDate] = useState("2026-01");
  const [formDuration, setFormDuration] = useState(3);
  const [formNotes, setFormNotes] = useState("");

  const phasesQuery = trpc.cashFlowProgram.listPhases.useQuery(cfProjectId);
  const createMutation = trpc.cashFlowProgram.createPhase.useMutation();
  const updateMutation = trpc.cashFlowProgram.updatePhase.useMutation();
  const deleteMutation = trpc.cashFlowProgram.deletePhase.useMutation();

  useEffect(() => {
    if (phasesQuery.data) {
      setPhases(phasesQuery.data);
    }
  }, [phasesQuery.data]);

  const handleCreatePhase = async () => {
    if (!formPhaseName.trim()) {
      toast.error("يرجى إدخال اسم المرحلة");
      return;
    }
    if (!formStartDate) {
      toast.error("يرجى اختيار تاريخ البدء");
      return;
    }
    if (formDuration < 1) {
      toast.error("يرجى إدخال مدة صحيحة (1 شهر على الأقل)");
      return;
    }

    try {
      const result = await createMutation.mutateAsync({
        cfProjectId,
        phaseName: formPhaseName.trim(),
        startDate: formStartDate,
        durationMonths: formDuration,
        notes: formNotes.trim() || undefined,
      });

      toast.success("تم إنشاء المرحلة بنجاح", {
        description: `${formPhaseName} — ينتهي في ${result.endDate}`,
      });

      setFormPhaseName("");
      setFormStartDate("2026-01");
      setFormDuration(3);
      setFormNotes("");
      setShowCreateDialog(false);
      phasesQuery.refetch();
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || "فشل في إنشاء المرحلة");
    }
  };

  const handleUpdatePhase = async () => {
    if (!editingPhase) return;
    if (!formPhaseName.trim()) {
      toast.error("يرجى إدخال اسم المرحلة");
      return;
    }

    try {
      const result = await updateMutation.mutateAsync({
        phaseId: editingPhase.id,
        phaseName: formPhaseName.trim(),
        startDate: formStartDate,
        durationMonths: formDuration,
        notes: formNotes.trim() || undefined,
      });

      toast.success("تم تحديث المرحلة بنجاح", {
        description: `ينتهي في ${result.endDate}`,
      });

      setEditingPhase(null);
      setShowEditDialog(false);
      setFormPhaseName("");
      setFormStartDate("2026-01");
      setFormDuration(3);
      setFormNotes("");
      phasesQuery.refetch();
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || "فشل في تحديث المرحلة");
    }
  };

  const handleDeletePhase = async (phaseId: number) => {
    if (!confirm("هل أنت متأكد من حذف هذه المرحلة؟")) return;

    try {
      await deleteMutation.mutateAsync(phaseId);
      toast.success("تم حذف المرحلة بنجاح");
      phasesQuery.refetch();
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || "فشل في حذف المرحلة");
    }
  };

  const openEditDialog = (phase: Phase) => {
    setEditingPhase(phase);
    setFormPhaseName(phase.phaseName);
    setFormStartDate(phase.startDate);
    setFormDuration(phase.durationMonths);
    setFormNotes(phase.notes || "");
    setShowEditDialog(true);
  };

  const calculateEndDate = (startDate: string, months: number) => {
    const [year, month] = startDate.split('-').map(Number);
    let endMonth = month + months - 1;
    let endYear = year;
    while (endMonth > 12) {
      endMonth -= 12;
      endYear++;
    }
    return `${endYear}-${String(endMonth).padStart(2, '0')}`;
  };

  // Check for overlapping phases
  const checkOverlap = (phase1: Phase, phase2: Phase) => {
    const [y1, m1] = phase1.startDate.split('-').map(Number);
    const [y2, m2] = phase2.startDate.split('-').map(Number);
    const start1 = y1 * 12 + m1;
    const start2 = y2 * 12 + m2;
    const end1 = start1 + phase1.durationMonths - 1;
    const end2 = start2 + phase2.durationMonths - 1;
    return !(end1 < start2 || end2 < start1);
  };

  const overlappingPhases = phases.filter((p1, i) =>
    phases.some((p2, j) => i !== j && checkOverlap(p1, p2))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-emerald-600" />
                المراحل المرنة
              </CardTitle>
              <CardDescription>
                حدد تاريخ البدء والمدة لكل مرحلة بشكل مستقل — يمكن للمراحل أن تعمل بالتوازي
              </CardDescription>
            </div>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700">
                  <Plus className="w-4 h-4 ml-2" />
                  مرحلة جديدة
                </Button>
              </DialogTrigger>
              <DialogContent dir="rtl">
                <DialogHeader>
                  <DialogTitle>إنشاء مرحلة جديدة</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label className="text-sm font-semibold">اسم المرحلة *</Label>
                    <Input
                      placeholder="مثال: التصميم المعماري"
                      value={formPhaseName}
                      onChange={(e) => setFormPhaseName(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-semibold">تاريخ البدء *</Label>
                      <Input
                        type="month"
                        value={formStartDate}
                        onChange={(e) => setFormStartDate(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-semibold">المدة (أشهر) *</Label>
                      <Input
                        type="number"
                        min={1}
                        value={formDuration}
                        onChange={(e) => setFormDuration(Math.max(1, parseInt(e.target.value) || 1))}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">ملاحظات</Label>
                    <Input
                      placeholder="ملاحظات إضافية..."
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-700">
                      <strong>تاريخ الانتهاء:</strong> {calculateEndDate(formStartDate, formDuration)}
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">إلغاء</Button>
                  </DialogClose>
                  <Button
                    onClick={handleCreatePhase}
                    disabled={createMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {createMutation.isPending ? (
                      <RefreshCw className="w-4 h-4 animate-spin ml-2" />
                    ) : (
                      <Plus className="w-4 h-4 ml-2" />
                    )}
                    {createMutation.isPending ? "جاري الإنشاء..." : "إنشاء المرحلة"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
      </Card>

      {/* Overlapping Phases Warning */}
      {overlappingPhases.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-amber-900">مراحل متوازية مكتشفة</p>
                <p className="text-sm text-amber-700 mt-1">
                  المراحل التالية تعمل بالتوازي: {overlappingPhases.map(p => p.phaseName).join(", ")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Phases List */}
      {phasesQuery.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6 pb-4">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
                <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : phases.length === 0 ? (
        <Card className="border-dashed border-2 border-gray-300">
          <CardContent className="py-12 text-center">
            <CalendarDays className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 mb-4">لم تقم بإنشاء أي مراحل بعد</p>
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4 ml-2" />
              إنشاء أول مرحلة
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {phases.map((phase) => (
            <Card key={phase.id} className="hover:shadow-lg transition-all">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900">{phase.phaseName}</h3>
                    <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                      <CalendarDays className="w-4 h-4" />
                      <span>{phase.startDate}</span>
                      <span className="text-gray-400">→</span>
                      <span>{phase.endDate || "—"}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(phase)}
                      className="text-blue-600 hover:bg-blue-50"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeletePhase(phase.id)}
                      className="text-red-600 hover:bg-red-50"
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    <Clock className="w-3 h-3 ml-1" />
                    {phase.durationMonths} شهر
                  </Badge>
                  {overlappingPhases.some(p => p.id === phase.id) && (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                      متوازية
                    </Badge>
                  )}
                </div>

                {phase.notes && (
                  <p className="text-sm text-gray-600 bg-gray-50 rounded p-2">{phase.notes}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل المرحلة</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm font-semibold">اسم المرحلة *</Label>
              <Input
                placeholder="مثال: التصميم المعماري"
                value={formPhaseName}
                onChange={(e) => setFormPhaseName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-semibold">تاريخ البدء *</Label>
                <Input
                  type="month"
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm font-semibold">المدة (أشهر) *</Label>
                <Input
                  type="number"
                  min={1}
                  value={formDuration}
                  onChange={(e) => setFormDuration(Math.max(1, parseInt(e.target.value) || 1))}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-sm font-semibold">ملاحظات</Label>
              <Input
                placeholder="ملاحظات إضافية..."
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-700">
                <strong>تاريخ الانتهاء:</strong> {calculateEndDate(formStartDate, formDuration)}
              </p>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">إلغاء</Button>
            </DialogClose>
            <Button
              onClick={handleUpdatePhase}
              disabled={updateMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {updateMutation.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin ml-2" />
              ) : (
                <Save className="w-4 h-4 ml-2" />
              )}
              {updateMutation.isPending ? "جاري التحديث..." : "حفظ التعديلات"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Gantt Chart */}
      {phases.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-600" />
              الجدول الزمني البياني
            </CardTitle>
          </CardHeader>
          <CardContent>
            <GanttChart phases={phases} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Gantt Chart Component
function GanttChart({ phases }: { phases: Phase[] }) {
  if (phases.length === 0) return null;

  // Calculate the overall timeline
  const allDates = phases.flatMap(p => [p.startDate, p.endDate || p.startDate]);
  const minDate = allDates.sort()[0];
  const maxDate = allDates.sort().reverse()[0];

  const [minYear, minMonth] = minDate.split('-').map(Number);
  const [maxYear, maxMonth] = maxDate.split('-').map(Number);

  const minMonthNum = minYear * 12 + minMonth;
  const maxMonthNum = maxYear * 12 + maxMonth;
  const totalMonths = maxMonthNum - minMonthNum + 1;

  const getPhasePosition = (startDate: string, durationMonths: number) => {
    const [year, month] = startDate.split('-').map(Number);
    const monthNum = year * 12 + month;
    const startPct = ((monthNum - minMonthNum) / totalMonths) * 100;
    const widthPct = (durationMonths / totalMonths) * 100;
    return { startPct, widthPct };
  };

  const colors = [
    'bg-blue-500',
    'bg-purple-500',
    'bg-amber-500',
    'bg-emerald-500',
    'bg-pink-500',
    'bg-cyan-500',
    'bg-indigo-500',
    'bg-rose-500',
  ];

  return (
    <div className="space-y-3">
      {phases.map((phase, idx) => {
        const { startPct, widthPct } = getPhasePosition(phase.startDate, phase.durationMonths);
        const colorClass = colors[idx % colors.length];

        return (
          <div key={phase.id} className="flex items-center gap-4">
            <div className="w-40 text-sm font-medium text-gray-700 truncate">
              {phase.phaseName}
            </div>
            <div className="flex-1 relative h-10 bg-gray-100 rounded-lg overflow-hidden">
              <div
                className={`absolute top-0 h-full ${colorClass} rounded-lg flex items-center justify-center text-white text-xs font-bold transition-all`}
                style={{ right: `${startPct}%`, width: `${widthPct}%` }}
              >
                {phase.durationMonths}ش
              </div>
            </div>
            <div className="w-24 text-right text-xs text-gray-500">
              {phase.startDate} → {phase.endDate}
            </div>
          </div>
        );
      })}
    </div>
  );
}


