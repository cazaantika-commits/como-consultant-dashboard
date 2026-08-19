import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

const STORAGE_KEY = "como_selected_project_id";

interface ProjectContextValue {
  selectedProjectId: number | null;
  setSelectedProjectId: (id: number | null) => void;
  projects: any[];
  projectsLoading: boolean;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [selectedProjectId, setSelectedProjectIdState] = useState<number | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? Number(saved) : null;
  });

  // Re-read the persisted choice after client hydration. This keeps project-first
  // Financial Studies pages in their selected-project context after a reload.
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const savedProjectId = saved ? Number(saved) : null;
    if (savedProjectId && Number.isFinite(savedProjectId) && savedProjectId !== selectedProjectId) {
      setSelectedProjectIdState(savedProjectId);
    }
  }, [selectedProjectId]);

  const projectsQuery = trpc.projects.list.useQuery(undefined, { enabled: !!user });
  const projects = projectsQuery.data || [];

  function setSelectedProjectId(id: number | null) {
    setSelectedProjectIdState(id);
    if (id !== null) {
      localStorage.setItem(STORAGE_KEY, String(id));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  return (
    <ProjectContext.Provider value={{ selectedProjectId, setSelectedProjectId, projects, projectsLoading: projectsQuery.isLoading }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjectContext() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProjectContext must be used within ProjectProvider");
  return ctx;
}
