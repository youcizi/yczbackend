import React, { useState, useEffect } from 'react';
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
import { Plus, Edit, Trash2, Shield, User, Loader2, Key, Database, Mail, Clock, Settings, X } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState('list');

  // 等级配置相关
  const [levelConfigs, setLevelConfigs] = useState<{level: number, name: string}[]>([]);
  const [isLevelConfigOpen, setIsLevelConfigOpen] = useState(false);
  const [tempLevels, setTempLevels] = useState<{level: number, name: string}[]>([]);

  // 表单状态
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    level: 1,
    status: 'active' as SystemUser['status']
  });

  // 获取等级配置
  const fetchLevelConfigs = async () => {
    try {
      const res = await fetch('/api/v1/settings/member_levels');
      const result = await res.json();
      if (result.success) {
        setLevelConfigs(result.data);
        setTempLevels(result.data);
      }
    } catch (e) {
      console.error('Failed to fetch level configs');
    }
  };

  useEffect(() => {
    fetchLevelConfigs();
  }, []);

  const saveLevelConfigs = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/settings/member_levels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tempLevels)
      });
      if (res.ok) {
        setLevelConfigs(tempLevels);
        setIsLevelConfigOpen(false);
      }
    } catch (e) {
      setError('保存等级配置失败');
    } finally {
      setIsLoading(false);
    }
  };

  const openAddDialog = () => {
    setEditingUser(null);
    setError(null);
    setFormData({
      email: '',
      password: '',
      level: levelConfigs[0]?.level || 1,
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

  const getLevelName = (level: number) => {
    return levelConfigs.find(l => l.level === level)?.name || `等级 ${level}`;
  };

  return (
    <SystemConfigProvider config={{ activePlugins }}>
      <div className="flex flex-col gap-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex justify-between items-center mb-6">
            <TabsList className="bg-slate-100/50 p-1 rounded-xl">
              <TabsTrigger value="list" className="rounded-lg px-6 py-2 transition-all">用户列表</TabsTrigger>
              <TabsTrigger value="api" className="rounded-lg px-6 py-2 transition-all">API 管理</TabsTrigger>
            </TabsList>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setIsLevelConfigOpen(true)}
                className="border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                <Settings className="w-4 h-4 mr-2" />
                等级配置
              </Button>
              {activeTab === 'list' && (
                <Button onClick={openAddDialog} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md">
                  <Plus className="w-4 h-4 mr-2" />
                  添加新用户
                </Button>
              )}
            </div>
          </div>

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
                <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">平均等级</div>
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
                        <button 
                          onClick={() => openEditDialog(user)}
                          className="flex items-center gap-3 hover:text-blue-600 transition-colors"
                        >
                          <span className="font-medium text-slate-900 group-hover:text-blue-600">{user.email}</span>
                        </button>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex flex-col items-center gap-0.5">
                          <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md font-bold text-[10px]">
                            LV.{user.level || 1}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {getLevelName(user.level)}
                          </span>
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

        {/* 会员等级配置弹窗 */}
        <Dialog open={isLevelConfigOpen} onOpenChange={setIsLevelConfigOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>会员等级体系配置</DialogTitle>
              <DialogDescription>
                定义系统中会员的等级阶梯及其名称。保存后，添加或编辑用户时将只能选择此处定义的等级。
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="max-h-[300px] overflow-y-auto space-y-3 pr-2">
                {tempLevels.map((l, index) => (
                  <div key={index} className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex flex-col gap-1 flex-1">
                      <Label className="text-[10px] text-slate-400 uppercase font-bold">等级值 (Key)</Label>
                      <Input 
                        type="number" 
                        value={l.level} 
                        onChange={(e) => {
                          const newLevels = [...tempLevels];
                          newLevels[index].level = parseInt(e.target.value) || 0;
                          setTempLevels(newLevels);
                        }}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="flex flex-col gap-1 flex-[2]">
                      <Label className="text-[10px] text-slate-400 uppercase font-bold">等级名称 (Value)</Label>
                      <Input 
                        value={l.name} 
                        onChange={(e) => {
                          const newLevels = [...tempLevels];
                          newLevels[index].name = e.target.value;
                          setTempLevels(newLevels);
                        }}
                        placeholder="例如：黄金会员"
                        className="h-8 text-sm"
                      />
                    </div>
                    <button 
                      onClick={() => setTempLevels(tempLevels.filter((_, i) => i !== index))}
                      className="mt-5 p-1 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              
              <Button 
                variant="outline" 
                onClick={() => setTempLevels([...tempLevels, { level: (tempLevels[tempLevels.length-1]?.level || 0) + 1, name: '' }])}
                className="w-full border-dashed border-2 hover:border-blue-300 hover:text-blue-600 transition-all"
              >
                <Plus className="w-4 h-4 mr-2" />
                新增等级阶梯
              </Button>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsLevelConfigOpen(false)}>取消</Button>
              <Button onClick={saveLevelConfigs} loading={isLoading} className="bg-blue-600 hover:bg-blue-700">
                保存配置
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 用户表单弹窗 */}
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
                <Select 
                  value={formData.level.toString()}
                  onValueChange={(val) => setFormData({ ...formData, level: parseInt(val) })}
                >
                  {levelConfigs.length > 0 ? (
                    levelConfigs.map(l => (
                      <SelectItem key={l.level} value={l.level.toString()}>
                        LV.{l.level} - {l.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="1">默认等级 (请先配置)</SelectItem>
                  )}
                </Select>
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
