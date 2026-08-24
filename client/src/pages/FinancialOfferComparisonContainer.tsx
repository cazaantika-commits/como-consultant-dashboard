import { trpc } from "@/lib/trpc";
import FinancialOfferComparisonScreen from "./FinancialOfferComparisonScreen";

export default function FinancialOfferComparisonContainer({ cpaProjectId, onBack }: { cpaProjectId: number; onBack: () => void }) {
  const projectQuery = trpc.cpa.projects.getById.useQuery({ id: cpaProjectId });
  if (projectQuery.isLoading) return <div className="py-12 text-center text-sm text-slate-500">جاري تحميل المشروع…</div>;
  const project = projectQuery.data as any;
  if (!project?.project_id) return <div className="py-12 text-center text-sm text-red-600">لا يوجد ربط بالمشروع المرجعي لهذا التحليل</div>;
  return <FinancialOfferComparisonScreen cpaProjectId={cpaProjectId} systemProjectId={Number(project.project_id)} projectName={project.project_name} onBack={onBack} />;
}
