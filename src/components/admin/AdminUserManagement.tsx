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
  Check, Loader2, ChevronRight, ChevronLeft, MapPin, Phone, History, Shield, Info, Search
} from 'lucide-react';
import Cropper from 'react-easy-crop';
import imageCompression from 'browser-image-compression';

// --- Helper: Debounce Hook ---
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

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
      ctx.drawImage(img, croppedAreaPixels.x, croppedAreaPixels.y, croppedAreaPixels.width, croppedAreaPixels.height, 0, 0, croppedAreaPixels.width, croppedAreaPixels.height);
      const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.9));
      const compressedFile = await imageCompression(new File([blob], "avatar.jpg", { type: "image/jpeg" }), { maxSizeMB: 0.1, maxWidthOrHeight: 400, useWebWorker: true });
      const finalReader = new FileReader();
      finalReader.readAsDataURL(compressedFile);
      finalReader.onloadend = () => {
        onChange(finalReader.result as string);
        setIsCropping(false);
        setImage(null);
      };
    } catch (e) { console.error(e); }
    finally { setIsUploading(false); }
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
  id: string; email: string; userType: 'member'; status: 'active' | 'inactive' | 'banned';
  createdAt: Date | string; level: number; nickname?: string; avatar?: string;
  phone?: string; gender?: 'unknown' | 'male' | 'female'; birthday?: string;
  bio?: string; balance: number; points: number;
}

interface UserListProps {
  users: SystemUser[];
  activePlugins?: string[];
}

export const AdminUserManagement: React.FC<UserListProps> = ({ activePlugins = [] }) => {
  // State for Users & Pagination
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 500);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [activeTab, setActiveTab] = useState('list');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Other States
  const [isOpen, setIsOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [isLevelConfigOpen, setIsLevelConfigOpen] = useState(false);
  const [levelConfigs, setLevelConfigs] = useState<{level: number, name: string}[]>([]);
  const [tempLevels, setTempLevels] = useState<{level: number, name: string}[]>([]);
  const [balanceLogs, setBalanceLogs] = useState<any[]>([]);
  const [pointsLogs, setPointsLogs] = useState<any[]>([]);
  const [balancePagination, setBalancePagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [pointsPagination, setPointsPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [balanceSearch, setBalanceSearch] = useState('');
  const [pointsSearch, setPointsSearch] = useState('');
  const debouncedBalanceSearch = useDebounce(balanceSearch, 500);
  const debouncedPointsSearch = useDebounce(pointsSearch, 500);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [adjustType, setAdjustType] = useState<'balance' | 'points'>('balance');
  const [adjustData, setAdjustData] = useState({ userId: '', type: 'add' as any, amount: 0, remark: '' });
  const [apiTokens, setApiTokens] = useState<any[]>([]);
  const [isIssueTokenOpen, setIsIssueTokenOpen] = useState(false);
  const [issueData, setIssueData] = useState({ userId: '', name: '' });
  const [newlyIssuedToken, setNewlyIssuedToken] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: '', password: '', level: 1, status: 'active' as any,
    nickname: '', avatar: '', phone: '', gender: 'unknown' as any,
    birthday: '', bio: ''
  });

  const fetchData = async (page = pagination.page, search = debouncedSearch) => {
    setIsLoading(true);
    try {
      const uRes = await fetch(`/api/v1/users?page=${page}&pageSize=${pagination.pageSize}&search=${encodeURIComponent(search)}`);
      const uData = await uRes.json();
      if (uData.success) {
        setUsers(uData.data);
        setPagination(prev => ({ ...prev, ...uData.meta }));
      }
      
      const lRes = await fetch('/api/v1/settings/member_levels');
      const lData = await lRes.json();
      if (lData.success) {
        setLevelConfigs(lData.data);
        setTempLevels(lData.data);
      }
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  const fetchLogsAndTokens = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'balance') {
        const res = await fetch(`/api/v1/users/balance/logs?page=${balancePagination.page}&pageSize=${balancePagination.pageSize}&search=${encodeURIComponent(debouncedBalanceSearch)}`);
        const data = await res.json();
        if (data.success) {
          setBalanceLogs(data.data);
          setBalancePagination(prev => ({ ...prev, ...data.meta }));
        }
      } else if (activeTab === 'points') {
        const res = await fetch(`/api/v1/users/points/logs?page=${pointsPagination.page}&pageSize=${pointsPagination.pageSize}&search=${encodeURIComponent(debouncedPointsSearch)}`);
        const data = await res.json();
        if (data.success) {
          setPointsLogs(data.data);
          setPointsPagination(prev => ({ ...prev, ...data.meta }));
        }
      } else if (activeTab === 'api') {
        const res = await fetch('/api/v1/users/tokens/all');
        const data = await res.json();
        if (data.success) setApiTokens(data.data);
      }
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { fetchData(1, debouncedSearch); }, [debouncedSearch]);
  useEffect(() => { if (activeTab === 'list') fetchData(pagination.page); }, [pagination.page]);
  useEffect(() => { if (activeTab === 'balance') fetchLogsAndTokens(); }, [activeTab, balancePagination.page, debouncedBalanceSearch]);
  useEffect(() => { if (activeTab === 'points') fetchLogsAndTokens(); }, [activeTab, pointsPagination.page, debouncedPointsSearch]);
  useEffect(() => { if (activeTab === 'api') fetchLogsAndTokens(); }, [activeTab]);

  // Handlers (Simplified for brevity, but same logic)
  const handleIssueToken = async (e: React.FormEvent) => { e.preventDefault(); setIsLoading(true); try { const res = await fetch(`/api/v1/users/${issueData.userId}/tokens`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: issueData.name }) }); const result = await res.json(); if (result.success) { setNewlyIssuedToken(result.token); fetchLogsAndTokens(); } } catch (e) { setError('令牌颁发失败'); } finally { setIsLoading(false); } };
  const handleRevokeToken = async (tokenId: number) => { if (!confirm('确定要撤销此 API 令牌吗？')) return; try { await fetch(`/api/v1/users/tokens/${tokenId}`, { method: 'DELETE' }); setApiTokens(apiTokens.filter(t => t.id !== tokenId)); } catch (e) { setError('撤销失败'); } };
  const saveLevelConfigs = async () => { setIsLoading(true); try { await fetch('/api/v1/settings/member_levels', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tempLevels) }); setLevelConfigs(tempLevels); setIsLevelConfigOpen(false); } catch (e) { setError('保存失败'); } finally { setIsLoading(false); } };
  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // 如果是余额调整，将输入的元转换为分
      const finalAmount = adjustType === 'balance' 
        ? Math.round(adjustData.amount * 100) 
        : Math.round(adjustData.amount);
        
      const res = await fetch(`/api/v1/users/${adjustType}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...adjustData, amount: finalAmount })
      });
      if ((await res.json()).success) {
        setIsAdjustOpen(false);
        fetchLogsAndTokens();
        fetchData();
      }
    } catch (e) {
      setError('调整失败');
    } finally {
      setIsLoading(false);
    }
  };
  const handleSubmit = async (e: React.FormEvent) => { e.preventDefault(); setIsLoading(true); try { const url = editingUser ? `/api/v1/users/${editingUser.id}` : '/api/v1/users'; const method = editingUser ? 'PUT' : 'POST'; const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) }); if (res.ok) { setIsOpen(false); fetchData(); } else { const err = await res.json(); setError(err.error || '操作失败'); } } catch (e) { setError('系统错误'); } finally { setIsLoading(false); } };
  const handleDelete = async () => { if (!userToDelete) return; setIsLoading(true); try { const res = await fetch(`/api/v1/users/${userToDelete}`, { method: 'DELETE' }); if (res.ok) { fetchData(); setIsDeleteOpen(false); } else { setError('删除失败'); } } catch (e) { setError('系统错误'); } finally { setIsLoading(false); } };
  const getLevelName = (level: number) => { return levelConfigs.find(l => l.level === level)?.name || `Level ${level}`; };

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
            {activeTab === 'list' && (
              <div className="flex gap-2 transition-all">
                <Button variant="outline" onClick={() => setIsLevelConfigOpen(true)}><Settings className="w-4 h-4 mr-2" /> 等级名称</Button>
                <Button onClick={() => { setEditingUser(null); setFormData({ email: '', password: '', level: 1, status: 'active', nickname: '', avatar: '', phone: '', gender: 'unknown', birthday: '', bio: '' }); setIsOpen(true); }} className="bg-blue-600 text-white shadow-lg"><Plus className="w-4 h-4 mr-2" /> 新增会员</Button>
              </div>
            )}
          </div>

          <TabsContent value="list" className="mt-0 space-y-4">
            {/* Real Search & Summary */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
               <div className="relative w-full sm:w-[400px]">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                 <Input value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setPagination(p => ({ ...p, page: 1 })); }} className="pl-10 h-11 bg-slate-50 border-none rounded-xl" placeholder="搜邮箱或昵称 (支持全库检索)..." />
                 {isLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 animate-spin" />}
               </div>
               <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg font-bold">
                    <User className="w-3.5 h-3.5" /> 总计 {pagination.total} 位会员
                  </div>
               </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto relative min-h-[400px]">
              <table className="w-full min-w-[1000px] border-collapse text-left text-sm table-fixed">
                <thead className="bg-slate-50/50 border-b border-slate-200">
                  <tr>
                    <th className="w-[24%] px-6 py-4 font-semibold text-slate-900">会员基础资料</th>
                    <th className="w-[12%] px-6 py-4 font-semibold text-slate-900 text-center">等级/性别</th>
                    <th className="w-[17%] px-6 py-4 font-semibold text-slate-900 text-center">账户余额</th>
                    <th className="w-[17%] px-6 py-4 font-semibold text-slate-900 text-center">账户积分</th>
                    <th className="w-[12%] px-6 py-4 font-semibold text-slate-900 text-center">状态</th>
                    <th className="w-[18%] px-6 py-4 font-semibold text-slate-900 text-right">基础管理</th>
                  </tr>
                </thead>
                <tbody className={`divide-y divide-slate-100 ${isLoading ? 'opacity-40' : 'opacity-100'} transition-opacity`}>
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-4"><div className="flex items-center gap-4"><div className="w-10 h-10 rounded-full ring-2 ring-slate-100 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">{user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : <UserCircle className="w-7 h-7 text-slate-300" />}</div><div className="flex flex-col min-w-0"><span className="font-bold text-slate-900 truncate">{user.nickname || '未设置昵称'}</span><span className="text-[10px] text-slate-400 font-mono truncate">{user.email}</span></div></div></td>
                      <td className="px-6 py-4 text-center"><div className="flex flex-col items-center gap-1"><span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-[10px] font-bold">{getLevelName(user.level)}</span><span className="text-[10px] text-slate-400">{user.gender === 'male' ? '男' : user.gender === 'female' ? '女' : '保密'}</span></div></td>
                      <td className="px-6 py-4"><div className="flex flex-col items-center gap-1.5"><div className="flex items-center gap-2 text-blue-600 font-bold font-mono"><Wallet className="w-3.5 h-3.5" /> {(user.balance / 100).toFixed(2)}</div><Button variant="outline" size="sm" onClick={() => { setAdjustType('balance'); setAdjustData({ userId: user.id, type: 'add', amount: 0, remark: '' }); setIsAdjustOpen(true); }} className="h-6 px-2 text-[9px] text-blue-600 border-blue-100 hover:bg-blue-50"><Plus className="w-2.5 h-2.5 mr-1" /> 余额调整</Button></div></td>
                      <td className="px-6 py-4"><div className="flex flex-col items-center gap-1.5"><div className="flex items-center gap-2 text-orange-600 font-bold font-mono"><Coins className="w-3.5 h-3.5" /> {user.points || 0}</div><Button variant="outline" size="sm" onClick={() => { setAdjustType('points'); setAdjustData({ userId: user.id, type: 'add', amount: 0, remark: '' }); setIsAdjustOpen(true); }} className="h-6 px-2 text-[9px] text-orange-600 border-orange-100 hover:bg-orange-50"><Plus className="w-2.5 h-2.5 mr-1" /> 积分调整</Button></div></td>
                      <td className="px-6 py-4 text-center"><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${user.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{user.status === 'active' ? '正常运行' : '锁定禁用'}</span></td>
                      <td className="px-6 py-4 text-right"><div className="flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => { setEditingUser(user); setFormData({ email: user.email, password: '', level: user.level || 1, status: user.status, nickname: user.nickname || '', avatar: user.avatar || '', phone: user.phone || '', gender: user.gender || 'unknown', birthday: user.birthday || '', bio: user.bio || '' }); setIsOpen(true); }} className="h-9 w-9 p-0 hover:bg-blue-50"><Edit className="w-4 h-4" /></Button><Button variant="outline" size="sm" onClick={() => { setUserToDelete(user.id); setIsDeleteOpen(true); }} className="h-9 w-9 p-0 text-rose-500 hover:bg-rose-50"><Trash2 className="w-4 h-4" /></Button></div></td>
                    </tr>
                  ))}
                  {users.length === 0 && !isLoading && (
                    <tr><td colSpan={6} className="py-20 text-center text-slate-400">未找到符合条件的会员</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200">
               <div className="text-xs text-slate-500 font-medium">第 {pagination.page} / {pagination.totalPages} 页</div>
               <div className="flex items-center gap-2">
                 <Button variant="outline" size="sm" disabled={pagination.page <= 1 || isLoading} onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))} className="h-9 px-3"><ChevronLeft className="w-4 h-4 mr-1" /> 上一页</Button>
                 <div className="flex gap-1">
                    {[...Array(Math.min(5, pagination.totalPages))].map((_, i) => {
                      const pageNum = pagination.page <= 3 ? i + 1 : (pagination.page >= pagination.totalPages - 2 ? pagination.totalPages - 4 + i : pagination.page - 2 + i);
                      if (pageNum <= 0 || pageNum > pagination.totalPages) return null;
                      return (
                        <Button key={pageNum} variant={pagination.page === pageNum ? 'default' : 'outline'} size="sm" onClick={() => setPagination(p => ({ ...p, page: pageNum }))} className={`h-9 w-9 p-0 ${pagination.page === pageNum ? 'bg-blue-600 text-white' : ''}`}>{pageNum}</Button>
                      );
                    })}
                 </div>
                 <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages || isLoading} onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))} className="h-9 px-3">下一页 <ChevronRight className="w-4 h-4 ml-1" /></Button>
               </div>
            </div>
          </TabsContent>

          {/* Logs & API Tabs (Unchanged logic but same layout) */}
          <TabsContent value="balance" className="mt-0 space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
               <div className="relative w-full sm:w-[400px]">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                 <Input value={balanceSearch} onChange={e => { setBalanceSearch(e.target.value); setBalancePagination(p => ({ ...p, page: 1 })); }} className="pl-10 h-11 bg-slate-50 border-none rounded-xl" placeholder="搜索邮箱、昵称或备注..." />
               </div>
               <div className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg">共 {balancePagination.total} 条记录</div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full border-collapse text-left text-sm table-fixed">
                <thead className="bg-slate-50/50 border-b">
                  <tr><th className="w-[30%] px-6 py-4 font-semibold">会员账号</th><th className="w-[15%] px-6 py-4 font-semibold text-center">类型</th><th className="w-[15%] px-6 py-4 font-semibold text-center">变动数值</th><th className="w-[40%] px-6 py-4 font-semibold">操作备注 / 时间</th></tr>
                </thead>
                <tbody className="divide-y">
                  {balanceLogs.map(log => (<tr key={log.id} className="hover:bg-slate-50/50"><td className="px-6 py-4"><div className="flex flex-col"><span className="font-medium text-slate-900">{log.nickname || '系统会员'}</span><span className="text-xs text-slate-400">{log.email}</span></div></td><td className="px-6 py-4 text-center"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${log.type === 'add' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{log.type === 'add' ? '调增' : log.type === 'sub' ? '调减' : '重置'}</span></td><td className="px-6 py-4 text-center font-bold font-mono text-blue-600">{log.type === 'sub' ? '-' : '+'}{(log.amount / 100).toFixed(2)}</td><td className="px-6 py-4"><div className="flex flex-col"><span className="text-slate-600">{log.remark || '无备注'}</span><span className="text-[10px] text-slate-400">{new Date(log.createdAt).toLocaleString()} ({(log.before / 100).toFixed(2)} → {(log.after / 100).toFixed(2)})</span></div></td></tr>))}
                  {balanceLogs.length === 0 && !isLoading && <tr><td colSpan={4} className="py-20 text-center text-slate-400">暂无相关流水记录</td></tr>}
                </tbody>
              </table>
            </div>
            {/* Pagination for Balance */}
            {balancePagination.totalPages > 1 && (
              <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200">
                 <div className="text-xs text-slate-500">第 {balancePagination.page} / {balancePagination.totalPages} 页</div>
                 <div className="flex gap-2">
                   <Button variant="outline" size="sm" disabled={balancePagination.page <= 1 || isLoading} onClick={() => setBalancePagination(p => ({ ...p, page: p.page - 1 }))} className="h-9 px-3"><ChevronLeft className="w-4 h-4 mr-1" /> 上一页</Button>
                   <Button variant="outline" size="sm" disabled={balancePagination.page >= balancePagination.totalPages || isLoading} onClick={() => setBalancePagination(p => ({ ...p, page: p.page + 1 }))} className="h-9 px-3">下一页 <ChevronRight className="w-4 h-4 ml-1" /></Button>
                 </div>
              </div>
            )}
          </TabsContent>
          <TabsContent value="points" className="mt-0 space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
               <div className="relative w-full sm:w-[400px]">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                 <Input value={pointsSearch} onChange={e => { setPointsSearch(e.target.value); setPointsPagination(p => ({ ...p, page: 1 })); }} className="pl-10 h-11 bg-slate-50 border-none rounded-xl" placeholder="搜索邮箱、昵称或备注..." />
               </div>
               <div className="text-xs font-bold text-orange-600 bg-orange-50 px-3 py-1.5 rounded-lg">共 {pointsPagination.total} 条记录</div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full border-collapse text-left text-sm table-fixed">
                <thead className="bg-slate-50/50 border-b">
                  <tr><th className="w-[30%] px-6 py-4 font-semibold">会员账号</th><th className="w-[15%] px-6 py-4 font-semibold text-center">类型</th><th className="w-[15%] px-6 py-4 font-semibold text-center">变动数值</th><th className="w-[40%] px-6 py-4 font-semibold">操作备注 / 时间</th></tr>
                </thead>
                <tbody className="divide-y">
                  {pointsLogs.map(log => (<tr key={log.id} className="hover:bg-slate-50/50"><td className="px-6 py-4"><div className="flex flex-col"><span className="font-medium text-slate-900">{log.nickname || '系统会员'}</span><span className="text-xs text-slate-400">{log.email}</span></div></td><td className="px-6 py-4 text-center"><span className="px-2 py-0.5 bg-orange-50 text-orange-600 rounded text-[10px] font-bold">{log.type}</span></td><td className="px-6 py-4 text-center font-bold font-mono text-orange-600">{log.amount}</td><td className="px-6 py-4"><div className="flex flex-col"><span className="text-slate-600">{log.remark}</span><span className="text-[10px] text-slate-400">{new Date(log.createdAt).toLocaleString()} ({log.before} → {log.after})</span></div></td></tr>))}
                  {pointsLogs.length === 0 && !isLoading && <tr><td colSpan={4} className="py-20 text-center text-slate-400">暂无相关积分记录</td></tr>}
                </tbody>
              </table>
            </div>
            {/* Pagination for Points */}
            {pointsPagination.totalPages > 1 && (
              <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200">
                 <div className="text-xs text-slate-500">第 {pointsPagination.page} / {pointsPagination.totalPages} 页</div>
                 <div className="flex gap-2">
                   <Button variant="outline" size="sm" disabled={pointsPagination.page <= 1 || isLoading} onClick={() => setPointsPagination(p => ({ ...p, page: p.page - 1 }))} className="h-9 px-3"><ChevronLeft className="w-4 h-4 mr-1" /> 上一页</Button>
                   <Button variant="outline" size="sm" disabled={pointsPagination.page >= pointsPagination.totalPages || isLoading} onClick={() => setPointsPagination(p => ({ ...p, page: p.page + 1 }))} className="h-9 px-3">下一页 <ChevronRight className="w-4 h-4 ml-1" /></Button>
                 </div>
              </div>
            )}
          </TabsContent>
          <TabsContent value="api" className="mt-0 space-y-6"><div className="flex justify-end"><Button onClick={() => setIsIssueTokenOpen(true)} className="bg-slate-900 text-white shadow-lg"><Key className="w-4 h-4 mr-2" /> 颁发全新 API 令牌</Button></div><div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"><table className="w-full text-sm text-slate-600 table-fixed"><thead className="bg-slate-50/50 border-b"><tr><th className="w-[30%] px-6 py-4 font-semibold">持有会员</th><th className="w-[20%] px-6 py-4 font-semibold">令牌名称</th><th className="w-[30%] px-6 py-4 font-semibold">令牌摘要</th><th className="w-[20%] px-6 py-4 font-semibold text-right">操作</th></tr></thead><tbody className="divide-y">{apiTokens.map(token => (<tr key={token.id} className="hover:bg-slate-50/50"><td className="px-6 py-4 font-medium text-slate-900">{token.email}</td><td className="px-6 py-4">{token.name}</td><td className="px-6 py-4 font-mono text-xs text-blue-600">{token.token.substring(0, 12)}...</td><td className="px-6 py-4 text-right"><button onClick={() => handleRevokeToken(token.id)} className="text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button></td></tr>))}</tbody></table></div></TabsContent>
        </Tabs>

        {/* --- Dialogs --- */}
        <Dialog open={isLevelConfigOpen} onOpenChange={setIsLevelConfigOpen}><DialogContent><DialogHeader><DialogTitle>会员等级名称配置</DialogTitle></DialogHeader><div className="space-y-4 py-4">{[1, 2, 3, 4, 5].map(lv => (<div key={lv} className="flex items-center gap-4"><div className="w-12 h-10 rounded bg-slate-100 flex items-center justify-center font-bold text-xs">LV.{lv}</div><Input value={tempLevels.find(l => l.level === lv)?.name || ''} onChange={e => { const updated = [...tempLevels]; const idx = updated.findIndex(l => l.level === lv); if (idx > -1) updated[idx].name = e.target.value; else updated.push({ level: lv, name: e.target.value }); setTempLevels(updated); }} placeholder={`输入 LV.${lv} 的展示名称`} /></div>))}</div><DialogFooter><Button onClick={saveLevelConfigs} loading={isLoading} className="w-full bg-blue-600 text-white">保存配置</Button></DialogFooter></DialogContent></Dialog>
        <Dialog open={isIssueTokenOpen} onOpenChange={setIsIssueTokenOpen}><DialogContent><DialogHeader><DialogTitle>颁发 API 令牌</DialogTitle></DialogHeader><form onSubmit={handleIssueToken} className="space-y-4 pt-4"><div className="space-y-2"><Label>选择会员</Label><Select value={issueData.userId} onValueChange={v => setIssueData({ ...issueData, userId: v })}>{users.map(u => <SelectItem key={u.id} value={u.id}>{u.nickname || u.email}</SelectItem>)}</Select></div><div className="space-y-2"><Label>令牌用途名称</Label><Input value={issueData.name} onChange={e => setIssueData({ ...issueData, name: e.target.value })} placeholder="例如：外部系统集成" required /></div>{newlyIssuedToken && (<div className="p-4 bg-emerald-50 border border-emerald-100 rounded-lg space-y-2"><p className="text-[10px] text-emerald-700 font-bold uppercase">颁发成功！请立即复制保存：</p><p className="font-mono text-sm break-all select-all">{newlyIssuedToken}</p></div>)}<DialogFooter><Button type="submit" loading={isLoading} className="w-full bg-slate-900 text-white">确认颁发</Button></DialogFooter></form></DialogContent></Dialog>
        <Dialog open={isOpen} onOpenChange={setIsOpen}><DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{editingUser ? '编辑会员资料' : '创建新会员'}</DialogTitle></DialogHeader><form onSubmit={handleSubmit} className="space-y-8 py-4"><AvatarUpload value={formData.avatar} onChange={url => setFormData({ ...formData, avatar: url })} /><div className="grid grid-cols-1 sm:grid-cols-2 gap-6"><div className="space-y-2"><Label>电子邮箱</Label><Input value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required /></div><div className="space-y-2"><Label>会员昵称</Label><Input value={formData.nickname} onChange={e => setFormData({...formData, nickname: e.target.value})} /></div><div className="space-y-2"><Label>手机号码</Label><Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /></div><div className="space-y-2"><Label>会员等级</Label><Select value={formData.level.toString()} onValueChange={v => setFormData({...formData, level: parseInt(v)})}>{[1,2,3,4,5].map(lv => <SelectItem key={lv} value={lv.toString()}>{getLevelName(lv)}</SelectItem>)}</Select></div><div className="space-y-2"><Label>性别</Label><Select value={formData.gender} onValueChange={v => setFormData({...formData, gender: v})}><SelectItem value="unknown">保密</SelectItem><SelectItem value="male">男性</SelectItem><SelectItem value="female">女性</SelectItem></Select></div><div className="space-y-2"><Label>生日日期</Label><Input type="date" value={formData.birthday} onChange={e => setFormData({...formData, birthday: e.target.value})} /></div>{!editingUser && <div className="space-y-2 col-span-2"><Label>初始密码</Label><Input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required /></div>}</div><div className="space-y-2"><Label>个性签名</Label><textarea className="w-full min-h-[80px] p-3 rounded-lg border border-slate-200 text-sm outline-none" value={formData.bio} onChange={e => setFormData({...formData, bio: e.target.value})} /></div><DialogFooter className="sticky bottom-0 bg-white pt-4 border-t">{error && <p className="text-xs text-rose-500 flex-1">{error}</p>}<Button type="submit" loading={isLoading} className="w-full sm:w-auto bg-blue-600 text-white px-8">保存会员数据</Button></DialogFooter></form></DialogContent></Dialog>
        <Dialog open={isAdjustOpen} onOpenChange={setIsAdjustOpen}><DialogContent><DialogHeader><DialogTitle>调整用户资产 ({adjustType === 'balance' ? '余额' : '积分'})</DialogTitle></DialogHeader><form onSubmit={handleAdjustSubmit} className="space-y-6 pt-4"><div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>变动类型</Label><Select value={adjustData.type} onValueChange={v => setAdjustData({...adjustData, type: v})}><SelectItem value="add">增加 (+)</SelectItem><SelectItem value="sub">减少 (-)</SelectItem><SelectItem value="set">重置 (=)</SelectItem></Select></div><div className="space-y-2"><Label>数值 ({adjustType === 'balance' ? '元' : '分'})</Label><Input type="number" step={adjustType === 'balance' ? "0.01" : "1"} value={adjustData.amount} onChange={e => setAdjustData({...adjustData, amount: parseFloat(e.target.value) || 0})} /></div></div><div className="space-y-2"><Label>操作备注</Label><Input value={adjustData.remark} onChange={e => setAdjustData({...adjustData, remark: e.target.value})} required /></div><DialogFooter><Button type="submit" loading={isLoading} className="w-full bg-slate-900 text-white">确认并应用变动</Button></DialogFooter></form></DialogContent></Dialog>
        <ConfirmDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen} onConfirm={handleDelete} title="确认删除该会员吗？" description="此操作将永久抹除该会员的所有资产与关联记录，不可撤销。" />
      </div>
    </SystemConfigProvider>
  );
};
