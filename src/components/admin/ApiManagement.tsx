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
  Link2,
  Code2,
  Copy,
  Check,
  ExternalLink,
  BookOpen,
  Settings2,
  Lock,
  Globe
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { buildTree, flattenTreeWithPrefix } from '../../lib/tree-utils';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/Table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '../ui/Dialog';
import { Badge } from '../ui/Badge';
import { useToast } from '../ui/Toaster';
import { Switch } from '../ui/Switch';

interface Collection {
  id: number;
  name: string;
  slug: string;
  modelId: number;
  modelName: string;
  description: string;
  icon: string;
  fieldConfig: Record<string, any>;
  parentId?: number | null;
  menuGroup?: string | null;
}

interface Model {
  id: number;
  name: string;
  slug: string;
  fieldsJson: string | any[];
}

export const ApiManagement: React.FC = () => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // 展开收缩状态
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());

  // 配置项相关
  const [configTarget, setConfigTarget] = useState<Collection | null>(null);
  const [docTarget, setDocTarget] = useState<Collection | null>(null);

  const { toast } = useToast();

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
      
      // 初始化展开
      const groups = new Set(cData.map((c: any) => c.menuGroup || '其它内容'));
      setExpandedGroups(groups);
      const nodesWithChildren = new Set(cData.filter((c: any) => cData.some((child: any) => child.parentId === c.id)).map((c: any) => c.id));
      setExpandedNodes(nodesWithChildren);
    } catch (e) {
      toast({ variant: 'destructive', title: '加载失败', description: '无法获取 API 数据' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleApi = async (c: Collection, enabled: boolean) => {
    const newPolicy = { ...(c.fieldConfig?.__api_policy || {}), enabled };
    try {
      const res = await fetch(`/api/v1/rbac/collections/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...c,
          fieldConfig: { ...(c.fieldConfig || {}), __api_policy: newPolicy }
        })
      });
      if (res.ok) {
        toast({ title: enabled ? 'API 已开启' : 'API 已关闭' });
        fetchData();
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: '更新失败', description: e.message });
    }
  };

  const handleBatchToggle = async (enabled: boolean) => {
    if (!confirm(`确定要${enabled ? '一键开启' : '一键关闭'}所有业务集合的公共 API 吗？`)) return;
    setSaving(true);
    try {
      // 串行执行以保证数据库稳定性，虽然 D1 支持并发，但此处安全第一
      for (const c of collections) {
        const currentPolicy = c.fieldConfig?.__api_policy || {};
        if (currentPolicy.enabled === enabled) continue;
        
        await fetch(`/api/v1/rbac/collections/${c.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...c,
            fieldConfig: { ...(c.fieldConfig || {}), __api_policy: { ...currentPolicy, enabled } }
          })
        });
      }
      toast({ title: '批量操作完成', description: enabled ? '所有 API 已开启' : '所有 API 已关闭' });
      fetchData();
    } catch (e: any) {
      toast({ variant: 'destructive', title: '批量操作部分失败', description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: '已复制', description: 'API 路径已复制到剪贴板' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Code2 className="text-blue-600" size={24} />
            API 开放治理 (Gateways)
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            统一监管所有的公共接口入口，配置 CORS、频率限制及字段可见权限。
          </p>
        </div>

        <div className="flex gap-2">
           <Button variant="outline" size="sm" onClick={() => handleBatchToggle(false)} disabled={saving} className="text-slate-500">
             一键全关
           </Button>
           <Button variant="outline" size="sm" onClick={() => handleBatchToggle(true)} disabled={saving} className="text-blue-600 border-blue-200 bg-blue-50">
             一键全开
           </Button>
        </div>
      </div>

      <Card className="border-slate-100 shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="pl-6 w-[280px]">业务集合</TableHead>
              <TableHead className="w-[100px]">状态</TableHead>
              <TableHead className="w-[150px]">允许的方法</TableHead>
              <TableHead>接口入口 (Relative)</TableHead>
              <TableHead className="text-right pr-6">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                 <TableCell colSpan={5} className="py-20 text-center"><Loader2 className="animate-spin inline-block text-blue-500" /></TableCell>
              </TableRow>
            ) : collections.length === 0 ? (
              <TableRow>
                 <TableCell colSpan={5} className="py-20 text-center text-slate-400">暂无业务集合</TableCell>
              </TableRow>
            ) : (
              (() => {
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
                      {/* 分组行 */}
                      <TableRow 
                        className="bg-slate-50/50 hover:bg-slate-100/50 cursor-pointer"
                        onClick={() => {
                          const next = new Set(expandedGroups);
                          if (next.has(groupName)) next.delete(groupName); else next.add(groupName);
                          setExpandedGroups(next);
                        }}
                      >
                        <TableCell colSpan={5} className="py-2.5 pl-6 font-semibold text-xs text-slate-500 uppercase tracking-wider">
                          <div className="flex items-center gap-2">
                             {isGroupExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                             <FolderOpen size={14} className="text-slate-400" />
                             {groupName}
                          </div>
                        </TableCell>
                      </TableRow>

                      {isGroupExpanded && flattenTreeWithPrefix(groupTree, 'name', ' ').map((c: any) => {
                         // 计算是否应该显示 (父节点展开)
                         let shouldShow = true;
                         let curr: any = c;
                         while (curr.parentId) {
                           if (!expandedNodes.has(curr.parentId)) { shouldShow = false; break; }
                           curr = groupItems.find(it => it.id === curr.parentId);
                           if (!curr) break;
                         }
                         if (!shouldShow) return null;

                         const apiPolicy = c.fieldConfig?.__api_policy || {};
                         const isEnabled = !!apiPolicy.enabled;
                         const methods = apiPolicy.allowed_methods || [];
                         const hasChildren = groupItems.some(it => it.parentId === c.id);
                         const isExpanded = expandedNodes.has(c.id);

                         return (
                          <TableRow key={c.id} className="group hover:bg-slate-50/30 transition-colors">
                            <TableCell className="pl-8 py-3.5 relative">
                              <div className="flex items-center gap-2">
                                {Array.from({ length: c.level }).map((_, i) => (
                                  <div key={i} className="w-5 border-r border-slate-200 h-10 -my-4 last:mr-1" />
                                ))}
                                {hasChildren && (
                                  <button onClick={(e) => { e.stopPropagation(); setExpandedNodes(prev => {
                                    const n = new Set(prev);
                                    if (n.has(c.id)) n.delete(c.id); else n.add(c.id);
                                    return n;
                                  })}} className="p-0.5 rounded hover:bg-slate-100">
                                    {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                  </button>
                                )}
                                <div className="flex flex-col min-w-0">
                                  <span className="font-medium text-sm text-slate-900 truncate">{c.name}</span>
                                  <span className="text-[10px] text-slate-400 font-mono truncate">{c.slug}</span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Switch 
                                checked={isEnabled} 
                                onCheckedChange={(v) => handleToggleApi(c, v)}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {methods.length === 0 && <span className="text-[10px] text-slate-300 italic">None</span>}
                                {methods.map((m: string) => (
                                  <Badge key={m} variant="secondary" className="text-[9px] px-1 h-4 bg-slate-100 text-slate-500 uppercase">
                                    {m}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              {isEnabled ? (
                                <div className="flex items-center gap-2 group/url">
                                  <code className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100 font-mono truncate max-w-[200px]">
                                    /api/v1/p/data/{c.slug}
                                  </code>
                                  <button 
                                    onClick={() => copyToClipboard(`/api/v1/p/data/${c.slug}`)}
                                    className="p-1 rounded hover:bg-blue-100 text-blue-400 opacity-0 group-hover/url:opacity-100 transition-opacity"
                                  >
                                    <Copy size={12} />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic flex items-center gap-1">
                                  <Lock size={10} /> 接口已关闭
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right pr-6">
                               <div className="flex justify-end gap-1">
                                 <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="查看文档" onClick={() => setDocTarget(c)}>
                                   <BookOpen size={16} className="text-slate-400 hover:text-blue-600" />
                                 </Button>
                                 <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="策略配置" onClick={() => setConfigTarget(c)}>
                                   <Settings2 size={16} className="text-slate-400 hover:text-blue-600" />
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

      {/* 策略配置弹窗 */}
      <ApiPolicyDialog 
        collection={configTarget} 
        collections={collections}
        models={models}
        onClose={() => setConfigTarget(null)}
        onSaved={() => { setConfigTarget(null); fetchData(); }}
      />

      {/* 文档预览弹窗 */}
      <ApiDocDialog 
        collection={docTarget}
        onClose={() => setDocTarget(null)}
      />
    </div>
  );
};

/**
 * API 策略配置弹窗
 */
const ApiPolicyDialog: React.FC<{
  collection: Collection | null;
  collections: Collection[];
  models: Model[];
  onClose: () => void;
  onSaved: () => void;
}> = ({ collection, collections, models, onClose, onSaved }) => {
  const [activeTab, setActiveTab] = useState<'api' | 'seo'>('api');
  const [settings, setSettings] = useState<{ policy: any; seo: any } | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (collection) {
      const policy = collection.fieldConfig?.__api_policy || { enabled: false, allowed_methods: [], security: {}, field_permissions: {} };
      const seo = collection.fieldConfig?.seo_settings || { sitemap_enabled: false, title_template: '', description_template: '', schema_type: 'Article' };
      setSettings({ policy, seo });
    }
  }, [collection]);

  if (!collection || !settings) return null;

  const currentModel = models.find(m => m.id === collection.modelId);
  const fields = currentModel ? (typeof currentModel.fieldsJson === 'string' ? JSON.parse(currentModel.fieldsJson) : currentModel.fieldsJson) : [];

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/rbac/collections/${collection.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...collection,
          fieldConfig: { 
            ...(collection.fieldConfig || {}), 
            __api_policy: settings.policy,
            seo_settings: settings.seo
          }
        })
      });
      if (res.ok) {
        toast({ title: '配置已更新' });
        onSaved();
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: '保存失败', description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const updatePolicy = (updates: any) => setSettings((prev: any) => ({ ...prev, policy: { ...prev.policy, ...updates } }));
  const updateSeo = (updates: any) => setSettings((prev: any) => ({ ...prev, seo: { ...prev.seo, ...updates } }));

  return (
    <Dialog open={!!collection} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">配置治理: {collection.name}</span>
            <div className="flex bg-slate-100 p-1 rounded-lg mr-8">
               <button 
                 onClick={() => setActiveTab('api')}
                 className={`px-3 py-1 text-xs rounded-md transition-all ${activeTab === 'api' ? 'bg-white shadow-sm text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-700'}`}
               >API 访问控制</button>
               <button 
                 onClick={() => setActiveTab('seo')}
                 className={`px-3 py-1 text-xs rounded-md transition-all ${activeTab === 'seo' ? 'bg-white shadow-sm text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-700'}`}
               >SEO 语义配置</button>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          {activeTab === 'api' ? (
            <div className="space-y-6">
              <div className="p-4 border rounded-lg bg-slate-50 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">启用公共访问</h4>
                  <p className="text-xs text-slate-500">此开关决定了外部资源是否可以无 Token 访问接口。</p>
                </div>
                <Switch checked={settings.policy.enabled} onCheckedChange={v => updatePolicy({ enabled: v })} />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b pb-1">访问限制</h4>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold">响应动词控制</label>
                    <div className="flex gap-4">
                      {['schema', 'data', 'submit'].map(m => (
                        <label key={m} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="rounded" 
                            checked={!!settings.policy.allowed_methods?.includes(m)}
                            onChange={e => {
                              const current = new Set(settings.policy.allowed_methods || []);
                              if (e.target.checked) current.add(m); else current.delete(m);
                              updatePolicy({ allowed_methods: Array.from(current) });
                            }}
                          />
                          {m.toUpperCase()}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold">CORS 域名白名单</label>
                    <Input 
                      placeholder="*, https://your-site.com" 
                      value={(settings.policy.security?.allowed_domains || []).join(', ')}
                      onChange={e => updatePolicy({ security: { ...(settings.policy.security || {}), allowed_domains: e.target.value.split(',').map(d => d.trim()).filter(Boolean) } })}
                    />
                  </div>
                  <div className="space-y-2">
                      <label className="text-xs font-semibold">频率限制 (次/分钟, 0为不限)</label>
                      <Input 
                        type="number"
                        value={settings.policy.security?.rate_limit_per_min || 0}
                        onChange={e => updatePolicy({ security: { ...(settings.policy.security || {}), rate_limit_per_min: parseInt(e.target.value) || 0 } })}
                      />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b pb-1">数据权限 (字段过滤)</h4>
                  <div className="max-h-[300px] overflow-y-auto border rounded divide-y bg-white">
                    {fields.map((f: any) => {
                      const isRead = !!settings.policy.field_permissions?.read_whitelist?.includes(f.name);
                      const isWrite = !!settings.policy.field_permissions?.write_whitelist?.includes(f.name);
                      return (
                        <div key={f.name} className="p-2 flex items-center justify-between hover:bg-slate-50 text-xs">
                          <div>
                            <div className="font-semibold text-slate-700">{f.label}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{f.name}</div>
                          </div>
                          <div className="flex gap-3">
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input type="checkbox" className="rounded" checked={isRead} onChange={e => {
                                const cur = new Set(settings.policy.field_permissions?.read_whitelist || []);
                                if (e.target.checked) cur.add(f.name); else cur.delete(f.name);
                                updatePolicy({ field_permissions: { ...(settings.policy.field_permissions || {}), read_whitelist: Array.from(cur) } });
                              }} />
                              Readable
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input type="checkbox" className="rounded" checked={isWrite} onChange={e => {
                                const cur = new Set(settings.policy.field_permissions?.write_whitelist || []);
                                if (e.target.checked) cur.add(f.name); else cur.delete(f.name);
                                updatePolicy({ field_permissions: { ...(settings.policy.field_permissions || {}), write_whitelist: Array.from(cur) } });
                              }} />
                              Writable
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
               <div className="p-4 border rounded-lg bg-indigo-50/50 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-indigo-900 flex items-center gap-2">
                    <Globe size={16} /> 允许搜索引擎索引 (Sitemap)
                  </h4>
                  <p className="text-xs text-indigo-600">开启后，此集合下所有“已发布”的记录将自动进入 /sitemap.xml。</p>
                </div>
                <Switch checked={settings.seo.sitemap_enabled} onCheckedChange={v => updateSeo({ sitemap_enabled: v })} />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                   <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b pb-1">结构化数据 (JSON-LD)</h4>
                   <div className="space-y-2">
                      <label className="text-xs font-semibold">Schema 类型</label>
                      <select 
                        className="w-full bg-white border rounded p-1.5 text-sm"
                        value={settings.seo.schema_type}
                        onChange={e => updateSeo({ schema_type: e.target.value })}
                      >
                        <option value="Article">Article (文章/通用内容)</option>
                        <option value="Product">Product (产品/商品)</option>
                        <option value="Organization">Organization (组织/公司)</option>
                      </select>
                      <p className="text-[10px] text-slate-400">系统将根据此类型自动拼装符合 Schema.org 标准的 JSON-LD 数据。</p>
                   </div>
                </div>

                <div className="space-y-4">
                   <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b pb-1">Meta 标签模板</h4>
                   <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold">SEO Title 模板</label>
                        <Input 
                          placeholder="{{name}} - {{site_name}}"
                          value={settings.seo.title_template}
                          onChange={e => updateSeo({ title_template: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold">SEO Description 模板</label>
                        <textarea 
                          className="w-full min-h-[80px] text-sm border rounded-md p-2 font-sans"
                          placeholder="留空则使用全局默认设置"
                          value={settings.seo.description_template}
                          onChange={e => updateSeo({ description_template: e.target.value })}
                        />
                      </div>
                   </div>
                </div>
              </div>

              <div className="bg-slate-100/50 p-2 rounded border border-dashed">
                <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase tracking-wider">可用变量</label>
                <div className="flex flex-wrap gap-1.5">
                  {fields.map((f: any) => (
                    <Badge key={f.name} variant="outline" className="text-[10px] font-mono bg-white">{"{{" + f.name + "}}"}</Badge>
                  ))}
                  <Badge variant="outline" className="text-[10px] font-mono bg-white">{"{{site_name}}"}</Badge>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-blue-600 text-white">
            {saving ? <Loader2 className="animate-spin mr-2" size={16} /> : <Save className="mr-2" size={16} />}
            保存 API 策略
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/**
 * API 文档参考弹窗
 */
const ApiDocDialog: React.FC<{
  collection: Collection | null;
  onClose: () => void;
}> = ({ collection, onClose }) => {
  if (!collection) return null;

  const endpoints = [
    { name: '获取字段模型 (SCHEMA)', method: 'GET', path: `/api/v1/p/schema/${collection.slug}`, desc: '获取此业务集合的字段展示定义（元数据）。' },
    { name: '拉取业务数据 (DATA)', method: 'GET', path: `/api/v1/p/data/${collection.slug}`, desc: '分页获取通过审核的公开数据列表。' },
    { name: '外部提交接口 (SUBMIT)', method: 'POST', path: `/api/v1/p/submit/${collection.slug}`, desc: '允许外部受控提交数据（如：留言板、在线报名）。' },
  ];

  return (
    <Dialog open={!!collection} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            API 开发文档: {collection.name}
          </DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-6">
          <div className="bg-slate-900 rounded-xl p-4 text-slate-300 font-mono text-xs space-y-2">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
               <Globe size={14} /> Base Endpoint
            </div>
             <div>{window.location.origin}/api/v1/p/...</div>
          </div>

          <div className="space-y-4">
            {endpoints.map(ep => (
              <div key={ep.path} className="border rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 border-b flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge className={ep.method === 'GET' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}>
                      {ep.method}
                    </Badge>
                    <span className="font-bold text-sm text-slate-700">{ep.name}</span>
                  </div>
                  <button onClick={() => {
                    navigator.clipboard.writeText(ep.path);
                  }} className="text-slate-400 hover:text-blue-600">
                    <Copy size={14} />
                  </button>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                     <code className="text-[11px] bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">{ep.path}</code>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{ep.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
             <h5 className="text-sm font-bold text-blue-900 mb-1 flex items-center gap-2">
               注意事项
             </h5>
             <ul className="text-xs text-blue-700 list-disc list-inside space-y-1">
               <li>公共 API 访问无需携带身份 Token。</li>
               <li>返回字段受“字段显隐与写入控制”策略约束。</li>
               <li>外部提交的数据默认进入“待审”状态，需在后台手动审核后生效。</li>
             </ul>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose} className="bg-slate-900 text-white">确定</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
