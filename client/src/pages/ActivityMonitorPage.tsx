import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  ArrowLeft,
  Activity,
  Search,
  FileText,
  Brain,
  Database,
  Bot,
  BarChart3,
  BookOpen,
  RefreshCw,
  Filter,
  ChevronDown,
  ChevronUp,
  Eye,
  Wrench,
} from "lucide-react";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";

const AGENT_NAMES: Record<string, string> = {
  salwa: "سلوى", farouq: "فاروق", khazen: "خازن", buraq: "براق",
  khaled: "خالد", alina: "ألينا", baz: "باز", joelle: "جويل",
};

const AGENT_COLORS: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  salwa: { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200 dark:border-amber-800", icon: "text-amber-500" },
  farouq: { bg: "bg-purple-50 dark:bg-purple-950/30", text: "text-purple-700 dark:text-purple-300", border: "border-purple-200 dark:border-purple-800", icon: "text-purple-500" },
  khazen: { bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200 dark:border-blue-800", icon: "text-blue-500" },
  buraq: { bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-800", icon: "text-emerald-500" },
  khaled: { bg: "bg-cyan-50 dark:bg-cyan-950/30", text: "text-cyan-700 dark:text-cyan-300", border: "border-cyan-200 dark:border-cyan-800", icon: "text-cyan-500" },
  alina: { bg: "bg-pink-50 dark:bg-pink-950/30", text: "text-pink-700 dark:text-pink-300", border: "border-pink-200 dark:border-pink-800", icon: "text-pink-500" },
  baz: { bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-700 dark:text-orange-300", border: "border-orange-200 dark:border-orange-800", icon: "text-orange-500" },
  joelle: { bg: "bg-indigo-50 dark:bg-indigo-950/30", text: "text-indigo-700 dark:text-indigo-300", border: "border-indigo-200 dark:border-indigo-800", icon: "text-indigo-500" },
};

type TabType = 'activity' | 'documents' | 'knowledge' | 'stats';

export default function ActivityMonitorPage() {
  const { loading, user } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<TabType>('activity');
  const [agentFilter, setAgentFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // Queries - agentStats returns an array of { agentName, totalActions, successCount, failureCount, avgDurationMs, lastActivity }
  const activityLog = trpc.activityMonitor.getActivityLog.useQuery({
    agentName: agentFilter || undefined,
    limit: 50,
  }, { refetchInterval: 10000 });

  const agentStats = trpc.activityMonitor.getAgentStats.useQuery({});

  const indexStats = trpc.activityMonitor.getIndexStats.useQuery(undefined, {
    enabled: activeTab === 'documents' || activeTab === 'stats',
  });

  const knowledgeStats = trpc.activityMonitor.getKnowledgeStats.useQuery(undefined, {
    enabled: activeTab === 'knowledge' || activeTab === 'stats',
  });

  const docSearch = trpc.activityMonitor.searchDocuments.useQuery({
    query: searchQuery,
    limit: 10,
  }, {
    enabled: activeTab === 'documents' && searchQuery.length > 2,
  });

  const knowledgeSearch = trpc.activityMonitor.searchKnowledge.useQuery({
    query: searchQuery,
    limit: 10,
  }, {
    enabled: activeTab === 'knowledge' && searchQuery.length > 2,
  });

  const seedMutation = trpc.activityMonitor.seedKnowledge.useMutation({
    onSuccess: () => { knowledgeStats.refetch(); },
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    window.location.href = getLoginUrl();
    return null;
  }

  const toggleRow = (id: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const formatTime = (ts: string | Date) => {
    const d = new Date(ts);
    return d.toLocaleString('ar-AE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  // Transform agentStats array into a map for easy access
  const agentStatsMap = (agentStats.data || []).reduce((acc: Record<string, any>, s: any) => {
    acc[s.agentName] = s;
    return acc;
  }, {} as Record<string, any>);

  const totalActions = (agentStats.data || []).reduce((sum: number, s: any) => sum + (s.totalActions || 0), 0);

  const tabs: { id: TabType; label: string; icon: typeof Activity }[] = [
    { id: 'activity', label: 'سجل النشاط', icon: Activity },
    { id: 'documents', label: 'فهرس المستندات', icon: FileText },
    { id: 'knowledge', label: 'قاعدة المعرفة', icon: Brain },
    { id: 'stats', label: 'إحصائيات', icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Activity className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 dark:text-white">مراقبة نشاط الوكلاء</h1>
                <p className="text-xs text-slate-500">Agent Activity Monitor</p>
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => { activityLog.refetch(); agentStats.refetch(); }}>
            <RefreshCw className="w-4 h-4 ml-1" />
            تحديث
          </Button>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 border-b border-transparent">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-slate-800 text-violet-600 dark:text-violet-400 border border-b-0 border-slate-200 dark:border-slate-700'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* ═══ Activity Tab ═══ */}
        {activeTab === 'activity' && (
          <>
            {/* Agent Stats Summary Cards */}
            {Object.keys(agentStatsMap).length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                {Object.entries(agentStatsMap).map(([agent, stats]: [string, any]) => {
                  const colors = AGENT_COLORS[agent] || AGENT_COLORS.salwa;
                  return (
                    <Card
                      key={agent}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        agentFilter === agent ? 'ring-2 ring-violet-500 shadow-md' : ''
                      } ${colors.border}`}
                      onClick={() => setAgentFilter(agentFilter === agent ? '' : agent)}
                    >
                      <CardContent className="p-3 text-center">
                        <Bot className={`w-5 h-5 mx-auto mb-1 ${colors.icon}`} />
                        <div className={`text-xs font-bold ${colors.text}`}>{AGENT_NAMES[agent] || agent}</div>
                        <div className="text-lg font-bold text-slate-900 dark:text-white">{stats.totalActions || 0}</div>
                        <div className="flex justify-center gap-1 mt-1">
                          <span className="text-[10px] text-green-600">✓{stats.successCount || 0}</span>
                          {(stats.failureCount || 0) > 0 && (
                            <span className="text-[10px] text-red-600">✗{stats.failureCount}</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Filter Bar */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-sm text-slate-500">
                <Filter className="w-4 h-4" />
                فلتر:
              </div>
              {agentFilter ? (
                <Badge variant="secondary" className="cursor-pointer" onClick={() => setAgentFilter('')}>
                  {AGENT_NAMES[agentFilter] || agentFilter} ✕
                </Badge>
              ) : (
                <span className="text-sm text-slate-400">الكل</span>
              )}
            </div>

            {/* Activity Log Table */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="w-5 h-5 text-violet-500" />
                  سجل العمليات المباشر
                  {activityLog.isRefetching && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                </CardTitle>
                <CardDescription>كل عملية يقوم بها أي وكيل تُسجل هنا تلقائياً مع التفاصيل الكاملة</CardDescription>
              </CardHeader>
              <CardContent>
                {activityLog.isLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-violet-500" /></div>
                ) : !activityLog.data?.activities?.length ? (
                  <div className="text-center py-12 text-slate-400">
                    <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>لا توجد عمليات مسجلة بعد</p>
                    <p className="text-xs mt-1">ستظهر العمليات هنا عندما يبدأ الوكلاء بالعمل</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activityLog.data.activities.map((entry: any) => {
                      const colors = AGENT_COLORS[entry.agentName] || AGENT_COLORS.salwa;
                      const isExpanded = expandedRows.has(entry.id);
                      return (
                        <div key={entry.id} className={`border rounded-lg transition-all ${colors.border} ${isExpanded ? 'shadow-sm' : 'hover:shadow-sm'}`}>
                          <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => toggleRow(entry.id)}>
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              entry.status === 'success' ? 'bg-green-500' : entry.status === 'failure' ? 'bg-red-500' : 'bg-yellow-500'
                            }`} />
                            <Bot className={`w-4 h-4 flex-shrink-0 ${colors.icon}`} />
                            <span className={`text-xs font-bold ${colors.text} w-12`}>{AGENT_NAMES[entry.agentName] || entry.agentName}</span>
                            <Badge variant="outline" className="text-[10px] font-mono">{entry.toolName || entry.actionType}</Badge>
                            {entry.durationMs != null && (
                              <span className="text-[10px] text-slate-400 font-mono">{formatDuration(entry.durationMs)}</span>
                            )}
                            <span className="flex-1" />
                            <span className="text-[10px] text-slate-400">{formatTime(entry.createdAt)}</span>
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                          </div>
                          {isExpanded && (
                            <div className="px-3 pb-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                              {entry.inputSummary && (
                                <div className="mt-2">
                                  <span className="text-[10px] font-bold text-slate-500">المدخلات:</span>
                                  <pre className="text-xs bg-slate-50 dark:bg-slate-800 p-2 rounded mt-1 overflow-x-auto max-h-32 text-slate-700 dark:text-slate-300" dir="ltr">{entry.inputSummary}</pre>
                                </div>
                              )}
                              {entry.outputSummary && (
                                <div>
                                  <span className="text-[10px] font-bold text-slate-500">المخرجات:</span>
                                  <pre className="text-xs bg-slate-50 dark:bg-slate-800 p-2 rounded mt-1 overflow-x-auto max-h-32 text-slate-700 dark:text-slate-300" dir="ltr">{entry.outputSummary}</pre>
                                </div>
                              )}
                              {entry.errorMessage && (
                                <div>
                                  <span className="text-[10px] font-bold text-red-500">خطأ:</span>
                                  <pre className="text-xs bg-red-50 dark:bg-red-950/30 p-2 rounded mt-1 text-red-700 dark:text-red-300" dir="ltr">{entry.errorMessage}</pre>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* ═══ Documents Tab ═══ */}
        {activeTab === 'documents' && (
          <>
            {indexStats.data && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <FileText className="w-6 h-6 mx-auto mb-2 text-blue-500" />
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">{indexStats.data.totalDocs || 0}</div>
                    <div className="text-xs text-slate-500">مستندات مفهرسة</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <Database className="w-6 h-6 mx-auto mb-2 text-green-500" />
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">
                      {indexStats.data.totalTextLength ? `${(Number(indexStats.data.totalTextLength) / 1000).toFixed(0)}K` : '0'}
                    </div>
                    <div className="text-xs text-slate-500">حرف مستخرج</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <Eye className="w-6 h-6 mx-auto mb-2 text-violet-500" />
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">{indexStats.data.byType?.length || 0}</div>
                    <div className="text-xs text-slate-500">أنواع ملفات</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <Wrench className="w-6 h-6 mx-auto mb-2 text-orange-500" />
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">{indexStats.data.byAgent?.length || 0}</div>
                    <div className="text-xs text-slate-500">وكلاء مفهرسين</div>
                  </CardContent>
                </Card>
              </div>
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Search className="w-5 h-5 text-blue-500" />
                  بحث في المستندات المفهرسة
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4">
                  <Input placeholder="ابحث في محتوى المستندات..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="flex-1" />
                </div>
                {docSearch.isLoading && <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>}
                {docSearch.data && docSearch.data.length > 0 && (
                  <div className="space-y-2">
                    {docSearch.data.map((doc: any) => (
                      <div key={doc.id} className="border rounded-lg p-3 hover:shadow-sm transition-all">
                        <div className="flex items-center gap-2 mb-1">
                          <FileText className="w-4 h-4 text-blue-500" />
                          <span className="font-medium text-sm text-slate-900 dark:text-white">{doc.sourceName}</span>
                          <Badge variant="outline" className="text-[10px]">{doc.fileType}</Badge>
                          {doc.category && <Badge variant="secondary" className="text-[10px]">{doc.category}</Badge>}
                        </div>
                        {doc.summary && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{doc.summary}</p>}
                        {doc.relevanceSnippet && (
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 bg-yellow-50 dark:bg-yellow-950/20 p-2 rounded">...{doc.relevanceSnippet}...</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {docSearch.data && docSearch.data.length === 0 && searchQuery.length > 2 && (
                  <div className="text-center py-8 text-slate-400">
                    <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">لم يتم العثور على نتائج</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* ═══ Knowledge Tab ═══ */}
        {activeTab === 'knowledge' && (
          <>
            {knowledgeStats.data && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <Brain className="w-6 h-6 mx-auto mb-2 text-violet-500" />
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">{knowledgeStats.data.totalEntries || 0}</div>
                    <div className="text-xs text-slate-500">مدخلة معرفية</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <BookOpen className="w-6 h-6 mx-auto mb-2 text-emerald-500" />
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">{knowledgeStats.data.byDomain?.length || 0}</div>
                    <div className="text-xs text-slate-500">مجالات</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-xs font-bold text-slate-500 mb-2">التوزيع حسب المجال:</div>
                    <div className="space-y-1">
                      {knowledgeStats.data.byDomain?.map((d: any) => (
                        <div key={d.domain} className="flex items-center justify-between text-xs">
                          <span className="text-slate-600 dark:text-slate-400">{d.domain}</span>
                          <Badge variant="secondary" className="text-[10px]">{d.count}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Search className="w-5 h-5 text-violet-500" />
                    بحث في قاعدة المعرفة
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
                    {seedMutation.isPending ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : <Database className="w-4 h-4 ml-1" />}
                    إعادة تغذية المعرفة
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4">
                  <Input placeholder="ابحث في المعرفة المتخصصة..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="flex-1" />
                </div>
                {knowledgeSearch.isLoading && <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-violet-500" /></div>}
                {knowledgeSearch.data && knowledgeSearch.data.length > 0 && (
                  <div className="space-y-3">
                    {knowledgeSearch.data.map((item: any) => (
                      <div key={item.id} className="border rounded-lg p-4 hover:shadow-sm transition-all">
                        <div className="flex items-center gap-2 mb-2">
                          <Brain className="w-4 h-4 text-violet-500" />
                          <span className="font-medium text-sm text-slate-900 dark:text-white">{item.title}</span>
                          <Badge variant="outline" className="text-[10px]">{item.domain}</Badge>
                          <Badge variant="secondary" className="text-[10px]">{item.category}</Badge>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap line-clamp-4">{item.content}</p>
                        {item.source && <div className="text-[10px] text-slate-400 mt-2">المصدر: {item.source}</div>}
                      </div>
                    ))}
                  </div>
                )}
                {knowledgeSearch.data && knowledgeSearch.data.length === 0 && searchQuery.length > 2 && (
                  <div className="text-center py-8 text-slate-400">
                    <Brain className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">لم يتم العثور على معرفة مطابقة</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* ═══ Stats Tab ═══ */}
        {activeTab === 'stats' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Agent Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-violet-500" />
                  أداء الوكلاء
                </CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(agentStatsMap).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(agentStatsMap).map(([agent, stats]: [string, any]) => {
                      const colors = AGENT_COLORS[agent] || AGENT_COLORS.salwa;
                      const total = stats.totalActions || 1;
                      const successRate = ((stats.successCount || 0) / total * 100).toFixed(0);
                      return (
                        <div key={agent} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <Bot className={`w-4 h-4 ${colors.icon}`} />
                              <span className={`font-medium ${colors.text}`}>{AGENT_NAMES[agent] || agent}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <span>{stats.totalActions} عملية</span>
                              <span className="text-green-600">{successRate}% نجاح</span>
                            </div>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                            <div className="bg-gradient-to-l from-green-500 to-emerald-400 h-2 rounded-full transition-all" style={{ width: `${successRate}%` }} />
                          </div>
                          {stats.avgDurationMs != null && (
                            <div className="text-[10px] text-slate-400">متوسط المدة: {formatDuration(stats.avgDurationMs)}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">لا توجد بيانات بعد</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* System Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Database className="w-5 h-5 text-blue-500" />
                  نظرة عامة على النظام
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="border rounded-lg p-3 text-center">
                    <Activity className="w-5 h-5 mx-auto mb-1 text-violet-500" />
                    <div className="text-xl font-bold text-slate-900 dark:text-white">{totalActions}</div>
                    <div className="text-[10px] text-slate-500">إجمالي العمليات</div>
                  </div>
                  <div className="border rounded-lg p-3 text-center">
                    <FileText className="w-5 h-5 mx-auto mb-1 text-blue-500" />
                    <div className="text-xl font-bold text-slate-900 dark:text-white">{indexStats.data?.totalDocs || 0}</div>
                    <div className="text-[10px] text-slate-500">مستندات مفهرسة</div>
                  </div>
                  <div className="border rounded-lg p-3 text-center">
                    <Brain className="w-5 h-5 mx-auto mb-1 text-emerald-500" />
                    <div className="text-xl font-bold text-slate-900 dark:text-white">{knowledgeStats.data?.totalEntries || 0}</div>
                    <div className="text-[10px] text-slate-500">مدخلات المعرفة</div>
                  </div>
                  <div className="border rounded-lg p-3 text-center">
                    <Bot className="w-5 h-5 mx-auto mb-1 text-amber-500" />
                    <div className="text-xl font-bold text-slate-900 dark:text-white">{Object.keys(agentStatsMap).length}</div>
                    <div className="text-[10px] text-slate-500">وكلاء نشطين</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
