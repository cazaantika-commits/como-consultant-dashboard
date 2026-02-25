import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Mail, Send, CheckCircle2, XCircle, Clock,
  ChevronDown, ChevronUp, RefreshCw, Search, Filter
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function SentEmailsPage() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "sent" | "failed">("all");

  const { data, isLoading, refetch } = trpc.sentEmails.list.useQuery({ limit: 100, offset: 0 });

  const emails = data?.emails || [];
  const total = data?.total || 0;

  // Filter emails
  const filteredEmails = emails.filter((email: any) => {
    const matchesSearch = !searchQuery || 
      email.toEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (email.toName && email.toName.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === "all" || email.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Stats
  const sentCount = emails.filter((e: any) => e.status === "sent").length;
  const failedCount = emails.filter((e: any) => e.status === "failed").length;

  const formatDate = (date: string | Date) => {
    const d = new Date(date);
    return d.toLocaleDateString("ar-AE", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return (
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1">
            <CheckCircle2 className="w-3 h-3" />
            تم الإرسال
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-100 text-red-700 border-red-200 gap-1">
            <XCircle className="w-3 h-3" />
            فشل
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-1">
            <Clock className="w-3 h-3" />
            قيد الانتظار
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSentByBadge = (sentBy: string) => {
    if (sentBy === "salwa") {
      return (
        <Badge className="bg-amber-50 text-amber-700 border-amber-200 gap-1 text-xs">
          🤖 سلوى
        </Badge>
      );
    }
    return (
      <Badge className="bg-blue-50 text-blue-700 border-blue-200 gap-1 text-xs">
        👤 يدوي
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="rounded-xl"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                <Send className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">سجل الإيميلات المرسلة</h1>
                <p className="text-sm text-muted-foreground">جميع الردود المرسلة عبر سلوى والنظام</p>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="gap-1.5"
          >
            <RefreshCw className="w-4 h-4" />
            تحديث
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/20 dark:to-blue-900/10">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center shadow-md shadow-blue-500/25">
                <Mail className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{total}</p>
                <p className="text-sm text-blue-600/70 dark:text-blue-400/70">إجمالي المرسل</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/20 dark:to-emerald-900/10">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center shadow-md shadow-emerald-500/25">
                <CheckCircle2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{sentCount}</p>
                <p className="text-sm text-emerald-600/70 dark:text-emerald-400/70">تم الإرسال بنجاح</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/20 dark:to-red-900/10">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-red-500 flex items-center justify-center shadow-md shadow-red-500/25">
                <XCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-700 dark:text-red-400">{failedCount}</p>
                <p className="text-sm text-red-600/70 dark:text-red-400/70">فشل في الإرسال</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="بحث بالعنوان أو الموضوع أو اسم المرسل إليه..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10 rounded-xl"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={statusFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("all")}
              className="rounded-xl"
            >
              الكل ({total})
            </Button>
            <Button
              variant={statusFilter === "sent" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("sent")}
              className="rounded-xl gap-1"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              ناجح ({sentCount})
            </Button>
            <Button
              variant={statusFilter === "failed" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("failed")}
              className="rounded-xl gap-1"
            >
              <XCircle className="w-3.5 h-3.5" />
              فشل ({failedCount})
            </Button>
          </div>
        </div>

        {/* Email List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3 text-muted-foreground">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>جاري تحميل السجل...</span>
            </div>
          </div>
        ) : filteredEmails.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {searchQuery || statusFilter !== "all" ? "لا توجد نتائج" : "لا توجد إيميلات مرسلة بعد"}
              </h3>
              <p className="text-muted-foreground text-sm">
                {searchQuery || statusFilter !== "all"
                  ? "جرب تغيير معايير البحث أو الفلتر"
                  : "عندما ترسل سلوى ردوداً على الإيميلات، ستظهر هنا"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredEmails.map((email: any) => (
              <Card
                key={email.id}
                className={`transition-all duration-200 hover:shadow-md cursor-pointer ${
                  expandedId === email.id ? "ring-2 ring-primary/20 shadow-md" : ""
                }`}
                onClick={() => setExpandedId(expandedId === email.id ? null : email.id)}
              >
                <CardContent className="p-4">
                  {/* Main Row */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        email.status === "sent"
                          ? "bg-emerald-100 text-emerald-600"
                          : email.status === "failed"
                          ? "bg-red-100 text-red-600"
                          : "bg-amber-100 text-amber-600"
                      }`}>
                        {email.status === "sent" ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : email.status === "failed" ? (
                          <XCircle className="w-5 h-5" />
                        ) : (
                          <Clock className="w-5 h-5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-foreground text-sm truncate">
                            إلى: {email.toName || email.toEmail}
                          </span>
                          {getStatusBadge(email.status)}
                          {getSentByBadge(email.sentBy)}
                        </div>
                        <p className="text-sm text-muted-foreground truncate mb-1">
                          <span className="font-medium">الموضوع:</span> {email.subject}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(email.createdAt)}
                          {email.toName && (
                            <span className="mr-2 text-muted-foreground/70">• {email.toEmail}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEmail(email);
                        }}
                        className="text-xs gap-1"
                      >
                        عرض التفاصيل
                      </Button>
                      {expandedId === email.id ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {expandedId === email.id && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="bg-muted/30 rounded-xl p-4">
                        <p className="text-xs font-medium text-muted-foreground mb-2">نص الرد:</p>
                        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                          {email.body.length > 500 ? email.body.substring(0, 500) + "..." : email.body}
                        </p>
                      </div>
                      {email.errorMessage && (
                        <div className="mt-3 bg-red-50 dark:bg-red-950/20 rounded-xl p-3">
                          <p className="text-xs font-medium text-red-600 mb-1">سبب الفشل:</p>
                          <p className="text-sm text-red-700 dark:text-red-400">{email.errorMessage}</p>
                        </div>
                      )}
                      {email.cc && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          <span className="font-medium">نسخة إلى:</span> {email.cc}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Email Detail Dialog */}
      <Dialog open={!!selectedEmail} onOpenChange={() => setSelectedEmail(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              تفاصيل الإيميل المرسل
            </DialogTitle>
          </DialogHeader>
          {selectedEmail && (
            <div className="space-y-4">
              {/* Status */}
              <div className="flex items-center gap-3">
                {getStatusBadge(selectedEmail.status)}
                {getSentByBadge(selectedEmail.sentBy)}
                <span className="text-sm text-muted-foreground">
                  {formatDate(selectedEmail.createdAt)}
                </span>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-1 gap-3 bg-muted/30 rounded-xl p-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">المرسل إليه</p>
                  <p className="text-sm font-semibold text-foreground">
                    {selectedEmail.toName ? `${selectedEmail.toName} (${selectedEmail.toEmail})` : selectedEmail.toEmail}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">الموضوع</p>
                  <p className="text-sm font-semibold text-foreground">{selectedEmail.subject}</p>
                </div>
                {selectedEmail.cc && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">نسخة كربونية (CC)</p>
                    <p className="text-sm text-foreground">{selectedEmail.cc}</p>
                  </div>
                )}
                {selectedEmail.inReplyTo && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">رداً على (Message-ID)</p>
                    <p className="text-xs text-muted-foreground font-mono break-all">{selectedEmail.inReplyTo}</p>
                  </div>
                )}
              </div>

              {/* Body */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">نص الرد</p>
                <div className="bg-white dark:bg-gray-900 border rounded-xl p-4">
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {selectedEmail.body}
                  </p>
                </div>
              </div>

              {/* Error */}
              {selectedEmail.errorMessage && (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                  <p className="text-xs font-medium text-red-600 mb-1">سبب الفشل</p>
                  <p className="text-sm text-red-700 dark:text-red-400">{selectedEmail.errorMessage}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
