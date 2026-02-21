import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import {
  Users, Plus, Calendar, MessageSquare, FileText, Clock,
  CheckCircle, XCircle, ArrowRight, Home, Trash2, PlayCircle, BarChart3
} from "lucide-react";

const statusMap: Record<string, { label: string; color: string; icon: any }> = {
  preparing: { label: "قيد التحضير", color: "bg-amber-100 text-amber-700 border-amber-200", icon: Clock },
  in_progress: { label: "جاري", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: PlayCircle },
  completed: { label: "مكتمل", color: "bg-blue-100 text-blue-700 border-blue-200", icon: CheckCircle },
  cancelled: { label: "ملغي", color: "bg-red-100 text-red-700 border-red-200", icon: XCircle },
};

export default function MeetingsListPage() {
  const [, setLocation] = useLocation();
  const [filter, setFilter] = useState<string>("all");

  const { data: meetingsList, isLoading, refetch } = trpc.meetings.list.useQuery(
    filter !== "all" ? { status: filter as any } : undefined
  );
  const deleteMeeting = trpc.meetings.delete.useMutation({
    onSuccess: () => refetch(),
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-stone-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setLocation("/")} className="p-2 rounded-xl hover:bg-stone-100 transition-colors">
              <Home className="w-5 h-5 text-stone-500" />
            </button>
            <div className="w-px h-6 bg-stone-200" />
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-200">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-stone-800">غرفة الاجتماعات</h1>
                <p className="text-xs text-stone-500">اجتماعات تفاعلية مع فريق الوكلاء</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setLocation("/meetings/tracking")}
              className="border-violet-200 text-violet-600 hover:bg-violet-50"
            >
              <BarChart3 className="w-4 h-4 ml-2" />
              لوحة المتابعة
            </Button>
            <Button
              onClick={() => setLocation("/meetings/new")}
              className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white shadow-lg shadow-violet-200"
            >
              <Plus className="w-4 h-4 ml-2" />
              اجتماع جديد
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "الكل", value: meetingsList?.length || 0, filter: "all", gradient: "from-stone-500 to-stone-600" },
            { label: "قيد التحضير", value: meetingsList?.filter(m => m.status === "preparing").length || 0, filter: "preparing", gradient: "from-amber-500 to-orange-500" },
            { label: "جاري", value: meetingsList?.filter(m => m.status === "in_progress").length || 0, filter: "in_progress", gradient: "from-emerald-500 to-green-600" },
            { label: "مكتمل", value: meetingsList?.filter(m => m.status === "completed").length || 0, filter: "completed", gradient: "from-blue-500 to-indigo-600" },
          ].map((stat) => (
            <button
              key={stat.filter}
              onClick={() => setFilter(stat.filter)}
              className={`p-3 rounded-xl border transition-all ${
                filter === stat.filter
                  ? "border-violet-300 bg-violet-50 shadow-md"
                  : "border-stone-200 bg-white hover:border-stone-300"
              }`}
            >
              <div className={`text-2xl font-bold bg-gradient-to-r ${stat.gradient} bg-clip-text text-transparent`}>
                {stat.value}
              </div>
              <div className="text-xs text-stone-500 mt-1">{stat.label}</div>
            </button>
          ))}
        </div>

        {/* Meetings List */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 rounded-xl bg-stone-100 animate-pulse" />
            ))}
          </div>
        ) : !meetingsList || meetingsList.length === 0 ? (
          <Card className="border-dashed border-2 border-stone-200">
            <CardContent className="py-16 text-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center mx-auto mb-4">
                <Users className="w-10 h-10 text-violet-500" />
              </div>
              <h3 className="text-lg font-bold text-stone-800 mb-2">لا توجد اجتماعات بعد</h3>
              <p className="text-stone-500 mb-6">ابدأ بإنشاء اجتماع جديد مع فريق الوكلاء لمناقشة مشاريعك</p>
              <Button
                onClick={() => setLocation("/meetings/new")}
                className="bg-gradient-to-r from-violet-500 to-purple-600 text-white"
              >
                <Plus className="w-4 h-4 ml-2" />
                إنشاء أول اجتماع
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {meetingsList.map((meeting) => {
              const status = statusMap[meeting.status] || statusMap.preparing;
              const StatusIcon = status.icon;
              return (
                <Card
                  key={meeting.id}
                  className="border-stone-200/60 hover:border-violet-200 hover:shadow-lg transition-all cursor-pointer group"
                  onClick={() => setLocation(
                    meeting.status === "preparing" || meeting.status === "in_progress"
                      ? `/meetings/${meeting.id}`
                      : `/meetings/${meeting.id}`
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={`${status.color} border text-xs`}>
                            <StatusIcon className="w-3 h-3 ml-1" />
                            {status.label}
                          </Badge>
                          <span className="text-xs text-stone-400">
                            {new Date(meeting.createdAt).toLocaleDateString("ar-SA", {
                              year: "numeric", month: "short", day: "numeric",
                              hour: "2-digit", minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-stone-800 group-hover:text-violet-700 transition-colors mb-1">
                          {meeting.title}
                        </h3>
                        {meeting.topic && (
                          <p className="text-sm text-stone-500 mb-3">{meeting.topic}</p>
                        )}

                        {/* Participants */}
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex -space-x-2 space-x-reverse">
                            {meeting.participants.slice(0, 5).map((p: any) => (
                              <div
                                key={p.id}
                                className="w-7 h-7 rounded-full border-2 border-white shadow-sm overflow-hidden"
                                title={p.agentName}
                              >
                                {p.agentAvatar ? (
                                  <img src={p.agentAvatar} alt={p.agentName} className="w-full h-full object-cover" />
                                ) : (
                                  <div
                                    className="w-full h-full flex items-center justify-center text-white text-xs font-bold"
                                    style={{ backgroundColor: p.agentColor || "#6366f1" }}
                                  >
                                    {p.agentName?.charAt(0)}
                                  </div>
                                )}
                              </div>
                            ))}
                            {meeting.participants.length > 5 && (
                              <div className="w-7 h-7 rounded-full border-2 border-white bg-stone-100 flex items-center justify-center text-xs text-stone-500 font-bold">
                                +{meeting.participants.length - 5}
                              </div>
                            )}
                          </div>
                          <span className="text-xs text-stone-400">
                            {meeting.participants.length} مشارك
                          </span>
                        </div>

                        {/* Stats */}
                        <div className="flex items-center gap-4 text-xs text-stone-400">
                          <span className="flex items-center gap-1">
                            <MessageSquare className="w-3.5 h-3.5" />
                            {meeting.messageCount} رسالة
                          </span>
                          <span className="flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5" />
                            {meeting.fileCount} ملف
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("هل تريد حذف هذا الاجتماع؟")) {
                              deleteMeeting.mutate(meeting.id);
                            }
                          }}
                          className="p-2 rounded-lg hover:bg-red-50 text-stone-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <ArrowRight className="w-5 h-5 text-stone-300 group-hover:text-violet-500 transition-colors rotate-180" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
