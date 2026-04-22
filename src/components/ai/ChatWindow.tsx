import React, { useState, useEffect, useRef } from 'react';
import { Send, Trash2, Settings, User, Bot, Loader2 } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatWindowProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 1. 加载本地历史记录 (Session Persistence)
  useEffect(() => {
    const saved = localStorage.getItem('ai_chat_history');
    if (saved) setMessages(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('ai_chat_history', JSON.stringify(messages));
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // 2. 处理流式发送
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    let assistantContent = '';
    const assistantMsg: Message = { role: 'assistant', content: '' };
    setMessages(prev => [...prev, assistantMsg]);

    try {
      const response = await fetch('/api/v1/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'backend', // 使用后端管理指定的提供商与模型
          messages: [...messages, userMsg]
        })
      });

      if (!response.ok) throw new Error('AI 服务异常');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) return;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              const content = data.choices?.[0]?.delta?.content || '';
              assistantContent += content;
              
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1].content = assistantContent;
                return updated;
              });
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1].content = '抱歉，服务暂时不可用...';
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed right-6 bottom-24 w-[380px] h-[550px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col z-[9998] overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
      {/* Header */}
      <div className="p-4 border-b dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
            <Bot size={20} />
          </div>
          <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">AI 智能助手</span>
        </div>
        <div className="flex items-center gap-1">
          <a href="/admin/settings/ai" className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors">
            <Settings size={18} />
          </a>
          <button onClick={() => setMessages([])} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-slate-500 hover:text-red-500 transition-colors">
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth bg-white/50 dark:bg-slate-900/50">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
            <Bot size={40} className="opacity-20" />
            <p className="text-sm">今天有什么我可以帮您的吗？</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
            <div className={`
              max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed
              ${msg.role === 'user' 
                ? 'bg-blue-600 text-white rounded-tr-none' 
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-tl-none border border-slate-200 dark:border-slate-700/50'}
            `}>
              {msg.content}
              {msg.role === 'assistant' && msg.content === '' && (
                <Loader2 size={16} className="animate-spin opacity-50" />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="p-4 border-t dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="relative flex items-center">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="输入消息..."
            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl py-3 pl-4 pr-12 text-sm focus:ring-2 focus:ring-blue-500/50 transition-all dark:text-white"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="absolute right-2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-500/30"
          >
            <Send size={16} />
          </button>
        </div>
        <p className="mt-2 text-[10px] text-center text-slate-400">由 Cloudflare AI Gateway 提供技术支持</p>
      </div>
    </div>
  );
};
