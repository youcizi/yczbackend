import React, { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { 
  Bold, 
  Italic, 
  Heading1, 
  Heading2, 
  Heading3, 
  List, 
  ListOrdered, 
  Quote, 
  Link as LinkIcon, 
  Image as ImageIcon,
  RemoveFormatting,
  Undo,
  Redo,
  Eye,
  Code
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '../ui/Dialog';
import { MediaPicker } from './MediaPicker';
import { cn } from '../../lib/utils';

interface TiptapEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/**
 * 链接编辑弹窗 (基于自定义 Dialog)
 */
const LinkDialog = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  initialUrl 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onConfirm: (url: string) => void;
  initialUrl: string;
}) => {
  const [url, setUrl] = useState(initialUrl);

  useEffect(() => {
    if (isOpen) setUrl(initialUrl);
  }, [isOpen, initialUrl]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>插入/编辑超链接</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="url">URL 地址</Label>
            <Input
              id="url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') onConfirm(url);
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button onClick={() => onConfirm(url)}>确认</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/**
 * 核心自定义工具栏
 */
const MenuBar = ({ 
  editor, 
  onLinkClick,
  onImageClick,
  activeTab,
  onTabChange 
}: { 
  editor: any; 
  onLinkClick: () => void;
  onImageClick: () => void;
  activeTab: 'visual' | 'source';
  onTabChange: (tab: 'visual' | 'source') => void;
}) => {
  if (!editor || !editor.isActive) return null;

  return (
    <div className="flex flex-col border-b border-slate-200">
      {/* 顶部 Tab 切换 (与 JSON 编辑器对齐) */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border-b border-slate-100">
        <div className="flex bg-slate-200/50 p-0.5 rounded-lg">
          <button
            type="button"
            onClick={() => onTabChange('visual')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-bold transition-all",
              activeTab === 'visual' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Eye size={12} /> 可视化编辑
          </button>
          <button
            type="button"
            onClick={() => onTabChange('source')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-bold transition-all",
              activeTab === 'source' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Code size={12} /> 源码模式
          </button>
        </div>
      </div>

      {/* 格式工具栏 (仅可视化模式显示) */}
      {activeTab === 'visual' && (
        <div className="flex flex-wrap items-center gap-1 p-2 bg-white">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={cn("h-8 w-8", editor.isActive('bold') && "bg-slate-200 text-blue-600")}
            title="加粗"
          >
            <Bold size={16} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={cn("h-8 w-8", editor.isActive('italic') && "bg-slate-200 text-blue-600")}
            title="斜体"
          >
            <Italic size={16} />
          </Button>
          
          <div className="w-px h-4 bg-slate-200 mx-1" />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={cn("h-8 w-8", editor.isActive('heading', { level: 1 }) && "bg-slate-200 text-blue-600")}
            title="标题 1"
          >
            <Heading1 size={16} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={cn("h-8 w-8", editor.isActive('heading', { level: 2 }) && "bg-slate-200 text-blue-600")}
            title="标题 2"
          >
            <Heading2 size={16} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={cn("h-8 w-8", editor.isActive('heading', { level: 3 }) && "bg-slate-200 text-blue-600")}
            title="标题 3"
          >
            <Heading3 size={16} />
          </Button>

          <div className="w-px h-4 bg-slate-200 mx-1" />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={cn("h-8 w-8", editor.isActive('bulletList') && "bg-slate-200 text-blue-600")}
            title="无序列表"
          >
            <List size={16} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={cn("h-8 w-8", editor.isActive('orderedList') && "bg-slate-200 text-blue-600")}
            title="有序列表"
          >
            <ListOrdered size={16} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={cn("h-8 w-8", editor.isActive('blockquote') && "bg-slate-200 text-blue-600")}
            title="引用"
          >
            <Quote size={16} />
          </Button>

          <div className="w-px h-4 bg-slate-200 mx-1" />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onLinkClick}
            className={cn("h-8 w-8", editor.isActive('link') && "bg-slate-200 text-blue-600")}
            title="超链接"
          >
            <LinkIcon size={16} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onImageClick}
            className="h-8 w-8"
            title="插入图片"
          >
            <ImageIcon size={16} />
          </Button>

          <div className="w-px h-4 bg-slate-200 mx-1" />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
            className="h-8 w-8"
            title="清除格式"
          >
            <RemoveFormatting size={16} />
          </Button>

          <div className="flex-1" />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className="h-8 w-8"
          >
            <Undo size={16} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className="h-8 w-8"
          >
            <Redo size={16} />
          </Button>
        </div>
      )}
    </div>
  );
};

/**
 * 工业级 TipTap 富文本编辑器 (v4.0 Enhance)
 * 功能特性：
 * 1. 双模式切换：可视化编辑与源码模式同步
 * 2. 专业 LinkDialog：移除系统弹窗，接入 UI 组件库
 * 3. 样式对齐：基于 Tailwind Typography 渲染
 */
export const TiptapEditor: React.FC<TiptapEditorProps> = ({ value, onChange, placeholder }) => {
  const [activeTab, setActiveTab] = useState<'visual' | 'source'>('visual');
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  const [isImageOpen, setIsImageOpen] = useState(false);
  const [htmlValue, setHtmlValue] = useState(value);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // 核心：明确禁用 StarterKit 内置的冲突扩展
        history: true,
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline cursor-pointer',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'rounded-lg border border-slate-200 shadow-sm max-w-full h-auto',
        },
      }),
      Placeholder.configure({
        placeholder: placeholder || '开始撰写您的内容...',
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      setHtmlValue(html);
      onChange(html);
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[250px] p-4',
      },
    },
  });

  // 处理外部 value 变化
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
      setHtmlValue(value);
    }
  }, [value, editor]);

  // 链接确认逻辑
  const handleLinkConfirm = (url: string) => {
    if (!editor) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
    setIsLinkOpen(false);
  };

  return (
    <div className="flex flex-col w-full border border-slate-200 rounded-lg overflow-hidden bg-white focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all shadow-sm">
      <MenuBar 
        editor={editor} 
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onLinkClick={() => setIsLinkOpen(true)}
        onImageClick={() => setIsImageOpen(true)}
      />
      
      <div className="overflow-y-auto min-h-[250px] max-h-[600px] flex flex-col">
        {activeTab === 'visual' ? (
          <EditorContent editor={editor} />
        ) : (
          <div className="p-4 flex-1 flex flex-col bg-slate-900 min-h-[250px]">
            <textarea
              className="w-full h-full flex-1 bg-transparent text-blue-300 font-mono text-xs outline-none resize-none leading-relaxed"
              value={htmlValue}
              onChange={(e) => {
                const newHtml = e.target.value;
                setHtmlValue(newHtml);
                onChange(newHtml);
                // 源码模式修改时，静默通过 editor.commands.setContent 同步，不触发 onUpdate 循环
                editor?.commands.setContent(newHtml, false);
              }}
              spellCheck={false}
              placeholder="请输入 HTML 内容..."
            />
          </div>
        )}
      </div>

      <LinkDialog
        isOpen={isLinkOpen}
        onClose={() => setIsLinkOpen(false)}
        onConfirm={handleLinkConfirm}
        initialUrl={editor?.getAttributes('link').href || ''}
      />

      <MediaPicker
        isOpen={isImageOpen}
        onClose={() => setIsImageOpen(false)}
        title="选择文档图片"
        allowedTypes={['image/*']}
        onSelect={(item) => {
          editor?.chain().focus().setImage({ src: item.url }).run();
          setIsImageOpen(false);
        }}
      />
    </div>
  );
};
