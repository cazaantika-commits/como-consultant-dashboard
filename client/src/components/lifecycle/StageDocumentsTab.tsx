/**
 * StageDocumentsTab — reusable component for any lifecycle service
 *
 * Shows all document requirements for a service with:
 * - Per-requirement upload button (each has its own hidden file input)
 * - Mandatory doc status (red if missing)
 * - Uploaded file preview: filename, open link, upload timestamp, replace support
 * - Delete uploaded doc
 */
import { useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Trash2,
  ExternalLink,
  Loader2,
  Clock,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

interface StageDocumentsTabProps {
  projectId: number;
  serviceCode: string;
}

// Per-requirement upload row
function RequirementUploadRow({
  req,
  projectId,
  serviceCode,
  onUploaded,
}: {
  req: any;
  projectId: number;
  serviceCode: string;
  onUploaded: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const utils = trpc.useUtils();

  const uploadMutation = trpc.stageData.uploadDocument.useMutation({
    onSuccess: () => {
      utils.stageData.getDocuments.invalidate({ projectId, serviceCode });
      utils.stageData.getStageRecord.invalidate({ projectId, serviceCode });
      setIsUploading(false);
      onUploaded();
      toast.success("تم رفع المستند بنجاح");
    },
    onError: () => {
      setIsUploading(false);
      toast.error("فشل رفع المستند");
    },
  });

  const deleteMutation = trpc.stageData.deleteDocument.useMutation({
    onSuccess: () => {
      utils.stageData.getDocuments.invalidate({ projectId, serviceCode });
      utils.stageData.getStageRecord.invalidate({ projectId, serviceCode });
      toast.success("تم حذف المستند");
    },
    onError: () => toast.error("فشل حذف المستند"),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadMutation.mutate({
        projectId,
        serviceCode,
        requirementCode: req.requirementCode,
        fileName: file.name,
        mimeType: file.type,
        fileBase64: base64,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const hasDoc = req.documents && req.documents.length > 0;
  const latestDoc = hasDoc ? req.documents[req.documents.length - 1] : null;

  return (
    <Card
      className={`border transition-all ${
        !hasDoc && req.isMandatory
          ? "border-red-200 bg-red-50/30"
          : hasDoc
          ? "border-emerald-200 bg-emerald-50/20"
          : "border-border"
      }`}
    >
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-start justify-between gap-3">
          {/* Requirement name */}
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm font-medium text-foreground leading-snug">
              {req.nameAr}
              {req.isMandatory && <span className="text-red-500 mr-1">*</span>}
            </CardTitle>
            {req.descriptionAr && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{req.descriptionAr}</p>
            )}
          </div>

          {/* Status badge + upload button */}
          <div className="flex items-center gap-2 shrink-0">
            {hasDoc ? (
              <Badge className="text-xs bg-emerald-100 text-emerald-700 border-emerald-200 gap-1">
                <CheckCircle2 className="w-3 h-3" />
                مرفوع
              </Badge>
            ) : req.isMandatory ? (
              <Badge className="text-xs bg-red-100 text-red-700 border-red-200 gap-1">
                <AlertCircle className="w-3 h-3" />
                مطلوب
              </Badge>
            ) : (
              <Badge className="text-xs bg-gray-100 text-gray-500 border-gray-200">
                اختياري
              </Badge>
            )}

            {/* Hidden file input per requirement */}
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.xls"
              onChange={handleFileChange}
            />
            <Button
              size="sm"
              variant={hasDoc ? "outline" : "default"}
              className="h-7 text-xs gap-1"
              disabled={isUploading || uploadMutation.isPending}
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading || uploadMutation.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : hasDoc ? (
                <RefreshCw className="w-3 h-3" />
              ) : (
                <Upload className="w-3 h-3" />
              )}
              {hasDoc ? "استبدال" : "رفع"}
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* Uploaded document preview */}
      {hasDoc && (
        <CardContent className="px-4 pb-3 pt-0">
          <div className="space-y-1.5">
            {req.documents.map((doc: any) => (
              <div
                key={doc.id}
                className="flex items-center justify-between bg-white dark:bg-card border border-emerald-100 rounded-lg px-3 py-2 gap-2"
              >
                {/* File info */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="w-7 h-7 rounded-md bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                    <FileText className="w-3.5 h-3.5 text-blue-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{doc.fileName}</p>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      <span>
                        {new Date(doc.uploadedAt).toLocaleString("ar-AE", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 hover:bg-blue-50 rounded-md transition-colors"
                    title="فتح الملف"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
                  </a>
                  <button
                    className="p-1.5 hover:bg-red-50 rounded-md transition-colors"
                    onClick={() => deleteMutation.mutate({ documentId: doc.id })}
                    disabled={deleteMutation.isPending}
                    title="حذف الملف"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export function StageDocumentsTab({ projectId, serviceCode }: StageDocumentsTabProps) {
  const utils = trpc.useUtils();

  const { data: docRecord, isLoading } = trpc.stageData.getDocuments.useQuery(
    { projectId, serviceCode },
    { enabled: !!projectId && !!serviceCode }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin ml-2" />
        جاري التحميل...
      </div>
    );
  }

  if (!docRecord || docRecord.requirements.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">لا توجد متطلبات مستندات لهذه الخدمة</p>
      </div>
    );
  }

  const { requirements, stats } = docRecord;
  const progressPct = stats.total > 0 ? Math.round((stats.uploaded / stats.total) * 100) : 0;

  return (
    <div className="space-y-4" dir="rtl">
      {/* Progress header */}
      <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border">
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>
              <span className="font-semibold text-foreground">{stats.uploaded}</span>
              {" / "}
              <span>{stats.total}</span>
              {" مستند مرفوع"}
            </span>
            <span className="font-semibold text-foreground">{progressPct}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                progressPct === 100 ? "bg-emerald-500" : progressPct > 0 ? "bg-blue-500" : "bg-gray-300"
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
        {stats.missingMandatory > 0 && (
          <Badge className="text-xs bg-red-100 text-red-700 border-red-200 gap-1 shrink-0">
            <AlertCircle className="w-3 h-3" />
            {stats.missingMandatory} إلزامي ناقص
          </Badge>
        )}
        {progressPct === 100 && (
          <Badge className="text-xs bg-emerald-100 text-emerald-700 border-emerald-200 gap-1 shrink-0">
            <CheckCircle2 className="w-3 h-3" />
            مكتمل
          </Badge>
        )}
      </div>

      {/* Requirements list */}
      <div className="space-y-3">
        {requirements.map((req: any) => (
          <RequirementUploadRow
            key={req.requirementCode}
            req={req}
            projectId={projectId}
            serviceCode={serviceCode}
            onUploaded={() => utils.stageData.getDocuments.invalidate({ projectId, serviceCode })}
          />
        ))}
      </div>
    </div>
  );
}
