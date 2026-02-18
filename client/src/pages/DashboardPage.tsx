import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, Trash2 } from "lucide-react";

export default function DashboardPage() {
  const { user, isAuthenticated } = useAuth();
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [newConsultantName, setNewConsultantName] = useState("");

  // Queries
  const projectsQuery = trpc.projects.list.useQuery();
  const consultantsQuery = trpc.consultants.list.useQuery();
  const projectDetailsQuery = trpc.projects.getWithDetails.useQuery(selectedProjectId || 0, {
    enabled: !!selectedProjectId,
  });

  // Mutations
  const createProjectMutation = trpc.projects.create.useMutation({
    onSuccess: () => {
      projectsQuery.refetch();
      setNewProjectName("");
    },
  });

  const deleteProjectMutation = trpc.projects.delete.useMutation({
    onSuccess: () => {
      projectsQuery.refetch();
      setSelectedProjectId(null);
    },
  });

  const createConsultantMutation = trpc.consultants.create.useMutation({
    onSuccess: () => {
      consultantsQuery.refetch();
      setNewConsultantName("");
    },
  });

  const deleteConsultantMutation = trpc.consultants.delete.useMutation({
    onSuccess: () => {
      consultantsQuery.refetch();
    },
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="pt-6">
            <p>يرجى تسجيل الدخول للمتابعة</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const projects = projectsQuery.data || [];
  const consultants = consultantsQuery.data || [];
  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6" dir="rtl">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-8 rounded-lg mb-8 shadow-lg">
          <h1 className="text-4xl font-bold mb-2">📊 لوحة تحكم تقييم الاستشاريين</h1>
          <p className="text-blue-100">مشاريع كومو للتطوير العقاري</p>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="projects" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="projects">المشاريع</TabsTrigger>
            <TabsTrigger value="consultants">الاستشاريين</TabsTrigger>
            <TabsTrigger value="evaluation">التقييم</TabsTrigger>
          </TabsList>

          {/* Projects Tab */}
          <TabsContent value="projects" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>إضافة مشروع جديد</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    placeholder="اسم المشروع"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    dir="rtl"
                  />
                  <Button
                    onClick={() => {
                      if (newProjectName.trim()) {
                        createProjectMutation.mutate({ name: newProjectName });
                      }
                    }}
                    disabled={createProjectMutation.isPending}
                  >
                    {createProjectMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    إضافة
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projectsQuery.isLoading ? (
                <div className="col-span-2 flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : projects.length === 0 ? (
                <div className="col-span-2 text-center text-gray-500">
                  لا توجد مشاريع حالياً
                </div>
              ) : (
                projects.map((project) => (
                  <Card
                    key={project.id}
                    className={`cursor-pointer transition-all ${
                      selectedProjectId === project.id
                        ? "ring-2 ring-blue-500"
                        : "hover:shadow-lg"
                    }`}
                    onClick={() => setSelectedProjectId(project.id)}
                  >
                    <CardHeader>
                      <CardTitle className="text-lg">{project.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-600 mb-4">
                        {project.description || "بدون وصف"}
                      </p>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteProjectMutation.mutate(project.id);
                        }}
                        disabled={deleteProjectMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Consultants Tab */}
          <TabsContent value="consultants" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>إضافة استشاري جديد</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    placeholder="اسم الاستشاري"
                    value={newConsultantName}
                    onChange={(e) => setNewConsultantName(e.target.value)}
                    dir="rtl"
                  />
                  <Button
                    onClick={() => {
                      if (newConsultantName.trim()) {
                        createConsultantMutation.mutate({ name: newConsultantName });
                      }
                    }}
                    disabled={createConsultantMutation.isPending}
                  >
                    {createConsultantMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    إضافة
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {consultantsQuery.isLoading ? (
                <div className="col-span-2 flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : consultants.length === 0 ? (
                <div className="col-span-2 text-center text-gray-500">
                  لا توجد استشاريين حالياً
                </div>
              ) : (
                consultants.map((consultant) => (
                  <Card key={consultant.id}>
                    <CardHeader>
                      <CardTitle className="text-lg">{consultant.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {consultant.email && (
                        <p className="text-sm text-gray-600 mb-2">{consultant.email}</p>
                      )}
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteConsultantMutation.mutate(consultant.id)}
                        disabled={deleteConsultantMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Evaluation Tab */}
          <TabsContent value="evaluation">
            {selectedProject ? (
              <Card>
                <CardHeader>
                  <CardTitle>تقييم المشروع: {selectedProject.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">
                    سيتم إضافة نموذج التقييم الكامل هنا
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-gray-500">
                    يرجى اختيار مشروع أولاً
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
