import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import {
  ArrowRight, Plus, Pencil, Trash2, FileText, Upload, Search,
  Scale, Loader2, CheckCircle, XCircle, Clock, AlertTriangle,
  Building2, Filter, Eye, Brain, Settings, ChevronDown,
  Calendar, DollarSign, Users as UsersIcon, Shield, FolderOpen,
  Download, BarChart3, Tag
} from "lucide-react";

// ═══════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "مسودة", color: "bg-gray-100 text-gray-700 border-gray-200", icon: Clock },
  active: { label: "ساري", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle },
  expired: { label: "منتهي", color: "bg-red-100 text-red-700 border-red-200", icon: XCircle },
  terminated: { label: "ملغي", color: "bg-orange-100 text-orange-700 border-orange-200", icon: AlertTriangle },
  renewed: { label: "مُجدد", color: "bg-blue-100 text-blue-700 border-blue-200", icon: CheckCircle },
  pending: { label: "قيد المراجعة", color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: Clock },
};

const ANALYSIS_STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  not_analyzed: { label: "لم يُحلل", color: "bg-gray-100 text-gray-600", icon: Clock },
  analyzing: { label: "جاري التحليل", color: "bg-blue-100 text-blue-600", icon: Loader2 },
  completed: { label: "تم التحليل", color: "bg-emerald-100 text-emerald-600", icon: CheckCircle },
  failed: { label: "فشل التحليل", color: "bg-red-100 text-red-600", icon: XCircle },
};

const CATEGORY_MAP: Record<string, { label: string; color: string }> = {
  land: { label: "أراضي", color: "bg-amber-100 text-amber-700" },
  consultant: { label: "استشاريون", color: "bg-blue-100 text-blue-700" },
  construction: { label: "مقاولات", color: "bg-orange-100 text-orange-700" },
  government: { label: "جهات حكومية", color: "bg-purple-100 text-purple-700" },
  sales: { label: "مبيعات", color: "bg-green-100 text-green-700" },
  other: { label: "أخرى", color: "bg-gray-100 text-gray-700" },
};

// ═══════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════

export default function ContractsRegistryPage() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  // State
  const [activeTab, setActiveTab] = useState("contracts");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddContract, setShowAddContract] = useState(false);
  const [showAddType, setShowAddType] = useState(false);
  const [editingType, setEditingType] = useState<any>(null);
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);

  // Queries
  const { data: contractTypes = [], isLoading: typesLoading } = trpc.contracts.listTypes.useQuery();
  const { data: contracts = [], isLoading: contractsLoading } = trpc.contracts.list.useQuery({});
  const { data: projects = [] } = trpc.projects.list.useQuery();
  const { data: stats } = trpc.contracts.stats.useQuery();

  // Mutations
  const seedMutation = trpc.contracts.seedDefaultTypes.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      utils.contracts.listTypes.invalidate();
    },
  });

  const addTypeMutation = trpc.contracts.addType.useMutation({
    onSuccess: () => {
      toast.success("تم إضافة نوع العقد");
      utils.contracts.listTypes.invalidate();
      setShowAddType(false);
    },
  });

  const updateTypeMutation = trpc.contracts.updateType.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث نوع العقد");
      utils.contracts.listTypes.invalidate();
      setEditingType(null);
    },
  });

  const deleteTypeMutation = trpc.contracts.deleteType.useMutation({
    onSuccess: () => {
      toast.success("تم حذف نوع العقد");
      utils.contracts.listTypes.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const addContractMutation = trpc.contracts.add.useMutation({
    onSuccess: () => {
      toast.success("تم إضافة العقد");
      utils.contracts.list.invalidate();
      utils.contracts.stats.invalidate();
      setShowAddContract(false);
    },
  });

  const deleteContractMutation = trpc.contracts.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف العقد");
      utils.contracts.list.invalidate();
      utils.contracts.stats.invalidate();
    },
  });

  const analyzeMutation = trpc.contracts.analyzeContract.useMutation({
    onSuccess: () => {
      toast.success("تم تحليل العقد بنجاح");
      utils.contracts.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const uploadFileMutation = trpc.contracts.uploadFile.useMutation();

  // Filtered contracts
  const filteredContracts = useMemo(() => {
    return contracts.filter((c: any) => {
      if (filterProject !== "all" && c.projectId !== Number(filterProject)) return false;
      if (filterType !== "all" && c.contractTypeId !== Number(filterType)) return false;
      if (filterStatus !== "all" && c.status !== filterStatus) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          c.title?.toLowerCase().includes(q) ||
          c.contractNumber?.toLowerCase().includes(q) ||
          c.partyA?.toLowerCase().includes(q) ||
          c.partyB?.toLowerCase().includes(q) ||
          c.contractType?.name?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [contracts, filterProject, filterType, filterStatus, searchQuery]);

  // Auth check
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" dir="rtl">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <Scale className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-bold mb-2">سجل العقود</h2>
            <p className="text-muted-foreground mb-4">يرجى تسجيل الدخول للوصول إلى سجل العقود</p>
            <Button onClick={() => window.location.href = getLoginUrl()}>تسجيل الدخول</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-r from-stone-700 to-stone-900 text-white px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-white hover:bg-white/20">
              <ArrowRight className="w-4 h-4 ml-1" />
              الرئيسية
            </Button>
            <Separator orientation="vertical" className="h-6 bg-white/20" />
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5" />
              <span className="text-lg font-bold">سجل العقود</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-stone-300 text-sm">{user?.name}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <Card className="border-border/50">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{stats?.total || 0}</div>
              <div className="text-xs text-muted-foreground">إجمالي العقود</div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-emerald-600">{stats?.active || 0}</div>
              <div className="text-xs text-muted-foreground">عقود سارية</div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{stats?.analyzed || 0}</div>
              <div className="text-xs text-muted-foreground">تم تحليلها</div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-amber-600">{stats?.pending || 0}</div>
              <div className="text-xs text-muted-foreground">بانتظار التحليل</div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-red-600">{stats?.expired || 0}</div>
              <div className="text-xs text-muted-foreground">منتهية</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between mb-6">
            <TabsList>
              <TabsTrigger value="contracts" className="gap-1.5">
                <FileText className="w-4 h-4" />
                العقود
              </TabsTrigger>
              <TabsTrigger value="types" className="gap-1.5">
                <Settings className="w-4 h-4" />
                أنواع العقود
              </TabsTrigger>
            </TabsList>

            {activeTab === "contracts" && (
              <Dialog open={showAddContract} onOpenChange={setShowAddContract}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="w-4 h-4" />
                    إضافة عقد
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
                  <DialogHeader>
                    <DialogTitle className="text-right flex items-center gap-2">
                      <Plus className="w-5 h-5 text-emerald-600" />
                      إضافة عقد جديد
                    </DialogTitle>
                  </DialogHeader>
                  <AddContractForm
                    projects={projects}
                    contractTypes={contractTypes}
                    onSave={(data) => addContractMutation.mutate(data)}
                    onCancel={() => setShowAddContract(false)}
                    saving={addContractMutation.isPending}
                    uploadFile={uploadFileMutation}
                  />
                </DialogContent>
              </Dialog>
            )}

            {activeTab === "types" && (
              <div className="flex gap-2">
                {contractTypes.length === 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => seedMutation.mutate()}
                    disabled={seedMutation.isPending}
                    className="gap-1.5"
                  >
                    {seedMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    تحميل الأنواع الافتراضية (31)
                  </Button>
                )}
                <Dialog open={showAddType} onOpenChange={setShowAddType}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                      <Plus className="w-4 h-4" />
                      نوع جديد
                    </Button>
                  </DialogTrigger>
                  <DialogContent dir="rtl">
                    <DialogHeader>
                      <DialogTitle className="text-right">إضافة نوع عقد جديد</DialogTitle>
                    </DialogHeader>
                    <ContractTypeForm
                      onSave={(data) => addTypeMutation.mutate(data)}
                      onCancel={() => setShowAddType(false)}
                      saving={addTypeMutation.isPending}
                    />
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </div>

          {/* Contracts Tab */}
          <TabsContent value="contracts">
            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-6">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="بحث في العقود..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-9"
                />
              </div>
              <Select value={filterProject} onValueChange={setFilterProject}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="كل المشاريع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل المشاريع</SelectItem>
                  {projects.map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="كل الأنواع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الأنواع</SelectItem>
                  {contractTypes.map((t: any) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="كل الحالات" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الحالات</SelectItem>
                  {Object.entries(STATUS_MAP).map(([key, val]) => (
                    <SelectItem key={key} value={key}>{val.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Contracts List */}
            {contractsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredContracts.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="p-12 text-center">
                  <Scale className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
                  <h3 className="text-lg font-semibold mb-2">لا توجد عقود</h3>
                  <p className="text-muted-foreground mb-4">
                    {contracts.length === 0
                      ? "ابدأ بإضافة عقود لمشاريعك"
                      : "لا توجد نتائج تطابق معايير البحث"}
                  </p>
                  {contracts.length === 0 && (
                    <Button onClick={() => setShowAddContract(true)} className="gap-1.5">
                      <Plus className="w-4 h-4" />
                      إضافة أول عقد
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredContracts.map((contract: any) => (
                  <ContractCard
                    key={contract.id}
                    contract={contract}
                    onAnalyze={() => analyzeMutation.mutate({ contractId: contract.id })}
                    onDelete={() => {
                      if (confirm("هل أنت متأكد من حذف هذا العقد؟")) {
                        deleteContractMutation.mutate({ id: contract.id });
                      }
                    }}
                    onViewAnalysis={() => {
                      setSelectedContract(contract);
                      setShowAnalysis(true);
                    }}
                    analyzing={analyzeMutation.isPending}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Contract Types Tab */}
          <TabsContent value="types">
            {typesLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : contractTypes.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="p-12 text-center">
                  <Tag className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
                  <h3 className="text-lg font-semibold mb-2">لا توجد أنواع عقود</h3>
                  <p className="text-muted-foreground mb-4">
                    يمكنك تحميل 31 نوع عقد افتراضي أو إضافة أنواع مخصصة
                  </p>
                  <Button
                    onClick={() => seedMutation.mutate()}
                    disabled={seedMutation.isPending}
                    className="gap-1.5"
                  >
                    {seedMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    تحميل الأنواع الافتراضية
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {Object.entries(CATEGORY_MAP).map(([catKey, catVal]) => {
                  const catTypes = contractTypes.filter((t: any) => (t.category || "other") === catKey);
                  if (catTypes.length === 0) return null;
                  return (
                    <div key={catKey} className="mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        <Badge variant="outline" className={catVal.color + " border-0 text-xs"}>
                          {catVal.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">({catTypes.length})</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {catTypes.map((type: any) => (
                          <Card key={type.id} className="border-border/50 hover:shadow-sm transition-shadow">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    {type.code && (
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                                        {type.code}
                                      </Badge>
                                    )}
                                    <span className="font-medium text-sm truncate">{type.name}</span>
                                  </div>
                                  {type.nameEn && (
                                    <p className="text-xs text-muted-foreground truncate" dir="ltr">{type.nameEn}</p>
                                  )}
                                  {type.description && (
                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{type.description}</p>
                                  )}
                                </div>
                                <div className="flex gap-1 mr-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={() => setEditingType(type)}
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                                    onClick={() => {
                                      if (confirm(`هل أنت متأكد من حذف "${type.name}"؟`)) {
                                        deleteTypeMutation.mutate({ id: type.id });
                                      }
                                    }}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Type Dialog */}
      <Dialog open={!!editingType} onOpenChange={(open) => !open && setEditingType(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">تعديل نوع العقد</DialogTitle>
          </DialogHeader>
          {editingType && (
            <ContractTypeForm
              initialData={editingType}
              onSave={(data) => updateTypeMutation.mutate({ id: editingType.id, ...data })}
              onCancel={() => setEditingType(null)}
              saving={updateTypeMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Analysis Dialog */}
      <Dialog open={showAnalysis} onOpenChange={setShowAnalysis}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right flex items-center gap-2">
              <Brain className="w-5 h-5 text-blue-600" />
              تحليل فاروق — {selectedContract?.title}
            </DialogTitle>
          </DialogHeader>
          {selectedContract && <AnalysisView contract={selectedContract} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Contract Card Component
// ═══════════════════════════════════════════════════

function ContractCard({ contract, onAnalyze, onDelete, onViewAnalysis, analyzing }: {
  contract: any;
  onAnalyze: () => void;
  onDelete: () => void;
  onViewAnalysis: () => void;
  analyzing: boolean;
}) {
  const status = STATUS_MAP[contract.status] || STATUS_MAP.draft;
  const analysisStatus = ANALYSIS_STATUS_MAP[contract.analysisStatus] || ANALYSIS_STATUS_MAP.not_analyzed;
  const StatusIcon = status.icon;
  const AnalysisIcon = analysisStatus.icon;

  return (
    <Card className="border-border/50 hover:shadow-md transition-all">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-stone-100 to-stone-200 flex items-center justify-center flex-shrink-0">
            <FileText className="w-6 h-6 text-stone-600" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-semibold text-foreground">{contract.title}</h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {contract.contractType && (
                    <Badge variant="outline" className="text-[10px]">
                      {contract.contractType.code && `${contract.contractType.code} — `}
                      {contract.contractType.name}
                    </Badge>
                  )}
                  {contract.project && (
                    <Badge variant="outline" className="text-[10px] bg-stone-50">
                      <Building2 className="w-3 h-3 ml-1" />
                      {contract.project.name}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`text-[10px] ${status.color}`}>
                  <StatusIcon className="w-3 h-3 ml-1" />
                  {status.label}
                </Badge>
              </div>
            </div>

            {/* Details Row */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3 flex-wrap">
              {contract.partyA && (
                <span className="flex items-center gap-1">
                  <UsersIcon className="w-3 h-3" />
                  {contract.partyA}
                </span>
              )}
              {contract.partyB && (
                <span className="flex items-center gap-1">
                  ↔ {contract.partyB}
                </span>
              )}
              {contract.contractValue && (
                <span className="flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />
                  {Number(contract.contractValue).toLocaleString()} {contract.currency}
                </span>
              )}
              {contract.signDate && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {contract.signDate}
                </span>
              )}
              {contract.contractNumber && (
                <span className="font-mono text-[10px]">#{contract.contractNumber}</span>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              {contract.fileUrl && (
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" asChild>
                  <a href={contract.fileUrl} target="_blank" rel="noopener noreferrer">
                    <Eye className="w-3 h-3" />
                    عرض الملف
                  </a>
                </Button>
              )}

              {contract.analysisStatus === "completed" ? (
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-emerald-600" onClick={onViewAnalysis}>
                  <Brain className="w-3 h-3" />
                  عرض التحليل
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1 text-blue-600"
                  onClick={onAnalyze}
                  disabled={analyzing || !contract.fileUrl || contract.analysisStatus === "analyzing"}
                >
                  {analyzing || contract.analysisStatus === "analyzing" ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Brain className="w-3 h-3" />
                  )}
                  تحليل فاروق
                </Button>
              )}

              <Badge variant="outline" className={`text-[10px] ${analysisStatus.color}`}>
                <AnalysisIcon className={`w-3 h-3 ml-1 ${contract.analysisStatus === "analyzing" ? "animate-spin" : ""}`} />
                {analysisStatus.label}
              </Badge>

              <div className="mr-auto">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                  onClick={onDelete}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════
// Add Contract Form
// ═══════════════════════════════════════════════════

function AddContractForm({ projects, contractTypes, onSave, onCancel, saving, uploadFile }: {
  projects: any[];
  contractTypes: any[];
  onSave: (data: any) => void;
  onCancel: () => void;
  saving: boolean;
  uploadFile: any;
}) {
  const [form, setForm] = useState({
    projectId: 0,
    contractTypeId: 0,
    title: "",
    contractNumber: "",
    partyA: "",
    partyB: "",
    contractValue: "",
    currency: "AED",
    signDate: "",
    startDate: "",
    endDate: "",
    status: "draft",
    notes: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleSave = async () => {
    if (!form.projectId || !form.contractTypeId || !form.title) {
      toast.error("يرجى ملء الحقول المطلوبة: المشروع، نوع العقد، العنوان");
      return;
    }
    onSave(form);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-1 block">المشروع *</label>
          <Select value={form.projectId ? String(form.projectId) : ""} onValueChange={(v) => setForm({ ...form, projectId: Number(v) })}>
            <SelectTrigger>
              <SelectValue placeholder="اختر المشروع" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p: any) => (
                <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">نوع العقد *</label>
          <Select value={form.contractTypeId ? String(form.contractTypeId) : ""} onValueChange={(v) => setForm({ ...form, contractTypeId: Number(v) })}>
            <SelectTrigger>
              <SelectValue placeholder="اختر نوع العقد" />
            </SelectTrigger>
            <SelectContent>
              {contractTypes.map((t: any) => (
                <SelectItem key={t.id} value={String(t.id)}>
                  {t.code ? `${t.code} — ` : ""}{t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium mb-1 block">عنوان العقد *</label>
        <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثال: عقد تصميم مبنى الجداف السكني" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-1 block">رقم العقد</label>
          <Input value={form.contractNumber} onChange={(e) => setForm({ ...form, contractNumber: e.target.value })} placeholder="مثال: CT-2024-001" />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">الحالة</label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_MAP).map(([key, val]) => (
                <SelectItem key={key} value={key}>{val.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-1 block">الطرف الأول</label>
          <Input value={form.partyA} onChange={(e) => setForm({ ...form, partyA: e.target.value })} placeholder="مثال: Como Developments" />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">الطرف الثاني</label>
          <Input value={form.partyB} onChange={(e) => setForm({ ...form, partyB: e.target.value })} placeholder="مثال: اسم الاستشاري أو المقاول" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-1 block">قيمة العقد</label>
          <Input type="number" value={form.contractValue} onChange={(e) => setForm({ ...form, contractValue: e.target.value })} placeholder="مثال: 500000" />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">العملة</label>
          <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AED">AED - درهم إماراتي</SelectItem>
              <SelectItem value="USD">USD - دولار أمريكي</SelectItem>
              <SelectItem value="EUR">EUR - يورو</SelectItem>
              <SelectItem value="GBP">GBP - جنيه إسترليني</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-sm font-medium mb-1 block">تاريخ التوقيع</label>
          <Input type="date" value={form.signDate} onChange={(e) => setForm({ ...form, signDate: e.target.value })} />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">تاريخ البدء</label>
          <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">تاريخ الانتهاء</label>
          <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium mb-1 block">ملاحظات</label>
        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="ملاحظات إضافية..." rows={3} />
      </div>

      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onCancel}>إلغاء</Button>
        <Button onClick={handleSave} disabled={saving} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          إضافة العقد
        </Button>
      </DialogFooter>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Contract Type Form
// ═══════════════════════════════════════════════════

function ContractTypeForm({ initialData, onSave, onCancel, saving }: {
  initialData?: any;
  onSave: (data: any) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    name: initialData?.name || "",
    nameEn: initialData?.nameEn || "",
    code: initialData?.code || "",
    category: initialData?.category || "other",
    description: initialData?.description || "",
  });

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-1 block">اسم نوع العقد (عربي) *</label>
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: عقد استشاري هندسي" />
      </div>
      <div>
        <label className="text-sm font-medium mb-1 block">الاسم بالإنجليزية</label>
        <Input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} placeholder="e.g. Engineering Consultant" dir="ltr" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-1 block">الكود المختصر</label>
          <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="مثال: ECD" dir="ltr" />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">التصنيف</label>
          <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CATEGORY_MAP).map(([key, val]) => (
                <SelectItem key={key} value={key}>{val.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <label className="text-sm font-medium mb-1 block">الوصف</label>
        <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="وصف مختصر لنوع العقد..." rows={2} />
      </div>
      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onCancel}>إلغاء</Button>
        <Button onClick={() => onSave(form)} disabled={saving || !form.name} className="gap-1.5">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          حفظ
        </Button>
      </DialogFooter>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Analysis View Component
// ═══════════════════════════════════════════════════

function AnalysisView({ contract }: { contract: any }) {
  if (contract.analysisStatus !== "completed") {
    return (
      <div className="text-center py-8">
        <Brain className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
        <p className="text-muted-foreground">لم يتم تحليل هذا العقد بعد</p>
      </div>
    );
  }

  const keyDates = safeParseJson(contract.analysisKeyDates, []);
  const penalties = safeParseJson(contract.analysisPenalties, []);
  const obligations = safeParseJson(contract.analysisObligations, []);
  const risks = safeParseJson(contract.analysisRisks, []);
  const parties = safeParseJson(contract.analysisParties, []);

  return (
    <div className="space-y-6">
      {/* Summary */}
      {contract.analysisSummary && (
        <div>
          <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            الملخص
          </h4>
          <p className="text-sm text-muted-foreground bg-blue-50 rounded-lg p-4 leading-relaxed">
            {contract.analysisSummary}
          </p>
        </div>
      )}

      {/* Key Dates */}
      {keyDates.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-600" />
            المواعيد المهمة
          </h4>
          <div className="space-y-2">
            {keyDates.map((d: any, i: number) => (
              <div key={i} className="flex items-center gap-3 text-sm bg-amber-50 rounded-lg p-3">
                <Badge variant="outline" className={
                  d.importance === "high" ? "bg-red-100 text-red-700 border-red-200" :
                  d.importance === "medium" ? "bg-amber-100 text-amber-700 border-amber-200" :
                  "bg-gray-100 text-gray-700 border-gray-200"
                }>
                  {d.importance === "high" ? "عالي" : d.importance === "medium" ? "متوسط" : "منخفض"}
                </Badge>
                <span className="font-mono text-xs">{d.date}</span>
                <span className="text-muted-foreground">{d.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Penalties */}
      {penalties.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            الغرامات والجزاءات
          </h4>
          <div className="space-y-2">
            {penalties.map((p: any, i: number) => (
              <div key={i} className="text-sm bg-red-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className={
                    p.severity === "high" ? "bg-red-100 text-red-700 border-red-200" :
                    p.severity === "medium" ? "bg-amber-100 text-amber-700 border-amber-200" :
                    "bg-gray-100 text-gray-700 border-gray-200"
                  }>
                    {p.severity === "high" ? "خطير" : p.severity === "medium" ? "متوسط" : "منخفض"}
                  </Badge>
                  <span className="font-medium">{p.type}</span>
                  {p.amount && <span className="text-red-600 font-mono text-xs">{p.amount}</span>}
                </div>
                <p className="text-muted-foreground text-xs">{p.condition}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Obligations */}
      {obligations.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <Shield className="w-4 h-4 text-purple-600" />
            الالتزامات
          </h4>
          <div className="space-y-2">
            {obligations.map((o: any, i: number) => (
              <div key={i} className="text-sm bg-purple-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-200 text-[10px]">
                    {o.party}
                  </Badge>
                  {o.deadline && <span className="text-xs text-muted-foreground font-mono">{o.deadline}</span>}
                </div>
                <p className="text-muted-foreground text-xs">{o.obligation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risks */}
      {risks.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-600" />
            المخاطر القانونية
          </h4>
          <div className="space-y-2">
            {risks.map((r: any, i: number) => (
              <div key={i} className="text-sm bg-orange-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className={
                    r.severity === "high" ? "bg-red-100 text-red-700 border-red-200" :
                    r.severity === "medium" ? "bg-amber-100 text-amber-700 border-amber-200" :
                    "bg-gray-100 text-gray-700 border-gray-200"
                  }>
                    {r.severity === "high" ? "عالي" : r.severity === "medium" ? "متوسط" : "منخفض"}
                  </Badge>
                  <span className="font-medium">{r.risk}</span>
                </div>
                {r.recommendation && (
                  <p className="text-xs text-muted-foreground mt-1">💡 {r.recommendation}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Parties */}
      {parties.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <UsersIcon className="w-4 h-4 text-stone-600" />
            الأطراف
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {parties.map((p: any, i: number) => (
              <div key={i} className="text-sm bg-stone-50 rounded-lg p-3">
                <div className="font-medium mb-1">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.role}</div>
                {p.responsibilities && (
                  <div className="text-xs text-muted-foreground mt-1">{p.responsibilities}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Termination */}
      {contract.analysisTermination && (
        <div>
          <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-600" />
            شروط الإنهاء
          </h4>
          <p className="text-sm text-muted-foreground bg-red-50 rounded-lg p-4 leading-relaxed">
            {contract.analysisTermination}
          </p>
        </div>
      )}

      {/* Notes */}
      {contract.analysisNotes && (
        <div>
          <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <Brain className="w-4 h-4 text-emerald-600" />
            ملاحظات وتوصيات فاروق
          </h4>
          <p className="text-sm text-muted-foreground bg-emerald-50 rounded-lg p-4 leading-relaxed">
            {contract.analysisNotes}
          </p>
        </div>
      )}

      {contract.analyzedAt && (
        <p className="text-[10px] text-muted-foreground text-center">
          تم التحليل: {new Date(contract.analyzedAt).toLocaleString("ar-AE")}
        </p>
      )}
    </div>
  );
}

// Helper
function safeParseJson(str: string | null, fallback: any) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}
