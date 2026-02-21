import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import {
  Users, ArrowRight, Home, Check, Upload, FileText, X, Loader2
} from "lucide-react";

export default function NewMeetingPage() {
  const [, setLocation] = useLocation();
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [selectedAgents, setSelectedAgents] = useState<number[]>([]);
  const [pendingFiles, setPendingFiles] = useState<{ name: string; base64: string; mimeType: string }[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const { data: agentsList } = trpc.agents.list.useQuery();
  const createMeeting = trpc.meetings.create.useMutation();
  const uploadFile = trpc.meetings.uploadFile.useMutation();

  const toggleAgent = (id: number) => {
    setSelectedAgents(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (agentsList) {
      setSelectedAgents(agentsList.map((a: any) => a.id));
    }
  };

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        setPendingFiles(prev => [...prev, {
          name: file.name,
          base64,
          mimeType: file.type || "application/octet-stream",
        }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  }, []);

  const removeFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    if (!title.trim() || selectedAgents.length === 0) return;
    setIsCreating(true);
    try {
      const result = await createMeeting.mutateAsync({
        title: title.trim(),
        topic: topic.trim() || undefined,
        agentIds: selectedAgents,
      });

      // Upload pending files
      for (const file of pendingFiles) {
        await uploadFile.mutateAsync({
          meetingId: result.id,
          fileName: file.name,
          fileBase64: file.base64,
          mimeType: file.mimeType,
        });
      }

      setLocation(`/meetings/${result.id}`);
    } catch (err) {
      console.error("Failed to create meeting:", err);
      alert("حدث خطأ أثناء إنشاء الاجتماع");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-stone-200/60">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <button onClick={() => setLocation("/meetings")} className="p-2 rounded-xl hover:bg-stone-100 transition-colors">
            <ArrowRight className="w-5 h-5 text-stone-500" />
          </button>
          <div className="w-px h-6 bg-stone-200" />
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-200">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-stone-800">اجتماع جديد</h1>
              <p className="text-xs text-stone-500">حدد الموضوع واختر المشاركين</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Meeting Details */}
        <Card className="border-stone-200/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-stone-800 flex items-center gap-2">
              📋 تفاصيل الاجتماع
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-stone-600 mb-1.5 block">عنوان الاجتماع *</label>
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="مثال: مناقشة عرض استشاري XYZ لمشروع ند الشبا"
                className="text-right"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-stone-600 mb-1.5 block">الموضوع (اختياري)</label>
              <Textarea
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="وصف مختصر لما سيتم مناقشته في الاجتماع..."
                rows={3}
                className="text-right resize-none"
              />
            </div>
          </CardContent>
        </Card>

        {/* Agent Selection */}
        <Card className="border-stone-200/60">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold text-stone-800 flex items-center gap-2">
                👥 اختيار المشاركين
                {selectedAgents.length > 0 && (
                  <Badge className="bg-violet-100 text-violet-700 border-violet-200 text-xs">
                    {selectedAgents.length} مشارك
                  </Badge>
                )}
              </CardTitle>
              <Button variant="outline" size="sm" onClick={selectAll} className="text-xs">
                اختيار الكل
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {agentsList?.map((agent: any) => {
                const isSelected = selectedAgents.includes(agent.id);
                return (
                  <button
                    key={agent.id}
                    onClick={() => toggleAgent(agent.id)}
                    className={`relative p-3 rounded-xl border-2 transition-all text-center ${
                      isSelected
                        ? "border-violet-400 bg-violet-50 shadow-md"
                        : "border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm"
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                    <div className="w-12 h-12 rounded-full mx-auto mb-2 overflow-hidden border-2 border-white shadow-sm">
                      {agent.avatarUrl ? (
                        <img src={agent.avatarUrl} alt={agent.name} className="w-full h-full object-cover" />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center text-white font-bold"
                          style={{ backgroundColor: agent.color || "#6366f1" }}
                        >
                          {agent.name?.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="text-sm font-bold text-stone-800">{agent.name}</div>
                    <div className="text-[10px] text-stone-500 mt-0.5 leading-tight">{agent.role}</div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* File Upload */}
        <Card className="border-stone-200/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-stone-800 flex items-center gap-2">
              📎 ملفات للمناقشة (اختياري)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-stone-200 rounded-xl hover:border-violet-300 hover:bg-violet-50/30 transition-all cursor-pointer">
                <Upload className="w-8 h-8 text-stone-400 mb-2" />
                <span className="text-sm text-stone-500">اضغط لرفع ملفات (PDF, Word, Excel, صور)</span>
                <span className="text-xs text-stone-400 mt-1">يمكنك رفع عدة ملفات</span>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>

              {pendingFiles.length > 0 && (
                <div className="space-y-2">
                  {pendingFiles.map((file, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-stone-50 border border-stone-200">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-violet-500" />
                        <span className="text-sm text-stone-700">{file.name}</span>
                      </div>
                      <button
                        onClick={() => removeFile(i)}
                        className="p-1 rounded-md hover:bg-red-50 text-stone-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Create Button */}
        <div className="flex justify-center pb-8">
          <Button
            onClick={handleCreate}
            disabled={!title.trim() || selectedAgents.length === 0 || isCreating}
            className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white px-8 py-3 text-base shadow-lg shadow-violet-200 disabled:opacity-50"
          >
            {isCreating ? (
              <>
                <Loader2 className="w-5 h-5 ml-2 animate-spin" />
                جاري إنشاء الاجتماع...
              </>
            ) : (
              <>
                <Users className="w-5 h-5 ml-2" />
                بدء الاجتماع
              </>
            )}
          </Button>
        </div>
      </main>
    </div>
  );
}
