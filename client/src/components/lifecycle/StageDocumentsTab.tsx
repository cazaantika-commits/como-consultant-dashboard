/**
 * StageDocumentsTab — reusable component for any lifecycle service
 *
 * Shows all document requirements for a service with:
 * - Upload button per requirement
 * - Mandatory doc status (red if missing)
 * - Link to existing Drive file
 * - View / delete uploaded docs
 */
import { useState, useRef } from "react";
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
} from "lucide-react";
import { toast } from "sonner";

interface StageDocumentsTabProps {
  projectId: number;
  serviceCode: string;
}

export function StageDocumentsTab({ projectId, serviceCode }: StageDocumentsTabProps) {
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingReqCode, setUploadingReqCode] = useState<string | null>(null);

  const { data: docRecord, isLoading } = trpc.stageData.getDocuments.useQuery(
    { projectId, serviceCode },
    { enabled: !!projectId && !!serviceCode }
  );

  const uploadMutation = trpc.stageData.uploadDocument.useMutation({
    onSuccess: () => {
      utils.stageData.getDocuments.invalidate({ projectId, serviceCode });
      utils.stageData.getStageRecord.invalidate({ projectId, serviceCode });
      setUploadingReqCode(null);
      toast.success("تم رفع المستند بنجاح");
    },
    onError: () => {
      setUploadingReqCode(null);
      toast.error("فشل رفع المستند");
    },
  });

  const deleteMutation = trpc.stageData.deleteDocument.useMutation({
    onSuccess: () => {
      utils.stageData.getDocuments.invalidate({ projectId, serviceCode });
      utils.stageData.getStageRecord.invalidate({ projectId, serviceCode });
      toast.success("تم حذف المستند");
    },
    onError: () => {
      toast.error("فشل حذف المستند");
    },
  });

  const handleFileSelect = async (reqCode: string, file: File) => {
    setUploadingReqCode(reqCode);
    // Convert file to base64
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadMutation.mutate({
        projectId,
        serviceCode,
        requirementCode: reqCode,
        fileName: file.name,
        mimeType: file.type,
        fileBase64: base64,
      });
    };
    reader.readAsDataURL(file);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin ml-2" />
        جاري التحميل...
      </div>
    );
  }

  if (!docRecord || docRecord.requirements.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        لا توجد متطلبات مستندات لهذه الخدمة
      </div>
    );
  }

  const { requirements, stats } = docRecord;
  const progressPct = stats.total > 0 ? Math.round((stats.uploaded / stats.total) * 100) : 0;

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header: progress */}
      <div className="flex items-center gap-3">
        <div className="text-sm text-gray-600">
          <span className="font-semibold text-gray-900">{stats.uploaded}</span>
          <span className="mx-1">/</span>
          <span>{stats.total}</span>
          <span className="mr-1">مستند مرفوع</span>
        </div>
        <div className="w-32 bg-gray-200 rounded-full h-2">
          <div
            className="bg-green-500 h-2 rounded-full transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="text-xs text-gray-500">{progressPct}%</span>
        {stats.missingMandatory > 0 && (
          <Badge className="text-xs bg-red-100 text-red-700 border-red-200">
            <AlertCircle className="w-3 h-3 ml-1" />
            {stats.missingMandatory} مستند إلزامي ناقص
          </Badge>
        )}
      </div>

      {/* Requirements list */}
      <div className="space-y-3">
        {requirements.map((req: any) => {
          const hasDoc = req.documents && req.documents.length > 0;
          const isUploading = uploadingReqCode === req.requirementCode;

          return (
            <Card
              key={req.requirementCode}
              className={`border ${
                !hasDoc && req.isMandatory
                  ? "border-red-200 bg-red-50/30"
                  : hasDoc
                  ? "border-green-200 bg-green-50/20"
                  : "border-gray-200"
              }`}
            >
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-gray-700">
                    {req.nameAr}
                    {req.isMandatory && <span className="text-red-500 mr-1">*</span>}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {hasDoc ? (
                      <Badge className="text-xs bg-green-100 text-green-700 border-green-200">
                        <CheckCircle2 className="w-3 h-3 ml-1" />
                        مرفوع
                      </Badge>
                    ) : req.isMandatory ? (
                      <Badge className="text-xs bg-red-100 text-red-700 border-red-200">
                        <AlertCircle className="w-3 h-3 ml-1" />
                        مطلوب
                      </Badge>
                    ) : (
                      <Badge className="text-xs bg-gray-100 text-gray-500 border-gray-200">
                        اختياري
                      </Badge>
                    )}

                    {/* Upload button */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.xls"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileSelect(req.requirementCode, file);
                        e.target.value = "";
                      }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      disabled={isUploading}
                      onClick={() => {
                        setUploadingReqCode(req.requirementCode);
                        fileInputRef.current?.click();
                      }}
                    >
                      {isUploading ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Upload className="w-3 h-3" />
                      )}
                      {hasDoc ? "استبدال" : "رفع"}
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {/* Uploaded documents */}
              {hasDoc && (
                <CardContent className="px-4 pb-3 pt-0">
                  <div className="space-y-1">
                    {req.documents.map((doc: any) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between bg-white border border-gray-100 rounded px-3 py-1.5"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span className="text-xs text-gray-700 truncate">{doc.fileName}</span>
                          <span className="text-xs text-gray-400 shrink-0">
                            {new Date(doc.uploadedAt).toLocaleDateString("ar-AE")}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <a
                            href={doc.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 hover:bg-gray-100 rounded"
                          >
                            <ExternalLink className="w-3 h-3 text-gray-500" />
                          </a>
                          <button
                            className="p-1 hover:bg-red-50 rounded"
                            onClick={() =>
                              deleteMutation.mutate({ documentId: doc.id })
                            }
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="w-3 h-3 text-red-400" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
