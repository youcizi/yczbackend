import React, { useState, useEffect } from 'react';
import { 
  Puzzle, 
  RefreshCcw, 
  AlertCircle, 
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
  Settings
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
import { AdvancedJSONEditor } from './AdvancedJSONEditor';
import { useToast } from '../ui/Toaster';

interface Plugin {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  isEnabled: boolean;
  config: any;
  updatedAt: string | number | null;
}

export const PluginManagement: React.FC = () => {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [editingPlugin, setEditingPlugin] = useState<Plugin | null>(null);
  const [editingConfig, setEditingConfig] = useState<any>({});
  const { toast } = useToast();

  const fetchPlugins = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/plugins');
      if (!res.ok) throw new Error('无法连接到服务器');
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

  const togglePlugin = async (id: number, currentStatus: boolean) => {
    setProcessingId(id);
    try {
      const res = await fetch(`/api/v1/plugins/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: !currentStatus })
      });

      if (!res.ok) throw new Error('更新失败');
      
      // 更新本地状态
      setPlugins(prev => prev.map(p => 
        p.id === id ? { ...p, isEnabled: !currentStatus } : p
      ));

      // 发送全局事件，通知侧边栏更新
      window.dispatchEvent(new CustomEvent('plugins-updated'));
    } catch (err: any) {
      toast({
        title: "操作失败",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const openConfig = (plugin: Plugin) => {
    setEditingPlugin(plugin);
    // 确保 config 是个对象
    setEditingConfig(plugin.config || {});
    setConfigModalOpen(true);
  };

  const saveConfig = async () => {
    if (!editingPlugin) return;
    setProcessingId(editingPlugin.id);
    try {
      const res = await fetch(`/api/v1/plugins/${editingPlugin.id}/config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: editingConfig })
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || '保存失败');
      }
      
      setPlugins(prev => prev.map(p => 
        p.id === editingPlugin.id ? { ...p, config: editingConfig } : p
      ));

      toast({
        title: "配置已更新",
        description: `插件 "${editingPlugin.name}" 的配置已成功保存。`,
      });
      setConfigModalOpen(false);
    } catch (err: any) {
      toast({
        title: "保存失败",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  if (loading && plugins.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <RefreshCcw className="w-8 h-8 text-blue-500 animate-spin" />
        <p className="text-slate-500 font-medium">正在拉取插件列表...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Puzzle className="text-blue-600" />
            插件管理中枢
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            在这里启用或禁用系统扩展模块。某些插件可能需要配置 Service Bindings 才能正常运行。
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchPlugins} className="gap-2">
          <RefreshCcw size={14} />
          刷新列表
        </Button>
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
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="w-[200px]">名称 / Slug</TableHead>
                <TableHead>功能描述</TableHead>
                <TableHead className="w-[120px]">状态</TableHead>
                <TableHead className="w-[100px] text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plugins.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center text-slate-400">
                    暂无已注册插件
                  </TableCell>
                </TableRow>
              ) : (
                plugins.map((plugin) => (
                  <TableRow key={plugin.id} className="group hover:bg-slate-50/50 transition-colors">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-700">{plugin.name}</span>
                        <code className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded mt-1 w-fit">
                          {plugin.slug}
                        </code>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <p className="text-sm text-slate-600 leading-relaxed line-clamp-3 whitespace-normal break-words">
                        {plugin.description || '暂无详细描述'}
                      </p>
                    </TableCell>
                    <TableCell>
                      {plugin.isEnabled ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1 font-medium">
                          <CheckCircle2 size={12} />
                          运行中
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-200 gap-1 font-medium">
                          <ShieldAlert size={12} />
                          已停用
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-blue-600 transition-colors"
                          onClick={() => openConfig(plugin)}
                          title="插件配置"
                        >
                          <Settings size={16} />
                        </Button>
                        <Switch 
                          checked={plugin.isEnabled}
                          disabled={processingId === plugin.id}
                          onCheckedChange={() => togglePlugin(plugin.id, plugin.isEnabled)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 items-start">
        <ExternalLink className="text-blue-500 shrink-0 mt-0.5" size={18} />
        <div className="text-xs text-blue-700 leading-relaxed">
          <p className="font-bold mb-1">开发者提示：</p>
          要在主系统中添加新插件，请在 D1 数据库的 <code>plugins</code> 表中通过 SQL 插入一条记录。
          系统会自动检测到新插件并在此处展示。对于 RPC 通道，请确保主系统的 Service Bindings 已正确定义。
        </div>
      </div>

      <Dialog open={configModalOpen} onOpenChange={setConfigModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="text-blue-600" size={18} />
              插件配置: {editingPlugin?.name}
            </DialogTitle>
            <DialogDescription>
              编辑该插件的低级 JSON 配置。不当的配置可能会导致插件运行异常。
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <AdvancedJSONEditor 
              value={editingConfig} 
              onChange={setEditingConfig} 
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigModalOpen(false)}>
              取消
            </Button>
            <Button 
              onClick={saveConfig} 
              disabled={processingId === editingPlugin?.id}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {processingId === editingPlugin?.id ? '正在保存...' : '保存配置'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
