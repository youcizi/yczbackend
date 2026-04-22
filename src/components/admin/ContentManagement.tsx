import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Plus, 
  Search, 
  MoreHorizontal, 
  Trash2, 
  Edit, 
  FileText,
  Clock,
  LayoutGrid,
  Link as LinkIcon,
  AlertTriangle,
  Globe,
  Columns3,
  Check,
  ChevronDown
} from 'lucide-react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../ui/Table';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { toast } from '@/components/ui/Toaster'; // [HARDENED]: 使用别名路径确保物理唯一性
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/Dialog';
import { EntryForm } from './EntryForm';
import { buildTree, flattenTreeWithPrefix } from '../../lib/tree-utils';
import { cn } from '../../lib/utils';

/**
 * 列可见性缓存 Key 前缀
 * NOTE: 每个集合独立缓存，key 格式为 col_vis_{slug}
 */
const COL_VIS_CACHE_PREFIX = 'col_vis_';

/**
 * 字段列可见性多选下拉组件
 * 用户可勾选需要展示的表格列，选择结果持久化到 localStorage
 */
const ColumnVisibilityDropdown: React.FC<{
  allFields: any[];
  visibleFieldNames: Set<string>;
  onToggle: (fieldName: string) => void;
  onShowAll: () => void;
  onResetDefault: () => void;
}> = ({ allFields, visibleFieldNames, onToggle, onShowAll, onResetDefault }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-all border",
          isOpen
            ? "bg-blue-50 border-blue-200 text-blue-700"
            : "bg-slate-50 border-slate-100 text-slate-500 hover:border-slate-200 hover:text-slate-700"
        )}
      >
        <Columns3 size={13} />
        <span>显示列</span>
        <Badge variant="secondary" className="h-4 px-1 text-[9px] bg-blue-100 text-blue-600 border-none">
          {visibleFieldNames.size}/{allFields.length}
        </Badge>
        <ChevronDown size={12} className={cn("transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* 标题栏 */}
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">表格列管理</span>
            <div className="flex gap-1">
              <button
                onClick={onShowAll}
                className="text-[10px] text-blue-600 hover:underline font-medium"
              >
                全选
              </button>
              <span className="text-slate-300">|</span>
              <button
                onClick={onResetDefault}
                className="text-[10px] text-slate-500 hover:underline font-medium"
              >
                默认
              </button>
            </div>
          </div>

          {/* 字段列表 */}
          <div className="max-h-[280px] overflow-y-auto p-1 scrollbar-thin">
            {allFields.map((field: any) => {
              const isVisible = visibleFieldNames.has(field.name);
              return (
                <button
                  key={field.name}
                  onClick={() => onToggle(field.name)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded transition-colors text-left",
                    isVisible
                      ? "bg-blue-50/50 text-blue-700 font-medium"
                      : "text-slate-500 hover:bg-slate-50"
                  )}
                >
                  <div className={cn(
                    "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all",
                    isVisible ? "bg-blue-600 border-blue-600" : "bg-white border-slate-300"
                  )}>
                    {isVisible && <Check size={10} className="text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{field.label}</div>
                    <div className="text-[9px] text-slate-400 font-mono">{field.name}</div>
                  </div>
                  <Badge variant="outline" className="text-[8px] h-4 border-slate-200 text-slate-400 shrink-0">
                    {field.type}
                  </Badge>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

interface ContentManagementProps {
  slug: string;
}

export const ContentManagement: React.FC<ContentManagementProps> = ({ slug }) => {
  const [data, setData] = useState<any[]>([]);
  const [model, setModel] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isCascadeDelete, setIsCascadeDelete] = useState(false);
  const [languagesList, setLanguagesList] = useState<any[]>([]);
  const [filterLocale, setFilterLocale] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  // NOTE: 列可见性状态，初始为空 Set，在 model 加载后从缓存初始化
  const [visibleFieldNames, setVisibleFieldNames] = useState<Set<string>>(new Set());
  const [colVisInitialized, setColVisInitialized] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [entriesRes, langsRes] = await Promise.all([
        fetch(`/api/v1/entities/${slug}`),
        fetch('/api/v1/rbac/languages')
      ]);
      
      if (!entriesRes.ok) throw new Error('内容加载失败');
      const result = await entriesRes.json();
      setData(result.data);
      setModel(result.model);

      if (langsRes.ok) {
        setLanguagesList(await langsRes.json());
      }
    } catch (err: any) {
      toast({ title: '错误', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // 重置列可见性初始化标志，当 slug 变化时需要重新从缓存读取
    setColVisInitialized(false);
  }, [slug]);

  /**
   * model 加载完成后初始化列可见性
   * 优先从 localStorage 读取缓存，若无缓存则使用 isListDisplay 字段
   */
  useEffect(() => {
    if (!model || colVisInitialized) return;

    const cacheKey = `${COL_VIS_CACHE_PREFIX}${slug}`;
    const cached = localStorage.getItem(cacheKey);

    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setVisibleFieldNames(new Set(parsed));
          setColVisInitialized(true);
          return;
        }
      } catch {
        // 缓存损坏，回退到默认
      }
    }

    // 默认：只显示 isListDisplay 标记的字段
    const defaults = model.fieldsJson
      .filter((f: any) => f.isListDisplay)
      .map((f: any) => f.name);
    setVisibleFieldNames(new Set(defaults.length > 0 ? defaults : model.fieldsJson.slice(0, 4).map((f: any) => f.name)));
    setColVisInitialized(true);
  }, [model, slug, colVisInitialized]);

  /**
   * 列可见性变化时持久化到 localStorage
   */
  const persistVisibility = useCallback((nextSet: Set<string>) => {
    setVisibleFieldNames(nextSet);
    const cacheKey = `${COL_VIS_CACHE_PREFIX}${slug}`;
    localStorage.setItem(cacheKey, JSON.stringify(Array.from(nextSet)));
  }, [slug]);

  const handleToggleColumn = useCallback((fieldName: string) => {
    const nextSet = new Set(visibleFieldNames);
    if (nextSet.has(fieldName)) {
      // 至少保留一列
      if (nextSet.size <= 1) return;
      nextSet.delete(fieldName);
    } else {
      nextSet.add(fieldName);
    }
    persistVisibility(nextSet);
  }, [visibleFieldNames, persistVisibility]);

  const handleShowAllColumns = useCallback(() => {
    if (!model) return;
    const allNames = model.fieldsJson.map((f: any) => f.name);
    persistVisibility(new Set(allNames));
  }, [model, persistVisibility]);

  const handleResetDefaultColumns = useCallback(() => {
    if (!model) return;
    const defaults = model.fieldsJson
      .filter((f: any) => f.isListDisplay)
      .map((f: any) => f.name);
    persistVisibility(new Set(defaults.length > 0 ? defaults : model.fieldsJson.slice(0, 4).map((f: any) => f.name)));
  }, [model, persistVisibility]);

  const handleDelete = async (id: number) => {
    try {
      const url = `/api/v1/entities/${slug}/${id}${isCascadeDelete ? '?cascade=true' : ''}`;
      const res = await fetch(url, { method: 'DELETE' });
      if (!res.ok) throw new Error('删除失败');
      toast({ title: '成功', description: isCascadeDelete ? '翻译组已全部清空' : '数据已删除' });
      setDeletingId(null);
      fetchData();
      setDeletingId(null);
      fetchData();
    } catch (err: any) {
      toast({ title: '错误', description: err.message, variant: 'destructive' });
    }
  };

  const handleSubmit = async (formData: any) => {
    // [核心修复]：识别多语言内存工作站的批处理信号
    if (formData?._batchSaved) {
      setIsFormOpen(false);
      setEditingId(null);
      fetchData(); // 强刷列表以获取最新的 translationGroup
      return { success: true };
    }

    const isEdit = !!editingId;
    const url = isEdit ? `/api/v1/entities/${slug}/${editingId}` : `/api/v1/entities/${slug}`;
    const method = isEdit ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    const result = await res.json();
    setIsFormOpen(false);
    setEditingId(null);
    fetchData();
    
    toast({ title: isEdit ? '更新成功' : '已保存', description: '数据同步完成' });
    return result;
  };

  // 核心逻辑：智能树形感应与多维度筛选 (语种 + 搜索)
  const processedData = React.useMemo(() => {
    if (data.length === 0) return [];

    let filtered = [...data];

    // 1. 语种筛选
    if (filterLocale !== 'all') {
      filtered = filtered.filter(item => item.locale === filterLocale);
    }

    // 2. 关键词搜索
    if (searchQuery.trim()) {
      const term = searchQuery.toLowerCase();
      filtered = filtered.filter(item => {
        const searchableText = `${item.title || ''} ${JSON.stringify(item)}`.toLowerCase();
        return searchableText.includes(term);
      });
    }

    // 3. 树形转换 (如有必要)
    const hasParentLink = filtered.length > 0 && ('parent_id' in filtered[0]);
    if (hasParentLink) {
      const tree = buildTree(filtered, { idKey: 'id', parentKey: 'parent_id' });
      return flattenTreeWithPrefix(tree, model?.fieldsJson?.find((f: any) => f.isListDisplay)?.name || 'name');
    }
    
    return filtered;
  }, [data, slug, model, filterLocale, searchQuery]);

  if (loading && !model) return <div className="p-8 text-center text-slate-500 animate-pulse">正在初始化引擎...</div>;
  if (!model) return <div className="p-8 text-center text-red-500 font-bold border-2 border-dashed border-red-200 rounded-xl bg-red-50/20">模型定义丢失或无效</div>;

  // 获取需要展示在表格中的字段（由用户列可见性选择驱动）
  const listFields = model.fieldsJson.filter((f: any) => visibleFieldNames.has(f.name));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/30">
             <LayoutGrid className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{model.name}</h1>
            <p className="text-sm text-slate-500 font-medium">管理与发布您的动态内容实体</p>
          </div>
        </div>
        <Button 
          onClick={() => { setEditingId(null); setIsFormOpen(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 px-6"
        >
          <Plus className="mr-2" size={18} />
          新增记录
        </Button>
      </div>

      <Card className="border-none shadow-xl shadow-slate-200/50 overflow-visible bg-white/80 backdrop-blur-sm">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white gap-4 rounded-t-lg">
           <div className="flex items-center gap-3">
             <div className="relative w-72 group">
               <Search className="absolute left-3 top-2.5 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={16} />
               <Input 
                 placeholder="在当前列表中搜索..." 
                 value={searchQuery}
                 onChange={e => setSearchQuery(e.target.value)}
                 className="pl-9 bg-slate-50 border-none h-10 text-sm focus-visible:ring-blue-500" 
               />
             </div>
             
             {languagesList.length > 1 && (
               <Select value={filterLocale} onValueChange={setFilterLocale}>
                 <SelectTrigger className="w-32 h-10 bg-slate-50 border-none text-xs font-semibold">
                   <div className="flex items-center gap-2">
                     <Globe size={14} className="text-slate-400" />
                     <SelectValue placeholder="所有语种" />
                   </div>
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="all">所有语种</SelectItem>
                   {languagesList.map(lang => (
                     <SelectItem key={lang.code} value={lang.code}>
                       {lang.name} ({lang.code})
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             )}
           </div>
           
           <div className="flex items-center gap-2">
             <Badge variant="ghost" className="text-slate-500 bg-slate-100/50">
               找到 {processedData.length} / {data.length} 条记录
             </Badge>
             <ColumnVisibilityDropdown
               allFields={model.fieldsJson}
               visibleFieldNames={visibleFieldNames}
               onToggle={handleToggleColumn}
               onShowAll={handleShowAllColumns}
               onResetDefault={handleResetDefaultColumns}
             />
           </div>
        </div>

        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow className="hover:bg-transparent">
              {listFields.map((field: any) => (
                <TableHead key={field.name} className="font-bold text-slate-600 uppercase text-[11px] tracking-wider py-4">
                  {field.label} 
                </TableHead>
              ))}
              <TableHead className="font-bold text-slate-600 uppercase text-[11px] tracking-wider py-4 w-20 text-center">
                语种
              </TableHead>
              <TableHead className="font-bold text-slate-600 uppercase text-[11px] tracking-wider py-4">
                <div className="flex items-center gap-1">
                  <Clock size={12} />
                  创建时间
                </div>
              </TableHead>
              <TableHead className="text-right font-bold text-slate-600 py-4">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={listFields.length + 2} className="h-48 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="text-slate-200" size={48} />
                    <p className="text-slate-400 font-medium italic">暂无数据记录</p>
                    <Button variant="outline" size="sm" onClick={() => setIsFormOpen(true)} className="mt-2">立即添加第一条</Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              processedData.map((row) => (
                <TableRow key={row.id} className="group hover:bg-slate-50/50 transition-colors duration-200">
                  {listFields.map((field: any) => (
                    <TableCell key={field.name} className="py-4">
                      {['relation', 'relation_single', 'relation_multi', 'radio', 'select', 'multi_select', 'checkbox'].includes(field.type) ? (
                        <div className={cn(
                          "flex items-center gap-1.5 px-2 py-1 rounded-md border max-w-fit",
                          field.type.toString().startsWith('relation') ? "bg-blue-50/50 border-blue-100/50 text-blue-700" : "bg-slate-50 border-slate-100 text-slate-700"
                        )}>
                          {field.type.toString().startsWith('relation') && <LinkIcon size={12} className="text-blue-500" />}
                          <span className="font-bold text-[11px]">
                            {row._displayValues?.[field.name] || (typeof row[field.name] === 'object' ? JSON.stringify(row[field.name]) : row[field.name]) || '-'}
                          </span>
                        </div>
                      ) : field.type === 'image' ? (
                        <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden hover:scale-110 transition-transform cursor-pointer">
                          {row[field.name] ? <img src={row[field.name]} alt="preview" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-300"><Plus size={14} /></div>}
                        </div>
                      ) : (
                        <span className={cn(
                          "font-medium text-slate-700 text-xs truncate max-w-[300px] inline-block",
                          row.level > 0 && "text-slate-500 italic"
                        )}>
                          {row.displayLabel || (
                            typeof row[field.name] === 'object' && row[field.name] !== null 
                              ? JSON.stringify(row[field.name]) 
                              : (row[field.name] || '-')
                          )}
                        </span>
                      )}
                    </TableCell>
                  ))}
                  <TableCell className="py-4 text-center">
                    <Badge variant="outline" className="text-[10px] font-bold border-slate-200 bg-white text-slate-500 px-1.5 h-5">
                      {(row.locale || 'ZH').toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-400 text-[10px] py-4 font-mono">
                    {new Date(row.createdAt).toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </TableCell>
                  <TableCell className="text-right py-4">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        data-testid="edit-button"
                        className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                        onClick={() => { setEditingId(row.id); setIsFormOpen(true); }}
                      >
                        <Edit size={16} />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        data-testid="delete-button"
                        className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                        onClick={() => setDeletingId(row.id)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[80%] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
               <div className="w-2 h-8 bg-blue-600 rounded-full" />
               {editingId ? '编辑记录' : '新增记录'}
            </DialogTitle>
            <DialogDescription>
               请完善 {model.name} 模型的基础信息。星号标记为必填项。
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4">
            <EntryForm 
              slug={slug}
              fields={model.fieldsJson} 
              initialData={editingId ? data.find(r => r.id === editingId) : {}}
              onSubmit={handleSubmit}
              onCancel={() => setIsFormOpen(false)}
              onLocaleSwitch={(id) => {
                setEditingId(id);
                // 强制重新渲染以加载新 ID 的数据
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <div className="flex items-center gap-3 text-red-600 mb-2">
              <div className="p-2 bg-red-50 rounded-full">
                <AlertTriangle size={24} />
              </div>
              <DialogTitle className="text-xl">确认删除记录？</DialogTitle>
            </div>
            <DialogDescription className="text-slate-500 leading-relaxed text-sm">
              您正在尝试永久移除该条数据记录。此操作将直接从数据库中清理，<strong className="text-slate-900">不可撤销</strong>。
            </DialogDescription>
            {data.find(r => r.id === deletingId)?.translationGroup && (
              <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-700">级联清理翻译组</span>
                  <span className="text-[10px] text-slate-400">同时删除该内容的所有其他语种版本</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={isCascadeDelete} 
                  onChange={(e) => setIsCascadeDelete(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
              </div>
            )}
          </DialogHeader>
          <DialogFooter className="mt-6 flex gap-2">
             <Button variant="outline" onClick={() => setDeletingId(null)} className="flex-1 text-xs">
               取消
             </Button>
             <Button 
               variant="destructive" 
               data-testid="confirm-delete-button"
               onClick={() => deletingId && handleDelete(deletingId)} 
               className="flex-1 shadow-lg shadow-red-200 text-xs font-bold"
             >
               确认删除
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
