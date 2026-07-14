import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Building2 } from "lucide-react";

interface ProjectSelectorProps {
  selectedId: number | null;
  onSelect: (id: number) => void;
  className?: string;
}

export function ProjectSelector({ selectedId, onSelect, className }: ProjectSelectorProps) {
  const { user } = useAuth();
  const projectsQuery = trpc.projects.list.useQuery(undefined, { enabled: !!user });

  return (
    <div className={`flex items-center gap-2 ${className || ''}`}>
      <Building2 className="w-4 h-4 text-slate-400" />
      <Select
        value={selectedId ? String(selectedId) : ""}
        onValueChange={(val) => onSelect(Number(val))}
      >
        <SelectTrigger className="w-[280px] bg-slate-800/50 border-slate-600 h-9 text-sm text-white">
          <SelectValue placeholder="اختر المشروع..." />
        </SelectTrigger>
        <SelectContent>
          {projectsQuery.data?.map((p: any) => (
            <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
