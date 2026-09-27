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

function readProjectIdFromLocation(): number | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("projectId");
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [selectedProjectId, setSelectedProjectIdState] = useState<number | null>(() => {
    const linkedProjectId = readProjectIdFromLocation();
    if (linkedProjectId) return linkedProjectId;
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? Number(saved) : null;
  });

  // A direct project link is authoritative for the first page load. Persist it so
  // subsequent project-first pages keep the same official project context.
  useEffect(() => {
    const linkedProjectId = readProjectIdFromLocation();
    if (linkedProjectId) {
      setSelectedProjectIdState(linkedProjectId);
      localStorage.setItem(STORAGE_KEY, String(linkedProjectId));
      return;
    }
    const saved = localStorage.getItem(STORAGE_KEY);
    const savedProjectId = saved ? Number(saved) : null;
    if (savedProjectId && Number.isFinite(savedProjectId)) {
      setSelectedProjectIdState(savedProjectId);
    }
  }, []);

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
