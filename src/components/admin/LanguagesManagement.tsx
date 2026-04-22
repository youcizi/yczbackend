import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Globe, Search, Loader2, Languages, Check, X, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../ui/Table';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '../ui/Dialog';
import { Badge } from '../ui/Badge';
import { useToast } from '../ui/Toaster';
import { Skeleton } from '../ui/Skeleton';
import { Label } from '../ui/Label';
import { cn } from '../../lib/utils';

interface Language {
  code: string;
  name: string;
  isDefault: boolean;
  status: 'active' | 'inactive';
}

export const LanguagesManagement: React.FC = () => {
  const [languages, setLanguages] = useState<Language[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLang, setEditingLang] = useState<Language | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingCode, setDeletingCode] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/rbac/languages');
      const data = await res.json();
      if (Array.isArray(data)) setLanguages(data);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: "无法获取语种数据，请检查网络连接。"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLang) return;
    setSaving(true);
    
    try {
      const isNew = !languages.some(l => l.code === editingLang.code);
      const method = isNew ? 'POST' : 'PUT';
      // 注意：根据 rbac-routes.ts 的实现，PUT 用于更新
      const res = await fetch('/api/v1/rbac/languages', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingLang)
      });

      if (!res.ok) throw new Error(isNew ? '创建失败' : '更新失败');

      toast({ title: "成功", description: isNew ? "语种已添加" : "语种配置已保存" });
      setIsDialogOpen(false);
      fetchData();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "保存失败",
        description: err.message
      });
    } finally {
      setSaving(false);
    }
  };

  const setAsDefault = async (code: string) => {
    try {
      const res = await fetch(`/api/v1/rbac/languages/default/${code}`, {
        method: 'PATCH'
      });
      if (!res.ok) throw new Error('设置失败');
      toast({ title: "成功", description: "默认语种已切换" });
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "操作失败", description: err.message });
    }
  };

  const handleDelete = async () => {
    if (!deletingCode) return;
    try {
      const res = await fetch(`/api/v1/rbac/languages/${deletingCode}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('删除失败');
      toast({ title: "成功", description: "语种已移除" });
      setDeletingCode(null);
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "操作失败", description: err.message });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Globe className="text-blue-600" size={24} />
            多语言设置
          </h1>
          <p className="text-slate-500 text-sm mt-1">管理系统支持的内容语种、默认显示及翻译状态</p>
        </div>
        <Button onClick={() => {
          setEditingLang({ code: '', name: '', isDefault: false, status: 'active' });
          setIsDialogOpen(true);
        }} className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20">
          <Plus size={16} className="mr-2" />
          新增语种
        </Button>
      </div>

      <Card className="border-slate-200/60 shadow-sm overflow-hidden bg-white/50 backdrop-blur-sm">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow>
              <TableHead className="font-semibold text-slate-700">语种名称</TableHead>
              <TableHead className="font-semibold text-slate-700">编码 (Code)</TableHead>
              <TableHead className="font-semibold text-slate-700">状态</TableHead>
              <TableHead className="font-semibold text-slate-700">默认</TableHead>
              <TableHead className="text-right font-semibold text-slate-700">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : languages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-slate-400">
                  尚未配置任何语种
                </TableCell>
              </TableRow>
            ) : (
              languages.map((lang) => (
                <TableRow key={lang.code} className="hover:bg-slate-50/50 transition-colors">
                  <TableCell className="font-medium text-slate-900">{lang.name}</TableCell>
                  <TableCell>
                    <code className="text-[11px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                      {lang.code}
                    </code>
                  </TableCell>
                  <TableCell>
                    {lang.status === 'active' ? (
                      <Badge className="bg-green-50 text-green-600 border-green-100 hover:bg-green-50 shadow-none">启用中</Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-50 shadow-none">已禁用</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {lang.isDefault ? (
                      <div className="flex items-center gap-1.5 text-blue-600 text-xs font-bold">
                        <Check size={14} strokeWidth={3} />
                        默认
                      </div>
                    ) : (
                      <button 
                        onClick={() => setAsDefault(lang.code)}
                        className="text-[10px] px-2 py-0.5 border border-slate-200 text-slate-400 rounded-full hover:border-blue-200 hover:text-blue-500 transition-all"
                      >
                        设为默认
                      </button>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                        onClick={() => {
                          setEditingLang(lang);
                          setIsDialogOpen(true);
                        }}
                      >
                        <Edit2 size={14} />
                      </Button>
                      {!lang.isDefault && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => setDeletingCode(lang.code)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* 编辑/新增弹窗 */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Languages size={18} className="text-blue-600" />
              {languages.some(l => l.code === editingLang?.code) ? '编辑语种' : '新增语种'}
            </DialogTitle>
            <DialogDescription>设置语种名称与标准化编码 (如 en-US, zh-CN)。</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>语种名称</Label>
              <Input 
                placeholder="名称 (如：简体中文)" 
                value={editingLang?.name || ''} 
                onChange={e => setEditingLang(prev => prev ? { ...prev, name: e.target.value } : null)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>语种编码 (Code)</Label>
              <Input 
                placeholder="编码 (如：zh-CN)" 
                value={editingLang?.code || ''} 
                onChange={e => setEditingLang(prev => prev ? { ...prev, code: e.target.value } : null)}
                disabled={languages.some(l => l.code === editingLang?.code)}
                required
              />
              <p className="text-[10px] text-slate-400">符合 ISO 标准的语言代码，保存后不可更改。</p>
            </div>
            <div className="flex items-center gap-4 pt-2">
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="lang-status"
                  checked={editingLang?.status === 'active'}
                  onChange={e => setEditingLang(prev => prev ? { ...prev, status: e.target.checked ? 'active' : 'inactive' } : null)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <Label htmlFor="lang-status" className="text-xs">启用该语种</Label>
              </div>
            </div>
            <DialogFooter className="pt-4 border-t border-slate-100 flex gap-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={saving}>取消</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white" disabled={saving}>
                {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                确认保存
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <Dialog open={!!deletingCode} onOpenChange={() => setDeletingCode(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader className="flex flex-col items-center text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-600">
              <AlertCircle size={24} />
            </div>
            <DialogTitle>确认移除语种？</DialogTitle>
            <DialogDescription className="text-sm">
              移除语种不会删除属于该语种的内容，但系统将不再显示该语言版本，且无法再切换至该语种进行编辑。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex gap-2 sm:justify-center">
            <Button variant="outline" onClick={() => setDeletingCode(null)}>取消</Button>
            <Button variant="destructive" onClick={handleDelete} className="bg-red-600 hover:bg-red-700 shadow-lg shadow-red-500/20">
              确认移除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
