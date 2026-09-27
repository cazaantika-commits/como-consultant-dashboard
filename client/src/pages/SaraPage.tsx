import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SaraRealtimeRoom } from "@/components/SaraRealtimeRoom";
import { trpc } from "@/lib/trpc";
import { getCommandCenterTokenKey, resolveCommandCenterPersona } from "@/lib/commandCenterIdentity";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  ChevronLeft,
  Clock3,
  KeyRound,
  Loader2,
  MessageSquare,
} from "lucide-react";

const SARA_PORTRAIT = "/sara/sara-approved-5256847d.webp";

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
      .map((file: any) => ({
        id: file.nextActionId,
        workFileId: file.id,
        title: file.nextActionTitle,
        isOverdue: false,
        upcoming: true,
        attentionAt: file.nextAttentionAt,
      }));
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
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,#fff6de_0,#f8faf8_38%,#edf3f2_100%)] p-4 sm:p-7" dir="rtl">
        <div className="mx-auto max-w-5xl">
          <header className="mb-4 flex items-center justify-between gap-3">
            <button type="button" onClick={() => navigate("/")} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm"><ArrowRight className="h-4 w-4" />الرئيسية</button>
            <Button variant="outline" onClick={() => navigate("/como-next")} className="rounded-xl bg-white"><BriefcaseBusiness className="ml-2 h-4 w-4" />المكتب التنفيذي</Button>
          </header>

          <section className="grid overflow-hidden rounded-[30px] border border-white bg-white shadow-[0_24px_80px_rgba(15,23,42,.12)] md:grid-cols-[.72fr_1.28fr]">
            <div className="relative h-56 overflow-hidden sm:h-72 md:h-auto md:min-h-[360px]">
              <img src={SARA_PORTRAIT} alt="سارة" className="absolute inset-0 h-full w-full object-cover object-[center_18%]" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/45 via-transparent to-transparent" />
            </div>
            <div className="p-5 sm:p-7">
              <div className="flex items-center justify-between gap-3"><div><p className="text-[11px] font-black text-[#1d6577]">اليوم</p><h1 className="mt-1 text-2xl font-black text-slate-950">صباح الخير، {member.nameAr}</h1></div><Button onClick={() => setRoomOpen(true)} className="rounded-2xl bg-amber-400 font-black text-slate-950 hover:bg-amber-300"><MessageSquare className="ml-2 h-4 w-4" />تحدث مع سارة</Button></div>

              <div className="mt-6 grid grid-cols-3 gap-2">
                <button type="button" onClick={() => navigate("/como-next?section=actions")} className="rounded-2xl border border-slate-200 bg-[#fafbf9] p-3 text-right"><span className="text-[10px] font-bold text-slate-500">اليوم</span><strong className="mt-1 block text-2xl font-black text-slate-950">{brief.today}</strong></button>
                <button type="button" onClick={() => navigate("/como-next?section=actions")} className="rounded-2xl border border-rose-100 bg-rose-50/70 p-3 text-right"><span className="text-[10px] font-bold text-rose-700">متأخر</span><strong className="mt-1 block text-2xl font-black text-rose-800">{brief.overdue}</strong></button>
                <button type="button" onClick={() => navigate("/como-next?section=actions")} className="rounded-2xl border border-amber-100 bg-amber-50/70 p-3 text-right"><span className="text-[10px] font-bold text-amber-700">3 أيام</span><strong className="mt-1 block text-2xl font-black text-amber-800">{brief.upcoming}</strong></button>
              </div>

              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-black text-slate-700">الأهم الآن</h2><CalendarDays className="h-4 w-4 text-slate-400" /></div>
                {overviewQuery.isLoading ? <div className="flex h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-[#1d6577]" /></div> : brief.items.length ? <div className="space-y-2">{brief.items.map((item: any) => <button key={`${item.workFileId}-${item.id}`} type="button" onClick={() => navigate(`/como-next?section=actions&workFileId=${item.workFileId}&actionId=${item.id}`)} className="group flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-right transition hover:border-[#8fb7c2]"><span className="flex min-w-0 items-center gap-2">{item.isOverdue ? <Clock3 className="h-4 w-4 shrink-0 text-rose-600" /> : <CalendarDays className="h-4 w-4 shrink-0 text-amber-600" />}<span className="truncate text-sm font-bold text-slate-900">{item.title}</span></span><ChevronLeft className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-[#1d6577]" /></button>)}</div> : <p className="rounded-xl border border-dashed border-slate-200 bg-[#fafbf9] px-4 py-5 text-center text-sm font-bold text-slate-500">لا يوجد أمر مهم مسجل الآن</p>}
              </div>
            </div>
          </section>
        </div>
        <SaraRealtimeRoom token={token} memberName={member.nameAr} isOpen={roomOpen} onClose={() => setRoomOpen(false)} />
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,#fff4d7_0,#f5f7f7_52%,#eef2f3_100%)] px-5 py-10" dir="rtl">
      <section className="relative grid w-full max-w-3xl overflow-hidden rounded-[30px] border border-white bg-white shadow-[0_30px_100px_rgba(15,23,42,.16)] md:grid-cols-[.72fr_1.28fr]">
        <div className="relative min-h-56 overflow-hidden md:min-h-[460px]"><img src={SARA_PORTRAIT} alt="سارة" className="absolute inset-0 h-full w-full object-cover object-[center_18%]" /></div>
        <div className="flex flex-col justify-center px-6 py-8 sm:px-9">
          <button type="button" onClick={() => navigate("/")} className="mb-7 inline-flex w-fit items-center gap-2 text-xs font-bold text-slate-500"><ArrowRight className="h-4 w-4" />الرئيسية</button>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-amber-300"><KeyRound className="h-5 w-5" /></div>
          <h1 className="mt-5 text-2xl font-black text-slate-950">الدخول إلى سارة</h1>
          <form className="mt-6 space-y-3" onSubmit={(event) => { event.preventDefault(); const value = draftToken.trim(); if (!value) return; setAuthError(""); setMember(null); setToken(value); }}>
            <Input id="sara-access-token" type="password" value={draftToken} onChange={(event) => setDraftToken(event.target.value)} placeholder="رمز الدخول" dir="ltr" className="h-12 rounded-xl" autoComplete="current-password" />
            {authError && <p className="text-xs font-bold text-red-600">{authError}</p>}
            <Button type="submit" disabled={!draftToken.trim()} className="h-12 w-full rounded-xl bg-slate-900 font-black text-white hover:bg-slate-800">التحقق وفتح سارة</Button>
          </form>
          <p className="mt-4 text-[10px] text-slate-400">لا يبدأ OpenAI Realtime أو LiveAvatar أثناء التحقق.</p>
        </div>
      </section>
    </main>
  );
}
