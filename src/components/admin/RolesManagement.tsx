import React, { useState, useEffect } from 'react';
import { PermissionGrid } from './PermissionGrid';
import { Plus, Edit2, Trash2, ShieldCheck, Search, Loader2, MoreHorizontal, AlertTriangle } from 'lucide-react';
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
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription, 
  SheetFooter 
} from '../ui/Sheet';
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

interface Role {
  id?: number;
  name: string;
  description: string;
  permissions: string[];
}

interface Permission {
  slug: string;
  name: string;
  permCategory: string; // 适配新 schema
}

export const RolesManagement: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [highlightParam, setHighlightParam] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchData = async () => {
    try {
      setLoading(true);
      const [rolesRes, permsRes] = await Promise.all([
        fetch('/api/v1/rbac/roles'),
        fetch('/api/v1/rbac/permissions')
      ]);
      const rolesData = await rolesRes.json();
      const permsData = await permsRes.json();
      
      if (Array.isArray(rolesData)) setRoles(rolesData);
      if (Array.isArray(permsData)) setAllPermissions(permsData);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: "无法获取权限数据，请检查网络连接。"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // 解析高亮参数
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const highlight = params.get('highlight');
      if (highlight) {
        setHighlightParam(highlight);
      }
    }
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRole) return;
    setSaving(true);
    
    const method = editingRole.id ? 'PATCH' : 'POST';
    const url = editingRole.id ? `/api/v1/rbac/roles/${editingRole.id}` : '/api/v1/rbac/roles';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingRole.name,
          description: editingRole.description,
          permissionSlugs: editingRole.permissions
        })
      });
      if (res.ok) {
        toast({
          title: editingRole.id ? "更新成功" : "创建成功",
          description: `角色 [${editingRole.name}] 已成功同步到系统。`
        });
        await fetchData();
        setIsSheetOpen(false);
        setEditingRole(null);
      } else {
        throw new Error("API Error");
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "保存失败",
        description: "系统发生未知异常，请稍后再试。"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (role: Role) => {
    if (!role.id) return;

    setDeletingId(role.id);
    try {
      const res = await fetch(`/api/v1/rbac/roles/${role.id}`, {
        method: 'DELETE'
      });
      
      const data = await res.json();
      if (res.ok) {
        toast({
          title: "删除成功",
          description: `角色 [${role.name}] 已被物理移除。`
        });
        setRoleToDelete(null);
        await fetchData();
      } else {
        throw new Error(data.error || "删除失败");
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "操作失败",
        description: err.message
      });
    } finally {
      setDeletingId(null);
    }
  };

  const filteredRoles = roles.filter(role => 
    role.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (role.description && role.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">角色与职能</h2>
          <p className="text-sm text-muted-foreground">精细化定义操作权限，确保业务流程合规与安全</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="搜索角色名称或描述..." 
              className="pl-9 bg-white" 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <Button onClick={() => { setEditingRole({ name: '', description: '', permissions: [] }); setIsSheetOpen(true); }} className="shadow-lg">
            <Plus className="mr-2 h-4 w-4" /> 新建角色
          </Button>
        </div>
      </div>

      <Card className="border-slate-200/60 shadow-sm overflow-hidden bg-white/50 backdrop-blur-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="w-[200px] font-bold">角色名称</TableHead>
                <TableHead className="font-bold">职能描述</TableHead>
                <TableHead className="w-[120px] font-bold">权限数量</TableHead>
                <TableHead className="w-[100px] text-right font-bold">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-10 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredRoles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center text-muted-foreground italic">
                    未找到匹配的角色条目
                  </TableCell>
                </TableRow>
              ) : (
                filteredRoles.map((role) => (
                  <TableRow key={role.id} className="group hover:bg-slate-50/80">
                    <TableCell className="font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        {role.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-500 text-xs leading-relaxed max-w-md truncate">
                      {role.description || <span className="text-slate-300 italic">暂无描述</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono">{role.permissions.length} 项</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingRole(role); setIsSheetOpen(true); }}>
                          <Edit2 className="h-4 w-4 text-slate-400 group-hover:text-primary transition-colors" />
                        </Button>
                        {role.name === 'SuperAdmin' ? (
                          <div className="p-2 opacity-10 grayscale cursor-not-allowed" title="核心权限角色不可删除">
                            <Trash2 className="h-4 w-4 text-slate-300" />
                          </div>
                        ) : (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-slate-400 hover:text-red-600 transition-colors"
                            onClick={() => setRoleToDelete(role)}
                            loading={deletingId === role.id}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 角色删除确认弹窗 */}
      <Dialog open={!!roleToDelete} onOpenChange={(open) => !open && setRoleToDelete(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <div className="flex items-center gap-3 text-red-600 mb-2">
              <div className="p-2 bg-red-50 rounded-full">
                <AlertTriangle size={24} />
              </div>
              <DialogTitle className="text-xl">删除权限角色？</DialogTitle>
            </div>
            <DialogDescription className="text-slate-500 leading-relaxed text-sm">
              您确定要永久删除 <strong className="text-slate-900">[{roleToDelete?.name}]</strong> 角色吗？
              <br /><br />
              <span className="text-red-500 font-bold underline">警告：</span> 所有已被分配此角色的管理员将立即失去该角色关联的所有权限。此操作无法恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6 flex gap-2">
             <Button variant="outline" onClick={() => setRoleToDelete(null)} className="flex-1">
               取消
             </Button>
             <Button 
               variant="destructive" 
               onClick={() => roleToDelete && handleDelete(roleToDelete)} 
               loading={!!deletingId}
               className="flex-1 shadow-lg shadow-red-200"
             >
               确认移除角色
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-3xl overflow-y-auto">
          <SheetHeader className="mb-8">
            <SheetTitle className="text-2xl">{editingRole?.id ? '编辑职能权限' : '定义新角色'}</SheetTitle>
            <SheetDescription>
              请配置该角色的详细权能。所有更改将在保存后即时生效。
            </SheetDescription>
          </SheetHeader>
          
          {editingRole && (
            <form onSubmit={handleSave} className="space-y-8 pb-20">
              <div className="grid gap-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">名称</label>
                    <Input 
                      required 
                      placeholder="系统管理员"
                      value={editingRole.name} 
                      onChange={e => setEditingRole({...editingRole, name: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">描述</label>
                    <Input 
                      placeholder="负责全局参数配置"
                      value={editingRole.description} 
                      onChange={e => setEditingRole({...editingRole, description: e.target.value})} 
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-slate-700">权能分配矩阵</label>
                    <Badge variant="outline">{editingRole.permissions.length} 已选</Badge>
                  </div>
                  <PermissionGrid 
                    allPermissions={allPermissions}
                    selectedSlugs={editingRole.permissions}
                    onChange={slugs => setEditingRole({...editingRole, permissions: slugs})}
                    highlightCategory={highlightParam || undefined}
                  />
                </div>
              </div>

              <div className="fixed bottom-0 right-0 left-0 sm:left-auto sm:w-[512px] md:w-[768px] lg:w-[768px] p-6 bg-white border-t border-slate-100 flex justify-end gap-3 z-20">
                <Button type="button" variant="outline" onClick={() => setIsSheetOpen(false)}>取消</Button>
                <Button type="submit" loading={saving} className="px-8 shadow-md">
                  提交配置
                </Button>
              </div>
            </form>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};
