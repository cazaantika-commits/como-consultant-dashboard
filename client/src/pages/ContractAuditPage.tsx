import { useState } from "react";
import { ArrowLeft, Upload, FileText, Loader2, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

interface ContractAnalysis {
  id: string;
  fileName: string;
  uploadDate: string;
  status: "analyzing" | "completed" | "error";
  summary?: string;
  risks?: string[];
  recommendations?: string[];
  error?: string;
}

export function ContractAuditPage({ onBack }: { onBack: () => void }) {
  const [contracts, setContracts] = useState<ContractAnalysis[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("حجم الملف يجب أن يكون أقل من 10 MB");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("الرجاء اختيار ملف");
      return;
    }

    setUploading(true);
    const newContract: ContractAnalysis = {
      id: Date.now().toString(),
      fileName: selectedFile.name,
      uploadDate: new Date().toLocaleString("ar-AE"),
      status: "analyzing",
    };

    setContracts([newContract, ...contracts]);
    setSelectedFile(null);

    try {
      // Simulate AI analysis
      await new Promise((resolve) => setTimeout(resolve, 3000));

      setContracts((prev) =>
        prev.map((c) =>
          c.id === newContract.id
            ? {
                ...c,
                status: "completed",
                summary: "العقد يتضمن شروطاً قياسية مع بعض النقاط التي تحتاج إلى مراجعة",
                risks: [
                  "شروط الإنهاء قد تكون غير واضحة",
                  "آلية الدفع تحتاج إلى تحديد أدق",
                  "مدة العقد قد تكون طويلة جداً",
                ],
                recommendations: [
                  "إضافة بند عن الملكية الفكرية",
                  "توضيح شروط الخصوصية والبيانات",
                  "تحديد آلية فض النزاعات",
                ],
              }
            : c
        )
      );

      toast.success("تم تحليل العقد بنجاح");
    } catch (error) {
      setContracts((prev) =>
        prev.map((c) =>
          c.id === newContract.id
            ? {
                ...c,
                status: "error",
                error: "حدث خطأ أثناء تحليل العقد",
              }
            : c
        )
      );
      toast.error("خطأ في تحليل العقد");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (id: string) => {
    setContracts((prev) => prev.filter((c) => c.id !== id));
    toast.success("تم حذف العقد");
  };

  return (
    <div className="space-y-6 animate-in fade-in" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="text-slate-500 hover:text-slate-700 -mr-2"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">تدقيق وتحليل العقود</h2>
          <p className="text-sm text-slate-500">حلل العقود باستخدام الذكاء الاصطناعي</p>
        </div>
      </div>

      {/* Upload Section */}
      <Card className="p-6 border-2 border-dashed border-slate-300 hover:border-red-400 transition-colors">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center">
              <Upload className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">رفع عقد للتحليل</h3>
              <p className="text-sm text-slate-500">PDF، Word، أو صور (حتى 10 MB)</p>
            </div>
          </div>

          <div className="flex gap-3">
            <input
              type="file"
              id="file-input"
              onChange={handleFileSelect}
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              className="hidden"
              disabled={uploading}
            />
            <Button
              onClick={() => document.getElementById("file-input")?.click()}
              disabled={uploading}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              اختيار ملف
            </Button>
            {selectedFile && (
              <span className="text-sm text-slate-600 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                {selectedFile.name}
              </span>
            )}
          </div>

          <Button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                جاري التحليل...
              </>
            ) : (
              "تحليل العقد"
            )}
          </Button>
        </div>
      </Card>

      {/* Analysis Results */}
      <div className="space-y-4">
        {contracts.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>لم يتم رفع أي عقود بعد</p>
          </div>
        ) : (
          contracts.map((contract) => (
            <Card key={contract.id} className="p-6 space-y-4 animate-in fade-in">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      contract.status === "analyzing"
                        ? "bg-blue-100"
                        : contract.status === "completed"
                          ? "bg-green-100"
                          : "bg-red-100"
                    }`}
                  >
                    {contract.status === "analyzing" ? (
                      <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                    ) : contract.status === "completed" ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-800">{contract.fileName}</h4>
                    <p className="text-sm text-slate-500">{contract.uploadDate}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(contract.id)}
                  className="text-slate-400 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              {contract.status === "completed" && contract.summary && (
                <div className="space-y-3 border-t pt-4">
                  <div>
                    <h5 className="font-semibold text-slate-700 mb-2">الملخص</h5>
                    <p className="text-sm text-slate-600">{contract.summary}</p>
                  </div>

                  {contract.risks && contract.risks.length > 0 && (
                    <div>
                      <h5 className="font-semibold text-slate-700 mb-2 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600" />
                        المخاطر المحتملة
                      </h5>
                      <ul className="space-y-1">
                        {contract.risks.map((risk, idx) => (
                          <li key={idx} className="text-sm text-slate-600 flex gap-2">
                            <span className="text-red-600">•</span>
                            {risk}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {contract.recommendations && contract.recommendations.length > 0 && (
                    <div>
                      <h5 className="font-semibold text-slate-700 mb-2 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        التوصيات
                      </h5>
                      <ul className="space-y-1">
                        {contract.recommendations.map((rec, idx) => (
                          <li key={idx} className="text-sm text-slate-600 flex gap-2">
                            <span className="text-green-600">✓</span>
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {contract.status === "error" && contract.error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  {contract.error}
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
