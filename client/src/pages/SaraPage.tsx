import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SaraRealtimeRoom } from "@/components/SaraRealtimeRoom";
import { trpc } from "@/lib/trpc";
import { getCommandCenterTokenKey, resolveCommandCenterPersona } from "@/lib/commandCenterIdentity";
import { useLocation } from "wouter";
import saraPortrait from "@/assets/como/sara.webp";
import { ArrowRight, KeyRound, Loader2 } from "lucide-react";

export default function SaraPage() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const persona = useMemo(() => resolveCommandCenterPersona(user as any), [user]);
  const storageKey = getCommandCenterTokenKey(persona);
  const [draftToken, setDraftToken] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [member, setMember] = useState<any>(null);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem(storageKey) || localStorage.getItem("cc_token") || localStorage.getItem("cc_token_shared");
    if (stored) setToken(stored);
  }, [storageKey]);

  const verification = trpc.commandCenter.verifyAccess.useQuery(
    { token: token || "" },
    { enabled: Boolean(token), retry: false },
  );

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

  if (loading || (token && verification.isLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#071522]">
        <img src={saraPortrait} alt="سارة" className="absolute inset-0 h-full w-full object-cover object-top opacity-35" />
        <div className="absolute inset-0 bg-[#071522]/55" />
        <div className="relative flex items-center gap-3 rounded-full border border-white/10 bg-black/20 px-5 py-3 text-sm font-bold text-white backdrop-blur-xl">
          <Loader2 className="h-5 w-5 animate-spin text-amber-300" /> سارة تجهّز الاتصال
        </div>
      </div>
    );
  }

  if (member && token) {
    return (
      <SaraRealtimeRoom
        token={token}
        memberName={member.nameAr}
        isOpen
        autoStart
        streamlined
        onClose={() => navigate("/")}
      />
    );
  }

  return (
    <main className="relative flex min-h-screen min-w-0 max-w-full items-center justify-center overflow-x-hidden bg-[radial-gradient(circle_at_top,#fff0c9_0,#f5f7f7_52%,#e8efef_100%)] px-5 py-10" dir="rtl">
      <section className="relative grid w-full max-w-4xl overflow-hidden rounded-[34px] border border-white bg-white shadow-[0_34px_110px_rgba(15,23,42,.17)] md:grid-cols-[.84fr_1.16fr]">
        <div className="relative aspect-[3/4] min-h-[430px] overflow-hidden bg-[#071522] md:aspect-auto md:min-h-[560px]">
          <img src={saraPortrait} alt="سارة" className="absolute inset-0 h-full w-full object-cover object-top" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#071522]/75 via-transparent to-transparent" />
          <div className="absolute bottom-6 right-6 text-white"><p className="text-[10px] font-black tracking-[.18em] text-amber-300">SARA · COMO</p><p className="mt-1 text-3xl font-black">سارة</p></div>
        </div>
        <div className="flex flex-col justify-center px-6 py-8 sm:px-10">
          <button type="button" onClick={() => navigate("/")} className="mb-7 inline-flex w-fit items-center gap-2 text-xs font-bold text-slate-500"><ArrowRight className="h-4 w-4" />الرئيسية</button>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-amber-300"><KeyRound className="h-5 w-5" /></div>
          <h1 className="mt-5 text-3xl font-black text-slate-950">الدخول إلى سارة</h1>
          <form className="mt-6 space-y-3" onSubmit={(event) => { event.preventDefault(); const value = draftToken.trim(); if (!value) return; setAuthError(""); setMember(null); setToken(value); }}>
            <Input id="sara-access-token" type="password" value={draftToken} onChange={(event) => setDraftToken(event.target.value)} placeholder="رمز الدخول" dir="ltr" className="h-12 rounded-xl" autoComplete="current-password" />
            {authError && <p className="text-xs font-bold text-red-600">{authError}</p>}
            <Button type="submit" disabled={!draftToken.trim()} className="h-12 w-full rounded-xl bg-slate-900 font-black text-white hover:bg-slate-800">التحقق وفتح سارة</Button>
          </form>
          <p className="mt-4 text-[10px] leading-5 text-slate-400">بعد التحقق تفتح سارة مباشرة: اتصال صوتي وصورة حية بحركة الشفاه، من دون شاشة تشغيل وسيطة.</p>
        </div>
      </section>
    </main>
  );
}
