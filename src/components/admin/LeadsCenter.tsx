import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  MessageSquare, 
  Clock, 
  ExternalLink, 
  CheckCircle2, 
  PauseCircle, 
  XSquare, 
  Loader2, 
  Info, 
  ArrowRight,
  Send,
  User,
  Mail,
  Building2,
  Globe
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { useToast } from '../ui/Toaster';

const formatDate = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch (e) {
    return dateStr;
  }
};

interface Lead {
  id: number;
  sourceName: string;
  collectionSlug: string;
  data: Record<string, any>;
  meta: {
    visitor_tracking?: {
      entry_url?: string;
      submit_url?: string;
      visit_count?: number;
      ip?: string;
    };
    crm_governance?: {
      status: 'pending' | 'processing' | 'closed' | 'junk';
      notes: Array<{ time: string; content: string; user: string }>;
    };
  };
  createdAt: string;
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: '待处理', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: Clock },
  processing: { label: '进行中', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: PauseCircle },
  closed: { label: '已结案', color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2 },
  junk: { label: '垃圾', color: 'bg-slate-100 text-slate-500 border-slate-200', icon: XSquare },
};

export const LeadsCenter: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [newNote, setNewNote] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      const res = await fetch('/api/v1/crm/leads');
      const data = await res.json();
      setLeads(data);
    } catch (e) {
      toast({ variant: 'destructive', title: '加载失败', description: '无法获取线索中心数据' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id: number, status: string, note?: string) => {
    setSavingStatus(true);
    try {
      const res = await fetch(`/api/v1/crm/leads/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, note })
      });
      if (res.ok) {
        toast({ title: '保存成功' });
        fetchLeads(); // 刷新列表
        if (selectedLead?.id === id) {
           // 更新当前选中的详情
           const updated = await res.json();
           setSelectedLead(prev => prev ? { ...prev, meta: { ...prev.meta, crm_governance: updated.data } } : null);
        }
        setNewNote('');
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: '更新失败', description: e.message });
    } finally {
      setSavingStatus(false);
    }
  };

  // 提取通用字段
  const getCommonFields = (data: Record<string, any>) => {
    return {
      name: data.name || data.fullName || data.customer_name || 'Anonymous',
      email: data.email || data.Email || 'No Email',
      company: data.company || data.Company || data.org || '-',
    };
  };

  if (loading) {
    return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-blue-500" /></div>;
  }

  return (
    <div className="flex h-[calc(100vh-160px)] gap-6 overflow-hidden">
      {/* 列表页 - 70% 宽度 */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {leads.length === 0 ? (
          <Card className="text-center py-20 text-slate-400">
             <MessageSquare className="mx-auto mb-4 opacity-10" size={48} />
             暂无询盘线索
          </Card>
        ) : (
          leads.map(lead => {
            const { name, email, company } = getCommonFields(lead.data);
            const status = lead.meta?.crm_governance?.status || 'pending';
            const statusConfig = STATUS_MAP[status];
            const StatusIcon = statusConfig.icon;

            return (
              <Card 
                key={lead.id} 
                className={`cursor-pointer transition-all hover:border-blue-300 hover:shadow-md ${selectedLead?.id === lead.id ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-100 shadow-sm'}`}
                onClick={() => setSelectedLead(lead)}
              >
                <CardContent className="p-4 flex items-center gap-6">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                       <h3 className="font-bold text-slate-900 truncate">{name}</h3>
                       <Badge variant="outline" className={`text-[10px] ${statusConfig.color} border shadow-none flex items-center gap-1`}>
                          <StatusIcon size={10} /> {statusConfig.label}
                       </Badge>
                       <span className="text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">从 {lead.sourceName}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-xs text-slate-500">
                       <div className="flex items-center gap-1.5 truncate"><Mail size={12} className="text-slate-400" /> {email}</div>
                       <div className="flex items-center gap-1.5 truncate"><Building2 size={12} className="text-slate-400" /> {company}</div>
                       <div className="flex items-center gap-1.5"><Clock size={12} className="text-slate-400" /> {formatDate(lead.createdAt)}</div>
                    </div>
                  </div>
                  <ArrowRight className={`text-slate-300 transition-transform ${selectedLead?.id === lead.id ? 'translate-x-1 text-blue-500' : ''}`} size={16} />
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* 详情抽屉/侧边栏 - 30% 宽度 */}
      <div className={`w-[400px] border-l bg-white flex flex-col transition-all duration-300 flex-shrink-0 ${selectedLead ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'}`}>
        {selectedLead && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-6 border-b bg-slate-50/50">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-lg font-bold text-slate-900">线索详情</h2>
                <Button variant="ghost" size="sm" onClick={() => setSelectedLead(null)} className="h-8 w-8 p-0">×</Button>
              </div>

              {/* CRM 状态流转快捷操作 */}
              <div className="flex gap-1.5 bg-white p-1 rounded-lg border shadow-sm">
                {Object.entries(STATUS_MAP).map(([key, config]) => (
                  <button
                    key={key}
                    onClick={() => handleUpdateStatus(selectedLead.id, key)}
                    disabled={savingStatus}
                    className={`flex-1 flex flex-col items-center py-1.5 rounded-md text-[9px] font-bold transition-all ${selectedLead.meta?.crm_governance?.status === key ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}
                  >
                    <config.icon size={14} className="mb-0.5" />
                    {config.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* 访客足迹 */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Globe size={11} /> 访客足迹 (Digital Footprint)
                </h4>
                <div className="space-y-2 p-3 bg-slate-900 border border-slate-700 shadow-inner rounded-xl text-[10px] text-slate-400 font-mono">
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500 flex-shrink-0">Landing:</span>
                    <span className="text-emerald-500 truncate" title={selectedLead.meta?.visitor_tracking?.entry_url}>
                      {selectedLead.meta?.visitor_tracking?.entry_url || '-'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500 flex-shrink-0">Inquiry:</span>
                    <span className="text-blue-400 truncate" title={selectedLead.meta?.visitor_tracking?.submit_url}>
                      {selectedLead.meta?.visitor_tracking?.submit_url || '-'}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-800 pt-2 text-[9px]">
                    <span>Visit Count: <b className="text-white">{selectedLead.meta?.visitor_tracking?.visit_count || 1}</b></span>
                    <span>Geo: <b className="text-white">{selectedLead.meta?.visitor_tracking?.ip || 'Internal'}</b></span>
                  </div>
                </div>
              </div>

              {/* 源数据快照 */}
              <div className="space-y-3">
                 <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Info size={11} /> 表单原始数据
                </h4>
                <div className="grid grid-cols-2 gap-2">
                   {Object.entries(selectedLead.data).map(([key, val]) => (
                     <div key={key} className="p-2 border rounded-lg bg-slate-50/50">
                        <label className="block text-[9px] text-slate-400 truncate">{key}</label>
                        <div className="text-[11px] font-medium text-slate-700 truncate">{String(val)}</div>
                     </div>
                   ))}
                </div>
              </div>

              {/* CRM 跟进备注 */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <MessageSquare size={11} /> 跟进记录 (CRM Notes)
                </h4>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <textarea 
                      className="flex-1 border rounded-xl p-2.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none min-h-[60px]"
                      placeholder="录入跟进备注..."
                      value={newNote}
                      onChange={e => setNewNote(e.target.value)}
                    />
                    <Button 
                      size="sm" 
                      className="h-auto bg-blue-600 self-stretch px-3 rounded-xl"
                      disabled={!newNote.trim() || savingStatus}
                      onClick={() => handleUpdateStatus(selectedLead.id, selectedLead.meta?.crm_governance?.status || 'pending', newNote)}
                    >
                      {savingStatus ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {selectedLead.meta?.crm_governance?.notes?.map((note, idx) => (
                      <div key={idx} className="relative pl-4 border-l-2 border-slate-100">
                         <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-slate-200" />
                         <div className="text-[10px] text-slate-400 flex justify-between mb-1">
                            <span>{note.user}</span>
                            <span>{formatDate(note.time)}</span>
                         </div>
                         <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg">{note.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
