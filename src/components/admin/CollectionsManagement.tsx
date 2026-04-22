import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Layers,
  LayoutTemplate,
  ArrowRight,
  ShieldAlert,
  Save,
  Loader2,
  Settings,
  Pencil,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  FolderClosed,
  Link2
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { buildTree, flattenTreeWithPrefix, getAllDescendantIds } from '../../lib/tree-utils';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/Table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '../ui/Dialog';
import { Badge } from '../ui/Badge';
import { useToast } from '../ui/Toaster';
import { Switch } from '../ui/Switch';
import * as LucideIcons from 'lucide-react';


interface Collection {
  id: number;
  name: string;
  slug: string;
  modelId: number;
  modelName: string;
  description: string;
  icon: string;
  relationSettings: Record<string, { targetCollectionSlug: string; displayField: string }>; // Legacy
  fieldConfig: Record<string, any>; // New
  parentId?: number | null;
  menuGroup?: string | null;
}

interface Model {
  id: number;
  name: string;
  slug: string;
}

const AVAILABLE_ICONS = [
  'Layers', 'LayoutGrid', 'Users', 'MessageSquare', 'ShoppingBag', 'FileText', 
  'Image', 'Globe', 'Settings', 'Package', 'Shield', 'Wand2', 'Database',
  'Code2', 'Mail', 'Languages', 'Clock', 'Search', 'Bell', 'Calendar', 'Briefcase'
];

export const CollectionsManagement: React.FC = () => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // 删除确认状态
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteName, setDeleteName] = useState('');
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  // 分组编辑状态
  const [isGroupEditOpen, setIsGroupEditOpen] = useState(false);
  const [groupForm, setGroupForm] = useState({
    oldName: '',
    newName: '',
    icon: 'Layers'
  });

  const { toast } = useToast();

  const [form, setForm] = useState({
    name: '',
    slug: '',
    modelId: 0,
    description: '',
    icon: 'Layers',
    sort: 0,
    menuGroup: '',
    parentId: null as number | null
  });

  // 展开收缩状态
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());

  // 初始化展开所有分组
  useEffect(() => {
    if (collections.length > 0) {
      const groups = new Set(collections.map(c => c.menuGroup || '其它内容'));
      setExpandedGroups(groups);
      // 默认展开所有带有子节点的节点
      const nodesWithChildren = new Set(collections.filter(c => collections.some(child => child.parentId === c.id)).map(c => c.id));
      setExpandedNodes(nodesWithChildren);
    }
  }, [collections.length === 0]); // 只在第一次加载数据后执行一次

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [cRes, mRes] = await Promise.all([
        fetch('/api/v1/rbac/collections'),
        fetch('/api/v1/rbac/models')
      ]);
      const [cData, mData] = await Promise.all([cRes.json(), mRes.json()]);
      setCollections(cData);
      setModels(mData);
    } catch (e) {
      toast({ variant: 'destructive', title: '加载失败', description: '无法获取集合或模型数据' });
    } finally {
      setLoading(false);
    }
  };

  const handleNameChange = (name: string) => {
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setForm(prev => ({ ...prev, name, slug }));
  };

  const handleSave = async () => {
    if (!form.name || !form.slug || form.modelId === 0) {
      toast({ variant: 'destructive', title: '校验失败', description: '请填写完整信息并选择模型' });
      return;
    }
    setSaving(true);
    try {
      const url = isEdit ? `/api/v1/rbac/collections/${editId}` : '/api/v1/rbac/collections';
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        setIsCreateOpen(false);
        setIsEdit(false);
        setEditId(null);
        window.dispatchEvent(new CustomEvent('collections-updated'));
        fetchData();
        toast({ title: isEdit ? '更新成功' : '创建成功' });
      } else {
        const err = await res.json();
        throw new Error(err.error || (isEdit ? '更新失败' : '创建失败'));
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: '保存失败', description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGroup = async () => {
    if (!groupForm.newName.trim()) {
      toast({ variant: 'destructive', title: '校验失败', description: '分组名称不能为空' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/rbac/collections/group/${encodeURIComponent(groupForm.oldName)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newName: groupForm.newName,
          icon: groupForm.icon
        })
      });
      if (res.ok) {
        setIsGroupEditOpen(false);
        window.dispatchEvent(new CustomEvent('collections-updated'));
        fetchData();
        toast({ title: '分组更新成功' });
      } else {
        const err = await res.json();
        throw new Error(err.error || '更新失败');
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: '保存失败', description: e.message });
    } finally {
      setSaving(false);
    }
  };


  const openEdit = (c: Collection) => {
    setForm({
      name: c.name,
      slug: c.slug,
      modelId: c.modelId,
      description: c.description,
      icon: c.icon || 'Layers',
      sort: (c as any).sort || 0,
      menuGroup: c.menuGroup || '',
      parentId: c.parentId || null
    });
    setEditId(c.id);
    setIsEdit(true);
    setIsCreateOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/v1/rbac/collections/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast({ title: '已删除', description: '集合入口已关闭' });
        window.dispatchEvent(new CustomEvent('collections-updated'));
        fetchData();
        setDeleteId(null);
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: '操作失败', description: e.message });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Layers className="text-blue-600" size={24} />
            业务集合管理 (Collections)
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            基于内容模型创建不同的业务单元（如：博客、技术文档、通知公告）。
          </p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 gap-2">
              <Plus size={18} />
              创建新集合
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{isEdit ? '编辑业务集合' : '实例化业务集合'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">集合名称 (显示在侧边栏)</label>
                <Input placeholder="如：官方博客" value={form.name} onChange={e => handleNameChange(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">唯一标识 (Slug)</label>
                  <Input placeholder="blog" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">绑定内容模型</label>
                  <select
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-md text-sm"
                    value={form.modelId}
                    onChange={e => setForm({ ...form, modelId: parseInt(e.target.value) })}
                  >
                    <option value={0}>选择一个骨架模型...</option>
                    {models.map(m => <option key={m.id} value={m.id}>{m.name} ({m.slug})</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">描述信息</label>
                  <Input placeholder="简述用途..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center justify-between">
                    父级菜单/名称
                  </label>
                  <div className="relative group/parent">
                    <Input
                      placeholder="输入或选择..."
                      list="menu-options"
                      value={form.parentId ? (collections.find(c => c.id === form.parentId)?.name || '') : (form.menuGroup || '')}
                      onChange={e => {
                        const val = e.target.value;
                        // 逻辑：如果输入的值匹配某个已有集合的名称，则设置为 parentId
                        const matchedColl = collections.find(c => c.name === val);
                        if (matchedColl) {
                          setForm({ ...form, parentId: matchedColl.id, menuGroup: matchedColl.menuGroup || '' });
                        } else {
                          setForm({ ...form, parentId: null, menuGroup: val });
                        }
                      }}
                    />
                    <datalist id="menu-options">
                      {/* 1. 已有的一级分组名称 */}
                      {[...new Set(collections.map(c => c.menuGroup).filter(Boolean))].map(group => (
                        <option key={`group-${group}`} value={group as string} />
                      ))}
                      {/* 2. 已有的业务集合 (树形平铺，增强层级感) */}
                      {flattenTreeWithPrefix(buildTree(collections, { idKey: 'id', parentKey: 'parentId' }), 'name', '└── ').map(c => (
                        <option key={`coll-${c.id}`} value={c.name} />
                      ))}
                    </datalist>
                    {form.parentId && (
                      <div className="absolute right-3 top-2 text-[10px] text-blue-500 bg-blue-50 px-1 rounded border border-blue-100">
                        作为子集
                      </div>
                    )}
                    <p className="text-[12px] h-4 pt-2 text-yellow-400">输入新名称自动创建一级菜单</p>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => { setIsCreateOpen(false); setIsEdit(false); }}>取消</Button>
              <Button onClick={handleSave} disabled={saving} className="bg-blue-600 text-white">
                {saving ? <Loader2 className="animate-spin mr-2" size={16} /> : <Save className="mr-2" size={16} />}
                {isEdit ? '保存更改' : '确认创建'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-slate-100 shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="pl-6">业务集合</TableHead>
              <TableHead>绑定模型</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead className="text-right pr-6">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="py-20 text-center"><Loader2 className="animate-spin inline-block text-blue-500" /></TableCell>
              </TableRow>
            ) : collections.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-20 text-center">
                  <LayoutTemplate size={48} className="text-slate-200 inline-block mb-4" />
                  <p className="text-slate-500 italic">尚未创建任何业务集合</p>
                </TableCell>
              </TableRow>
            ) : (
              (() => {
                // 1. 按分组聚类
                const groups: Record<string, Collection[]> = collections
                  .filter(c => c.slug !== 'media_library')
                  .reduce((acc: any, c) => {
                    const g = c.menuGroup || '其它内容';
                    if (!acc[g]) acc[g] = [];
                    acc[g].push(c);
                    return acc;
                  }, {});

                return Object.entries(groups).map(([groupName, groupItems]) => {
                  const isGroupExpanded = expandedGroups.has(groupName);
                  const groupTree = buildTree(groupItems, { idKey: 'id', parentKey: 'parentId' });

                  return (
                    <React.Fragment key={groupName}>
                      {/* 分组标题行 */}
                      <TableRow
                        className="bg-slate-50/80 hover:bg-slate-100/80 cursor-pointer border-y border-slate-200/60"
                        onClick={() => {
                          const next = new Set(expandedGroups);
                          if (next.has(groupName)) next.delete(groupName); else next.add(groupName);
                          setExpandedGroups(next);
                        }}
                      >
                        <TableCell colSpan={4} className="py-2.5 pl-6">
                          <div className="flex items-center justify-between w-full pr-4 group/header">
                            <div className="flex items-center gap-2 text-slate-600">
                              {isGroupExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              {isGroupExpanded ? <FolderOpen size={16} className="text-blue-500/70" /> : <FolderClosed size={16} className="text-slate-400" />}
                              <span className="text-xs font-bold uppercase tracking-wider font-mono">{groupName}</span>
                              <Badge variant="secondary" className="bg-slate-200/50 text-slate-500 text-[10px] h-4 ml-1">
                                {groupItems.length}
                              </Badge>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-7 px-2 text-slate-400 hover:text-blue-600 opacity-0 group-hover/header:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                                setGroupForm({
                                  oldName: groupName,
                                  newName: groupName,
                                  icon: groupItems[0]?.icon || 'Layers'
                                });
                                setIsGroupEditOpen(true);
                              }}
                            >
                              <Pencil size={12} className="mr-1" />
                              <span className="text-[10px]">编辑分组</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* 分组内容渲染 */}
                      {isGroupExpanded && flattenTreeWithPrefix(groupTree, 'name', ' ').map((c: any) => {
                        // 计算是否应该显示 (父节点展开)
                        let shouldShow = true;
                        let curr: any = c;
                        while (curr.parentId) {
                          if (!expandedNodes.has(curr.parentId)) {
                            shouldShow = false;
                            break;
                          }
                          curr = groupItems.find(it => it.id === curr.parentId);
                          if (!curr) break;
                        }

                        if (!shouldShow) return null;

                        const hasChildren = groupItems.some(it => it.parentId === c.id);
                        const isExpanded = expandedNodes.has(c.id);

                        return (
                          <TableRow key={c.id} className="group hover:bg-white transition-colors border-b border-slate-100/50">
                            <TableCell className="pl-8 py-3.5 relative">
                              <div className="flex items-center gap-2">
                                {/* 树形缩进辅助线 */}
                                {Array.from({ length: c.level }).map((_, i) => (
                                  <div key={i} className="w-5 border-r border-slate-200 h-10 -my-4 last:mr-1" />
                                ))}

                                {hasChildren ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const next = new Set(expandedNodes);
                                      if (next.has(c.id)) next.delete(c.id); else next.add(c.id);
                                      setExpandedNodes(next);
                                    }}
                                    className="p-0.5 hover:bg-slate-100 rounded text-slate-400"
                                  >
                                    {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                  </button>
                                ) : (
                                  <div className="w-4" /> // 占位
                                )}

                                <div className={`w-7 h-7 rounded flex items-center justify-center transition-all ${c.level > 0 ? 'bg-blue-50 text-blue-500 ring-1 ring-blue-100' : 'bg-slate-100 text-slate-500'}`}>
                                  <Layers size={c.level > 0 ? 12 : 14} />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className={`font-semibold text-slate-800 truncate ${c.level > 0 ? 'text-xs' : 'text-sm'}`}>
                                      {c.name}
                                    </span>
                                    {c.level > 0 && <Link2 size={10} className="text-slate-300" />}
                                  </div>
                                  <span className="text-[10px] text-slate-400 truncate block whitespace-nowrap overflow-hidden max-w-[200px]">
                                    {c.description || '无描述信息...'}
                                  </span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="gap-1 border-blue-50 text-blue-500 bg-blue-50/30 text-[10px] py-0 px-2 h-5">
                                <LayoutTemplate size={10} />
                                {c.modelName}
                              </Badge>
                            </TableCell>
                            <TableCell><code className="text-[10px] bg-slate-50 border border-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">{c.slug}</code></TableCell>
                            <TableCell className="text-right pr-6">
                              <div className="flex justify-end gap-1.5">
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-600" title="进入管理" onClick={() => window.location.href = `/admin/collections/${c.slug}`}>
                                  <ArrowRight size={16} />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-blue-600" title="基础配置" onClick={() => openEdit(c)}>
                                  <Pencil size={14} />
                                </Button>
                                <FieldConfigDialog
                                  collection={c}
                                  collections={collections}
                                  allModels={models}
                                  onUpdated={fetchData}
                                />
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-red-600" title="删除集合" onClick={() => { setDeleteId(c.id); setDeleteName(c.name); }}>
                                  <Trash2 size={14} />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </React.Fragment>
                  );
                });
              })()
            )}
          </TableBody>
        </Table>
      </Card>

      <div className="flex items-center gap-2 p-4 bg-orange-50 border border-orange-100 rounded-lg">
        <ShieldAlert className="text-orange-500" size={18} />
        <div className="text-sm text-orange-700 font-medium">
          提示：创建集合后，请前往“角色权限”为对应角色开启 <Badge variant="outline" className="text-[10px] h-5 border-orange-200">collection:{form.slug || '...'}:view</Badge> 权限。
        </div>
      </div>

      {/* 删除确认 Dialog */}
      <Dialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <DialogContent className="sm:max-w-[400px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <ShieldAlert size={20} />
              确认删除业务集合？
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 text-sm text-slate-500 leading-relaxed">
            确定要删除业务集合 <strong className="text-slate-900">[{deleteName}]</strong> 吗？<br />
            内部实体数据将被保留（如需清理请手动操作），但该集合在后台的<strong className="text-slate-900">管理入口将由于权限同步而彻底关闭</strong>。
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDeleteId(null)}>取消</Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && handleDelete(deleteId)}
            >
              执行解绑
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 分组编辑 Dialog */}
      <Dialog open={isGroupEditOpen} onOpenChange={setIsGroupEditOpen}>
        <DialogContent className="sm:max-w-[440px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil size={20} className="text-blue-600" />
              编辑目录分组
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-6 space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 ml-1">分组名称</label>
              <Input 
                value={groupForm.newName} 
                onChange={e => setGroupForm({ ...groupForm, newName: e.target.value })}
                placeholder="输入新的分组名称..."
                className="h-11 rounded-xl border-slate-200 focus:ring-blue-500"
              />
            </div>
            
            <div className="space-y-3">
              <label className="text-sm font-semibold text-slate-700 ml-1">选择分组图标</label>
              <div className="grid grid-cols-7 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                {AVAILABLE_ICONS.map(iconName => {
                  const IconComp = (LucideIcons as any)[iconName] || Layers;
                  const isSelected = groupForm.icon === iconName;
                  return (
                    <button
                      key={iconName}
                      onClick={() => setGroupForm({ ...groupForm, icon: iconName })}
                      className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${
                        isSelected 
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                          : 'bg-white text-slate-400 hover:text-blue-500 hover:bg-blue-50 border border-slate-100'
                      }`}
                      title={iconName}
                    >
                      <IconComp size={18} />
                    </button>
                  );
                })}
              </div>
            </div>
            
            <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100/50 flex gap-3">
               <ShieldAlert className="text-blue-500 shrink-0" size={18} />
               <p className="text-[11px] text-blue-700 leading-relaxed font-medium">
                 提示：修改分组名称会同步更新该线下所有集合的所属菜单项；修改图标将同步更新侧边栏中该目录的展示图标。
               </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsGroupEditOpen(false)} className="rounded-xl">取消</Button>
            <Button 
              onClick={handleSaveGroup} 
              disabled={saving} 
              className="bg-blue-600 text-white px-8 rounded-xl shadow-lg shadow-blue-500/20"
            >
              {saving ? <Loader2 className="animate-spin mr-2" size={16} /> : <Save className="mr-2" size={16} />}
              确认更新
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
/**
 * 上下文敏感的配置面板 (Context-Aware Config Modal)
 */
const FieldConfigDialog: React.FC<{
  collection: Collection,
  collections: Collection[],
  allModels: any[],
  onUpdated: () => void
}> = ({ collection, collections, allModels, onUpdated }) => {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'fields' | 'api' | 'hooks'>('fields');
  // Migrate initial state
  const [settings, setSettings] = useState<Record<string, any>>(collection.fieldConfig || collection.relationSettings || {});
  const { toast } = useToast();

  const currentModel = allModels.find(m => m.id === collection.modelId);
  const fields = currentModel ? (typeof currentModel.fieldsJson === 'string' ? JSON.parse(currentModel.fieldsJson) : currentModel.fieldsJson) : [];

  const handleUpdateRelation = (fieldName: string, targetSlug: string, displayField: string = 'name') => {
    setSettings(prev => {
      const newSettings = { ...prev };
      if (!targetSlug) {
        delete newSettings[fieldName];
      } else {
        newSettings[fieldName] = { ...newSettings[fieldName], target_slug: targetSlug, display_field: displayField, targetCollectionSlug: targetSlug, displayField: displayField };
      }
      return newSettings;
    });
  };

  const handleUpdateOptions = (fieldName: string, options: any[]) => {
    setSettings(prev => ({
      ...prev,
      [fieldName]: { ...prev[fieldName], options }
    }));
  };

  const handleUpdateApiPolicy = (updates: any) => {
    setSettings(prev => ({
      ...prev,
      __api_policy: { ...(prev.__api_policy || {}), ...updates }
    }));
  };

  const handleUpdateNotificationPolicy = (updates: any) => {
    setSettings(prev => ({
      ...prev,
      __notification_policy: { ...(prev.__notification_policy || {}), ...updates }
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload: any = { ...collection };
      delete payload.modelName; // Cannot be updated to endpoint
      const res = await fetch(`/api/v1/rbac/collections/${collection.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          fieldConfig: settings // Store everything under fieldConfig
        })
      });
      if (res.ok) {
        toast({ title: '配置已更新', description: '字段高级配置已生效' });
        setOpen(false);
        onUpdated();
      } else {
        const d = await res.json();
        throw new Error(d.error || '保存失败');
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: '保存失败', description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const editableFields = fields.filter((f: any) =>
    ['checkbox', 'radio', 'select', 'multi_select', 'relation', 'relation_single', 'relation_multi'].includes(f.type)
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-slate-400 hover:text-blue-600 flex items-center gap-1.5">
          <Settings size={16} />
          <span className="text-xs">配置</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            高级字段配置: {collection.name}
          </DialogTitle>
        </DialogHeader>
        <div className="py-2 space-y-4">
          <div className="flex border-b">
            <button
              className={`px-4 py-2 text-sm font-medium ${activeTab === 'fields' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => setActiveTab('fields')}
            >内部字段配置</button>
            <button
              className={`px-4 py-2 text-sm font-medium ${activeTab === 'api' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => setActiveTab('api')}
            >API 开放治理</button>
            <button
              className={`px-4 py-2 text-sm font-medium ${activeTab === 'hooks' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => setActiveTab('hooks')}
            >通知钩子 (Hooks)</button>
          </div>

          {activeTab === 'fields' ? (
            <>
              <p className="text-xs text-slate-500">
                根据所选模型的字段类型，此处展示不同的配置项。枚举类型(Radio/Select)请配置固定的选项列表；关联类型请指向目标数据流集合。
              </p>

              {editableFields.length === 0 ? (
                <div className="p-8 text-center text-slate-400">当前模型暂无需要辅助配置的高级字段。</div>
              ) : (
                <div className="space-y-6">
                  {editableFields.map((f: any) => (
                    <div key={f.name} className="p-4 border rounded-lg bg-slate-50 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="font-semibold">{f.label}</span>
                        <Badge variant="outline" className="text-[10px] font-mono">{f.name}</Badge>
                        <Badge className="text-[10px] bg-blue-100 text-blue-600 border-none">{f.type.toUpperCase()}</Badge>
                      </div>

                      {['radio', 'checkbox', 'select', 'multi_select'].includes(f.type) && (
                        <OptionEditor
                          initialOptions={settings[f.name]?.options || []}
                          onChange={(opts) => handleUpdateOptions(f.name, opts)}
                        />
                      )}

                      {['relation', 'relation_single', 'relation_multi'].includes(f.type) && (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-600">目标业务集合 (Target Collection)</label>
                            <select
                              className="w-full h-9 text-sm border rounded px-3"
                              value={settings[f.name]?.target_slug || settings[f.name]?.targetCollectionSlug || ''}
                              onChange={e => handleUpdateRelation(f.name, e.target.value, settings[f.name]?.display_field || settings[f.name]?.displayField || 'name')}
                            >

                              <option value="">-- 请选择数据源 --</option>
                              {collections.filter(c => c.id !== collection.id).map(c => (
                                <option key={c.id} value={c.slug}>{c.name} ({c.slug})</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-600">回显字段 (Display Field)</label>
                            <Input
                              className="h-9 text-sm"
                              placeholder="例如: title 或 name"
                              value={settings[f.name]?.display_field || settings[f.name]?.displayField || ''}
                              disabled={!settings[f.name]}
                              onChange={e => {
                                const val = e.target.value;
                                handleUpdateRelation(f.name, settings[f.name]?.target_slug || settings[f.name]?.targetCollectionSlug, val);
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-6">
              <div className="p-4 border rounded-lg bg-slate-50 shadow-sm flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-sm">启用公共 API</h4>
                  <p className="text-xs text-slate-500">允许外部请求无 Token 访问此集合的受限数据。</p>
                </div>
                <Switch
                  checked={settings.__api_policy?.enabled || false}
                  onCheckedChange={(v) => handleUpdateApiPolicy({ enabled: v })}
                />
              </div>

              {settings.__api_policy?.enabled && (
                <>
                  <div className="p-4 border rounded-lg space-y-4">
                    <h4 className="font-semibold text-sm border-b pb-2">基础设置</h4>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold">允许的请求方法 (Allowed Methods)</label>
                      <div className="flex gap-4">
                        {['schema', 'data', 'submit'].map(method => (
                          <label key={method} className="flex items-center gap-2 text-sm cursor-pointer">
                            <input type="checkbox" className="rounded"
                              checked={!!settings.__api_policy?.allowed_methods?.includes(method)}
                              onChange={(e) => {
                                const current = new Set(settings.__api_policy?.allowed_methods || []);
                                if (e.target.checked) current.add(method); else current.delete(method);
                                handleUpdateApiPolicy({ allowed_methods: Array.from(current) });
                              }}
                            />
                            {method.toUpperCase()}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-semibold">CORS 域名白名单 (逗号分隔)</label>
                        <Input
                          placeholder="如: https://example.com, *"
                          value={(settings.__api_policy?.security?.allowed_domains || []).join(', ')}
                          onChange={e => {
                            const domains = e.target.value.split(',').map(d => d.trim()).filter(Boolean);
                            handleUpdateApiPolicy({ security: { ...(settings.__api_policy?.security || {}), allowed_domains: domains } });
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold">IP 频率限制 (次/分钟，0为不限)</label>
                        <Input type="number"
                          placeholder="0"
                          value={settings.__api_policy?.security?.rate_limit_per_min || 0}
                          onChange={e => handleUpdateApiPolicy({ security: { ...(settings.__api_policy?.security || {}), rate_limit_per_min: parseInt(e.target.value) || 0 } })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg space-y-4">
                    <h4 className="font-semibold text-sm border-b pb-2 flex justify-between">
                      <span>字段显隐与写入控制</span>
                      <span className="text-[10px] font-normal text-slate-500">仅允许白名单的字段发生交互</span>
                    </h4>
                    <div className="space-y-2">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-1/2">字段 (显示名称 / Key)</TableHead>
                            <TableHead className="text-center">可读 (Read)</TableHead>
                            <TableHead className="text-center">可写 (Write)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {fields.map((f: any) => {
                            const isReadable = !!settings.__api_policy?.field_permissions?.read_whitelist?.includes(f.name);
                            const isWritable = !!settings.__api_policy?.field_permissions?.write_whitelist?.includes(f.name);

                            const toggleRead = (checked: boolean) => {
                              const current = new Set(settings.__api_policy?.field_permissions?.read_whitelist || []);
                              if (checked) current.add(f.name); else current.delete(f.name);
                              handleUpdateApiPolicy({ field_permissions: { ...(settings.__api_policy?.field_permissions || {}), read_whitelist: Array.from(current) } });
                            };
                            const toggleWrite = (checked: boolean) => {
                              const current = new Set(settings.__api_policy?.field_permissions?.write_whitelist || []);
                              if (checked) current.add(f.name); else current.delete(f.name);
                              handleUpdateApiPolicy({ field_permissions: { ...(settings.__api_policy?.field_permissions || {}), write_whitelist: Array.from(current) } });
                            };

                            return (
                              <TableRow key={f.name}>
                                <TableCell className="py-2">
                                  <div className="font-medium text-sm">{f.label}</div>
                                  <div className="text-[10px] text-slate-400 font-mono">{f.name}</div>
                                </TableCell>
                                <TableCell className="text-center py-2">
                                  <input type="checkbox" className="rounded" checked={isReadable} onChange={e => toggleRead(e.target.checked)} />
                                </TableCell>
                                <TableCell className="text-center py-2">
                                  <input type="checkbox" className="rounded" checked={isWritable} onChange={e => toggleWrite(e.target.checked)} />
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'hooks' && (
            <div className="space-y-6">
              <div className="p-4 border rounded-lg bg-slate-50 shadow-sm flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-sm">启用通知钩子</h4>
                  <p className="text-xs text-slate-500">当有新数据通过公有API提交时，触发后续动作（依赖全局邮件服务配置）。</p>
                </div>
                <Switch
                  checked={settings.__notification_policy?.enabled || false}
                  onCheckedChange={(v) => handleUpdateNotificationPolicy({ enabled: v })}
                />
              </div>

              {settings.__notification_policy?.enabled && (
                <div className="p-4 border rounded-lg space-y-4">
                  <h4 className="font-semibold text-sm border-b pb-2">基础设置</h4>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold">邮件通知收件人 (多邮箱打逗号)</label>
                      <Input
                        placeholder="admin@example.com"
                        value={(settings.__notification_policy?.receiver_emails || []).join(', ')}
                        onChange={e => {
                          const emails = e.target.value.split(',').map(m => m.trim()).filter(Boolean);
                          handleUpdateNotificationPolicy({ receiver_emails: emails });
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold">发件人显示昵称</label>
                      <Input
                        placeholder="System Notifier"
                        value={settings.__notification_policy?.sender_name || ''}
                        onChange={e => handleUpdateNotificationPolicy({ sender_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold">邮件主题模板 (支持 {'{{'}变量{'}}'})</label>
                      <Input
                        placeholder="您有一条新的提交"
                        value={settings.__notification_policy?.mail_subject_template || ''}
                        onChange={e => handleUpdateNotificationPolicy({ mail_subject_template: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-blue-600">Webhook URL (选填, POST方法推送 JSON)</label>
                      <Input
                        placeholder="https://example.com/api/webhook"
                        value={settings.__notification_policy?.webhook_url || ''}
                        onChange={e => handleUpdateNotificationPolicy({ webhook_url: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold">邮件正文模板 (支持 HTML 和 {'{{'}变量{'}}'})</label>
                      <textarea
                        className="w-full min-h-[100px] text-sm border rounded-md p-2 font-mono"
                        placeholder="如果您留空，系统将自动生成汇总表格。"
                        value={settings.__notification_policy?.mail_body_template || ''}
                        onChange={e => handleUpdateNotificationPolicy({ mail_body_template: e.target.value })}
                      />
                    </div>
                    <div className="bg-slate-100/50 p-2 rounded border border-dashed">
                      <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase tracking-wider">可用变量提示 (点击复制)</label>
                      <div className="flex flex-wrap gap-1.5 overflow-hidden">
                        {fields.map((f: any) => (
                          <button
                            key={f.name}
                            type="button"
                            className="px-1.5 py-0.5 bg-white border rounded text-[10px] font-mono text-blue-600 hover:bg-blue-50 transition-colors"
                            title={f.label}
                            onClick={() => {
                              navigator.clipboard.writeText(`{{${f.name}}}`);
                              toast({ title: '已复制', description: `变量 {{${f.name}}} 已复制到剪贴板` });
                            }}
                          >
                            {`{{${f.name}}}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter className="mt-4 border-t pt-4">
          <Button variant="ghost" onClick={() => setOpen(false)}>取消</Button>
          <Button onClick={save} disabled={saving} className="bg-blue-600 text-white">
            {saving && <Loader2 className="animate-spin mr-2" size={14} />}
            保存配置
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const OptionEditor: React.FC<{ initialOptions: any[], onChange: (opts: any[]) => void }> = ({ initialOptions, onChange }) => {
  const [opts, setOpts] = useState<any[]>(initialOptions);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-12 gap-2 mb-2 font-medium text-xs text-slate-500">
        <div className="col-span-5">存储值 (Key)</div>
        <div className="col-span-6">显示文本 (Value)</div>
        <div className="col-span-1"></div>
      </div>
      {opts.map((opt, i) => (
        <div key={i} className="grid grid-cols-12 gap-2">
          <Input className="col-span-5 h-8 text-xs" value={opt.key} onChange={e => {
            const copy = [...opts]; copy[i].key = e.target.value; setOpts(copy); onChange(copy);
          }} placeholder="eg. active" />
          <Input className="col-span-6 h-8 text-xs" value={opt.value} onChange={e => {
            const copy = [...opts]; copy[i].value = e.target.value; setOpts(copy); onChange(copy);
          }} placeholder="eg. 激活状态" />
          <Button variant="ghost" className="col-span-1 h-8 text-red-500 p-0" onClick={() => {
            const copy = opts.filter((_, idx) => idx !== i); setOpts(copy); onChange(copy);
          }}><Trash2 size={14} /></Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="h-8 text-xs border-dashed w-full" onClick={() => {
        const copy = [...opts, { key: '', value: '' }]; setOpts(copy); onChange(copy);
      }}>
        <Plus size={14} className="mr-1" /> 追加选项行
      </Button>
    </div>
  );
};
