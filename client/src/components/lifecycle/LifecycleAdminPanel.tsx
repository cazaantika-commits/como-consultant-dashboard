import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Plus, Pencil, Trash2, ChevronDown, ChevronRight, X, Save,
  Settings2, GripVertical, AlertTriangle, Layers, FileText, Database, CheckSquare, Zap, Check
} from "lucide-react";
import { toast } from "sonner";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type ReqType = "document" | "data" | "approval" | "action";

const REQ_TYPE_LABELS: Record<ReqType, string> = {
  document: "مستند",
  data: "بيانات",
  approval: "موافقة",
  action: "إجراء",
};

const REQ_TYPE_ICONS: Record<ReqType, React.ReactNode> = {
  document: <FileText className="w-3.5 h-3.5" />,
  data: <Database className="w-3.5 h-3.5" />,
  approval: <CheckSquare className="w-3.5 h-3.5" />,
  action: <Zap className="w-3.5 h-3.5" />,
};

const REQ_TYPE_COLORS: Record<ReqType, string> = {
  document: "bg-blue-100 text-blue-700",
  data: "bg-purple-100 text-purple-700",
  approval: "bg-green-100 text-green-700",
  action: "bg-orange-100 text-orange-700",
};

// ─────────────────────────────────────────────
// ConfirmDialog
// ─────────────────────────────────────────────
function ConfirmDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  loading,
}: {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            {title}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{message}</p>
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={loading}>إلغاء</Button>
          <Button variant="destructive" size="sm" onClick={onConfirm} disabled={loading}>
            {loading ? "جاري الحذف..." : "حذف"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────
// RequirementAdminRow
// ─────────────────────────────────────────────
function RequirementAdminRow({
  req,
  onUpdated,
}: {
  req: {
    id: number;
    requirementCode: string;
    nameAr: string;
    reqType: string;
    isMandatory: number;
    descriptionAr: string | null;
    sourceNote: string | null;
    internalOwner: string | null;
    timing: string | null;
    sortOrder: number | null;
  };
  onUpdated: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [nameAr, setNameAr] = useState(req.nameAr);
  const [reqType, setReqType] = useState<ReqType>(req.reqType as ReqType);
  const [isMandatory, setIsMandatory] = useState(req.isMandatory === 1);
  const [descriptionAr, setDescriptionAr] = useState(req.descriptionAr ?? "");
  const [sourceNote, setSourceNote] = useState(req.sourceNote ?? "");
  const [internalOwner, setInternalOwner] = useState(req.internalOwner ?? "");
  const [timing, setTiming] = useState(req.timing ?? "");

  const updateMutation = trpc.lifecycle.updateRequirement.useMutation({
    onSuccess: () => { toast.success("تم تحديث المتطلب"); setEditing(false); onUpdated(); },
    onError: () => toast.error("حدث خطأ في التحديث"),
  });

  const deleteMutation = trpc.lifecycle.deleteRequirement.useMutation({
    onSuccess: () => { toast.success("تم حذف المتطلب"); setConfirmDelete(false); onUpdated(); },
    onError: () => toast.error("حدث خطأ في الحذف"),
  });

  return (
    <>
      <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border/60 bg-card hover:bg-muted/30 group">
        <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex items-center gap-1 shrink-0 ${REQ_TYPE_COLORS[req.reqType as ReqType] ?? "bg-gray-100 text-gray-600"}`}>
          {REQ_TYPE_ICONS[req.reqType as ReqType]}
          {REQ_TYPE_LABELS[req.reqType as ReqType] ?? req.reqType}
        </span>
        <span className="flex-1 text-sm text-foreground truncate">{req.nameAr}</span>
        {req.isMandatory === 1 && (
          <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded shrink-0">إلزامي</span>
        )}
        <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setEditing(true)}>
            <Pencil className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">تعديل المتطلب</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs mb-1 block">اسم المتطلب *</Label>
              <Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} className="text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">النوع</Label>
                <Select value={reqType} onValueChange={(v) => setReqType(v as ReqType)}>
                  <SelectTrigger className="text-sm h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(REQ_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1 block">الإلزامية</Label>
                <Select value={isMandatory ? "1" : "0"} onValueChange={(v) => setIsMandatory(v === "1")}>
                  <SelectTrigger className="text-sm h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">إلزامي</SelectItem>
                    <SelectItem value="0">اختياري</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs mb-1 block">الوصف</Label>
              <Textarea value={descriptionAr} onChange={(e) => setDescriptionAr(e.target.value)} rows={2} className="text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">الجهة المسؤولة</Label>
                <Input value={internalOwner} onChange={(e) => setInternalOwner(e.target.value)} className="text-sm h-9" />
              </div>
              <div>
                <Label className="text-xs mb-1 block">التوقيت</Label>
                <Input value={timing} onChange={(e) => setTiming(e.target.value)} className="text-sm h-9" placeholder="مثال: قبل البدء" />
              </div>
            </div>
            <div>
              <Label className="text-xs mb-1 block">المصدر / الملاحظة</Label>
              <Input value={sourceNote} onChange={(e) => setSourceNote(e.target.value)} className="text-sm h-9" />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(false)}>إلغاء</Button>
            <Button size="sm" onClick={() => updateMutation.mutate({
              requirementCode: req.requirementCode,
              nameAr: nameAr.trim(),
              reqType,
              isMandatory: isMandatory ? 1 : 0,
              descriptionAr: descriptionAr || undefined,
              sourceNote: sourceNote || undefined,
              internalOwner: internalOwner || undefined,
              timing: timing || undefined,
            })} disabled={!nameAr.trim() || updateMutation.isPending}>
              <Save className="w-3 h-3 mr-1" />
              {updateMutation.isPending ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete */}
      <ConfirmDialog
        open={confirmDelete}
        title="حذف المتطلب"
        message={`هل أنت متأكد من حذف المتطلب "${req.nameAr}"؟ لن يؤثر هذا على البيانات المدخلة سابقاً.`}
        onConfirm={() => deleteMutation.mutate({ requirementCode: req.requirementCode })}
        onCancel={() => setConfirmDelete(false)}
        loading={deleteMutation.isPending}
      />
    </>
  );
}

// ─────────────────────────────────────────────
// AddRequirementForm
// ─────────────────────────────────────────────
function AddRequirementForm({
  serviceCode,
  onAdded,
  onCancel,
}: {
  serviceCode: string;
  onAdded: () => void;
  onCancel: () => void;
}) {
  const [nameAr, setNameAr] = useState("");
  const [reqType, setReqType] = useState<ReqType>("document");
  const [isMandatory, setIsMandatory] = useState(true);
  const [descriptionAr, setDescriptionAr] = useState("");
  const [internalOwner, setInternalOwner] = useState("");

  const addMutation = trpc.lifecycle.addRequirement.useMutation({
    onSuccess: () => { toast.success("تم إضافة المتطلب"); onAdded(); },
    onError: () => toast.error("حدث خطأ في الإضافة"),
  });

  return (
    <div className="border border-dashed border-primary/40 rounded-lg p-3 bg-primary/5 space-y-3">
      <p className="text-xs font-semibold text-primary">إضافة متطلب جديد</p>
      <div>
        <Label className="text-xs mb-1 block">اسم المتطلب *</Label>
        <Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} className="text-sm h-9" placeholder="مثال: صورة عقد الإيجار" autoFocus />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs mb-1 block">النوع</Label>
          <Select value={reqType} onValueChange={(v) => setReqType(v as ReqType)}>
            <SelectTrigger className="text-sm h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(REQ_TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs mb-1 block">الإلزامية</Label>
          <Select value={isMandatory ? "1" : "0"} onValueChange={(v) => setIsMandatory(v === "1")}>
            <SelectTrigger className="text-sm h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">إلزامي</SelectItem>
              <SelectItem value="0">اختياري</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label className="text-xs mb-1 block">الجهة المسؤولة (اختياري)</Label>
        <Input value={internalOwner} onChange={(e) => setInternalOwner(e.target.value)} className="text-sm h-9" placeholder="مثال: فريق المبيعات" />
      </div>
      <div>
        <Label className="text-xs mb-1 block">الوصف (اختياري)</Label>
        <Textarea value={descriptionAr} onChange={(e) => setDescriptionAr(e.target.value)} rows={2} className="text-sm" placeholder="وصف مختصر للمتطلب..." />
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onCancel}>
          <X className="w-3 h-3 mr-1" />إلغاء
        </Button>
        <Button size="sm" onClick={() => addMutation.mutate({
          serviceCode,
          nameAr: nameAr.trim(),
          reqType,
          isMandatory: isMandatory ? 1 : 0,
          descriptionAr: descriptionAr || undefined,
          internalOwner: internalOwner || undefined,
        })} disabled={!nameAr.trim() || addMutation.isPending}>
          <Plus className="w-3 h-3 mr-1" />
          {addMutation.isPending ? "جاري الإضافة..." : "إضافة"}
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ServiceAdminRow
// ─────────────────────────────────────────────
function ServiceAdminRow({
  svc,
  onUpdated,
}: {
  svc: {
    id: number;
    serviceCode: string;
    stageCode: string;
    nameAr: string;
    descriptionAr: string | null;
    externalParty: string | null;
    internalOwner: string | null;
    expectedDurationDays: number;
    isMandatory: number;
    sortOrder: number | null;
  };
  onUpdated: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editingService, setEditingService] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [addingReq, setAddingReq] = useState(false);

  const [nameAr, setNameAr] = useState(svc.nameAr);
  const [descriptionAr, setDescriptionAr] = useState(svc.descriptionAr ?? "");
  const [externalParty, setExternalParty] = useState(svc.externalParty ?? "");
  const [internalOwner, setInternalOwner] = useState(svc.internalOwner ?? "");
  const [expectedDurationDays, setExpectedDurationDays] = useState(svc.expectedDurationDays);

  const reqsQuery = trpc.lifecycle.getServiceRequirementsAdmin.useQuery(
    { serviceCode: svc.serviceCode },
    { enabled: expanded }
  );

  const updateMutation = trpc.lifecycle.updateService.useMutation({
    onSuccess: () => { toast.success("تم تحديث الخدمة"); setEditingService(false); onUpdated(); },
    onError: () => toast.error("حدث خطأ في التحديث"),
  });

  const deleteMutation = trpc.lifecycle.deleteService.useMutation({
    onSuccess: () => { toast.success("تم حذف الخدمة"); setConfirmDelete(false); onUpdated(); },
    onError: () => toast.error("حدث خطأ في الحذف"),
  });

  const reqs = reqsQuery.data ?? [];

  return (
    <>
      <div className="border border-border rounded-xl overflow-hidden">
        {/* Service header row */}
        <div className="flex items-center gap-2 p-3 bg-card hover:bg-muted/20 group">
          <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 flex-1 min-w-0 text-right">
            <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            )}
            <span className="text-sm font-semibold text-foreground flex-1 truncate">{svc.nameAr}</span>
            <span className="text-[10px] text-muted-foreground shrink-0">{svc.expectedDurationDays} يوم</span>
          </button>
          <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditingService(true)}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Requirements list */}
        {expanded && (
          <div className="border-t border-border/50 bg-muted/20 p-3 space-y-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted-foreground">المتطلبات ({reqs.length})</span>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setAddingReq(true)}>
                <Plus className="w-3 h-3" />
                إضافة متطلب
              </Button>
            </div>
            {reqsQuery.isLoading ? (
              <p className="text-xs text-muted-foreground text-center py-2">جاري التحميل...</p>
            ) : reqs.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">لا توجد متطلبات — أضف الأول</p>
            ) : (
              reqs.map((req) => (
                <RequirementAdminRow
                  key={req.requirementCode}
                  req={req as any}
                  onUpdated={() => reqsQuery.refetch()}
                />
              ))
            )}
            {addingReq && (
              <AddRequirementForm
                serviceCode={svc.serviceCode}
                onAdded={() => { setAddingReq(false); reqsQuery.refetch(); }}
                onCancel={() => setAddingReq(false)}
              />
            )}
          </div>
        )}
      </div>

      {/* Edit Service Dialog */}
      <Dialog open={editingService} onOpenChange={setEditingService}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">تعديل الخدمة</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs mb-1 block">اسم الخدمة *</Label>
              <Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} className="text-sm" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">الوصف</Label>
              <Textarea value={descriptionAr} onChange={(e) => setDescriptionAr(e.target.value)} rows={2} className="text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">الجهة الخارجية</Label>
                <Input value={externalParty} onChange={(e) => setExternalParty(e.target.value)} className="text-sm h-9" placeholder="مثال: RERA" />
              </div>
              <div>
                <Label className="text-xs mb-1 block">المسؤول الداخلي</Label>
                <Input value={internalOwner} onChange={(e) => setInternalOwner(e.target.value)} className="text-sm h-9" />
              </div>
            </div>
            <div>
              <Label className="text-xs mb-1 block">المدة المتوقعة (أيام)</Label>
              <Input
                type="number"
                min={1}
                value={expectedDurationDays}
                onChange={(e) => setExpectedDurationDays(Number(e.target.value))}
                className="text-sm h-9"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setEditingService(false)}>إلغاء</Button>
            <Button size="sm" onClick={() => updateMutation.mutate({
              serviceCode: svc.serviceCode,
              nameAr: nameAr.trim(),
              descriptionAr: descriptionAr || undefined,
              externalParty: externalParty || undefined,
              internalOwner: internalOwner || undefined,
              expectedDurationDays,
            })} disabled={!nameAr.trim() || updateMutation.isPending}>
              <Save className="w-3 h-3 mr-1" />
              {updateMutation.isPending ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Service */}
      <ConfirmDialog
        open={confirmDelete}
        title="حذف الخدمة"
        message={`هل أنت متأكد من حذف الخدمة "${svc.nameAr}"؟ سيتم حذفها من جميع المشاريع.`}
        onConfirm={() => deleteMutation.mutate({ serviceCode: svc.serviceCode })}
        onCancel={() => setConfirmDelete(false)}
        loading={deleteMutation.isPending}
      />
    </>
  );
}

// ─────────────────────────────────────────────
// AddServiceForm
// ─────────────────────────────────────────────
function AddServiceForm({
  stageCode,
  onAdded,
  onCancel,
}: {
  stageCode: string;
  onAdded: () => void;
  onCancel: () => void;
}) {
  const [nameAr, setNameAr] = useState("");
  const [descriptionAr, setDescriptionAr] = useState("");
  const [externalParty, setExternalParty] = useState("");
  const [internalOwner, setInternalOwner] = useState("");
  const [expectedDurationDays, setExpectedDurationDays] = useState(7);

  const addMutation = trpc.lifecycle.addService.useMutation({
    onSuccess: () => { toast.success("تم إضافة الخدمة"); onAdded(); },
    onError: () => toast.error("حدث خطأ في الإضافة"),
  });

  return (
    <div className="border border-dashed border-primary/40 rounded-xl p-4 bg-primary/5 space-y-3">
      <p className="text-sm font-semibold text-primary">إضافة خدمة جديدة</p>
      <div>
        <Label className="text-xs mb-1 block">اسم الخدمة *</Label>
        <Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} className="text-sm" placeholder="مثال: تسجيل المشروع في RERA" autoFocus />
      </div>
      <div>
        <Label className="text-xs mb-1 block">الوصف (اختياري)</Label>
        <Textarea value={descriptionAr} onChange={(e) => setDescriptionAr(e.target.value)} rows={2} className="text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs mb-1 block">الجهة الخارجية</Label>
          <Input value={externalParty} onChange={(e) => setExternalParty(e.target.value)} className="text-sm h-9" placeholder="مثال: RERA" />
        </div>
        <div>
          <Label className="text-xs mb-1 block">المسؤول الداخلي</Label>
          <Input value={internalOwner} onChange={(e) => setInternalOwner(e.target.value)} className="text-sm h-9" />
        </div>
      </div>
      <div>
        <Label className="text-xs mb-1 block">المدة المتوقعة (أيام)</Label>
        <Input type="number" min={1} value={expectedDurationDays} onChange={(e) => setExpectedDurationDays(Number(e.target.value))} className="text-sm h-9 w-32" />
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onCancel}>
          <X className="w-3 h-3 mr-1" />إلغاء
        </Button>
        <Button size="sm" onClick={() => addMutation.mutate({
          stageCode,
          nameAr: nameAr.trim(),
          descriptionAr: descriptionAr || undefined,
          externalParty: externalParty || undefined,
          internalOwner: internalOwner || undefined,
          expectedDurationDays,
        })} disabled={!nameAr.trim() || addMutation.isPending}>
          <Plus className="w-3 h-3 mr-1" />
          {addMutation.isPending ? "جاري الإضافة..." : "إضافة الخدمة"}
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// StageAdminSection
// ─────────────────────────────────────────────
function StageAdminSection({
  stage,
  onUpdated,
}: {
  stage: {
    id: number;
    stageCode: string;
    nameAr: string;
    nameEn: string | null;
    category: string | null;
    isActive: number;
    sortOrder: number | null;
  };
  onUpdated: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editingStage, setEditingStage] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [addingService, setAddingService] = useState(false);

  const [nameAr, setNameAr] = useState(stage.nameAr);
  const [nameEn, setNameEn] = useState(stage.nameEn ?? "");
  const [category, setCategory] = useState(stage.category ?? "");
  const [isActive, setIsActive] = useState(stage.isActive === 1);

  const servicesQuery = trpc.lifecycle.getStageServicesAdmin.useQuery(
    { stageCode: stage.stageCode },
    { enabled: expanded }
  );

  const reorderServicesMutation = trpc.lifecycle.reorderServices.useMutation({
    onSuccess: () => servicesQuery.refetch(),
    onError: () => toast.error("حدث خطأ في إعادة ترتيب الخدمات"),
  });

  const moveService = (index: number, direction: "up" | "down") => {
    const sorted = [...services].sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;
    const current = sorted[index];
    const target = sorted[targetIndex];
    reorderServicesMutation.mutate({
      services: [
        { serviceCode: current.serviceCode, sortOrder: target.sortOrder ?? (targetIndex + 1) * 10 },
        { serviceCode: target.serviceCode, sortOrder: current.sortOrder ?? (index + 1) * 10 },
      ],
    });
  };

  const updateMutation = trpc.lifecycle.updateStage.useMutation({
    onSuccess: () => { toast.success("تم تحديث المرحلة"); setEditingStage(false); onUpdated(); },
    onError: () => toast.error("حدث خطأ في التحديث"),
  });

  const deleteMutation = trpc.lifecycle.deleteStage.useMutation({
    onSuccess: () => { toast.success("تم حذف المرحلة"); setConfirmDelete(false); onUpdated(); },
    onError: () => toast.error("حدث خطأ في الحذف"),
  });

  const services = (servicesQuery.data ?? []) as any[];

  return (
    <>
      <div className="border border-border rounded-2xl overflow-hidden">
        {/* Stage header */}
        <div className="flex items-center gap-3 p-4 bg-card group">
          <div onClick={() => setExpanded(!expanded)} className="flex items-center gap-3 flex-1 min-w-0 text-right cursor-pointer">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-primary/10">
              <Layers className="w-5 h-5 text-primary" />
            </div>
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{stage.nameAr}</p>
              <p className="text-[10px] text-muted-foreground">{stage.stageCode} · {stage.isActive ? "نشطة" : "غير نشطة"}</p>
            </div>
          </div>
          <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setEditingStage(true)}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Services list */}
        {expanded && (
          <div className="border-t border-border/50 bg-muted/10 p-4 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-muted-foreground">الخدمات ({services.length})</span>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setAddingService(true)}>
                <Plus className="w-3 h-3" />
                إضافة خدمة
              </Button>
            </div>
            {servicesQuery.isLoading ? (
              <p className="text-xs text-muted-foreground text-center py-3">جاري التحميل...</p>
            ) : services.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">لا توجد خدمات — أضف الأولى</p>
            ) : (
              [...services].sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map((svc: any, index: number, arr: any[]) => (
                <div key={svc.serviceCode} className="flex items-start gap-1.5">
                  {/* Position controls */}
                  <div className="flex flex-col items-center gap-0.5 pt-2 shrink-0">
                    <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-primary">{index + 1}</span>
                    </div>
                    <button
                      disabled={index === 0 || reorderServicesMutation.isPending}
                      onClick={() => moveService(index, "up")}
                      className="w-5 h-4 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronDown className="w-3 h-3 rotate-180" />
                    </button>
                    <button
                      disabled={index === arr.length - 1 || reorderServicesMutation.isPending}
                      onClick={() => moveService(index, "down")}
                      className="w-5 h-4 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>
                  {/* Service row */}
                  <div className="flex-1 min-w-0">
                    <ServiceAdminRow
                      svc={svc}
                      onUpdated={() => servicesQuery.refetch()}
                    />
                  </div>
                </div>
              ))
            )}
            {addingService && (
              <AddServiceForm
                stageCode={stage.stageCode}
                onAdded={() => { setAddingService(false); servicesQuery.refetch(); }}
                onCancel={() => setAddingService(false)}
              />
            )}
          </div>
        )}
      </div>

      {/* Edit Stage Dialog */}
      <Dialog open={editingStage} onOpenChange={setEditingStage}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">تعديل المرحلة</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs mb-1 block">اسم المرحلة (عربي) *</Label>
              <Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} className="text-sm" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">اسم المرحلة (إنجليزي)</Label>
              <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} className="text-sm h-9" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">التصنيف</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} className="text-sm h-9" placeholder="مثال: RERA, DLD" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">الحالة</Label>
              <Select value={isActive ? "1" : "0"} onValueChange={(v) => setIsActive(v === "1")}>
                <SelectTrigger className="text-sm h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">نشطة</SelectItem>
                  <SelectItem value="0">غير نشطة</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setEditingStage(false)}>إلغاء</Button>
            <Button size="sm" onClick={() => updateMutation.mutate({
              id: stage.id,
              nameAr: nameAr.trim(),
              nameEn: nameEn || undefined,
              category: category || undefined,
              isActive: isActive ? 1 : 0,
            })} disabled={!nameAr.trim() || updateMutation.isPending}>
              <Save className="w-3 h-3 mr-1" />
              {updateMutation.isPending ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Stage */}
      <ConfirmDialog
        open={confirmDelete}
        title="حذف المرحلة"
        message={`هل أنت متأكد من حذف المرحلة "${stage.nameAr}"؟ سيتم حذف جميع خدماتها ومتطلباتها من كل المشاريع.`}
        onConfirm={() => deleteMutation.mutate({ stageCode: stage.stageCode })}
        onCancel={() => setConfirmDelete(false)}
        loading={deleteMutation.isPending}
      />
    </>
  );
}

// ─────────────────────────────────────────────
// AddStageForm
// ─────────────────────────────────────────────
function AddStageForm({ onAdded, onCancel }: { onAdded: () => void; onCancel: () => void }) {
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [category, setCategory] = useState("");

  const addMutation = trpc.lifecycle.createStage.useMutation({
    onSuccess: () => { toast.success("تم إضافة المرحلة"); onAdded(); },
    onError: () => toast.error("حدث خطأ في الإضافة"),
  });

  return (
    <div className="border border-dashed border-primary/40 rounded-2xl p-4 bg-primary/5 space-y-3">
      <p className="text-sm font-semibold text-primary">إضافة مرحلة جديدة</p>
      <div>
        <Label className="text-xs mb-1 block">اسم المرحلة (عربي) *</Label>
        <Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} className="text-sm" placeholder="مثال: مرحلة التسليم والإقفال" autoFocus />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs mb-1 block">اسم المرحلة (إنجليزي)</Label>
          <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} className="text-sm h-9" />
        </div>
        <div>
          <Label className="text-xs mb-1 block">التصنيف</Label>
          <Input value={category} onChange={(e) => setCategory(e.target.value)} className="text-sm h-9" placeholder="RERA, DLD..." />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onCancel}>
          <X className="w-3 h-3 mr-1" />إلغاء
        </Button>
        <Button size="sm" onClick={() => addMutation.mutate({
          nameAr: nameAr.trim(),
          nameEn: nameEn || undefined,
          category: category || undefined,
        })} disabled={!nameAr.trim() || addMutation.isPending}>
          <Plus className="w-3 h-3 mr-1" />
          {addMutation.isPending ? "جاري الإضافة..." : "إضافة المرحلة"}
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// LifecycleAdminPanel — Main Export
// ─────────────────────────────────────────────
export function LifecycleAdminPanel({ onClose }: { onClose: () => void }) {
  const [addingStage, setAddingStage] = useState(false);
  const [posInputs, setPosInputs] = useState<Record<string, string>>({});

  const stagesQuery = trpc.lifecycle.getAllStages.useQuery();
  const utils = trpc.useUtils();
  const stages = (stagesQuery.data ?? []) as any[];
  const sortedStages = [...stages].sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const reorderMutation = trpc.lifecycle.reorderStages.useMutation({
    onSuccess: () => {
      utils.lifecycle.getAllStages.invalidate();
      utils.lifecycle.getStages.invalidate();
      stagesQuery.refetch();
    },
    onError: () => toast.error("حدث خطأ في إعادة الترتيب"),
  });

  const moveToPosition = (stageCode: string, newPos: number) => {
    const total = sortedStages.length;
    if (newPos < 1 || newPos > total) {
      toast.error(`أدخل رقماً بين 1 و ${total}`);
      return;
    }
    const currentIndex = sortedStages.findIndex((s: any) => s.stageCode === stageCode);
    if (currentIndex === -1 || currentIndex === newPos - 1) {
      setPosInputs((prev) => { const n = { ...prev }; delete n[stageCode]; return n; });
      return;
    }
    const reordered = [...sortedStages];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(newPos - 1, 0, moved);
    const updates = reordered.map((s: any, i: number) => ({ id: s.id, sortOrder: (i + 1) * 10 }));
    reorderMutation.mutate({ stages: updates });
    setPosInputs((prev) => { const n = { ...prev }; delete n[stageCode]; return n; });
  };

  const moveStep = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sortedStages.length) return;
    const current = sortedStages[index];
    const target = sortedStages[targetIndex];
    reorderMutation.mutate({
      stages: [
        { id: current.id, sortOrder: target.sortOrder ?? (targetIndex + 1) * 10 },
        { id: target.id, sortOrder: current.sortOrder ?? (index + 1) * 10 },
      ],
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm overflow-y-auto" dir="rtl">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Settings2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">إدارة مسار الامتثال</h2>
              <p className="text-xs text-muted-foreground">إضافة وتعديل وحذف المراحل والخدمات والمتطلبات</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="gap-1.5">
            <X className="w-4 h-4" />
            إغلاق
          </Button>
        </div>

        {/* Warning note */}
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 text-xs text-amber-700">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>التغييرات هنا تؤثر على <strong>جميع المشاريع</strong> وتنعكس فوراً على المسار والجدول. الحذف لا يمكن التراجع عنه.</p>
        </div>

        {/* Stages list */}
        {stagesQuery.isLoading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">جاري التحميل...</div>
        ) : (
          <div className="space-y-3">
            {sortedStages.map((stage: any, index: number) => (
              <div key={stage.stageCode} className="flex items-start gap-2">
                {/* Position control column */}
                <div className="flex flex-col items-center gap-1 pt-3 shrink-0">
                  {/* Current position badge */}
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">{index + 1}</span>
                  </div>
                  {/* Up/Down buttons */}
                  <button
                    disabled={index === 0 || reorderMutation.isPending}
                    onClick={() => moveStep(index, "up")}
                    className="w-6 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronDown className="w-3 h-3 rotate-180" />
                  </button>
                  <button
                    disabled={index === sortedStages.length - 1 || reorderMutation.isPending}
                    onClick={() => moveStep(index, "down")}
                    className="w-6 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {/* Direct position input */}
                  <div className="flex items-center gap-0.5 mt-0.5">
                    <Input
                      type="number"
                      min={1}
                      max={sortedStages.length}
                      value={posInputs[stage.stageCode] ?? ""}
                      placeholder="#"
                      className="w-10 h-6 text-center text-xs px-1 py-0"
                      onChange={(e) => setPosInputs((prev) => ({ ...prev, [stage.stageCode]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const val = parseInt(posInputs[stage.stageCode] ?? "", 10);
                          if (!isNaN(val)) moveToPosition(stage.stageCode, val);
                        }
                        if (e.key === "Escape") setPosInputs((prev) => { const n = { ...prev }; delete n[stage.stageCode]; return n; });
                      }}
                    />
                    {posInputs[stage.stageCode] && (
                      <button
                        disabled={reorderMutation.isPending}
                        onClick={() => {
                          const val = parseInt(posInputs[stage.stageCode] ?? "", 10);
                          if (!isNaN(val)) moveToPosition(stage.stageCode, val);
                        }}
                        className="w-6 h-6 flex items-center justify-center rounded text-amber-600 hover:bg-amber-50 disabled:opacity-50"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Stage card */}
                <div className="flex-1 min-w-0">
                  <StageAdminSection
                    key={stage.stageCode}
                    stage={stage}
                    onUpdated={() => stagesQuery.refetch()}
                  />
                </div>
              </div>
            ))}
            {addingStage ? (
              <AddStageForm
                onAdded={() => { setAddingStage(false); stagesQuery.refetch(); }}
                onCancel={() => setAddingStage(false)}
              />
            ) : (
              <button
                onClick={() => setAddingStage(true)}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-dashed border-primary/30 text-primary/70 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                إضافة مرحلة جديدة
              </button>
            )}
          </div>
        )}

        <div className="mt-4 p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 text-xs text-blue-600">
          لتغيير موضع مرحلة، اكتب الرقم الجديد في الحقل الصغير واضغط Enter أو ✓ — سيُعاد ترقيم جميع المراحل تلقائياً وينعكس على المسار والجدول فوراً.
        </div>
      </div>
    </div>
  );
}
