import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  PROJECT_INPUTS,
  RATES,
  dbProjectToInputs,
  dbProjectToRates,
  type ProjectInputs,
  type ProjectRates,
} from "@/lib/projectData";

export function useProjectData() {
  const { user } = useAuth();
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  const projectsQuery = trpc.projects.list.useQuery(undefined, { enabled: !!user });
  const projectQuery = trpc.projects.getById.useQuery(selectedProjectId!, {
    enabled: !!selectedProjectId && !!user,
  });

  const { inputs, rates } = useMemo(() => {
    if (projectQuery.data) {
      return {
        inputs: dbProjectToInputs(projectQuery.data),
        rates: dbProjectToRates(projectQuery.data),
      };
    }
    return { inputs: PROJECT_INPUTS, rates: RATES };
  }, [projectQuery.data]);

  return {
    selectedProjectId,
    setSelectedProjectId,
    projects: projectsQuery.data || [],
    projectData: projectQuery.data,
    inputs,
    rates,
    isLoading: projectQuery.isLoading && !!selectedProjectId,
  };
}
