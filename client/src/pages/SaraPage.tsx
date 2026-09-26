import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SaraRealtimeRoom } from "@/components/SaraRealtimeRoom";
import { trpc } from "@/lib/trpc";
import { getCommandCenterTokenKey, resolveCommandCenterPersona } from "@/lib/commandCenterIdentity";
import { useLocation } from "wouter";
import { default as ArrowRight } from "lucide-react/dist/esm/icons/arrow-right.js";
import { default as KeyRound } from "lucide-react/dist/esm/icons/key-round.js";
import { default as Loader2 } from "lucide-react/dist/esm/icons/loader-circle.js";

const SARA_PORTRAIT = "/sara/sara-approved-5256847d.webp";

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
    const stored = localStorage.getItem(storageKey)
      || localStorage.getItem("cc_token")
      || localStorage.getItem("cc_token_shared");
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
    return <div className="flex min-h-screen items-center justify-center bg-[#081822]"><Loader2 className="h-7 w-7 animate-spin text-amber-300" /></div>;
  }

  if (member && token) {
    return (
      <SaraRealtimeRoom
        token={token}
        memberName={member.nameAr}
        isOpen
        onClose={() => navigate("/")}
      />
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,#fff4d7_0,#f5f7f7_52%,#eef2f3_100%)] px-5 py-10" dir="rtl">
      <div className="absolute -right-28 -top-28 h-80 w-80 rounded-full bg-amber-200/45 blur-3xl" />
      <div className="absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-[#c9dfe2]/55 blur-3xl" />
      <section className="relative grid w-full max-w-4xl overflow-hidden rounded-[34px] border border-white bg-white shadow-[0_35px_110px_rgba(15,23,42,.18)] md:grid-cols-[.88fr_1.12fr]">
        <div className="relative min-h-[300px] overflow-hidden md:min-h-[570px]">
          <img src={SARA_PORTRAIT} alt="سارة" className="absolute inset-0 h-full w-full object-cover object-top" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent" />
          <div className="absolute inset-x-6 bottom-6 rounded-2xl border border-white/20 bg-slate-950/55 p-4 text-white backdrop-blur-xl">
            <p className="font-black">سارة · واجهة COMO</p>
            <p className="mt-1 text-xs leading-6 text-slate-200">الدخول المحمي يفتح المحادثة فقط؛ الصوت والصورة الحية لا يعملان قبل أن تبدأهما بنفسك.</p>
          </div>
        </div>

        <div className="flex flex-col justify-center px-6 py-8 sm:px-10 md:py-12">
          <button type="button" onClick={() => navigate("/")} className="mb-8 inline-flex w-fit items-center gap-2 text-xs font-bold text-slate-500 transition hover:text-slate-900"><ArrowRight className="h-4 w-4" /> العودة إلى الرئيسية</button>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-amber-300 shadow-lg"><KeyRound className="h-5 w-5" /></div>
          <p className="mt-6 text-[11px] font-black text-amber-700">تحقق مرة واحدة على هذا الجهاز</p>
          <h1 className="mt-2 text-3xl font-black leading-tight text-slate-950">الدخول إلى سارة</h1>
          <p className="mt-3 text-sm leading-7 text-slate-500">أدخل رمز مركز القيادة الخاص بك. بعد التحقق ستفتح غرفة سارة مباشرة، من دون المرور على لوحة النظام القديمة.</p>

          <form
            className="mt-7 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const value = draftToken.trim();
              if (!value) return;
              setAuthError("");
              setMember(null);
              setToken(value);
            }}
          >
            <label className="block text-xs font-black text-slate-700" htmlFor="sara-access-token">رمز الدخول</label>
            <Input
              id="sara-access-token"
              type="password"
              value={draftToken}
              onChange={(event) => setDraftToken(event.target.value)}
              placeholder="أدخل رمزك الشخصي"
              dir="ltr"
              className="h-12 rounded-xl border-slate-300 bg-white"
              autoComplete="current-password"
            />
            {authError && <p className="text-xs font-bold text-red-600">{authError}</p>}
            <Button type="submit" disabled={!draftToken.trim()} className="h-12 w-full rounded-xl bg-slate-900 font-black text-white hover:bg-slate-800">التحقق وفتح سارة</Button>
          </form>

          <p className="mt-5 text-[10px] leading-5 text-slate-400">لا يبدأ OpenAI Realtime أو LiveAvatar أثناء التحقق. يبدأ الاستهلاك فقط بعد ضغطك على تشغيل الجلسة داخل غرفة سارة.</p>
        </div>
      </section>
    </main>
  );
}
