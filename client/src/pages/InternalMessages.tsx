import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useCCAuth } from "@/contexts/CCAuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare, Send, Inbox, Archive, Plus, Search,
  AlertCircle, Info, ArrowRight, RefreshCw, Trash2,
  ChevronRight, Clock, CheckCheck, Eye
} from "lucide-react";

type MemberKey = "abdulrahman" | "wael" | "sheikh_issa";

const MEMBER_NAMES: Record<MemberKey, string> = {
  abdulrahman: "عبدالرحمن زقوط",
  wael: "وائل",
  sheikh_issa: "الشيخ عيسى",
};

const MEMBER_COLORS: Record<MemberKey, string> = {
  abdulrahman: "bg-emerald-100 text-emerald-800",
  wael: "bg-blue-100 text-blue-800",
  sheikh_issa: "bg-purple-100 text-purple-800",
};

const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
  normal: { label: "عادي", color: "bg-gray-100 text-gray-700" },
  important: { label: "مهم", color: "bg-amber-100 text-amber-700" },
  urgent: { label: "عاجل", color: "bg-red-100 text-red-700" },
};

const TYPE_LABELS: Record<string, string> = {
  instruction: "توجيه",
  inquiry: "استفسار",
  info: "معلومة",
  follow_up: "متابعة",
  other: "أخرى",
};

// Detect current member — prefer CCAuth (cc_token) over Manus OAuth guessing
function detectCurrentMemberFromOAuth(user: any): MemberKey {
  if (!user) return "abdulrahman";
  const name = (user.name || "").toLowerCase();
  const email = (user.email || "").toLowerCase();
  if (name.includes("wael") || email.includes("wael")) return "wael";
  if (name.includes("issa") || name.includes("عيسى") || email.includes("issa")) return "sheikh_issa";
  return "abdulrahman";
}

export default function InternalMessages({ ccTokenProp, memberIdProp }: { ccTokenProp?: string; memberIdProp?: string } = {}) {
  const { user } = useAuth();
  const { ccMember } = useCCAuth();
  const { toast } = useToast();
  // Priority: prop from CommandCenter > CCAuthContext > localStorage > OAuth guess
  const ccToken = ccTokenProp || localStorage.getItem("cc_token") || "";
  const currentMember: MemberKey = (
    memberIdProp ||
    ccMember?.memberId ||
    detectCurrentMemberFromOAuth(user)
  ) as MemberKey;

  const [view, setView] = useState<"inbox" | "sent" | "all">("inbox");
  const [isArchived, setIsArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [replyTo, setReplyTo] = useState<any>(null);

  // Compose form state
  const [composeForm, setComposeForm] = useState({
    toMember: "" as MemberKey | "",
    subject: "",
    body: "",
    priority: "normal" as "normal" | "important" | "urgent",
    messageType: "other" as "instruction" | "inquiry" | "info" | "follow_up" | "other",
  });

  const messagesQuery = trpc.internalMessages.getAll.useQuery({
    ccToken,
    view,
    isArchived,
    priority: "all",
    messageType: "all",
  }, { enabled: !!ccToken });

  const unreadQuery = trpc.internalMessages.getUnreadCount.useQuery({ ccToken }, { enabled: !!ccToken });

  const threadQuery = trpc.internalMessages.getById.useQuery(
    { ccToken, id: selectedId! },
    { enabled: !!selectedId && !!ccToken }
  );

  const utils = trpc.useUtils();

  const createMutation = trpc.internalMessages.create.useMutation({
    onSuccess: () => {
      toast({ title: "تم إرسال الرسالة بنجاح" });
      setShowCompose(false);
      setReplyTo(null);
      setComposeForm({ toMember: "", subject: "", body: "", priority: "normal", messageType: "other" });
      utils.internalMessages.getAll.invalidate();
      utils.internalMessages.getUnreadCount.invalidate();
    },
    onError: (e) => toast({ title: "خطأ في الإرسال", description: e.message, variant: "destructive" }),
  });

  const markReadMutation = trpc.internalMessages.markRead.useMutation({
    onSuccess: () => {
      utils.internalMessages.getAll.invalidate();
      utils.internalMessages.getUnreadCount.invalidate();
    },
  });

  const archiveMutation = trpc.internalMessages.archive.useMutation({
    onSuccess: () => {
      toast({ title: isArchived ? "تم إلغاء الأرشفة" : "تم الأرشفة" });
      setSelectedId(null);
      utils.internalMessages.getAll.invalidate();
    },
  });

  const deleteMutation = trpc.internalMessages.delete.useMutation({
    onSuccess: () => {
      toast({ title: "تم الحذف" });
      setSelectedId(null);
      utils.internalMessages.getAll.invalidate();
    },
  });

  const messages = (messagesQuery.data || []).filter((m: any) => {
    if (!search) return true;
    return (
      m.subject?.includes(search) ||
      m.body?.includes(search) ||
      m.fromMemberName?.includes(search) ||
      m.toMemberName?.includes(search)
    );
  });

  const selectedMessage = selectedId ? (threadQuery.data || [])[0] : null;
  const threadReplies = selectedId ? (threadQuery.data || []).slice(1) : [];

  function openMessage(msg: any) {
    setSelectedId(msg.id);
    if (!msg.is_read && msg.to_member === currentMember) {
      markReadMutation.mutate({ ccToken, id: msg.id });
    }
  }

  function handleCompose() {
    setReplyTo(null);
    setComposeForm({ toMember: "", subject: "", body: "", priority: "normal", messageType: "other" });
    setShowCompose(true);
  }

  function handleReply(msg: any) {
    const replyToMember = msg.from_member === currentMember ? msg.to_member : msg.from_member;
    setReplyTo(msg);
    setComposeForm({
      toMember: replyToMember as MemberKey,
      subject: msg.subject.startsWith("رد: ") ? msg.subject : `رد: ${msg.subject}`,
      body: "",
      priority: "normal",
      messageType: "follow_up",
    });
    setShowCompose(true);
  }

  function handleSend() {
    if (!composeForm.toMember || !composeForm.subject || !composeForm.body) {
      toast({ title: "يرجى ملء جميع الحقول المطلوبة", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      ccToken,
      toMember: composeForm.toMember as MemberKey,
      subject: composeForm.subject,
      body: composeForm.body,
      priority: composeForm.priority,
      messageType: composeForm.messageType,
      attachments: [],
      parentMessageId: replyTo?.id,
    });
  }

  const otherMembers = (Object.keys(MEMBER_NAMES) as MemberKey[]).filter((k) => k !== currentMember);

  // Guard: must be logged in via cc_token
  if (!ccToken) {
    return (
      <div className="h-full flex items-center justify-center" dir="rtl">
        <div className="text-center p-8 max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-indigo-100 flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-8 h-8 text-indigo-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">التواصل الداخلي</h2>
          <p className="text-gray-500 text-sm mb-4">
            يجب تسجيل الدخول عبر لوحة التحكم (cc_token) للوصول لهذه القناة.
          </p>
          <p className="text-xs text-gray-400">
            اضغط على "لوحة التحكم" في الصفحة الرئيسية وأدخل كلمة الدخول الخاصة بك.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">التواصل الداخلي</h1>
            <p className="text-sm text-gray-500">قناة التواصل بين فريق القيادة</p>
          </div>
          {(unreadQuery.data?.count || 0) > 0 && (
            <Badge className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">
              {unreadQuery.data?.count} جديد
            </Badge>
          )}
        </div>
        <Button onClick={handleCompose} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
          <Plus className="w-4 h-4" />
          رسالة جديدة
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 border-l bg-gray-50 flex flex-col">
          {/* View tabs */}
          <div className="p-3 space-y-1">
            {[
              { key: "inbox", label: "الوارد", icon: Inbox },
              { key: "sent", label: "المُرسَل", icon: Send },
              { key: "all", label: "الكل", icon: MessageSquare },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => { setView(key as any); setIsArchived(false); setSelectedId(null); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  view === key && !isArchived
                    ? "bg-indigo-600 text-white"
                    : "text-gray-600 hover:bg-gray-200"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
                {key === "inbox" && (unreadQuery.data?.count || 0) > 0 && (
                  <span className="mr-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {unreadQuery.data?.count}
                  </span>
                )}
              </button>
            ))}
            <button
              onClick={() => { setIsArchived(true); setSelectedId(null); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isArchived ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-200"
              }`}
            >
              <Archive className="w-4 h-4" />
              الأرشيف
            </button>
          </div>

          {/* Member quick info */}
          <div className="mt-auto p-3 border-t">
            <div className="text-xs text-gray-500 mb-2">أنت تتصفح كـ</div>
            <div className={`text-xs font-semibold px-2 py-1 rounded-lg ${MEMBER_COLORS[currentMember]}`}>
              {MEMBER_NAMES[currentMember]}
            </div>
          </div>
        </div>

        {/* Message List */}
        <div className="w-80 border-l bg-white flex flex-col">
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث في الرسائل..."
                className="pr-9 text-sm"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {messagesQuery.isLoading ? (
              <div className="flex items-center justify-center h-32 text-gray-400">
                <RefreshCw className="w-5 h-5 animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-400 gap-2">
                <MessageSquare className="w-8 h-8 opacity-30" />
                <span className="text-sm">لا توجد رسائل</span>
              </div>
            ) : (
              messages.map((msg: any) => {
                const isUnread = !msg.is_read && msg.to_member === currentMember;
                const priorityInfo = PRIORITY_LABELS[msg.priority] || PRIORITY_LABELS.normal;
                return (
                  <button
                    key={msg.id}
                    onClick={() => openMessage(msg)}
                    className={`w-full text-right p-3 border-b hover:bg-gray-50 transition-colors ${
                      selectedId === msg.id ? "bg-indigo-50 border-r-2 border-r-indigo-600" : ""
                    } ${isUnread ? "bg-blue-50" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${priorityInfo.color}`}>
                        {priorityInfo.label}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(msg.created_at).toLocaleDateString("ar-AE", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                    <p className={`text-sm mb-1 line-clamp-1 ${isUnread ? "font-bold text-gray-900" : "font-medium text-gray-700"}`}>
                      {msg.subject}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <span className={`px-1.5 py-0.5 rounded text-xs ${MEMBER_COLORS[msg.from_member as MemberKey] || "bg-gray-100"}`}>
                        {msg.fromMemberName}
                      </span>
                      <ChevronRight className="w-3 h-3" />
                      <span className={`px-1.5 py-0.5 rounded text-xs ${MEMBER_COLORS[msg.to_member as MemberKey] || "bg-gray-100"}`}>
                        {msg.toMemberName}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Message Detail */}
        <div className="flex-1 bg-white flex flex-col">
          {!selectedId ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
              <MessageSquare className="w-16 h-16 opacity-20" />
              <p className="text-lg">اختر رسالة للعرض</p>
              <Button variant="outline" onClick={handleCompose} className="gap-2 mt-2">
                <Plus className="w-4 h-4" />
                إنشاء رسالة جديدة
              </Button>
            </div>
          ) : threadQuery.isLoading ? (
            <div className="flex items-center justify-center h-full">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
            </div>
          ) : selectedMessage ? (
            <div className="flex flex-col h-full">
              {/* Message header */}
              <div className="p-4 border-b">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h2 className="text-lg font-bold text-gray-900 mb-2">{selectedMessage.subject}</h2>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${MEMBER_COLORS[selectedMessage.from_member as MemberKey] || "bg-gray-100"}`}>
                        من: {selectedMessage.fromMemberName}
                      </span>
                      <ArrowRight className="w-3 h-3 text-gray-400" />
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${MEMBER_COLORS[selectedMessage.to_member as MemberKey] || "bg-gray-100"}`}>
                        إلى: {selectedMessage.toMemberName}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs ${PRIORITY_LABELS[selectedMessage.priority]?.color}`}>
                        {PRIORITY_LABELS[selectedMessage.priority]?.label}
                      </span>
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(selectedMessage.created_at).toLocaleString("ar-AE")}
                      </span>
                      {selectedMessage.is_read ? (
                        <span className="text-xs text-green-600 flex items-center gap-1">
                          <CheckCheck className="w-3 h-3" /> مقروءة
                        </span>
                      ) : (
                        <span className="text-xs text-blue-600 flex items-center gap-1">
                          <Eye className="w-3 h-3" /> غير مقروءة
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleReply(selectedMessage)} className="gap-1">
                      <Send className="w-3.5 h-3.5" />
                      رد
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => archiveMutation.mutate({ ccToken, id: selectedMessage.id, archive: !isArchived })}
                      className="gap-1"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      {isArchived ? "إلغاء الأرشفة" : "أرشفة"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-red-600 hover:bg-red-50"
                      onClick={() => {
                        if (confirm("هل تريد حذف هذه الرسالة؟")) {
                          deleteMutation.mutate({ ccToken, id: selectedMessage.id });
                        }
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Message body + thread */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Original message */}
                <div className="bg-gray-50 rounded-xl p-4 border">
                  <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{selectedMessage.body}</p>
                </div>

                {/* Replies */}
                {threadReplies.map((reply: any) => (
                  <div
                    key={reply.id}
                    className={`rounded-xl p-4 border ${
                      reply.from_member === currentMember
                        ? "bg-indigo-50 border-indigo-200 mr-8"
                        : "bg-white border-gray-200 ml-8"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2 text-xs text-gray-500">
                      <span className={`px-2 py-0.5 rounded-full font-medium ${MEMBER_COLORS[reply.from_member as MemberKey] || "bg-gray-100"}`}>
                        {reply.fromMemberName}
                      </span>
                      <span>{new Date(reply.created_at).toLocaleString("ar-AE")}</span>
                    </div>
                    <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{reply.body}</p>
                  </div>
                ))}
              </div>

              {/* Quick reply */}
              <div className="p-3 border-t bg-gray-50">
                <Button onClick={() => handleReply(selectedMessage)} className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700">
                  <Send className="w-4 h-4" />
                  رد على هذه الرسالة
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Compose Dialog */}
      <Dialog open={showCompose} onOpenChange={setShowCompose}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-600" />
              {replyTo ? "رد على الرسالة" : "رسالة جديدة"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* From */}
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg text-sm">
              <span className="text-gray-500">من:</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${MEMBER_COLORS[currentMember]}`}>
                {MEMBER_NAMES[currentMember]}
              </span>
            </div>

            {/* To */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">إلى *</label>
              <Select
                value={composeForm.toMember}
                onValueChange={(v) => setComposeForm((f) => ({ ...f, toMember: v as MemberKey }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر المستقبل" />
                </SelectTrigger>
                <SelectContent>
                  {otherMembers.map((m) => (
                    <SelectItem key={m} value={m}>
                      {MEMBER_NAMES[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subject */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">الموضوع *</label>
              <Input
                value={composeForm.subject}
                onChange={(e) => setComposeForm((f) => ({ ...f, subject: e.target.value }))}
                placeholder="موضوع الرسالة..."
              />
            </div>

            {/* Priority + Type */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">الأولوية</label>
                <Select
                  value={composeForm.priority}
                  onValueChange={(v) => setComposeForm((f) => ({ ...f, priority: v as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">عادي</SelectItem>
                    <SelectItem value="important">مهم</SelectItem>
                    <SelectItem value="urgent">عاجل</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">نوع الرسالة</label>
                <Select
                  value={composeForm.messageType}
                  onValueChange={(v) => setComposeForm((f) => ({ ...f, messageType: v as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instruction">توجيه</SelectItem>
                    <SelectItem value="inquiry">استفسار</SelectItem>
                    <SelectItem value="info">معلومة</SelectItem>
                    <SelectItem value="follow_up">متابعة</SelectItem>
                    <SelectItem value="other">أخرى</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Body */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">نص الرسالة *</label>
              <Textarea
                value={composeForm.body}
                onChange={(e) => setComposeForm((f) => ({ ...f, body: e.target.value }))}
                placeholder="اكتب رسالتك هنا..."
                rows={6}
                className="resize-none"
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowCompose(false)}>
                إلغاء
              </Button>
              <Button
                onClick={handleSend}
                disabled={createMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 gap-2"
              >
                <Send className="w-4 h-4" />
                {createMutation.isPending ? "جاري الإرسال..." : "إرسال"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
