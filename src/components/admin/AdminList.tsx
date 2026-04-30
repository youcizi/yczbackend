import React, { useState } from 'react';
import { SystemConfigProvider } from '../../contexts/SystemConfigContext';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Select, SelectItem } from '../ui/Select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/Tabs';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Plus, Edit, Trash2, Shield, User, Loader2, Key, Database, Mail, Clock } from 'lucide-react';

export interface SystemUser {
  id: string;
  email: string;
  userType: 'member';
  status: 'active' | 'inactive' | 'banned';
  createdAt: Date | string;
  level: number;
  [key: string]: any;
}

interface UserListProps {
  users: SystemUser[];
  activePlugins?: string[];
}

export const AdminList: React.FC<UserListProps> = ({ 
  users: initialUsers, 
  activePlugins = []
}) => {
  const [users, setUsers] = useState<SystemUser[]>(initialUsers);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 表单状态
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    level: 1,
    status: 'active' as SystemUser['status']
  });

  const openAddDialog = () => {
    setEditingUser(null);
    setError(null);
    setFormData({
      email: '',
      password: '',
      level: 1,
      status: 'active'
    });
    setIsOpen(true);
  };

  const openEditDialog = (user: SystemUser) => {
    setEditingUser(user);
    setError(null);
    setFormData({
      email: user.email,
      password: '', 
      level: user.level || 1,
      status: user.status
    });
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (editingUser) {
        const res = await fetch(`/api/v1/users/${editingUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        if (!res.ok) throw new Error('更新失败');
        
        setUsers(users.map(u => u.id === editingUser.id ? { ...u, ...formData, updatedAt: new Date() } : u));
      } else {
        const res = await fetch('/api/v1/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || '创建失败');

        const refreshRes = await fetch('/api/v1/users');
        const newList = await refreshRes.json();
        setUsers(newList);
      }
      setIsOpen(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const confirmDelete = (id: string) => {
    setUserToDelete(id);
    setIsDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!userToDelete) return;
    
    try {
      const res = await fetch(`/api/v1/users/${userToDelete}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('删除失败');
      setUsers(users.filter(u => u.id !== userToDelete));
      setIsDeleteOpen(false);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <SystemConfigProvider config={{ activePlugins }}>
      <div className="flex flex-col gap-6">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">系统用户管理</h1>
            <p className="text-slate-500 mt-2 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
              管理前台会员账号、等级与权限状态
            </p>
          </div>
          
          <Button onClick={openAddDialog} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md">
            <Plus className="w-4 h-4 mr-2" />
            添加新用户
          </Button>
        </header>

        <Tabs defaultValue="list" className="w-full">
          <TabsList className="mb-4 bg-slate-100/50 p-1 rounded-xl">
            <TabsTrigger value="list" className="rounded-lg px-6 py-2 transition-all">用户列表</TabsTrigger>
            <TabsTrigger value="api" className="rounded-lg px-6 py-2 transition-all">API 管理</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 bg-white rounded-xl border border-slate-100 shadow-sm">
                <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">总计用户</div>
                <div className="text-2xl font-black text-slate-900">{users.length}</div>
              </div>
              <div className="p-6 bg-white rounded-xl border border-slate-100 shadow-sm">
                <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">正常状态</div>
                <div className="text-2xl font-black text-emerald-600">{users.filter(u => u.status === 'active').length}</div>
              </div>
              <div className="p-6 bg-white rounded-xl border border-slate-100 shadow-sm">
                <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">活跃等级(Avg)</div>
                <div className="text-2xl font-black text-blue-600">
                  {users.length > 0 
                    ? (users.reduce((acc, u) => acc + (u.level || 0), 0) / users.length).toFixed(1) 
                    : '0.0'}
                </div>
              </div>
            </section>

            <div className="user-list-wrapper w-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full border-collapse text-left text-sm text-slate-600">
                <thead className="bg-slate-50/80 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 font-semibold text-slate-900">邮箱账号</th>
                    <th className="px-6 py-4 font-semibold text-slate-900 text-center">用户等级</th>
                    <th className="px-6 py-4 font-semibold text-slate-900">账户状态</th>
                    <th className="px-6 py-4 font-semibold text-slate-900">注册日期</th>
                    <th className="px-6 py-4 font-semibold text-slate-900 text-right">管理操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                            <User className="w-4 h-4" />
                          </div>
                          <span className="font-medium text-slate-900">{user.email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2 py-1 bg-slate-100 text-slate-700 rounded-md font-bold text-xs">
                          LV.{user.level || 1}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          user.status === 'active' 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                            : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}>
                          {user.status === 'active' ? '正常' : '已禁用'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-400">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => openEditDialog(user)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title="编辑用户"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => confirmDelete(user.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="删除用户"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="api" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center shadow-sm">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Key className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">用户 API 访问管理</h3>
              <p className="text-slate-500 mt-2 max-w-md mx-auto">
                在这里可以为用户分配 API 密钥，设置访问频率限制，以及监控接口调用日志。
              </p>
              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-left">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-blue-500" />
                    访问令牌控制
                  </div>
                  <p className="text-xs text-slate-500 mt-1">管理用户用于 REST API 的长效或临时令牌。</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-left">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-500" />
                    调用额度统计
                  </div>
                  <p className="text-xs text-slate-500 mt-1">监控各用户对各插件 API 的调用次数与流量。</p>
                </div>
              </div>
              <Button className="mt-8 bg-slate-900 hover:bg-slate-800">
                配置全局 API 策略
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {/* 表单弹窗 */}
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingUser ? '编辑会员资料' : '添加新会员'}</DialogTitle>
              <DialogDescription>
                填写前台会员的基本账号信息。此处的用户与后台系统管理员完全隔离。
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-xs rounded-lg font-medium">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">电子邮箱</Label>
                <Input 
                  id="email" 
                  type="email" 
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="name@example.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="level">会员等级</Label>
                <div className="flex items-center gap-3">
                   <Input 
                    id="level" 
                    type="number"
                    min="1"
                    max="99"
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) || 1 })}
                    className="w-24"
                  />
                  <span className="text-xs text-slate-400 font-medium">当前设定的会员阶梯等级</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">
                  {editingUser ? '重置密码 (留空则不修改)' : '登录密码'}
                </Label>
                <div className="relative">
                  <Input 
                    id="password" 
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="请输入密码"
                    required={!editingUser}
                  />
                  <Key className="absolute right-3 top-3 h-4 w-4 opacity-30" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">账户状态</Label>
                <Select 
                  value={formData.status}
                  onValueChange={(val: any) => setFormData({ ...formData, status: val })}
                >
                  <SelectItem value="active">正常 (Active)</SelectItem>
                  <SelectItem value="inactive">禁用 (Inactive)</SelectItem>
                  <SelectItem value="banned">封禁 (Banned)</SelectItem>
                </Select>
              </div>

              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                  取消
                </Button>
                <Button type="submit" loading={isLoading} className="bg-blue-600 hover:bg-blue-700">
                  {editingUser ? '保存修改' : '立即创建'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          open={isDeleteOpen}
          onOpenChange={setIsDeleteOpen}
          title="确定删除此用户吗？"
          description="此操作将永久移除该用户及其所有关联数据（订单、配置等），且无法撤销。"
          onConfirm={handleDelete}
          confirmText="确定删除"
          cancelText="再想想"
          variant="destructive"
        />
      </div>
    </SystemConfigProvider>
  );
};
