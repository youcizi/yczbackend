import React, { useState, useEffect, useRef } from 'react';
import { Bot, X, MessageSquare, Settings } from 'lucide-react';
import { ChatWindow } from './ChatWindow';

/**
 * AiFloatingBot
 * 右下角悬浮按钮，支持波纹动效、拖拽及自动边缘吸附。
 */
export const AiFloatingBot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 }); // 初始化为 0,0 以避免 SSR 报错
  const [isDragging, setIsDragging] = useState(false);
  const botRef = useRef<HTMLDivElement>(null);

  // 1. 实现吸附逻辑与初始化
  useEffect(() => {
    // 挂载后通过 window 确定初始位置
    setPosition({ x: window.innerWidth - 80, y: window.innerHeight - 80 });

    const handleResize = () => {
      // 窗口缩放时确保按钮不超出边界
      setPosition(prev => ({
        x: Math.min(prev.x, window.innerWidth - 60),
        y: Math.min(prev.y, window.innerHeight - 60)
      }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setPosition({ x: e.clientX - 30, y: e.clientY - 30 });
    };

    const handleMouseUp = () => {
      if (!isDragging) return;
      setIsDragging(false);

      // 边缘吸附逻辑: 靠近哪边吸哪边
      const threshold = window.innerWidth / 2;
      const targetX = position.x > threshold ? window.innerWidth - 80 : 20;
      
      // 平滑移动优化可以使用 CSS transition
      setPosition(prev => ({ ...prev, x: targetX }));
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, position.x]);

  return (
    <>
      <div 
        ref={botRef}
        style={{
          position: 'fixed',
          left: `${position.x}px`,
          top: `${position.y}px`,
          zIndex: 9999,
          transition: isDragging ? 'none' : 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.25)'
        }}
        className="group animate-in slide-in-from-right duration-500 fill-mode-both"
      >
        <button
          onMouseDown={handleMouseDown}
          onClick={() => !isDragging && setIsOpen(!isOpen)}
          className={`
            relative w-14 h-14 rounded-full flex items-center justify-center shadow-xl 
            bg-gradient-to-br from-blue-500 to-indigo-600 text-white
            hover:shadow-blue-500/40 transform active:scale-90 transition-all
            ${isOpen ? 'rotate-90' : 'rotate-0'}
          `}
        >
          {isOpen ? <X size={26} /> : <Bot size={26} />}
        </button>
      </div>

      {/* 聊天窗口组件 */}
      <ChatWindow isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
};
