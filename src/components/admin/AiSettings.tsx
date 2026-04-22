import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Switch } from '../ui/Switch';
import { Label } from '../ui/Label';
import { useToast } from '../ui/Toaster';
import { 
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell 
} from '../ui/Table';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from '../ui/Dialog';
import { 
  Save, RefreshCw, Layers, Plus, Trash2, Edit2,
  Settings2, Code2, Cpu, Image as ImageIcon,
  CheckCircle2, AlertCircle, Globe, Key
} from 'lucide-react';

interface Model {
  id: string;
  name: string;
  type: 'text' | 'image';
}

interface Provider {
  id: string;
  name: string;
  type: 'workers-ai' | 'openai' | 'custom';
  apiKey?: string;
  baseUrl?: string;
  gatewayId: string;
  models: Model[];
}

interface AiConfig {
  enabled: boolean;
  providers: Provider[];
  assignments: {
    text: { providerId: string; modelId: string };
    image: { providerId: string; modelId: string };
    frontend: string;
    backend: string;
  };
}

export const AiSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'providers' | 'assignments' | 'docs'>('providers');
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<AiConfig>({
    enabled: true,
    providers: [],
    assignments: {
      text: { providerId: '', modelId: '' },
      image: { providerId: '', modelId: '' },
      frontend: '',
      backend: ''
    }
  });
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    fetch('/api/v1/settings/ai_config')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.value) {
          const parsed = JSON.parse(data.value);
          if (!parsed.providers) {
            parsed.providers = [];
            parsed.assignments = { text: {}, image: {}, frontend: '', backend: '' };
          }
          setConfig(parsed);
        }
      })
      .catch(() => {});
  }, []);

  const handleSave = async (newConfig?: AiConfig) => {
    const targetConfig = newConfig || config;
    setLoading(true);
    try {
      const response = await fetch('/api/v1/settings/ai_config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: JSON.stringify(targetConfig) })
      });
      if (response.ok) toast({ title: '保存成功', description: '配置已更新。' });
      if (newConfig) setConfig(newConfig);
    } catch (err) {
      toast({ title: '错误', description: '保存失败', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const openProviderModal = (provider?: Provider) => {
    setEditingProvider(provider || {
      id: crypto.randomUUID(),
      name: '',
      type: 'workers-ai',
      gatewayId: '',
      models: []
    });
    setIsModalOpen(true);
  };

  const saveProvider = () => {
    if (!editingProvider) return;
    if (!editingProvider.name) {
      toast({ title: '校验失败', description: '提供商名称不能为空', variant: 'destructive' });
      return;
    }

    const updatedProviders = config.providers.some(p => p.id === editingProvider.id)
      ? config.providers.map(p => p.id === editingProvider.id ? editingProvider : p)
      : [...config.providers, editingProvider];

    const newConfig = { ...config, providers: updatedProviders };
    handleSave(newConfig);
    setIsModalOpen(false);
  };

  const deleteProvider = (id: string) => {
    if (!confirm('确定要删除该提供商吗？相关模型分配也将失效。')) return;
    const newConfig = { ...config, providers: config.providers.filter(p => p.id !== id) };
    handleSave(newConfig);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight">AI 矩阵中心</h2>
          <p className="text-slate-500 mt-1">管理多源模型负载均衡与角色分配矩阵。</p>
        </div>
        <div className="flex gap-3">
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
             {(['providers', 'assignments', 'docs'] as const).map(tab => (
               <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === tab ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'
                }`}
               >
                 {tab === 'providers' ? '提供商管理' : tab === 'assignments' ? '模型分配' : '开发者文档'}
               </button>
             ))}
          </div>
          <Button onClick={() => handleSave()} disabled={loading} variant="outline" className="rounded-xl border-blue-200 text-blue-600 hover:bg-blue-50">
            {loading ? <RefreshCw className="animate-spin mr-2" size={16} /> : <Save className="mr-2" size={16} />}
            全局同步
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between p-4 bg-slate-900 text-white rounded-2xl shadow-xl shadow-slate-200 dark:shadow-none">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <Cpu size={20} />
          </div>
          <div>
            <h4 className="font-bold flex items-center gap-2">
              Cloudflare Runtime 注入
              <Badge variant="success">已连接</Badge>
            </h4>
            <p className="text-xs text-slate-400">系统将自动从 wrangler.toml 读取 CF_ACCOUNT_ID 进行网关自动化操作</p>
          </div>
        </div>
        <Switch checked={config.enabled} onCheckedChange={val => handleSave({ ...config, enabled: val })} />
      </div>

      {activeTab === 'providers' && (
        <Card className="border-none shadow-sm overflow-hidden rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between bg-white dark:bg-slate-900 border-b">
            <CardTitle className="text-lg">已挂载的 API 提供商</CardTitle>
            <Button onClick={() => openProviderModal()} size="sm" className="gap-2 rounded-lg">
              <Plus size={16} /> 新增供应商
            </Button>
          </CardHeader>
          <CardContent className="p-0">
             <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>名称</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>网关 / 地址</TableHead>
                    <TableHead>模型数量</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {config.providers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32 text-center text-slate-400">暂无数据，请点击上方按钮添加。</TableCell>
                    </TableRow>
                  ) : config.providers.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>
                         <Badge variant={p.type === 'workers-ai' ? 'default' : p.type === 'openai' ? 'outline' : 'secondary'}>
                           {p.type.toUpperCase()}
                         </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs text-slate-500">
                        {p.type === 'custom' ? p.baseUrl : p.gatewayId}
                      </TableCell>
                      <TableCell>{p.models.length}</TableCell>
                      <TableCell className="text-right flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openProviderModal(p)}><Edit2 size={14} /></Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteProvider(p.id)} className="text-red-500"><Trash2 size={14} /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
             </Table>
          </CardContent>
        </Card>
      )}

      {activeTab === 'assignments' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 scale-in-center">
           {/* ... Assignments Implementation ... */}
           {/* (保持之前的逻辑，但增强下拉框显示模型名称) */}
           <AssignmentCard config={config} setConfig={setConfig} />
        </div>
      )}

      {activeTab === 'docs' && <DocsView />}

      {/* Provider Details Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl sm:rounded-3xl">
          <DialogHeader>
            <DialogTitle>{editingProvider?.name ? `编辑: ${editingProvider.name}` : '添加新提供商'}</DialogTitle>
          </DialogHeader>
          
          {editingProvider && (
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>供应商名称</Label>
                  <Input 
                    placeholder="例如: 阿里云 Qwen" 
                    value={editingProvider.name} 
                    onChange={e => setEditingProvider({...editingProvider, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>连接类型</Label>
                  <select 
                    className="w-full h-10 rounded-xl border px-3 text-sm focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                    value={editingProvider.type}
                    onChange={e => setEditingProvider({...editingProvider, type: e.target.value as any})}
                  >
                    <option value="workers-ai">Workers AI (CF 原生)</option>
                    <option value="openai">OpenAI (官方/中转)</option>
                    <option value="custom">Custom (通用模式)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/20 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 font-bold text-xs text-blue-600 uppercase tracking-wider">
                      <Globe size={14} /> 连接链路配置
                    </div>
                    {editingProvider.type !== 'workers-ai' && (
                      <div className="flex items-center gap-2 bg-slate-200 dark:bg-slate-700 p-1 rounded-lg">
                        <button 
                          onClick={() => setEditingProvider({...editingProvider, routingMode: 'standard'})}
                          className={`px-2 py-0.5 text-[10px] rounded ${(!editingProvider.routingMode || editingProvider.routingMode === 'standard') ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}
                        >标准模式</button>
                        <button 
                          onClick={() => setEditingProvider({...editingProvider, routingMode: 'manual'})}
                          className={`px-2 py-0.5 text-[10px] rounded ${(editingProvider.routingMode === 'manual') ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}
                        >原生地址</button>
                      </div>
                    )}
                  </div>
                  
                  {editingProvider.type !== 'workers-ai' && (
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">
                        {editingProvider.routingMode === 'manual' ? '最终请求地址 (Full Endpoint)' : 'API 基地址 (Base URL)'}
                      </Label>
                      <Input 
                        placeholder={editingProvider.routingMode === 'manual' ? "https://ai.gitee.com/v1/chat/completions" : "https://ai.gitee.com/v1"} 
                        value={editingProvider.baseUrl || ''}
                        onChange={e => setEditingProvider({...editingProvider, baseUrl: e.target.value})}
                      />
                      <p className="text-[10px] text-slate-400 leading-tight">
                        {editingProvider.routingMode === 'manual' 
                          ? '⚠️ 系统将直接、逐字请求此完整地址，不进行任何路径拼接。' 
                          : '系统将基于此地址自动拼接 /chat/completions (兼容 v1)。'}
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Cloudflare AI Gateway ID (对该链路进行审计/中转)</Label>
                    <Input 
                      placeholder="选填 ID" 
                      value={editingProvider.gatewayId || ''}
                      onChange={e => setEditingProvider({...editingProvider, gatewayId: e.target.value})}
                    />
                  </div>

                  {(editingProvider.type === 'openai' || editingProvider.type === 'custom') && (
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">接口密钥 (API Key)</Label>
                      <Input 
                        type="password" 
                        placeholder="Bearer Token..." 
                        value={editingProvider.apiKey || ''} 
                        onChange={e => setEditingProvider({...editingProvider, apiKey: e.target.value})}
                      />
                    </div>
                  )}

                  {editingProvider.baseUrl && (
                    <div className="mt-4 p-2 bg-white dark:bg-slate-900 rounded-lg border border-dashed text-[10px] text-slate-500 font-mono break-all animate-in fade-in zoom-in-95 duration-200">
                      <span className="text-blue-500 font-bold">最终请求路径预览:</span><br/>
                      {editingProvider.routingMode === 'manual' 
                        ? editingProvider.baseUrl 
                        : `${editingProvider.baseUrl.replace(/\/+$/, '')}${editingProvider.baseUrl.includes('/v1') ? '/chat/completions' : '/v1/chat/completions'}`}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between border-t pt-4">
                  <Label className="font-bold">模型列表矩阵</Label>
                  <Button variant="outline" size="sm" onClick={() => {
                    setEditingProvider({
                      ...editingProvider,
                      models: [...editingProvider.models, { id: '', name: '', type: 'text' }]
                    });
                  }} className="h-8 rounded-lg gap-1">
                    <Plus size={14} /> 快捷添加
                  </Button>
                </div>
                
                <div className="max-h-[200px] overflow-y-auto space-y-2 pr-2">
                  {editingProvider.models.map((m, i) => (
                    <div key={i} className="flex gap-2 items-center bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl group transition-all">
                      <Input 
                        placeholder="模型 ID" 
                        className="h-8 text-xs flex-1 bg-white" 
                        value={m.id} 
                        onChange={e => {
                          const models = [...editingProvider.models];
                          models[i].id = e.target.value;
                          setEditingProvider({...editingProvider, models});
                        }}
                      />
                      <Input 
                        placeholder="显示名称" 
                        className="h-8 text-xs flex-1 bg-white" 
                        value={m.name} 
                        onChange={e => {
                          const models = [...editingProvider.models];
                          models[i].name = e.target.value;
                          setEditingProvider({...editingProvider, models});
                        }}
                      />
                      <select 
                        className="h-8 text-[10px] rounded-lg border px-1 bg-white"
                        value={m.type}
                        onChange={e => {
                          const models = [...editingProvider.models];
                          models[i].type = e.target.value as any;
                          setEditingProvider({...editingProvider, models});
                        }}
                      >
                        <option value="text">文本驱动</option>
                        <option value="image">生成绘图</option>
                      </select>
                      <Button variant="ghost" size="sm" className="h-8 w-8 text-red-400 group-hover:text-red-500" onClick={() => {
                        setEditingProvider({
                          ...editingProvider,
                          models: editingProvider.models.filter((_, idx) => idx !== i)
                        });
                      }}>
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
             <Button variant="ghost" onClick={() => setIsModalOpen(false)}>取消</Button>
             <Button onClick={saveProvider} className="px-8 shadow-lg shadow-blue-500/20">确认部署</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// 辅助组件：Badge
const Badge = ({ children, variant = 'default' }: { children: React.ReactNode, variant?: 'default' | 'success' | 'outline' | 'secondary' }) => {
  const styles = {
    default: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    outline: 'border border-slate-200 text-slate-600',
    secondary: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
  };
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${styles[variant]}`}>{children}</span>;
}

// 辅助组件：配置卡片
const AssignmentCard = ({ config, setConfig }: { config: AiConfig, setConfig: any }) => {
  return (
    <>
      <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="bg-white border-b"><CardTitle className="text-lg flex items-center gap-2"><Cpu size={18} className="text-blue-500" /> 核心模型矩阵分配</CardTitle></CardHeader>
        <CardContent className="space-y-6 mt-6">
           <div className="space-y-4">
              <Label className="text-sm font-bold">默认文本引擎</Label>
              <div className="grid grid-cols-2 gap-3">
                <select 
                  className="h-11 rounded-xl border px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={config.assignments.text?.providerId}
                  onChange={e => setConfig({ ...config, assignments: { ...config.assignments, text: { ...config.assignments.text, providerId: e.target.value, modelId: '' } } })}
                >
                  <option value="">选择提供商</option>
                  {config.providers.map(pr => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
                </select>
                <select 
                  className="h-11 rounded-xl border px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={config.assignments.text?.modelId}
                  onChange={e => setConfig({ ...config, assignments: { ...config.assignments, text: { ...config.assignments.text, modelId: e.target.value } } })}
                >
                  <option value="">选择具体模型</option>
                  {config.providers.find(pr => pr.id === config.assignments.text?.providerId)?.models.filter(m => m.type === 'text').map(m => (
                    <option key={m.id} value={m.id}>{m.name || m.id}</option>
                  ))}
                </select>
              </div>
           </div>

           <div className="space-y-4">
              <Label className="text-sm font-bold">默认生成绘图引擎</Label>
              <div className="grid grid-cols-2 gap-3">
                <select 
                  className="h-11 rounded-xl border px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={config.assignments.image?.providerId}
                  onChange={e => setConfig({ ...config, assignments: { ...config.assignments, image: { ...config.assignments.image, providerId: e.target.value, modelId: '' } } })}
                >
                  <option value="">选择提供商</option>
                  {config.providers.map(pr => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
                </select>
                <select 
                  className="h-11 rounded-xl border px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={config.assignments.image?.modelId}
                  onChange={e => setConfig({ ...config, assignments: { ...config.assignments, image: { ...config.assignments.image, modelId: e.target.value } } })}
                >
                  <option value="">选择分发模型</option>
                  {config.providers.find(pr => pr.id === config.assignments.image?.providerId)?.models.filter(m => m.type === 'image').map(m => (
                    <option key={m.id} value={m.id}>{m.name || m.id}</option>
                  ))}
                </select>
              </div>
           </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="bg-white border-b"><CardTitle className="text-lg flex items-center gap-2"><Settings2 size={18} className="text-indigo-500" /> 场景入口映射</CardTitle></CardHeader>
        <CardContent className="space-y-6 mt-6">
          <div className="space-y-2">
            <Label className="text-sm font-bold">前端用户端 (Public Bot)</Label>
            <select 
              className="w-full h-11 rounded-xl border px-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              value={config.assignments.frontend}
              onChange={e => setConfig({ ...config, assignments: { ...config.assignments, frontend: e.target.value } })}
            >
              <option value="">选择生效供应商</option>
              {config.providers.map(pr => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-bold">后端管理端 (Admin Assistant)</Label>
            <select 
              className="w-full h-11 rounded-xl border px-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              value={config.assignments.backend}
              onChange={e => setConfig({ ...config, assignments: { ...config.assignments, backend: e.target.value } })}
            >
              <option value="">选择执行供应商</option>
              {config.providers.map(pr => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

const DocsView = () => (
  <Card className="border-none shadow-sm overflow-hidden rounded-2xl">
    <CardHeader className="bg-slate-50 dark:bg-slate-800/20 border-b"><CardTitle className="text-lg flex items-center gap-2"><Code2 size={18} className="text-green-500" /> API 调用指南</CardTitle></CardHeader>
    <CardContent className="p-0">
       <div className="p-6 space-y-6">
          <div>
            <h4 className="flex items-center gap-2 font-bold text-sm mb-3 text-slate-700">
              <CheckCircle2 size={16} className="text-green-500" /> 用户侧接口 (Public Stream)
            </h4>
            <pre className="bg-slate-900 text-slate-300 p-5 rounded-2xl text-[11px] overflow-x-auto leading-relaxed border border-slate-800">
{`// 请求 /api/v1/p/ai/chat
fetch('/api/v1/p/ai/chat', {
  method: 'POST',
  body: JSON.stringify({
    messages: [{ role: 'user', content: 'hello' }],
    role: 'frontend' // 后端将自动根据“场景映射”选择模型
  })
});`}
            </pre>
          </div>
          <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-2xl flex gap-3 text-amber-800 dark:text-amber-400">
            <AlertCircle size={18} className="shrink-0" />
            <p className="text-xs leading-relaxed">
              <strong>提示：</strong> 自定义驱动同样支持流式输出。只要供应商符合 OpenAI 基准协议，系统将自动透传所有数据块并在前端流式渲染。
            </p>
          </div>
       </div>
    </CardContent>
  </Card>
);
