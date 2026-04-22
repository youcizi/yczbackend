import React, { useState, useEffect } from 'react';
import { Mail, Save, Loader2, Key, Server, Hash } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useToast } from '../ui/Toaster';

export const MailSettings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const [form, setForm] = useState({
    provider_type: 'resend',
    resend_api_key: '',
    sender_email: '',
    smtp_config: { host: '', port: 465, user: '', pass: '' }
  });

  useEffect(() => {
    fetch('/api/v1/settings/mail_config')
      .then(res => res.json())
      .then(data => {
        setForm({
          provider_type: data.provider_type || 'resend',
          resend_api_key: data.resend_api_key || '',
          sender_email: data.sender_email || '',
          smtp_config: {
            host: data.smtp_config?.host || '',
            port: data.smtp_config?.port || 465,
            user: data.smtp_config?.user || '',
            pass: data.smtp_config?.pass || ''
          }
        });
        setLoading(false);
      })
      .catch(e => {
        toast({ variant: 'destructive', title: '加载失败', description: '无法获取邮件配置' });
        setLoading(false);
      });
  }, [toast]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/v1/settings/mail_config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        toast({ title: '保存成功', description: '全局邮件配置已更新' });
      } else {
        throw new Error('保存失败');
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: '保存失败', description: e.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-500"><Loader2 className="animate-spin mx-auto" /></div>;
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <Mail className="text-blue-600" size={24} />
          系统邮件服务 (Mail Service)
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          配置全局的底层邮件发送渠道，用于业务数据的通知钩子或系统报警。
        </p>
      </div>

      <Card className="border-slate-100 shadow-sm">
        <CardHeader className="border-b bg-slate-50">
          <CardTitle className="text-base flex items-center justify-between">
            发件服务商选择
            <div className="flex gap-2 bg-slate-200/50 p-1 rounded-lg">
               <button 
                 className={`px-4 py-1.5 text-sm rounded-md font-medium transition-all ${form.provider_type === 'resend' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                 onClick={() => setForm({...form, provider_type: 'resend'})}
               >Resend API</button>
               <button 
                 className={`px-4 py-1.5 text-sm rounded-md font-medium transition-all ${form.provider_type === 'smtp' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                 onClick={() => setForm({...form, provider_type: 'smtp'})}
               >自定义 SMTP</button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {form.provider_type === 'resend' ? (
            <div className="space-y-4">
              <div className="bg-blue-50/50 border border-blue-100 text-blue-700 p-4 rounded-lg text-sm">
                建议使用现代化的 Resend 服务（<a href="https://resend.com" target="_blank" rel="noreferrer" className="underline font-semibold">Resend.com</a>），它更适合在 Serverless (Workers) 环境下使用原生 HTTP 发送邮件。
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold flex items-center gap-2">
                  <Key size={14} className="text-slate-400" />
                  API Key
                </label>
                <Input 
                  type="text" 
                  placeholder="re_xxxxxxxxxxxxxxxxx" 
                  value={form.resend_api_key}
                  onChange={e => setForm({...form, resend_api_key: e.target.value})}
                  className="font-mono"
                />
                <p className="text-xs text-slate-400 mt-1">已存在的 Key 会回显脱敏（前置明文带有星号），修改时请全量粘贴新的 Key。</p>
              </div>
              <div className="space-y-2 pt-2">
                <label className="text-sm font-semibold flex items-center gap-2">
                  <Mail size={14} className="text-slate-400" />
                  默认公用发件人邮箱
                </label>
                <Input 
                  type="email" 
                  placeholder="no-reply@yourdomain.com" 
                  value={form.sender_email}
                  onChange={e => setForm({...form, sender_email: e.target.value})}
                />
                <p className="text-xs text-slate-400 mt-1">Resend 需确保此邮箱所属域名已在 Resend 后台完成 DNS 验证。</p>
              </div>
            </div>
          ) : (
             <div className="space-y-4">
               <div className="bg-orange-50/50 border border-orange-100 text-orange-700 p-4 rounded-lg text-sm">
                 注意：在 Cloudflare Workers 环境中使用传统 SMTP 需要注意端口封锁问题。
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold flex items-center gap-2"><Server size={14} /> 主机 (Host)</label>
                    <Input placeholder="smtp.example.com" value={form.smtp_config.host} onChange={e => setForm({...form, smtp_config: {...form.smtp_config, host: e.target.value}})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold flex items-center gap-2"><Hash size={14} /> 端口 (Port)</label>
                    <Input type="number" placeholder="465" value={form.smtp_config.port} onChange={e => setForm({...form, smtp_config: {...form.smtp_config, port: parseInt(e.target.value) || 465}})} />
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold flex items-center gap-2">认证账号 (User)</label>
                    <Input placeholder="no-reply@example.com" value={form.smtp_config.user} onChange={e => setForm({...form, smtp_config: {...form.smtp_config, user: e.target.value}})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold flex items-center gap-2">认证密码 (Password)</label>
                    <Input type="password" placeholder="邮箱验证码或密码" value={form.smtp_config.pass} onChange={e => setForm({...form, smtp_config: {...form.smtp_config, pass: e.target.value}})} />
                  </div>
               </div>
             </div>
          )}
          
          <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
            <Button onClick={handleSave} disabled={saving} className="bg-blue-600 text-white min-w-[120px] shadow-md shadow-blue-600/20">
              {saving ? <Loader2 className="animate-spin mr-2" size={16} /> : <Save className="mr-2" size={16} />}
              保存应用
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
