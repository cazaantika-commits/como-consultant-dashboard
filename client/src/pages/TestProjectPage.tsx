import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useProjectContext } from "@/contexts/ProjectContext";
import BateekhaPage from "./BateekhaPage";

export default function TestProjectPage() {
  const { user } = useAuth({ redirectOnUnauthenticated: true });
  const { setSelectedProjectId } = useProjectContext();
  const requestedCreation = useRef(false);
  const testProjectQuery = trpc.projects.getTestProject.useQuery(undefined, {
    enabled: !!user,
    staleTime: 30_000,
  });
  const ensureTestProject = trpc.projects.ensureTestProject.useMutation({
    onSuccess: async () => {
      await testProjectQuery.refetch();
    },
  });

  useEffect(() => {
    if (!user || testProjectQuery.isLoading || testProjectQuery.data || requestedCreation.current) return;
    requestedCreation.current = true;
    ensureTestProject.mutate();
  }, [ensureTestProject, testProjectQuery.data, testProjectQuery.isLoading, user]);

  useEffect(() => {
    if (testProjectQuery.data?.id) {
      setSelectedProjectId(testProjectQuery.data.id);
    }
  }, [setSelectedProjectId, testProjectQuery.data?.id]);

  if (testProjectQuery.isLoading || ensureTestProject.isPending || !testProjectQuery.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50" dir="rtl">
        <div className="rounded-2xl border border-violet-200 bg-white px-8 py-7 text-center shadow-sm">
          <div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-2 border-violet-100 border-t-violet-600" />
          <p className="text-sm font-black text-slate-900">جاري تجهيز المشروع التجريبي المعزول</p>
          <p className="mt-1 text-xs text-slate-500">يتم ربط نفس بطاقات المشروع دون إضافته إلى القوائم الرسمية.</p>
          {ensureTestProject.error && <p className="mt-3 text-xs font-bold text-red-700">{ensureTestProject.error.message}</p>}
        </div>
      </div>
    );
  }

  return (
    <BateekhaPage
      mode="test"
      testCpaProjectId={testProjectQuery.data.cpaProjectId}
    />
  );
}
