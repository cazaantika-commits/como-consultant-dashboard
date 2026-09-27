import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SaraRealtimeRoom } from "@/components/SaraRealtimeRoom";
import { trpc } from "@/lib/trpc";
import { getCommandCenterTokenKey, resolveCommandCenterPersona } from "@/lib/commandCenterIdentity";
import { useLocation } from "wouter";
import saraPortrait from "@/assets/como/sara.webp";
import saraIdleVideo from "@/assets/como/sara-idle.webm";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  ChevronLeft,
  Clock3,
  KeyRound,
  Loader2,
  MessageSquare,
  Sparkles,
} from "lucide-react";

const SARA_PORTRAIT = saraPortrait;
const SARA_IDLE_VIDEO = saraIdleVideo;

function parseUtc(value: string | null | undefined) {
  if (!value) return null;
  const normalized = /Z$|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export default function SaraPage() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const persona = useMemo(() => resolveCommandCenterPersona(user as any), [user]);
  const storageKey = getCommandCenterTokenKey(persona);
  const [draftToken, setDraftToken] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [member, setMember] = useState<any>(null);
  const [authError, setAuthError] = useState("");
  const [roomOpen, setRoomOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(storageKey) || localStorage.getItem("cc_token") || localStorage.getItem("cc_token_shared");
    if (stored) setToken(stored);
  }, [storageKey]);

  const verification = trpc.commandCenter.verifyAccess.useQuery(
    { token: token || "" },
    { enabled: Boolean(token), retry: false },
  );
  const overviewQuery = trpc.comoNext.getOverview.useQuery(undefined, {
    enabled: isAuthenticated && Boolean(member),
    staleTime: 30_000,
    retry: false,
  });

  useEffect(() => {
    if (!verification.data || !token) return;
    if (persona && verification.data.memberId !== persona) {
      localStorage.removeItem(storageKey);
      setToken(null);
      setMember(null);
      setAuthError("رمز الدخول لا يطابق هوية المستخدم الحالية");
      return;
    }
    localStorage.setItem(storageKey, token);
    localStorage.removeItem("cc_token");
    localStorage.removeItem("cc_token_shared");
    setMember(verification.data);
    setAuthError("");
  }, [persona, storageKey, token, verification.data]);

  useEffect(() => {
    if (!verification.error) return;
    localStorage.removeItem(storageKey);
    setToken(null);
    setMember(null);
    setAuthError("رمز الدخول غير صالح");
  }, [storageKey, verification.error]);

  const brief = useMemo(() => {
    const data = overviewQuery.data;
    if (!data) return { today: 0, overdue: 0, upcoming: 0, items: [] as any[] };
    const now = new Date();
    const threeDays = now.getTime() + 3 * 24 * 60 * 60 * 1000;
    const dueItems = [
      ...data.today.sections.waitingExternal,
      ...data.today.sections.mine,
      ...data.today.sections.manus,
      ...data.today.sections.team,
    ];
    const dueIds = new Set(dueItems.map((item: any) => item.id));
    const upcomingItems = data.workFiles
      .filter((file: any) => {
        const date = parseUtc(file.nextAttentionAt);
        return Boolean(file.nextActionId && date && date.getTime() > now.getTime() && date.getTime() <= threeDays && !dueIds.has(file.nextActionId));
      })
      .map((file: any) => ({ id: file.nextActionId, workFileId: file.id, title: file.nextActionTitle, isOverdue: false, upcoming: true, attentionAt: file.nextAttentionAt }));
    const topItems = [...dueItems.filter((item: any) => item.isOverdue), ...dueItems.filter((item: any) => !item.isOverdue), ...upcomingItems].slice(0, 3);
    return {
      today: Math.max(0, data.today.summary.dueToday - data.today.summary.overdue),
      overdue: data.today.summary.overdue,
      upcoming: upcomingItems.length,
      items: topItems,
    };
  }, [overviewQuery.data]);

  if (loading || (token && verification.isLoading)) {
    return <div className="flex min-h-screen items-center justify-center bg-[#081822]"><Loader2 className="h-7 w-7 animate-spin text-amber-300" /></div>;
  }

  if (member && token) {
    return (
      <main className="min-h-screen min-w-0 max-w-full overflow-x-hidden bg-[radial-gradient(circle_at_top_right,#fff2cf_0,#f8faf8_42%,#e7f0ef_100%)] p-3 sm:p-7" dir="rtl">
        <div className="mx-auto max-w-6xl">
          <header className="mb-3 grid grid-cols-2 gap-2 sm:mb-5 sm:flex sm:items-center sm:justify-between sm:gap-3">
            <button type="button" onClick={() => navigate("/")} className="inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl border border-white bg-white/85 px-3 text-xs font-bold text-slate-700 shadow-sm backdrop-blur-xl sm:px-4 sm:text-sm"><ArrowRight className="h-4 w-4 shrink-0" />الرئيسية</button>
            <Button variant="outline" onClick={() => navigate("/como-next")} className="min-w-0 rounded-xl border-white bg-white/85 px-3 text-xs shadow-sm backdrop-blur-xl sm:px-4 sm:text-sm"><BriefcaseBusiness className="ml-1 h-4 w-4 shrink-0 sm:ml-2" />المطبخ التنفيذي</Button>
          </header>

          <section className="grid overflow-hidden rounded-[34px] border border-white bg-white shadow-[0_30px_90px_rgba(15,23,42,.14)] lg:grid-cols-[.84fr_1.16fr]">
            <div className="relative aspect-[3/4] min-h-[430px] overflow-hidden bg-[#071522] lg:aspect-auto lg:min-h-[650px]">
              <video src={SARA_IDLE_VIDEO} poster={SARA_PORTRAIT} autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover object-top" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#071522]/80 via-transparent to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-7">
                <div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-black tracking-[.2em] text-amber-300">SARA · COMO</p><h2 className="mt-1 text-3xl font-black">سارة</h2><p className="mt-1 text-xs text-white/65">حركة محلية تلقائية · المحادثة المباشرة تبدأ بقرارك</p></div><span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 backdrop-blur-xl"><Sparkles className="h-5 w-5 text-amber-300" /></span></div>
              </div>
            </div>

            <div className="min-w-0 p-5 sm:p-8 lg:flex lg:flex-col lg:justify-center">
              <div className="flex min-w-0 flex-col items-stretch gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0"><p className="text-[11px] font-black tracking-[.14em] text-[#1d6577]">TODAY</p><h1 className="mt-2 break-words text-3xl font-black leading-[1.25] text-slate-950 sm:text-4xl">صباح الخير، {member.nameAr}</h1><p className="mt-2 text-sm text-slate-500">ثلاث إشارات فقط، ثم ننتقل إلى المطبخ عند الحاجة للتنفيذ.</p></div>
                <Button onClick={() => setRoomOpen(true)} className="h-12 w-full shrink-0 rounded-2xl bg-amber-400 px-6 font-black text-slate-950 shadow-lg shadow-amber-500/20 hover:bg-amber-300 sm:w-auto"><MessageSquare className="ml-2 h-5 w-5" />تحدث مع سارة</Button>
              </div>

              <div className="mt-7 grid grid-cols-3 gap-2 sm:gap-3">
                <button type="button" onClick={() => navigate("/como-next?section=actions")} className="min-w-0 rounded-[22px] border border-slate-200 bg-[#fafbf9] p-3 text-right shadow-sm sm:p-4"><span className="text-[10px] font-bold text-slate-500">اليوم</span><strong className="mt-1 block text-3xl font-black text-slate-950">{brief.today}</strong></button>
                <button type="button" onClick={() => navigate("/como-next?section=actions")} className="min-w-0 rounded-[22px] border border-rose-100 bg-rose-50 p-3 text-right shadow-sm sm:p-4"><span className="text-[10px] font-bold text-rose-700">متأخر</span><strong className="mt-1 block text-3xl font-black text-rose-800">{brief.overdue}</strong></button>
                <button type="button" onClick={() => navigate("/como-next?section=actions")} className="min-w-0 rounded-[22px] border border-amber-100 bg-amber-50 p-3 text-right shadow-sm sm:p-4"><span className="text-[10px] font-bold text-amber-700">3 أيام</span><strong className="mt-1 block text-3xl font-black text-amber-800">{brief.upcoming}</strong></button>
              </div>

              <div className="mt-7">
                <div className="mb-3 flex items-center justify-between"><h2 className="text-base font-black text-slate-800">الأهم الآن</h2><CalendarDays className="h-4 w-4 text-slate-400" /></div>
                {overviewQuery.isLoading ? <div className="flex h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-[#1d6577]" /></div> : brief.items.length ? <div className="space-y-3">{brief.items.map((item: any, index: number) => <button key={`${item.workFileId}-${item.id}`} type="button" onClick={() => navigate(`/como-next?section=actions&workFileId=${item.workFileId}&actionId=${item.id}`)} className="group flex min-h-16 w-full min-w-0 items-center justify-between gap-3 rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-right shadow-sm transition hover:-translate-y-0.5 hover:border-[#8fb7c2] hover:shadow-md"><span className="flex min-w-0 items-center gap-3"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.isOverdue ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-700"}`}>{item.isOverdue ? <Clock3 className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}</span><span><span className="block text-[9px] font-black tracking-wider text-slate-400">0{index + 1}</span><span className="line-clamp-2 break-words text-sm font-black leading-6 text-slate-900">{item.title}</span></span></span><ChevronLeft className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-[#1d6577]" /></button>)}</div> : <p className="rounded-[20px] border border-dashed border-slate-200 bg-[#fafbf9] px-4 py-6 text-center text-sm font-bold text-slate-500">لا يوجد أمر مهم مسجل الآن</p>}
              </div>
            </div>
          </section>
        </div>
        <SaraRealtimeRoom token={token} memberName={member.nameAr} isOpen={roomOpen} onClose={() => setRoomOpen(false)} />
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,#fff0c9_0,#f5f7f7_52%,#e8efef_100%)] px-5 py-10" dir="rtl">
      <section className="relative grid w-full max-w-4xl overflow-hidden rounded-[34px] border border-white bg-white shadow-[0_34px_110px_rgba(15,23,42,.17)] md:grid-cols-[.84fr_1.16fr]">
        <div className="relative aspect-[3/4] min-h-[430px] overflow-hidden bg-[#071522] md:aspect-auto md:min-h-[560px]"><video src={SARA_IDLE_VIDEO} poster={SARA_PORTRAIT} autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover object-top" /><div className="absolute inset-0 bg-gradient-to-t from-[#071522]/75 via-transparent to-transparent" /><div className="absolute bottom-6 right-6 text-white"><p className="text-[10px] font-black tracking-[.18em] text-amber-300">SARA · COMO</p><p className="mt-1 text-3xl font-black">سارة</p></div></div>
        <div className="flex flex-col justify-center px-6 py-8 sm:px-10">
          <button type="button" onClick={() => navigate("/")} className="mb-7 inline-flex w-fit items-center gap-2 text-xs font-bold text-slate-500"><ArrowRight className="h-4 w-4" />الرئيسية</button>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-amber-300"><KeyRound className="h-5 w-5" /></div>
          <h1 className="mt-5 text-3xl font-black text-slate-950">الدخول إلى سارة</h1>
          <form className="mt-6 space-y-3" onSubmit={(event) => { event.preventDefault(); const value = draftToken.trim(); if (!value) return; setAuthError(""); setMember(null); setToken(value); }}>
            <Input id="sara-access-token" type="password" value={draftToken} onChange={(event) => setDraftToken(event.target.value)} placeholder="رمز الدخول" dir="ltr" className="h-12 rounded-xl" autoComplete="current-password" />
            {authError && <p className="text-xs font-bold text-red-600">{authError}</p>}
            <Button type="submit" disabled={!draftToken.trim()} className="h-12 w-full rounded-xl bg-slate-900 font-black text-white hover:bg-slate-800">التحقق وفتح سارة</Button>
          </form>
          <p className="mt-4 text-[10px] text-slate-400">الحركة المحلية تعمل تلقائيًا. لا يبدأ OpenAI Realtime أو LiveAvatar أثناء التحقق.</p>
        </div>
      </section>
    </main>
  );
}
