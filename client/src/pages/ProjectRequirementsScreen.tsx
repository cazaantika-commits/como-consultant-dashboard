import { trpc } from "@/lib/trpc";
import { ProjectConsultantRequirements } from "@/components/consultant/ProjectConsultantRequirements";

export default function ProjectRequirementsScreen({ projectId, onBack }: { projectId: number; onBack: () => void }) {
  const projectQuery = trpc.cpa.projects.getById.useQuery({ id: projectId });
  if (projectQuery.isLoading) return <div className="py-12 text-center text-sm text-slate-500">جاري تحميل المشروع…</div>;
  if (!projectQuery.data) return <div className="py-12 text-center text-sm text-red-600">المشروع غير موجود</div>;
  return <ProjectConsultantRequirements projectId={Number((projectQuery.data as any).project_id)} projectName={(projectQuery.data as any).project_name} onBack={onBack} />;
}
