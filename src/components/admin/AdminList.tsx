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
import { Plus, Edit, Trash2, Shield, User, Loader2, Key, Database, Mail, Clock, Settings, X, Wallet, Award, UserCircle, Search, CreditCard, Coins, History, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

export interface SystemUser {
  id: string;
  email: string;
  userType: 'member';
  status: 'active' | 'inactive' | 'banned';
  createdAt: Date | string;
  level: number;
  
  // profile fields
  nickname?: string;
  avatar?: string;
  phone?: string;
  gender?: 'unknown' | 'male' | 'female';
  birthday?: string;
  bio?: string;
  balance: number;
  points: number;
  
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

  // level configs
  const [levelConfigs, setLevelConfigs] = useState<{level: number, name: string}[]>([]);
  const [isLevelConfigOpen, setIsLevelConfigOpen] = useState(false);
  const [tempLevels, setTempLevels] = useState<{level: number, name: string}[]>([]);

  // assets
  const [balanceLogs, setBalanceLogs] = useState<any[]>([]);
  const [pointsLogs, setPointsLogs] = useState<any[]>([]);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [adjustType, setAdjustType] = useState<'balance' | 'points'>('balance');
  const [adjustData, setAdjustData] = useState({
    userId: '',
    type: 'add' as 'add' | 'sub' | 'set',
    amount: 0,
    remark: ''
  });

  // tokens
  const [apiTokens, setApiTokens] = useState<any[]>([]);
  const [isIssueTokenOpen, setIsIssueTokenOpen] = useState(false);
  const [issueData, setIssueData] = useState({ userId: '', name: '' });
  const [newlyIssuedToken, setNewlyIssuedToken] = useState<string | null>(null);

  // form
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    level: 1,
    status: 'active' as SystemUser['status'],
    nickname: '',
    avatar: '',
    phone: '',
    gender: 'unknown' as SystemUser['gender'],
    birthday: '',
    bio: ''
  });

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

  const fetchBalanceLogs = async () => {
    try {
      const res = await fetch('/api/v1/users/balance/logs');
      const result = await res.json();
      if (result.success) setBalanceLogs(result.data);
    } catch (e) {
      console.error('Failed to fetch balance logs');
    }
  };

  const fetchPointsLogs = async () => {
    try {
      const res = await fetch('/api/v1/users/points/logs');
      const result = await res.json();
      if (result.success) setPointsLogs(result.data);
    } catch (e) {
      console.error('Failed to fetch points logs');
    }
  };

  const fetchApiTokens = async () => {
    try {
      const res = await fetch('/api/v1/users/tokens/all');
      const result = await res.json();
      if (result.success) {
        setApiTokens(result.data);
      }
    } catch (e) {
      console.error('Failed to fetch API tokens');
    }
  };

  useEffect(() => {
    fetchLevelConfigs();
    if (activeTab === 'api') fetchApiTokens();
    if (activeTab === 'balance') fetchBalanceLogs();
    if (activeTab === 'points') fetchPointsLogs();
  }, [activeTab]);

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
      setError('Save Failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleIssueToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch(`/api/v1/users/${issueData.userId}/tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: issueData.name })
      });
      const result = await res.json();
      if (result.success) {
        setNewlyIssuedToken(result.token);
        fetchApiTokens();
      }
    } catch (e) {
      setError('Issue Failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeToken = async (tokenId: number) => {
    if (!confirm('Are you sure?')) return;
    
    try {
      const res = await fetch(`/api/v1/users/tokens/${tokenId}`, { method: 'DELETE' });
      if (res.ok) {
        setApiTokens(apiTokens.filter(t => t.id !== tokenId));
      }
    } catch (e) {
      setError('Revoke Failed');
    }
  };

  const openAddDialog = () => {
    setEditingUser(null);
    setError(null);
    setFormData({
      email: '',
      password: '',
      level: levelConfigs[0]?.level || 1,
      status: 'active',
      nickname: '',
      avatar: '',
      phone: '',
      gender: 'unknown',
      birthday: '',
      bio: ''
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
      status: user.status,
      nickname: user.nickname || '',
      avatar: user.avatar || '',
      phone: user.phone || '',
      gender: user.gender || 'unknown',
      birthday: user.birthday || '',
      bio: user.bio || ''
    });
    setIsOpen(true);
  };

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const endpoint = adjustType === 'balance' ? '/api/v1/users/balance/adjust' : '/api/v1/users/points/adjust';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adjustData)
      });
      const result = await res.json();
      if (result.success) {
        setIsAdjustOpen(false);
        if (adjustType === 'balance') fetchBalanceLogs();
        else fetchPointsLogs();
        const refreshRes = await fetch('/api/v1/users');
        setUsers(await refreshRes.json());
      }
    } catch (e) {
      setError('Adjust Failed');
    } finally {
      setIsLoading(false);
    }
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
        if (!res.ok) throw new Error('Update Failed');
        
        setUsers(users.map(u => u.id === editingUser.id ? { ...u, ...formData, updatedAt: new Date() } : u));
      } else {
        const res = await fetch('/api/v1/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Create Failed');

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
      if (!res.ok) throw new Error('Delete Failed');
      setUsers(users.filter(u => u.id !== userToDelete));
      setIsDeleteOpen(false);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const getLevelName = (level: number) => {
    return levelConfigs.find(l => l.level === level)?.name || `Level ${level}`;
  };

  return (
    <SystemConfigProvider config={{ activePlugins }}>
      <div className="flex flex-col gap-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex justify-between items-center mb-6">
            <TabsList className="bg-slate-100/50 p-1 rounded-xl">
              <TabsTrigger value="list" className="rounded-lg px-6 py-2 transition-all">Users</TabsTrigger>
              <TabsTrigger value="balance" className="rounded-lg px-6 py-2 transition-all">Balance</TabsTrigger>
              <TabsTrigger value="points" className="rounded-lg px-6 py-2 transition-all">Points</TabsTrigger>
              <TabsTrigger value="api" className="rounded-lg px-6 py-2 transition-all">API</TabsTrigger>
            </TabsList>

            <div className="flex gap-2">
              {activeTab === 'list' && (
                <>
                  <Button variant="outline" onClick={() => setIsLevelConfigOpen(true)}>
                    <Settings className="w-4 h-4 mr-2" /> Levels
                  </Button>
                  <Button onClick={openAddDialog} className="bg-blue-600 text-white">
                    <Plus className="w-4 h-4 mr-2" /> Add User
                  </Button>
                </>
              )}
              {activeTab === 'api' && (
                <Button onClick={() => setIsIssueTokenOpen(true)} className="bg-slate-900 text-white">
                  <Key className="w-4 h-4 mr-2" /> Issue Token
                </Button>
              )}
            </div>
          </div>

          <TabsContent value="list" className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="px-6 py-4">User Info</th>
                    <th className="px-6 py-4 text-center">Level</th>
                    <th className="px-6 py-4 text-center">Assets</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50 group">
                      <td className="px-6 py-4">
                        <div onClick={() => openEditDialog(user)} className="flex items-center gap-3 cursor-pointer">
                          <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border">
                            {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : <UserCircle className="w-6 h-6 text-slate-300" />}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900">{user.nickname || 'Unnamed'}</span>
                            <span className="text-xs text-slate-400 font-mono">{user.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center text-[10px] font-bold">
                        LV.{user.level || 1}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col items-center gap-1 text-xs">
                          <div className="flex items-center gap-1"><Wallet className="w-3 h-3" /> {user.balance || 0}</div>
                          <div className="flex items-center gap-1"><Coins className="w-3 h-3" /> {user.points || 0}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] border">
                          {user.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEditDialog(user)} className="p-1.5"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => confirmDelete(user.id)} className="p-1.5"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="balance" className="space-y-6">
            <div className="flex justify-end">
              <Button onClick={() => { setAdjustType('balance'); setAdjustData({ userId: users[0]?.id || '', type: 'add', amount: 0, remark: '' }); setIsAdjustOpen(true); }} className="bg-blue-600 text-white">Adjust Balance</Button>
            </div>
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr><th className="px-6 py-4">Member</th><th className="px-6 py-4">Type</th><th className="px-6 py-4">Amount</th><th className="px-6 py-4">Log</th><th className="px-6 py-4">Time</th></tr>
                </thead>
                <tbody className="divide-y">
                  {balanceLogs.map(log => (
                    <tr key={log.id}>
                      <td className="px-6 py-4">{log.nickname || log.email}</td>
                      <td className="px-6 py-4">{log.type}</td>
                      <td className="px-6 py-4">{log.amount}</td>
                      <td className="px-6 py-4">{log.remark}</td>
                      <td className="px-6 py-4 text-xs text-slate-400">{new Date(log.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="points" className="space-y-6">
            <div className="flex justify-end">
              <Button onClick={() => { setAdjustType('points'); setAdjustData({ userId: users[0]?.id || '', type: 'add', amount: 0, remark: '' }); setIsAdjustOpen(true); }} className="bg-orange-600 text-white">Adjust Points</Button>
            </div>
            {/* Same table structure for points logs */}
          </TabsContent>

          <TabsContent value="api" className="space-y-6">
            {/* API Tokens list */}
          </TabsContent>
        </Tabs>

        <Dialog open={isAdjustOpen} onOpenChange={setIsAdjustOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Adjust {adjustType}</DialogTitle></DialogHeader>
            <form onSubmit={handleAdjust} className="space-y-4">
              <Select value={adjustData.userId} onValueChange={(val) => setAdjustData({ ...adjustData, userId: val })}>
                {users.map(u => <SelectItem key={u.id} value={u.id}>{u.nickname || u.email}</SelectItem>)}
              </Select>
              <div className="grid grid-cols-2 gap-4">
                <Select value={adjustData.type} onValueChange={(val: any) => setAdjustData({ ...adjustData, type: val })}>
                  <SelectItem value="add">Add (+)</SelectItem>
                  <SelectItem value="sub">Sub (-)</SelectItem>
                  <SelectItem value="set">Set (=)</SelectItem>
                </Select>
                <Input type="number" value={adjustData.amount} onChange={(e) => setAdjustData({ ...adjustData, amount: parseInt(e.target.value) || 0 })} />
              </div>
              <Input value={adjustData.remark} onChange={(e) => setAdjustData({ ...adjustData, remark: e.target.value })} placeholder="Remark" />
              <DialogFooter><Button type="submit">Confirm</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>User Form</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="Email" />
              <Input value={formData.nickname} onChange={(e) => setFormData({ ...formData, nickname: e.target.value })} placeholder="Nickname" />
              <Input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder="Password" />
              <DialogFooter><Button type="submit">Save</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <ConfirmDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen} onConfirm={handleDelete} />
      </div>
    </SystemConfigProvider>
  );
};
