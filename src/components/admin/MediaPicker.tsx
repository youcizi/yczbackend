import React, { useState, useEffect } from 'react';
import { 
  Image as ImageIcon, 
  File as FileIcon, 
  Upload, 
  Search, 
  Check, 
  Loader2, 
  X,
  Plus,
  FileText,
  FileArchive,
  Music,
  Video,
  Globe,
  Library,
  Trash2
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { cn } from '../../lib/utils';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '../ui/Dialog';

interface MediaItem {
  id: number | string;
  url: string;
  filename: string;
  mimeType?: string;
  size?: number;
  createdAt?: string;
  isRemote?: boolean;
}

interface MediaPickerProps {
  onSelect?: (item: MediaItem) => void;
  allowedTypes?: string[]; 
  title?: string;
  isOpen?: boolean;
  onClose?: () => void;
  mode?: 'picker' | 'manager';
}

type TabMode = 'library' | 'upload' | 'remote';

/**
 * 媒体管理中心 - 增强版 (MediaPicker v2.0)
 * 功能特性：
 * 1. 防崩溃：全量可选链与空值防御
 * 2. 三页签：附件列表、本地上传、远程地址
 * 3. 实时预览：支持外链图片即时验证
 */
export const MediaPicker: React.FC<MediaPickerProps> = ({ 
  onSelect, 
  allowedTypes = [], 
  title = "媒体库",
  isOpen,
  onClose,
  mode = 'picker'
}) => {
  const [activeTab, setActiveTab] = useState<TabMode>('library');
  const [items, setItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | string | null>(null);
  
  // 远程 URL 状态
  const [remoteUrl, setRemoteUrl] = useState("");

  // 删除确认状态
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | string | null>(null);

  // 加载数据
  const fetchMedia = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/media');
      const result = await res.json();
      setItems(result.data || []);
    } catch (err) {
      console.error('Failed to fetch media:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (mode === 'manager' || (mode === 'picker' && isOpen)) {
      fetchMedia();
    }
  }, [mode, isOpen]);

  // 处理物理上传
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/v1/media/upload', {
        method: 'POST',
        body: formData
      });
      const newItem = await res.json();
      if (newItem.id) {
        setItems(prev => [newItem, ...prev]);
        if (mode === 'picker') {
          setSelectedId(newItem.id);
          setActiveTab('library'); 
        } else {
          setActiveTab('library');
        }
      }
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const currentSelectedItem = items.find(i => i.id === selectedId);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'library':
        return (
          <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
             <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="搜索文件名..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="h-[350px] overflow-y-auto border rounded-xl p-4 bg-slate-50/50">
              {isLoading ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <p className="text-sm">拉取文件中...</p>
                </div>
              ) : items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                  <Library className="h-12 w-12 opacity-20" />
                  <p className="text-sm">暂无媒体文件</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                  {items.filter(i => (i.filename || '').toLowerCase().includes(search.toLowerCase())).map(item => (
                    <div 
                      key={item.id}
                      className={cn(
                        "relative aspect-square border-2 rounded-lg overflow-hidden cursor-pointer transition-all hover:ring-2 hover:ring-blue-500/20 group",
                        selectedId === item.id && mode === 'picker' ? "border-blue-500 ring-2 ring-blue-500/20 shadow-md" : "border-transparent bg-white shadow-sm"
                      )}
                      onClick={() => setSelectedId(item.id)}
                    >
                      {item?.mimeType?.startsWith('image/') ? (
                         <img 
                          src={item.url} 
                          alt={item.filename} 
                          className="w-full h-full object-cover"
                         />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-slate-50">
                          {(() => {
                            const mt = item?.mimeType || '';
                            if (mt.includes('pdf')) return <FileText className="h-8 w-8 text-red-400" />;
                            if (mt.includes('zip') || mt.includes('rar')) return <FileArchive className="h-8 w-8 text-orange-400" />;
                            if (mt.includes('video')) return <Video className="h-8 w-8 text-purple-400" />;
                            if (mt.includes('audio')) return <Music className="h-8 w-8 text-pink-400" />;
                            return <FileIcon className="h-8 w-8 text-slate-300" />;
                          })()}
                          <span className="text-[10px] text-slate-400 text-center px-1 truncate w-full">{item.filename}</span>
                        </div>
                      )}
                      {selectedId === item.id && mode === 'picker' && (
                        <div className="absolute top-1 right-1 bg-blue-500 text-white rounded-full p-0.5 animate-in zoom-in">
                          <Check size={10} />
                        </div>
                      )}
                      {mode === 'manager' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmId(item.id);
                          }}
                          className="absolute top-1 right-1 z-[60] bg-red-500 text-white rounded-full p-1.5 opacity-100 shadow-md hover:bg-red-600 transition-colors"
                          title="删除附件"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      case 'upload':
        return (
          <div className="h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/30 animate-in zoom-in-95 duration-200">
            <div className="p-12 text-center space-y-4">
              <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                {uploading ? <Loader2 className="animate-spin" size={32} /> : <Upload size={32} />}
              </div>
              <h3 className="text-sm font-bold text-slate-700">将文件拖拽至此处上传</h3>
              <p className="text-xs text-slate-400">支持 {allowedTypes.join(', ') || '常用图片与文档'}</p>
              <input
                type="file"
                id="tab-upload-input"
                className="hidden"
                onChange={handleUpload}
                accept={allowedTypes.join(',')}
              />
              <Button 
                onClick={() => document.getElementById('tab-upload-input')?.click()}
                disabled={uploading}
                className="mt-4"
              >
                选取本地文件
              </Button>
            </div>
          </div>
        );
      case 'remote':
        return (
          <div className="h-[400px] flex flex-col gap-6 p-8 bg-slate-50/30 border rounded-xl animate-in slide-in-from-right-4 duration-300">
             <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-700">
                  <Globe size={18} className="text-blue-500" />
                  <span className="text-sm font-bold">远程资源 URL</span>
                </div>
                <Input 
                  placeholder="https://example.com/image.png"
                  value={remoteUrl}
                  onChange={(e) => setRemoteUrl(e.target.value)}
                  className="bg-white"
                />
                <p className="text-[11px] text-slate-500 italic">请确保链接协议为 HTTPS 且支持跨域访问。</p>
             </div>

             {remoteUrl && (
               <div className="flex-1 border-4 border-white bg-white shadow-sm rounded-lg overflow-hidden flex flex-col items-center justify-center relative group">
                  <img 
                    src={remoteUrl} 
                    className="max-w-full max-h-full object-contain" 
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://placehold.co/400x300?text=Invalid+Image+URL';
                    }}
                  />
                  <div className="absolute inset-0 bg-blue-600/10 opacity-0 group-hover:opacity-100 transition-opacity" />
               </div>
             )}

             <Button 
              disabled={!remoteUrl || uploading} 
              className="w-full"
              loading={uploading}
              onClick={async () => {
                setUploading(true);
                try {
                  const res = await fetch('/api/v1/media', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      url: remoteUrl,
                      filename: remoteUrl.split('/').pop() || 'remote-file',
                      isRemote: true
                    })
                  });
                  if (!res.ok) throw new Error('Persistence failed');
                  const newItem = await res.json();
                  setItems(prev => [newItem, ...prev]);
                  setSelectedId(newItem.id);
                  setRemoteUrl("");
                  setActiveTab('library');
                } catch (err) {
                  console.error('Failed to save remote URL:', err);
                } finally {
                  setUploading(false);
                }
              }}
             >
               确认并存入媒体库
             </Button>
          </div>
        );
    }
  };

  const content = (
    <div className="flex flex-col h-[520px]">
      {/* Tab 切换栏 */}
      <div className="flex gap-1 p-1 bg-slate-100/80 rounded-lg w-fit mb-6 mx-auto">
         <button
          onClick={() => setActiveTab('library')}
          className={cn(
            "px-4 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-2",
            activeTab === 'library' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
         >
           <Library size={14} /> 附件列表
         </button>
         <button
          onClick={() => setActiveTab('upload')}
          className={cn(
            "px-4 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-2",
            activeTab === 'upload' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
         >
           <Upload size={14} /> 本地上传
         </button>
         <button
          onClick={() => setActiveTab('remote')}
          className={cn(
            "px-4 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-2",
            activeTab === 'remote' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
         >
           <Globe size={14} /> 远程地址
         </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {renderTabContent()}
      </div>

      {/* 底部确认栏 - 仅在选取模式下展示 */}
      {selectedId && mode === 'picker' && activeTab === 'library' && (
        <div className="mt-6 flex items-center justify-between p-3 bg-blue-50 rounded-xl border border-blue-100 animate-in slide-in-from-bottom-2">
           <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 rounded-md overflow-hidden bg-white border shrink-0">
                 {currentSelectedItem?.mimeType?.startsWith('image/') ? (
                    <img src={currentSelectedItem.url} className="w-full h-full object-cover" />
                 ) : <FileIcon className="p-2 text-slate-400" size={40} />}
              </div>
              <div className="truncate">
                <p className="text-xs font-bold text-blue-900 truncate">{currentSelectedItem?.filename}</p>
                <p className="text-[10px] text-blue-500 opacity-70">托管于 R2 存储引擎</p>
              </div>
           </div>
           <Button size="sm" onClick={() => currentSelectedItem && onSelect?.(currentSelectedItem)}>确认选取</Button>
        </div>
      )}
    </div>
  );

  if (mode === 'manager') {
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between border-b pb-4">
           <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
             <Library className="text-blue-500" />
             {title}
           </h2>
        </div>
        {content}
        {/* 媒体删除确认 */}
        <Dialog open={!!deleteConfirmId} onOpenChange={(v) => !v && setDeleteConfirmId(null)}>
          <DialogContent className="sm:max-w-[400px] rounded-3xl">
            <DialogHeader>
              <DialogTitle className="text-red-600">确认永久删除该附件吗？</DialogTitle>
            </DialogHeader>
            <div className="py-4 text-sm text-slate-500">
              附件记录及其在 D1/R2 中的关联将尝试移除。此操作不可撤销。
            </div>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setDeleteConfirmId(null)}>取消</Button>
              <Button 
                variant="destructive"
                onClick={() => {
                  const id = deleteConfirmId;
                  if (!id) return;
                  fetch(`/api/v1/media/${id}`, { method: 'DELETE' })
                    .then(res => res.ok && setItems(prev => prev.filter(i => i.id !== id)))
                    .finally(() => setDeleteConfirmId(null));
                }}
              >
                执行删除
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose?.()}>
      <DialogContent className="sm:max-w-3xl max-h-[95vh] overflow-hidden flex flex-col rounded-3xl p-6">
        <DialogHeader className="mb-0">
          <DialogTitle className="text-xl font-black">{title}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden py-2">
           {content}
        </div>
      </DialogContent>
      {/* 媒体删除确认 */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(v) => !v && setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-[400px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-red-600">确认永久删除该附件吗？</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-sm text-slate-500">
            附件记录及其在 D1/R2 中的关联将尝试移除。此操作不可撤销。
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDeleteConfirmId(null)}>取消</Button>
            <Button 
              variant="destructive"
              onClick={() => {
                const id = deleteConfirmId;
                if (!id) return;
                fetch(`/api/v1/media/${id}`, { method: 'DELETE' })
                  .then(res => res.ok && setItems(prev => prev.filter(i => i.id !== id)))
                  .finally(() => setDeleteConfirmId(null));
              }}
            >
              执行删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};
