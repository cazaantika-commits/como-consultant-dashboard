import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useCCAuth } from "@/contexts/CCAuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare, Send, Inbox, Archive, Plus, Search,
  AlertCircle, RefreshCw, Trash2, Reply, Paperclip,
  Link2, CheckSquare, FolderOpen, X, Download, Calendar,
  CheckCheck, ArchiveX, Clock
} from "lucide-react";

type MemberKey = "abdulrahman" | "wael" | "sheikh_issa";

const MEMBER_NAMES: Record<MemberKey, string> = {
  abdulrahman: "عبدالرحمن زقوت",
  wael: "وائل",
  sheikh_issa: "الشيخ عيسى",
};

const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
  normal: { label: "عادي", color: "bg-gray-100 text-gray-700" },
  important: { label: "مهم", color: "bg-amber-100 text-amber-700" },
  urgent: { label: "عاجل", color: "bg-red-100 text-red-700" },
};

const TYPE_LABELS: Record<string, string> = {
  instruction: "توجيه",
  inquiry: "استفسار",
  info: "إحاطة",
  follow_up: "متابعة",
  other: "أخرى",
};

function formatDate(d: string | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleString("ar-AE", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function deadlineInfo(d: string | null | undefined) {
  if (!d) return null;
  const diff = new Date(d).getTime() - Date.now();
  const days = Math.ceil(diff / 86400000);
  const formatted = new Date(d).toLocaleDateString("ar-AE", { year: "numeric", month: "short", day: "numeric" });
  if (days < 0) return { text: `متأخر ${Math.abs(days)} يوم`, color: "text-red-600", formatted };
  if (days === 0) return { text: "اليوم", color: "text-orange-600", formatted };
  if (days <= 3) return { text: `بعد ${days} أيام`, color: "text-amber-600", formatted };
  return { text: `بعد ${days} يوم`, color: "text-green-600", formatted };
}

export default function InternalMessages({ ccTokenProp, memberIdProp }: { ccTokenProp?: string; memberIdProp?: string } = {}) {
  const { ccMember } = useCCAuth();
  const { toast } = useToast();

  const ccToken = ccTokenProp || localStorage.getItem("cc_token") || "";
  const currentMember: MemberKey = (memberIdProp || ccMember?.memberId || "abdulrahman") as MemberKey;

  const [view, setView] = useState<"inbox" | "sent" | "all">("inbox");
  const [isArchived, setIsArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [projectFilter, setProjectFilter] = useState<number | null | undefined>(undefined);

  const emptyCompose = {
    toMember: "" as MemberKey | "",
    subject: "",
    body: "",
    priority: "normal" as "normal" | "important" | "urgent",
    messageType: "other" as "instruction" | "inquiry" | "info" | "follow_up" | "other",
    projectId: null as number | null,
    projectName: null as string | null,
    deadline: "",
    attachmentUrl: "",
    attachmentName: "",
    attachmentMode: "none" as "none" | "file" | "link",
  };
  const [form, setForm] = useState(emptyCompose);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const utils = trpc.useUtils();

  const messagesQ = trpc.internalMessages.getAll.useQuery(
    { ccToken, view, isArchived, priority: "all", messageType: "all", projectId: projectFilter },
    { enabled: !!ccToken, refetchInterval: 30000 }
  );

  const unreadQ = trpc.internalMessages.getUnreadCount.useQuery(
    { ccToken }, { enabled: !!ccToken, refetchInterval: 30000 }
  );

  const projectsQ = trpc.internalMessages.getProjects.useQuery(
    { ccToken }, { enabled: !!ccToken }
  );

  const threadQ = trpc.internalMessages.getById.useQuery(
    { ccToken, id: selectedId! },
    { enabled: !!selectedId && !!ccToken }
  );

  const uploadMutation = trpc.internalMessages.uploadAttachment.useMutation({
    onSuccess: (data) => {
      setForm(f => ({ ...f, attachmentUrl: data.url, attachmentName: data.name }));
      setUploading(false);
      toast({ title: "تم رفع الملف بنجاح" });
    },
    onError: (e) => { setUploading(false); toast({ title: "فشل رفع الملف", description: e.message, variant: "destructive" }); },
  });

  const createMutation = trpc.internalMessages.create.useMutation({
    onSuccess: () => {
      toast({ title: "تم إرسال الرسالة بنجاح" });
      setShowCompose(false); setReplyTo(null); setForm(emptyCompose);
      utils.internalMessages.getAll.invalidate();
      utils.internalMessages.getUnreadCount.invalidate();
    },
    onError: (e) => toast({ title: "خطأ في الإرسال", description: e.message, variant: "destructive" }),
  });

  const markReadMutation = trpc.internalMessages.markRead.useMutation({
    onSuccess: () => { utils.internalMessages.getAll.invalidate(); utils.internalMessages.getUnreadCount.invalidate(); },
  });

  const archiveMutation = trpc.internalMessages.archive.useMutation({
    onSuccess: () => { toast({ title: "تم" }); setSelectedId(null); utils.internalMessages.getAll.invalidate(); },
  });

  const deleteMutation = trpc.internalMessages.delete.useMutation({
    onSuccess: () => { toast({ title: "تم الحذف" }); setSelectedId(null); utils.internalMessages.getAll.invalidate(); },
  });

  const convertMutation = trpc.internalMessages.convertToTask.useMutation({
    onSuccess: (data) => {
      if (data.success) { toast({ title: `تم تحويلها لمهمة: ${data.taskRef}` }); utils.internalMessages.getAll.invalidate(); }
      else toast({ title: "فشل التحويل", variant: "destructive" });
    },
  });

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 16 * 1024 * 1024) { toast({ title: "الملف أكبر من 16 ميجابايت", variant: "destructive" }); return; }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = (ev.target?.result as string).split(",")[1];
      uploadMutation.mutate({ ccToken, fileName: file.name, fileBase64: base64, mimeType: file.type });
    };
    reader.readAsDataURL(file);
  }, [ccToken, uploadMutation]);

  const messages = (messagesQ.data || []).filter((m: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return m.subject?.toLowerCase().includes(q) || m.body?.toLowerCase().includes(q) ||
      m.fromMemberName?.toLowerCase().includes(q) || m.projectName?.toLowerCase().includes(q);
  });

  const thread = threadQ.data || [];
  const selectedMsg = thread[0] || null;
  const replies = thread.slice(1);

  function openMessage(msg: any) {
    setSelectedId(msg.id);
    if (!msg.is_read && msg.to_member === currentMember) markReadMutation.mutate({ ccToken, id: msg.id });
  }

  function handleReply(msg: any) {
    const to = msg.from_member === currentMember ? msg.to_member : msg.from_member;
    setReplyTo(msg);
    setForm({ ...emptyCompose, toMember: to as MemberKey, subject: msg.subject.startsWith("رد: ") ? msg.subject : `رد: ${msg.subject}`, messageType: "follow_up" });
    setShowCompose(true);
  }

  function handleSend() {
    if (!form.toMember || !form.subject || !form.body) {
      toast({ title: "يرجى ملء الحقول المطلوبة", variant: "destructive" }); return;
    }
    createMutation.mutate({
      ccToken, toMember: form.toMember as MemberKey, subject: form.subject, body: form.body,
      priority: form.priority, messageType: form.messageType, attachments: [],
      parentMessageId: replyTo?.id,
      projectId: form.projectId, projectName: form.projectName,
      deadline: form.deadline || null,
      attachmentUrl: form.attachmentUrl || null,
      attachmentName: form.attachmentName || null,
    });
  }

  const otherMembers = (Object.keys(MEMBER_NAMES) as MemberKey[]).filter(k => k !== currentMember);
  const projects = projectsQ.data || [];
  const unreadCount = unreadQ.data?.count || 0;

  if (!ccToken) {
    return (
      <div className="h-full flex items-center justify-center" dir="rtl">
        <div className="text-center p-8 max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-indigo-100 flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-8 h-8 text-indigo-600" />
          </div>
          <h2 className="text-xl font-bold mb-2">التواصل الداخلي</h2>
          <p className="text-sm text-muted-foreground mb-2">يجب تسجيل الدخول عبر لوحة التحكم للوصول لهذه القناة.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-card">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">التواصل الداخلي</h1>
            <p className="text-xs text-muted-foreground">قناة التواصل بين فريق القيادة</p>
          </div>
          {unreadCount > 0 && (
            <Badge className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">{unreadCount} جديد</Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => { messagesQ.refetch(); unreadQ.refetch(); }} className="gap-1">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" onClick={() => { setReplyTo(null); setForm(emptyCompose); setShowCompose(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1">
            <Plus className="w-4 h-4" />
            رسالة جديدة
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-56 border-l bg-muted/30 flex flex-col shrink-0">
          <div className="p-3 space-y-1">
            {([
              { key: "inbox", label: "الوارد", icon: Inbox },
              { key: "sent", label: "المُرسَل", icon: Send },
              { key: "all", label: "الكل", icon: MessageSquare },
            ] as const).map(({ key, label, icon: Icon }) => (
              <button key={key}
                onClick={() => { setView(key); setIsArchived(false); setSelectedId(null); }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${view === key && !isArchived ? "bg-indigo-600 text-white" : "text-foreground hover:bg-accent"}`}
              >
                <Icon className="w-4 h-4" />
                {label}
                {key === "inbox" && unreadCount > 0 && (
                  <span className="mr-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{unreadCount}</span>
                )}
              </button>
            ))}
            <button
              onClick={() => { setIsArchived(true); setSelectedId(null); }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isArchived ? "bg-indigo-600 text-white" : "text-foreground hover:bg-accent"}`}
            >
              <Archive className="w-4 h-4" />
              الأرشيف
            </button>
          </div>

          {/* Project filter */}
          <div className="px-3 pb-3">
            <p className="text-xs text-muted-foreground mb-1 font-medium">فلتر المشروع</p>
            <Select
              value={projectFilter === undefined ? "all" : projectFilter === 0 ? "general" : String(projectFilter)}
              onValueChange={(v) => {
                if (v === "all") setProjectFilter(undefined);
                else if (v === "general") setProjectFilter(0);
                else setProjectFilter(Number(v));
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="كل المشاريع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المشاريع</SelectItem>
                <SelectItem value="general">عامة</SelectItem>
                {projects.map((p: any) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Search */}
          <div className="px-3 pb-3">
            <div className="relative">
              <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input className="h-8 text-xs pr-7" placeholder="بحث..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Messages list */}
        <div className="w-72 border-l flex flex-col overflow-y-auto shrink-0">
          {messagesQ.isLoading ? (
            <div className="text-center text-muted-foreground py-8 text-sm">جاري التحميل...</div>
          ) : messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 text-sm">لا توجد رسائل</div>
          ) : (
            messages.map((msg: any) => {
              const isUnread = !msg.is_read && msg.to_member === currentMember;
              const pr = PRIORITY_LABELS[msg.priority] || PRIORITY_LABELS.normal;
              const dl = deadlineInfo(msg.deadline);
              return (
                <div key={msg.id}
                  onClick={() => openMessage(msg)}
                  className={`p-3 border-b cursor-pointer transition-colors ${selectedId === msg.id ? "bg-indigo-50 dark:bg-indigo-950/30 border-r-2 border-r-indigo-500" : isUnread ? "bg-blue-50/50 dark:bg-blue-950/10" : "hover:bg-accent/40"}`}
                >
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <span className={`text-xs font-semibold truncate flex-1 ${isUnread ? "text-indigo-700 dark:text-indigo-300" : "text-foreground"}`}>{msg.subject}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${pr.color}`}>{pr.label}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    {view === "sent" ? `إلى: ${msg.toMemberName}` : `من: ${msg.fromMemberName}`}
                    {isUnread && <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {msg.projectName ? (
                      <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        <FolderOpen className="w-2.5 h-2.5" />{msg.projectName}
                      </span>
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">عامة</span>
                    )}
                    {dl && <span className={`text-xs ${dl.color} flex items-center gap-0.5`}><Calendar className="w-2.5 h-2.5" />{dl.text}</span>}
                    {msg.isConvertedToTask && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><CheckSquare className="w-2.5 h-2.5" />مهمة</span>}
                    {(msg.attachmentUrl || msg.attachment_url) && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Paperclip className="w-2.5 h-2.5" />مرفق</span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{formatDate(msg.created_at)}</div>
                </div>
              );
            })
          )}
        </div>

        {/* Message detail */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedMsg ? (
            <>
              <div className="p-4 border-b bg-card">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-bold text-base text-foreground flex-1">{selectedMsg.subject}</h3>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleReply(selectedMsg)} title="رد"><Reply className="w-3.5 h-3.5" /></Button>
                    {!selectedMsg.isConvertedToTask && (
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => convertMutation.mutate({ ccToken, id: selectedMsg.id })} title="تحويل لمهمة"><CheckSquare className="w-3.5 h-3.5" /></Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => archiveMutation.mutate({ ccToken, id: selectedMsg.id, archive: !selectedMsg.is_archived })} title="أرشفة">
                      {selectedMsg.is_archived ? <ArchiveX className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => { if (confirm("هل أنت متأكد من الحذف؟")) deleteMutation.mutate({ ccToken, id: selectedMsg.id }); }} title="حذف"><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mb-2">
                  <span>من: <strong className="text-foreground">{selectedMsg.fromMemberName}</strong></span>
                  <span>إلى: <strong className="text-foreground">{selectedMsg.toMemberName}</strong></span>
                  <span>{formatDate(selectedMsg.created_at)}</span>
                  <span className={`px-1.5 py-0.5 rounded-full ${PRIORITY_LABELS[selectedMsg.priority]?.color}`}>{PRIORITY_LABELS[selectedMsg.priority]?.label}</span>
                  <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{TYPE_LABELS[selectedMsg.message_type]}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedMsg.projectName ? (
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full flex items-center gap-1"><FolderOpen className="w-3 h-3" />{selectedMsg.projectName}</span>
                  ) : (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">عامة</span>
                  )}
                  {selectedMsg.deadline && (() => { const dl = deadlineInfo(selectedMsg.deadline); return dl ? <span className={`text-xs ${dl.color} flex items-center gap-1`}><Calendar className="w-3 h-3" />موعد نهائي: {dl.formatted} ({dl.text})</span> : null; })()}
                  {selectedMsg.isConvertedToTask && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full flex items-center gap-1"><CheckCheck className="w-3 h-3" />مهمة: {selectedMsg.taskRef}</span>}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {[selectedMsg, ...replies].map((msg: any, idx: number) => (
                  <div key={msg.id || idx} className={`p-3 rounded-lg ${msg.from_member === currentMember ? "bg-indigo-50 dark:bg-indigo-950/20 mr-8" : "bg-muted ml-8"}`}>
                    <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground">
                      <strong className="text-foreground">{msg.fromMemberName}</strong>
                      <span>{formatDate(msg.created_at)}</span>
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{msg.body}</p>
                    {(msg.attachmentUrl || msg.attachment_url) && (
                      <a href={msg.attachmentUrl || msg.attachment_url} target="_blank" rel="noopener noreferrer"
                        className="mt-2 flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
                        <Paperclip className="w-3 h-3" />
                        {msg.attachmentName || msg.attachment_name || "مرفق"}
                        <Download className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>

              <div className="p-3 border-t bg-card">
                <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => handleReply(selectedMsg)}>
                  <Reply className="w-3.5 h-3.5" />رد على هذه الرسالة
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              اختر رسالة لعرض تفاصيلها
            </div>
          )}
        </div>
      </div>

      {/* Compose Dialog */}
      <Dialog open={showCompose} onOpenChange={(open) => { if (!open) { setShowCompose(false); setReplyTo(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{replyTo ? `رد على: ${replyTo.subject}` : "رسالة جديدة"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* To */}
            <div>
              <label className="text-sm font-medium mb-1 block">إلى *</label>
              <Select value={form.toMember} onValueChange={v => setForm(f => ({ ...f, toMember: v as MemberKey }))}>
                <SelectTrigger><SelectValue placeholder="اختر المستلم" /></SelectTrigger>
                <SelectContent>
                  {otherMembers.map(m => <SelectItem key={m} value={m}>{MEMBER_NAMES[m]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {/* Subject */}
            {!replyTo && (
              <div>
                <label className="text-sm font-medium mb-1 block">الموضوع *</label>
                <Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="موضوع الرسالة" />
              </div>
            )}
            {/* Body */}
            <div>
              <label className="text-sm font-medium mb-1 block">نص الرسالة *</label>
              <Textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} placeholder="اكتب رسالتك هنا..." rows={4} />
            </div>
            {/* Priority + Type */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">الأولوية</label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">عادي</SelectItem>
                    <SelectItem value="important">مهم</SelectItem>
                    <SelectItem value="urgent">عاجل</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">نوع الرسالة</label>
                <Select value={form.messageType} onValueChange={v => setForm(f => ({ ...f, messageType: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instruction">توجيه</SelectItem>
                    <SelectItem value="inquiry">استفسار</SelectItem>
                    <SelectItem value="info">إحاطة</SelectItem>
                    <SelectItem value="follow_up">متابعة</SelectItem>
                    <SelectItem value="other">أخرى</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Project */}
            <div>
              <label className="text-sm font-medium mb-1 block flex items-center gap-1"><FolderOpen className="w-3.5 h-3.5" />المشروع</label>
              <Select
                value={form.projectId === null ? "general" : String(form.projectId)}
                onValueChange={v => {
                  if (v === "general") setForm(f => ({ ...f, projectId: null, projectName: null }));
                  else { const p = projects.find((x: any) => String(x.id) === v); setForm(f => ({ ...f, projectId: Number(v), projectName: p?.name || null })); }
                }}
              >
                <SelectTrigger><SelectValue placeholder="عامة (غير مرتبطة بمشروع)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">عامة (غير مرتبطة بمشروع)</SelectItem>
                  {projects.map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {/* Deadline */}
            <div>
              <label className="text-sm font-medium mb-1 block flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />الموعد النهائي (اختياري)</label>
              <Input type="datetime-local" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
            </div>
            {/* Attachment */}
            <div>
              <label className="text-sm font-medium mb-1 block">المرفق (اختياري)</label>
              <div className="flex gap-2 mb-2">
                <Button type="button" size="sm" variant={form.attachmentMode === "file" ? "default" : "outline"} className="gap-1 text-xs"
                  onClick={() => setForm(f => ({ ...f, attachmentMode: f.attachmentMode === "file" ? "none" : "file", attachmentUrl: "", attachmentName: "" }))}>
                  <Paperclip className="w-3 h-3" />رفع ملف
                </Button>
                <Button type="button" size="sm" variant={form.attachmentMode === "link" ? "default" : "outline"} className="gap-1 text-xs"
                  onClick={() => setForm(f => ({ ...f, attachmentMode: f.attachmentMode === "link" ? "none" : "link", attachmentUrl: "", attachmentName: "" }))}>
                  <Link2 className="w-3 h-3" />إضافة رابط
                </Button>
              </div>
              {form.attachmentMode === "file" && (
                <div>
                  <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip" />
                  {form.attachmentUrl ? (
                    <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg text-xs">
                      <Paperclip className="w-3.5 h-3.5 text-green-600" />
                      <span className="flex-1 text-green-700">{form.attachmentName}</span>
                      <Button type="button" size="icon" variant="ghost" className="h-5 w-5" onClick={() => setForm(f => ({ ...f, attachmentUrl: "", attachmentName: "" }))}><X className="w-3 h-3" /></Button>
                    </div>
                  ) : (
                    <Button type="button" variant="outline" size="sm" className="w-full gap-1 text-xs border-dashed" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                      {uploading ? <><RefreshCw className="w-3 h-3 animate-spin" />جاري الرفع...</> : <><Paperclip className="w-3 h-3" />اختر ملفاً (PDF, Word, Excel, صورة)</>}
                    </Button>
                  )}
                </div>
              )}
              {form.attachmentMode === "link" && (
                <div className="space-y-2">
                  <Input placeholder="اسم الرابط (مثال: تقرير المشروع)" value={form.attachmentName} onChange={e => setForm(f => ({ ...f, attachmentName: e.target.value }))} className="text-xs" />
                  <Input placeholder="الرابط (https://...)" value={form.attachmentUrl} onChange={e => setForm(f => ({ ...f, attachmentUrl: e.target.value }))} className="text-xs" dir="ltr" />
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="flex gap-2 mt-4">
            <Button variant="outline" onClick={() => { setShowCompose(false); setReplyTo(null); }}>إلغاء</Button>
            <Button onClick={handleSend} disabled={createMutation.isPending || uploading} className="gap-1 bg-indigo-600 hover:bg-indigo-700 text-white">
              {createMutation.isPending ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />جاري الإرسال...</> : <><Send className="w-3.5 h-3.5" />إرسال</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
