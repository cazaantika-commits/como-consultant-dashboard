import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { default as Building2 } from "lucide-react/dist/esm/icons/building-2.js";

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
      <Building2 className="w-4 h-4 text-teal-600" />
      <Select
        value={selectedId ? String(selectedId) : ""}
        onValueChange={(val) => onSelect(Number(val))}
      >
        <SelectTrigger className="w-[280px] bg-white border-2 border-teal-400 rounded-full h-9 text-sm text-gray-800 font-semibold shadow-sm hover:border-teal-500 transition-colors">
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
