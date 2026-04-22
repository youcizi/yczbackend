import React, { useState, useEffect } from 'react';
import { Globe, Save, Loader2, Link, Layout, FileText, Zap, ShieldCheck, Image, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useToast } from '../ui/Toaster';

/**
 * 站点全局设置控制中心 (V2 - 宽幅 Tab 布局)
 */
export const GeneralSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'seo' | 'ops'>('seo');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // --- 数据状态定义 ---
  const [form, setForm] = useState({
    frontend_url: '',
    site_name: '',
    default_seo_templates: {
      title: '{{name}} - {{site_name}}',
      description: '{{description}}'
    }
  });

  const [dns, setDns] = useState({
    main_domain: '',
    admin_domain: '',
    api_domain: '',
    img_domain: ''
  });

  const [checkStatus, setCheckStatus] = useState<Record<string, 'idle' | 'loading' | 'ok' | 'err'>>({});

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/v1/settings/site_metadata').then(r => r.json()),
      fetch('/api/v1/settings/site_domains').then(r => r.json())
    ]).then(([metadata, dnsData]) => {
      if (metadata) setForm(metadata);
      if (dnsData) setDns(dnsData);
      setLoading(false);
    }).catch(() => {
      toast({ variant: 'destructive', title: '数据获取失败', description: '后台服务可能尚未启动' });
      setLoading(false);
    });
  }, [toast]);

  const handleSave = async (key: 'site_metadata' | 'site_domains', data: any) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/settings/${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        toast({ title: '配置已同步', description: '边缘缓存已全量清理', className: 'bg-blue-50' });
      } else throw new Error();
    } catch (e) {
      toast({ variant: 'destructive', title: '保存失败' });
    } finally { setSaving(false); }
  };

  const runCloudflareOp = async (type: 'admin'|'api'|'img', op: 'check'|'bind') => {
    const domain = dns[`${type}_domain` as keyof typeof dns] || `${type}.${dns.main_domain}`;
    if (!domain || domain.includes('..')) return;

    setCheckStatus(prev => ({ ...prev, [type]: 'loading' }));
    try {
      const endpoint = op === 'check' ? `/api/v1/infra/dns-check?domain=${domain}` : '/api/v1/infra/bind-domain';
      const res = await fetch(endpoint, op === 'check' ? undefined : {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, type })
      });
      const result = await res.json();
      
      if (result.success || (op === 'check' && result.cname_correct)) {
        setCheckStatus(prev => ({ ...prev, [type]: 'ok' }));
        toast({ title: op === 'check' ? '解析正常' : '云端同步成功', description: domain });
      } else {
        setCheckStatus(prev => ({ ...prev, [type]: 'err' }));
        toast({ variant: 'destructive', title: '操作被拒', description: result.recommendation || result.error });
      }
    } catch (e) { 
      setCheckStatus(prev => ({ ...prev, [type]: 'err' }));
    }
  };

  if (loading) return <div className="p-20 text-center space-y-4"><Loader2 className="animate-spin mx-auto text-blue-500" size={32} /><div>进入中控台...</div></div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      {/* 极简宽幅 Tab 切换器 */}
      <div className="flex bg-slate-100 p-1 rounded-2xl w-fit shadow-inner border border-slate-200">
        {[
          { id: 'seo', label: '常规 SEO 设置', icon: Globe },
          { id: 'ops', label: '自动化运维 & 域名集群', icon: Zap }
        ].map(tab => (
          <button 
            key={tab.id} 
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-3 px-10 py-3 rounded-xl text-sm font-black transition-all ${activeTab === tab.id ? 'bg-white shadow-xl text-blue-600 scale-[1.02]' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <tab.icon size={18} /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'seo' ? (
        <div className="animate-in fade-in slide-in-from-left-4 duration-500 space-y-6">
          <Card className="border-slate-100 shadow-xl shadow-slate-200/50">
            <CardHeader className="border-b bg-slate-50/50 flex flex-row items-center justify-between p-6">
              <div className="space-y-1">
                <CardTitle className="text-lg font-black text-slate-800">站点基本信息</CardTitle>
                <p className="text-xs text-slate-400 font-medium tracking-wide">配置前端访问路径与系统标识</p>
              </div>
              <Button onClick={() => handleSave('site_metadata', form)} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white px-8 h-11 font-black shadow-lg shadow-blue-500/20">
                {saving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" size={18} />} 保存信息
              </Button>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="grid grid-cols-2 gap-12">
                <div className="space-y-3">
                  <label className="text-sm font-black text-slate-600 flex items-center gap-2"><Link size={16} className="text-blue-500" /> 前端基准地址 (Frontend URL)</label>
                  <Input value={form.frontend_url} onChange={e => setForm({...form, frontend_url: e.target.value})} className="h-14 font-mono text-lg border-2 focus:border-blue-500 shadow-sm" placeholder="https://www.mysite.com" />
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-black text-slate-600 flex items-center gap-2"><Layout size={16} className="text-blue-500" /> 站点全名 (Site Name)</label>
                  <Input value={form.site_name} onChange={e => setForm({...form, site_name: e.target.value})} className="h-14 text-lg border-2 focus:border-blue-500 shadow-sm" placeholder="我的交易平台" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-100 shadow-xl shadow-slate-200/50">
            <CardHeader className="border-b bg-slate-50/50 p-6"><CardTitle className="text-lg font-black text-slate-800">全局 SEO 渲染模板</CardTitle></CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-xs text-blue-700 leading-relaxed">
                支持 <code>{"{{variable}}"}</code> 语法。可使用变量：
                <code className="mx-1 font-bold">{"{{name}}"}</code>(项目名), 
                <code className="mx-1 font-bold">{"{{site_name}}"}</code>(站点名), 
                <code className="mx-1 font-bold">{"{{description}}"}</code>(简述)。
                当业务集合或单页未配置 SEO 时，系统将自动回退至此默认模板。
              </div>
              <div className="grid grid-cols-2 gap-12">
                <div className="space-y-3">
                  <label className="text-sm font-black text-slate-600 flex items-center gap-2"><FileText size={16} className="text-slate-400" /> 标题模板 (Title)</label>
                  <Input value={form.default_seo_templates.title} onChange={e => setForm({...form, default_seo_templates: {...form.default_seo_templates, title: e.target.value}})} className="h-14 font-medium border-2 focus:border-blue-500" />
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-black text-slate-600 flex items-center gap-2"><FileText size={16} className="text-slate-400" /> 描述模板 (Description)</label>
                  <Input value={form.default_seo_templates.description} onChange={e => setForm({...form, default_seo_templates: {...form.default_seo_templates, description: e.target.value}})} className="h-14 font-medium border-2 focus:border-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-6">
          <Card className="border-blue-100 shadow-2xl shadow-blue-500/5 overflow-hidden">
            <CardHeader className="bg-slate-900 text-white p-8 flex flex-row items-center justify-between">
              <div className="space-y-2">
                <CardTitle className="text-2xl font-black flex items-center gap-3"><Globe size={28} className="text-blue-400" /> 托管集群根节点 (Primary Root)</CardTitle>
                <p className="text-slate-400 text-sm font-medium">输入您在 Cloudflare 绑定的主域名。所有业务子域将以此为基座自动展开。</p>
              </div>
              <Button onClick={() => handleSave('site_domains', dns)} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white h-12 px-10 font-black shadow-lg shadow-blue-500/40">
                更新映射
              </Button>
            </CardHeader>
            <CardContent className="p-10">
               <Input 
                 placeholder="例如: ycz.me" 
                 value={dns.main_domain} 
                 onChange={e => setDns({...dns, main_domain: e.target.value})} 
                 className="h-20 text-4xl font-black text-blue-600 border-x-0 border-t-0 border-b-4 border-blue-100 focus:border-blue-600 rounded-none text-center tracking-tighter shadow-none bg-transparent"
               />
            </CardContent>
          </Card>

          {/* 宽幅域名运维矩阵 */}
          <div className="space-y-6">
            {[
              { id: 'admin', label: '管理控制台 (Admin)', icon: ShieldCheck, desc: '后台登录、数据管理与系统配置入口', default: 'admin.' },
              { id: 'api', label: '业务 API 网关 (Public)', icon: Zap, desc: '前端数据收集、提交与分发公开入口', default: 'api.' },
              { id: 'img', label: '多媒体加速 (Image)', icon: Image, desc: '流式资源代理、R2 内容边缘加速入口', default: 'img.' }
            ].map(item => {
              const full = dns[`${item.id}_domain` as keyof typeof dns] || (dns.main_domain ? `${item.default}${dns.main_domain}` : '');
              const st = checkStatus[item.id] || 'idle';

              return (
                <Card key={item.id} className={`border-slate-100 transition-all duration-300 ${st === 'ok' ? 'ring-4 ring-emerald-500/20 bg-emerald-50/10' : 'hover:shadow-2xl hover:border-blue-100'}`}>
                  <CardContent className="p-8 flex items-center gap-12">
                    <div className="flex-shrink-0 w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center">
                       <item.icon size={40} className={st === 'ok' ? 'text-emerald-500' : 'text-slate-400'} />
                    </div>
                    
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center justify-between">
                         <h4 className="text-xl font-black text-slate-800">{item.label}</h4>
                         {st === 'ok' && <span className="flex items-center gap-1 px-3 py-1 bg-emerald-500 text-white text-[10px] font-black rounded-full uppercase italic tracking-wider shadow-md shadow-emerald-200">READY TO BIND</span>}
                      </div>
                      <p className="text-sm text-slate-400 font-medium">{item.desc}</p>
                      <div className="flex items-center gap-4">
                        <Input 
                          placeholder={item.default + (dns.main_domain || 'domain.com')} 
                          value={dns[`${item.id}_domain` as keyof typeof dns] || ''}
                          onChange={e => setDns({...dns, [`${item.id}_domain`]: e.target.value})}
                          className="flex-1 h-12 font-mono text-blue-600 bg-slate-50 border-slate-200 font-bold"
                        />
                        <div className="text-xs text-slate-400 font-bold w-48 truncate">目标: {full || '未配置'}</div>
                        <div className="flex gap-2">
                           <Button onClick={() => runCloudflareOp(item.id as any, 'check')} disabled={st === 'loading' || !dns.main_domain} variant="outline" className="h-12 px-6 font-black border-2">
                             {st === 'loading' ? <Loader2 className="animate-spin" size={16} /> : <div className="flex items-center gap-2"><RefreshCw size={16} /> 检测解析</div>}
                           </Button>
                           <Button onClick={() => runCloudflareOp(item.id as any, 'bind')} disabled={st !== 'ok' || saving} className="h-12 px-10 bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-lg shadow-emerald-200">
                             一键绑定至云端
                           </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
