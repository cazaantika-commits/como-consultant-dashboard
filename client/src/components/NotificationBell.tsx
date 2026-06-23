import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Bell, Mail, Check, CheckCheck, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

interface Notification {
  id: number;
  emailUid: number;
  fromEmail: string;
  fromName: string | null;
  subject: string;
  preview: string | null;
  receivedAt: number;
  isRead: boolean;
  createdAt: Date;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  // Poll unread count every 30 seconds
  const { data: countData } = trpc.notifications.unreadCount.useQuery(undefined, {
    refetchInterval: 30000,
    staleTime: 10000,
  });

  const { data: notifications, refetch: refetchNotifications } = trpc.notifications.list.useQuery(
    { limit: 15 },
    { enabled: open, staleTime: 5000 }
  );

  const markReadMutation = trpc.notifications.markRead.useMutation({
    onSuccess: () => {
      refetchNotifications();
    },
  });

  const markAllReadMutation = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      refetchNotifications();
    },
  });

  const dismissMutation = trpc.notifications.dismiss.useMutation({
    onSuccess: () => {
      refetchNotifications();
    },
  });

  const unreadCount = countData?.count || 0;

  // Play notification sound when new emails arrive
  useEffect(() => {
    if (unreadCount > prevCountRef.current && prevCountRef.current > 0) {
      // New notification arrived - play sound
      try {
        const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbsGczFj+a2teleC8bTKnb6LVzLxFJqd/tvnQ0Fk6s4fG/djYXUK3h8sF3NxhRruLzwnk4GVKv4/TDezocVLDk9cR8OxxVseX2xX08HVay5vfHfjweV7Tp+ch/PiBYtun7yoFAIlm36/3Lg0IkW7js/s2FRCZcuez+z4dGKF677f/Rh0gqX7vu/9OISixhvO//1IpLLmK98P/Wi00wZL7x/9iMTzJlv/L/2o5RNWXA8//cj1M3Z8Hz/96RVTlpwvT/4JJXPGvD9f/ik1k+bcT2/+SVXD9vxff/5pdfQXHG+P/ol2JDc8f5/+qZZEV1yPr/7JtmR3fJ+//unWhJecr8/++fa0t7y/3/8aFtTX3M/v/zo29Pf83//vWkcVGBzv//96ZzU4PP//j4qHVVhdD/+fqqd1eH0f/7/Kx5WYnS//z+rntbjNP//f+wfV2O1P/+AbJ/X5DV//8Cs4FhktYAAQS1g2OU1wACBbeEZZbYAAMHuIZnmNkABAm6h2ma2gAFCryIa5zbAAYMvodtnt0ABw2/iG+g3gAID8GJcaLfAAkRwopzpOAAChPDi3Wm4QALE8SMd6jiAAwVxo15quMADRfHjnur5AAOGMiPfa3lAA8ayZB/r+YAEBvKkYGx5wARHcuSg7PoABIezJOFtekAEx/NlIe36gAUIdCVibnsABUi0JaLu+0AFiPRl4297gAXJdKYjb/vABgm05mPwfAAGSjUmpHC8QAaKdWbk8TyABsq1pyVxvMAHCzXnZfI9AAdLdiel8n1AB4u2Z+ZyvYAHy/aoJvL9wAgMduhncz4ACEy3KKfzfkAIjPdo6HP+gAjNN6kpND7ACQ13qWm0vwAJTbfpqjT/QAmN+CnqtT+ACc44Kir1f8AKDnhqa3WAClA4qqv1wAqQeOrsdgAK0LkrLPZACxD5a212gAtROauu9sALkXnr73cAC9G6LC/3QAwR+mxwd4AMUjqssLeADJJ67PE3wAzSuyzxt8ANEvu");
        audio.volume = 0.3;
        audio.play().catch(() => {});
      } catch {}
    }
    prevCountRef.current = unreadCount;
  }, [unreadCount]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "الآن";
    if (minutes < 60) return `منذ ${minutes} دقيقة`;
    if (hours < 24) return `منذ ${hours} ساعة`;
    if (days < 7) return `منذ ${days} يوم`;
    return new Date(timestamp).toLocaleDateString("ar-SA");
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => {
          setOpen(!open);
          if (!open) refetchNotifications();
        }}
        className="relative p-2 rounded-xl hover:bg-muted/60 transition-all duration-200 group"
        title="الإشعارات"
      >
        <Bell className={`w-5 h-5 transition-all ${unreadCount > 0 ? "text-amber-500 animate-[ring_0.5s_ease-in-out]" : "text-muted-foreground group-hover:text-foreground"}`} />
        
        {/* Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full px-1 animate-in zoom-in-50 shadow-sm">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full mt-2 w-[360px] max-h-[480px] bg-card border border-border/60 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in slide-in-from-top-2 fade-in-0 duration-200" dir="rtl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-muted/20">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">إشعارات البريد</span>
              {unreadCount > 0 && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                  {unreadCount} جديد
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 px-2 text-muted-foreground hover:text-foreground"
                onClick={() => markAllReadMutation.mutate()}
              >
                <CheckCheck className="w-3.5 h-3.5 ml-1" />
                قراءة الكل
              </Button>
            )}
          </div>

          {/* Notification List */}
          <div className="overflow-y-auto max-h-[380px]">
            {!notifications || notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Bell className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm">لا توجد إشعارات</p>
                <p className="text-xs mt-1 opacity-60">ستظهر هنا عند وصول إيميلات جديدة</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-border/20 hover:bg-muted/30 transition-colors cursor-pointer group ${
                    !notif.isRead ? "bg-primary/5" : ""
                  }`}
                  onClick={() => {
                    if (!notif.isRead) {
                      markReadMutation.mutate({ id: notif.id });
                    }
                  }}
                >
                  {/* Unread indicator */}
                  <div className="mt-2 flex-shrink-0">
                    {!notif.isRead ? (
                      <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                    ) : (
                      <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/20" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm truncate ${!notif.isRead ? "font-semibold text-foreground" : "font-medium text-muted-foreground"}`}>
                        {notif.fromName || notif.fromEmail}
                      </p>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0">
                        {formatTime(notif.receivedAt)}
                      </span>
                    </div>
                    <p className={`text-xs mt-0.5 truncate ${!notif.isRead ? "text-foreground/80" : "text-muted-foreground/70"}`}>
                      {notif.subject}
                    </p>
                    {notif.preview && (
                      <p className="text-[11px] text-muted-foreground/50 mt-0.5 truncate">
                        {notif.preview}
                      </p>
                    )}
                  </div>

                  {/* Dismiss button */}
                  <button
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-muted mt-1 flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      dismissMutation.mutate({ id: notif.id });
                    }}
                    title="إخفاء"
                  >
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications && notifications.length > 0 && (
            <div className="border-t border-border/40 px-4 py-2 bg-muted/10">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs h-8 text-primary hover:text-primary/80"
                onClick={() => {
                  navigate("/agent-dashboard?agent=salwa&action=check-email");
                  setOpen(false);
                }}
              >
                <ExternalLink className="w-3.5 h-3.5 ml-1" />
                افتح شات سلوى للرد
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
