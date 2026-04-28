import React, { useState, useEffect } from 'react';
import { 
  Puzzle, 
  RefreshCcw, 
  AlertCircle, 
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
  Settings,
  PlusCircle,
  Trash2,
  Terminal,
  Code
} from 'lucide-react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../ui/Table';
import { Switch } from '../ui/Switch';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '../ui/Dialog';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { AdvancedJSONEditor } from './AdvancedJSONEditor';
import { useToast } from '../ui/Toaster';

interface PluginMetadata {
  slug: string;
  name: string;
  description: string;
  version: string;
  author: string;
  isInstalled: boolean;
  isEnabled: boolean;
  dbId?: number;
  config?: any;
  isCodePresent: boolean;
}

export const PluginManagement: React.FC = () => {
  const [plugins, setPlugins] = useState<PluginMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingSlug, setProcessingSlug] = useState<string | null>(null);
  
  // 注册新插件 Modal 状态
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [newPluginData, setNewPluginData] = useState({ slug: '', name: '', description: '' });

  // 配置 Modal 状态
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [editingPlugin, setEditingPlugin] = useState<PluginMetadata | null>(null);
  const [editingConfig, setEditingConfig] = useState<any>({});
  const [editingName, setEditingName] = useState('');
  const [editingDescription, setEditingDescription] = useState('');
  
  const { toast } = useToast();

  const fetchPlugins = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/plugins/admin/available');
      if (!res.ok) throw new Error('无法连接至插件管理服务');
      const { data } = await res.json();
      setPlugins(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlugins();
  }, []);

  const handleRegister = async () => {
    if (!newPluginData.slug) return toast({ title: "必填项缺失", description: "Slug 是识别插件的唯一标识", variant: "destructive" });
    
    setProcessingSlug('registering');
    try {
      const res = await fetch('/api/v1/plugins/admin/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPluginData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '登记失败');
      
      toast({ title: "登记成功", description: `插件 ${newPluginData.slug} 已成功录入 Drizzle 系统。` });
      setRegisterModalOpen(false);
      setNewPluginData({ slug: '', name: '', description: '' });
      await fetchPlugins();
    } catch (err: any) {
      toast({ title: "登记错误", description: err.message, variant: "destructive" });
    } finally {
      setProcessingSlug(null);
    }
  };

  const handleUninstall = async (slug: string) => {
    if (!confirm(`确定要移除插件记录 "${slug}" 吗？这不会删除物理代码，但会移除所有配置与权限映射。`)) return;
    
    setProcessingSlug(slug);
    try {
      const res = await fetch('/api/v1/plugins/admin/uninstall', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug })
      });
      if (!res.ok) throw new Error('卸载失败');
      
      toast({ title: "已移除", description: "插件记录已从数据库物理删除。" });
      await fetchPlugins();
      window.dispatchEvent(new CustomEvent('plugins-updated'));
    } catch (err: any) {
      toast({ title: "操作错误", description: err.message, variant: "destructive" });
    } finally {
      setProcessingSlug(null);
    }
  };

  const togglePlugin = async (slug: string, currentStatus: boolean) => {
    setProcessingSlug(slug);
    try {
      const res = await fetch('/api/v1/plugins/admin/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, enabled: !currentStatus })
      });

      if (!res.ok) throw new Error('状态切换失败');
      
      const nextStatus = !currentStatus;
      
      // 乐观更新 UI
      setPlugins(prev => prev.map(p => 
        p.slug === slug ? { ...p, isEnabled: nextStatus } : p
      ));

      toast({ 
        title: nextStatus ? "插件已激活" : "插件已禁用", 
        description: nextStatus ? "权限已自动注入，侧边栏菜单已同步。" : "相关功能入口已关闭。"
      });

      // 发送全局事件，让 Sidebar 等组件刷新
      window.dispatchEvent(new CustomEvent('plugins-updated'));
      
      // 关键：重新拉取最新数据库状态，确保 UI 逻辑与后端完全对齐
      await fetchPlugins();
    } catch (err: any) {
      toast({ title: "切换失败", description: err.message, variant: "destructive" });
      // 失败时回滚或刷新
      await fetchPlugins();
    } finally {
      setProcessingSlug(null);
    }
  };

  const openConfig = (plugin: PluginMetadata) => {
    setEditingPlugin(plugin);
    setEditingConfig(plugin.config || {});
    setEditingName(plugin.name || '');
    setEditingDescription(plugin.description || '');
    setConfigModalOpen(true);
  };

  const saveConfig = async () => {
    if (!editingPlugin) return;
    setProcessingSlug(editingPlugin.slug);
    try {
      const res = await fetch('/api/v1/plugins/admin/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          slug: editingPlugin.slug, 
          name: editingName,
          description: editingDescription,
          config: editingConfig 
        })
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || '保存失败');
      }
      
      toast({ title: "配置热更新成功", description: "名称、描述及 JSON 参数已同步应用。" });
      setConfigModalOpen(false);
      await fetchPlugins();
    } catch (err: any) {
      toast({ title: "保存失败", description: err.message, variant: "destructive" });
    } finally {
      setProcessingSlug(null);
    }
  };

  if (loading && plugins.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <RefreshCcw className="w-8 h-8 text-blue-500 animate-spin" />
        <p className="text-slate-500 font-medium tracking-tight">正在检索插件资产树...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Puzzle className="text-blue-600" />
            资产管理与生命周期
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            将物理代码在 D1 数据库中登记，开启路由代理、动态 UI 联动与 RBAC 权限系统。
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchPlugins} className="gap-2">
            <RefreshCcw size={14} />
            刷新状态
          </Button>
          <Button size="sm" onClick={() => setRegisterModalOpen(true)} className="gap-2 bg-blue-600 hover:bg-blue-700">
            <PlusCircle size={14} />
            手动登记插件
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6 flex items-center gap-3 text-red-700">
            <AlertCircle size={20} />
            <p>{error}</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50/50 text-[11px] uppercase tracking-wider font-bold">
              <TableRow>
                <TableHead className="w-[220px]">插件身份 (Slug)</TableHead>
                <TableHead>功能描述与声明</TableHead>
                <TableHead className="w-[120px]">运行时状态</TableHead>
                <TableHead className="w-[120px] text-right">资产控制</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plugins.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-40 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Code size={24} className="opacity-20" />
                      <p>当前无已登记资产数据。请点击右上方按钮开始登记。</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                plugins.map((plugin) => (
                  <TableRow key={plugin.slug} className="group hover:bg-slate-50/50 transition-colors">
                    <TableCell>
                      <div className="flex flex-col">
                        {plugin.isEnabled ? (
                          <a 
                            href={`/admin/plugins/${plugin.slug}`}
                            className="font-bold text-slate-800 hover:text-blue-600 hover:underline transition-all decoration-blue-300 underline-offset-4"
                          >
                            {plugin.name}
                          </a>
                        ) : (
                          <span className="font-bold text-slate-400 cursor-not-allowed italic">
                            {plugin.name} (已挂起)
                          </span>
                        )}
                        <div className="flex items-center gap-2 mt-1.5">
                          <code className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono border border-slate-200">
                            {plugin.slug}
                          </code>
                          {!plugin.isCodePresent && (
                             <Badge variant="outline" className="text-[9px] bg-red-50 text-red-600 border-red-100 py-0 px-1 opacity-80">
                               代码未就绪
                             </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <p className="text-[13px] text-slate-600 leading-relaxed line-clamp-2">
                        {plugin.description || '暂无元数据说明'}
                      </p>
                      <div className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-3">
                         <span className="flex items-center gap-1 font-medium"><Terminal size={10} /> v{plugin.version}</span>
                         <span className="opacity-60">作者: {plugin.author}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {plugin.isEnabled ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1 font-medium px-2">
                          <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                          已运行
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-200 gap-1 font-medium px-2">
                          <ShieldAlert size={12} />
                          已冻结
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-blue-600 transition-colors"
                          onClick={() => openConfig(plugin)}
                          title="高阶运行时配置"
                        >
                          <Settings size={16} />
                        </Button>
                        
                        <Switch 
                          checked={plugin.isEnabled}
                          disabled={processingSlug === plugin.slug || !plugin.isCodePresent}
                          onCheckedChange={() => togglePlugin(plugin.slug, plugin.isEnabled)}
                        />

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-300 hover:text-red-500 transition-colors ml-1"
                          onClick={() => handleUninstall(plugin.slug)}
                          disabled={processingSlug === plugin.slug}
                          title="从数据库中移除登记记录"
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
      )}

      {/* 说明区域 */}
      <div className="bg-slate-100/80 border border-slate-200 rounded-2xl p-6 flex gap-5 items-start">
        <Terminal className="text-blue-500 shrink-0 mt-0.5" size={24} />
        <div className="text-xs text-slate-600 leading-relaxed space-y-3">
          <p className="font-bold text-slate-800 text-sm">💡 资产管理中心 - 开发者与管理员指南</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <p className="font-semibold text-slate-700 flex items-center gap-1.5 underline decoration-blue-200 underline-offset-4">
                <Code size={14}/> 什么是高级初始化配置 (JSON)？
              </p>
              <p>
                这相当于插件的 <b>“环境变量”</b>。开发者可以在此定义插件运行所需的外部参数
                （如 API 密钥、资源重定向路径等），实现 <b>“代码不动，配置先行”</b>。系统会在插件启动时自动注入这些配置。
              </p>
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-slate-700 flex items-center gap-1.5 underline decoration-blue-200 underline-offset-4">
                <Puzzle size={14}/> 插件集成工作流
              </p>
              <p>
                1. 在 <code>src/plugins/</code> 创建子目录。<br/>
                2. 遵循目录契约 (需具备 <code>manifest.ts</code>, <code>index.ts</code>, <code>admin/index.tsx</code>)。<br/>
                3. 重启 dev 环境触发自动扫描，系统将生成代码桥接文件。<br/>
                4. 在此页面点击<b>手动登记</b>并激活，开启路由代理与 RBAC 权限联动。
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 登记插件 Modal */}
      <Dialog open={registerModalOpen} onOpenChange={setRegisterModalOpen}>
        <DialogContent className="max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden p-0">
          <DialogHeader className="p-6 bg-slate-50/50 border-b border-slate-100">
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <PlusCircle className="text-blue-600" size={18} />
              手动登记新资产
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              请输入物理代码文件夹对应的 Slug 标识。系统将尝试从代码中提取 Manifest 信息。
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="slug" className="text-xs font-bold uppercase text-slate-500">Slug 标识 (必填)</Label>
                <Input 
                  id="slug" 
                  placeholder="例如: membership" 
                  value={newPluginData.slug}
                  onChange={e => setNewPluginData(prev => ({ ...prev, slug: e.target.value }))}
                  className="font-mono bg-slate-50 border-slate-200"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-bold uppercase text-slate-500">显示名称 (推荐)</Label>
                <Input 
                  id="name" 
                  placeholder="会员管理系统" 
                  value={newPluginData.name}
                  onChange={e => setNewPluginData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="desc" className="text-xs font-bold uppercase text-slate-500">功能简述</Label>
              <Input 
                id="desc" 
                placeholder="基于 Drizzle 的高级会员插件..." 
                value={newPluginData.description}
                onChange={e => setNewPluginData(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="space-y-2 border-t border-slate-100 pt-4">
              <Label className="text-xs font-bold uppercase text-slate-500 flex items-center gap-2">
                <Settings size={14} className="text-blue-500" />
                高级初始化配置 (JSON)
              </Label>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <AdvancedJSONEditor 
                  value={newPluginData.config || {}} 
                  onChange={(val) => setNewPluginData(prev => ({ ...prev, config: val }))} 
                />
              </div>
              <p className="text-[10px] text-slate-400">登记成功后，这些参数将作为插件的初始运行时配置应用。</p>
            </div>
          </div>

          <DialogFooter className="bg-slate-50 p-4 border-t border-slate-100 mt-0">
            <Button variant="ghost" onClick={() => setRegisterModalOpen(false)}>取消操作</Button>
            <Button 
                onClick={handleRegister} 
                disabled={processingSlug === 'registering'}
                className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]"
            >
              {processingSlug === 'registering' ? '正在连接资产...' : '立即激活资产'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 配置 Modal */}
      <Dialog open={configModalOpen} onOpenChange={setConfigModalOpen}>
        <DialogContent className="max-w-2xl bg-white rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <Settings className="text-blue-600" size={18} />
              高级运行时配置: {editingPlugin?.name}
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-xs">
              修改插件的运行时 JSON 环境参数。保存后，相关代理转发将立即应用新参数。
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <div className="space-y-2">
                 <Label className="text-[11px] font-bold uppercase text-slate-400">插件显示名称</Label>
                 <Input 
                   value={editingName} 
                   onChange={e => setEditingName(e.target.value)}
                   className="bg-slate-50 border-slate-200 focus:ring-blue-500" 
                 />
               </div>
               <div className="space-y-2">
                 <Label className="text-[11px] font-bold uppercase text-slate-400">资源定位 Slug</Label>
                 <Input value={editingPlugin?.slug} disabled className="bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed font-mono" />
               </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] font-bold uppercase text-slate-400">功能简述</Label>
              <Input 
                 value={editingDescription} 
                 onChange={e => setEditingDescription(e.target.value)}
                 className="bg-slate-50 border-slate-200 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2 border-t border-slate-100 pt-4">
              <Label className="text-[11px] font-bold uppercase text-slate-400 flex items-center gap-1.5">
                <Code size={14} className="text-blue-500" />
                运行时环境变量 (JSON Params)
              </Label>
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-inner">
                <AdvancedJSONEditor 
                  value={editingConfig} 
                  onChange={setEditingConfig} 
                />
              </div>
            </div>
          </div>

          <DialogFooter className="bg-slate-50 -mx-6 -mb-6 p-4 mt-4 rounded-b-2xl border-t border-slate-100">
            <Button variant="ghost" onClick={() => setConfigModalOpen(false)} className="text-slate-500">
              关闭窗口
            </Button>
            <Button 
              onClick={saveConfig} 
              disabled={processingSlug === editingPlugin?.slug}
              className="bg-blue-600 hover:bg-blue-700 text-white min-w-[100px]"
            >
              持久化配置
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
