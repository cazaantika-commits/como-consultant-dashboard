import { useLocation } from "wouter";
import { BriefcaseBusiness, Building2, MessageCircleMore, Users } from "lucide-react";
import saraPortrait from "@/assets/como/sara.webp";

type PrimaryArea = "kitchen" | "projects" | "consultants" | "sara";

const items = [
  { key: "kitchen" as const, label: "المطبخ", mobileLabel: "المطبخ", path: "/como-next", icon: BriefcaseBusiness },
  { key: "projects" as const, label: "المشاريع", mobileLabel: "المشاريع", path: "/project-management", icon: Building2 },
  { key: "consultants" as const, label: "المكاتب الاستشارية", mobileLabel: "المكاتب", path: "/consultant-proposals", icon: Users },
  { key: "sara" as const, label: "سارة", mobileLabel: "سارة", path: "/sara", icon: MessageCircleMore },
];

export function ComoPrimaryNav({ active, beforeNavigate, dark = false }: { active: PrimaryArea; beforeNavigate?: () => void; dark?: boolean }) {
  const [, navigate] = useLocation();

  return (
    <nav
      aria-label="التنقل الرئيسي"
      className={`fixed inset-x-0 bottom-0 z-[120] grid w-full min-w-0 grid-cols-4 gap-1 border-t px-2 pb-[max(.35rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-14px_40px_rgba(15,23,42,.13)] backdrop-blur-xl sm:static sm:rounded-[20px] sm:border sm:p-1 sm:shadow-none ${dark ? "border-white/10 bg-[#071522]/94 sm:bg-white/7" : "border-slate-200/80 bg-[#fffdf7]/94 sm:bg-[#f3f1ea]"}`}
      dir="rtl"
    >
      {items.map(item => {
        const Icon = item.icon;
        const selected = item.key === active;
        return (
          <button
            key={item.key}
            type="button"
            aria-current={selected ? "page" : undefined}
            onClick={() => {
              if (selected) return;
              beforeNavigate?.();
              navigate(item.path);
            }}
            className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-[18px] px-2 text-[10px] font-black transition active:scale-[0.98] sm:min-h-12 sm:flex-row sm:gap-2 sm:px-4 sm:text-sm ${selected ? "bg-[#dfece7] text-[#153f36] shadow-sm sm:bg-[#0d2940] sm:text-white sm:shadow-[0_10px_24px_rgba(5,25,42,.2)]" : dark ? "text-white/65 hover:bg-white/8 hover:text-white" : "text-slate-500 hover:bg-white hover:text-slate-900"}`}
          >
            {item.key === "sara" ? <img src={saraPortrait} alt="سارة" className={`h-7 w-7 shrink-0 rounded-full object-cover object-top ring-2 ${selected ? "ring-[#2d6a59] sm:ring-amber-300" : "ring-slate-200"}`} /> : <Icon className={`h-5 w-5 shrink-0 ${selected ? "text-[#2d6a59] sm:text-amber-300" : ""}`} />}
            <span className="truncate sm:hidden">{item.mobileLabel}</span>
            <span className="hidden truncate sm:inline">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
