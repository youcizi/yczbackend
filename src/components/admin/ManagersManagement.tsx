import React, { useState, useEffect } from 'react';
import { UserPlus, Edit2, Shield, Trash2, Key, Check, Copy, Search, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
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
import { Checkbox } from '../ui/Checkbox';
import { useToast } from '../ui/Toaster';
import { Skeleton } from '../ui/Skeleton';

interface Manager {
  id: string;
  username: string;
  createdAt: string;
  roles: { id: number; name: string }[];
}

interface Role {
  id: number;
  name: string;
}

export const ManagersManagement: React.FC = () => {
  const [managers, setManagers] = useState<Manager[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();
  
  // 会员及权限状态
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);
  const [newManager, setNewManager] = useState({ username: '', password: '', roleIds: [] as number[] });
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [managerToDelete, setManagerToDelete] = useState<Manager | null>(null);
  const [editingManager, setEditingManager] = useState<Manager | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [managersRes, rolesRes, meRes] = await Promise.all([
        fetch('/api/v1/rbac/managers'),
        fetch('/api/v1/rbac/roles'),
        fetch('/api/auth/admin/me')
      ]);
      const [managersData, rolesData, meData] = await Promise.all([
        managersRes.json(),
        rolesRes.json(),
        meRes.json()
      ]);
      setManagers(Array.isArray(managersData) ? managersData : []);
      setRoles(Array.isArray(rolesData) ? rolesData : []);
      setCurrentUser(meData.user || null);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "获取列表失败",
        description: "请检查您的权限或网络设置。"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    
    try {
      if (editingManager) {
        // 编辑模式
        const res = await fetch(`/api/v1/rbac/managers/${editingManager.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            password: newManager.password, 
            roleIds: newManager.roleIds 
          })
        });
        if (res.ok) {
          toast({ title: "管理员信息已更新" });
          setIsDialogOpen(false);
          setEditingManager(null);
          await fetchData();
        } else {
          throw new Error("更新失败");
        }
      } else {
        // 新建模式
        const password = newManager.password || Math.random().toString(36).slice(-10);
        const res = await fetch('/api/v1/rbac/managers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...newManager, password })
        });
        if (res.ok) {
          setGeneratedPassword(password);
          await fetchData();
          toast({
            title: "管理员创建成功",
            description: `用户 [${newManager.username}] 已加入系统。`
          });
        } else {
          throw new Error("API Failure");
        }
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: editingManager ? "更新失败" : "创建失败",
        description: err.message || "请检查输入内容。"
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (manager: Manager) => {
    setDeletingId(manager.id);
    try {
      const res = await fetch(`/api/v1/rbac/managers/${manager.id}`, {
        method: 'DELETE'
      });
      
      const data = await res.json();
      if (res.ok) {
        toast({
          title: "删除成功",
          description: `管理员 [${manager.username}] 已被移除。`
        });
        setManagerToDelete(null);
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

  const filteredManagers = managers.filter(m => 
    m.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">操作员管理</h2>
          <p className="text-sm text-muted-foreground">配置系统访问账号，分配所属角色组及其操作权限</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-64">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
             <Input 
               placeholder="通过用户名搜索..." 
               className="pl-9 bg-white"
               value={searchQuery}
               onChange={e => setSearchQuery(e.target.value)}
             />
          </div>
          <Button 
            onClick={() => { 
              setNewManager({ username: '', password: '', roleIds: [] }); 
              setGeneratedPassword(null);
              setEditingManager(null);
              setIsDialogOpen(true); 
            }}
            className="shadow-lg"
          >
            <UserPlus className="mr-2 h-4 w-4" /> 添加账号
          </Button>
        </div>
      </div>

      <Card className="border-slate-200/60 shadow-sm overflow-hidden bg-white/40 backdrop-blur-md">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="w-[250px] font-bold">操作员</TableHead>
                <TableHead className="font-bold">角色分配</TableHead>
                <TableHead className="w-[180px] font-bold">注册时间</TableHead>
                <TableHead className="w-[100px] text-right font-bold">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-10 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-10 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-10 w-28" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-10 w-10 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredManagers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center text-muted-foreground italic">
                    暂无符合条件的管理员账号
                  </TableCell>
                </TableRow>
              ) : (
                filteredManagers.map(manager => (
                  <tr key={manager.id} className="hover:bg-slate-50/80 transition-colors group border-b">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs ring-2 ring-white shadow-sm">
                          {manager.username[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{manager.username}</p>
                          <p className="text-[10px] text-slate-400 font-mono tracking-tighter">{manager.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {manager.roles.map((role, idx) => (
                          <Badge key={`${manager.id}-${role.id}-${idx}`} variant="secondary" className="px-2 py-0 border-primary/10">
                            <Shield className="h-3 w-3 mr-1 text-primary/60" />
                            {role.name}
                          </Badge>
                        ))}
                        {manager.roles.length === 0 && <span className="text-xs text-slate-300 italic">未分配</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500 font-mono">
                      {new Date(manager.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-slate-400 hover:text-primary transition-colors"
                          onClick={() => {
                            setEditingManager(manager);
                            setNewManager({ 
                              username: manager.username, 
                              password: '', 
                              roleIds: manager.roles.map(r => r.id) 
                            });
                            setGeneratedPassword(null);
                            setIsDialogOpen(true);
                          }}
                        >
                          <Edit2 size={16} />
                        </Button>

                        {manager.id === 'super-admin-01' || manager.id === currentUser?.id ? (
                          <div className="p-2 opacity-20 grayscale cursor-not-allowed" title={manager.id === 'super-admin-01' ? "系统预设账号不可删除" : "无法删除当前登录账号"}>
                            <Trash2 size={16} />
                          </div>
                        ) : (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-slate-400 hover:text-red-600 transition-colors"
                            onClick={() => setManagerToDelete(manager)}
                            loading={deletingId === manager.id}
                          >
                            <Trash2 size={16} />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 删除确认弹窗 */}
      <Dialog open={!!managerToDelete} onOpenChange={(open) => !open && setManagerToDelete(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <div className="flex items-center gap-3 text-red-600 mb-2">
              <div className="p-2 bg-red-50 rounded-full">
                <AlertTriangle size={24} />
              </div>
              <DialogTitle className="text-xl">确认物理删除？</DialogTitle>
            </div>
            <DialogDescription className="text-slate-500 leading-relaxed text-sm">
              您正在尝试永久移除管理员 <strong className="text-slate-900">[{managerToDelete?.username}]</strong>。该账户的所有访问权限、关联角色映射以及当前活跃会话都将被立即清理。此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6 flex gap-2">
             <Button variant="outline" onClick={() => setManagerToDelete(null)} className="flex-1">
               保留账号
             </Button>
             <Button 
               variant="destructive" 
               onClick={() => managerToDelete && handleDelete(managerToDelete)} 
               loading={!!deletingId}
               className="flex-1 shadow-lg shadow-red-200"
             >
               确认彻底删除
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog 
        open={isDialogOpen} 
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setEditingManager(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          {!generatedPassword ? (
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle className="text-xl">
                  {editingManager ? '编辑操作员权限' : '添加系统管理员'}
                </DialogTitle>
                <DialogDescription>
                  {editingManager 
                    ? `正在修改管理员 [${editingManager.username}] 的角色及其操作权限。`
                    : '为业务人员创建一个新的访问账号，请合理分配其权限范围。'
                  }
                </DialogDescription>
              </DialogHeader>
              <div className="py-6 space-y-5">
                <div className="space-y-2">
                   <label className="text-sm font-bold text-slate-700">账户用户名</label>
                   <Input 
                     required 
                     disabled={!!editingManager}
                     placeholder="例如: kerry_zhao"
                     value={newManager.username}
                     onChange={e => setNewManager({...newManager, username: e.target.value})}
                   />
                </div>
                <div className="space-y-2">
                   <label className="text-sm font-bold text-slate-700">
                     {editingManager ? '修改密码 (选填)' : '初始密码 (选填)'}
                   </label>
                   <Input 
                     type="password"
                     autoComplete="new-password"
                     placeholder={editingManager ? "留空则保持原密码不变" : "留空即为系统随机生成"}
                     value={newManager.password}
                     onChange={e => setNewManager({...newManager, password: e.target.value})}
                   />
                </div>
                <div className="space-y-3">
                   <div className="flex items-center justify-between">
                     <label className="text-sm font-bold text-slate-700">分配角色组</label>
                     {editingManager?.id === currentUser?.id && (
                       <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200 bg-amber-50 gap-1 font-medium">
                         <AlertTriangle size={10} /> 禁止修改本人权限
                       </Badge>
                     )}
                   </div>
                   <div className={`grid grid-cols-2 gap-3 p-4 rounded-xl border ${
                     editingManager?.id === currentUser?.id 
                       ? 'bg-slate-50/50 border-slate-200 opacity-60' 
                       : 'bg-slate-50 border-slate-100'
                   }`}>
                      {roles.map(role => (
                        <div key={role.id} className="flex items-center space-x-2">
                          <Checkbox 
                            id={`role-${role.id}`}
                            disabled={editingManager?.id === currentUser?.id}
                            checked={newManager.roleIds.includes(role.id)}
                            onCheckedChange={checked => {
                              const ids = checked 
                                ? [...newManager.roleIds, role.id] 
                                : newManager.roleIds.filter(id => id !== role.id);
                              setNewManager({...newManager, roleIds: ids});
                            }}
                          />
                          <label 
                            htmlFor={`role-${role.id}`} 
                            className={`text-xs font-medium leading-none ${
                               editingManager?.id === currentUser?.id ? 'cursor-not-allowed text-slate-400' : 'cursor-pointer'
                            }`}
                          >
                            {role.name}
                          </label>
                        </div>
                      ))}
                   </div>
                   {editingManager?.id === currentUser?.id && (
                     <p className="text-[10px] text-slate-400 text-center italic">
                       为了防止逻辑死锁，系统禁止通过此页面修改当前登录账号的角色映射。
                     </p>
                   )}
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>取消</Button>
                <Button type="submit" loading={creating}>
                  {editingManager ? '确认修改' : '生成账号'}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="p-2 space-y-6 flex flex-col items-center">
              <div className="w-14 h-14 bg-primary/10 text-primary rounded-full flex items-center justify-center animate-in zoom-in-50 duration-500">
                <Check size={28} strokeWidth={3} />
              </div>
              <div className="text-center space-y-2">
                <DialogTitle className="text-2xl font-black">创建成功</DialogTitle>
                <DialogDescription className="px-4">
                  请立即复制并妥善保管该初始密码。出于安全考虑，关闭此窗口后将无法再次查看。
                </DialogDescription>
              </div>
              <div className="w-full bg-slate-900 text-white p-6 rounded-2xl font-mono text-xl tracking-widest text-center relative group shadow-2xl overflow-hidden self-stretch">
                <div className="absolute inset-x-0 bottom-0 h-1 bg-primary/50" />
                {generatedPassword}
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(generatedPassword);
                    toast({ title: "已成功复制到剪贴板" });
                  }} 
                  className="absolute right-3 top-3 p-1.5 text-slate-500 hover:text-white transition-all bg-white/5 rounded-lg border border-white/10"
                >
                  <Copy size={16} />
                </button>
              </div>
              <Button onClick={() => setIsDialogOpen(false)} className="w-full h-12 text-md font-bold">
                我已记录，关闭窗口
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
