import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, CheckCircle, XCircle, Clock, TrendingUp, TrendingDown } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const statusColors: Record<string, string> = {
  pending: "bg-gray-500",
  processing: "bg-blue-500",
  completed: "bg-green-500",
  failed: "bg-red-500",
};

const statusLabels: Record<string, string> = {
  pending: "قيد الانتظار",
  processing: "جاري التحليل",
  completed: "مكتمل",
  failed: "فشل",
};

const statusIcons: Record<string, any> = {
  pending: Clock,
  processing: Clock,
  completed: CheckCircle,
  failed: XCircle,
};

export default function ProposalsPage() {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<any>(null);


  const utils = trpc.useUtils();

  const { data: proposals, isLoading } = trpc.proposals.list.useQuery({});
  const uploadMutation = trpc.proposals.upload.useMutation();
  const analyzeMutation = trpc.proposals.analyze.useMutation();

  // Extract text from PDF
  const extractTextFromPDF = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(" ");
      fullText += pageText + "\n";
    }
    
    return fullText;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
      alert("خطأ: يرجى اختيار ملف PDF فقط");
        return;
      }
      if (file.size > 16 * 1024 * 1024) {
      alert("خطأ: حجم الملف يجب أن يكون أقل من 16 ميجابايت");
        return;
      }
      setSelectedFile(file);
      if (!title) {
        setTitle(file.name.replace(".pdf", ""));
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !title) {
      alert("خطأ: يرجى اختيار ملف وإدخال عنوان");
      return;
    }

    setIsUploading(true);

    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.readAsDataURL(selectedFile);
      
      await new Promise((resolve, reject) => {
        reader.onload = resolve;
        reader.onerror = reject;
      });

      const base64Data = (reader.result as string).split(",")[1];

      // Upload file
      const uploadResult = await uploadMutation.mutateAsync({
        title,
        fileName: selectedFile.name,
        fileData: base64Data,
        mimeType: selectedFile.type,
      });

      // Success notification removed for simplicity

      // Extract text from PDF
      const extractedText = await extractTextFromPDF(selectedFile);

      // Analyze proposal
      await analyzeMutation.mutateAsync({
        proposalId: uploadResult.proposalId,
        extractedText,
      });

      alert("تم التحليل بنجاح");

      // Refresh list
      utils.proposals.list.invalidate();

      // Reset form
      setSelectedFile(null);
      setTitle("");
      setIsUploadOpen(false);
    } catch (error: any) {
      alert("خطأ: " + (error.message || "فشل رفع أو تحليل الملف"));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">عروض الاستشاريين</h1>
          <p className="text-muted-foreground">
            رفع وتحليل ومقارنة عروض الاستشاريين باستخدام الذكاء الاصطناعي
          </p>
        </div>
        <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="ml-2 h-4 w-4" />
              رفع عرض جديد
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>رفع عرض استشاري</DialogTitle>
              <DialogDescription>
                ارفع ملف PDF للعرض وسيتم تحليله تلقائياً
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">عنوان العرض</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: عرض شركة XYZ للمشروع ABC"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="file">ملف PDF</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".pdf"
                  onChange={handleFileSelect}
                />
                {selectedFile && (
                  <p className="text-sm text-muted-foreground">
                    {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsUploadOpen(false)}>
                إلغاء
              </Button>
              <Button onClick={handleUpload} disabled={isUploading || !selectedFile || !title}>
                {isUploading ? "جاري الرفع..." : "رفع وتحليل"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Proposals Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Proposals List */}
        <div className="space-y-4">
          {isLoading && (
            <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
          )}

          {!isLoading && proposals && proposals.length === 0 && (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>لا توجد عروض بعد</p>
                <p className="text-sm mt-2">ابدأ برفع عرض استشاري للتحليل</p>
              </CardContent>
            </Card>
          )}

          {proposals?.map((proposal: any) => {
            const StatusIcon = statusIcons[proposal.analysisStatus];
            return (
              <Card
                key={proposal.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedProposal(proposal)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <Badge className={statusColors[proposal.analysisStatus]}>
                          <StatusIcon className="h-3 w-3 ml-1" />
                          {statusLabels[proposal.analysisStatus]}
                        </Badge>
                        {proposal.aiScore && (
                          <Badge variant="outline">
                            {proposal.aiScore}/100
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-lg">{proposal.title}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {proposal.aiSummary && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {proposal.aiSummary}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{proposal.fileName}</span>
                    <span>{new Date(proposal.createdAt).toLocaleDateString('ar-SA')}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Detail View */}
        <div className="lg:sticky lg:top-6 lg:h-fit">
          {selectedProposal ? (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-5 w-5" />
                  <Badge className={statusColors[selectedProposal.analysisStatus]}>
                    {statusLabels[selectedProposal.analysisStatus]}
                  </Badge>
                  {selectedProposal.aiScore && (
                    <Badge variant="outline" className="text-lg">
                      {selectedProposal.aiScore}/100
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-2xl">{selectedProposal.title}</CardTitle>
                <CardDescription>
                  {selectedProposal.fileName} • {new Date(selectedProposal.createdAt).toLocaleDateString('ar-SA')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedProposal.analysisStatus === "completed" && (
                  <>
                    {selectedProposal.aiSummary && (
                      <div>
                        <h3 className="font-semibold mb-2">الملخص</h3>
                        <p className="text-sm">{selectedProposal.aiSummary}</p>
                      </div>
                    )}

                    {selectedProposal.aiKeyPoints && selectedProposal.aiKeyPoints.length > 0 && (
                      <div>
                        <h3 className="font-semibold mb-2">النقاط الرئيسية</h3>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          {selectedProposal.aiKeyPoints.map((point: string, idx: number) => (
                            <li key={idx}>{point}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {selectedProposal.aiStrengths && selectedProposal.aiStrengths.length > 0 && (
                      <div>
                        <h3 className="font-semibold mb-2 flex items-center gap-2 text-green-600">
                          <TrendingUp className="h-4 w-4" />
                          نقاط القوة
                        </h3>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          {selectedProposal.aiStrengths.map((strength: string, idx: number) => (
                            <li key={idx}>{strength}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {selectedProposal.aiWeaknesses && selectedProposal.aiWeaknesses.length > 0 && (
                      <div>
                        <h3 className="font-semibold mb-2 flex items-center gap-2 text-red-600">
                          <TrendingDown className="h-4 w-4" />
                          نقاط الضعف
                        </h3>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          {selectedProposal.aiWeaknesses.map((weakness: string, idx: number) => (
                            <li key={idx}>{weakness}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {selectedProposal.aiRecommendation && (
                      <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                        <h3 className="font-semibold mb-2">التوصية</h3>
                        <p className="text-sm">{selectedProposal.aiRecommendation}</p>
                      </div>
                    )}

                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => window.open(selectedProposal.fileUrl, "_blank")}
                    >
                      <FileText className="ml-2 h-4 w-4" />
                      عرض الملف الأصلي
                    </Button>
                  </>
                )}

                {selectedProposal.analysisStatus === "pending" && (
                  <div className="py-8 text-center text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>قيد الانتظار للتحليل</p>
                  </div>
                )}

                {selectedProposal.analysisStatus === "processing" && (
                  <div className="py-8 text-center text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-4 opacity-50 animate-spin" />
                    <p>جاري التحليل...</p>
                  </div>
                )}

                {selectedProposal.analysisStatus === "failed" && (
                  <div className="py-8 text-center text-red-600">
                    <XCircle className="h-12 w-12 mx-auto mb-4" />
                    <p>فشل التحليل</p>
                    {selectedProposal.analysisError && (
                      <p className="text-sm mt-2">{selectedProposal.analysisError}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>اختر عرضاً لعرض التفاصيل</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
