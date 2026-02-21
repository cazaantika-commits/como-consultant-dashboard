import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Search, MessageSquare, Calendar, User, Trash2, ExternalLink } from "lucide-react";
import { Link } from "wouter";

type AgentType = "salwa" | "farouq" | "khazen" | "buraq" | "khaled" | "alina" | "baz" | "joelle";

const AGENT_NAMES: Record<AgentType, string> = {
  salwa: "سلوى",
  farouq: "فاروق",
  khazen: "خازن",
  buraq: "براق",
  khaled: "خالد",
  alina: "ألينا",
  baz: "باز",
  joelle: "جويل",
};

const AGENT_COLORS: Record<AgentType, string> = {
  salwa: "from-amber-500 to-yellow-600",
  farouq: "from-purple-500 to-violet-600",
  khazen: "from-blue-500 to-cyan-600",
  buraq: "from-orange-500 to-red-500",
  khaled: "from-emerald-500 to-green-600",
  alina: "from-yellow-500 to-amber-600",
  baz: "from-pink-500 to-rose-600",
  joelle: "from-cyan-500 to-blue-600",
};

export default function ConversationHistoryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<AgentType | "all">("all");
  const [expandedConv, setExpandedConv] = useState<number | null>(null);

  // Fetch all conversations grouped by agent
  const { data: conversations, isLoading } = trpc.agents.getAllConversations.useQuery();
  const clearHistoryMutation = trpc.agents.clearChatHistory.useMutation();
  const utils = trpc.useUtils();

  const handleClearHistory = async (agent: AgentType) => {
    if (!confirm(`هل أنت متأكد من حذف جميع محادثات ${AGENT_NAMES[agent]}؟`)) return;
    await clearHistoryMutation.mutateAsync({ agent });
    utils.agents.getAllConversations.invalidate();
  };

  // Filter conversations
  const filteredConversations = conversations?.filter(conv => {
    const matchesAgent = selectedAgent === "all" || conv.agent === selectedAgent;
    const matchesSearch = !searchQuery || 
      conv.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.userMessage?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesAgent && matchesSearch;
  }) || [];

  // Group by conversation session (consecutive messages)
  const groupedConversations: Array<{
    agent: AgentType;
    messages: typeof filteredConversations;
    startTime: Date;
    endTime: Date;
  }> = [];

  let currentGroup: typeof filteredConversations = [];
  let currentAgent: AgentType | null = null;

  for (const conv of filteredConversations) {
    if (conv.agent !== currentAgent || 
        (currentGroup.length > 0 && 
         new Date(conv.createdAt).getTime() - new Date(currentGroup[currentGroup.length - 1].createdAt).getTime() > 3600000)) {
      if (currentGroup.length > 0) {
        groupedConversations.push({
          agent: currentAgent!,
          messages: currentGroup,
          startTime: new Date(currentGroup[0].createdAt),
          endTime: new Date(currentGroup[currentGroup.length - 1].createdAt),
        });
      }
      currentGroup = [conv];
      currentAgent = conv.agent as AgentType;
    } else {
      currentGroup.push(conv);
    }
  }

  if (currentGroup.length > 0 && currentAgent) {
    groupedConversations.push({
      agent: currentAgent,
      messages: currentGroup,
      startTime: new Date(currentGroup[0].createdAt),
      endTime: new Date(currentGroup[currentGroup.length - 1].createdAt),
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-6">
      <div className="container max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                سجل المحادثات
              </h1>
              <p className="text-muted-foreground mt-2">
                جميع محادثاتك مع الوكلاء الفنيين
              </p>
            </div>
            <Link href="/">
              <Button variant="outline">
                <ExternalLink className="h-4 w-4 ml-2" />
                الرئيسية
              </Button>
            </Link>
          </div>

          {/* Search and Filters */}
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[300px]">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ابحث في المحادثات..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-10"
                />
              </div>
            </div>
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value as AgentType | "all")}
              className="px-4 py-2 border rounded-lg bg-background"
            >
              <option value="all">جميع الوكلاء</option>
              {Object.entries(AGENT_NAMES).map(([key, name]) => (
                <option key={key} value={key}>{name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{groupedConversations.length}</p>
                <p className="text-sm text-muted-foreground">محادثة</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <User className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">
                  {new Set(filteredConversations.map(c => c.agent)).size}
                </p>
                <p className="text-sm text-muted-foreground">وكيل نشط</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{filteredConversations.length}</p>
                <p className="text-sm text-muted-foreground">رسالة</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Conversations List */}
        {isLoading ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">جاري التحميل...</p>
          </Card>
        ) : groupedConversations.length === 0 ? (
          <Card className="p-8 text-center">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">لا توجد محادثات</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {groupedConversations.map((group, idx) => (
              <Card key={idx} className="overflow-hidden">
                <div 
                  className={`bg-gradient-to-r ${AGENT_COLORS[group.agent]} text-white p-4 flex items-center justify-between cursor-pointer`}
                  onClick={() => setExpandedConv(expandedConv === idx ? null : idx)}
                >
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-5 w-5" />
                    <div>
                      <h3 className="font-semibold">{AGENT_NAMES[group.agent]}</h3>
                      <p className="text-sm opacity-90">
                        {group.messages.length} رسالة • {group.startTime.toLocaleDateString("ar")}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-white/20"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClearHistory(group.agent);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {expandedConv === idx && (
                  <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto" dir="rtl">
                    {group.messages.map((msg, msgIdx) => (
                      <div key={msgIdx} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                        <div className={`flex-1 p-3 rounded-lg ${
                          msg.role === "user" 
                            ? "bg-primary text-primary-foreground ml-12" 
                            : "bg-muted mr-12"
                        }`}>
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          <p className="text-xs opacity-70 mt-2">
                            {new Date(msg.createdAt).toLocaleString("ar")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
