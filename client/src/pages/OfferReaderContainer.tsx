import { trpc } from "@/lib/trpc";
import OfferReaderScreen from "./OfferReaderScreen";

export default function OfferReaderContainer({ cpaProjectId, projectConsultantId, consultantName, onBack }: { cpaProjectId: number; projectConsultantId: number; consultantName: string; onBack: () => void }) {
  const projectQuery = trpc.cpa.projects.getById.useQuery({ id: cpaProjectId });
  if (projectQuery.isLoading) return <div className="py-12 text-center text-sm text-slate-500">جاري تحميل بيانات المشروع…</div>;
  if (!projectQuery.data) return <div className="py-12 text-center text-sm text-red-600">المشروع غير موجود</div>;
  return <OfferReaderScreen cpaProjectId={cpaProjectId} projectConsultantId={projectConsultantId} systemProjectId={Number((projectQuery.data as any).project_id)} consultantName={consultantName} onBack={onBack} />;
}
