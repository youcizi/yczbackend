import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { 
  Plus, Edit, Trash2, User, Key, Settings, X, Wallet, 
  UserCircle, CreditCard, Coins, Calendar, Camera, Upload, 
  Check, Loader2, ChevronRight, MapPin, Phone, History, Shield, Info
} from 'lucide-react';
import Cropper from 'react-easy-crop';
import imageCompression from 'browser-image-compression';

// --- Helper: Avatar Upload with Cropping & Compression ---
const AvatarUpload = ({ value, onChange }: { value?: string, onChange: (url: string) => void }) => {
  const [image, setImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onCropComplete = useCallback((_croppedArea: any, pixels: any) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImage(reader.result as string);
        setIsCropping(true);
      });
      reader.readAsDataURL(file);
    }
  };

  const createCroppedImage = async () => {
    if (!image || !croppedAreaPixels) return;
    setIsUploading(true);
    try {
      const canvas = document.createElement('canvas');
      const img = new Image();
      img.src = image;
      await new Promise((resolve) => (img.onload = resolve));

      canvas.width = croppedAreaPixels.width;
      canvas.height = croppedAreaPixels.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(
        img,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        croppedAreaPixels.width,
        croppedAreaPixels.height
      );

      const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.9));
      const compressedFile = await imageCompression(new File([blob], "avatar.jpg", { type: "image/jpeg" }), {
        maxSizeMB: 0.1,
        maxWidthOrHeight: 400,
        useWebWorker: true
      });

      const finalReader = new FileReader();
      finalReader.readAsDataURL(compressedFile);
      finalReader.onloadend = () => {
        onChange(finalReader.result as string);
        setIsCropping(false);
        setImage(null);
      };
    } catch (e) {
      console.error(e);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
        <div className="w-24 h-24 rounded-full border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden bg-slate-50 group-hover:border-blue-400 transition-colors">
          {value ? <img src={value} className="w-full h-full object-cover" alt="Avatar" /> : <Camera className="w-8 h-8 text-slate-300" />}
        </div>
        <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <Upload className="w-6 h-6 text-white" />
        </div>
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
      </div>

      <Dialog open={isCropping} onOpenChange={setIsCropping}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>裁剪并压缩头像</DialogTitle></DialogHeader>
          <div className="relative h-80 w-full bg-slate-900 rounded-lg overflow-hidden mt-4">
            {image && <Cropper image={image} crop={crop} zoom={zoom} aspect={1} onCropChange={setCrop} onCropComplete={onCropComplete} onZoomChange={setZoom} />}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCropping(false)}>取消</Button>
            <Button onClick={createCroppedImage} loading={isUploading} className="bg-blue-600 text-white">确认并应用</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// --- Types ---
export interface SystemUser {
  id: string;
  email: string;
  userType: 'member';
  status: 'active' | 'inactive' | 'banned';
  createdAt: Date | string;
  level: number;
  nickname?: string;
  avatar?: string;
  phone?: string;
  gender?: 'unknown' | 'male' | 'female';
  birthday?: string;
  bio?: string;
  balance: number;
  points: number;
}

interface UserListProps {
  users: SystemUser[];
  activePlugins?: string[];
}

// --- Main Component ---
export const AdminUserManagement: React.FC<UserListProps> = ({ 
  users: initialUsers, 
  activePlugins = []
}) => {
  // State
  const [users, setUsers] = useState<SystemUser[]>(initialUsers);
  const [activeTab, setActiveTab] = useState('list');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dialog State
  const [isOpen, setIsOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);

  // Level Config State
  const [isLevelConfigOpen, setIsLevelConfigOpen] = useState(false);
  const [levelConfigs, setLevelConfigs] = useState<{level: number, name: string}[]>([]);
  const [tempLevels, setTempLevels] = useState<{level: number, name: string}[]>([]);

  // Asset State
  const [balanceLogs, setBalanceLogs] = useState<any[]>([]);
  const [pointsLogs, setPointsLogs] = useState<any[]>([]);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [adjustType, setAdjustType] = useState<'balance' | 'points'>('balance');
  const [adjustData, setAdjustData] = useState({ userId: '', type: 'add' as any, amount: 0, remark: '' });

  // API Token State
  const [apiTokens, setApiTokens] = useState<any[]>([]);
  const [isIssueTokenOpen, setIsIssueTokenOpen] = useState(false);
  const [issueData, setIssueData] = useState({ userId: '', name: '' });
  const [newlyIssuedToken, setNewlyIssuedToken] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    email: '', password: '', level: 1, status: 'active' as any,
    nickname: '', avatar: '', phone: '', gender: 'unknown' as any,
    birthday: '', bio: ''
  });

  // Fetching Data
  const fetchData = async () => {
    try {
      const uRes = await fetch('/api/v1/users');
      setUsers(await uRes.json());
      
      const lRes = await fetch('/api/v1/settings/member_levels');
      const lData = await lRes.json();
      if (lData.success) {
        setLevelConfigs(lData.data);
        setTempLevels(lData.data);
      }
    } catch (e) { console.error(e); }
  };

  const fetchLogsAndTokens = async () => {
    try {
      if (activeTab === 'balance') {
        const res = await fetch('/api/v1/users/balance/logs');
        const data = await res.json();
        if (data.success) setBalanceLogs(data.data);
      } else if (activeTab === 'points') {
        const res = await fetch('/api/v1/users/points/logs');
        const data = await res.json();
        if (data.success) setPointsLogs(data.data);
      } else if (activeTab === 'api') {
        const res = await fetch('/api/v1/users/tokens/all');
        const data = await res.json();
        if (data.success) setApiTokens(data.data);
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchLogsAndTokens();
  }, [activeTab]);

  // Actions
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
        fetchLogsAndTokens();
      }
    } catch (e) { setError('令牌颁发失败'); }
    finally { setIsLoading(false); }
  };

  const handleRevokeToken = async (tokenId: number) => {
    if (!confirm('确定要撤销此 API 令牌吗？')) return;
    try {
      await fetch(`/api/v1/users/tokens/${tokenId}`, { method: 'DELETE' });
      setApiTokens(apiTokens.filter(t => t.id !== tokenId));
    } catch (e) { setError('撤销失败'); }
  };

  const saveLevelConfigs = async () => {
    setIsLoading(true);
    try {
      await fetch('/api/v1/settings/member_levels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tempLevels)
      });
      setLevelConfigs(tempLevels);
      setIsLevelConfigOpen(false);
    } catch (e) { setError('保存失败'); }
    finally { setIsLoading(false); }
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch(`/api/v1/users/${adjustType}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adjustData)
      });
      if ((await res.json()).success) {
        setIsAdjustOpen(false);
        fetchLogsAndTokens();
        fetchData();
      }
    } catch (e) { setError('调整失败'); }
    finally { setIsLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const url = editingUser ? `/api/v1/users/${editingUser.id}` : '/api/v1/users';
      const method = editingUser ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setIsOpen(false);
        fetchData();
      } else {
        const err = await res.json();
        setError(err.error || '操作失败');
      }
    } catch (e) { setError('系统错误'); }
    finally { setIsLoading(false); }
  };

  const handleDelete = async () => {
    if (!userToDelete) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/v1/users/${userToDelete}`, { method: 'DELETE' });
      if (res.ok) {
        setUsers(users.filter(u => u.id !== userToDelete));
        setIsDeleteOpen(false);
      } else {
        setError('删除失败');
      }
    } catch (e) {
      setError('系统错误');
    } finally {
      setIsLoading(false);
    }
  };

  const getLevelName = (level: number) => {
    return levelConfigs.find(l => l.level === level)?.name || `Level ${level}`;
  };

  return (
    <SystemConfigProvider config={{ activePlugins }}>
      <div className="flex flex-col gap-6 w-full">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
            <TabsList className="bg-slate-100/50 p-1 rounded-xl shrink-0 overflow-x-auto max-w-full">
              <TabsTrigger value="list" className="rounded-lg px-4 sm:px-6 py-2 transition-all">用户列表</TabsTrigger>
              <TabsTrigger value="balance" className="rounded-lg px-4 sm:px-6 py-2 transition-all">余额流水</TabsTrigger>
              <TabsTrigger value="points" className="rounded-lg px-4 sm:px-6 py-2 transition-all">积分流水</TabsTrigger>
              <TabsTrigger value="api" className="rounded-lg px-4 sm:px-6 py-2 transition-all">API 管理</TabsTrigger>
            </TabsList>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsLevelConfigOpen(true)}>
                <Settings className="w-4 h-4 mr-2" /> 等级名称
              </Button>
              <Button onClick={() => { setEditingUser(null); setFormData({ email: '', password: '', level: 1, status: 'active', nickname: '', avatar: '', phone: '', gender: 'unknown', birthday: '', bio: '' }); setIsOpen(true); }} className="bg-blue-600 text-white shadow-lg">
                <Plus className="w-4 h-4 mr-2" /> 新增会员
              </Button>
            </div>
          </div>

          {/* 1. User List Tab */}
          <TabsContent value="list" className="mt-0">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
              <table className="w-full min-w-[1000px] border-collapse text-left text-sm table-fixed">
                <thead className="bg-slate-50/50 border-b border-slate-200">
                  <tr>
                    <th className="w-[25%] px-6 py-4 font-semibold text-slate-900">会员基础资料</th>
                    <th className="w-[12%] px-6 py-4 font-semibold text-slate-900 text-center">等级/性别</th>
                    <th className="w-[15%] px-6 py-4 font-semibold text-slate-900 text-center">账户余额</th>
                    <th className="w-[15%] px-6 py-4 font-semibold text-slate-900 text-center">账户积分</th>
                    <th className="w-[13%] px-6 py-4 font-semibold text-slate-900 text-center">状态</th>
                    <th className="w-[20%] px-6 py-4 font-semibold text-slate-900 text-right">管理操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full ring-2 ring-slate-100 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                            {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : <UserCircle className="w-7 h-7 text-slate-300" />}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-slate-900 truncate">{user.nickname || '未设置昵称'}</span>
                            <span className="text-[10px] text-slate-400 font-mono truncate">{user.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-[10px] font-bold">{getLevelName(user.level)}</span>
                          <span className="text-[10px] text-slate-400">
                            {user.gender === 'male' ? '男' : user.gender === 'female' ? '女' : '保密'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 text-blue-600 font-bold font-mono">
                           <Wallet className="w-3.5 h-3.5" /> {user.balance || 0}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 text-orange-600 font-bold font-mono">
                           <Coins className="w-3.5 h-3.5" /> {user.points || 0}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${user.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                          {user.status === 'active' ? '正常运行' : '锁定禁用'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => { setAdjustType('balance'); setAdjustData({ ...adjustData, userId: user.id }); setIsAdjustOpen(true); }} className="h-8 px-2 text-[10px]"><CreditCard className="w-3 h-3 mr-1" /> 资产调整</Button>
                          <Button variant="outline" size="sm" onClick={() => { setEditingUser(user); setFormData({ email: user.email, password: '', level: user.level || 1, status: user.status, nickname: user.nickname || '', avatar: user.avatar || '', phone: user.phone || '', gender: user.gender || 'unknown', birthday: user.birthday || '', bio: user.bio || '' }); setIsOpen(true); }} className="h-8 w-8 p-0"><Edit className="w-3.5 h-3.5" /></Button>
                          <Button variant="outline" size="sm" onClick={() => { setUserToDelete(user.id); setIsDeleteOpen(true); }} className="h-8 w-8 p-0 text-rose-500 hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* 2. Balance Logs */}
          <TabsContent value="balance" className="mt-0">
             <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full border-collapse text-left text-sm table-fixed">
                   <thead className="bg-slate-50/50 border-b">
                      <tr>
                        <th className="w-[30%] px-6 py-4 font-semibold">会员账号</th>
                        <th className="w-[15%] px-6 py-4 font-semibold text-center">变动类型</th>
                        <th className="w-[15%] px-6 py-4 font-semibold text-center">变动数值</th>
                        <th className="w-[40%] px-6 py-4 font-semibold">操作备注 / 时间</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y">
                      {balanceLogs.map(log => (
                        <tr key={log.id} className="hover:bg-slate-50/50">
                          <td className="px-6 py-4">
                             <div className="flex flex-col">
                                <span className="font-medium text-slate-900">{log.nickname || '系统会员'}</span>
                                <span className="text-xs text-slate-400">{log.email}</span>
                             </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                             <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${log.type === 'add' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                {log.type === 'add' ? '调增' : log.type === 'sub' ? '调减' : '重置'}
                             </span>
                          </td>
                          <td className="px-6 py-4 text-center font-bold font-mono text-blue-600">
                             {log.type === 'sub' ? '-' : '+'}{log.amount}
                          </td>
                          <td className="px-6 py-4">
                             <div className="flex flex-col">
                                <span className="text-slate-600">{log.remark || '无备注'}</span>
                                <span className="text-[10px] text-slate-400">{new Date(log.createdAt).toLocaleString()} ({log.before} → {log.after})</span>
                             </div>
                          </td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </TabsContent>

          {/* 3. Points Logs */}
          <TabsContent value="points" className="mt-0">
             <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full border-collapse text-left text-sm table-fixed">
                   <thead className="bg-slate-50/50 border-b">
                      <tr>
                        <th className="w-[30%] px-6 py-4 font-semibold">会员账号</th>
                        <th className="w-[15%] px-6 py-4 font-semibold text-center">变动类型</th>
                        <th className="w-[15%] px-6 py-4 font-semibold text-center">变动数值</th>
                        <th className="w-[40%] px-6 py-4 font-semibold">操作备注 / 时间</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y">
                      {pointsLogs.map(log => (
                        <tr key={log.id} className="hover:bg-slate-50/50">
                          <td className="px-6 py-4">{log.email}</td>
                          <td className="px-6 py-4 text-center">
                             <span className="px-2 py-0.5 bg-orange-50 text-orange-600 rounded text-[10px] font-bold">{log.type}</span>
                          </td>
                          <td className="px-6 py-4 text-center font-bold font-mono text-orange-600">{log.amount}</td>
                          <td className="px-6 py-4">
                             <div className="flex flex-col">
                                <span className="text-slate-600">{log.remark}</span>
                                <span className="text-[10px] text-slate-400">{new Date(log.createdAt).toLocaleString()} ({log.before} → {log.after})</span>
                             </div>
                          </td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </TabsContent>

          {/* 4. API Management Tab (Restored) */}
          <TabsContent value="api" className="mt-0 space-y-6">
            <div className="flex justify-end">
              <Button onClick={() => setIsIssueTokenOpen(true)} className="bg-slate-900 text-white shadow-lg">
                <Key className="w-4 h-4 mr-2" /> 颁发全新 API 令牌
              </Button>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-sm text-slate-600 table-fixed">
                <thead className="bg-slate-50/50 border-b">
                  <tr>
                    <th className="w-[30%] px-6 py-4 font-semibold">持有会员</th>
                    <th className="w-[20%] px-6 py-4 font-semibold">令牌名称</th>
                    <th className="w-[30%] px-6 py-4 font-semibold">令牌摘要</th>
                    <th className="w-[20%] px-6 py-4 font-semibold text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {apiTokens.map(token => (
                    <tr key={token.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 font-medium text-slate-900">{token.email}</td>
                      <td className="px-6 py-4">{token.name}</td>
                      <td className="px-6 py-4 font-mono text-xs text-blue-600">{token.token.substring(0, 12)}...</td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => handleRevokeToken(token.id)} className="text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>

        {/* --- Dialogs --- */}

        {/* Level Config Dialog (Restored) */}
        <Dialog open={isLevelConfigOpen} onOpenChange={setIsLevelConfigOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>会员等级名称配置</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              {[1, 2, 3, 4, 5].map(lv => (
                <div key={lv} className="flex items-center gap-4">
                  <div className="w-12 h-10 rounded bg-slate-100 flex items-center justify-center font-bold text-xs">LV.{lv}</div>
                  <Input 
                    value={tempLevels.find(l => l.level === lv)?.name || ''} 
                    onChange={e => {
                      const updated = [...tempLevels];
                      const idx = updated.findIndex(l => l.level === lv);
                      if (idx > -1) updated[idx].name = e.target.value;
                      else updated.push({ level: lv, name: e.target.value });
                      setTempLevels(updated);
                    }}
                    placeholder={`输入 LV.${lv} 的展示名称`}
                  />
                </div>
              ))}
            </div>
            <DialogFooter><Button onClick={saveLevelConfigs} loading={isLoading} className="w-full bg-blue-600 text-white">保存配置</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        {/* API Token Issue Dialog (Restored) */}
        <Dialog open={isIssueTokenOpen} onOpenChange={setIsIssueTokenOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>颁发 API 令牌</DialogTitle></DialogHeader>
            <form onSubmit={handleIssueToken} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>选择会员</Label>
                <Select value={issueData.userId} onValueChange={v => setIssueData({ ...issueData, userId: v })}>
                  {users.map(u => <SelectItem key={u.id} value={u.id}>{u.nickname || u.email}</SelectItem>)}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>令牌用途名称</Label>
                <Input value={issueData.name} onChange={e => setIssueData({ ...issueData, name: e.target.value })} placeholder="例如：外部系统集成" required />
              </div>
              {newlyIssuedToken && (
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-lg space-y-2">
                  <p className="text-[10px] text-emerald-700 font-bold uppercase">颁发成功！请立即复制保存（仅显示一次）：</p>
                  <p className="font-mono text-sm break-all select-all">{newlyIssuedToken}</p>
                </div>
              )}
              <DialogFooter><Button type="submit" loading={isLoading} className="w-full bg-slate-900 text-white">确认颁发</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* User Form Dialog */}
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingUser ? '编辑会员资料' : '创建新会员'}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-8 py-4">
              <AvatarUpload value={formData.avatar} onChange={url => setFormData({ ...formData, avatar: url })} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2"><Label>电子邮箱</Label><Input value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required /></div>
                <div className="space-y-2"><Label>会员昵称</Label><Input value={formData.nickname} onChange={e => setFormData({...formData, nickname: e.target.value})} /></div>
                <div className="space-y-2"><Label>手机号码</Label><Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /></div>
                <div className="space-y-2"><Label>会员等级</Label><Select value={formData.level.toString()} onValueChange={v => setFormData({...formData, level: parseInt(v)})}>{[1,2,3,4,5].map(lv => <SelectItem key={lv} value={lv.toString()}>{getLevelName(lv)}</SelectItem>)}</Select></div>
                <div className="space-y-2"><Label>性别</Label><Select value={formData.gender} onValueChange={v => setFormData({...formData, gender: v})}><SelectItem value="unknown">保密</SelectItem><SelectItem value="male">男性</SelectItem><SelectItem value="female">女性</SelectItem></Select></div>
                <div className="space-y-2"><Label>生日日期</Label><Input type="date" value={formData.birthday} onChange={e => setFormData({...formData, birthday: e.target.value})} /></div>
                {!editingUser && <div className="space-y-2 col-span-2"><Label>初始密码</Label><Input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required /></div>}
              </div>
              <div className="space-y-2"><Label>个性签名</Label><textarea className="w-full min-h-[80px] p-3 rounded-lg border border-slate-200 text-sm outline-none" value={formData.bio} onChange={e => setFormData({...formData, bio: e.target.value})} /></div>
              <DialogFooter className="sticky bottom-0 bg-white pt-4 border-t">
                {error && <p className="text-xs text-rose-500 flex-1">{error}</p>}
                <Button type="submit" loading={isLoading} className="w-full sm:w-auto bg-blue-600 text-white px-8">保存将会员数据</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Asset Adjustment Dialog */}
        <Dialog open={isAdjustOpen} onOpenChange={setIsAdjustOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>调整用户资产 ({adjustType === 'balance' ? '余额' : '积分'})</DialogTitle></DialogHeader>
            <form onSubmit={handleAdjustSubmit} className="space-y-6 pt-4">
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>变动类型</Label><Select value={adjustData.type} onValueChange={v => setAdjustData({...adjustData, type: v})}><SelectItem value="add">增加 (+)</SelectItem><SelectItem value="sub">减少 (-)</SelectItem><SelectItem value="set">重置 (=)</SelectItem></Select></div>
                  <div className="space-y-2"><Label>数值</Label><Input type="number" value={adjustData.amount} onChange={e => setAdjustData({...adjustData, amount: parseInt(e.target.value) || 0})} /></div>
               </div>
               <div className="space-y-2"><Label>操作备注</Label><Input value={adjustData.remark} onChange={e => setAdjustData({...adjustData, remark: e.target.value})} required /></div>
               <DialogFooter><Button type="submit" loading={isLoading} className="w-full bg-slate-900 text-white">确认并应用变动</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <ConfirmDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen} onConfirm={handleDelete} title="确认删除该会员吗？" description="此操作将永久抹除该会员的所有资产与关联记录，不可撤销。" />
      </div>
    </SystemConfigProvider>
  );
};
