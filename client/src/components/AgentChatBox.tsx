import { useState, useRef, useEffect } from "react";
import { X, Send, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card } from "./ui/card";
import { trpc } from "@/lib/trpc";
import { Streamdown } from "streamdown";

export type AgentType = "salwa" | "farouq" | "khazen" | "buraq" | "khaled" | "alina" | "baz" | "joelle";

interface AgentChatBoxProps {
  agent: AgentType;
  agentData?: {
    name: string;
    role: string;
    avatarUrl?: string | null;
    color?: string | null;
    description?: string | null;
  };
  onClose: () => void;
}

interface Message {
  role: "user" | "agent";
  content: string;
  timestamp: Date;
}

const agentDefaults: Record<AgentType, { name: string; title: string; description: string; gradient: string; avatar: string }> = {
  salwa: {
    name: "سلوى",
    title: "المنسقة والمساعدة التنفيذية",
    description: "فحص الإيميل وإدارة المراسلات والتنسيق",
    gradient: "from-amber-500 to-yellow-600",
    avatar: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663200809965/sFWezOzuQFJxzpKl.png"
  },
  farouq: {
    name: "فاروق",
    title: "المحلل القانوني والمالي",
    description: "تحليل العروض والعقود والمستندات القانونية",
    gradient: "from-purple-500 to-violet-600",
    avatar: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663200809965/UphyyKbtnxhtJDDy.png"
  },
  khazen: {
    name: "خازن",
    title: "مدير الأرشفة والتخزين",
    description: "أرشفة المستندات وتنظيم الملفات",
    gradient: "from-blue-500 to-cyan-600",
    avatar: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663200809965/pTwUciwtTCWHPghO.png"
  },
  buraq: {
    name: "براق",
    title: "مراقب التنفيذ والجدول الزمني",
    description: "متابعة تنفيذ المشاريع والمواعيد",
    gradient: "from-orange-500 to-red-500",
    avatar: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663200809965/fsUKhyALKYaTfnMj.png"
  },
  khaled: {
    name: "خالد",
    title: "مدقق الجودة والامتثال الفني",
    description: "فحص الجودة والمعايير الفنية",
    gradient: "from-emerald-500 to-green-600",
    avatar: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663200809965/gFGfLWvLCJrhamTj.png"
  },
  alina: {
    name: "ألينا",
    title: "المديرة المالية ومراقبة التكاليف",
    description: "مراقبة الميزانيات والتحليل المالي",
    gradient: "from-yellow-500 to-amber-600",
    avatar: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663200809965/qJSwoNSavgDflAVc.png"
  },
  baz: {
    name: "باز",
    title: "المستشار الاستراتيجي",
    description: "استراتيجيات الابتكار والتحسين",
    gradient: "from-pink-500 to-rose-600",
    avatar: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663200809965/GorWfdugNGIAdkOm.png"
  },
  joelle: {
    name: "جويل",
    title: "محللة دراسات الجدوى والسوق",
    description: "تحليل السوق ودراسات الجدوى",
    gradient: "from-cyan-500 to-blue-600",
    avatar: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663200809965/mCOkEovAXTtxsABs.png"
  }
};

export function AgentChatBox({ agent, agentData, onClose }: AgentChatBoxProps) {
  const defaults = agentDefaults[agent];
  const agentName = agentData?.name || defaults.name;
  const agentTitle = agentData?.role || defaults.title;
  const agentAvatar = agentData?.avatarUrl || defaults.avatar;
  const agentDesc = defaults.description;

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "agent",
      content: `مرحباً! أنا ${agentName}، ${agentTitle}. كيف يمكنني مساعدتك؟`,
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chatMutation = trpc.agents.chat.useMutation();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: "user",
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Build conversation history for GPT-4 context
      const conversationHistory = messages
        .filter(m => m.content !== `مرحباً! أنا ${agentName}، ${agentTitle}. كيف يمكنني مساعدتك؟`)
        .map(m => ({
          role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
          content: m.content
        }));

      const response = await chatMutation.mutateAsync({
        agent,
        message: userMessage.content,
        conversationHistory
      });

      const agentMessage: Message = {
        role: "agent",
        content: response.response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, agentMessage]);
    } catch (error) {
      const errorMessage: Message = {
        role: "agent",
        content: "⚠️ عذراً، حدث خطأ. حاول مرة أخرى.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Card className="fixed bottom-4 left-4 w-[420px] h-[650px] shadow-2xl flex flex-col z-50 overflow-hidden border-0 rounded-2xl">
      {/* Header with avatar */}
      <div className={`bg-gradient-to-r ${defaults.gradient} text-white p-4 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src={agentAvatar}
              alt={agentName}
              className="w-12 h-12 rounded-full object-cover border-2 border-white/40 shadow-lg"
            />
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-white" />
          </div>
          <div>
            <h3 className="font-bold text-lg leading-tight">{agentName}</h3>
            <p className="text-sm opacity-90 leading-tight">{agentTitle}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-white hover:bg-white/20 rounded-full"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/20" dir="rtl">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
          >
            {msg.role === "agent" && (
              <img
                src={agentAvatar}
                alt={agentName}
                className="w-8 h-8 rounded-full object-cover shrink-0 mt-1"
              />
            )}
            <div
              className={`max-w-[78%] rounded-2xl p-3 ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-tl-sm"
                  : "bg-card border shadow-sm rounded-tr-sm"
              }`}
            >
              {msg.role === "agent" ? (
                <div className="text-sm">
                  <Streamdown>{msg.content}</Streamdown>
                </div>
              ) : (
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              )}
              <p className="text-[10px] opacity-50 mt-1">
                {msg.timestamp.toLocaleTimeString("ar-AE", {
                  hour: "2-digit",
                  minute: "2-digit"
                })}
              </p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-2">
            <img
              src={agentAvatar}
              alt={agentName}
              className="w-8 h-8 rounded-full object-cover shrink-0"
            />
            <div className="bg-card border rounded-2xl rounded-tr-sm p-3 flex items-center gap-2 shadow-sm">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">{agentName} يكتب...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t bg-background">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={`تحدث مع ${agentName}...`}
            disabled={isLoading}
            className="flex-1 rounded-full bg-muted/50 border-0 focus-visible:ring-1"
            dir="rtl"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="rounded-full shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
          {agentDesc}
        </p>
      </div>
    </Card>
  );
}
