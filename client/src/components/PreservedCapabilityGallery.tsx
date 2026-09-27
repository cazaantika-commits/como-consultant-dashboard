import { Badge } from "@/components/ui/badge";
import { BriefcaseBusiness, Eye, ShieldCheck } from "lucide-react";
import buraqPortrait from "@/assets/como/buraq.webp";
import farouqPortrait from "@/assets/como/farouq.webp";
import khazenPortrait from "@/assets/como/khazen.webp";
import khaledPortrait from "@/assets/como/khaled.webp";
import alinaPortrait from "@/assets/como/alina.webp";
import bazPortrait from "@/assets/como/baz.webp";
import joellePortrait from "@/assets/como/joelle.webp";

type CapabilityPortrait = {
  name: string;
  role: string;
  portrait: string;
  tone: string;
  enabled: boolean;
};

const capabilities: CapabilityPortrait[] = [
  {
    name: "براق",
    role: "مراقب المشروع والمتابعة التنفيذية",
    portrait: buraqPortrait,
    tone: "from-orange-500/20 to-amber-100",
    enabled: true,
  },
  {
    name: "فاروق",
    role: "مدير العقود",
    portrait: farouqPortrait,
    tone: "from-violet-500/20 to-indigo-100",
    enabled: true,
  },
  {
    name: "خازن",
    role: "الأرشفة والتخزين",
    portrait: khazenPortrait,
    tone: "from-sky-500/20 to-cyan-100",
    enabled: false,
  },
  {
    name: "خالد",
    role: "الجودة والامتثال الفني",
    portrait: khaledPortrait,
    tone: "from-emerald-500/20 to-teal-100",
    enabled: false,
  },
  {
    name: "ألينا",
    role: "الرقابة المالية والتكاليف",
    portrait: alinaPortrait,
    tone: "from-amber-500/20 to-yellow-100",
    enabled: false,
  },
  {
    name: "باز",
    role: "الابتكار والتحسين",
    portrait: bazPortrait,
    tone: "from-pink-500/20 to-rose-100",
    enabled: false,
  },
  {
    name: "جويل",
    role: "دراسات السوق والجدوى",
    portrait: joellePortrait,
    tone: "from-cyan-500/20 to-blue-100",
    enabled: false,
  },
];

export function PreservedCapabilityGallery() {
  return (
    <section className="mt-10 overflow-hidden rounded-[32px] border border-white/80 bg-white/75 p-5 shadow-[0_24px_70px_rgba(15,23,42,.09)] backdrop-blur-xl sm:p-7">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-black tracking-[.18em] text-[#1d6577]">COMO CAPABILITIES</p>
          <h2 className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">القدرات المحفوظة</h2>
          <p className="mt-1 text-xs leading-6 text-slate-500">الصور والاختصاصات محفوظة؛ المفعّل عند الطلب الآن مراقب المشروع ومدير العقود فقط.</p>
        </div>
        <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-amber-300 sm:flex"><BriefcaseBusiness className="h-5 w-5" /></span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        {capabilities.map(item => (
          <article key={item.name} className="group relative min-w-0 overflow-hidden rounded-[24px] border border-white bg-white shadow-[0_14px_35px_rgba(15,23,42,.1)]">
            <div className={`relative aspect-[4/5] overflow-hidden bg-gradient-to-br ${item.tone}`}>
              <img src={item.portrait} alt={item.name} className="h-full w-full object-cover object-top transition duration-200 group-hover:scale-[1.03]" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent" />
              <div className="absolute inset-x-3 bottom-3 text-white">
                <p className="text-base font-black">{item.name}</p>
                <p className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-white/75">{item.role}</p>
              </div>
            </div>
            <div className="p-3">
              {item.enabled ? (
                <Badge className="w-full justify-center border-0 bg-emerald-50 text-[9px] text-emerald-800"><ShieldCheck className="ml-1 h-3 w-3" />مفعّل عند الطلب</Badge>
              ) : (
                <Badge variant="outline" className="w-full justify-center border-slate-200 bg-slate-50 text-[9px] text-slate-500"><Eye className="ml-1 h-3 w-3" />محفوظ للمستقبل</Badge>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
