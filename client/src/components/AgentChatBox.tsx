import { useState, useRef, useEffect } from "react";
import { X, Send, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card } from "./ui/card";
import { trpc } from "@/lib/trpc";
import { Streamdown } from "streamdown";

export type AgentType = "salwa" | "farouq" | "khazen";

interface AgentChatBoxProps {
  agent: AgentType;
  onClose: () => void;
}

interface Message {
  role: "user" | "agent";
  content: string;
  timestamp: Date;
}

const agentInfo = {
  salwa: {
    name: "سلوى",
    title: "المساعدة التنفيذية",
    description: "فحص الإيميل وإدارة المراسلات",
    color: "from-blue-500 to-cyan-500",
    icon: "📧"
  },
  farouq: {
    name: "فاروق",
    title: "المحلل القانوني والمالي",
    description: "تحليل العروض والمستندات",
    color: "from-purple-500 to-pink-500",
    icon: "📊"
  },
  khazen: {
    name: "خازن",
    title: "مدير الأرشفة",
    description: "أرشفة المستندات في Google Drive",
    color: "from-green-500 to-emerald-500",
    icon: "📁"
  }
};

export function AgentChatBox({ agent, onClose }: AgentChatBoxProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "agent",
      content: `مرحباً! أنا ${agentInfo[agent].name}، ${agentInfo[agent].title}. كيف يمكنني مساعدتك؟`,
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
      const response = await chatMutation.mutateAsync({
        agent,
        message: userMessage.content
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

  const info = agentInfo[agent];

  return (
    <Card className="fixed bottom-4 left-4 w-96 h-[600px] shadow-2xl flex flex-col z-50 overflow-hidden">
      {/* Header */}
      <div className={`bg-gradient-to-r ${info.color} text-white p-4 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <div className="text-3xl">{info.icon}</div>
          <div>
            <h3 className="font-bold text-lg">{info.name}</h3>
            <p className="text-sm opacity-90">{info.title}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-white hover:bg-white/20"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/20">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border"
              }`}
            >
              {msg.role === "agent" ? (
                <Streamdown>{msg.content}</Streamdown>
              ) : (
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              )}
              <p className="text-xs opacity-60 mt-1">
                {msg.timestamp.toLocaleTimeString("ar-AE", {
                  hour: "2-digit",
                  minute: "2-digit"
                })}
              </p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-card border rounded-lg p-3 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">يكتب...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t bg-background">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={`اكتب رسالتك لـ ${info.name}...`}
            disabled={isLoading}
            className="flex-1"
            dir="rtl"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            size="icon"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          {info.description}
        </p>
      </div>
    </Card>
  );
}
