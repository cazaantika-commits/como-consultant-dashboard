/**
 * StageDataTab — reusable component for any lifecycle service
 *
 * Shows all data fields for a service with:
 * - "تحديث من بطاقة المشروع" sync button
 * - Per-field status badge: synced (blue) / manual (amber) / empty (red)
 * - Inline editing with save
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw, CheckCircle2, AlertCircle, Edit3, Save, X } from "lucide-react";
import { toast } from "sonner";

interface StageDataTabProps {
  projectId: number;
  serviceCode: string;
}

type FieldStatus = "synced" | "manual" | "empty";

function getStatusBadge(status: FieldStatus, isMandatory: boolean) {
  if (status === "synced") {
    return (
      <Badge className="text-xs bg-blue-100 text-blue-700 border-blue-200">
        <CheckCircle2 className="w-3 h-3 ml-1" />
        مستورد من البطاقة
      </Badge>
    );
  }
  if (status === "manual") {
    return (
      <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-200">
        <Edit3 className="w-3 h-3 ml-1" />
        إدخال يدوي
      </Badge>
    );
  }
  // empty
  if (isMandatory) {
    return (
      <Badge className="text-xs bg-red-100 text-red-700 border-red-200">
        <AlertCircle className="w-3 h-3 ml-1" />
        مطلوب
      </Badge>
    );
  }
  return (
    <Badge className="text-xs bg-gray-100 text-gray-500 border-gray-200">
      فارغ
    </Badge>
  );
}

export function StageDataTab({ projectId, serviceCode }: StageDataTabProps) {
  const utils = trpc.useUtils();
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const { data: stageRecord, isLoading } = trpc.stageData.getStageRecord.useQuery(
    { projectId, serviceCode },
    { enabled: !!projectId && !!serviceCode }
  );

  const syncMutation = trpc.stageData.syncFromProjectCard.useMutation({
    onSuccess: (data) => {
      utils.stageData.getStageRecord.invalidate({ projectId, serviceCode });
      toast.success(`تم استيراد ${data.synced} حقل من بطاقة المشروع`);
    },
    onError: () => {
      toast.error("فشل التحديث من بطاقة المشروع");
    },
  });

  const upsertMutation = trpc.stageData.upsertFieldValue.useMutation({
    onSuccess: () => {
      utils.stageData.getStageRecord.invalidate({ projectId, serviceCode });
      setEditingField(null);
      toast.success("تم حفظ القيمة بنجاح");
    },
    onError: () => {
      toast.error("فشل حفظ القيمة");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        <RefreshCw className="w-5 h-5 animate-spin ml-2" />
        جاري التحميل...
      </div>
    );
  }

  if (!stageRecord) {
    return (
      <div className="text-center py-12 text-gray-400">
        لا توجد بيانات لهذه الخدمة
      </div>
    );
  }

  const { fields, blocking } = stageRecord;
  const syncableFields = fields.filter((f: any) => f.projectCardField);
  const totalFields = fields.length;
  const filledFields = fields.filter((f: any) => f.savedValue).length;
  const progressPct = totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header: progress + sync button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">{filledFields}</span>
            <span className="mx-1">/</span>
            <span>{totalFields}</span>
            <span className="mr-1">حقل مكتمل</span>
          </div>
          <div className="w-32 bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-xs text-gray-500">{progressPct}%</span>
        </div>

        {syncableFields.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => syncMutation.mutate({ projectId, serviceCode })}
            disabled={syncMutation.isPending}
            className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
            تحديث من بطاقة المشروع
          </Button>
        )}
      </div>

      {/* Blocking alert */}
      {blocking.total > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 inline ml-1" />
          <span className="font-medium">{blocking.total} بند إلزامي ناقص</span>
          {" — "}يجب إكمالها قبل التقديم
        </div>
      )}

      {/* Fields grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {fields.map((field: any) => {
          const isEditing = editingField === field.fieldKey;
          const status: FieldStatus = field.savedValue
            ? (field.valueSource === "project_card" ? "synced" : "manual")
            : "empty";

          return (
            <Card
              key={field.fieldKey}
              className={`border ${
                status === "empty" && field.isMandatory
                  ? "border-red-200 bg-red-50/30"
                  : status === "synced"
                  ? "border-blue-100 bg-blue-50/20"
                  : "border-gray-200"
              }`}
            >
              <CardHeader className="pb-1 pt-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-gray-700">
                    {field.labelAr}
                    {field.isMandatory && <span className="text-red-500 mr-1">*</span>}
                  </CardTitle>
                  {getStatusBadge(status, field.isMandatory)}
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                {isEditing ? (
                  <div className="flex gap-2">
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="h-8 text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          upsertMutation.mutate({ projectId, serviceCode, fieldKey: field.fieldKey, value: editValue });
                        }
                        if (e.key === "Escape") setEditingField(null);
                      }}
                    />
                    <Button
                      size="sm"
                      className="h-8 px-2"
                      onClick={() =>
                        upsertMutation.mutate({ projectId, serviceCode, fieldKey: field.fieldKey, value: editValue })
                      }
                      disabled={upsertMutation.isPending}
                    >
                      <Save className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2"
                      onClick={() => setEditingField(null)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <div
                    className="flex items-center justify-between group cursor-pointer"
                    onClick={() => {
                      setEditingField(field.fieldKey);
                      setEditValue(field.savedValue ?? "");
                    }}
                  >
                    <span className={`text-sm ${field.savedValue ? "text-gray-900" : "text-gray-400 italic"}`}>
                      {field.savedValue ?? "انقر للإدخال..."}
                    </span>
                    <Edit3 className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                )}
                {field.syncedAt && status === "synced" && (
                  <p className="text-xs text-blue-400 mt-1">
                    آخر مزامنة: {new Date(field.syncedAt).toLocaleDateString("ar-AE")}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
